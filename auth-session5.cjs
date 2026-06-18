const { createClient } = require('./node_modules/@supabase/supabase-js/dist/index.cjs');

const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Generate magic link for the real user
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'koltonlarson99@gmail.com'
  });
  if (error) { console.error('Error:', error); return; }

  console.log('Properties:', JSON.stringify(data.properties));
  if (data.action_link) console.log('ACTION_LINK:', data.action_link);
  // Also get the hashed token
  if (data.properties?.hashed_token) console.log('HASHED_TOKEN:', data.properties.hashed_token);
}
main().catch(console.error);
