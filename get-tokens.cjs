const https = require('https');

// Generate a new magic link first
const { createClient } = require('./node_modules/@supabase/supabase-js/dist/index.cjs');
const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';

function followRedirect(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`  Redirect ${res.statusCode} → ${res.headers.location}`);
        resolve(res.headers.location);
      } else {
        console.log(`  Status: ${res.statusCode}`);
        resolve(null);
      }
      res.destroy();
    }).on('error', reject);
  });
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'koltonlarson99@gmail.com' });
  if (error) { console.error(error); return; }
  
  const verifyUrl = data.properties.action_link;
  console.log('Verify URL:', verifyUrl.slice(0, 80));
  
  // Follow the redirect
  const redirectTo = await followRedirect(verifyUrl);
  console.log('Final redirect:', redirectTo ? redirectTo.slice(0, 120) : 'none');
  
  if (redirectTo && redirectTo.includes('#access_token=')) {
    // Parse hash
    const hash = redirectTo.split('#')[1];
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');
    const expiresAt = params.get('expires_at');
    console.log('ACCESS_TOKEN:', accessToken);
    console.log('REFRESH_TOKEN:', refreshToken);
    console.log('EXPIRES_IN:', expiresIn);
    console.log('EXPIRES_AT:', expiresAt);
  }
}
main().catch(console.error);
