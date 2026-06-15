import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string; oauth_error?: string; oauth_error_code?: string; oauth_error_description?: string; exchange_error?: string }>;
}) {
  const params = await searchParams;
  const authErrorMessage = getAuthErrorMessage({
    error: params.error,
    oauthError: params.oauth_error,
    oauthErrorCode: params.oauth_error_code,
    oauthErrorDescription: params.oauth_error_description,
    exchangeError: params.exchange_error,
  });

  return <LoginForm authErrorMessage={authErrorMessage} nextPath={params.next} />;
}

function getAuthErrorMessage(input: {
  error: string | undefined;
  oauthError: string | undefined;
  oauthErrorCode: string | undefined;
  oauthErrorDescription: string | undefined;
  exchangeError: string | undefined;
}) {
  const detail = formatAuthErrorDetail(input);
  if (input.error === "auth_callback_missing_code") return `We could not complete sign-in because the OAuth callback was missing a code. Please try again.${detail}`;
  if (input.error === "auth_callback_exchange_failed") return `We could not complete sign-in with Supabase. Please try again.${detail}`;
  if (input.error === "auth_callback_failed") return `We could not complete sign-in. Please try again.${detail}`;
  return null;
}

function formatAuthErrorDetail(input: {
  oauthError: string | undefined;
  oauthErrorCode: string | undefined;
  oauthErrorDescription: string | undefined;
  exchangeError: string | undefined;
}) {
  const parts = [
    input.oauthError ? `OAuth error: ${input.oauthError}` : null,
    input.oauthErrorCode ? `Code: ${input.oauthErrorCode}` : null,
    input.oauthErrorDescription ? `Description: ${input.oauthErrorDescription}` : null,
    input.exchangeError ? `Exchange error: ${input.exchangeError}` : null,
  ].filter(Boolean);
  return parts.length ? ` ${parts.join(" ")}` : "";
}
