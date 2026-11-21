// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadStore, addMessage, addReply, removeMessage, removeReply, clearLocal } from './wall-local';

/**
 * 本机留言存储测试（实施计划任务 6 Step 3 逐字断言）。
 * 全部边界：空/损坏/结构不符 → 空库；无 localStorage → 降级不抛异常；
 * 空文本 → empty；201 字 → 截 200；31 条 → limit；增删改查生效。
 */

const KEY = 'qn-wall-messages';

/** 取当前库的原始 JSON（无 localStorage 时返回 null） */
function raw(): string | null {
  return window.localStorage.getItem(KEY);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('loadStore 边界', () => {
  it('localStorage 为空时返回空库', () => {
    const s = loadStore();
    expect(s).toEqual({ v: 1, messages: [], replies: {} });
  });

  it('损坏 JSON 时重置为空库', () => {
    window.localStorage.setItem(KEY, '{not valid json!!');
    expect(loadStore()).toEqual({ v: 1, messages: [], replies: {} });
  });

  it('结构不符（如数组、缺字段）时重置为空库', () => {
    window.localStorage.setItem(KEY, JSON.stringify([1, 2, 3]));
    expect(loadStore()).toEqual({ v: 1, messages: [], replies: {} });
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, messages: 'oops', replies: {} }));
    expect(loadStore()).toEqual({ v: 1, messages: [], replies: {} });
  });
});

describe('无 localStorage 环境降级', () => {
  it('loadStore 返回空库、addMessage 返回 limit，均不抛异常', () => {
    const original = window.localStorage;
    // 临时删掉 localStorage stub（jsdom 下属性可配置，可删）
    Reflect.deleteProperty(window, 'localStorage');
    try {
      expect(loadStore()).toEqual({ v: 1, messages: [], replies: {} });
      const r = addMessage('你好');
      expect(r).toEqual({ ok: false, reason: 'limit' });
      // remove / clear 同样不抛
      expect(() => removeMessage('x')).not.toThrow();
      expect(() => clearLocal()).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe('addMessage', () => {
  it("trim 后空 → ok:false reason 'empty'", () => {
    expect(addMessage('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it("201 字 → ok:true 且存储文本截断至 200 字", () => {
    const long = '好'.repeat(201);
    const r = addMessage(long);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.msg.text.length).toBe(200);
      expect(r.msg.text).toBe('好'.repeat(200));
    }
    // 库里确实存了截断后的文本
    const s = loadStore();
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].text.length).toBe(200);
  });

  it('31 条循环：前 30 次 ok，第 31 次 reason limit', () => {
    for (let i = 1; i <= 30; i++) {
      const r = addMessage(`第 ${i} 条`);
      expect(r.ok).toBe(true);
    }
    const over = addMessage('第 31 条');
    expect(over).toEqual({ ok: false, reason: 'limit' });
  });

  it('成功提交后 createdAt 为数字且两次提交 id 不同', () => {
    const a = addMessage('甲');
    const b = addMessage('乙');
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(typeof a.msg.createdAt).toBe('number');
      expect(a.msg.id).not.toBe(b.msg.id);
    }
    expect(raw()).not.toBeNull();
  });
});

describe('addReply', () => {
  it('回复归入对应卡，loadStore().replies 含该 cardId', () => {
    const r = addMessage('根留言');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cardId = r.msg.id;
    const rep = addReply(cardId, '一条回复');
    expect(rep.ok).toBe(true);
    const s = loadStore();
    expect(s.replies[cardId]).toHaveLength(1);
    expect(s.replies[cardId][0].text).toBe('一条回复');
  });

  it('addReply 同样受 empty / limit 约束', () => {
    const r = addMessage('根');
    if (!r.ok) return;
    expect(addReply(r.msg.id, ' ')).toEqual({ ok: false, reason: 'empty' });
    // 回复上限与本机留言共用 30 条额度：再塞满
    addReply(r.msg.id, '一条占位回复');
    for (let i = 0; i < 28; i++) addMessage(`填充 ${i}`);
    expect(addReply(r.msg.id, '再回一条')).toEqual({ ok: false, reason: 'limit' });
  });
});

describe('removeMessage / removeReply / clearLocal', () => {
  it('removeMessage 删除指定 id', () => {
    const a = addMessage('甲');
    const b = addMessage('乙');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok) return;
    removeMessage(a.msg.id);
    const s = loadStore();
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].text).toBe('乙');
  });

  it('removeMessage 一并清理该卡名下的回复（不留占额度的孤儿）', () => {
    const a = addMessage('带回复的卡');
    if (!a.ok) return;
    addReply(a.msg.id, '这条回复跟卡一起删');
    removeMessage(a.msg.id);
    const s = loadStore();
    expect(s.messages).toHaveLength(0);
    expect(s.replies[a.msg.id]).toBeUndefined();
  });

  it('removeReply 删除指定卡下的指定回复', () => {
    const r = addMessage('根');
    if (!r.ok) return;
    addReply(r.msg.id, '回复一');
    const rep2 = addReply(r.msg.id, '回复二');
    expect(rep2.ok).toBe(true);
    if (!rep2.ok) return;
    removeReply(r.msg.id, rep2.msg.id);
    const s = loadStore();
    expect(s.replies[r.msg.id]).toHaveLength(1);
    expect(s.replies[r.msg.id][0].text).toBe('回复一');
  });

  it('clearLocal 清空全部本机数据', () => {
    addMessage('甲');
    addMessage('乙');
    clearLocal();
    expect(loadStore()).toEqual({ v: 1, messages: [], replies: {} });
    expect(raw()).toBeNull();
  });
});
