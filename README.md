# 青柠软件官网

石家庄青柠软件技术有限公司官方网站源码。线上地址：[www.qingningsoft.cn](https://www.qingningsoft.cn)。

一家专注智慧社区平台与医疗影像 PACS 的软件研发团队（2016 年成立，石家庄），官网本身也是我们技术品味的展示窗口。

## 为什么重建

旧官网是 Flutter Web 编译产物，源码已丢失、无法维护，更致命的是正文全部埋在编译后的 `main.dart.js` 里——搜索引擎和 AI 爬虫几乎抓不到任何内容，对一家靠官网获客的软件公司，等于在 AI 时代隐身。

新站从零重建，围绕三个核心诉求：

1. **GEO（生成式引擎优化）**：让搜索引擎和 AI（ChatGPT、Perplexity、Claude 等）能抓取、理解并引用站点内容；
2. **设计个性**：拒绝千篇一律的官网模板感，形成品牌记忆点；
3. **内容重构**：产品主打智慧社区平台与远程医疗 PACS，新增 AI Agent 开发板块。

## 技术方案

- **Astro 纯静态直出**：构建产物为完整静态 HTML，正文零框架 JS——AI 爬虫和旧搜索引擎都能直接读到全文；
- **内容即文件**：产品页用 Astro 内容集合（一个产品一个 Markdown），服务、留言墙、软著证书用 JSON 数据文件，改内容 = 改文件 → 重新构建；
- **零后端**：构建产物直接部署到现有 Nginx，无运行时服务；留言墙走纯本地存储（localStorage），不经过任何服务器。

## 设计风格：暗色终端科技风

深色底 + 青柠绿荧光（`#A3E635`）——「青柠」品牌名本身就是视觉签名。全站骨架是一场「终端会话 + 日志流」：

- **Boot 动画**：进站 0.8 秒逐行启动日志，可跳过，同会话不重播；
- **Hero 伪命令行**：`~ ❯ 谁是青柠软件` 逐字打出，下方是一条真的可输入的命令行（本地关键词匹配，试试 `help`）;
- **产品页 = man 手册**：`NAME` / `SYNOPSIS` / `DESCRIPTION` / `FEATURES` / `FAQ` 结构，其余产品以 `ps aux` 风格进程表呈现；
- **tmux 状态栏**：全站常驻底部导航，移动端转为底栏；
- **留言墙**：随机散布的终端卡片墙，匿名留言、仅存访客本机——对外叙事是「留言不经过任何服务器，连我们自己都看不到」；
- **404 = command not found**。

质感细节：面板即终端窗口（`● ● ●` 圆点 + 等宽标题）、极低透明度扫描线纹理、光标闪烁、`✓`/`!`/`✗` 状态符；等宽字体标题 + 系统黑体正文的混排是全站的基本节奏。所有动效走 CSS + IntersectionObserver，`prefers-reduced-motion` 下全部静态呈现。

## GEO：让 AI 读懂我们

- 全部正文**服务端直出 HTML**，禁止依赖客户端 JS 渲染（硬性约定）；
- JSON-LD 结构化数据：`Organization` / `WebSite` / `Product` / `FAQPage` / `Service`；
- `/llms.txt`：面向 AI 引擎的站点导读文件；
- `robots.txt` 显式允许 GPTBot、ClaudeBot、PerplexityBot 等主流 AI 爬虫；
- 语义化 HTML、每页唯一 `title` / `description` / `canonical`、`sitemap.xml`；
- 性能即 GEO：无框架 JS、图片懒加载 + 显式宽高、内联关键 CSS。

## 仓库结构

```text
├── doc/                      # 设计稿、实施计划、部署文档、任务进度
├── scripts/check-dist.mjs    # 构建产物全量验收（禁入词、title/canonical、直出文案）
├── web1/                     # 旧站存档（仅作内容与图片素材来源，不再维护）
└── src/                      # 站点源码（Astro 项目，命令在此执行）
    ├── public/               # llms.txt、robots.txt、favicon
    ├── data/                 # services.json / wall-messages.json / certificates.json
    └── src/
        ├── components/       # Boot、HeroCli、TermWindow、TmuxBar、留言墙组件
        ├── content/products/ # 产品页（一个产品一个 Markdown）
        ├── layouts/          # Base 布局（head 元数据直出）
        ├── pages/            # 路由页面
        └── styles/           # global.css 设计系统
```

## 本地开发

在 `src/` 内执行：

```bash
npm install        # 安装依赖
npm run dev        # 本地开发服务器 localhost:4321
npm run build      # 构建生产站点到 src/dist/
npm run preview    # 本地预览构建产物
npm test           # vitest 全部单测（含遗留信息守卫、文案回归）
```

构建后在仓库根执行 `node scripts/check-dist.mjs` 做全量验收（禁入词、每页 title/canonical、必含文案直出）。

## 内容维护

纯静态架构，更新流程固定：**改内容（Markdown / JSON）→ `npm run build` → 部署 `src/dist/` 到 Nginx**。部署配置见 `doc/部署-Nginx.md`。

## License

[MIT](LICENSE)
