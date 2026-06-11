import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const authErrorMessage =
    params.error === "auth_callback_failed"
      ? "We could not complete sign-in. Please request a new magic link and try again."
      : null;

  return <LoginForm authErrorMessage={authErrorMessage} />;
}
