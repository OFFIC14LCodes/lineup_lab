import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const SUPABASE_URL = 'https://oilrfsnfvmybtpwbnjhh.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbHJmc25mdm15YnRwd2JuamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ1MiwiZXhwIjoyMDk2Nzc5NDUyfQ.JBExsxkGE6KQyc7pRqi0kSAu2EzGPtnEzKpcqXazrLY';
const PROJECT_REF = 'oilrfsnfvmybtpwbnjhh';
const USER_EMAIL = 'koltonlarson99@gmail.com';
const BASE_URL = 'http://localhost:3012';

const OUT_DIR = 'C:/Users/kolto/AppData/Local/Temp/audit_shots';
fs.mkdirSync(OUT_DIR, { recursive: true });

const LEAGUE_ID = 'fde3c4a0-3cb6-4fac-890d-b43c5c2f0c1a';
const LEAGUE_ID2 = '566b01f1-28df-48f2-ac3d-2ecaf0eeb09e';
const DRAFT_ROOM_ID = 'f85238ff-b2ee-4053-8493-e38c4cb63bd3';

const ROUTES = [
  { name: '01_dashboard', path: '/dashboard' },
  { name: '02_leagues', path: '/leagues' },
  { name: '03_league_predraft', path: `/leagues/${LEAGUE_ID}` },
  { name: '04_league_inseason', path: `/leagues/${LEAGUE_ID2}` },
  { name: '05_rankings', path: '/rankings' },
  { name: '06_settings', path: '/settings' },
  { name: '07_warroom_full', path: `/drafts/${DRAFT_ROOM_ID}` },
];

async function getSessionCookies() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: usersData, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw new Error('listUsers: ' + listErr.message);
  const user = usersData.users.find(u => u.email === USER_EMAIL);
  if (!user) throw new Error('User not found');
  console.log('User ID:', user.id, '| email:', user.email);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: USER_EMAIL,
    options: { redirectTo: `${BASE_URL}/auth/callback` }
  });
  if (linkErr) throw new Error('generateLink: ' + linkErr.message);

  const actionLink = linkData.properties?.action_link;
  console.log('Action link:', actionLink.substring(0, 80));

  // Follow redirects until we see access_token in the location header (token is in hash)
  let current = actionLink;
  let tokenUrl = null;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(current, { redirect: 'manual' });
    const loc = res.headers.get('location');
    console.log(`  [${res.status}] -> ${loc ? loc.substring(0, 120) : '(no loc)'}`);
    if (loc && loc.includes('access_token')) {
      tokenUrl = loc.startsWith('http') ? loc : new URL(loc, current).toString();
      break;
    }
    if ((res.status >= 300 && res.status < 400) && loc) {
      // Only follow non-localhost redirects to avoid ECONNREFUSED
      const next = loc.startsWith('http') ? loc : new URL(loc, current).toString();
      if (new URL(next).hostname === 'localhost') {
        tokenUrl = next;
        break;
      }
      current = next;
    } else {
      break;
    }
  }
  if (!tokenUrl) throw new Error('No redirect with access_token found');
  console.log('Token URL:', tokenUrl.substring(0, 120));

  const finalURL = new URL(tokenUrl);
  const hash = new URLSearchParams(finalURL.hash.replace(/^#/, ''));
  const qs = finalURL.searchParams;

  const access_token = hash.get('access_token') || qs.get('access_token');
  const refresh_token = hash.get('refresh_token') || qs.get('refresh_token');

  if (!access_token || !refresh_token) {
    console.log('Hash keys:', [...hash.keys()]);
    console.log('QS keys:', [...qs.keys()]);
    throw new Error('No tokens in final URL — check logs above');
  }

  // Build the full session object that @supabase/ssr expects
  // (must include user — without it JSON.parse of the assembled cookie fails)
  const session = {
    access_token,
    refresh_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      phone: user.phone ?? '',
      confirmed_at: user.confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
      identities: user.identities ?? [],
      created_at: user.created_at,
      updated_at: user.updated_at ?? user.created_at,
    }
  };
  console.log('Session JSON length:', JSON.stringify(session).length);

  const { createChunks } = await import(
    'file:///C:/Projects/lineup_lab/node_modules/@supabase/ssr/dist/main/utils/chunker.js'
  );
  const chunks = createChunks(`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session), 3180);
  const cookies = chunks.map(({ name, value }) => ({
    name, value, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax'
  }));
  console.log('Cookies built:', cookies.length);
  return cookies;
}

async function main() {
  const cookies = await getSessionCookies();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'
  });
  await ctx.addCookies(cookies);

  // Warmup
  const warm = await ctx.newPage();
  await warm.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  const landed = warm.url();
  console.log('Warmup landed:', landed);
  if (landed.includes('/login')) throw new Error('Auth rejected');
  await warm.close();

  // Screenshot all routes
  for (const route of ROUTES) {
    console.log('\n' + route.name);
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 50000 });
      if (route.name.includes('warroom')) await p.waitForTimeout(5000);
      else await p.waitForTimeout(600);
      await p.screenshot({ path: path.join(OUT_DIR, `${route.name}.png`), fullPage: true });
      console.log('  OK');
    } catch (e) { console.error('  ERR:', e.message); }
    await p.close();
  }

  // War room viewport shots
  console.log('\nWar room viewport shots...');
  const wr = await ctx.newPage();
  await wr.goto(`${BASE_URL}/drafts/${DRAFT_ROOM_ID}`, { waitUntil: 'networkidle', timeout: 50000 });
  await wr.waitForTimeout(5000);
  for (const [label, y] of [['top', 0], ['mid', 800], ['board', 1600], ['deep', 2400]]) {
    await wr.evaluate(sy => window.scrollTo(0, sy), y);
    await wr.waitForTimeout(300);
    await wr.screenshot({ path: path.join(OUT_DIR, `08_wr_${label}.png`) });
    console.log(`  ${label} ok`);
  }
  await wr.close();

  await browser.close();
  console.log('\nAll done:', OUT_DIR);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
