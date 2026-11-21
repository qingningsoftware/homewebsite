/**
 * 散布布局（实施计划任务 6；设计稿 §12.3）
 *
 * 算法：贪心槽位抖动——不做任何重排/碰撞求解（预置卡不重排）：
 * - 列数 = floor(canvasWidth / colWidth)（默认 1200/300 = 4 列）；
 * - 第 i 张卡固定落槽位 (col = i % 列数, row = floor(i / 列数))；
 * - x/y 在槽位中心附近用 rng 抖动：x ±14px、y ±12px（幅度取值依据：
 *   相邻同列卡垂直基距 170、同列卡身高上限约 150，竖向需 |Δy| ≥ 138；
 *   同行相邻卡水平基距 300、卡宽上限 276，横向需 |Δx| ≥ 264，
 *   抖幅取上值的剩余余量，保证深叠 ≤ overlapTol 永不发生、只允许边缘轻叠）；
 * - r = (rng*2-1) * maxAngle（±6°）；w = 基准宽 240px × (0.85~1.15)；
 * - z = i 递增（后卡压前卡）；画布总高 = ceil(count/列数) × unitRow。
 *
 * 同 (count, seed) 结果完全确定 → 构建期直出内联 style，无 CLS、SEO 稳定。
 * 单测见 scatter.test.ts。
 */
import { mulberry32 } from './rng';

export interface ScatterOpts {
  /** 画布宽度（px） */
  canvasWidth: number;
  /** 列宽（px），列数 = floor(canvasWidth / colWidth) */
  colWidth: number;
  /** 行高（px），画布总高 = 行数 × unitRow */
  unitRow: number;
  /** 最大倾角（度），r ∈ ±maxAngle */
  maxAngle: number;
  /** 重叠容差（px）：两轴重叠深度均 ≤ |overlapTol| 的轻叠允许，深叠不允许 */
  overlapTol: number;
}

export interface ScatterCard {
  /** 卡片中心 x（px，画布坐标系） */
  x: number;
  /** 卡片中心 y（px，画布坐标系） */
  y: number;
  /** 旋转角（度，±maxAngle） */
  r: number;
  /** 卡片宽度（px，基准宽 ±15%） */
  w: number;
  /** 层叠序号（随 i 递增） */
  z: number;
}

/** 默认散布参数（简报 Interfaces 钉死的值） */
export const DEFAULT_SCATTER_OPTS: ScatterOpts = {
  canvasWidth: 1200,
  colWidth: 300,
  unitRow: 170,
  maxAngle: 6,
  overlapTol: -12,
};

/** 卡片基准宽度（px）；实际宽 = 基准 × 0.85~1.15（尺寸差异明显的乱墙感） */
const BASE_CARD_WIDTH = 240;

/** 槽位内抖动幅度（px）：推导见文件头注释 */
const JITTER_X = 14;
const JITTER_Y = 12;

/** 计算画布总高：ceil(count/列数) × unitRow（页面用它设容器高度） */
export function scatterCanvasHeight(count: number, opts?: Partial<ScatterOpts>): number {
  const o = { ...DEFAULT_SCATTER_OPTS, ...opts };
  const cols = Math.max(1, Math.floor(o.canvasWidth / o.colWidth));
  return Math.ceil(count / cols) * o.unitRow;
}

/**
 * 生成 count 张卡的散布布局（确定性：同 count+seed 结果 deep-equal）。
 * 预置卡不重排——第 i 张卡永远落第 i 个槽位，只做槽内抖动。
 */
export function layoutCards(count: number, seed: number, opts?: Partial<ScatterOpts>): ScatterCard[] {
  const o = { ...DEFAULT_SCATTER_OPTS, ...opts };
  const cols = Math.max(1, Math.floor(o.canvasWidth / o.colWidth));
  const rng = mulberry32(seed);
  const cards: ScatterCard[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * o.colWidth + o.colWidth / 2;
    const cy = row * o.unitRow + o.unitRow / 2;
    cards.push({
      x: cx + (rng() * 2 - 1) * JITTER_X,
      y: cy + (rng() * 2 - 1) * JITTER_Y,
      r: (rng() * 2 - 1) * o.maxAngle,
      w: BASE_CARD_WIDTH * (0.85 + rng() * 0.3),
      z: i,
    });
  }
  return cards;
}
