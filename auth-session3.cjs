const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';
const USER_ID = '1c6c34f5-bbd9-421e-ab2c-2fa72fd9078d';

async function main() {
  // Try v2 admin API path
  const paths = [
    `/auth/v1/admin/users/${USER_ID}/token`,
    `/auth/v2/admin/users/${USER_ID}/generate-link`,
    `/auth/v1/admin/generate-link`,
  ];

  for (const path of paths) {
    const r = await fetch(`${SUPABASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', email: 'koltonlarson99@gmail.com' })
    });
    console.log(path, '->', r.status, (await r.text()).substring(0, 150));
  }
}
main().catch(console.error);
