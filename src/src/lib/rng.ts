/**
 * mulberry32 伪随机数生成器（实施计划任务 6）
 *
 * 标准 mulberry32 实现：32 位状态原地轮转，输出 [0,1) 均匀分布。
 * 选型理由（设计稿 §12.6「留给实施阶段」项）：实现短、统计质量足够散布布局用、
 * 同种子序列完全确定——构建时固定种子即保证同一产物所有人看到相同 HTML。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0; // 归一到 32 位无符号状态
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
