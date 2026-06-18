const { chromium } = require('playwright-core');
const { createClient } = require('./node_modules/@supabase/supabase-js/dist/index.cjs');
const { createChunks } = require('./node_modules/@supabase/ssr/dist/main/utils/chunker.js');
const fs = require('fs');

const BASE = 'http://localhost:3005';
const OUT = 'c:/Projects/lineup_lab/screenshots-warroom';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjViMWI5Y2VlLTBiYjEtNGEwYy1hMDVjLTVjZGQ1NDQ5NTAyYiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL29pbHJmc25mdm15YnRwd2JuamhoLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxYzZjMzRmNS1iYmQ5LTQyMWUtYWIyYy0yZmE3MmZkOTA3OGQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgxNzQ1NDE3LCJpYXQiOjE3ODE3NDE4MTcsImVtYWlsIjoia29sdG9ubGFyc29uOTlAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdvb2dsZSJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jTEdUUnlpeUlzSmpibUxlZTkxUnNQN1ZsMDB6Mk10UXBkQjd6NU51TlpHN1VZSEZmVFY9czk2LWMiLCJlbWFpbCI6ImtvbHRvbmxhcnNvbjk5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJLb2x0b24gTGFyc29uIiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwibmFtZSI6IktvbHRvbiBMYXJzb24iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NMR1RSeWl5SXNKamJtTGVlOTFSc1A3VmwwMHoyTXRRcGRCN3o1TnVOWkc3VVlIRmZUVj1zOTYtYyIsInByb3ZpZGVyX2lkIjoiMTAxNzcyMjcyMjc5MzgxODgzMjc4Iiwic3ViIjoiMTAxNzcyMjcyMjc5MzgxODgzMjc4In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib3RwIiwidGltZXN0YW1wIjoxNzgxNzQxODE3fV0sInNlc3Npb25faWQiOiJiMzMxOGEwZS0yZTIwLTRjZDMtYjAyYS1kZDhiZGI3NjJkZWYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.5IpM-b8DlfOWbLSdd7PGWReZccJSr7b5RQheRT8ewc5Q-NCExwLCxofzA1uneD0qp41wkymep750y3yaSpzkEg';
const REFRESH_TOKEN = 'lqi4malzqalc';

async function buildCookies() {
  const admin = createClient('https://oilrfsnfvmybtpwbnjhh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY', { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.auth.admin.getUserById('1c6c34f5-bbd9-421e-ab2c-2fa72fd9078d');
  const session = { access_token: ACCESS_TOKEN, token_type: 'bearer', expires_in: 3600, expires_at: 1781745417, refresh_token: REFRESH_TOKEN, user: data.user };
  const chunks = createChunks('sb-oilrfsnfvmybtpwbnjhh-auth-token', JSON.stringify(session));
  return chunks.map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
}

async function main() {
  const cookies = await buildCookies();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // League detail
  console.log('Loading league detail...');
  await page.goto(`${BASE}/leagues/8d1a3d47-0b1d-494c-bdab-1590fa630d7d`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/03-league-detail.png`, fullPage: true });
  console.log('✓ league-detail');

  // Get draft room links
  const draftLinks = await page.$$eval('a[href^="/drafts/"]', els => els.map(a => a.getAttribute('href')));
  console.log('Draft links found:', draftLinks);

  if (draftLinks.length > 0) {
    console.log('Loading war room:', draftLinks[0]);
    await page.goto(`${BASE}${draftLinks[0]}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/06-war-room.png`, fullPage: true });
    console.log('✓ war-room');
    
    // 1920 viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/06b-war-room-1920.png`, fullPage: false });
    console.log('✓ war-room-1920');
  }

  // Settings
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/settings`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/04-settings.png`, fullPage: true });
  console.log('✓ settings');

  await browser.close();
  console.log('Done!', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
