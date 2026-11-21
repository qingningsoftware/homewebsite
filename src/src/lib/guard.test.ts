import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 遗留信息守卫：旧站 Flutter 模板作者的个人信息（境外 whatsapp、个人 GitHub/Twitter、
// COMSATS 个人简历、假 PDF 链接）绝不能随内容迁移进入新站的任何产物文件。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dataDir = path.join(root, 'data')
const productsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/products')

// 三个数据文件 + 全部产品 Markdown 原文，拼接后统一扫描
function 全部产物原文(): string {
  const json = ['services.json', 'wall-messages.json', 'certificates.json']
    .map((f) => readFileSync(path.join(dataDir, f), 'utf-8'))
    .join('\n')
  const md = readdirSync(productsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(path.join(productsDir, f), 'utf-8'))
    .join('\n')
  return json + '\n' + md
}

const 禁入词: Array<[RegExp, string]> = [
  [/whatsapp/i, 'whatsapp（模板作者境外联系方式）'],
  [/comsats/i, 'COMSATS（模板作者个人简历）'],
  [/twitter/i, 'twitter（模板作者个人社交链接）'],
  [/github\.com/i, 'github.com（模板作者个人 GitHub，开源只用 Gitee 表述）'],
  [/baidu\.com\/a\.pdf/i, 'baidu.com/a.pdf（假 PDF 链接）'],
]

describe('遗留信息守卫', () => {
  it('数据文件与产品文案中不出现任何禁入词', () => {
    const 全文 = 全部产物原文()
    for (const [re, 说明] of 禁入词) {
      expect(全文, `发现禁入词：${说明}`).not.toMatch(re)
    }
  })
})

describe('数据文件计数', () => {
  it('wall-messages.json 恰 12 条预置留言', () => {
    const list = JSON.parse(readFileSync(path.join(dataDir, 'wall-messages.json'), 'utf-8'))
    expect(list).toHaveLength(12)
  })

  it('services.json 恰 8 条服务', () => {
    const list = JSON.parse(readFileSync(path.join(dataDir, 'services.json'), 'utf-8'))
    expect(list).toHaveLength(8)
  })

  it('certificates.json 恰 10 条软著证书', () => {
    const list = JSON.parse(readFileSync(path.join(dataDir, 'certificates.json'), 'utf-8'))
    expect(list).toHaveLength(10)
  })
})
