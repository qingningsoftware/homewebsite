/**
 * 伪命令行命令解释器（设计稿 §6.2 / 实施计划任务 4）
 *
 * 纯函数、无 DOM：HeroCli.astro 的客户端脚本在表单提交时调用 runCommand，
 * 按 CmdResult 决定跳转或本地渲染输出。单测见 cli.test.ts。
 *
 * 注意：没有 wall 命令——设计稿 §12.2 已废弃，一律按未知命令处理。
 */

export type CmdResult =
  | { kind: 'nav'; to: string }
  | { kind: 'print'; lines: string[] }
  | { kind: 'clear' };

/** 导航命令表（大小写不敏感，键一律小写） */
const NAV_COMMANDS: Record<string, string> = {
  products: '/products/',
  pacs: '/products/pacs/',
  agent: '/agent/',
  services: '/services/',
  about: '/about/',
  contact: '/contact/',
};

/** help / ls 打印的命令清单 */
const HELP_LINES: string[] = [
  '可用命令：',
  '  products    产品列表',
  '  pacs        医疗影像 PACS',
  '  agent       AI Agent',
  '  services    服务清单',
  '  about       关于我们',
  '  contact     联系方式',
  '  ls / help   本清单',
  '  clear       清屏',
];

/** 参与建议的命令全集（导航 + 内置） */
const KNOWN_COMMANDS: string[] = [...Object.keys(NAV_COMMANDS), 'help', 'ls', 'clear'];

/**
 * 简单 Levenshtein 编辑距离（滚动数组实现，O(min) 空间）
 */
export function 编辑距离(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1, // 删除
        cur[j - 1] + 1, // 插入
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // 替换
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** 编辑距离 ≤2 的最近命令建议；无候选返回 undefined */
export function 建议命令(input: string): string | undefined {
  const candidates = KNOWN_COMMANDS.map((name) => ({ name, d: 编辑距离(input, name) }))
    .filter((c) => c.d <= 2)
    .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name));
  return candidates[0]?.name;
}

/**
 * 解释一条命令。
 * - 导航命令 → { kind: 'nav', to }
 * - help / ls → 打印命令清单；clear → 清屏
 * - 未知命令 → 幽默提示 + suggestions 行（编辑距离 ≤2 时）
 */
export function runCommand(input: string): CmdResult {
  const cmd = input.trim().toLowerCase();
  if (cmd === '') {
    // 空输入按 help 处理，避免对空串输出「未找到」的滑稽提示
    return { kind: 'print', lines: HELP_LINES };
  }
  if (cmd in NAV_COMMANDS) {
    return { kind: 'nav', to: NAV_COMMANDS[cmd] };
  }
  if (cmd === 'help' || cmd === 'ls') {
    return { kind: 'print', lines: HELP_LINES };
  }
  if (cmd === 'clear') {
    return { kind: 'clear' };
  }
  // 未知命令：第一行幽默提示，第二行 suggestions（仅当有编辑距离 ≤2 的候选）
  const lines = [
    `qn: command not found: ${input.trim()} —— 这条命令青柠没写过，连我们的 Agent 都装没听见。`,
  ];
  const guess = 建议命令(cmd);
  if (guess) {
    lines.push(`suggestions: ${guess}（想输入的是它吗？或键入 help 查看全部命令）`);
  }
  return { kind: 'print', lines };
}
