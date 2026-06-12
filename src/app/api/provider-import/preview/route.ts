import { NextResponse } from "next/server";

import { requireProviderImportApiAccess } from "@/lib/providers/import/access";
import { toImportErrorPayload } from "@/lib/providers/import/errors";
import { createImportPreview } from "@/lib/providers/import/service";
import type { ImportPreviewRequest } from "@/lib/providers/import/types";

export async function POST(request: Request) {
  try {
    const user = await requireProviderImportApiAccess();
    const body = (await request.json()) as ImportPreviewRequest;
    const response = await createImportPreview(user.id, body);
    return NextResponse.json(response);
  } catch (error) {
    const serialized = toImportErrorPayload(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
