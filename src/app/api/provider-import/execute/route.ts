import { NextResponse } from "next/server";

import { requireProviderImportAccess } from "@/lib/providers/import/access";
import { executeImportSession } from "@/lib/providers/import/service";
import type { ExecuteImportRequest } from "@/lib/providers/import/types";
import { ProviderRepositoryError, ProviderRepositoryValidationError } from "@/lib/providers/repositories/shared";

export async function POST(request: Request) {
  const user = await requireProviderImportAccess();

  try {
    const body = (await request.json()) as ExecuteImportRequest;
    const response = await executeImportSession(user.id, body);
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof ProviderRepositoryValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof ProviderRepositoryError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to execute provider import." },
    { status: 500 }
  );
}
