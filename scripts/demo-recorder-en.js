#!/usr/bin/env node
/** Novelist DEMO — English version with English demo data + full settings flow */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5001';
const API = `${BASE}/api`;
const OUT = 'C:\\Users\\Public\\novelist-docs';
const GIF = path.join(OUT, 'demo-en.gif'), MP4 = path.join(OUT, 'demo-en.mp4');
const AI_CFG = { api_key: 'sk-demo', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' };

(async () => {
  console.log('=== Demo EN ===\n');
  fs.mkdirSync(OUT, { recursive: true });
  if ((await fetch(BASE)).status !== 200) { console.error('DOWN'); process.exit(1); }

  // Seed English demo data
  console.log('[seed] demo-en...');
  const seedRes = await fetch(`${API}/demo/seed-en`, { method: 'POST' });
  const { novel_id } = await seedRes.json();
  console.log(`[seed] id=${novel_id}`);

  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();

  // Intercept APIs to use English demo endpoints
  await p.route('**/api/novels', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ novel_id }) });
    } else { await route.continue(); }
  });
  await p.route(`**/api/novels/${novel_id}/generate-outline`, async (route) => {
    const res = await fetch(`${API}/demo/generate-outline-en/${novel_id}`, { method: 'POST' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: await res.text() });
  });
  await p.route(`**/api/novels/${novel_id}/generate`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ message: 'ok', progress: { generated: 9, total: 9 } }) });
  });

  // Load page in English
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(c => localStorage.setItem('novelist_ai_config', JSON.stringify(c)), AI_CFG);
  await p.evaluate(() => localStorage.setItem('novelist_locale', 'en'));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('text=Novelist', { timeout: 5000 });

  // ===== 1. Home → Settings (3s) =====
  console.log('[1] Settings');
  // Hover card first
  const card = p.locator('.cursor-pointer').first();
  if (await card.isVisible().catch(() => false)) { await card.hover(); await p.waitForTimeout(500); }

  // Open settings
  const cfgBtn = p.locator('button[title="模型设置"]').first();
  if (await cfgBtn.isVisible({ timeout: 2000 }).catch(() => false)) { await cfgBtn.click(); }
  await p.waitForTimeout(600);

  // Provider dropdown
  const sel = p.locator('select').first();
  if (await sel.isVisible().catch(() => false)) { await sel.click(); await p.waitForTimeout(300); await p.keyboard.press('Escape'); }
  await p.waitForTimeout(200);

  // API Key input
  const pwInp = p.locator('input[type="password"]').first();
  if (await pwInp.isVisible().catch(() => false)) { await pwInp.hover(); await p.waitForTimeout(500); }

  // API URL input
  const urlInp = p.locator('input[type="text"]:not([readonly])').last();
  if (await urlInp.isVisible().catch(() => false)) { await urlInp.hover(); await p.waitForTimeout(300); }

  // Test Connection button
  const testBtn = p.locator('button:has-text("Test Connection")').first();
  if (await testBtn.isVisible().catch(() => false)) { await testBtn.hover(); await p.waitForTimeout(400); }

  // Save button
  const saveCfg = p.locator('button:has-text("Save")').first();
  if (await saveCfg.isVisible().catch(() => false)) { await saveCfg.hover(); await p.waitForTimeout(300); }

  // Back to home
  const bk = p.locator('button:has-text("←")').first();
  if (await bk.isVisible().catch(() => false)) { await bk.click(); await p.waitForTimeout(300); }

  // ===== 2. Create → Guide → Outline (6s) =====
  console.log('[2] Create → Outline');
  await p.locator('button:has-text("New Novel")').first().click(); await p.waitForTimeout(200);
  const scifi = p.locator('button:has-text("Sci-Fi")').first();
  if (await scifi.isVisible().catch(() => false)) { await scifi.click(); await p.waitForTimeout(150); }
  await p.locator('textarea').first().click();
  await p.locator('textarea').first().fill(
    'An ordinary programmer accidentally travels to a cyberpunk world in 2077 while working late. ' +
    'He discovers he can control reality with code.\n' +
    'In a neon-lit cyber-city, cyborgs and AI coexist under the rule of mega-corporations.\n' +
    'The core conflict is the battle between human consciousness and the super-AI Mother.\n' +
    'Dark cyberpunk style with philosophical depth.\n' +
    'The protagonist has elite hacking skills to reverse-engineer AI systems.'
  );
  await p.waitForTimeout(200);
  await p.locator('button:has-text("🚀")').first().click(); await p.waitForTimeout(400);

  // Guide modal
  for (let i = 0; i < 5; i++) {
    const opt = p.locator('.fixed .flex-wrap button').first();
    if (await opt.isVisible({ timeout: 500 }).catch(() => false)) { await opt.click(); await p.waitForTimeout(120); }
    else break;
  }
  await p.waitForTimeout(300);
  const ds = p.locator('button:has-text("Submit Directly")').first();
  if (await ds.isVisible({ timeout: 4000 }).catch(() => false)) { await ds.click(); }
  await p.waitForTimeout(1500);

  // ===== 3. Outline — draft (5s) =====
  console.log('[3] Outline');
  await p.waitForSelector('text=Volume 1', { timeout: 8000 }).catch(() => { });
  const ti = p.locator('input[type="text"]').first();
  if (await ti.isVisible({ timeout: 2000 }).catch(() => false)) { await ti.hover(); await p.waitForTimeout(300); }
  await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);

  if (await ti.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ti.click(); await p.waitForTimeout(150);
    await ti.press('Control+a'); await p.waitForTimeout(80);
    await ti.fill('CyberCode: Origins'); await p.waitForTimeout(250);
    await ti.press('Tab');
  }
  const vd = p.locator('textarea').first();
  if (await vd.isVisible({ timeout: 1000 }).catch(() => false)) {
    await vd.click(); await p.waitForTimeout(150);
    await vd.press('Control+a'); await p.waitForTimeout(80);
    await vd.fill('Lin Chen travels to a cyberpunk city in 2077, where programming becomes real power.');
    await p.waitForTimeout(300);
  }

  // ===== 4. Confirm + Generate (3s) =====
  console.log('[4] Confirm');
  const cf = p.locator('button:has-text("✅ Confirm")').first();
  await cf.waitFor({ state: 'visible', timeout: 5000 });
  await cf.click(); await p.waitForTimeout(1000);

  const gn = p.locator('button:has-text("Generate")').first();
  await gn.waitFor({ state: 'visible', timeout: 8000 });
  await gn.hover(); await p.waitForTimeout(800);

  // ===== 5. Generate → Reader (3s) =====
  console.log('[5] Generate');
  await gn.click(); await p.waitForTimeout(1000);
  await p.waitForSelector('text=Volume 1', { timeout: 5000 }).catch(() => { });
  await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);

  await ctx.close(); await b.close();
  const vf = await p.video().path();
  try {
    execSync(`ffmpeg -y -i "${vf}" -vf "fps=15,scale=1280:720:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" -loop 0 "${GIF}"`,
      { stdio: 'ignore', timeout: 60000 });
    fs.unlinkSync(vf); console.log(`[done] ${GIF}`);
  } catch (e) { fs.renameSync(vf, MP4); console.log(`[done] ${MP4}`); }
  console.log('✅');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
