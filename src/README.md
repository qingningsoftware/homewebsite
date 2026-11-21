# 青柠软件官网

石家庄青柠软件技术有限公司官网（Astro 纯静态直出，零框架 JS）。设计文档见仓库根 `doc/`。

## 常用命令

| 命令               | 作用                                        |
| :----------------- | :------------------------------------------ |
| `npm install`      | 安装依赖                                    |
| `npm run dev`      | 启动本地开发服务器 `localhost:4321`         |
| `npm run build`    | 构建生产站点到 `./dist/`                    |
| `npm run preview`  | 本地预览构建产物                            |
| `npm test`         | 运行 vitest 测试                            |

## 目录结构

```text
/
├── public/          # 静态资源（favicon 等）
└── src/
    ├── components/  # TmuxBar（全站常驻导航栏）
    ├── layouts/     # Base（head 元数据直出 + 扫描线）
    ├── lib/         # 测试
    ├── pages/       # 路由页面
    └── styles/      # global.css 设计系统
```

## 硬性约定

- 所有正文服务端直出 HTML，禁止依赖客户端 JS 渲染（GEO 核心要求）。
- 颜色/字体统一走 `src/styles/global.css` 的 CSS 变量，不加载 webfont。
- canonical 基准域名：`https://www.qingningsoft.cn`（`astro.config.mjs` 的 `site`）。
