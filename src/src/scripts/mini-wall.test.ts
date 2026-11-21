// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildPool, countSignals } from './mini-wall';
import wallMessages from '../../data/wall-messages.json';
import type { WallStore } from '../lib/wall-local';

/**
 * 首页迷你留言墙纯函数测试（实施计划任务 7）：
 * countSignals（计数公式 = 预置 + 本机留言 + 本机回复总数）与
 * buildPool（池合并：预置按 json 顺序在前、本机按提交先后追加在后）。
 * 轮播本体属 DOM 动效，不做断言（简报允许）。
 */

/** 造一个本机库（缺省字段补空） */
function makeStore(
  messages: WallStore['messages'] = [],
  replies: WallStore['replies'] = {},
): WallStore {
  return { v: 1, messages, replies };
}

describe('countSignals 计数公式', () => {
  it('无本机数据时 = 预置条数（SSR 直出口径「共 12 条信号」）', () => {
    expect(countSignals(wallMessages.length, makeStore())).toBe(12);
    expect(countSignals(0, makeStore())).toBe(0);
  });

  it('本机留言与回复都计入：12 预置 + 2 留言 + 3 回复 = 17', () => {
    const store = makeStore(
      [
        { id: 'a', text: '第一条', createdAt: 1 },
        { id: 'b', text: '第二条', createdAt: 2 },
      ],
      {
        a: [
          { id: 'r1', text: '回复一', createdAt: 3 },
          { id: 'r2', text: '回复二', createdAt: 4 },
        ],
        'm03': [{ id: 'r3', text: '回复三', createdAt: 5 }],
      },
    );
    expect(countSignals(wallMessages.length, store)).toBe(17);
  });

  it('回复挂在未知卡名下也计入（公式 = 回复总数，不看卡是否存在）', () => {
    const store = makeStore([], { ghost: [{ id: 'r1', text: '孤儿回复', createdAt: 1 }] });
    expect(countSignals(wallMessages.length, store)).toBe(13);
  });
});

describe('buildPool 池合并', () => {
  it('预置 12 条在前，顺序与 wall-messages.json 一致，date 带方括号', () => {
    const pool = buildPool(wallMessages, makeStore());
    expect(pool).toHaveLength(wallMessages.length);
    pool.forEach((item, i) => {
      expect(item.text).toBe(wallMessages[i].text);
      expect(item.date).toBe(`[${wallMessages[i].date}]`);
      expect(item.local).toBe(false);
    });
  });

  it('广播卡命名为 broadcast.log 并打标，打卡卡命名为 msg_<id>.log', () => {
    const pool = buildPool(wallMessages, makeStore());
    const broadcast = pool.filter((m) => m.isBroadcast);
    expect(broadcast.map((m) => m.fileName)).toEqual(
      wallMessages.filter((m) => m.type === 'broadcast').map(() => 'broadcast.log'),
    );
    const checkin = pool.find((m) => m.fileName === `msg_${wallMessages[6].id}.log`);
    expect(checkin?.isBroadcast).toBe(false);
  });

  it('本机留言按提交先后（createdAt 升序）追加在预置之后，标 local、文件名 msg_local.log', () => {
    const store = makeStore([
      { id: 'late', text: '后发的', createdAt: 2000 },
      { id: 'early', text: '先发的', createdAt: 1000 },
    ]);
    const pool = buildPool(wallMessages, store);
    expect(pool).toHaveLength(wallMessages.length + 2);
    expect(pool[wallMessages.length].text).toBe('先发的');
    expect(pool[wallMessages.length + 1].text).toBe('后发的');
    for (const item of pool.slice(wallMessages.length)) {
      expect(item.local).toBe(true);
      expect(item.fileName).toBe('msg_local.log');
      expect(item.isBroadcast).toBe(false);
      expect(typeof item.date).toBe('string'); // 相对时间（刚刚 / N 天前），非空即可
      expect(item.date.length).toBeGreaterThan(0);
    }
  });

  it('本机库为空时池即预置（SSR 与轮播同源）', () => {
    const pool = buildPool(wallMessages, makeStore());
    expect(pool.map((m) => m.text)).toEqual(wallMessages.map((m) => m.text));
  });
});
