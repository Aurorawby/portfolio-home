/**
 * 内容工作台：周简报引擎确定性回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：漏斗统计、类型聚合、建议触发（空/样本不足/样本足够）、简报警告是否与手工计算一致。
 *
 * 运行：node eval/content-workbench/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'content-workbench', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));
const EXP = CASES.expected;

const code = loadInlineScript(PAGE);
const api = runScript(code, ['funnel2', 'anglePerf', 'angleAdvice', 'generateBriefing']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: ok ? '' : detail });
}

// 1. 漏斗
const f = api.funnel2(CASES.pool_demo, CASES.plan_demo);
check('漏斗·五段统计', JSON.stringify(f) === JSON.stringify(EXP.funnel), `期望 ${JSON.stringify(EXP.funnel)}，实际 ${JSON.stringify(f)}`);

// 2. 类型聚合
const by = api.anglePerf(CASES.plan_demo);
let aggOk = true, aggDetail = '';
for (const k of Object.keys(EXP.anglePerf)) {
  const got = by[k];
  const want = EXP.anglePerf[k];
  if (!got || got.n !== want.n || got.avgViews !== want.avgViews || got.avgLikes !== want.avgLikes) {
    aggOk = false;
    aggDetail += `${k}: 期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(got || null)}；`;
  }
}
check('类型聚合·平均阅读/点赞', aggOk, aggDetail);

// 3. 建议：样本不足 / 样本足够
const nodata = api.angleAdvice({ '类型A': { n: 1, avgViews: 100 }, '类型B': { n: 2, avgViews: 90 } });
check('建议·样本不足时不下结论', nodata.level === 'nodata' && nodata.text.includes(EXP.advice_nodata),
  `实际 level=${nodata.level}，text=${nodata.text}`);
const okCase = api.angleAdvice(by);
check('建议·样本足够时给推荐', okCase.level === 'ok' && EXP.advice_ok_contains.every((kw) => okCase.text.includes(kw)),
  `实际 ${JSON.stringify(okCase)}`);

// 4. 简报警告
for (const c of CASES.brief_cases) {
  const pool = c.pool === 'pool_demo' ? CASES.pool_demo : (c.pool === 'pool_empty' ? CASES.pool_empty : c.pool);
  const plan = c.plan === 'plan_demo' ? CASES.plan_demo : (c.plan === 'pool_empty' ? [] : c.plan);
  const b = api.generateBriefing(pool, plan, '2026-11-05');
  const hit = b.warnings.some((w) => w.text.includes(c.expectContains));
  check(`简报·${c.id}`, hit, hit ? `命中「${c.expectContains}」` : `未命中，实际：${b.warnings.map((w) => w.text).join(' / ')}`);
}

// 5. 空计划 + 非空池：行动清单含导入建议
const b5 = api.generateBriefing(CASES.pool_demo, [], '2026-11-05');
check('简报·空计划给导入建议', b5.actions.some((a) => a.includes('导入')), b5.actions.join(' / '));

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 内容工作台 · 周简报引擎回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push('- 用例：漏斗 / 类型聚合 / 建议三态 / 简报警告 / 行动清单（期望值为手工计算）');
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 确定性回归测试：保证简报引擎与手工计算一致，防止改动后行为漂移；');
lines.push('- 类型建议的「样本 ≥3」门槛是产品规则（统计上仍偏小），门槛本身即产品教育；');
lines.push('- 演示数据中的阅读量为编造示例，真实结论需真实数据。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 18).join('\n'));
console.log('\n报告已写入 eval/content-workbench/REPORT.md');
if (pass < results.length) process.exitCode = 1;
