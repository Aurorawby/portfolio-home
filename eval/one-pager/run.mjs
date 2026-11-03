/**
 * 汇报一页纸：大纲解析与结构诊断回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：解析（板块数 / 要点数 / 数字计数）与诊断触发是否与手工标注一致（回归测试）。
 *
 * 运行：node eval/one-pager/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'one-pager', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['parseOutline', 'diagnoseOutline']);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
}

// 1. 解析
for (const c of CASES.parse) {
  const p = api.parseOutline(c.text);
  const got = { sectionCount: p.sections.length, bulletCount: p.bulletCount, numberCount: p.numberCount };
  check(`解析·${c.id}（${c.note}）`, JSON.stringify(got) === JSON.stringify(c.expect), `期望 ${JSON.stringify(c.expect)}，实际 ${JSON.stringify(got)}`);
}

// 2. 诊断触发
for (const c of CASES.diagnose) {
  const parsed = api.parseOutline(c.text);
  const tips = api.diagnoseOutline(parsed, c.goal);
  const hit = tips.some((t) => t.text.includes(c.expectTipContains));
  check(`诊断·${c.id}（${c.note}）`, hit, hit ? `命中「${c.expectTipContains}」` : `未命中「${c.expectTipContains}」，实际：${tips.map((t) => t.text).join(' / ')}`);
}

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 汇报一页纸 · 大纲解析与诊断回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：解析 ${CASES.parse.length} 组 + 诊断 ${CASES.diagnose.length} 组（期望值为手工判定）`);
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ ' + r.detail} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 这是确定性回归测试：保证解析与诊断代码与手工判定一致，防止改动后行为漂移；');
lines.push('- 结构诊断是启发式规则（建议语气），不是「保证汇报通过」，见 PRD 局限一节。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 12).join('\n'));
console.log('\n报告已写入 eval/one-pager/REPORT.md');
if (pass < results.length) process.exitCode = 1;
