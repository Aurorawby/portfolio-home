/**
 * 吃什么决策器：过滤与加权排序回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：硬约束过滤（含被拒原因）、加权排序（含 tie-break）、winner/why 是否与手工计算一致（回归测试）。
 * 天意模式是随机过程，不进回归（非确定过程无法断言）。
 *
 * 运行：node eval/food-picker/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'food-picker', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));
const EXP = CASES.expected;

const code = loadInlineScript(PAGE);
const api = runScript(code, ['filterByConstraints', 'scoreAll', 'decide', 'whyText', 'DIM_NAMES']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: ok ? '' : detail });
}

// 1. 硬约束过滤
const f = api.filterByConstraints(CASES.candidates, CASES.constraints);
check('过滤·通过名单', JSON.stringify(f.pass.map((x) => x.name)) === JSON.stringify(EXP.passNames),
  `期望 ${JSON.stringify(EXP.passNames)}，实际 ${JSON.stringify(f.pass.map((x) => x.name))}`);
check('过滤·被拒名单', JSON.stringify(f.rejected.map((x) => x.name)) === JSON.stringify(EXP.rejectedNames),
  `期望 ${JSON.stringify(EXP.rejectedNames)}，实际 ${JSON.stringify(f.rejected.map((x) => x.name))}`);
let reasonOk = true, reasonDetail = '';
for (const r of f.rejected) {
  const want = EXP.rejectedReasonContains[r.name];
  if (!want || !r.reason.includes(want)) { reasonOk = false; reasonDetail += `${r.name}: 期望含「${want}」，实际「${r.reason}」；`; }
}
check('过滤·被拒原因', reasonOk, reasonDetail);

// 2. 加权排序（含 tie-break 次序）
const ranked = api.scoreAll(f.pass, CASES.weights);
check('排序·次序', JSON.stringify(ranked.map((x) => x.name)) === JSON.stringify(EXP.rankedNames),
  `期望 ${JSON.stringify(EXP.rankedNames)}，实际 ${JSON.stringify(ranked.map((x) => x.name))}`);
check('排序·总分', JSON.stringify(ranked.map((x) => x.total)) === JSON.stringify(EXP.rankedTotals),
  `期望 ${JSON.stringify(EXP.rankedTotals)}，实际 ${JSON.stringify(ranked.map((x) => x.total))}`);

// 3. decide + why
const dec = api.decide(CASES.candidates, CASES.constraints, CASES.weights);
check('决策·winner', dec.winner && dec.winner.name === EXP.winnerName,
  `期望 ${EXP.winnerName}，实际 ${dec.winner ? dec.winner.name : 'null'}`);
const why = api.whyText(dec.winner);
check('决策·why 可解释', EXP.whyContains.every((kw) => why.includes(kw)),
  why);

// 4. 边界：全被筛掉
const decAll = api.decide(CASES.candidates, { budgetMax: CASES.edge.all_rejected_budget, avoidTags: [], distMin: 0 }, CASES.weights);
check('边界·全被筛掉返回 winner=null', decAll.winner === null && decAll.ranked.length === 0,
  `实际 winner=${JSON.stringify(decAll.winner)}`);

// 5. 边界：权重全 0（归一化兜底为等权，不崩溃且有排序）
const rz = api.scoreAll(CASES.candidates, CASES.edge.zero_weights);
check('边界·权重全 0 兜底等权', rz.length === CASES.candidates.length && rz.every((x) => x.total > 0),
  `实际 ${JSON.stringify(rz.map((x) => x.total))}`);

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 吃什么决策器 · 过滤与排序回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：过滤 3 + 排序 2 + 决策 2（期望值为手工计算，权重归一化 sum=8）`);
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 确定性回归测试：保证过滤与排序代码与手工计算一致（含 tie-break：并列时「不排队」优先的固定次序）；');
lines.push('- 天意模式是随机过程，不进回归；评分是用户主观输入，工具的价值是结构化对比，不是替你了解口味；');
lines.push('- 忌口是子串匹配，「不辣」含「辣」的语义问题由用户标签粒度自行控制（见 PRD 局限）。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 18).join('\n'));
console.log('\n报告已写入 eval/food-picker/REPORT.md');
if (pass < results.length) process.exitCode = 1;
