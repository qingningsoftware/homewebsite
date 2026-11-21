import { describe, it, expect } from 'vitest';
import { toLdJson } from './ld';

/**
 * JSON-LD 安全序列化测试（终审修复波，任务 13）：
 * 五个页面共用本函数注入结构化数据，核心契约是输出文本中不出现裸 `<`——
 * 防止正文尖括号提前闭合 script 标签。
 */
describe('toLdJson 安全序列化', () => {
  it('正文中的 < 被转义为 u003c，输出不含裸尖括号', () => {
    const out = toLdJson({ text: 'a<b与<script>' });
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c');
  });

  it('普通对象序列化与 JSON.stringify 一致（无 < 时逐字节相同）', () => {
    const value = { '@type': 'Organization', name: '青柠软件', year: 2016 };
    expect(toLdJson(value)).toBe(JSON.stringify(value));
  });
});
