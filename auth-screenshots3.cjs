const { chromium } = require('playwright-core');
const fs = require('fs');

const ACTION_LINK = 'https://oilrfsnfvmybtpwbnjhh.supabase.co/auth/v1/verify?token=f5eed76a8d7f3cabf316f9402b876a99de999dbf1bdae1abb02e502f&type=magiclink&redirect_to=http://localhost:3003';
const BASE = 'http://localhost:3003';
const OUT = 'c:/Projects/lineup_lab/screenshots-auth3';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('✓', name, '|', page.url().slice(0, 80));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Navigate to the magic link verification URL
  console.log('Navigating to auth verification...');
  await page.goto(ACTION_LINK, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('After magic link nav, at:', page.url().slice(0, 100));
  
  // Wait for client-side JS to exchange the hash token for a cookie session
  await page.waitForTimeout(5000);
  
  // Check cookies
  const cookies = await ctx.cookies('http://localhost:3003');
  console.log('Cookies after magic link:', cookies.map(c => c.name));
  
  // Check if we have any supabase-related cookies
  const supaCookies = cookies.filter(c => c.name.includes('supabase') || c.name.includes('auth') || c.name.includes('sb'));
  console.log('Supabase cookies:', supaCookies.map(c => `${c.name}=${c.value.slice(0,20)}...`));
  
  await shot(page, '00-landing-after-auth');
  
  // Navigate to dashboard and check
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, '01-dashboard');
  
  // Check cookies again
  const cookies2 = await ctx.cookies('http://localhost:3003');
  console.log('Cookies on dashboard:', cookies2.map(c => c.name));

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
