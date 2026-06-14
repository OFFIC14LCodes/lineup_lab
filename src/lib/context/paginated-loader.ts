// Resilient paginated loader for Supabase queries.
//
// Accepts a generic fetchPage callback and handles retry/backoff internally.
// No Supabase imports — fully testable with mock callbacks.
//
// Design:
//   - Each page is fetched independently with up to maxAttempts attempts
//   - Transient errors (network, 5xx, 429) are retried with exponential backoff
//   - Deterministic errors (schema, auth, invalid column) fail immediately
//   - Retries repeat the SAME page range — never advance the offset on failure
//   - Rows are only appended to the result after a page succeeds
//   - Idempotent: a full restart begins from page 0

export const DEFAULT_PAGE_SIZE = 500;
export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_BACKOFF_MS: readonly number[] = [500, 1_000, 2_000, 4_000, 8_000];
export const DEFAULT_JITTER_MS = 50;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type PagedQueryResult<T> = {
  data: T[] | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
};

export type PageProgress = {
  table: string;
  page: number;
  rowsThisPage: number;
  totalRows: number;
  from: number;
  to: number;
};

export type PaginatedLoadOpts = {
  table: string;
  pageSize?: number;       // default 500
  maxAttempts?: number;    // default 5
  backoffMs?: readonly number[];  // delays between retries (ms), default [500,1000,2000,4000,8000]
  jitterMs?: number;       // max random jitter per delay (ms), default 50
  season?: number;         // for error context
  seasonType?: string;     // for error context
  onProgress?: (info: PageProgress) => void;
  // Injectable sleep for testing (default: real setTimeout)
  sleep?: (ms: number) => Promise<void>;
};

// --------------------------------------------------------------------------
// Error classification
// --------------------------------------------------------------------------

// PostgreSQL/PostgREST error codes that indicate a permanent query problem
const DETERMINISTIC_PG_CODES = new Set([
  "42703",  // undefined_column
  "42P01",  // undefined_table
  "42501",  // insufficient_privilege
  "28000",  // invalid_authorization_specification
  "28P01",  // invalid_password
  "2F003",  // prohibited_sql_statement_attempted
  "42P10",  // invalid_column_reference (ON CONFLICT column not in unique constraint)
  "23502",  // not_null_violation
  "23503",  // foreign_key_violation
  "23505",  // unique_violation (only on deterministic conflicts, not transient)
  "22P02",  // invalid_text_representation (type cast failure)
]);

// HTTP status codes that indicate a deterministic (non-retryable) response
const DETERMINISTIC_HTTP_CODES = new Set(["400", "401", "403", "404", "409", "422"]);

// HTTP status codes that indicate a transient (retryable) server-side condition
const TRANSIENT_HTTP_CODES = new Set(["429", "500", "502", "503", "504"]);

const DETERMINISTIC_MSG = [
  /permission denied/i,
  /not allowed/i,
  /row.?level security/i,
  /invalid column/i,
  /undefined column/i,
  /undefined table/i,
  /does not exist/i,
  /unauthorized/i,
  /invalid token/i,
  /jwt/i,
  /authentication/i,
];

const TRANSIENT_MSG = [
  /fetch failed/i,
  /network timeout/i,
  /connection reset/i,
  /econnreset/i,
  /etimedout/i,
  /socket hang up/i,
  /connection refused/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /too many requests/i,
  /request timeout/i,
  /timed out/i,             // e.g. "Request timed out after 30000ms"
];

export function classifySupabaseError(
  error: { message?: string; code?: string }
): "transient" | "deterministic" | "unknown" {
  const msg = error.message ?? "";
  const code = error.code ?? "";

  // Deterministic wins over transient — never retry auth/schema errors
  if (DETERMINISTIC_PG_CODES.has(code)) return "deterministic";
  if (DETERMINISTIC_HTTP_CODES.has(code)) return "deterministic";
  // PostgREST schema-validation errors (PGRST116, PGRST200, etc.)
  if (/^PGRST/i.test(code)) return "deterministic";
  if (DETERMINISTIC_MSG.some((re) => re.test(msg))) return "deterministic";

  if (TRANSIENT_HTTP_CODES.has(code)) return "transient";
  if (TRANSIENT_MSG.some((re) => re.test(msg))) return "transient";

  return "unknown";
}

