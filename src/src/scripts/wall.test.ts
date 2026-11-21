// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initWall, relativeTime } from './wall';
import { loadStore, clearLocal } from '../lib/wall-local';

/**
 * 留言墙页面流程测试（任务 6 Step 10「手动 dev 验证」的文本化替代）：
 * 在 jsdom 里搭出 wall.astro 的关键节点，走提交 → 插卡 → 删除 → 清空 → 刷新留存。
 * IntersectionObserver 在 jsdom 缺失 → initWall 自动跳过落钉武装（降级路径顺带覆盖）。
 */

/** 按 wall.astro 的结构搭最小 DOM（卡片含回复框，结构与 WallCard.astro 一致） */
function buildPageDom(): { canvas: HTMLElement; form: HTMLFormElement; input: HTMLTextAreaElement; status: HTMLElement } {
  const canvas = document.createElement('div');
  canvas.id = 'qn-canvas';
  const card = document.createElement('article');
  card.className = 'qn-card';
  card.dataset.qnId = 'm01';
  const body = document.createElement('div');
  body.className = 'qn-card-body';
  const text = document.createElement('p');
  text.className = 'qn-card-text';
  text.textContent = '预置留言正文';
  body.appendChild(text);
  const replybox = document.createElement('div');
  replybox.className = 'qn-card-replybox';
  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.className = 'qn-card-replybtn';
  replyBtn.textContent = '↳ 回复';
  const replyForm = document.createElement('form');
  replyForm.className = 'qn-reply-form';
  replyForm.hidden = true;
  const replyInput = document.createElement('input');
  replyInput.className = 'qn-reply-input';
  const replySend = document.createElement('button');
  replySend.type = 'submit';
  replySend.className = 'qn-reply-send';
  const replyStatus = document.createElement('span');
  replyStatus.className = 'qn-reply-status';
  replyForm.append(replyInput, replySend, replyStatus);
  replybox.append(replyBtn, replyForm);
  card.append(body, replybox);
  canvas.appendChild(card);

  const form = document.createElement('form');
  form.id = 'qn-wall-form';
  const input = document.createElement('textarea');
  input.id = 'qn-wall-input';
  const status = document.createElement('p');
  status.id = 'qn-wall-status';
  form.append(input, status);

  document.body.append(canvas, form);
  return { canvas, form, input, status };
}

