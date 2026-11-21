// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { typeLines } from './typewriter';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 建一个带回放行的容器 */
function buildContainer(rows: number): HTMLElement {
  const c = document.createElement('div');
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.setAttribute('data-line', '');
    c.appendChild(row);
  }
  document.body.appendChild(c);
  return c;
}

describe('typeLines', () => {
  it('逐行逐字打出全部行，完成后文本与目标一致', async () => {
    const c = buildContainer(2);
    const p = typeLines(c, ['ab', 'cd']);
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(c.children[0].textContent).toBe('ab');
    expect(c.children[1].textContent).toBe('cd');
  });

  it('打完的行加 qn-done、data-typing 已移除', async () => {
    const c = buildContainer(1);
    const p = typeLines(c, ['你好']);
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    const row = c.children[0];
    expect(row.classList.contains('qn-done')).toBe(true);
    expect(row.hasAttribute('data-typing')).toBe(false);
  });

  it('行内装饰 span 不被拍平（打字只写首个文本节点）', async () => {
    const c = document.createElement('div');
    const row = document.createElement('div');
    row.setAttribute('data-line', '');
    row.appendChild(document.createTextNode('A')); // 打字目标文本节点
    const tail = document.createElement('span');
    tail.textContent = '尾注';
    row.appendChild(tail);
    c.appendChild(row);
    document.body.appendChild(c);

    const p = typeLines(c, ['A']);
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(row.querySelector('span')?.textContent).toBe('尾注');
    expect(row.textContent).toBe('A尾注');
  });

  it('行元素不足时自动补建 data-line 行', async () => {
    const c = buildContainer(0);
    const p = typeLines(c, ['x', 'y']);
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    const rows = c.querySelectorAll('[data-line]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe('x');
    expect(rows[1].textContent).toBe('y');
  });

  it('reduced-motion 下不打字，立即静态显示完整文本', async () => {
    // jsdom 的 matchMedia 恒不匹配；临时桩成 reduce 生效，测完恢复避免泄漏
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    })) as unknown as typeof window.matchMedia;
    try {
      const c = buildContainer(1);
      const p = typeLines(c, ['静态直出']);
      await p; // 不推进 fake timers 即完成
      expect(c.children[0].textContent).toBe('静态直出');
      expect(c.children[0].classList.contains('qn-done')).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('空 lines 直接完成，不改 DOM', async () => {
    const c = buildContainer(1);
    await typeLines(c, []);
    expect(c.children).toHaveLength(1);
  });

  it('cps=0 被钳制为逐秒推进：推进 500ms 仅打出首字符，之后能打完', async () => {
    // 判别性断言：钳制生效 → cps 视同 1，每字 1000ms，500ms 时只有 'a'；
    // 若钳制被移除，fake timers 下 1000/0=Infinity 立即触发，500ms 时已是 'ab'，本用例变红。
    const c = buildContainer(1);
    const p = typeLines(c, ['ab'], { cps: 0 });
    await vi.advanceTimersByTimeAsync(500);
    expect(c.children[0].textContent).toBe('a');
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(c.children[0].textContent).toBe('ab');
  });

  it('cps=-5 被钳制为逐秒推进：推进 500ms 仅打出首字符，之后能打完', async () => {
    // 判别性断言：若钳制被移除，1000/-5=-200ms 负延时在 fake timers 下立即触发，
    // 500ms 时已是 'xy'，本用例变红；钳制生效则视同 1cps，500ms 时只有 'x'。
    const c = buildContainer(1);
    const p = typeLines(c, ['xy'], { cps: -5 });
    await vi.advanceTimersByTimeAsync(500);
    expect(c.children[0].textContent).toBe('x');
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(c.children[0].textContent).toBe('xy');
  });
});
