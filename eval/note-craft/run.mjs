/**
 * 笔记工坊：违禁词体检评测（不依赖浏览器 / 不调用模型）。
 * 指标：
 *  - 违禁召回：标注的每处风险词被引擎命中的比例（逐词计）；
 *  - 误报率：干净样本（含「第一次」「最近」等易误伤表达）被判违规的比例；
 *  - 演示笔记体检：装载 demo 应命中埋入的风险词。
 *
 * 效度声明：标注与词典出自同一作者（同源风险，n=19）；词典刻意「宁少抓、不误伤」，
 * 指标只说明「词典与人工标注的一致性」，不说明「平台不会判违规」。
 *
 * 运行：node eval/note-craft/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'note-craft', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['checkCompliance', 'countStats', 'RISK_CATS', 'STRUCTURES', 'DEMO']);

// 1. 违禁召回（逐词）
let expectTotal = 0, hitTotal = 0;
const missRows = [];
for (const c of CASES.violation) {
  const got = new Set(api.checkCompliance(c.text).violations.map((v) => v.word));
  for (const w of c.expect) {
    expectTotal += 1;
    if (got.has(w)) hitTotal += 1;
    else missRows.push(`${c.id}「${c.text}」漏了「${w}」`);
  }
}
const recall = expectTotal ? hitTotal / expectTotal : 0;

// 2. 误报率（干净样本）
const falsePos = [];
for (const c of CASES.clean) {
  const r = api.checkCompliance(c.text);
  if (!r.clean) falsePos.push(`${c.id}「${c.text}」被误报：${r.violations.map((v) => v.word).join('、')}`);
}
const fpRate = CASES.clean.length ? falsePos.length / CASES.clean.length : 0;

// 3. 演示笔记体检（埋入的典型风险词应全部命中）
const demoHits = new Set(api.checkCompliance(api.DEMO.body + api.DEMO.titles.join('')).violations.map((v) => v.word));
const demoExpect = ['全网最', '绝对', '私信我'];
const demoMiss = demoExpect.filter((w) => !demoHits.has(w));

const lines = [];
lines.push('# 笔记工坊 · 违禁词体检评测报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：违禁样本 ${CASES.violation.length} 条（标注风险词 ${expectTotal} 处）+ 干净样本 ${CASES.clean.length} 条`);
lines.push('');
lines.push('| 指标 | 数值 |');
lines.push('|---|---|');
lines.push(`| 违禁词召回（逐词） | ${(recall * 100).toFixed(1)}%（${hitTotal}/${expectTotal}） |`);
lines.push(`| 干净样本误报率 | ${(fpRate * 100).toFixed(1)}%（${falsePos.length}/${CASES.clean.length}） |`);
lines.push(`| 演示笔记体检 | ${demoMiss.length === 0 ? `命中 ${demoExpect.length}/${demoExpect.length}（含建议）` : '漏判：' + demoMiss.join('、')} |`);
lines.push(`| 风险词典规模 | ${api.RISK_CATS.reduce((s, g) => s + g.words.length, 0)} 词 / ${api.RISK_CATS.length} 类 |`);
lines.push('');
lines.push('## 逐条明细（违禁样本）');
lines.push('');
lines.push('| id | 文本 | 期望命中 | 实际命中 |');
lines.push('|---|---|---|---|');
for (const c of CASES.violation) {
  const got = api.checkCompliance(c.text).violations.map((v) => v.word);
  const ok = c.expect.every((w) => got.includes(w)) && got.every((w) => c.expect.includes(w));
  lines.push(`| ${c.id} | ${c.text} | ${c.expect.join('、') || '—'} | ${got.join('、') || '—'} ${ok ? '' : '⚠️'} |`);
}
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 标注与词典出自同一作者（同源风险，n=19），指标只说明「词典与人工标注的一致性」；');
lines.push('- 词典刻意「宁少抓、不误伤」：召回不是 100% 的世界覆盖率，误报 0 是设计目标而非平台背书；');
lines.push('- **体检通过 ≠ 平台不判违规**——平台规则不公开且随时更新，发布前人工判断是最后一道关。');
lines.push('');

if (missRows.length) { lines.push('## 漏判明细'); lines.push(''); missRows.forEach((x) => lines.push('- ' + x)); lines.push(''); }
if (falsePos.length) { lines.push('## 误报明细'); lines.push(''); falsePos.forEach((x) => lines.push('- ' + x)); lines.push(''); }

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 14).join('\n'));
console.log('\n报告已写入 eval/note-craft/REPORT.md');

if (recall < 1 || fpRate > 0 || demoMiss.length) process.exitCode = 1;
