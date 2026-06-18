const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';

async function main() {
  const usersResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY }
  });
  const usersData = await usersResp.json();
  const users = usersData.users ?? [];

  // Find real user (not smoke test)
  const realUser = users.find(u => !u.email.includes('smoke_test')) || users[0];
  console.log('Using user:', realUser.email, realUser.id);

  // Generate a token via admin sign-in (create session directly)
  const tokenResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: realUser.email, password: 'notarealpassword' })
  });
  const tokenText = await tokenResp.text();
  console.log('Token response (first 200):', tokenText.substring(0, 200));

  // Try admin create session differently - use generate link then follow it
  const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${realUser.id}/generate-link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'magiclink', email: realUser.email })
  });
  const linkText = await linkResp.text();
  console.log('Link response status:', linkResp.status);
  console.log('Link response (first 400):', linkText.substring(0, 400));
}

main().catch(console.error);
