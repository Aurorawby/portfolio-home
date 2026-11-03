/**
 * 通用小工具：把前端 HTML 里的内联脚本放进带 DOM 桩的沙箱跑起来，
 * 这样可以脱离浏览器验证「纯函数」逻辑（题目提取、分类、引用核验等）。
 */
import fs from 'node:fs';
import vm from 'node:vm';

function makeElement() {
  const element = {
    addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
    insertBefore() {}, setAttribute() {}, removeAttribute() {}, focus() {}, blur() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: new Proxy({}, { get: () => '', set: () => true }),
    dataset: {},
    children: [], childNodes: [],
    value: '', textContent: '', innerHTML: '', title: '',
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
  };
  return element;
}

export function buildDom() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
    createElement: () => makeElement(),
    addEventListener() {},
    body: makeElement(),
    documentElement: makeElement(),
  };
  return { document, elements };
}

export function loadInlineScript(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((code) => code.trim().length > 200);
  if (!blocks.length) throw new Error(`没有找到内联脚本：${htmlPath}`);
  return blocks.sort((a, b) => b.length - a.length)[0];
}

export function runScript(code, expose, options = {}) {
  const { document } = buildDom();
  const store = new Map(Object.entries(options.storage || {}));
  const localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
  const context = {
    document,
    window: undefined,
    localStorage,
    navigator: { clipboard: { writeText: async () => {} } },
    location: { hash: '', pathname: '/', search: '', href: 'https://example.com/' },
    history: { replaceState() {}, pushState() {} },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    alert() {}, prompt() {}, confirm() { return true; },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  const exposure = `\n;globalThis.__API = {${expose.join(', ')}};`;
  vm.runInContext(code + exposure, context, { filename: 'inline.js' });
  context.__API.__store = store;
  return context.__API;
}

/** 中文 bigram 相似度，用于"提取结果"和"标注结果"的模糊匹配。 */
export function bigramSimilarity(a, b) {
  const clean = (text) => String(text).replace(/[\s，。！？、；：""''（）()【】\[\]…—\-]/g, '');
  const grams = (text) => {
    const result = new Set();
    const s = clean(text);
    for (let i = 0; i < s.length - 1; i += 1) result.add(s.slice(i, i + 2));
    if (s.length === 1) result.add(s);
    return result;
  };
  const left = grams(a);
  const right = grams(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const gram of left) if (right.has(gram)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
}

export function matchQuestions(got, expected, threshold = 0.5) {
  const used = new Set();
  const matched = [];
  for (const question of got) {
    let best = null;
    let bestScore = 0;
    expected.forEach((item, index) => {
      if (used.has(index)) return;
      const score = bigramSimilarity(question, item.q);
      if (score > bestScore) { bestScore = score; best = index; }
    });
    if (best !== null && bestScore >= threshold) {
      used.add(best);
      matched.push({ got: question, expected: expected[best], score: bestScore });
    } else {
      matched.push({ got: question, expected: null, score: bestScore });
    }
  }
  return { matched, used };
}
