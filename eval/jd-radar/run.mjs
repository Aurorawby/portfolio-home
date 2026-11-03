/**
 * JD 雷达：能力抽取评测（不依赖浏览器 / 不调用模型）。
 * 指标说明：
 *  - 核心能力召回：人工标的"JD 明确要求"里，有多少被词典命中（词典是多标签候选，召回更有意义）；
 *  - Top-5 召回：排在雷达前 5 的能力里，覆盖了多少核心能力（产品上用户真正会看的排序）；
 *  - 命中密度：平均每份 JD 命中多少项能力——密度过高说明词典太宽、需要人工筛。
 *
 * 运行：node eval/jd-radar/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'jd-radar', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['analyzeJD', 'analyzeAll', 'COMPETENCIES', 'GROUPS']);
const byId = new Map(api.COMPETENCIES.map((comp) => [comp.id, comp]));

const rows = [];
let hitSum = 0, expectedSum = 0, top5Sum = 0, top5Den = 0, densitySum = 0;

for (const testCase of CASES.cases) {
  const result = api.analyzeJD(testCase.text);
  const predictions = Object.keys(result.hits)
    .sort((a, b) => result.hits[b] - result.hits[a]);
  const expected = testCase.expected.filter((id) => byId.has(id));
  const hit = expected.filter((id) => result.hits[id]);
  const top5 = predictions.slice(0, 5);
  const top5Hit = expected.filter((id) => top5.includes(id));

  hitSum += hit.length;
  expectedSum += expected.length;
  top5Sum += top5Hit.length;
  top5Den += Math.min(5, expected.length);
  densitySum += predictions.length;

  rows.push({
    id: testCase.id,
    note: testCase.note,
    expected: expected.length,
    hit: hit.length,
    top5: `${top5Hit.length}/${Math.min(5, expected.length)}`,
    density: predictions.length,
    missed: expected.filter((id) => !result.hits[id]),
    top5Names: top5.map((id) => byId.get(id)?.name || id),
  });
}

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const recall = expectedSum ? hitSum / expectedSum : 0;
const top5Recall = top5Den ? top5Sum / top5Den : 0;
const density = rows.length ? densitySum / rows.length : 0;

const lines = [];
lines.push('# JD 雷达 · 能力抽取评测');
lines.push('');
lines.push(`- 用例数：**${CASES.cases.length}** 份 JD（人工标注：只标「明确要求」的核心能力）`);
lines.push('- 评测方式：Node 沙箱直接调用页面里的 `analyzeJD`，不经过浏览器、不调用模型');
lines.push(`- 能力词典：${api.COMPETENCIES.length} 项 / ${api.GROUPS.length} 组`);
lines.push('');
lines.push('## 总体结果');
lines.push('');
lines.push('| 指标 | 数值 | 说明 |');
lines.push('|---|---|---|');
lines.push(`| 核心能力召回率 | **${pct(recall)}** | 人工标注的核心能力里，被词典命中的比例（${hitSum}/${expectedSum}） |`);
lines.push(`| Top-5 召回率 | **${pct(top5Recall)}** | 雷达排序前 5 的能力覆盖了多少核心能力（${top5Sum}/${top5Den}） |`);
lines.push(`| 命中密度 | **${density.toFixed(1)} 项/份** | 每份 JD 平均命中多少能力；越接近人工标注数越干净 |`);
lines.push('');
lines.push('> 为什么不做「精确率」：词典是多标签候选，同一段 JD 里"相关但没被写成硬性要求"的能力也会命中；');
lines.push('> 逐条判断 150+ 个候选是否算误判成本很高。所以这里用召回 + Top-5 + 密度来描述，');
lines.push('> 精确率留到下一步做人工标注再补——**不编一个看起来漂亮的数字**。');
lines.push('');
lines.push('## 逐份 JD');
lines.push('');
lines.push('| JD | 场景 | 标注核心 | 命中 | Top-5 命中 | 命中密度 |');
lines.push('|---|---|---|---|---|---|');
rows.forEach((row) => {
  lines.push(`| ${row.id} | ${row.note} | ${row.expected} | ${row.hit} | ${row.top5} | ${row.density} |`);
});
lines.push('');
lines.push('## 漏命中明细（召回缺口）');
lines.push('');
let missedAll = false;
rows.forEach((row) => {
  row.missed.forEach((id) => {
    missedAll = true;
    lines.push(`- ${row.id} 漏：**${byId.get(id)?.name || id}**`);
  });
});
if (!missedAll) lines.push('- 无');
lines.push('');
lines.push('## 雷达 Top-5 长什么样（抽 3 份）');
lines.push('');
rows.slice(0, 3).forEach((row) => {
  lines.push(`- **${row.id}**：${row.top5Names.join('、')}`);
});
lines.push('');
lines.push('## 已知局限');
lines.push('');
lines.push('1. 词典是人工写的 72 项，覆盖不了所有新兴能力词（页面会列出未识别高频词，欢迎补词）；');
lines.push('2. 标注只有 10 份 JD、单人完成；核心能力的界定本身有主观性；');
lines.push('3. 没有做精确率标注（原因见上），因此不能宣称"识别准确率"；');
lines.push('4. 词面匹配（同义词表）识别不了"换个说法的同一能力"，例如"用户视角"未必命中用户研究。');
lines.push('');
lines.push('## 怎么复现');
lines.push('');
lines.push('```bash');
lines.push('node eval/jd-radar/run.mjs');
lines.push('```');
lines.push('');
lines.push('## 下一步');
lines.push('');
lines.push('- 扩到 30 份 JD，补精确率标注（2 人交叉）；');
lines.push('- 用未识别词 + 人工反馈补词典（把"补词"做成产品功能）；');
lines.push('- 给每个能力加权重：区分"硬性要求 / 加分项 / 职责描述"，现在这三类被同等对待。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(`核心能力召回=${pct(recall)} Top-5召回=${pct(top5Recall)} 命中密度=${density.toFixed(1)} 项/份（n=${CASES.cases.length}）`);
console.log('报告已写入 eval/jd-radar/REPORT.md');
