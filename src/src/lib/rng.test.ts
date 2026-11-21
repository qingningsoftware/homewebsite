import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';

/**
 * mulberry32 伪随机数测试（实施计划任务 6 Step 1 逐字断言）：
 * 同种子两个实例产出完全相同序列；不同种子序列不同；值域 [0,1)。
 */
describe('mulberry32', () => {
  it('同种子两个实例产出完全相同的 20 个数（确定性）', () => {
    const a = mulberry32(20261121);
    const b = mulberry32(20261121);
    const sa = Array.from({ length: 20 }, () => a());
    const sb = Array.from({ length: 20 }, () => b());
    expect(sa).toEqual(sb);
  });

  it('不同种子产出不同序列', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const sa = Array.from({ length: 20 }, () => a());
    const sb = Array.from({ length: 20 }, () => b());
    expect(sa).not.toEqual(sb);
  });

  it('连续取 1000 个值全部落在 [0,1) 且随种子 0 可复现', () => {
    const r = mulberry32(0);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('种子 0 亦可用（不把 0 当无效种子）', () => {
    const a = mulberry32(0);
    const b = mulberry32(0);
    expect(a()).toEqual(b());
    expect(a()).toEqual(b());
  });
});