/** 触发表单提交 */
function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  window.localStorage.clear();
  buildPageDom();
});

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('initWall 页面流程', () => {
  it('提交 → 写入存储、~/my-messages 插入本机卡（textContent 搭建）', () => {
    initWall();
    const input = document.getElementById('qn-wall-input') as HTMLTextAreaElement;
    input.value = '你好，墙！';
    submit(document.getElementById('qn-wall-form') as HTMLFormElement);

    const section = document.getElementById('qn-my');
    expect(section).not.toBeNull();
    const localCard = section?.querySelector<HTMLElement>('.qn-card.qn-local');
    expect(localCard).not.toBeNull();
    // 用户文本必须走 textContent 进入 DOM（而非 innerHTML 拼接）
    expect(localCard?.querySelector('.qn-card-text')?.textContent).toBe('你好，墙！');
    expect(loadStore().messages).toHaveLength(1);
    // 状态行提示仅本机可见
    expect(document.getElementById('qn-wall-status')?.textContent).toContain('只保存在这台浏览器里');
  });

  it('刷新留存：重新 initWall 前先有存量留言 → renderMySection 恢复整区', () => {
    // 模拟上次会话留下的存储
    window.localStorage.setItem(
      'qn-wall-messages',
      JSON.stringify({
        v: 1,
        messages: [{ id: 'kept-1', text: '上次留的言', createdAt: Date.now() - 60_000 }],
        replies: {},
      }),
    );
    initWall();
    const card = document.querySelector<HTMLElement>('[data-qn-id="kept-1"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector('.qn-card-text')?.textContent).toBe('上次留的言');
    // 本机卡时间戳用真实相对时间（60 秒前 → 1 分钟前）
    expect(card?.querySelector('.qn-card-date')?.textContent).toBe('1 分钟前');
  });

  it('× 单条删除：卡移除、存储同步；删空后整区移除', () => {
    initWall();
    const input = document.getElementById('qn-wall-input') as HTMLTextAreaElement;
    input.value = '待删除';
    submit(document.getElementById('qn-wall-form') as HTMLFormElement);

    const del = document.querySelector<HTMLElement>('.qn-card-del');
    expect(del).not.toBeNull();
    del?.click();
    expect(document.getElementById('qn-my')).toBeNull();
    expect(loadStore().messages).toHaveLength(0);
  });

  it('清空按钮：confirm 通过则清库移除整区，拒绝则保留', () => {
    initWall();
    const input = document.getElementById('qn-wall-input') as HTMLTextAreaElement;
    input.value = '甲';
    submit(document.getElementById('qn-wall-form') as HTMLFormElement);
    const clearBtn = document.getElementById('qn-my-clear');
    expect(clearBtn).not.toBeNull();

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    clearBtn?.click();
    expect(document.getElementById('qn-my')).not.toBeNull(); // 拒绝 → 保留
    expect(loadStore().messages).toHaveLength(1);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    clearBtn?.click();
    expect(document.getElementById('qn-my')).toBeNull(); // 确认 → 清空
    expect(loadStore()).toEqual({ v: 1, messages: [], replies: {} });
  });

  it('空提交被拦截且不写库；留言满 30 条时提交提示先删', () => {
    initWall();
    const input = document.getElementById('qn-wall-input') as HTMLTextAreaElement;
    const status = document.getElementById('qn-wall-status') as HTMLElement;
    input.value = '   ';
    submit(document.getElementById('qn-wall-form') as HTMLFormElement);
    expect(status.textContent).toContain('先写点什么');
    expect(loadStore().messages).toHaveLength(0);

    // 塞满 30 条再提交 → limit 提示
    for (let i = 0; i < 30; i++) input.value = `填充 ${i}`, submit(document.getElementById('qn-wall-form') as HTMLFormElement);
    input.value = '第 31 条';
    submit(document.getElementById('qn-wall-form') as HTMLFormElement);
    expect(status.textContent).toContain('已满');
    expect(loadStore().messages).toHaveLength(30);
  });
});

describe('回复流程（§12.4 任意卡可匿名回复）', () => {
  /** 取 m01 卡的回复输入控件 */
  function replyControls() {
    const card = document.querySelector<HTMLElement>('.qn-card[data-qn-id="m01"]') as HTMLElement;
    return {
      card,
      btn: card.querySelector<HTMLElement>('.qn-card-replybtn') as HTMLElement,
      form: card.querySelector<HTMLFormElement>('.qn-reply-form') as HTMLFormElement,
      input: card.querySelector<HTMLInputElement>('.qn-reply-input') as HTMLInputElement,
      status: card.querySelector<HTMLElement>('.qn-reply-status') as HTMLElement,
    };
  }

  it('点「↳ 回复」展开内联输入，再点收起', () => {
    initWall();
    const { btn, form } = replyControls();
    expect(form.hidden).toBe(true);
    btn.click();
    expect(form.hidden).toBe(false);
    btn.click();
    expect(form.hidden).toBe(true);
  });

  it('提交回复 → 卡内追加「↳ 匿名回复：…」缩进行且落库', () => {
    initWall();
    const { card, form, input } = replyControls();
    document.querySelector<HTMLElement>('.qn-card-replybtn')?.click();
    input.value = '楼上说得对';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const line = card.querySelector('.qn-card-replies .qn-card-reply');
    expect(line).not.toBeNull();
    expect(line?.textContent).toContain('匿名回复：楼上说得对');
    expect(line?.textContent).toContain('↳');
    // 落库：统一 key = 卡 id
    const store = loadStore();
    expect(store.replies['m01']).toHaveLength(1);
    expect(store.replies['m01'][0].text).toBe('楼上说得对');
    // 成功后收起并清空
    expect(form.hidden).toBe(true);
    expect(input.value).toBe('');
  });

  it('刷新留存：已存回复由 renderStoredReplies 回显到对应卡', () => {
    window.localStorage.setItem(
      'qn-wall-messages',
      JSON.stringify({
        v: 1,
        messages: [],
        replies: { m01: [{ id: 'r-keep', text: '之前回的一句', createdAt: Date.now() }] },
      }),
    );
    initWall();
    const line = document.querySelector<HTMLElement>(
      '.qn-card[data-qn-id="m01"] .qn-card-replies .qn-card-reply',
    );
    expect(line?.textContent).toContain('匿名回复：之前回的一句');
  });

  it('空提交拒绝（不落库），201 字截断至 200', () => {
    initWall();
    const { form, input, status } = replyControls();
    document.querySelector<HTMLElement>('.qn-card-replybtn')?.click();

    input.value = '   ';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(status.textContent).toContain('先写点什么');
    expect(loadStore().replies['m01']).toBeUndefined();

    input.value = '好'.repeat(201);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const stored = loadStore().replies['m01'];
    expect(stored).toHaveLength(1);
    expect(stored[0].text.length).toBe(200);
    // 卡内缩进行与落库文本一致（截断后的 200 字）
    const line = document.querySelector<HTMLElement>(
      '.qn-card[data-qn-id="m01"] .qn-card-replies .qn-card-reply',
    );
    expect(line?.textContent).toContain('匿名回复：');
    expect(line?.textContent?.split('匿名回复：')[1]?.length).toBe(200);
  });
});

describe('relativeTime 真实相对时间', () => {
  it('刚刚 / N 分钟前 / N 小时前 / N 天前', () => {
    const now = Date.now();
    expect(relativeTime(now - 10_000)).toBe('刚刚');
    expect(relativeTime(now - 90_000)).toBe('1 分钟前');
    expect(relativeTime(now - 7_200_000)).toBe('2 小时前');
    expect(relativeTime(now - 86_400_000 * 3)).toBe('3 天前');
  });
});
