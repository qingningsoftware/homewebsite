/**
 * 首页迷你留言墙渐进增强（实施计划任务 7；设计稿 §12.2）
 *
 * 职责（首屏 3 条迷你卡与「共 N 条信号」已服务端直出，这里只做动效与本机联动）：
 * 1. 标题伪命令逐字打出（复用 typewriter 的 typeLines，进视口触发一次）；
 * 2. 每 3s 轮播：下一条从顶部落进、最旧淡出下沉移除（池 = 预置 12 条 + 本机留言）；
 * 3. 计数修正：json.length + 本机留言数 + 本机回复数（§12.2「数字与本机状态联动」）；
 * 4. 氛围层：极淡扫光线（6s/轮）+ 3–4 粒光尘上浮（透明度 ≤0.07）。
 *
 * 纯函数 buildPool / countSignals 导出供 mini-wall.test.ts 断言。
 *
 * 安全铁律：动态 DOM 一律 createElement + textContent 搭建，禁止 innerHTML（防 XSS）。
 * 无 JS / prefers-reduced-motion：不打字、不轮播、不修正计数、无扫光/光尘——
 * SSR 直出的 3 条静态完整显示，计数保持「共 N 条信号」（N = json.length）。
 */
import { loadStore, type WallStore } from '../lib/wall-local';
import { relativeTime } from './wall';
import { typeLines } from './typewriter';
import wallMessages from '../../data/wall-messages.json';

/** 轮播间隔（毫秒）——对应伪命令 watch -n3 */
const ROTATE_MS = 3000;

/** 迷你卡角度摆幅（±deg，与 SSR 直出卡同规格） */
const TILT_DEG = 2.5;

/** 迷你墙一条信号的通用形状（预置与本机统一） */
export interface MiniWallItem {
  /** 正文（原样展示，迷你卡用 CSS clamp 截断视觉行数） */
  text: string;
  /** 时间显示文本：预置 [YYYY-MM-DD]，本机为真实相对时间（刚刚 / N 天前） */
  date: string;
  /** 伪文件名：broadcast.log / msg_m12.log / msg_local.log */
  fileName: string;
  /** 公司广播卡（黄色 [广播] 标签） */
  isBroadcast: boolean;
  /** 是否本机留言（与预置区分，供测试断言） */
  local: boolean;
}

/** buildPool 的预置入参形状（wall-messages.json 每条的结构子集） */
export interface PresetEntry {
  id: string;
  type: string;
  text: string;
  date: string;
}

/**
 * 合并轮播池（纯函数）：预置留言按 json 顺序在前，本机留言按提交先后追加在后。
 * SSR 直出的是池中 json 末尾 3 条，轮播从其后一条继续，把全部信号依次转一遍。
 */
export function buildPool(preset: ReadonlyArray<PresetEntry>, store: WallStore): MiniWallItem[] {
  const pool: MiniWallItem[] = preset.map((m) => ({
    text: m.text,
    date: `[${m.date}]`,
    fileName: m.type === 'broadcast' ? 'broadcast.log' : `msg_${m.id}.log`,
    isBroadcast: m.type === 'broadcast',
    local: false,
  }));
  const locals = [...store.messages].sort((a, b) => a.createdAt - b.createdAt);
  for (const m of locals) {
    pool.push({
      text: m.text,
      date: relativeTime(m.createdAt),
      fileName: 'msg_local.log',
      isBroadcast: false,
      local: true,
    });
  }
  return pool;
}

/** 信号总数（纯函数）= 预置条数 + 本机留言数 + 本机回复总数（回复挂在任意卡名下都计入） */
export function countSignals(presetCount: number, store: WallStore): number {
  let n = presetCount + store.messages.length;
  for (const key of Object.keys(store.replies)) {
    n += store.replies[key].length;
  }
  return n;
}

/** prefers-reduced-motion 检测（无 matchMedia 的环境视为不减少动效） */
function isReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 搭一张迷你卡（结构与 MiniWall.astro 直出卡一致；textContent 防 XSS） */
function buildCard(item: MiniWallItem): HTMLElement {
  const card = document.createElement('article');
  card.className = 'qn-mw-card';
  // 落卡角度：运行时随机小角度（装饰用，无 SSR 确定性要求）
  const ang = (Math.random() * 2 - 1) * TILT_DEG;
  card.style.setProperty('--fr', `${ang.toFixed(2)}deg`);

  const tilt = document.createElement('div');
  tilt.className = 'qn-mw-tilt';

  const head = document.createElement('div');
  head.className = 'qn-mw-card-head';
  const file = document.createElement('span');
  file.className = 'qn-mw-file';
  file.textContent = item.fileName;
  head.appendChild(file);
  if (item.isBroadcast) {
    const tag = document.createElement('span');
    tag.className = 'qn-mw-tag';
    tag.textContent = '[广播]';
    head.appendChild(tag);
  }

  const text = document.createElement('p');
  text.className = 'qn-mw-card-text';
  text.textContent = item.text; // 只走 textContent，绝不 innerHTML

  const date = document.createElement('div');
  date.className = 'qn-mw-card-date';
  date.textContent = item.date;

  tilt.append(head, text, date);
  card.appendChild(tilt);
  return card;
}

