import "server-only";

import type { ExternalEntityType, ProviderName } from "@/lib/providers/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
export const MAX_BATCH_SIZE = 250;
export const MIGRATION_005_DEPENDENCY_NOTE =
  "Requires supabase/migrations/005_provider_football_data.sql to be applied in the target environment.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReadClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
export type WriteClient = ReturnType<typeof createAdminClient>;

export class ProviderRepositoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ProviderRepositoryError";
  }
}

export class ProviderRepositoryValidationError extends ProviderRepositoryError {
  constructor(message: string, details?: unknown) {
    super("validation_error", message, details);
    this.name = "ProviderRepositoryValidationError";
  }
}

export class ProviderRepositoryConflictError extends ProviderRepositoryError {
  constructor(message: string, details?: unknown) {
    super("conflict_error", message, details);
    this.name = "ProviderRepositoryConflictError";
  }
}

export class ProviderRepositoryPartialFailureError extends ProviderRepositoryError {
  constructor(message: string, details?: unknown) {
    super("partial_failure", message, details);
    this.name = "ProviderRepositoryPartialFailureError";
  }
}

export async function getReadClient(client?: ReadClient) {
  return client ?? (await createClient());
}

export function getWriteClient(client?: WriteClient) {
  return client ?? createAdminClient();
}

export function assertUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new ProviderRepositoryValidationError(`${label} must be a UUID.`);
  }
}

export function validateSeason(value: number, label = "season") {
  if (!Number.isInteger(value) || value < 1900 || value > 3000) {
    throw new ProviderRepositoryValidationError(`${label} must be a four-digit year.`);
  }
  return value;
}

export function validateWeek(value: number, label = "week") {
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw new ProviderRepositoryValidationError(`${label} must be an integer between 1 and 25.`);
  }
  return value;
}

export function normalizeLimitOffset(limit?: number, offset?: number) {
  const normalizedLimit = limit === undefined ? DEFAULT_LIMIT : limit;
  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
    throw new ProviderRepositoryValidationError("limit must be a positive integer.");
  }

  const normalizedOffset = offset ?? 0;
  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0) {
    throw new ProviderRepositoryValidationError("offset must be a non-negative integer.");
  }

  return {
    limit: Math.min(normalizedLimit, MAX_LIMIT),
    offset: normalizedOffset
  };
}

export function validateBatchSize(size: number, maxSize = MAX_BATCH_SIZE) {
  if (!Number.isInteger(size) || size < 1) {
    throw new ProviderRepositoryValidationError("Batch must contain at least one row.");
  }
  if (size > maxSize) {
    throw new ProviderRepositoryValidationError(`Batch size exceeds maximum of ${maxSize}.`);
  }
}

export function mapDatabaseError(error: { message: string; code?: string; details?: unknown }) {
  return new ProviderRepositoryError(error.code ?? "db_error", error.message, error.details);
}

export function normalizeOptionalProvider(provider?: ProviderName) {
  return provider ?? undefined;
}

export async function verifyExternalMapping(
  input: {
    playerId: string;
    provider: ProviderName;
    providerExternalId: string | null;
    requireVerifiedMapping: boolean;
  },
  client: WriteClient
) {
  if (!input.providerExternalId) return;

  const { data, error } = await client
    .from("player_external_ids")
    .select("player_id,external_type")
    .eq("provider", input.provider)
    .eq("external_id", input.providerExternalId);

  if (error) {
    throw mapDatabaseError(error);
  }

  const matches = (data ?? []) as Array<{ player_id: string; external_type: ExternalEntityType }>;
  if (!matches.length) {
    if (input.requireVerifiedMapping) {
      throw new ProviderRepositoryConflictError(
        `No external ID mapping exists for ${input.provider}:${input.providerExternalId}.`,
        { code: "mapping_required" }
      );
    }
    return;
  }

  if (matches.some((match) => match.player_id !== input.playerId)) {
    throw new ProviderRepositoryConflictError(
      `External ID ${input.provider}:${input.providerExternalId} is mapped to a different player.`,
      { code: "mapping_conflict" }
    );
  }
}
