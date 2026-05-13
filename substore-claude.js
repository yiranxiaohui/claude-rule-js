const NODE_SUFFIX = "节点";
const CLAUDE_RELAY_GROUP = "Claude-Safe-Relay";

function parseBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        return value.toLowerCase() === "true" || value === "1";
    }
    return false;
}

function parseNumber(value, defaultValue = 0) {
    if (value === null || typeof value === 'undefined') return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
}

function buildFeatureFlags(args) {
    const spec = {
        loadbalance: "loadBalance",
        landing: "landing",
        ipv6: "ipv6Enabled",
        full: "fullConfig",
        keepalive: "keepAliveEnabled",
        quic: "quicEnabled"
    };
    const flags = Object.entries(spec).reduce((acc, [k, v]) => {
        acc[v] = parseBool(args[k]) || false;
        return acc;
    }, {});
    flags.countryThreshold = parseNumber(args.threshold, 0);
    // tun 默认开启，通过 ?tun=false 关闭（与其他默认 false 的开关相反）
    flags.tunEnabled = typeof args.tun === 'undefined' ? true : parseBool(args.tun);
    return flags;
}

const rawArgs = typeof $arguments !== 'undefined' ? $arguments : {};
const {
    loadBalance, landing, ipv6Enabled, fullConfig,
    keepAliveEnabled, quicEnabled, tunEnabled, countryThreshold
} = buildFeatureFlags(rawArgs);

function getCountryGroupNames(info, min) {
    return info.filter(i => i.count >= min).map(i => i.country + NODE_SUFFIX);
}
function stripNodeSuffix(names) {
    const re = new RegExp(`${NODE_SUFFIX}$`);
    return names.map(n => n.replace(re, ""));
}

const PROXY_GROUPS = {
    SELECT: "选择代理",
    MANUAL: "手动选择",
    FALLBACK: "故障转移",
    DIRECT: "直连",
    LANDING: "落地节点",
    LOW_COST: "低倍率节点",
};

const buildList = (...e) => e.flat().filter(Boolean);

function buildBaseLists({ landing, lowCost, countryGroupNames }) {
    const defaultSelector = buildList(
        PROXY_GROUPS.FALLBACK,
        landing && PROXY_GROUPS.LANDING,
        countryGroupNames,
        lowCost && PROXY_GROUPS.LOW_COST,
        PROXY_GROUPS.MANUAL,
        "DIRECT"
    );
    const defaultProxies = buildList(
        PROXY_GROUPS.SELECT, countryGroupNames,
        lowCost && PROXY_GROUPS.LOW_COST,
        PROXY_GROUPS.MANUAL, PROXY_GROUPS.DIRECT
    );
    const defaultProxiesDirect = buildList(
        PROXY_GROUPS.DIRECT, countryGroupNames,
        lowCost && PROXY_GROUPS.LOW_COST,
        PROXY_GROUPS.SELECT, PROXY_GROUPS.MANUAL
    );
    const defaultFallback = buildList(
        landing && PROXY_GROUPS.LANDING,
        countryGroupNames,
        lowCost && PROXY_GROUPS.LOW_COST,
        PROXY_GROUPS.MANUAL, "DIRECT"
    );
    return { defaultProxies, defaultProxiesDirect, defaultSelector, defaultFallback };
}

