const { chromium } = require('playwright-core');
const fs = require('fs');

const ACTION_LINK = 'https://oilrfsnfvmybtpwbnjhh.supabase.co/auth/v1/verify?token=b59e20c3517f0bab7d37db54787694d566cf71962751e4362dff3c6f&type=magiclink&redirect_to=http://localhost:3002';
const BASE = 'http://localhost:3002';
const OUT = 'c:/Projects/lineup_lab/screenshots-auth2';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('✓', name, '|', page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Authenticate
  await page.goto(ACTION_LINK, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const finalUrl = page.url();
  console.log('Auth landed at:', finalUrl.slice(0, 80));

  // If redirected to homepage with token, navigate to dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '01-dashboard');

  await page.goto(`${BASE}/leagues`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '02-leagues');

  // Try to find league cards via text or links
  const allLinks = await page.$$eval('a', els => els.map(a => a.getAttribute('href')).filter(h => h));
  console.log('All links on leagues page:', allLinks.slice(0, 20));

  await page.goto(`${BASE}/rankings`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '03-rankings');

  await page.goto(`${BASE}/settings`, { waitUntil: 'load', timeout: 30000 });
  await shot(page, '04-settings');

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
