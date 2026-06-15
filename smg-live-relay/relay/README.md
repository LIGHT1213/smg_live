# smg_live relay — 局域网 HLS 转发服务

把 `kankanews.com` 的五星体育直播流转发到本机,局域网内的
VLC / IINA / 电视等任意标准 HLS 播放器可直接打开播放。

## 工作原理

火山引擎 CDN (`volc-stream.kksmg.com`) 做了 **TLS/JA3 指纹校验**:
只有真正的 Chromium 内核 TLS 握手才能拉到流,ffmpeg / curl / node-fetch
全部被 403。所以本服务**不调用 ffmpeg**,而是让 Puppeteer 打开的
headless Chromium 充当反向代理:

```
局域网播放器 (VLC)
   ↓ HTTP
本地 relay 服务 (0.0.0.0:8080)
   ↓ /live.m3u8  /  /ts/seg.ts
Puppeteer page.evaluate(fetch)   ← 用 Chromium 的 TLS 身份
   ↓
kankanews 页面 (注入 userscript 解锁) → 火山引擎 CDN
```

- **解锁**:`smg_fivestar.user.js` 经 `evaluateOnNewDocument` 注入,
  等价于 userscript 的 `@run-at document-start`。
- **抓流**:监听页面的网络请求,捕获播放器发出的 `.m3u8` 地址。
- **转发**:relay 把 playlist 里的 ts 路径改写成本地 `/ts/seg.ts?u=...`,
  客户端请求时再用浏览器 fetch 去 CDN 拉字节透传回来。
- **无需 ffmpeg / 无需转码**:源本身就是标准 HLS (H.264 + AAC)。

## 前置依赖

- **Node.js ≥ 18**(已在 Node 24 验证)
- **不需要 ffmpeg、不需要代理** —— kankanews 是国内 CDN,直连即可
- 首次 `npm install` 会自动下载 Chromium(约 150MB)。

## 运行

```bash
cd relay
npm install     # 首次:装 puppeteer + Chromium
npm start
```

启动成功后打印局域网播放地址:

```
✅ 直播已就绪,局域网内用以下任一地址播放(VLC/IINA):
   http://localhost:8080/live.m3u8
   http://192.168.1.20:8080/live.m3u8   (en0)
```

在任意局域网设备的 VLC/IINA 里打开对应地址即可。

## 配置项(环境变量)

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8080` | HTTP 服务端口 |
| `TARGET_URL` | `https://live.kankanews.com/huikan?id=10` | 目标页(改 id 可换频道) |
| `CAPTURE_TIMEOUT_MS` | `30000` | 抓流超时,未拿到 m3u8 则退出 |

例:`PORT=9000 npm start`

## 已知限制(v2)

- **带宽受单机上行限制**:所有流量经本地浏览器中转,上行带宽即并发上限。
- **Chrome 常驻**:约 200MB 内存,用于保活页面 + 提供 TLS 身份。
- **单频道**:默认五星体育,可用 `TARGET_URL` 切换。
- **不自动重连**:CDN token 过期或页面崩溃需手动重启 `npm start`。
- **CORS**:relay 对所有响应加 `Access-Control-Allow-Origin: *`,
  方便浏览器端 `hls.js` 直接播放。

## 验证方式

```bash
# 启动 relay 后,用 ffmpeg 验证流可解码(应看到 H.264 + AAC,持续输出帧):
ffmpeg -i http://localhost:8080/live.m3u8 -t 10 -c copy -f null -
```

## 合规声明

仅供个人在已授权/合法收看的前提下做局域网转发,不绕过任何额外 DRM。
合规责任由使用者承担。MIT License,见上级 `LICENSE`。
