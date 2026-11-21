/**
 * 打字机（实施计划任务 5 Step 2；设计稿 §6.3–6.5）
 *
 * 纯增强约定（GEO）：行文本必须已服务端直出在 HTML 里，typeLines 只是把它
 * 「清空再逐字打出来」的视觉效果。无 JS / prefers-reduced-motion 时文本原样静态显示。
 * 供首页产品部署回放（任务 5）与 Agent 页对话回放（任务 9）复用。
 *
 * 行元素约定：
 * - 行 = 容器内带 `data-line` 属性的直接子元素，按 DOM 顺序与 lines 一一对应；
 * - 行元素少于 lines 时自动补建 `<div data-line>`（供 JS 动态造对话的场景）；
 * - 打字只重写行元素的第一个文本节点，不拍平行内结构——因此行内可以保留
 *   `<span>` 等装饰标记（如回放行的「..... 尾注」由 CSS 控制亮出）；
 * - 每行打完：移除 `data-typing` 光标标记、加 class `qn-done`（调用方可据此上样式）。
 *
 * 动效总闸：prefers-reduced-motion 下不打字，直接把全部行置为完整文本。
 */

/** 行间停顿（毫秒）：一行打完略作停顿再打下一行，模拟终端逐行输出的节奏 */
const LINE_GAP_MS = 180;

/** 默认打字速度（字符/秒） */
const DEFAULT_CPS = 30;

/** prefers-reduced-motion 检测（无 matchMedia 的环境视为不减少动效） */
function isReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 取行元素的第一个文本节点；首子节点不是文本节点时在行首补插一个空文本节点。
 * 打字只写这个节点，行内其余子元素（装饰 span 等）原样保留。
 */
function ensureTextNode(el: Element): Text {
  const first = el.firstChild;
  if (first && first.nodeType === 3) return first as Text;
  const node = document.createTextNode('');
  el.insertBefore(node, first);
  return node;
}

/**
 * 在 container 内逐行逐字打出 lines。
 * @param container 回放容器（行元素为其带 data-line 的直接子元素）
 * @param lines     每行的完整目标文本（服务端直出文本的镜像）
 * @param opts.cps  打字速度（字符/秒，默认 30）
 */
export async function typeLines(
  container: Element,
  lines: string[],
  opts?: { cps?: number },
): Promise<void> {
  if (lines.length === 0) return;
  const cps = opts?.cps ?? DEFAULT_CPS;

  // 行元素 = 容器内带 data-line 的直接子元素；不足则补建（动态对话场景）
  let rows = Array.from(container.children).filter((el) => el.hasAttribute('data-line'));
  while (rows.length < lines.length) {
    const el = document.createElement('div');
    el.setAttribute('data-line', '');
    container.appendChild(el);
    rows = Array.from(container.children).filter((el) => el.hasAttribute('data-line'));
  }

  // 动效总闸：reduced-motion 不打字，全部行直接置为完整文本（静态直出效果一致）
  if (isReducedMotion()) {
    rows.forEach((el, i) => {
      ensureTextNode(el).data = lines[i] ?? '';
    });
    return;
  }

  for (let i = 0; i < lines.length; i++) {
    const el = rows[i];
    if (!el) break;
    const node = ensureTextNode(el);
    const target = lines[i] ?? '';
    el.setAttribute('data-typing', ''); // CSS 据此在行尾挂闪烁光标
    node.data = '';
    for (let j = 1; j <= target.length; j++) {
      node.data = target.slice(0, j);
      await sleep(1000 / cps);
    }
    el.removeAttribute('data-typing');
    el.classList.add('qn-done');
    if (i < lines.length - 1) await sleep(LINE_GAP_MS);
  }
}