const ruleProviders = {
    "ADBlock": {
        type: "http", behavior: "domain", format: "mrs", interval: 86400,
        url: "https://adrules.top/adrules-mihomo.mrs", path: "./ruleset/ADBlock.mrs"
    },
    "SogouInput": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://ruleset.skk.moe/Clash/non_ip/sogouinput.txt", path: "./ruleset/SogouInput.txt"
    },
    "StaticResources": {
        type: "http", behavior: "domain", format: "text", interval: 86400,
        url: "https://ruleset.skk.moe/Clash/domainset/cdn.txt", path: "./ruleset/StaticResources.txt"
    },
    "CDNResources": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://ruleset.skk.moe/Clash/non_ip/cdn.txt", path: "./ruleset/CDNResources.txt"
    },
    "TikTok": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/TikTok.list", path: "./ruleset/TikTok.list"
    },
    "EHentai": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/EHentai.list", path: "./ruleset/EHentai.list"
    },
    "SteamFix": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/SteamFix.list", path: "./ruleset/SteamFix.list"
    },
    "GoogleFCM": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/FirebaseCloudMessaging.list", path: "./ruleset/FirebaseCloudMessaging.list"
    },
    "AdditionalFilter": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalFilter.list", path: "./ruleset/AdditionalFilter.list"
    },
    "AdditionalCDNResources": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalCDNResources.list", path: "./ruleset/AdditionalCDNResources.list"
    },
    "Crypto": {
        type: "http", behavior: "classical", format: "text", interval: 86400,
        url: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/Crypto.list", path: "./ruleset/Crypto.list"
    },

    // ========== 新增 ==========
    "ClaudeRules": {
        type: "http", behavior: "classical", format: "yaml", interval: 86400,
        url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Claude/Claude.yaml",
        path: "./ruleset/Claude.yaml"
    },
    "ChinaSites": {
        type: "http", behavior: "classical", format: "yaml", interval: 86400,
        url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/China/China.yaml",
        path: "./ruleset/China.yaml"
    }
};

const baseRules = [
    `RULE-SET,ADBlock,广告拦截`,
    `RULE-SET,AdditionalFilter,广告拦截`,
    `RULE-SET,SogouInput,搜狗输入法`,
    `DOMAIN-SUFFIX,truthsocial.com,Truth Social`,
    `RULE-SET,StaticResources,静态资源`,
    `RULE-SET,CDNResources,静态资源`,
    `RULE-SET,AdditionalCDNResources,静态资源`,
    `RULE-SET,Crypto,Crypto`,
    `RULE-SET,EHentai,E-Hentai`,
    `RULE-SET,TikTok,TikTok`,
    `RULE-SET,SteamFix,${PROXY_GROUPS.DIRECT}`,
    `RULE-SET,GoogleFCM,${PROXY_GROUPS.DIRECT}`,
    `DOMAIN,services.googleapis.cn,${PROXY_GROUPS.SELECT}`,
    "GEOSITE,CATEGORY-AI-!CN,AI",
    `GEOSITE,GOOGLE-PLAY@CN,${PROXY_GROUPS.DIRECT}`,
    `GEOSITE,MICROSOFT@CN,${PROXY_GROUPS.DIRECT}`,
    "GEOSITE,ONEDRIVE,OneDrive",
    "GEOSITE,MICROSOFT,Microsoft",
    "GEOSITE,TELEGRAM,Telegram",
    "GEOSITE,YOUTUBE,YouTube",
    "GEOSITE,GOOGLE,Google",
    "GEOSITE,NETFLIX,Netflix",
    "GEOSITE,SPOTIFY,Spotify",
    "GEOSITE,BAHAMUT,Bahamut",
    "GEOSITE,BILIBILI,Bilibili",
    "GEOSITE,PIKPAK,PikPak",
    `GEOSITE,GFW,${PROXY_GROUPS.SELECT}`,
    `GEOSITE,CN,${PROXY_GROUPS.DIRECT}`,
    `GEOSITE,PRIVATE,${PROXY_GROUPS.DIRECT}`,
    "GEOIP,NETFLIX,Netflix,no-resolve",
    "GEOIP,TELEGRAM,Telegram,no-resolve",
    `GEOIP,CN,${PROXY_GROUPS.DIRECT},no-resolve`,
    `GEOIP,PRIVATE,${PROXY_GROUPS.DIRECT},no-resolve`,
    "DST-PORT,22,SSH(22端口)",
    `MATCH,${PROXY_GROUPS.SELECT}`
];

