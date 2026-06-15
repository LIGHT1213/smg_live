// smg_live relay — 让浏览器充当反向代理,把 CDN 的 HLS 流转发到局域网。
//
// 为什么不用 ffmpeg 直接拉流?
//   火山引擎 CDN (volc-stream.kksmg.com) 做了 TLS/JA3 指纹校验,只有真正的
//   Chromium TLS 握手才能通过 (curl / ffmpeg / node-fetch 全部 403)。
//   所以 relay 不再调用 ffmpeg,而是用 Puppeteer 页面的 fetch() 拉流,
//   再由本地 HTTP 服务转发给局域网客户端。源本身就是标准 HLS,无需转封装。
//
// 仅供个人在已授权/合法收看的前提下做局域网转发,不绕过任何额外 DRM;
// 合规责任由使用者承担。MIT License,见上级 LICENSE。

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const USERSCRIPT_PATH = join(REPO_ROOT, 'smg_fivestar.user.js');
const TARGET_URL = process.env.TARGET_URL || 'https://live.kankanews.com/huikan?id=10';
const PORT = Number(process.env.PORT || 8080);
const CAPTURE_TIMEOUT_MS = Number(process.env.CAPTURE_TIMEOUT_MS || 30000);
const M3U8_RE = /\.m3u8(\?|$)/i;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${stamp()}]`, ...a);
const err = (...a) => console.error(`[${stamp()}]`, ...a);

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------
function getLanAddresses() {
  const out = [];
  for (const [name, nets] of Object.entries(networkInterfaces())) {
    for (const n of nets) {
      if (n.family === 'IPv4' && !n.internal) out.push({ name, address: n.address });
    }
  }
  return out;
}

// Strip the ==UserScript== metadata block; keep the IIFE body only.
function stripUserscriptHeader(source) {
  const end = source.indexOf('// ==/UserScript==');
  if (end === -1) return source;
  return source.slice(end + '// ==/UserScript=='.length).trimStart();
}

// ---------------------------------------------------------------------------
// Browser setup: inject userscript, capture the real m3u8 URL.
// The browser stays open for the lifetime of the relay — it is the only thing
// that can talk to the CDN (TLS fingerprint), so we proxy ALL traffic through it.
// ---------------------------------------------------------------------------
async function launchBrowserAndCapture() {
  log('启动 Puppeteer (headless)…');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'],
  });

  const page = await browser.newPage();
  const userscriptSource = await readFile(USERSCRIPT_PATH, 'utf8');
  const body = stripUserscriptHeader(userscriptSource);
  log(`已读取 userscript (${userscriptSource.length}B),注入体 ${body.length}B`);
  await page.evaluateOnNewDocument(body);

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') log(`[page ${type}]`, msg.text());
  });

  let streamUrl = null;
  page.on('request', (req) => {
    const u = req.url();
    if (M3U8_RE.test(u)) streamUrl = u;
  });

  log(`打开目标页: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: CAPTURE_TIMEOUT_MS });

  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  while (!streamUrl && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!streamUrl) {
    await browser.close();
    throw new Error(`在 ${CAPTURE_TIMEOUT_MS / 1000}s 内未捕获到 .m3u8 请求`);
  }

  log('✅ 已确定流地址:', streamUrl.slice(0, 80) + '…');
  // Define helpers in the page context for proxying.
  await page.exposeFunction('__relayLog', (s) => log('[page-fetch]', s));
  return { browser, page, streamUrl };
}

// ---------------------------------------------------------------------------
// Resolve a segment reference found in the playlist to an absolute CDN URL.
// Segments are typically relative ("seg-xxx.ts") or already absolute.
// ---------------------------------------------------------------------------
function resolveSegUrl(segRaw, m3u8Url) {
  try {
    return new URL(segRaw, m3u8Url).href;
  } catch {
    return segRaw;
  }
}

