# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

石家庄青柠软件技术有限公司官网重建。

- `web1/` 是旧站（Flutter 编译产物，源码已丢失），**仅作内容与图片素材来源，不要修改**。文案来源：`web1/assets/assets/data.json`；产品 banner、图标、二维码、软著证书图在 `web1/assets/` 下。
- 新官网在 `src/`，技术栈 Astro（纯静态直出，零框架 JS），构建产物部署到公司现有 Nginx（www.qingningsoft.cn）。
- 设计文档、任务进度在 `doc/`——开工前先读 `doc/任务进度.md` 和 `doc/2026-11-20-青柠软件官网-设计稿.md`。

## 硬性要求

- 全部回复与文档使用中文。
- GEO 是核心需求：所有正文必须服务端直出 HTML，禁止依赖客户端 JS 渲染内容；结构化数据、llms.txt 等遵循设计稿 §8。
- `data.json` 中混有 Flutter 模板作者的遗留个人信息（境外 whatsapp、个人 GitHub/Twitter、COMSATS 个人简历、假 PDF 链接），**禁止带入新站**。
- 图片一律迁移本地化（`src/assets/`），不热链旧域名 www.qingningsoft.cn 之外的旧资源路径。
- 内容数字走定性描述（用户已拍板），只保留硬事实（2016 成立、软著 10 项、6 套方案、2800+ 院校库）。

## 构建与内容维护

命令一律在 `src/` 内执行：

- `npm test` —— vitest 全部单测（含遗留信息守卫、cps 回归等）
- `npm run dev` / `npm run build` —— 开发 / 构建产物 `src/dist/`（`npm run preview` 本地预览产物）
- `node scripts/check-dist.mjs`（仓库根执行）—— 构建后全量验收：禁入词、每页 title/canonical、必含文案直出

内容与数据（纯静态：**改内容 → `npm run build` 重建 → 部署 `src/dist/`**）：

- 产品页：`src/src/content/products/*.md`（Astro 内容集合，frontmatter + man 结构正文，一产品一文件）
- 结构化数据：`src/data/` 下 `services.json`（8 项服务）、`wall-messages.json`（留言墙 12 条）、`certificates.json`（软著 10 项）
- 文档指引：设计稿 `doc/2026-11-20-青柠软件官网-设计稿.md`、实施计划 `doc/2026-11-21-官网重建-实施计划.md`、部署文档 `doc/部署-Nginx.md`、进度 `doc/任务进度.md`
