# 五星体育局域网直播 — 使用说明

把家里电脑变成一台"直播中转站":在外面给 Codex 发条消息,它自动启动服务,
你用手机/任何设备的 VLC 打开一个地址就能看五星体育直播。

---

## 它是怎么工作的

```
你(在外面)
  ↓ 给 Codex 发消息:"开五星体育直播"
家里 Mac 上的 Codex(常驻运行)
  ↓ 触发 smg-live-relay skill
  ↓ 执行 manage.sh start
relay 服务 (Puppeteer + HTTP)
  ↓ headless 浏览器打开 kankanews,注入解锁脚本
  ↓ 浏览器充当反向代理,中转 HLS 流
  ↓ 在 0.0.0.0:8080 对外服务
你的手机 VLC
  ↓ 打开 http://<家里Mac的IP>:8080/live.m3u8
  ✅ 看直播
```

**为什么用浏览器中转?** 火山引擎 CDN 做了 TLS 指纹校验,ffmpeg/curl 直拉全 403,
只有真正的 Chromium 能通过。所以服务用 headless Chrome 当代理,而非 ffmpeg。

---

## 一次性设置(已完成,仅供参考)

1. **relay 服务**:在 `smg_live/relay/` 下,`server.js` + `package.json`
2. **skill**:在 `~/.codex/skills/smg-live-relay/`,含 `SKILL.md` + `scripts/manage.sh`
3. **依赖**:Node.js + puppeteer(自带 Chromium);不需要 ffmpeg、不需要代理

---

## 日常使用

### 启动

给 Mac 上的 Codex 发消息,任意一种说法都行:
- "开五星体育直播"
- "打开直播"
- "start the live stream"
- "直播还在跑吗"(查询)

Codex 会调用 skill 启动服务,然后回复你播放地址,例如:
```
✅ 已就绪
本机:   http://localhost:8080/live.m3u8
局域网: http://192.168.31.165:8080/live.m3u8
```

### 播放

在 VLC / IINA / 手机 VLC / 智能电视里,添加网络串流:
```
http://192.168.31.165:8080/live.m3u8
```
- **VLC(电脑)**:菜单 → 打开网络 → 粘贴地址
- **VLC(手机)**:底部 + → 新建网络串流
- **IINA**:`iina --no-stdin "<地址>"`

### 停止

跟 Codex 说"关掉直播"或"停掉服务"即可。

### 换频道

默认五星体育 (`id=10`)。换频道跟 Codex 说"换成上视新闻",或自己:
```bash
TARGET_URL='https://live.kankanews.com/huikan?id=8' \
  bash ~/.codex/skills/smg-live-relay/scripts/manage.sh restart
```
常见 id:10=五星体育,8=上视新闻(以 kankanews 实际页面为准)。

---

## 在外面(外网)怎么看

relay 默认只在家庭局域网内可用。要在家庭网络之外观看,**推荐 Tailscale**:
1. 在 Mac 和手机都装 Tailscale(免费,无需公网 IP、无需路由器配置)
2. 都登录同一账号
3. 把播放地址里的局域网 IP 换成 Mac 的 Tailscale IP 即可

下载:https://tailscale.com

---

## 不依赖 Codex 的手动用法

如果 Codex 没在跑,直接终端操作:
```bash
bash ~/.codex/skills/smg-live-relay/scripts/manage.sh start     # 启动
bash ~/.codex/skills/smg-live-relay/scripts/manage.sh status    # 状态
bash ~/.codex/skills/smg-live-relay/scripts/manage.sh stop      # 停止
bash ~/.codex/skills/smg-live-relay/scripts/manage.sh restart   # 重启
bash ~/.codex/skills/smg-live-relay/scripts/manage.sh log       # 看日志
```

---

## 注意事项 / 已知限制

- **Mac 要开着、Codex 要登录**:你在外地发消息时,家里 Mac 必须处于唤醒状态、
  Codex 桌面客户端在运行,否则没人响应你的消息。建议 Mac 设为"合盖不睡眠"
  或用 `caffeinate` 防睡眠。
- **直播 token 会过期**:kankanews 的 m3u8 带 JWT token,通常几小时后失效。
  断了就跟 Codex 说"重启直播",它会 restart。
- **带宽 = 单机上行**:所有流量过 Mac 的浏览器中转,家里宽带上行带宽决定画质
  和并发。一个人看 720p 完全没问题。
- **首次启动慢**:第一次要 npm install + 下载 Chromium(约 150MB),之后约 5 秒启动。
- **不绕过 DRM**:本方案仅解除试看限制做局域网转发,合规责任由使用者承担。

---

## 文件位置

| 内容 | 路径 |
| --- | --- |
| relay 服务代码 | `五星体育/smg_live/relay/server.js` |
| skill 定义 | `~/.codex/skills/smg-live-relay/SKILL.md` |
| 管理脚本 | `~/.codex/skills/smg-live-relay/scripts/manage.sh` |
| 运行日志 | `五星体育/smg_live/relay/.relay.log` |
| PID 文件 | `五星体育/smg_live/relay/.relay.pid` |
