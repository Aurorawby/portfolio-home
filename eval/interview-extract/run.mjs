/**
 * 面试复盘器：规则层抽取评测（不依赖浏览器 / 不调用模型）。
 * 运行：node eval/interview-extract/run.mjs                     # 开发集
 *       node eval/interview-extract/run.mjs cases-holdout.json  # 留出集
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bigramSimilarity, loadInlineScript, matchQuestions, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'interview-review', 'index.html');

const CASES_FILE = process.argv[2] || 'cases.json';
const IS_HOLDOUT = CASES_FILE.includes('holdout');
const REPORT_NAME = IS_HOLDOUT ? 'REPORT-holdout.md' : 'REPORT.md';
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, CASES_FILE), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['extractQuestions', 'classify']);

const rows = [];
let tp = 0, fn = 0, fp = 0, correctType = 0, matchedCount = 0;
const confusions = [];

for (const testCase of CASES.cases) {
  const got = api.extractQuestions(testCase.text);
  const { matched } = matchQuestions(got, testCase.expected);
  const hit = matched.filter((item) => item.expected);
  const missed = testCase.expected.filter((item) => !hit.some((m) => m.expected.q === item.q));
  const extra = matched.filter((item) => !item.expected);

  tp += hit.length;
  fn += missed.length;
  fp += extra.length;

  hit.forEach((item) => {
    matchedCount += 1;
    const predicted = api.classify(item.got);
    if (predicted === item.expected.type) correctType += 1;
    else confusions.push({ q: item.expected.q, expected: item.expected.type, predicted });
  });

  rows.push({
    id: testCase.id,
    note: testCase.note,
    expected: testCase.expected.length,
    got: got.length,
    hit: hit.length,
    missed: missed.map((item) => item.q),
    extra: extra.map((item) => item.got),
  });
}

const precision = tp + fp ? tp / (tp + fp) : 0;
const recall = tp + fn ? tp / (tp + fn) : 0;
const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
const typeAcc = matchedCount ? correctType / matchedCount : 0;

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const lines = [];
lines.push(`# 面试复盘器 · 规则层抽取评测${IS_HOLDOUT ? '（留出集）' : '（开发集）'}`);
lines.push('');
lines.push(`- 数据集：**${IS_HOLDOUT ? '留出集：规则调整时没有看过，用于检验是否过拟合' : '开发集：规则迭代时看过，存在过拟合风险'}**，${CASES.cases.length} 条用例 / ${CASES.cases.reduce((sum, item) => sum + item.expected.length, 0)} 道标注题目`);
lines.push('- 评测方式：把页面里的内联 JS 放进 Node 沙箱（DOM 桩）直接调用 `extractQuestions` / `classify`，不经过浏览器、不调用模型');
lines.push('- 匹配口径：中文 bigram 相似度 ≥ 0.5 视为同一道题，再人工抽查');
if (!IS_HOLDOUT) {
  lines.push('- 迭代记录：初版召回 **85.2%** → 补充「无问号句」补召回规则 → 同一开发集 **100%**（因此必须看留出集，见 `REPORT-holdout.md`）');
}
lines.push('');
lines.push('## 总体结果');
lines.push('');
lines.push('| 指标 | 数值 | 说明 |');
lines.push('|---|---|---|');
lines.push(`| 抽取精确率 Precision | **${pct(precision)}** | 提取出的题目里，有多少是真问题 |`);
lines.push(`| 抽取召回率 Recall | **${pct(recall)}** | 真问题里，有多少被提取出来 |`);
lines.push(`| F1 | **${pct(f1)}** | 精确率与召回率的调和平均 |`);
lines.push(`| 分类准确率 | **${pct(typeAcc)}** | 在命中的题目上，题型判断正确的比例（共 ${matchedCount} 题） |`);
lines.push('');
lines.push('## 逐用例结果');
lines.push('');
lines.push('| 用例 | 场景 | 应提取 | 实提取 | 命中 | 漏提 | 多提 |');
lines.push('|---|---|---|---|---|---|---|');
rows.forEach((row) => {
  lines.push(`| ${row.id} | ${row.note} | ${row.expected} | ${row.got} | ${row.hit} | ${row.missed.length} | ${row.extra.length} |`);
});
lines.push('');
lines.push('## 漏提 / 多提明细');
lines.push('');
let hasIssue = false;
rows.forEach((row) => {
  row.missed.forEach((q) => { hasIssue = true; lines.push(`- ❌ 漏提（${row.id}）：${q}`); });
  row.extra.forEach((q) => { hasIssue = true; lines.push(`- ⚠️ 多提（${row.id}）：${q}`); });
});
if (!hasIssue) lines.push('- 无');
lines.push('');
lines.push('## 分类混淆（命中但题型判错）');
lines.push('');
if (!confusions.length) {
  lines.push('- 无');
} else {
  const groups = new Map();
  confusions.forEach((item) => {
    const key = `${item.expected} → ${item.predicted}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item.q);
  });
  groups.forEach((questions, key) => {
    lines.push(`- **${key}**（${questions.length} 题）：${questions.slice(0, 2).join('；')}`);
  });
}
lines.push('');
lines.push('## 已知局限（诚实说明）');
lines.push('');
if (IS_HOLDOUT) {
  lines.push('1. 留出集只有 4 条、单人标注，只能看方向，不能当准确率；');
  lines.push('2. 题型标注本身有主观性（例如「你觉得 AI 产品最难的是什么」算 AI 认知还是开放问题），已尽量按"主要考察点"归类；');
  lines.push('3. 规则层对超长句、错别字、口语省略仍然脆弱；下一步要扩到 30-50 条真实面经。');
} else {
  lines.push('1. **这 8 条用例参与过规则调整，100% 不代表真实场景表现**——请以留出集 `REPORT-holdout.md` 为准；');
  lines.push('2. 无问号陈述句现在靠「请求动词 / 疑问词 / 语气词」兜底，真实文本里可能误提陈述句（本次开发集没暴露）；');
  lines.push('3. 超过 200 字的长问题会被过滤，复杂场景题可能整条丢失；');
  lines.push('4. 分类靠关键词规则，题型标注本身有主观性；样例规模小，不做显著性结论。');
}
lines.push('');
lines.push('## 怎么复现');
lines.push('');
lines.push('```bash');
lines.push('node eval/interview-extract/run.mjs');
lines.push(IS_HOLDOUT ? 'node eval/interview-extract/run.mjs cases-holdout.json' : 'node eval/interview-extract/run.mjs cases-holdout.json   # 留出集');
lines.push('```');
lines.push('');
lines.push('## 下一步（如果继续做）');
lines.push('');
lines.push('- 用 `?` 缺失检测 + 疑问词表（吗/呢/吧/如何/是否）补召回，跑同一套用例看提升；');
lines.push('- 把 8 条扩到 30-50 条真实面经，做别名标注（同一题的多种说法）；');
lines.push('- 分类从关键词规则升级为「规则 + 小模型」两阶段，规则兜底可解释；');
lines.push('- 页面里加一个开关：把漏提的候选句子列出来，让用户一键补录（把召回问题变成产品功能）。');
lines.push('');

fs.writeFileSync(path.join(HERE, REPORT_NAME), `${lines.join('\n')}\n`, 'utf8');
console.log(`P=${pct(precision)} R=${pct(recall)} F1=${pct(f1)} 分类准确率=${pct(typeAcc)}（n=${CASES.cases.length}）`);
console.log(`报告已写入 eval/interview-extract/${REPORT_NAME}`);
