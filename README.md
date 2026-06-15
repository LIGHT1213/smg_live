# 收看五星体育频道F1比赛直播<br>
观看五星体育频道直播而不受限制

# 安装
需要浏览器装有 [Tampermonkey](https://tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 插件, 点击下方表格中安装，即可安装脚本.

|正式版 (GitHub 源)                                                                           |
|---------------------------------------------------------------------------------------------|
| [安装](https://g.geeck.eu.org/https://raw.githubusercontent.com/Popukok/smg_live/refs/heads/main/smg_fivestar.user.js)  |

安完脚本后[点击打开看看新闻](https://live.kankanews.com/huikan?id=10)，点击对应的频道即可观看节目<br>
<br>
**例如收看五星体育频道F1比赛直播，可以跳过以下图片提示**

![这是图片](https://p.statickksmg.com/cont/2023/10/08/image_1696731269_qOxBpp34.jpg "")

# 兼容性
### [Tampermonkey](https://tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)
兼容, 但在较旧的浏览器中 Violentmonkey 可能无法运行此脚本.
支持**最新版** Chrome, Firefox, 不保证脚本能在 Safari 和 ["套壳类浏览器"](https://www.jianshu.com/p/67d790a8f221) 中完美运行.

# 移动端
支持在移动端收看，前提是移动端浏览器支持 **[Tampermonkey](https://tampermonkey.net/)** 插件，<br>并且支持运行 **[Tampermonkey](https://tampermonkey.net/)** 脚本

💎  **如何选择**

*   如果你希望**安装过程最接近电脑上的Chrome体验**，能直接从Chrome网上应用店安装各种扩展，**Kiwi Browser** ，**Chrome Browser** , **Edge Browser** 是很不错的选择。
*   如果你看重**国产浏览器且对Chrome和Edge扩展生态的兼容性**，**狐猴浏览器**值得考虑。
*   如果你**习惯使用Firefox桌面版**，或者看重**开源生态**，那么**Firefox for Android** 会很适合你。
*   **X浏览器**则以其**轻量级、无广告**的特点，并支持油猴脚本，吸引了部分用户。

# 局域网 HLS 转发 (relay)

除了浏览器插件,还可以把直播流推送到局域网,让任意设备(VLC/IINA/电视/手机)直接播放。

```
kankanews 网页
  └─ Puppeteer (headless Chrome, 注入解锁脚本)
     └─ 浏览器充当反向代理,中转 HLS 流
        └─ 本地 HTTP 服务 (0.0.0.0:8080)
           └─ 局域网内 VLC 打开 http://<本机IP>:8080/live.m3u8
```

> 火山引擎 CDN 做了 TLS 指纹校验,ffmpeg/curl 直拉全 403,所以用浏览器中转。

## 安装到 Codex (推荐)

在 Codex 里安装 `smg-live-relay` skill,之后说一句"开五星体育直播"即可启动:

```bash
HTTPS_PROXY=http://<代理> ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo LIGHT1213/smg_live --path smg-live-relay
```

安装后**重启 Codex**,说"开五星体育直播"即可。首次启动自动下载依赖和 Chromium(约 1-2 分钟)。

## 手动运行

```bash
cd relay && npm install && npm start
```

详细说明见 [USAGE.md](USAGE.md) 和 [relay/README.md](relay/README.md)。

# 文件结构

```
smg_live/
├── smg_fivestar.user.js   # 原始油猴脚本
├── relay/                 # 局域网 HLS 转发服务
│   ├── server.js
│   └── package.json
├── smg-live-relay/        # Codex skill (自包含 relay)
│   ├── SKILL.md
│   ├── scripts/manage.sh
│   └── relay/
├── AGENTS.md              # 贡献者指南
└── USAGE.md               # relay 使用说明
```
