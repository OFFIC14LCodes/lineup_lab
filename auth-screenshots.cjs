const { chromium } = require('playwright-core');
const fs = require('fs');

const ACTION_LINK = 'https://oilrfsnfvmybtpwbnjhh.supabase.co/auth/v1/verify?token=793ab887523f1324270ff4739cf42506560cacdbda47793ec6c263f0&type=magiclink&redirect_to=http://localhost:3001';
const BASE = 'http://localhost:3001';
const OUT = 'c:/Projects/lineup_lab/screenshots-auth';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('✓', name, page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('Authenticating via magic link...');
  await page.goto(ACTION_LINK, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('Landed at:', page.url());
  await shot(page, '00-auth-landing');

  for (const [route, name] of [
    ['/dashboard', '01-dashboard'],
    ['/leagues', '02-leagues'],
    ['/rankings', '03-rankings'],
    ['/settings', '04-settings'],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 30000 });
    await shot(page, name);
  }

  // League detail
  await page.goto(`${BASE}/leagues`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  const leagueLinks = await page.$$eval('a[href^="/leagues/"]', els => els.map(a => a.getAttribute('href')));
  console.log('League links:', leagueLinks);

  if (leagueLinks.length > 0) {
    await page.goto(`${BASE}${leagueLinks[0]}`, { waitUntil: 'load', timeout: 30000 });
    await shot(page, '05-league-detail');

    const draftLinks = await page.$$eval('a[href^="/drafts/"]', els => els.map(a => a.getAttribute('href')));
    console.log('Draft links:', draftLinks);

    if (draftLinks.length > 0) {
      await page.goto(`${BASE}${draftLinks[0]}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(5000);
      await shot(page, '06-war-room');
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/06b-war-room-1920.png`, fullPage: false });
      console.log('✓ 06b-war-room-1920 (viewport)');
    }
  }

  await browser.close();
  console.log('\nAll done. Screenshots saved to', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
