// Normalizes a raw GSIS ID string to its canonical form.
// Standard format: "00-0039337" (two leading zeros, hyphen, 7 digits).
// Legacy format:   "ALL637395"  (alphanumeric, uppercase).
// Returns null for blank/null/undefined input.
// Never parses as a number — leading zeroes and hyphens are preserved as-is.
export function normalizeGsisId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}
