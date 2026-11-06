/**
 * 行程一页纸：攻略解析与诊断回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：解析（天数/条目/类型/花费）、诊断触发是否与手工标注一致（回归测试）。
 *
 * 运行：node eval/trip-onepager/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'trip-onepager', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['parseGuide', 'organizeAndDiagnose', 'classifyType', 'TYPE_META']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: ok ? '' : detail });
}

// 1. 解析 + 诊断（p1 全字段断言）
for (const c of CASES.parse) {
  const parsed = api.parseGuide(c.md, c.days);
  const stats = api.organizeAndDiagnose(parsed, c.days);
  const e = c.expect;
  let ok = parsed.days.length === e.dayCount;
  let detail = ok ? '' : `天数期望 ${e.dayCount}，实际 ${parsed.days.length}`;

  if (ok && e.day1) {
    const d1 = parsed.days.find((d) => d.day === 1);
    const counts = { attraction: 0, meal: 0, stay: 0, transport: 0, other: 0 };
    let cost = 0;
    d1.items.forEach((it) => { counts[it.type] += 1; cost += it.cost || 0; });
    ok = d1.items.length === e.day1.n && counts.attraction === e.day1.attraction
      && counts.meal === e.day1.meal && counts.stay === e.day1.stay
      && cost === e.day1.cost && d1.items[0].notes[0] === e.day1.firstNote;
    if (!ok) detail = `Day1 实际 n=${d1.items.length} ${JSON.stringify(counts)} cost=${cost} note=${d1.items[0]?.notes[0]}`;
  }
  if (ok && e.day2) {
    const d2 = parsed.days.find((d) => d.day === 2);
    const counts = { attraction: 0, meal: 0, stay: 0, transport: 0, other: 0 };
    let cost = 0;
    d2.items.forEach((it) => { counts[it.type] += 1; cost += it.cost || 0; });
    ok = d2.items.length === e.day2.n && counts.attraction === e.day2.attraction
      && counts.meal === e.day2.meal && counts.other === e.day2.other && cost === e.day2.cost;
    if (!ok) detail = `Day2 实际 n=${d2.items.length} ${JSON.stringify(counts)} cost=${cost}`;
  }
  if (ok && e.totalCost !== undefined) {
    ok = stats.totalCost === e.totalCost;
    if (!ok) detail = `总花费期望 ${e.totalCost}，实际 ${stats.totalCost}`;
  }
  if (ok && e.diagCount !== undefined) {
    ok = stats.diags.length === e.diagCount && stats.diags[0].text.includes(e.diagContains);
    if (!ok) detail = `诊断期望 ${e.diagCount} 条含「${e.diagContains}」，实际：${stats.diags.map((d) => d.text).join(' / ')}`;
  }
  check(`解析·${c.id}（${c.note}）`, ok, detail);
}

// 2. 诊断触发
for (const c of CASES.diagnose) {
  const parsed = api.parseGuide(c.md, c.days);
  const stats = api.organizeAndDiagnose(parsed, c.days);
  const missing = c.expect.filter((x) => !stats.diags.some((d) => d.level === x.level && d.text.includes(x.contains)));
  check(`诊断·${c.id}（${c.note}）`, missing.length === 0,
    missing.length ? `未命中：${missing.map((x) => x.contains).join('、')}，实际：${stats.diags.map((d) => d.level + ' ' + d.text).join(' / ')}` : '全部命中');
}

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 行程一页纸 · 解析与诊断回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：解析 ${CASES.parse.length} + 诊断 ${CASES.diagnose.length}（期望值为手工标注）`);
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 确定性回归测试：保证解析与诊断代码与手工标注一致，防止改动后行为漂移；');
lines.push('- 解析器认不全的行会进「其他」或不挂靠（不丢已识别内容），边界见 PRD 局限；');
lines.push('- 诊断阈值（≥4 景点偏满）是通用经验值，不是标准。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 18).join('\n'));
console.log('\n报告已写入 eval/trip-onepager/REPORT.md');
if (pass < results.length) process.exitCode = 1;
