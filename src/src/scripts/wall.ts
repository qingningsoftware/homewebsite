/**
 * 留言墙渐进增强（实施计划任务 6 Step 8–9；设计稿 §12.3–12.4）
 *
 * 职责（正文早已服务端直出，这里只做动效与本机留言/回复）：
 * 1. 进场落钉：武装画布 → IntersectionObserver 触发一次，同批卡片 stagger 0.15s；
 * 2. 待机浮动：仅视口内卡片挂 .qn-float（±5px、异周期，性能护栏）；
 * 3. 本机留言：提交 → addMessage → ~/my-messages 区插入新卡（同款落钉）→ 平滑滚动定位；
 * 4. 回复（§12.4 任意卡可匿名回复）：卡内「↳ 回复」展开内联输入 → addReply →
 *    该卡内追加缩进行；初始化时把已存本机回复回显到对应卡（刷新留存）；
 * 5. 删除/清空：× 单条删除、清空按钮，操作后同步视图与计数。
 *
 * 安全铁律：所有动态 DOM 一律 createElement + textContent 搭建，
 * 禁止 innerHTML 拼接任何用户输入（防 XSS）。
 * 无 JS / prefers-reduced-motion：不武装、不浮动，卡片静态完整呈现
 * （回复框 SSR 时 hidden，无 JS 不展开，正文不受影响）。
 */
import {
  addMessage,
  addReply,
  clearLocal,
  loadStore,
  removeMessage,
} from '../lib/wall-local';
import { mulberry32 } from '../lib/rng';

/** 同批落钉间隔（秒） */
const STAGGER_S = 0.15;

/** 本机留言上限提示（与 wall-local 的 30 条一致） */
const MAX_ENTRIES = 30;

/** prefers-reduced-motion（无 matchMedia 环境视为不减少） */
function isReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 真实相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前（本机卡专用） */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/** 取画布里全部预置卡（含虚线留言卡，同为落钉对象） */
function canvasCards(canvas: HTMLElement): HTMLElement[] {
  return Array.from(canvas.querySelectorAll<HTMLElement>('.qn-card'));
}

/** 进场落钉 + 视口内浮动：一个 IO 同时管两件事（进视口落定并浮动，出视口停浮） */
function armCanvas(canvas: HTMLElement): void {
  canvas.classList.add('qn-armed');
  const io = new IntersectionObserver(
    (entries) => {
      let batch = 0; // 同一回调里进来的卡依次错开 0.15s
      for (const entry of entries) {
        const card = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          if (!card.classList.contains('qn-dropped')) {
            // 异周期参数只在首次赋值：周期 6–10s，负 delay 错开相位
            const idx = canvasCards(canvas).indexOf(card);
            card.style.setProperty('--fd', `${6 + (idx % 5)}s`);
            card.style.setProperty('--fdel', `-${(idx % 5) * 1.3}s`);
            card.style.setProperty('--sd', `${batch * STAGGER_S}s`);
            batch += 1;
            card.classList.add('qn-dropped'); // 进场触发一次，不重复
          }
          card.classList.add('qn-float');
        } else {
          card.classList.remove('qn-float'); // 出视口停浮（性能护栏）
        }
      }
    },
    { threshold: 0.15 },
  );
  canvasCards(canvas).forEach((c) => io.observe(c));
}

/** 搭回复框（↳ 回复按钮 + 内联输入表单；与 WallCard.astro 直出结构一致） */
function buildReplyBox(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'qn-card-replybox';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'qn-card-replybtn';
  const arrow = document.createElement('span');
  arrow.className = 'qn-card-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↳';
  btn.appendChild(arrow);
  btn.appendChild(document.createTextNode(' 回复'));
  const form = document.createElement('form');
  form.className = 'qn-reply-form';
  form.hidden = true;
  const input = document.createElement('input');
  input.className = 'qn-reply-input';
  input.maxLength = 200;
  input.placeholder = '匿名回复';
  input.setAttribute('aria-label', '匿名回复');
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'qn-reply-send';
  send.textContent = '发送';
  const status = document.createElement('span');
  status.className = 'qn-reply-status';
  status.setAttribute('role', 'status');
  form.append(input, send, status);
  box.append(btn, form);
  return box;
}

/** 搭一张回复缩进行（用户回复统一「匿名回复：」前缀；textContent 防 XSS） */
function buildReplyLine(text: string, isNew: boolean): HTMLElement {
  const line = document.createElement('p');
  line.className = 'qn-card-reply';
  if (isNew) line.classList.add('qn-reply-new'); // 追加时轻微落钉；reduced-motion 由总闸停掉
  const arrow = document.createElement('span');
  arrow.className = 'qn-card-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↳';
  line.appendChild(arrow);
  line.appendChild(document.createTextNode(`匿名回复：${text}`));
  return line;
}

