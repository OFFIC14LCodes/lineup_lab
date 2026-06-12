import { NextResponse } from "next/server";

import { requireProviderImportApiAccess } from "@/lib/providers/import/access";
import { toImportErrorPayload } from "@/lib/providers/import/errors";
import { approveImportMapping } from "@/lib/providers/import/service";
import type { MappingApprovalRequest } from "@/lib/providers/import/types";

export async function POST(request: Request) {
  try {
    const user = await requireProviderImportApiAccess();
    const body = (await request.json()) as MappingApprovalRequest;
    const response = await approveImportMapping(user.id, body);
    return NextResponse.json(response);
  } catch (error) {
    const serialized = toImportErrorPayload(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
