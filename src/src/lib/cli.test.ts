import { describe, it, expect } from 'vitest';
import { runCommand } from './cli';

/**
 * 伪命令行命令表测试（实施计划任务 4 Step 1 逐字断言）
 * 注意：没有 wall 命令——设计稿 §12.2 已废弃，按未知命令处理。
 */
describe('runCommand 伪命令行', () => {
  it("'PRODUCTS ' → nav /products/（大小写不敏感、忽略首尾空白）", () => {
    expect(runCommand('PRODUCTS ')).toEqual({ kind: 'nav', to: '/products/' });
  });

  it("'pacs' → nav /products/pacs/", () => {
    expect(runCommand('pacs')).toEqual({ kind: 'nav', to: '/products/pacs/' });
  });

  it("'help' → print 且命令清单含 products", () => {
    const r = runCommand('help');
    expect(r.kind).toBe('print');
    if (r.kind === 'print') {
      expect(r.lines.join('\n')).toContain('products');
    }
  });

  it("'ls' → print 且命令清单含 products（与 help 等价）", () => {
    const r = runCommand('ls');
    expect(r.kind).toBe('print');
    if (r.kind === 'print') {
      expect(r.lines.join('\n')).toContain('products');
    }
  });

  it("'clear' → clear", () => {
    expect(runCommand('clear')).toEqual({ kind: 'clear' });
  });

  it("'wall'（已废弃命令）→ print 而非 nav", () => {
    const r = runCommand('wall');
    expect(r.kind).toBe('print');
    expect(r).not.toHaveProperty('to');
  });

  it("未知命令 'prodcts' → print 且建议行含 products（编辑距离 ≤2）", () => {
    const r = runCommand('prodcts');
    expect(r.kind).toBe('print');
    if (r.kind === 'print') {
      const text = r.lines.join('\n');
      expect(text).toContain('suggestions:');
      expect(text).toContain('products');
    }
  });

  // 命令表其余四条导航（简报 Interfaces 列出的完整命令表）
  it.each([
    ['agent', '/agent/'],
    ['services', '/services/'],
    ['about', '/about/'],
    ['contact', '/contact/'],
  ])("'%s' → nav %s", (input, to) => {
    expect(runCommand(input)).toEqual({ kind: 'nav', to });
  });

  it("未知命令与建议均大小写不敏感：'CONTACT' 之外的 'Contac' → 建议 contact", () => {
    const r = runCommand('Contac');
    expect(r.kind).toBe('print');
    if (r.kind === 'print') {
      expect(r.lines.join('\n')).toContain('contact');
    }
  });
});
