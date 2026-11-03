/**
 * 选题雷达：规则打分引擎评测（不依赖浏览器 / 不调用模型）。
 * 指标说明：
 *  - 高分命中率：人工标 good 的标题里，引擎给到 ≥阈值（35 分）的比例；
 *  - 低分命中率：人工标 weak 的标题里，引擎压在阈值以下的比例；
 *  - 区分度：good 均分 − weak 均分，反映引擎能不能把两类标题拉开。
 *
 * 效度声明：标注与规则出自同一作者（同源风险），n=16 偏小；
 * 指标只说明「规则与人工直觉的方向一致性」，不说明「能预测流量」。
 *
 * 运行：node eval/topic-radar/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'topic-radar', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));
const TH = CASES.threshold;

const code = loadInlineScript(PAGE);
const api = runScript(code, ['scoreTitle', 'SCORE_DIMS', 'DEMO_ITEMS', 'ANGLE_NAMES', 'buildSystemPrompt', 'extractJson']);

const rows = CASES.cases.map((c) => {
  const s = api.scoreTitle(c.title);
  return { ...c, total: s._total, dims: api.SCORE_DIMS.map((d) => `${d.name}${s[d.id]}`).join(' ') };
});

const good = rows.filter((r) => r.label === 'good');
const weak = rows.filter((r) => r.label === 'weak');
const goodHit = good.filter((r) => r.total >= TH);
const weakHit = weak.filter((r) => r.total < TH);
const avg = (list) => list.reduce((sum, r) => sum + r.total, 0) / (list.length || 1);
const gap = avg(good) - avg(weak);

// 演示数据一致性检查：demo 标题也应该是 good 级（≥阈值），否则首页演示会自打脸
const demoLow = api.DEMO_ITEMS.map((item) => ({ title: item.title, total: api.scoreTitle(item.title)._total }))
  .filter((x) => x.total < TH);

const lines = [];
lines.push('# 选题雷达 · 规则打分引擎评测报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：${rows.length} 条（good ${good.length} / weak ${weak.length}），阈值 ${TH} 分`);
lines.push('');
lines.push('| 指标 | 数值 |');
lines.push('|---|---|');
lines.push(`| 高分命中率（good ≥ ${TH}） | ${(goodHit.length / good.length * 100).toFixed(1)}%（${goodHit.length}/${good.length}） |`);
lines.push(`| 低分命中率（weak < ${TH}） | ${(weakHit.length / weak.length * 100).toFixed(1)}%（${weakHit.length}/${weak.length}） |`);
lines.push(`| good 均分 | ${avg(good).toFixed(1)} |`);
lines.push(`| weak 均分 | ${avg(weak).toFixed(1)} |`);
lines.push(`| 区分度（good − weak） | ${gap.toFixed(1)} 分 |`);
lines.push(`| 演示数据一致性 | ${demoLow.length === 0 ? '8/8 全部 ≥ 阈值' : '有 ' + demoLow.length + ' 条低于阈值（见下）'} |`);
lines.push('');
lines.push('## 逐条明细');
lines.push('');
lines.push('| id | 标注 | 分 | 六维 | 标题 |');
lines.push('|---|---|---|---|---|');
for (const r of rows) lines.push(`| ${r.id} | ${r.label} | ${r.total} | ${r.dims} | ${r.title} |`);
if (demoLow.length) {
  lines.push('');
  lines.push('## 演示数据低于阈值的条目');
  lines.push('');
  for (const d of demoLow) lines.push(`- ${d.total} 分：${d.title}`);
}
lines.push('');
lines.push('## 效度声明');
lines.push('');
lines.push('- 标注（这个标题会不会被点开）与规则引擎（六维词典特征）出自同一作者，存在**同源风险**；');
lines.push('- n=16 偏小，结果只说明「规则与人工直觉的方向一致性」，**不说明能预测流量**；');
lines.push('- 引擎报告的是标题特征是否存在，两维全 0 的好标题理论上存在（如纯悬念式），属于已知边界。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 12).join('\n'));
console.log('\n报告已写入 eval/topic-radar/REPORT.md');

if (goodHit.length < good.length || weakHit.length < weak.length || demoLow.length) {
  console.log('\n存在未达标条目，详见 REPORT.md');
  process.exitCode = 1;
}
