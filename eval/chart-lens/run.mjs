/**
 * 图表解读器：数字解读引擎回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：calcDelta 数值、deltaNotes 陷阱提示触发、cvCheck 分级是否与手工计算一致（回归测试）。
 *
 * 诚实口径：只评测规则引擎；AI 读图不做质量宣称（页面持续提示对照原图）。
 *
 * 运行：node eval/chart-lens/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'chart-lens', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['calcDelta', 'deltaNotes', 'cvCheck', 'CHART_CHECKLIST']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: ok ? '' : detail });
}

// 1. calcDelta 数值
for (const c of CASES.delta) {
  const got = api.calcDelta(c.a, c.b);
  const ok = c.expect === null
    ? got === null
    : got !== null && got.abs === c.expect.abs && got.rel === c.expect.rel && got.times === c.expect.times;
  check(`数字计算·${c.id}`, ok, `期望 ${JSON.stringify(c.expect)}，实际 ${JSON.stringify(got)}`);
}

// 2. deltaNotes 陷阱提示
for (const c of CASES.deltaNotes) {
  const r = api.deltaNotes(c.a, c.b, c.unit);
  const all = r.notes.join(' / ');
  const missing = c.expectContains.filter((kw) => !r.notes.some((n) => n.includes(kw)));
  check(`陷阱提示·${c.id}`, missing.length === 0, missing.length ? `未命中：${missing.join('、')}，实际：${all}` : `命中 ${c.expectContains.join('、')}`);
}

// 3. cvCheck 分级
for (const c of CASES.cv) {
  const r = api.cvCheck(c.mean, c.sd, c.n === null ? NaN : c.n);
  const missing = c.expectContains.filter((kw) => !r.notes.some((n) => n.includes(kw)));
  check(`均值代表性·${c.id}（CV=${c.expectCv}）`, r.cv === c.expectCv && missing.length === 0,
    missing.length ? `CV 期望 ${c.expectCv} 实际 ${r.cv}；未命中：${missing.join('、')}` : `CV=${r.cv}，分级全部命中`);
}

// 4. 清单完整性：5 种图类型 × ≥4 条
const listOk = api.CHART_CHECKLIST.length === 5 && api.CHART_CHECKLIST.every((c) => c.items.length >= 4);
check('看图清单·5 类 × ≥4 条', listOk, JSON.stringify(api.CHART_CHECKLIST.map((c) => `${c.type}:${c.items.length}`)));

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 图表解读器 · 数字解读引擎回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：数字计算 ${CASES.delta.length} + 陷阱提示 ${CASES.deltaNotes.length} + 均值代表性 ${CASES.cv.length} + 清单完整性 1（期望值为手工计算）`);
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 本评测只覆盖规则引擎（数字计算 / 陷阱提示 / 清单）；**AI 读图不做质量宣称**——');
lines.push('  视觉模型可能看错数字，产品页面持续提示对照原图核对；');
lines.push('- 陷阱识别阈值（相对变化 ≥100% 且绝对差 ≤10 触发基数陷阱提醒）是经验值，见 PRD 局限一节。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 14).join('\n'));
console.log('\n报告已写入 eval/chart-lens/REPORT.md');
if (pass < results.length) process.exitCode = 1;
