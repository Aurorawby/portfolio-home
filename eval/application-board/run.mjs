/**
 * 投递看板：确定性统计回归评测（不依赖浏览器 / 不调用模型）。
 * 检查：漏斗统计、转化率、跟进提醒触发名单与天数、渠道进面率、死因分布
 * 是否与 cases.json 里手工计算的期望值完全一致（回归测试）。
 *
 * 诚实口径：这是「算术正确性」回归，不是效果评测——提醒阈值（14/7 天）是经验设定。
 *
 * 运行：node eval/application-board/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'application-board', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));
const EXP = CASES.expected;

const code = loadInlineScript(PAGE);
const api = runScript(code, ['funnelStats', 'channelStats', 'causeStats', 'followUps', 'daysBetween', 'STATES']);

const results = [];
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push({ name, ok, got: JSON.stringify(got), want: JSON.stringify(want) });
  return ok;
}

// 1. 漏斗
const f = api.funnelStats(CASES.records);
check('漏斗·各阶段到达数', f.reached, EXP.reached);
check('漏斗·挂 / 无回音', { rejected: f.rejected, ghost: f.ghost }, { rejected: EXP.rejected, ghost: EXP.ghost });
check('漏斗·转化率', f.rates, EXP.rates);

// 2. 跟进提醒：触发名单 + 排序 + 天数
const fu = api.followUps(CASES.records, CASES.today);
check('提醒·触发名单（含排序）', fu.map((x) => x.company), EXP.followUpIds);
check('提醒·停滞天数', Object.fromEntries(fu.map((x) => [x.company, x.days])), EXP.followUpDays);

// 3. 渠道进面率
const ch = api.channelStats(CASES.records);
check('渠道·进面率', Object.fromEntries(Object.keys(EXP.channel).map((k) => [k, {
  total: ch[k]?.total, advanced: ch[k]?.advanced, rate: ch[k]?.rate,
}])), EXP.channel);

// 4. 死因分布
const cs = api.causeStats(CASES.records);
check('死因·分布', cs, EXP.cause);

// 5. daysBetween 边界
check('daysBetween·同日为 0', api.daysBetween('2026-11-03', '2026-11-03'), 0);
check('daysBetween·跨月', api.daysBetween('2026-10-20', '2026-11-03'), 14);

const pass = results.filter((r) => r.ok).length;
const lines = [];
lines.push('# 投递看板 · 确定性统计回归报告');
lines.push('');
lines.push(`- 运行时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}（UTC）`);
lines.push(`- 用例：${CASES.records.length} 条投递记录（today=${CASES.today}，期望值为手工计算）`);
lines.push('');
lines.push('| 检查 | 结果 |');
lines.push('|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? '✅ 一致' : '❌ 不一致'} |`);
lines.push('');
lines.push(`**通过 ${pass}/${results.length}**`);
lines.push('');
lines.push('## 诚实口径');
lines.push('');
lines.push('- 这是确定性计算的**回归测试**：保证漏斗 / 提醒 / 渠道 / 死因统计与手工计算一致，防止改动后算错；');
lines.push('- 不是「提效果」评测：提醒阈值（已投递 >14 天、流程中停 >7 天）是经验设定，依据见 PRD 风险表；');
lines.push('- 渠道进面率的口径（非简历关死亡也算简历过了）是简化假设，见 PRD 局限一节。');
lines.push('');

if (pass < results.length) {
  lines.push('## 不一致明细');
  lines.push('');
  for (const r of results.filter((x) => !x.ok)) {
    lines.push(`- ${r.name}：期望 ${r.want}，实际 ${r.got}`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n'));
console.log(lines.slice(0, 16).join('\n'));
console.log('\n报告已写入 eval/application-board/REPORT.md');
if (pass < results.length) process.exitCode = 1;
