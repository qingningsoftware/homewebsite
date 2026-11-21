import { describe, it, expect } from 'vitest';
import { layoutCards, scatterCanvasHeight } from './scatter';
import type { ScatterCard } from './scatter';

/**
 * 散布布局测试（实施计划任务 6 Step 2 逐字断言）：
 * 同 (count,seed) deep-equal；每卡 |r| ≤ 6；100 张任两卡轻叠 ≤ overlapTol
 * 允许、深叠不允许；画布总高随条数增长。
 */

/** 计算两卡矩形的重叠深度（正=重叠量，负=间隙；分别按 x/y 轴） */
function overlapDepth(a: ScatterCard, b: ScatterCard): { dx: number; dy: number } {
  const halfW = (c: ScatterCard) => c.w / 2;
  // 高度按行高近似（卡片高度 ≤ unitRow 内含余量），深叠判定只需 x/y 中心距
  const dx = Math.abs(a.x - b.x) - (halfW(a) + halfW(b));
  const dy = Math.abs(a.y - b.y) - 60; // 卡身高约 120px，半高 60px
  return { dx, dy };
}

describe('layoutCards 散布布局', () => {
  it('同 (count, seed) 两次调用结果 deep-equal（确定性）', () => {
    const a = layoutCards(12, 20261121);
    const b = layoutCards(12, 20261121);
    expect(a).toEqual(b);
  });

  it('不同 seed 布局不同', () => {
    const a = layoutCards(12, 20261121);
    const b = layoutCards(12, 42);
    expect(a).not.toEqual(b);
  });

  it('12 张卡每张 |r| ≤ 6（角度限制）', () => {
    for (const c of layoutCards(12, 20261121)) {
      expect(Math.abs(c.r)).toBeLessThanOrEqual(6);
    }
  });

  it('12 张卡 z 递增（后卡在上层）', () => {
    const cards = layoutCards(12, 20261121);
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].z).toBeGreaterThan(cards[i - 1].z);
    }
  });

  it('100 张卡任两卡矩形重叠边距 > overlapTol（轻叠 ≤12px 允许、深叠不允许）', () => {
    const cards = layoutCards(100, 20261121);
    const tol = -12;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const { dx, dy } = overlapDepth(cards[i], cards[j]);
        // 矩形相交要求两轴同时重叠（dx<0 且 dy<0）；
        // 「深叠」= 相交且两轴重叠深度均越过容差（≤ -12px）→ 违规；
        // 任一轴只是轻叠（> -12px）或不相交 → 允许
        if (dx < 0 && dy < 0 && dx <= tol && dy <= tol) {
          expect.fail(`卡 ${i} 与卡 ${j} 深叠：dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);
        }
      }
    }
  });

  it('画布总高随条数增长：layoutCards(100) 的 y 最大值 + 卡高 > layoutCards(12) 的', () => {
    const CARD_H = 150;
    const bottom12 = Math.max(...layoutCards(12, 20261121).map((c) => c.y)) + CARD_H;
    const bottom100 = Math.max(...layoutCards(100, 20261121).map((c) => c.y)) + CARD_H;
    expect(bottom100).toBeGreaterThan(bottom12);
  });

  it('scatterCanvasHeight(12) = ceil(12/4)*170，随 count 增长', () => {
    expect(scatterCanvasHeight(12)).toBe(3 * 170);
    expect(scatterCanvasHeight(100)).toBeGreaterThan(scatterCanvasHeight(12));
  });

  it('x/y 全部落在画布宽度内（含卡宽余量）', () => {
    const cards = layoutCards(12, 20261121);
    for (const c of cards) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(1200);
      expect(c.y).toBeGreaterThanOrEqual(0);
    }
  });
});
