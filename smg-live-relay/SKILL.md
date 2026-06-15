---
name: smg-live-relay
description: Start, stop, or check status of the local SMGTV/五星体育 live-stream relay service on this Mac. Use when the user asks to turn on / open / start the 五星体育 (or SMGTV/kankanews) live stream, watch it on the LAN, check if the relay is running, or stop it. The relay re-serves the live stream as a standard HLS playlist that any player (VLC/IINA/TV) on the local network can open. Common triggers: "开五星体育直播", "打开smg直播", "直播还在跑吗", "关掉直播", "start the smg relay", "is the live stream running".
---

# SMG Live Relay 控制

在本机管理五星体育(SMGTV)直播流中转服务。服务把 kankanews 的直播流
通过 headless 浏览器中转,以标准 HLS 形式在局域网内播出,任何播放器
(VLC/IINA/电视/手机)打开一个 m3u8 地址即可观看。

relay 服务代码随 skill 一起分发(skill 内的 `relay/` 子目录),
安装 skill 后立即可用,无需额外配置。

## 何时使用

- 用户想**打开/启动**直播:"开五星体育""打开直播""start the live stream"
- 用户想**确认状态**:"直播还在跑吗""还在播吗""is it running"
- 用户想**停止**:"关掉直播""停掉服务""stop the relay"
- 用户想**换频道/端口**:指定频道 id 或端口

不要用于:非本机的远程控制、非直播相关的视频处理。

## 如何操作

**全部通过管理脚本,不要自己拼命令。** 脚本会自动定位 skill 内的 relay:

```bash
bash ~/.codex/skills/smg-live-relay/scripts/manage.sh start
```

| 意图 | 命令 |
| --- | --- |
| 启动(默认 8080 端口) | `... manage.sh start` |
| 指定端口启动 | `... manage.sh start 9000` |
| 查状态 | `... manage.sh status` |
| 停止 | `... manage.sh stop` |
| 重启 | `... manage.sh restart` |
| 看日志 | `... manage.sh log` |

脚本会自行处理:首次 npm install(装 puppeteer + Chromium)、清理残留进程、
轮询就绪、输出播放地址。

## 响应用户的要点

1. **启动后**,把脚本输出的播放地址原样告诉用户,例如:
   > 已启动。手机/电脑用 VLC 打开: http://192.168.x.x:8080/live.m3u8
2. **首次启动**要 1-2 分钟(npm install + 下载 Chromium 约 150MB);之后约 5 秒。
3. **状态查询**时,脚本会同时探测 m3u8 是否真能访问,据实回报。
4. **启动失败**:把日志末尾几行附上,并提示用户 token 可能过期、可尝试 restart。
5. **已运行时再 start**,脚本会幂等返回当前地址,不会重复启动。

## 换频道

默认五星体育 (`kankanews.com/huikan?id=10`)。换频道用环境变量:
```bash
TARGET_URL='https://live.kankanews.com/huikan?id=8' \
  bash ~/.codex/skills/smg-live-relay/scripts/manage.sh restart
```
常见 id:10=五星体育,8=上视新闻(以 kankanews 实际页面为准)。

## 安装

### 一句话安装(推荐)

```bash
HTTPS_PROXY=http://<你的代理> ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo LIGHT1213/smg_live --path smg-live-relay
```

装完后**重启 Codex**,对它说"开五星体育直播"即可。首次启动会自动
用  走代理下载 npm 包(约 10s)和 Chromium(约 150MB,1-2 分钟),
之后启动约 5 秒。relay 服务代码随 skill 一起分发,无需额外 clone 仓库。

### 手动安装(已克隆本仓库时)

```bash
cp -R smg-live-relay/ ~/.codex/skills/smg-live-relay/
```

### 前置条件

- macOS(Apple Silicon 或 Intel)
- Node.js ≥ 18
- 不需要 ffmpeg
- **首次安装需要代理**(从 GitHub 拉 skill、npm 装 puppeteer + Chromium);
  之后运行不需要代理(kankanews 是国内 CDN,直连)。代理地址用环境变量
  `INSTALL_PROXY` 指定(默认 http://192.168.31.216:1081,按需修改或置空)

## 外网访问(可选,仅在用户明确要求时提供)

relay 默认只在局域网内可用。要在家庭网络之外观看,推荐用 Tailscale
(免费、无需公网 IP、无需路由器配置):在 Mac 和手机都装 Tailscale 并登录
同一账号,之后用 Mac 的 Tailscale IP 替换局域网 IP 即可。
配置细节让用户自行查阅 tailscale.com,本 skill 不负责安装。

## 不要做的事

- 不要修改 skill 内 relay/server.js(已验证可用)
- 不要在**运行时**(node server.js)设 HTTP_PROXY:国内 CDN 直连,加代理会 403。代理仅用于安装阶段,见 INSTALL_PROXY。
- 不要试图用 ffmpeg 直拉 CDN(TLS 指纹校验,必 403)
- 不要承诺自动重连或 7×24 稳定(直播 token 会过期,断了需手动 restart)
