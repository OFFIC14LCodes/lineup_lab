// Use Supabase JS client to create admin session
const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';
const USER_ID = '1c6c34f5-bbd9-421e-ab2c-2fa72fd9078d';

async function main() {
  // Supabase JS admin - createClient with service role then admin.generateLink
  const { createClient } = await import('file:///C:/Projects/lineup_lab/node_modules/@supabase/supabase-js/dist/module/index.js');
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // List users
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) { console.error('listUsers error:', usersError); return; }
  console.log('Users:', usersData.users.map(u => u.email));

  // Generate link
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'koltonlarson99@gmail.com'
  });
  if (linkError) { console.error('generateLink error:', linkError); return; }
  console.log('Link data keys:', Object.keys(linkData));
  if (linkData.properties) console.log('Properties:', JSON.stringify(linkData.properties));
  if (linkData.action_link) console.log('ACTION_LINK:', linkData.action_link);
}
main().catch(console.error);
