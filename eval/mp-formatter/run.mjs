/**
 * 公众号排版器：Markdown 解析与渲染回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：解析块序列、字数统计、违禁词命中、内联样式渲染是否与手工判定一致（回归测试）。
 *
 * 运行：node eval/mp-formatter/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'mp-formatter', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['parseMd', 'countWords', 'checkRisks', 'renderHtml', 'inlineSpans']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: ok ? '' : detail });
}

// 1. 解析
for (const c of CASES.parse) {
  const blocks = api.parseMd(c.md);
  const types = blocks.map((b) => b.type);
  let ok = JSON.stringify(types) === JSON.stringify(c.expectTypes);
  let detail = `类型期望 ${JSON.stringify(c.expectTypes)}，实际 ${JSON.stringify(types)}`;
  if (ok && c.expectTexts) {
    for (const [key, want] of Object.entries(c.expectTexts)) {
      if (key === 'ul_len' || key === 'ol_len') {
        const b = blocks.find((x) => x.type === key.slice(0, 2));
        if (!b || b.items.length !== want) { ok = false; detail = `${key} 期望 ${want}，实际 ${b ? b.items.length : '无'}`; }
      } else {
        const b = blocks.find((x) => x.type === key);
        if (!b || b.text !== want) { ok = false; detail = `${key} 期望「${want}」，实际「${b ? b.text : '无'}」`; }
      }
    }
  }
  check(`解析·${c.id}`, ok, detail);
}

// 2. 字数
for (const c of CASES.words) {
  const got = api.countWords(api.parseMd(c.md));
  check(`字数·${c.id}`, got === c.expect, `期望 ${c.expect}，实际 ${got}`);
}

// 3. 违禁词
for (const c of CASES.risks) {
  const got = api.checkRisks(c.text).map((r) => r.word);
  const ok = JSON.stringify(got) === JSON.stringify(c.expect);
  check(`违禁词·${c.id}`, ok, `期望 ${JSON.stringify(c.expect)}，实际 ${JSON.stringify(got)}`);
}

// 4. 渲染
for (const c of CASES.render) {
  const html = api.renderHtml(c.blocks, c.theme);
  const missing = c.expectContains.filter((kw) => !html.includes(kw));
  const hasClass = /\sclass="/.test(html);
  check(`渲染·${c.id}`, missing.length === 0 && !hasClass,
    missing.length ? `缺 ${missing.join('、')}` : (hasClass ? '含 class（应为纯 inline）' : 'OK'));
}

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 公众号排版器 · 解析与渲染回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push('- 用例：解析 3 + 字数 1 + 违禁词 3 + 渲染 3（期望值为手工判定）');
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 确定性回归测试：保证手写解析器与手工判定一致，防止改动后行为漂移；');
lines.push('- 「粘贴到公众号后台的样式保留率」无法自动验证，M2 逐次人工记录；');
lines.push('- 违禁词词典覆盖常见风险词但不完整，体检通过 ≠ 平台不判违规。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 18).join('\n'));
console.log('\n报告已写入 eval/mp-formatter/REPORT.md');
if (pass < results.length) process.exitCode = 1;
