// Get a real user from Supabase and generate a session for screenshot testing
const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';

async function main() {
  // List users via admin API
  const usersResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY }
  });
  const usersData = await usersResp.json();
  const users = usersData.users ?? [];
  console.log('Users found:', users.length);
  if (!users.length) { console.log('NO USERS'); return; }

  const user = users[0];
  console.log('Using user:', user.email, user.id);

  // Generate a magic link / session token for this user
  const sessionResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}/generate-link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'magiclink' })
  });
  const sessionData = await sessionResp.json();
  console.log('Generate link response keys:', Object.keys(sessionData));
  // The response has action_link and properties
  if (sessionData.action_link) {
    console.log('ACTION_LINK:', sessionData.action_link);
  }
  if (sessionData.properties) {
    console.log('PROPERTIES:', JSON.stringify(sessionData.properties));
  }
}

main().catch(console.error);
