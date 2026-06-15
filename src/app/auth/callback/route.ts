import { NextResponse } from "next/server";

import { getSafeAuthNextPath } from "@/lib/supabase/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorParam = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next");
  const safeNext = getSafeAuthNextPath(next);

  if (!code) {
    logOAuthCallbackDiagnostics({
      requestOrigin: requestUrl.origin,
      codeExists: false,
      errorParam,
      errorCode,
      errorDescription,
      next,
      safeNext,
    });
    return NextResponse.redirect(buildLoginErrorUrl({
      origin: requestUrl.origin,
      error: "auth_callback_missing_code",
      oauthError: errorParam,
      oauthErrorCode: errorCode,
      oauthErrorDescription: errorDescription,
      next: safeNext,
    }));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logOAuthCallbackDiagnostics({
      requestOrigin: requestUrl.origin,
      codeExists: true,
      errorParam,
      errorCode,
      errorDescription,
      next,
      safeNext,
      exchangeErrorMessage: error.message,
      exchangeErrorStatus: getAuthErrorStatus(error),
    });
    return NextResponse.redirect(buildLoginErrorUrl({
      origin: requestUrl.origin,
      error: "auth_callback_exchange_failed",
      oauthError: errorParam,
      oauthErrorCode: errorCode,
      oauthErrorDescription: errorDescription,
      exchangeError: error.message,
      next: safeNext,
    }));
  }

  logOAuthCallbackDiagnostics({
    requestOrigin: requestUrl.origin,
    codeExists: true,
    errorParam,
    errorCode,
    errorDescription,
    next,
    safeNext,
  });
  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}

function logOAuthCallbackDiagnostics(input: {
  requestOrigin: string;
  codeExists: boolean;
  errorParam: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  next: string | null;
  safeNext: string;
  exchangeErrorMessage?: string;
  exchangeErrorStatus?: string | number | null;
}) {
  const payload = {
    codeExists: input.codeExists,
    error: input.errorParam,
    error_code: input.errorCode,
    error_description: input.errorDescription,
    next: input.next,
    safeNext: input.safeNext,
    exchangeCodeForSessionErrorMessage: input.exchangeErrorMessage,
    exchangeCodeForSessionErrorStatus: input.exchangeErrorStatus,
    requestOrigin: input.requestOrigin,
  };
  if (input.exchangeErrorMessage || input.errorParam || !input.codeExists) {
    console.warn("[supabase-oauth-callback]", payload);
    return;
  }
  console.info("[supabase-oauth-callback]", payload);
}

function getAuthErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "string" || typeof status === "number" ? status : null;
}

function buildLoginErrorUrl(input: {
  origin: string;
  error: string;
  oauthError: string | null;
  oauthErrorCode: string | null;
  oauthErrorDescription: string | null;
  exchangeError?: string;
  next: string;
}) {
  const url = new URL("/login", input.origin);
  url.searchParams.set("error", input.error);
  url.searchParams.set("next", input.next);
  if (input.oauthError) url.searchParams.set("oauth_error", input.oauthError.slice(0, 160));
  if (input.oauthErrorCode) url.searchParams.set("oauth_error_code", input.oauthErrorCode.slice(0, 160));
  if (input.oauthErrorDescription) url.searchParams.set("oauth_error_description", input.oauthErrorDescription.slice(0, 300));
  if (input.exchangeError) url.searchParams.set("exchange_error", input.exchangeError.slice(0, 300));
  return url;
}
