# 部署文档（Nginx · www.qingningsoft.cn）

新官网为 Astro 纯静态站，**没有运行时后端**：Nginx 只需托管构建产物 `dist/` 目录即可。
本文写给公司侧执行部署的同事，覆盖两种交付路径、Nginx 配置片段、裸域 301、百度统计与上线切换步骤。

## 1. 交付物与两种部署路径

交付物二选一（内容完全一致）：

| 路径 | 拿到什么 | 怎么做 |
|---|---|---|
| **A · 构建产物** | `dist/` 目录（整包） | 直接上传服务器，无需 Node 环境 |
| **B · 源码自行构建** | 源码仓库 | 在 `src/` 内执行构建，得到同样的 `dist/` |

路径 B 构建步骤（需要 Node ≥ 22）：

```bash
cd src
npm ci          # 按 package-lock.json 精确安装依赖
npm run build   # 产物输出到 src/dist/
```

`dist/` 内容清单：13 个页面目录 + `404.html`（对应全站 14 页）、`_astro/`（带内容 hash 的 CSS/JS/图片）、
`favicon.ico`、`favicon.svg`、`robots.txt`、`llms.txt`、`sitemap-index.xml`、`sitemap-0.xml`。

## 2. 服务器目录安排（不直接覆盖旧站）

上线流程为「本地构建 → 预览确认 → 交付部署」，切换前旧站保留原样以便回滚：

```bash
# 新站放独立目录，例如（Windows/Nginx 同理，改盘符路径即可）
sudo mkdir -p /var/www/qingningsoft
# 把 dist/ 内容上传到 /var/www/qingningsoft/dist（rsync 或 scp 均可）
rsync -av --delete dist/ user@server:/var/www/qingningsoft/dist/
```

旧站目录（如 `/var/www/www.qingningsoft.cn`）不要删除；回滚时把 Nginx `root` 改回旧目录并 reload 即可。

## 3. Nginx 配置片段

要点：root 指向 `dist/`、`error_page 404`、gzip、静态资源长缓存 + HTML 短缓存、HTTP→HTTPS 跳转、裸域 301。

```nginx
# ---------- HTTP 全部跳 HTTPS ----------
server {
    listen 80;
    server_name qingningsoft.cn www.qingningsoft.cn;
    return 301 https://www.qingningsoft.cn$request_uri;
}

# ---------- 裸域 HTTPS 301 → www ----------
# （TLS 握手发生在跳转之前，本块也需要证书）
server {
    listen 443 ssl;
    server_name qingningsoft.cn;

    ssl_certificate     /etc/nginx/qingningsoft.cn.pem;
    ssl_certificate_key /etc/nginx/qingningsoft.cn.key;

    return 301 https://www.qingningsoft.cn$request_uri;
}

# ---------- www 主站 ----------
server {
    listen 443 ssl;
    server_name www.qingningsoft.cn;

    ssl_certificate     /etc/nginx/qingningsoft.cn.pem;
    ssl_certificate_key /etc/nginx/qingningsoft.cn.key;

    root  /var/www/qingningsoft/dist;
    index index.html;
    charset utf-8;

    # 404：Astro 已构建 dist/404.html
    error_page 404 /404.html;

    # gzip（text/html 默认始终压缩，无需列出）
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_types text/css application/javascript image/svg+xml image/webp
               application/json application/xml text/plain;

    # _astro/ 下文件名带内容 hash，内容一变文件名就变 → 可放心长缓存
    location /_astro/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 根目录未带 hash 的固定文件（favicon、robots、llms.txt、sitemap）→ 短缓存
    location ~ ^/(favicon\.(ico|svg)|robots\.txt|llms\.txt|sitemap-.*\.xml)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # HTML 页面：no-cache（协商缓存），每次发布立即生效
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ =404;
    }
}
```

配置检查与生效：

```bash
sudo nginx -t          # 语法检查
sudo nginx -s reload   # 平滑生效
```

## 4. 证书提示（重要）

仓库 `Nginx_PEM/` 内现有 `qingningsoft.cn.pem` / `qingningsoft.cn.key`：
SAN 覆盖 `*.qingningsoft.cn` 与 `qingningsoft.cn`（裸域与 www 可共用一张证书），
但**有效期至 2025-08-07，已过期**——上线前必须续签并替换服务器上的证书文件，否则浏览器直接报证书错误。

## 5. 裸域解析与 301

目标：访问 `qingningsoft.cn` 一律 301 到 `https://www.qingningsoft.cn`（canonical 基准域名，避免搜索引擎收录两份）。

1. **DNS 服务商处**（域名在哪买的就在哪操作）为裸域 `qingningsoft.cn` 添加解析：
   - A 记录指向与 `www` 相同的服务器 IP（多数服务商裸域不支持 CNAME；若支持 ALIAS/ANAME 也可 CNAME 到 `www.qingningsoft.cn`）；
   - 记录类型选「显性 URL 转发」的服务商也可以直接转发到 `https://www.qingningsoft.cn`，但推荐解析 + Nginx 301（上文配置片段已含）。
2. 解析生效后用 `curl -sI https://qingningsoft.cn/` 验证 `location: https://www.qingningsoft.cn/`。

## 6. 百度统计 ID 填写位置

文件：`src/src/layouts/Base.astro`，常量：

```js
export const BAIDU_TONGJI_ID = '';   // ← 填入百度统计站点 ID，如 'a1b2c3d4e5f6...'
```

- 填入后**必须重新构建**（路径 B：本地 `npm run build`；路径 A：把 ID 发给交付方重新构建并重新交付 `dist/`）。
- ID 为空时页面不会输出统计脚本，不会产生无效请求；全站唯一第三方脚本即此处。

## 7. 上线切换步骤（清单）

1. 续签并部署证书（见 §4）。
2. 上传新 `dist/` 到 `/var/www/qingningsoft/dist`（见 §2），旧站目录原样保留。
3. 按上文片段调整 Nginx 配置，`nginx -t` 通过后 reload。
4. 浏览器抽查：首页、任一产品页、任一 404 链接、裸域跳转。

命令行验证：

```bash
curl -sI https://www.qingningsoft.cn/ | head -1                     # HTTP/2 200
curl -sI -H 'Accept-Encoding: gzip' https://www.qingningsoft.cn/ | grep -i content-encoding   # gzip
curl -s https://www.qingningsoft.cn/products/pacs/ | grep -o FAQPage                          # FAQPage 直出
curl -s -o /dev/null -w '%{http_code}\n' https://www.qingningsoft.cn/no-such-page             # 404
curl -sI http://www.qingningsoft.cn/ | grep -i location             # → https
curl -sI https://qingningsoft.cn/ | grep -i location                # → www
curl -s https://www.qingningsoft.cn/robots.txt | head -1            # robots 正常
```

如拿到源码仓库，还可在本地对构建产物跑全量验收：`node scripts/check-dist.mjs`（见仓库根 scripts/）。
