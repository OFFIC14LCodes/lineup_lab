import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), "data", "acquisition", "cache");

export function readAcquisitionCache<T>(key: string): T | null {
  const file = cachePath(key);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function writeAcquisitionCache(key: string, value: unknown) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(key), `${JSON.stringify(value, null, 2)}\n`);
}

function cachePath(key: string) {
  return path.join(CACHE_DIR, `${key.replace(/[^a-z0-9_-]+/gi, "_")}.json`);
}