// ---------------------------------------------------------------------------
// Rewrite a master/media playlist: turn every segment line into a local URL
// of the form /ts?u=<encoded absolute CDN url>. Leave non-segment lines alone.
// ---------------------------------------------------------------------------
function rewritePlaylist(text, m3u8Url) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    if (trimmed.endsWith('.m3u8') || M3U8_RE.test(trimmed)) {
      // nested playlist (variant) — point clients back at this relay's /live.m3u8
      out.push('/live.m3u8');
    } else {
      const abs = resolveSegUrl(trimmed, m3u8Url);
      // 路径必须带 .ts 扩展名:部分播放器 (如 ffmpeg 的 HLS demuxer) 会校验
      // 分片扩展名白名单,纯查询串形式的 URL 会被拒绝。
      out.push('/ts/seg.ts?u=' + encodeURIComponent(abs));
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Proxy primitives: fetch a URL through the browser page (uses its TLS stack).
// Returns { status, headers, body } where body is a Uint8Array for binary,
// or a string for playlists (caller decides).
// ---------------------------------------------------------------------------
async function proxyFetch(page, url, { asText = false } = {}) {
  // Evaluate inside the page so the request carries Chromium's TLS fingerprint.
  const result = await page.evaluate(async (u, wantText) => {
    try {
      // 用 same-origin 默认模式;CDN 请求本身不带 cookie,无需 include
      // (带 include 会触发 CORS:credentials + wildcard ACAO 冲突)
      const r = await fetch(u);
      if (!r.ok) return { status: r.status, err: 'http ' + r.status };
      if (wantText) {
        const t = await r.text();
        return { status: r.status, text: t };
      }
      const buf = await r.arrayBuffer();
      return { status: r.status, bytes: Array.from(new Uint8Array(buf)) };
    } catch (e) {
      return { status: 0, err: e.message };
    }
  }, url, asText);

  if (result.err) return { status: result.status || 0, error: result.err };
  if (asText) return { status: result.status, text: result.text };
  return { status: result.status, bytes: Uint8Array.from(result.bytes || []) };
}

// ---------------------------------------------------------------------------
// HTTP server: serve rewritten playlist + proxy ts bytes.
// ---------------------------------------------------------------------------
function startHttpServer(page, streamUrl) {
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, `http://localhost`);
      const pathname = u.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');

      if (pathname === '/live.m3u8') {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        const r = await proxyFetch(page, streamUrl, { asText: true });
        if (r.error) { res.writeHead(502); res.end('upstream: ' + r.error); return; }
        const rewritten = rewritePlaylist(r.text, streamUrl);
        res.writeHead(200);
        res.end(rewritten);
        return;
      }

      if (pathname === '/ts' || pathname.startsWith('/ts/')) {
        const cdnUrl = u.searchParams.get('u');
        if (!cdnUrl) { res.writeHead(400); res.end('missing u'); return; }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', 'video/mp2t');
        const r = await proxyFetch(page, cdnUrl);
        if (r.error) { res.writeHead(502); res.end('upstream: ' + r.error); return; }
        res.writeHead(200);
        res.end(Buffer.from(r.bytes));
        return;
      }

      res.writeHead(404);
      res.end('not found. use /live.m3u8');
    } catch (e) {
      err('HTTP 处理出错:', e.message);
      try { res.writeHead(500); res.end('server error'); } catch {}
    }
  });

  return new Promise((resolveS) => {
    server.listen(PORT, '0.0.0.0', () => {
      log(`HTTP 服务监听 0.0.0.0:${PORT}`);
      resolveS(server);
    });
  });
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
async function main() {
  const { browser, page, streamUrl } = await launchBrowserAndCapture();
  await startHttpServer(page, streamUrl);

  const addrs = getLanAddresses();
  log('✅ 直播已就绪,局域网内用以下任一地址播放(VLC/IINA):');
  log(`   http://localhost:${PORT}/live.m3u8`);
  for (const a of addrs) log(`   http://${a.address}:${PORT}/live.m3u8   (${a.name})`);
  log('说明:所有流量经本地浏览器中转 (CDN 有 TLS 指纹校验,这是唯一可行方式)。');

  // Periodically nudge the page so the player keeps the CDN token warm.
  setInterval(async () => {
    try {
      const live = await page.evaluate(() => document.visibilityState);
      if (live !== 'visible') await page.evaluate(() => { document.title = 'relay-keepalive'; });
    } catch {}
  }, 30000);

  const shutdown = async (sig) => {
    log(`收到 ${sig},正在关闭…`);
    try { await browser.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => { err('启动失败:', e.message); process.exit(1); });