// ========== Claude 中转专用前置规则 ==========
function buildCustomFrontRules() {
    return [
        // 用户白名单
        "DOMAIN,msls.club,DIRECT",
        "DOMAIN-SUFFIX,msls.club,DIRECT",
        `DOMAIN,raw.githubusercontent.com,${PROXY_GROUPS.SELECT}`,

        // IPv6 全局阻断 + 局域网直连
        "IP-CIDR6,::/0,REJECT,no-resolve",
        "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
        "DOMAIN,localhost,DIRECT",

        // Agora / RTC 直连
        "DOMAIN-KEYWORD,agora,DIRECT",
        "DOMAIN-KEYWORD,sd-rtn,DIRECT",
        "DOMAIN-SUFFIX,agora.io,DIRECT",
        "DOMAIN-SUFFIX,edge.agora.io,DIRECT",
        "DOMAIN-KEYWORD,edge,DIRECT",
        "DOMAIN-KEYWORD,rawstar,DIRECT",
        "DOMAIN-SUFFIX,rawstar.cn,DIRECT",

        // [A] 核心伪装层(IP 检测站全部锁到 Claude 中转出口)
        `DOMAIN-SUFFIX,ipify.org,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,ident.me,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,ifconfig.me,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,icanhazip.com,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,scamalytics.com,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,ping0.cc,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,dnsleaktest.com,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,pixelscan.net,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,browserleaks.com,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,ip.gs,${CLAUDE_RELAY_GROUP}`,

        // [B] Claude 业务锁定
        `RULE-SET,ClaudeRules,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-KEYWORD,anthropic,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-KEYWORD,claude,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,claude.ai,${CLAUDE_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,accounts.google.com,${CLAUDE_RELAY_GROUP}`,

        // [C] 哨兵 / WebRTC 防泄露
        `DOMAIN-SUFFIX,sentry.io,${CLAUDE_RELAY_GROUP}`,
        "DOMAIN-KEYWORD,webrtc,REJECT",
        "DST-PORT,3478,REJECT",
        "DST-PORT,19302,REJECT",

        // [E] 高速需求(github 不走 Claude 中转)
        `DOMAIN-KEYWORD,github,${PROXY_GROUPS.SELECT}`,

        // 中国大陆站点直连
        `RULE-SET,ChinaSites,${PROXY_GROUPS.DIRECT}`,
    ];
}

function buildRules({ quicEnabled }) {
    const ruleList = [...buildCustomFrontRules(), ...baseRules];
    if (!quicEnabled) {
        ruleList.unshift("AND,((DST-PORT,443),(NETWORK,UDP)),REJECT");
    }
    return ruleList;
}

const snifferConfig = {
    "sniff": {
        "TLS": { "ports": [443, 8443] },
        "HTTP": { "ports": [80, 8080, 8880] },
        "QUIC": { "ports": [443, 8443] }
    },
    "override-destination": false,
    "enable": true,
    "force-dns-mapping": true,
    "skip-domain": ["Mijia Cloud", "dlg.io.mi.com", "+.push.apple.com"]
};

// fake-ip 防泄露 DNS:
//  - 国外域名 → fake-ip → 不本地解析 → 由代理端解析（无泄露）
//  - 命中 fake-ip-filter 的域名（CN、私有、连通性检测等）→ 走 nameserver(DoH) 真解析
//  - bootstrap 同时含 TLS DNS 和国内明文，前者优先；前者不通时回落明文，避免 DNS 全断
const dnsConfig = {
    "enable": true,
    "ipv6": ipv6Enabled,
    "prefer-h3": false,
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter": [
        "geosite:private",
        "localhost",
        "*.local",
        "geosite:cn",
        "*.cn",
        "geosite:connectivity-check",
        "+.push.apple.com",
        "*.stun.*.*",
        "*.stun.*.*.*",
        "Mijia Cloud",
        "*.mijia.com",
        "localhost.ptlogin2.qq.com"
    ],
    "default-nameserver": ["tls://1.1.1.1", "tls://8.8.8.8", "223.5.5.5", "119.29.29.29"],
    "nameserver": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
    ],
    "fallback": [
        "https://dns.cloudflare.com/dns-query",
        "https://dns.sb/dns-query"
    ],
    "fallback-filter": {
        "geoip": true,
        "geoip-code": "CN",
        "ipcidr": ["240.0.0.0/4"]
    },
    "proxy-server-nameserver": ["https://dns.alidns.com/dns-query", "tls://dot.pub"]
};

