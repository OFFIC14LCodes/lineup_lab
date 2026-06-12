import { rmSync } from "node:fs";
import { resolve } from "node:path";

// Remove stale TypeScript and generated-type artifacts so typecheck can
// regenerate them deterministically on the next run.
const cleanupTargets = [
  ".next/types",
  ".next/cache/.tsbuildinfo",
  ".next/cache/typescript/tsconfig.typecheck.tsbuildinfo"
];

for (const target of cleanupTargets) {
  try {
    rmSync(resolve(target), { force: true, recursive: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "EPERM" || error.code === "EACCES")
    ) {
      continue;
    }
    throw error;
  }
}