/** 把一条回复追加到卡的缩进区（容器不存在则建） */
function appendReplyToCard(card: HTMLElement, text: string, isNew: boolean): void {
  const body = card.querySelector('.qn-card-body');
  if (!body) return;
  let list = body.querySelector<HTMLElement>('.qn-card-replies');
  if (!list) {
    list = document.createElement('div');
    list.className = 'qn-card-replies';
    body.appendChild(list);
  }
  list.appendChild(buildReplyLine(text, isNew));
}

/** 回显：把已存本机回复渲染到对应卡（预置/本机卡统一按 data-qn-id 找） */
export function renderStoredReplies(): void {
  const { replies } = loadStore();
  for (const cardId of Object.keys(replies)) {
    const card = document.querySelector<HTMLElement>(`.qn-card[data-qn-id="${cardId}"]`);
    if (!card) continue;
    for (const r of replies[cardId]) {
      appendReplyToCard(card, r.text, false);
    }
  }
}

/** 搭一张本机留言卡（结构与 WallCard.astro 直出卡一致；textContent 防 XSS） */
function buildLocalCard(entry: { id: string; text: string; createdAt: number }): HTMLElement {
  const card = document.createElement('article');
  card.className = 'qn-card qn-local';
  card.dataset.qnId = entry.id;
  // 本机卡角度：以 createdAt 为种子 ±3°，落款走真实相对时间
  const ang = (mulberry32(entry.createdAt)() * 2 - 1) * 3;

  const drop = document.createElement('div');
  drop.className = 'qn-card-drop';
  const tilt = document.createElement('div');
  tilt.className = 'qn-card-tilt';
  tilt.style.setProperty('--fr', `${ang.toFixed(2)}deg`);

  const head = document.createElement('header');
  head.className = 'qn-card-head';
  const dots = document.createElement('span');
  dots.className = 'qn-card-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('i'));
  const file = document.createElement('span');
  file.className = 'qn-card-file';
  file.textContent = 'msg_local.log';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'qn-card-del';
  del.setAttribute('aria-label', '删除这条留言');
  del.textContent = '×';
  head.append(dots, file, del);

  const body = document.createElement('div');
  body.className = 'qn-card-body';
  const text = document.createElement('p');
  text.className = 'qn-card-text';
  text.textContent = entry.text; // 只走 textContent，绝不 innerHTML
  body.appendChild(text);

  const meta = document.createElement('footer');
  meta.className = 'qn-card-meta';
  const time = document.createElement('span');
  time.className = 'qn-card-date';
  time.textContent = relativeTime(entry.createdAt);
  const author = document.createElement('span');
  author.className = 'qn-card-author';
  author.textContent = '匿名';
  meta.append(time, author);

  tilt.append(head, body, buildReplyBox(), meta);
  drop.appendChild(tilt);
  card.appendChild(drop);
  return card;
}

/** 确保 ~/my-messages 区存在；无则建（插在画布容器之后） */
function ensureMySection(canvas: HTMLElement): { section: HTMLElement; grid: HTMLElement; note: HTMLElement } {
  let section = document.getElementById('qn-my') as HTMLElement | null;
  if (!section) {
    section = document.createElement('section');
    section.id = 'qn-my';
    section.className = 'qn-my';
    section.setAttribute('aria-label', '本机留言区');

    const title = document.createElement('h2');
    title.className = 'qn-my-title';
    title.textContent = '~/my-messages 本机留言';

    const note = document.createElement('p');
    note.className = 'qn-my-note';

    const grid = document.createElement('div');
    grid.className = 'qn-my-grid';

    const foot = document.createElement('div');
    foot.className = 'qn-my-foot';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'qn-my-clear';
    clearBtn.className = 'qn-my-clear';
    clearBtn.textContent = '清空我的留言';
    foot.appendChild(clearBtn);

    section.append(title, note, grid, foot);
    (canvas.parentElement ?? canvas).insertAdjacentElement('afterend', section);
  }
  return {
    section,
    grid: section.querySelector<HTMLElement>('.qn-my-grid') as HTMLElement,
    note: section.querySelector<HTMLElement>('.qn-my-note') as HTMLElement,
  };
}

/** 重画本机区：按存储全量重建卡片与计数（简单可靠，30 条上限下无性能问题） */
function renderMySection(canvas: HTMLElement): void {
  const { messages } = loadStore();
  if (messages.length === 0) {
    document.getElementById('qn-my')?.remove();
    return;
  }
  const { section, grid, note } = ensureMySection(canvas);
  grid.replaceChildren(...messages.map(buildLocalCard));
  note.textContent = `以下 ${messages.length} 条只保存在这台浏览器里（上限 ${MAX_ENTRIES} 条），换设备或清缓存即消失。`;
  section.dataset.count = String(messages.length);
}

