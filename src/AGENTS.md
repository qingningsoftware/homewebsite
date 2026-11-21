# AGENTS.md —— 青柠软件官网（Astro 纯静态站）

石家庄青柠软件技术有限公司官网。暗色终端科技风，全部正文服务端直出（GEO 硬要求），零框架 JS。
完整工作约定见仓库根 `CLAUDE.md`。

## 常用命令（在 `src/` 内执行）

- `npm test` —— vitest 全部单测
- `npm run build` —— 构建产物输出到 `src/dist/`
- `npm run dev` —— 开发服务器；长期驻留，请以后台方式启动，不要阻塞终端会话
- `npm run preview` —— 本地预览构建产物

构建后在仓库根执行 `node scripts/check-dist.mjs` 做全量验收（禁入词 / title 与 canonical / 必含文案直出）。

## 内容编辑

- 产品页：`src/src/content/products/*.md`（一产品一文件，frontmatter + man 结构正文）
- 结构化数据：`src/data/*.json`（services / wall-messages / certificates）
- 纯静态发布链路：改内容 → `npm run build` → 部署 `src/dist/`

## Astro 文档

https://docs.astro.build —— 相关任务先查对应指南：

- [路由（页面与动态路由）](https://docs.astro.build/en/guides/routing/)
- [组件](https://docs.astro.build/en/basics/astro-components/)
- [内容集合](https://docs.astro.build/en/guides/content-collections/)
- [样式](https://docs.astro.build/en/guides/styling/)