/** 氛围层：极淡扫光线（6s/轮）+ 3–4 粒光尘上浮（透明度 ≤0.07）；reduced-motion 不建 */
function buildAmbience(root: HTMLElement): void {
  const sweep = document.createElement('span');
  sweep.className = 'qn-mw-sweep';
  sweep.setAttribute('aria-hidden', 'true');
  root.appendChild(sweep);

  const dustCount = 3 + Math.floor(Math.random() * 2); // 3–4 粒
  for (let i = 0; i < dustCount; i++) {
    const dust = document.createElement('span');
    dust.className = 'qn-mw-dust';
    dust.setAttribute('aria-hidden', 'true');
    dust.style.left = `${8 + Math.random() * 84}%`;
    dust.style.animationDuration = `${7 + Math.random() * 6}s`;
    dust.style.animationDelay = `-${Math.random() * 8}s`;
    root.appendChild(dust);
  }
}

/** 入口：标题打字 + 轮播 + 计数修正 + 氛围层（全部可降级，SSR 内容不受影响） */
export function initMiniWall(): void {
  const root = document.getElementById('qn-mw');
  const body = root?.querySelector<HTMLElement>('.qn-mw-body');
  if (!root || !body) return;

  const reduce = isReducedMotion();
  const store = loadStore();
  const pool = buildPool(wallMessages, store);

  // ---- 计数修正：SSR 直出「共 12 条信号」，有 JS 且未减少动效时改为真实总数 ----
  const count = root.querySelector<HTMLElement>('.qn-mw-count');
  if (!reduce && count) {
    count.textContent = `共 ${countSignals(wallMessages.length, store)} 条信号`;
  }

  // ---- 标题伪命令逐字打出（文本已直出；typeLines 自带 reduced-motion 静态回退）----
  const cmd = root.querySelector<HTMLElement>('.qn-mw-cmd');
  const row = cmd?.querySelector<HTMLElement>('[data-line]');
  if (cmd && row && !reduce) {
    const title = row.textContent ?? '';
    const type = (): void => void typeLines(cmd, [title]);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            io.disconnect(); // 进视口触发一次
            type();
          }
        },
        { threshold: 0.4 },
      );
      io.observe(root);
    } else {
      type();
    }
  }

  // ---- 氛围层（reduced-motion 不建）----
  if (!reduce) buildAmbience(root);

  // ---- 轮播（reduced-motion 不轮播；池 ≤3 条无可轮内容）----
  if (reduce || pool.length <= 3) return;

  // 固定卡区高度：轮播时新卡落下/旧卡下沉不再推挤页面布局
  const h = body.offsetHeight;
  if (h > 0) {
    body.style.height = `${Math.ceil(h)}px`;
    body.style.overflow = 'hidden';
  }

  // SSR 直出的是池中预置末尾 3 条，游标停在最后一条，下一条从其后继续
  let cursor = wallMessages.length - 1;

  const rotate = (): void => {
    cursor = (cursor + 1) % pool.length;
    const card = buildCard(pool[cursor]);
    card.classList.add('qn-mw-enter'); // 从顶部落进
    body.prepend(card);

    const oldest = body.lastElementChild as HTMLElement | null;
    if (oldest && oldest !== card) {
      oldest.classList.add('qn-mw-exit'); // 最旧淡出下沉
      const remove = (): void => oldest.remove();
      oldest.addEventListener('animationend', remove, { once: true });
      setTimeout(remove, 700); // 兜底：动画事件丢失时也移除
    }
    // 护栏：exit 未及移除也不堆积（从最旧一端删，不伤刚落下的新卡）
    while (body.children.length > 4) body.lastElementChild?.remove();
  };

  let timer: number | undefined;
  const start = (): void => {
    if (timer === undefined) timer = window.setInterval(rotate, ROTATE_MS);
  };
  const stop = (): void => {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  // 性能护栏：仅视口内轮播（与墙页浮动同一手法）
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(root);
  } else {
    start();
  }
}
