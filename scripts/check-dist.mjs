/**
 * 全量验收脚本：扫描构建产物 src/dist/，验收三项规则（任务 13）。
 *
 *   规则一  禁入词零命中 —— 旧站 Flutter 模板作者的遗留个人信息
 *           （whatsapp / COMSATS / twitter / github.com / baidu.com/a.pdf）
 *           不得出现在任何产物文本（HTML 页面 + robots.txt / llms.txt / sitemap）。
 *   规则二  每个页面服务端直出 <title> 与 canonical（GEO 硬要求，设计稿 §8）。
 *   规则三  必含文案抽查 —— 关键正文必须直出在 HTML 里，不依赖客户端 JS。
 *
 * 用法：仓库根目录执行 `node scripts/check-dist.mjs`（构建后运行）。
 * 退出码：0 = 全部通过；1 = 存在失败项或构建产物缺失。
 */
import { readdirSync, existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(repoRoot, 'src', 'dist')

/** 递归收集指定扩展名的文件（返回相对 dist 的 POSIX 风格路径，已排序） */
function collect(relDir, exts, out = []) {
  const absDir = path.join(distDir, relDir)
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const rel = path.posix.join(relDir, entry.name)
    if (entry.isDirectory()) collect(rel, exts, out)
    else if (exts.includes(path.extname(entry.name).toLowerCase())) out.push(rel)
  }
  return out.sort()
}

/** 禁入词清单：与 src/src/lib/guard.test.ts 保持同一份口径 */
const 禁入词 = [
  [/whatsapp/i, 'whatsapp（模板作者境外联系方式）'],
  [/comsats/i, 'COMSATS（模板作者个人简历）'],
  [/twitter/i, 'twitter（模板作者个人社交链接）'],
  [/github\.com/i, 'github.com（模板作者个人 GitHub，开源只用 Gitee 表述）'],
  [/baidu\.com\/a\.pdf/i, 'baidu.com/a.pdf（假 PDF 链接）'],
]

/** 六个产品页 slug（FAQPage 结构化数据每页必含） */
const 产品页 = ['smart-community', 'pacs', 'yzzy', 'pxpt', 'mnp', 'ydzf']

// 必含文案抽查：[文件, 必含字符串, 规则说明]
const 文案抽查 = [
  ['index.html', 'uptime 10年', '首页终端状态行'],
  ['index.html', 'watch -n3 tail -3', '首页 tmux 状态栏'],
  ['wall/index.html', 'wall --write', '留言墙页命令'],
  ['contact/index.html', '河北地质大学综合楼', '联系页地址'],
  ['404.html', 'command not found', '404 页文案'],
  ...产品页.map(
    (slug) => [`products/${slug}/index.html`, 'FAQPage', `产品页 FAQPage 结构化数据（${slug}）`],
  ),
]

const failures = []

function fail(file, message) {
  failures.push({ file, message })
}

// ---- 启动检查 ----
if (!existsSync(distDir)) {
  console.error('未找到构建产物 src/dist/ —— 请先执行：cd src && npm run build')
  process.exit(1)
}

const htmlFiles = collect('.', ['.html'])
const textFiles = collect('.', ['.txt', '.xml'])
if (htmlFiles.length === 0) {
  console.error('src/dist/ 中没有任何 HTML 页面 —— 构建产物异常，请重新执行 npm run build')
  process.exit(1)
}

console.log(`== 青柠官网构建产物验收 ==`)
console.log(`扫描范围：src/dist（HTML 页面 ${htmlFiles.length} 个，文本产物 ${textFiles.length} 个）`)

const contents = new Map()
for (const rel of [...htmlFiles, ...textFiles]) {
  contents.set(rel, readFileSync(path.join(distDir, rel), 'utf-8'))
}

// ---- 规则一：禁入词零命中 ----
let 禁入词命中 = 0
for (const [rel, text] of contents) {
  for (const [re, 说明] of 禁入词) {
    if (re.test(text)) {
      禁入词命中 += 1
      fail(rel, `禁入词命中：${说明}`)
    }
  }
}
console.log(
  禁入词命中 === 0
    ? `[通过] 规则一 禁入词零命中（${contents.size} 个产物文件）`
    : `[失败] 规则一 禁入词命中 ${禁入词命中} 处`,
)

// ---- 规则二：每页 <title> 与 canonical ----
let 页面元数据失败 = 0
for (const rel of htmlFiles) {
  const text = contents.get(rel)
  const title数 = (text.match(/<title>/g) ?? []).length
  if (title数 !== 1) {
    页面元数据失败 += 1
    fail(rel, `应有且仅有 1 个 <title>，实际 ${title数} 个`)
  }
  if (!/rel="canonical"/.test(text)) {
    页面元数据失败 += 1
    fail(rel, '缺少 canonical 链接（GEO 要求每页服务端直出）')
  }
}
console.log(
  页面元数据失败 === 0
    ? `[通过] 规则二 每页 <title> 与 canonical（${htmlFiles.length}/${htmlFiles.length}）`
    : `[失败] 规则二 页面元数据缺失 ${页面元数据失败} 处`,
)

// ---- 规则三：必含文案抽查 ----
let 文案失败 = 0
for (const [rel, needle, 说明] of 文案抽查) {
  const text = contents.get(rel)
  if (text === undefined) {
    文案失败 += 1
    fail(rel, `文件不存在（${说明}）—— 构建产物缺失`)
  } else if (!text.includes(needle)) {
    文案失败 += 1
    fail(rel, `缺少必含文案「${needle}」（${说明}）`)
  }
}
console.log(
  文案失败 === 0
    ? `[通过] 规则三 必含文案抽查（${文案抽查.length}/${文案抽查.length} 项）`
    : `[失败] 规则三 必含文案缺 ${文案失败} 项`,
)

// ---- 汇总 ----
if (failures.length > 0) {
  console.error(`\n结论：${failures.length} 项失败，验收不通过。`)
  for (const { file, message } of failures) {
    console.error(`  ✗ src/dist/${file} —— ${message}`)
  }
  process.exit(1)
}

console.log(`\n结论：全部通过（页面 ${htmlFiles.length} 个、文案抽查 ${文案抽查.length} 项、禁入词 0 命中）。`)
