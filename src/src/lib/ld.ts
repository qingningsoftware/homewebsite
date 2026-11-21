/**
 * JSON-LD 结构化数据的安全序列化（设计稿 §8.2，全站统一）。
 *
 * 把序列化结果中的 `<` 转义为 \u003c，防止正文内容里出现的尖括号
 * 提前闭合 script（type="application/ld+json"）标签。
 * 五个注入结构化数据的页面（index / products/[slug] / services / about / contact）
 * 一律经此函数输出，禁止裸 JSON.stringify 注入。
 */
export function toLdJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
