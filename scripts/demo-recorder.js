#!/usr/bin/env node
/**
 * 小说家 DEMO — 拦截 createOutline API，返回 demo seed 数据
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5001';
const API = `${BASE}/api`;
const OUT = 'C:\\Users\\Public\\novelist-docs';
const GIF = path.join(OUT, 'demo.gif'), MP4 = path.join(OUT, 'demo.mp4');
const AI_CFG = { api_key: 'sk-demo', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' };

(async () => {
  console.log('=== Demo ===\n');
  fs.mkdirSync(OUT, { recursive: true });
  if ((await fetch(BASE)).status !== 200) { console.error('DOWN'); process.exit(1); }

  // 预注入 demo 数据，拿到 demo novel_id
  console.log('[seed] demo seed...');
  const seedRes = await fetch(`${API}/demo/seed`, { method: 'POST' });
  const { novel_id } = await seedRes.json();
  console.log(`[seed] id=${novel_id}`);

  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();

  // 拦截 fetch，把 createNovel 和 generateOutline 重定向到 demo API
  await p.route('**/api/novels', async (route) => {
    if (route.request().method() === 'POST') {
      // 返回 demo seed 的 novel_id
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ novel_id }) });
    } else {
      await route.continue();
    }
  });
  await p.route(`**/api/novels/${novel_id}/generate-outline`, async (route) => {
    // 返回已注入的大纲数据
    const res = await fetch(`${API}/demo/generate-outline/${novel_id}`, { method: 'POST' });
    const data = await res.json();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await p.route(`**/api/novels/${novel_id}/generate`, async (route) => {
    // 生成小说时跳过 AI，直接设 done
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ message: 'ok', progress: { generated: 9, total: 9 } }) });
  });

  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(c => localStorage.setItem('novelist_ai_config', JSON.stringify(c)), AI_CFG);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('text=小说家', { timeout: 5000 });

  // ===== 1. 模型设置 (2s) =====
  console.log('[1] 设置');
  const cfgBtn = p.locator('button[title="模型设置"]').first();
  if (await cfgBtn.isVisible({ timeout: 2000 }).catch(() => false)) { await cfgBtn.click(); }
  await p.waitForTimeout(500);
  const sel = p.locator('select').first();
  if (await sel.isVisible().catch(() => false)) { await sel.click(); await p.waitForTimeout(200); await p.keyboard.press('Escape'); }
  await p.waitForTimeout(200);
  const pwInp = p.locator('input[type="password"]').first();
  if (await pwInp.isVisible().catch(() => false)) { await pwInp.hover(); await p.waitForTimeout(400); }
  const backBtn = p.locator('button:has-text("←")').first();
  if (await backBtn.isVisible().catch(() => false)) { await backBtn.click(); await p.waitForTimeout(200); }

  // ===== 2. 创建+引导+提交→大纲 (6s) =====
  console.log('[2] 创建→大纲');
  await p.locator('button:has-text("创建")').first().click(); await p.waitForTimeout(200);
  const scifi = p.locator('button:has-text("科幻")').first();
  if (await scifi.isVisible().catch(() => false)) { await scifi.click(); await p.waitForTimeout(150); }
  await p.locator('textarea').first().click();
  await p.locator('textarea').first().fill(
    '一名普通程序员深夜加班时意外穿越到2077年的赛博朋克世界，发现能用编程代码操控现实。\n' +
    '霓虹闪烁的赛博之城里，义体人和AI共存，超级企业控制一切。\n' +
    '核心冲突是人类意识与超级AI母体的对决。\n' +
    '风格为赛博朋克黑暗哲学思辨。\n' +
    '主角优势是顶级黑客技能，能逆向工程AI系统。'
  );
  await p.waitForTimeout(200);
  await p.locator('button:has-text("创意提交")').first().click(); await p.waitForTimeout(400);

  // 引导弹窗
  for (let i = 0; i < 5; i++) {
    const opt = p.locator('.fixed .flex-wrap button').first();
    if (await opt.isVisible({ timeout: 500 }).catch(() => false)) { await opt.click(); await p.waitForTimeout(120); }
    else break;
  }
  await p.waitForTimeout(300);

  // "直接提交" → handleCreate → 调 API → 被 route 拦截 → 返回 novel_id=5 → 跳大纲
  const ds = p.locator('button:has-text("直接提交")').first();
  if (await ds.isVisible({ timeout: 4000 }).catch(() => false)) { await ds.click(); }
  await p.waitForTimeout(1500);

  // ===== 3. 大纲页 draft 状态 (5s) =====
  console.log('[3] 大纲');
  await p.waitForSelector('text=第一卷', { timeout: 8000 }).catch(() => { });
  const ti = p.locator('input[type="text"]').first();
  if (await ti.isVisible({ timeout: 2000 }).catch(() => false)) { await ti.hover(); await p.waitForTimeout(300); }

  // 滚动
  await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);

  // 编辑
  if (await ti.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ti.click(); await p.waitForTimeout(150);
    await ti.press('Control+a'); await p.waitForTimeout(80);
    await ti.fill('赛博代码：源起'); await p.waitForTimeout(250);
    await ti.press('Tab');
  }
  const vd = p.locator('textarea').first();
  if (await vd.isVisible({ timeout: 1000 }).catch(() => false)) {
    await vd.click(); await p.waitForTimeout(150);
    await vd.press('Control+a'); await p.waitForTimeout(80);
    await vd.fill('林晨穿越到2077年赛博朋克都市，编程能力变成真正的超能力。');
    await p.waitForTimeout(300);
  }

  // ===== 4. 确认 + 生成按钮 (3s) =====
  console.log('[4] 确认');
  const cf = p.locator('button:has-text("确认大纲")').first();
  await cf.waitFor({ state: 'visible', timeout: 5000 });
  await cf.click(); await p.waitForTimeout(1000);

  const gn = p.locator('button:has-text("开始生成")').first();
  await gn.waitFor({ state: 'visible', timeout: 8000 });
  await gn.hover(); await p.waitForTimeout(800);

  // ===== 5. 生成+阅读器 (3s) =====
  console.log('[5] 生成');
  await gn.click(); await p.waitForTimeout(1000);
  await p.waitForSelector('text=第一卷', { timeout: 5000 }).catch(() => { });
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
