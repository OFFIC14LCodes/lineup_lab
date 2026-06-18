const { chromium } = require('playwright-core');
const { createClient } = require('./node_modules/@supabase/supabase-js/dist/index.cjs');
const { createChunks } = require('./node_modules/@supabase/ssr/dist/main/utils/chunker.js');
const fs = require('fs');

const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const PROJECT_REF = 'oilrfsnfvmybtpwbnjhh';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';
const USER_ID = '1c6c34f5-bbd9-421e-ab2c-2fa72fd9078d';
const ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjViMWI5Y2VlLTBiYjEtNGEwYy1hMDVjLTVjZGQ1NDQ5NTAyYiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL29pbHJmc25mdm15YnRwd2JuamhoLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxYzZjMzRmNS1iYmQ5LTQyMWUtYWIyYy0yZmE3MmZkOTA3OGQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgxNzQ1NDE3LCJpYXQiOjE3ODE3NDE4MTcsImVtYWlsIjoia29sdG9ubGFyc29uOTlAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdvb2dsZSJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jTEdUUnlpeUlzSmpibUxlZTkxUnNQN1ZsMDB6Mk10UXBkQjd6NU51TlpHN1VZSEZmVFY9czk2LWMiLCJlbWFpbCI6ImtvbHRvbmxhcnNvbjk5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJLb2x0b24gTGFyc29uIiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwibmFtZSI6IktvbHRvbiBMYXJzb24iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NMR1RSeWl5SXNKamJtTGVlOTFSc1A3VmwwMHoyTXRRcGRCN3o1TnVOWkc3VVlIRmZUVj1zOTYtYyIsInByb3ZpZGVyX2lkIjoiMTAxNzcyMjcyMjc5MzgxODgzMjc4Iiwic3ViIjoiMTAxNzcyMjcyMjc5MzgxODgzMjc4In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib3RwIiwidGltZXN0YW1wIjoxNzgxNzQxODE3fV0sInNlc3Npb25faWQiOiJiMzMxOGEwZS0yZTIwLTRjZDMtYjAyYS1kZDhiZGI3NjJkZWYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.5IpM-b8DlfOWbLSdd7PGWReZccJSr7b5RQheRT8ewc5Q-NCExwLCxofzA1uneD0qp41wkymep750y3yaSpzkEg';
const REFRESH_TOKEN = 'lqi4malzqalc';
const EXPIRES_AT = 1781745417;
const BASE = 'http://localhost:3003';
const OUT = 'c:/Projects/lineup_lab/screenshots-final';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('✓', name, '|', page.url().slice(0, 60));
}

async function main() {
  // 1. Get the full user object via admin API
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(USER_ID);
  if (userError) { console.error('getUserById error:', userError); return; }
  const user = userData.user;
  console.log('Got user:', user.email);

  // 2. Construct Session object (matching Supabase's Session type)
  const session = {
    access_token: ACCESS_TOKEN,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: EXPIRES_AT,
    refresh_token: REFRESH_TOKEN,
    user
  };

  // 3. Use createChunks to split into cookie-sized pieces
  const cookieKey = `sb-${PROJECT_REF}-auth-token`;
  const sessionJson = JSON.stringify(session);
  console.log('Session JSON length:', sessionJson.length);
  const chunks = createChunks(cookieKey, sessionJson);
  console.log('Chunks:', chunks.map(c => `${c.name}(${c.value.length})`));

  // 4. Build Playwright cookie objects
  const playwrightCookies = chunks.map(chunk => ({
    name: chunk.name,
    value: chunk.value,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax'
  }));

  // 5. Launch browser, inject cookies, screenshot pages
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  // Set cookies
  await ctx.addCookies(playwrightCookies);
  console.log('Injected', playwrightCookies.length, 'cookies');

  const page = await ctx.newPage();

  // Test auth by navigating to dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  const title = await page.title();
  const content = await page.content();
  const hasError = content.includes('Internal Server Error') || content.includes('This page could not be found');
  const redirectedToLogin = page.url().includes('/login');
  console.log(`Dashboard: title="${title}", hasError=${hasError}, url=${page.url().slice(0, 60)}, redirectedToLogin=${redirectedToLogin}`);
  await shot(page, '01-dashboard');

  await page.goto(`${BASE}/leagues`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '02-leagues');
  const allLinks = await page.$$eval('a', els => els.map(a => a.getAttribute('href')).filter(Boolean));
  console.log('Links on leagues:', allLinks.slice(0, 20));

  await page.goto(`${BASE}/rankings`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '03-rankings');

  await page.goto(`${BASE}/settings`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '04-settings');

  await browser.close();
  console.log('\nScreenshots saved to', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
