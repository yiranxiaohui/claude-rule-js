# claude-rule-js

一个用于 [Sub-Store](https://github.com/sub-store-org/Sub-Store) 的 **Mihomo Profile** 处理脚本，针对 Claude / Anthropic 流量提供一个独立的「安全中转」分组，并配套统一规则集、地区分组、广告拦截、AI / 流媒体分流、DNS、嗅探等完整配置。

主入口：[substore-claude.js](substore-claude.js)

---

## 特性

- **Claude 安全中转分组**（`Claude-Safe-Relay`）：独立 select 组，默认 `REJECT`，由你手动指定一个干净出口；所有 `claude*` / `anthropic*` 域名以及一组 IP 检测站（ipify、ifconfig.me、scamalytics、ping0.cc 等）一并锁到该组，避免 IP 漂移导致风控。
- **WebRTC / QUIC / IPv6 防泄露**：默认阻断 `webrtc`、UDP/443（可选关闭）、`::/0`、STUN 端口（3478、19302）。
- **地区自动分组**：自动识别节点名中的地区关键字 + emoji，生成 `香港节点 / 日本节点 / …` 等组，可设置阈值过滤少量地区。
- **低倍率节点识别**：检测到 `0.x / 低倍率 / 省流 / 大流量 / 实验性` 名称时自动汇总到「低倍率节点」组。
- **落地节点（前置代理）模式**：识别 `家宽 / 商宽 / 星链 / 落地` 等关键字，可选启用前置链路。
- **完整规则集**：广告拦截、搜狗输入法、静态资源 / CDN、Crypto、TikTok、E-Hentai、Steam、GoogleFCM、Google / Microsoft / OneDrive / YouTube / Bilibili / Bahamut / Netflix / Spotify / Telegram / Truth Social / PikPak、China 直连等。
- **Fake-IP / Redir-Host 双 DNS 配置切换**，支持 IPv6 开关、QUIC 开关、KeepAlive 开关、`full` 完整配置导出。

---

## 在 Sub-Store 中通过远程脚本使用

> 适用场景：Sub-Store **文件 / 订阅** 的处理流 → **脚本操作**，类型选 **Mihomo Profile**。

### 1. 把脚本发布到一个可访问的 URL

**方式 A — GitHub + jsDelivr（推荐）**

```bash
git init
git add substore-claude.js README.md
git commit -m "init"
git remote add origin git@github.com:yiranxiaohui/claude-rule-js.git
git push -u origin main
```

公网链接（任选其一）：

```
https://cdn.jsdelivr.net/gh/yiranxiaohui/claude-rule-js@main/substore-claude.js
https://gcore.jsdelivr.net/gh/yiranxiaohui/claude-rule-js@main/substore-claude.js
https://raw.githubusercontent.com/yiranxiaohui/claude-rule-js/main/substore-claude.js
```

> 想避免 CDN 缓存延迟，把 `@main` 换成具体的 commit hash，例如 `@a1b2c3d`。

**方式 B — GitHub Gist**：上传后取 *Raw* 链接。

**方式 C — 自建 / Cloudflare Pages / Vercel**：直接把 `substore-claude.js` 作为静态资源发布。

### 2. 在 Sub-Store 中引用

1. **文件**（或订阅）→ 新建 / 编辑
2. 类型：**Mihomo Profile**
3. 数据源：你的机场订阅链接 / 本地 YAML
4. 处理流 → 添加 **脚本操作** → 类型 **Mihomo Profile**
5. 模式选 **链接**，填入第 1 步得到的 URL
6. 在 URL 后用 `#key=value&key=value` 传参（见下表）

### 3. 参数

通过 URL `#` 后的 query 传入，对应脚本中的 `$arguments`：

| 参数 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `loadbalance` | bool | `false` | 地区组使用 `load-balance` 而不是 `url-test` |
| `landing` | bool | `false` | 启用落地节点 / 前置代理链路 |
| `ipv6` | bool | `false` | DNS 启用 IPv6（注意：规则里仍会阻断 `::/0`） |
| `full` | bool | `false` | 输出完整 Mihomo 配置（端口、tun、external-controller 等） |
| `keepalive` | bool | `false` | 保持 TCP keep-alive（`disable-keep-alive` 取反） |
| `fakeip` | bool | `false` | DNS 使用 Fake-IP 模式（默认 redir-host） |
| `quic` | bool | `false` | 允许 QUIC（默认会阻断 UDP/443） |
| `threshold` | number | `0` | 地区分组的最小节点数阈值，少于该值的地区不生成独立组 |

**示例**：

```
https://cdn.jsdelivr.net/gh/yiranxiaohui/claude-rule-js@main/substore-claude.js#full=true&landing=false&keepalive=true&threshold=2
```

### 4. 使用后的关键操作

导入完成后到 Mihomo / Clash 客户端里：

1. 把 **`Claude-Safe-Relay`** 组手动选定一个长期稳定、干净的出口节点（这是该脚本的核心目的，默认是 `REJECT`，**不选会直接拦截 Claude 流量**）。
2. 视需要给 `选择代理 / AI / Google` 等组指定默认出口。

---

## 常见坑位

- **CDN 缓存**：jsDelivr 默认缓存最长 12h。要么用 commit hash，要么访问 `https://purge.jsdelivr.net/gh/yiranxiaohui/claude-rule-js@main/substore-claude.js` 主动刷新，要么改用 `raw.githubusercontent.com`。
- **私有仓库**：jsDelivr 仅服务公开仓库；私有仓库请用自建反代或 Cloudflare Pages。
- **脚本类型必须是 Mihomo Profile**，不能选「节点操作」——后者拿到的只是 `proxies` 数组，会跑不通。
- **订阅本身**也需要是 Mihomo / Clash.Meta 格式；早期 Clash Premium 不支持 `rule-providers` 中的 `mrs` 等字段。
- IPv6 请求即使在 `ipv6=true` 时仍然会被规则中的 `IP-CIDR6,::/0,REJECT` 兜底丢弃，这是 Claude 中转防泄露的有意设计；如确需放行 IPv6，删除该规则后再启用。

---

## 本地预览（可选）

```bash
node -e "
  const fs = require('fs');
  const yaml = require('js-yaml');
  globalThis.\$arguments = { full: 'true', landing: 'false' };
  const sample = yaml.load(fs.readFileSync('sample.yaml', 'utf8'));
  // 临时把 substore-claude.js 末尾加 'module.exports = { main };' 后再 require
  const { main } = require('./substore-claude.js');
  console.log(yaml.dump(main(sample)));
"
```

---

## 许可证

MIT