/** 平滑滚动定位到指定卡（reduced-motion 用瞬时；环境无该 API 时跳过） */
function scrollToCard(card: HTMLElement, reduce: boolean): void {
  if (typeof card.scrollIntoView !== 'function') return;
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
}

/** 入口：绑定表单、删除/清空/回复事件，武装落钉与浮动 */
export function initWall(): void {
  const canvas = document.getElementById('qn-canvas') as HTMLElement | null;
  const form = document.getElementById('qn-wall-form') as HTMLFormElement | null;
  const input = document.getElementById('qn-wall-input') as HTMLTextAreaElement | null;
  const status = document.getElementById('qn-wall-status') as HTMLElement | null;
  if (!canvas || !form || !input || !status) return;

  const reduce = isReducedMotion();

  // document 级委托监听器只装一次（重复 initWall 不会叠加；每次调用仍重绑当前 DOM 的表单）
  if (!wired) {
    wired = true;
    wireDelegates();
  }

  // ---- 提交本机留言 ----
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = input.value;
    if (!raw.trim()) {
      status.textContent = '先写点什么再发送。';
      return;
    }
    const r = addMessage(raw);
    if (!r.ok) {
      status.textContent =
        r.reason === 'empty'
          ? '先写点什么再发送。'
          : `本机留言已满（上限 ${MAX_ENTRIES} 条），先删几条再发。`;
      return;
    }
    input.value = '';
    status.textContent = '已上墙。这条留言只保存在这台浏览器里。';
    renderMySection(canvas);
    const card = document.querySelector<HTMLElement>(`[data-qn-id="${r.msg.id}"]`);
    if (card) scrollToCard(card, reduce);
  });

  // ---- 初始化：回显已存本机回复 + 本机区 + 落钉武装 ----
  renderStoredReplies();
  renderMySection(canvas);
  if (!reduce && 'IntersectionObserver' in window) {
    armCanvas(canvas);
  }
}

/** 委托监听器装配标记（document 级监听器跨 DOM 重建存活，只能装一次） */
let wired = false;

/** 装配 document 级事件委托：× 删除 / 清空 / 回复展开 / 回复提交 */
function wireDelegates(): void {
  // ---- × 单条删除（仅本机留言卡有 ×）----
  document.addEventListener('click', (ev) => {
    const btn = (ev.target as Element | null)?.closest<HTMLElement>('.qn-card-del');
    if (!btn) return;
    const card = btn.closest<HTMLElement>('.qn-card');
    const id = card?.dataset.qnId;
    if (!card || !id) return;
    removeMessage(id);
    card.remove();
    if (loadStore().messages.length === 0) {
      document.getElementById('qn-my')?.remove();
    } else {
      const note = document.querySelector<HTMLElement>('#qn-my .qn-my-note');
      const n = loadStore().messages.length;
      if (note) note.textContent = `以下 ${n} 条只保存在这台浏览器里（上限 ${MAX_ENTRIES} 条），换设备或清缓存即消失。`;
    }
  });

  // ---- 清空按钮（本机区由脚本按需创建）----
  document.addEventListener('click', (ev) => {
    const btn = (ev.target as Element | null)?.closest<HTMLElement>('#qn-my-clear');
    if (!btn) return;
    if (!window.confirm('确定清空全部本机留言？此操作不可恢复。')) return;
    clearLocal();
    document.getElementById('qn-my')?.remove();
  });

  // ---- 「↳ 回复」展开/收起内联输入框（展开即聚焦）----
  document.addEventListener('click', (ev) => {
    const btn = (ev.target as Element | null)?.closest<HTMLElement>('.qn-card-replybtn');
    if (!btn) return;
    const form = btn.parentElement?.querySelector<HTMLFormElement>('.qn-reply-form');
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector<HTMLInputElement>('.qn-reply-input')?.focus();
  });

  // ---- 提交回复：addReply → 卡内追加缩进行（约束同留言：空拒、>200 截断）----
  document.addEventListener('submit', (ev) => {
    const form = ev.target as Element | null;
    if (!form?.matches('.qn-reply-form')) return;
    ev.preventDefault();
    const card = form.closest<HTMLElement>('.qn-card');
    const cardId = card?.dataset.qnId;
    const input = form.querySelector<HTMLInputElement>('.qn-reply-input');
    const status = form.querySelector<HTMLElement>('.qn-reply-status');
    if (!card || !cardId || !input || !status) return;

    const r = addReply(cardId, input.value);
    if (!r.ok) {
      status.textContent =
        r.reason === 'empty'
          ? '先写点什么再发送。'
          : `本机留言已满（上限 ${MAX_ENTRIES} 条），先删几条再发。`;
      return;
    }
    input.value = '';
    status.textContent = '';
    form.hidden = true;
    appendReplyToCard(card, r.msg.text, true);
  });
}
