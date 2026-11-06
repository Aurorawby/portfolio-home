/**
 * 图文工作室：脚本校验引擎回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：基线示例必须 100% 过自家体检；4 个变异体各自触发对应 issue（回归测试）。
 *
 * 运行：node eval/xhs-studio/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'xhs-studio', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['validateScript', 'checkRisks', 'FORMS']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: ok ? '' : detail });
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// 1. 基线：精写示例必须 100% 过自家体检（工具公信力的底线）
const base = api.validateScript(CASES.baseline.script, CASES.baseline.form);
check('基线·示例 100% 过自家体检', base.completeness === CASES.baseline.expect.completeness && base.issues.length === CASES.baseline.expect.issueCount,
  `期望 ${CASES.baseline.expect.completeness}%/${CASES.baseline.expect.issueCount} issues，实际 ${base.completeness}%，issues: ${base.issues.map((x) => x.text).join(' / ') || '无'}`);

// 2. 变异体
for (const m of CASES.mutants) {
  const script = clone(CASES.baseline.script);
  if (m.mutate === 'pages_to_3') script.pages = script.pages.slice(0, 3);
  if (m.mutate === 'cover_long') script.cover = script.cover + '，这是全网最全的互联网嘴替合集大全';
  if (m.mutate === 'body_risk') script.body = script.body + ' 这是全网最强的反内耗工具。';
  if (m.mutate === 'publish_null') script.publish = null;
  const v = api.validateScript(script, CASES.baseline.form);
  const hit = v.issues.some((x) => x.level === m.expectLevel && x.text.includes(m.expectContains));
  check(`变异·${m.id}（${m.note}）`, hit,
    hit ? `命中「${m.expectContains}」` : `未命中「${m.expectContains}」（${m.expectLevel}），实际：${v.issues.map((x) => x.level + ' ' + x.text).join(' / ') || '无 issue'}`);
}

// 3. 形态 schema 差异：bot 与 must_see 的内页数量区间不同
const botMin = api.FORMS.bot.pages.min, msMin = api.FORMS.must_see.pages.min;
check('形态·schema 区分度（bot min=5, must_see min=4）', botMin === 5 && msMin === 4,
  `bot min=${botMin}，must_see min=${msMin}`);

// 4. 红线声明存在（自动发布禁令常驻页面）
const hasRedLine = /自动发布|自动化发布/.test(fs.readFileSync(PAGE, 'utf8'));
check('红线·不做自动发布声明常驻', hasRedLine, '页面缺少自动发布禁令声明');

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 图文工作室 · 脚本校验引擎回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：基线 1（必须满分）+ 变异体 ${CASES.mutants.length} + schema 区分度 + 红线声明`);
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 确定性回归测试：保证校验引擎与手工判定一致；基线示例必须满分——示例不过自家体检即工具失信；');
lines.push('- 形态模板是结构沉淀，不构成「必爆」保证；');
lines.push('- **本产品不做自动发布、不抓平台数据**（小红书无发布 API，自动化违反用户协议）——红线常驻页面与 PRD。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 18).join('\n'));
console.log('\n报告已写入 eval/xhs-studio/REPORT.md');
if (pass < results.length) process.exitCode = 1;