const geoxURL = {
    "geoip": "https://gcore.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
    "geosite": "https://gcore.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
    "mmdb": "https://gcore.jsdelivr.net/gh/Loyalsoldier/geoip@release/Country.mmdb",
    "asn": "https://gcore.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-ASN.mmdb"
};

const countriesMeta = {
    "香港": { pattern: "香港|港|HK|hk|Hong Kong|HongKong|hongkong|🇭🇰", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png" },
    "澳门": { pattern: "澳门|MO|Macau|🇲🇴", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Macao.png" },
    "台湾": { pattern: "台|新北|彰化|TW|Taiwan|🇹🇼", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png" },
    "新加坡": { pattern: "新加坡|坡|狮城|SG|Singapore|🇸🇬", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png" },
    "日本": { pattern: "日本|川日|东京|大阪|泉日|埼玉|沪日|深日|JP|Japan|🇯🇵", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png" },
    "韩国": { pattern: "KR|Korea|KOR|首尔|韩|韓|🇰🇷", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Korea.png" },
    "美国": { pattern: "美国|美|US|United States|🇺🇸", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png" },
    "加拿大": { pattern: "加拿大|Canada|CA|🇨🇦", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Canada.png" },
    "英国": { pattern: "英国|United Kingdom|UK|伦敦|London|🇬🇧", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_Kingdom.png" },
    "澳大利亚": { pattern: "澳洲|澳大利亚|AU|Australia|🇦🇺", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Australia.png" },
    "德国": { pattern: "德国|德|DE|Germany|🇩🇪", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Germany.png" },
    "法国": { pattern: "法国|法|FR|France|🇫🇷", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/France.png" },
    "俄罗斯": { pattern: "俄罗斯|俄|RU|Russia|🇷🇺", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Russia.png" },
    "泰国": { pattern: "泰国|泰|TH|Thailand|🇹🇭", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Thailand.png" },
    "印度": { pattern: "印度|IN|India|🇮🇳", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/India.png" },
    "马来西亚": { pattern: "马来西亚|马来|MY|Malaysia|🇲🇾", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Malaysia.png" },
};

function hasLowCost(config) {
    const re = /0\.[0-5]|低倍率|省流|大流量|实验性/i;
    return (config.proxies || []).some(p => re.test(p.name));
}

function parseCountries(config) {
    const proxies = config.proxies || [];
    const isp = /家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地/i;
    const counts = Object.create(null);
    const compiled = {};
    for (const [c, m] of Object.entries(countriesMeta)) {
        compiled[c] = new RegExp(m.pattern.replace(/^\(\?i\)/, ''));
    }
    for (const p of proxies) {
        const name = p.name || '';
        if (isp.test(name)) continue;
        // 自定义代理不参与地区分组
        for (const [c, re] of Object.entries(compiled)) {
            if (re.test(name)) {
                counts[c] = (counts[c] || 0) + 1;
                break;
            }
        }
    }
    return Object.entries(counts).map(([country, count]) => ({ country, count }));
}

function buildCountryProxyGroups({ countries, landing, loadBalance }) {
    const groups = [];
    const baseExclude = "0\\.[0-5]|低倍率|省流|大流量|实验性";
    const landingExclude = "(?i)家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地";
    const type = loadBalance ? "load-balance" : "url-test";
    for (const country of countries) {
        const meta = countriesMeta[country];
        if (!meta) continue;
        const g = {
            "name": `${country}${NODE_SUFFIX}`,
            "icon": meta.icon,
            "include-all": true,
            "filter": meta.pattern,
            "exclude-filter": landing ? `${landingExclude}|${baseExclude}` : baseExclude,
            "type": type
        };
        if (!loadBalance) Object.assign(g, {
            "url": "https://cp.cloudflare.com/generate_204",
            "interval": 60, "tolerance": 20, "lazy": false
        });
        groups.push(g);
    }
    return groups;
}

function buildProxyGroups({
    landing, countries, countryProxyGroups, lowCost,
    defaultProxies, defaultProxiesDirect, defaultSelector, defaultFallback
}) {
    const hasTW = countries.includes("台湾");
    const hasHK = countries.includes("香港");
    const hasUS = countries.includes("美国");
    const frontProxySelector = landing
        ? defaultSelector.filter(n => n !== PROXY_GROUPS.LANDING && n !== PROXY_GROUPS.FALLBACK)
        : [];

    return [
        // ========== Claude 安全中转组 ==========
        {
            "name": CLAUDE_RELAY_GROUP,
            "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/chatgpt.png",
            "type": "select",
            "include-all": true,
            "exclude-filter": "(?i)0\\.[0-5]|低倍率|省流|大流量|实验性",
            "proxies": ["REJECT"]
        },

        { "name": PROXY_GROUPS.SELECT, "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png", "type": "select", "proxies": defaultSelector },
        { "name": PROXY_GROUPS.MANUAL, "icon": "https://gcore.jsdelivr.net/gh/shindgewongxj/WHATSINStash@master/icon/select.png", "include-all": true, "type": "select" },
        landing ? {
            "name": "前置代理",
            "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Area.png",
            "type": "select", "include-all": true,
            "exclude-filter": "(?i)家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地",
            "proxies": frontProxySelector
        } : null,
        landing ? {
            "name": PROXY_GROUPS.LANDING,
            "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png",
            "type": "select", "include-all": true,
            "filter": "(?i)家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地"
        } : null,
        { "name": PROXY_GROUPS.FALLBACK, "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png", "type": "fallback", "url": "https://cp.cloudflare.com/generate_204", "proxies": defaultFallback, "interval": 180, "tolerance": 20, "lazy": false },
        { "name": "静态资源", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Cloudflare.png", "type": "select", "proxies": defaultProxies },
        { "name": "AI", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/chatgpt.png", "type": "select", "proxies": defaultProxies },
        { "name": "Crypto", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Cryptocurrency_3.png", "type": "select", "proxies": defaultProxies },
        { "name": "Google", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Google.png", "type": "select", "proxies": defaultProxies },
        { "name": "Microsoft", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Microsoft_Copilot.png", "type": "select", "proxies": defaultProxies },
        { "name": "YouTube", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png", "type": "select", "proxies": defaultProxies },
        { "name": "Bilibili", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/bilibili.png", "type": "select", "proxies": (hasTW && hasHK) ? [PROXY_GROUPS.DIRECT, "台湾节点", "香港节点"] : defaultProxiesDirect },
        { "name": "Bahamut", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bahamut.png", "type": "select", "proxies": hasTW ? ["台湾节点", PROXY_GROUPS.SELECT, PROXY_GROUPS.MANUAL, PROXY_GROUPS.DIRECT] : defaultProxies },
        { "name": "Netflix", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Netflix.png", "type": "select", "proxies": defaultProxies },
        { "name": "TikTok", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/TikTok.png", "type": "select", "proxies": defaultProxies },
        { "name": "Spotify", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Spotify.png", "type": "select", "proxies": defaultProxies },
        { "name": "E-Hentai", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Ehentai.png", "type": "select", "proxies": defaultProxies },
        { "name": "Telegram", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png", "type": "select", "proxies": defaultProxies },
        { "name": "Truth Social", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/TruthSocial.png", "type": "select", "proxies": hasUS ? ["美国节点", PROXY_GROUPS.SELECT, PROXY_GROUPS.MANUAL] : defaultProxies },
        { "name": "OneDrive", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Onedrive.png", "type": "select", "proxies": defaultProxies },
        { "name": "PikPak", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/PikPak.png", "type": "select", "proxies": defaultProxies },
        { "name": "SSH(22端口)", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Server.png", "type": "select", "proxies": defaultProxies },
        { "name": "搜狗输入法", "icon": "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Sougou.png", "type": "select", "proxies": [PROXY_GROUPS.DIRECT, "REJECT"] },
        { "name": PROXY_GROUPS.DIRECT, "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Direct.png", "type": "select", "proxies": ["DIRECT", PROXY_GROUPS.SELECT] },
        { "name": "广告拦截", "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png", "type": "select", "proxies": ["REJECT", "REJECT-DROP", PROXY_GROUPS.DIRECT] },
        lowCost ? {
            "name": PROXY_GROUPS.LOW_COST,
            "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Lab.png",
            "type": "url-test",
            "url": "https://cp.cloudflare.com/generate_204",
            "include-all": true,
            "filter": "(?i)0\.[0-5]|低倍率|省流|大流量|实验性"
        } : null,
        ...countryProxyGroups
    ].filter(Boolean);
}

function main(config) {
    const mergedProxies = [...(config.proxies || [])];
    const resultConfig = { proxies: mergedProxies };

    const countryInfo = parseCountries(resultConfig);
    const lowCost = hasLowCost(resultConfig);
    const countryGroupNames = getCountryGroupNames(countryInfo, countryThreshold);
    const countries = stripNodeSuffix(countryGroupNames);

    const { defaultProxies, defaultProxiesDirect, defaultSelector, defaultFallback }
        = buildBaseLists({ landing, lowCost, countryGroupNames });

    const countryProxyGroups = buildCountryProxyGroups({ countries, landing, loadBalance });

    const proxyGroups = buildProxyGroups({
        landing, countries, countryProxyGroups, lowCost,
        defaultProxies, defaultProxiesDirect, defaultSelector, defaultFallback
    });

    const globalProxies = proxyGroups.map(i => i.name);
    proxyGroups.push({
        "name": "GLOBAL",
        "icon": "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png",
        "include-all": true,
        "type": "select",
        "proxies": globalProxies
    });

    const finalRules = buildRules({ quicEnabled });

    if (fullConfig) Object.assign(resultConfig, {
        "mixed-port": 7890,
        "redir-port": 7892,
        "tproxy-port": 7893,
        "routing-mark": 7894,
        "allow-lan": true,
        "ipv6": ipv6Enabled,
        "mode": "rule",
        "unified-delay": true,
        "tcp-concurrent": true,
        "find-process-mode": "off",
        "log-level": "info",
        "geodata-loader": "standard",
        "external-controller": ":9999",
        "disable-keep-alive": !keepAliveEnabled,
        "profile": { "store-selected": true }
    });

    Object.assign(resultConfig, {
        "proxy-groups": proxyGroups,
        "rule-providers": ruleProviders,
        "rules": finalRules,
        "sniffer": snifferConfig,
        "dns": dnsConfig,
        // TUN 默认开启，可通过 ?tun=false 关闭以便排查冲突（公司 VPN/WSL/自建 DNS 等场景）。
        // 注：未启用 strict-route——它在部分 mihomo 封装上会误杀 mihomo 自身的
        // DoH/bootstrap 出站，导致 DNS 全断。先用基础 TUN 跑通，验证后再考虑加固。
        "tun": tunEnabled ? {
            "enable": true,
            "stack": "mixed",
            "dns-hijack": ["any:53"],
            "auto-route": true,
            "auto-detect-interface": true
        } : { "enable": false },
        "geodata-mode": true,
        "geox-url": geoxURL,
    });

    return resultConfig;
}