// --------------------------------------------------------------------------
// Error message builder
// --------------------------------------------------------------------------

export function buildPaginatedErrorMessage(opts: {
  table: string;
  page: number;
  from: number;
  to: number;
  attempt: number;
  maxAttempts: number;
  cause: string;
  classification: string;
  season?: number;
  seasonType?: string;
}): string {
  const lines = [
    `Paginated query failed:`,
    `  table=${opts.table}`,
    `  range=${opts.from}-${opts.to} (page ${opts.page})`,
    `  attempt=${opts.attempt}/${opts.maxAttempts}`,
  ];
  if (opts.season !== undefined) lines.push(`  season=${opts.season}`);
  if (opts.seasonType !== undefined) lines.push(`  season_type=${opts.seasonType}`);
  lines.push(`  cause=${opts.cause}`);
  if (opts.classification === "deterministic") {
    lines.push(`  [non-retryable: schema / auth / RLS error — check table name, columns, and permissions]`);
  } else if (opts.classification === "transient" && opts.attempt >= opts.maxAttempts) {
    lines.push(`  [retries exhausted: ${opts.maxAttempts} transient failures]`);
  } else if (opts.classification === "unknown") {
    lines.push(`  [non-retryable: unclassified error]`);
  }
  return lines.join("\n");
}

// --------------------------------------------------------------------------
// Core paginated loader
// --------------------------------------------------------------------------

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Fetch all rows from a paginated Supabase query with automatic retry/backoff.
 *
 * Guarantees:
 *   - Retries repeat the SAME page range (from/to unchanged on retry)
 *   - Rows are appended only after a page succeeds — no duplicates from retry
 *   - Deterministic errors (schema/auth) fail immediately without retrying
 *   - Transient errors (network/5xx/429) are retried up to maxAttempts times
 *   - Unknown errors are treated as non-retryable (fail immediately)
 *   - Returns when the last page returns fewer rows than pageSize
 */
export async function loadAllPagesWith<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedQueryResult<T>>,
  opts: PaginatedLoadOpts
): Promise<T[]> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const jitterMs = opts.jitterMs ?? DEFAULT_JITTER_MS;
  const sleepFn = opts.sleep ?? defaultSleep;
  const { table, season, seasonType, onProgress } = opts;

  const rows: T[] = [];

  for (let page = 0; ; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let pageRows: T[] | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await fetchPage(from, to);

      if (!error) {
        pageRows = (data ?? []) as T[];
        break; // page succeeded
      }

      const classification = classifySupabaseError(error);

      if (classification !== "transient" || attempt === maxAttempts) {
        throw new Error(
          buildPaginatedErrorMessage({
            table, page: page + 1, from, to,
            attempt, maxAttempts,
            cause: error.message,
            classification,
            season, seasonType,
          })
        );
      }

      // Transient, not final attempt: wait then retry same page
      const baseDelay = (backoffMs[attempt - 1] as number | undefined) ??
        (backoffMs[backoffMs.length - 1] as number);
      const actualDelay = baseDelay + (jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0);

      console.warn(
        `  [retry] table=${table} page=${page + 1} attempt=${attempt}/${maxAttempts}: ${error.message}`
      );
      console.warn(`  [retry] waiting ${actualDelay}ms before next attempt…`);
      await sleepFn(actualDelay);
    }

    if (pageRows === null) {
      // Unreachable: the inner loop either sets pageRows or throws
      throw new Error(`[internal] pageRows null after retry loop (table=${table} page=${page + 1})`);
    }

    // Append rows only after page succeeds (no duplicates from retry)
    rows.push(...pageRows);
    onProgress?.({ table, page: page + 1, rowsThisPage: pageRows.length, totalRows: rows.length, from, to });

    if (pageRows.length < pageSize) break; // final page
  }

  return rows;
}
