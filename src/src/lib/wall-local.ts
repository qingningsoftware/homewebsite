/**
 * 本机留言存储（实施计划任务 6；设计稿 §12.4）
 *
 * localStorage key `qn-wall-messages`，结构 WallStore v1。
 * 铁律：任何环境下（SSR 无 localStorage / JSON 损坏 / 结构不符 / 配额异常）
 * 都不抛异常——读失败一律降级空库，写失败一律降级拒绝（reason 'limit'）。
 * 上限：本机留言 + 回复合计 30 条；单条 trim 后非空、>200 字截断至 200。
 * 本机 id 用 crypto.randomUUID()，jsdom 等无 crypto 环境降级 Date.now+计数器。
 * 单测见 wall-local.test.ts。
 */

export interface WallEntry {
  id: string;
  text: string;
  createdAt: number;
}

export interface WallStore {
  v: 1;
  messages: WallEntry[];
  replies: Record<string, WallEntry[]>;
}

export type AddResult = { ok: true; msg: WallEntry } | { ok: false; reason: 'empty' | 'limit' };

/** localStorage 键名 */
export const WALL_STORAGE_KEY = 'qn-wall-messages';

/** 本机留言 + 回复合计上限 */
const MAX_ENTRIES = 30;

/** 单条正文字数上限（超长截断至该值后照常提交） */
const MAX_TEXT_LEN = 200;

/** 无 localStorage 环境共享的空库（不缓存真实库——真实库每次读写即取） */
function emptyStore(): WallStore {
  return { v: 1, messages: [], replies: {} };
}

/** 降级计数器：无 crypto.randomUUID 时保证同毫秒内 id 不重复 */
let idCounter = 0;

/** 生成本机 id：优先 crypto.randomUUID()，jsdom 等不可用时降级 Date.now+计数器 */
function makeId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  idCounter += 1;
  return `local-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** 当前环境是否可用 localStorage（SSR / 被删 stub 时为 false） */
function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/** 结构校验：不像 v1 库就当损坏处理 */
function isWallStore(value: unknown): value is WallStore {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<WallStore>;
  if (v.v !== 1) return false;
  if (!Array.isArray(v.messages)) return false;
  if (typeof v.replies !== 'object' || v.replies === null) return false;
  // 逐条粗验（防止 messages 里混入非留言对象）
  return v.messages.every(
    (m) =>
      typeof m === 'object' &&
      m !== null &&
      typeof (m as WallEntry).id === 'string' &&
      typeof (m as WallEntry).text === 'string' &&
      typeof (m as WallEntry).createdAt === 'number',
  );
}

/** 读库：任何异常路径都返回空库，绝不抛异常 */
export function loadStore(): WallStore {
  if (!storageAvailable()) return emptyStore();
  try {
    const raw = window.localStorage.getItem(WALL_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (!isWallStore(parsed)) return emptyStore();
    // replies 值数组同样粗验一遍，防手改坏档
    for (const key of Object.keys(parsed.replies)) {
      if (!Array.isArray(parsed.replies[key])) return emptyStore();
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

/** 写库：写失败静默吞掉（不抛异常；下一次读会拿到旧值或空库） */
function saveStore(store: WallStore): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(WALL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* 配额满 / 隐私模式等：静默降级 */
  }
}

/** 本机条目总数（留言 + 回复） */
function totalEntries(store: WallStore): number {
  let n = store.messages.length;
  for (const key of Object.keys(store.replies)) {
    n += store.replies[key].length;
  }
  return n;
}

/** 归一正文：trim；空 → undefined；超长截断至 200 */
function normalizeText(text: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return t.length > MAX_TEXT_LEN ? t.slice(0, MAX_TEXT_LEN) : t;
}

/** 提交本机留言。满 30 条 / 无 localStorage → limit；trim 空 → empty */
export function addMessage(text: string): AddResult {
  const t = normalizeText(text);
  if (t === undefined) return { ok: false, reason: 'empty' };
  if (!storageAvailable() || totalEntries(loadStore()) >= MAX_ENTRIES) {
    return { ok: false, reason: 'limit' };
  }
  const store = loadStore();
  const msg: WallEntry = { id: makeId(), text: t, createdAt: Date.now() };
  store.messages.push(msg);
  saveStore(store);
  return { ok: true, msg };
}

/** 对某卡追加本机回复（约束同 addMessage；reply 归入对应卡） */
export function addReply(cardId: string, text: string): AddResult {
  const t = normalizeText(text);
  if (t === undefined) return { ok: false, reason: 'empty' };
  if (!storageAvailable() || totalEntries(loadStore()) >= MAX_ENTRIES) {
    return { ok: false, reason: 'limit' };
  }
  const store = loadStore();
  const msg: WallEntry = { id: makeId(), text: t, createdAt: Date.now() };
  if (!Array.isArray(store.replies[cardId])) store.replies[cardId] = [];
  store.replies[cardId].push(msg);
  saveStore(store);
  return { ok: true, msg };
}

/** 删除指定本机留言（id 不存在时静默无操作）；该卡名下的本机回复一并清理，
 *  避免孤儿回复残留继续占用 30 条额度 */
export function removeMessage(id: string): void {
  if (!storageAvailable()) return;
  const store = loadStore();
  const next = store.messages.filter((m) => m.id !== id);
  if (next.length === store.messages.length) return;
  store.messages = next;
  if (Array.isArray(store.replies[id])) delete store.replies[id];
  saveStore(store);
}

/** 删除指定卡下的指定本机回复 */
export function removeReply(cardId: string, id: string): void {
  if (!storageAvailable()) return;
  const store = loadStore();
  const list = store.replies[cardId];
  if (!Array.isArray(list)) return;
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return;
  if (next.length === 0) delete store.replies[cardId];
  else store.replies[cardId] = next;
  saveStore(store);
}

/** 清空全部本机留言数据 */
export function clearLocal(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(WALL_STORAGE_KEY);
  } catch {
    /* 静默降级 */
  }
}
