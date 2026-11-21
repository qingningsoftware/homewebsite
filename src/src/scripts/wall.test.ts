// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initWall, relativeTime } from './wall';
import { loadStore, clearLocal } from '../lib/wall-local';

/**
 * 留言墙页面流程测试（任务 6 Step 10「手动 dev 验证」的文本化替代）：
 * 在 jsdom 里搭出 wall.astro 的关键节点，走提交 → 插卡 → 删除 → 清空 → 刷新留存。
 * IntersectionObserver 在 jsdom 缺失 → initWall 自动跳过落钉武装（降级路径顺带覆盖）。
 */

/** 按 wall.astro 的结构搭最小 DOM */
function buildPageDom(): { canvas: HTMLElement; form: HTMLFormElement; input: HTMLTextAreaElement; status: HTMLElement } {
  const canvas = document.createElement('div');
  canvas.id = 'qn-canvas';
  const card = document.createElement('article');
  card.className = 'qn-card';
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

describe('relativeTime 真实相对时间', () => {
  it('刚刚 / N 分钟前 / N 小时前 / N 天前', () => {
    const now = Date.now();
    expect(relativeTime(now - 10_000)).toBe('刚刚');
    expect(relativeTime(now - 90_000)).toBe('1 分钟前');
    expect(relativeTime(now - 7_200_000)).toBe('2 小时前');
    expect(relativeTime(now - 86_400_000 * 3)).toBe('3 天前');
  });
});
