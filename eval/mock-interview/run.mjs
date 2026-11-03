/**
 * 模拟面试官：规则层生成质量评测（不依赖浏览器 / 不调用模型）。
 *
 * 指标：
 *  - 能力覆盖率：人工标注的"该 JD 必须覆盖的能力"里，有多少被生成的岗位题覆盖；
 *  - 简历引用率：简历非空的用例里，有多少生成了引用简历原句的深挖题；
 *  - 追问完整度：每道题是否都带一个追问；
 *  - 去重率：生成题目里没有重复问法；
 *  - 通用题齐全：自我介绍、反问环节是否都在。
 *
 * 运行：node eval/mock-interview/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'mock-interview', 'index.html');
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'));

const code = loadInlineScript(PAGE);
const api = runScript(code, ['generateQuestions', 'BANK']);
const nameById = new Map(api.BANK.map((item) => [item.id, item.name]));

const rows = [];
let coveredSum = 0, expectedSum = 0, resumeHit = 0, resumeCases = 0;
let followSum = 0, questionSum = 0, uniqueSum = 0, standardOk = 0;

for (const testCase of CASES.cases) {
  const result = api.generateQuestions(testCase.jd, testCase.resume);
  const questions = result.questions;
  const selectedNames = new Set(result.competencies);
  const expected = testCase.expected.filter((id) => nameById.has(id));
  const covered = expected.filter((id) => selectedNames.has(nameById.get(id)));

  const resumeQuestions = questions.filter((item) => item.kind === 'resume');
  const hasResume = (testCase.resume || '').trim().length > 20;
  if (hasResume) {
    resumeCases += 1;
    if (resumeQuestions.length > 0) resumeHit += 1;
  }
  const follow = questions.filter((item) => item.follow && item.follow.trim().length > 5).length;
  const unique = new Set(questions.map((item) => item.text.replace(/\s+/g, ''))).size;
  const hasIntro = questions.some((item) => /自我介绍/.test(item.text));
  const hasReverse = questions.some((item) => /想问我们/.test(item.text));

  coveredSum += covered.length;
  expectedSum += expected.length;
  followSum += follow;
  questionSum += questions.length;
  uniqueSum += unique;
  if (hasIntro && hasReverse) standardOk += 1;

  rows.push({
    id: testCase.id,
    expected: expected.length,
    covered: covered.length,
    missed: expected.filter((id) => !selectedNames.has(nameById.get(id))).map((id) => nameById.get(id)),
    total: questions.length,
    resume: resumeQuestions.length,
    follow,
    unique,
    standard: hasIntro && hasReverse,
  });
}

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const coverage = expectedSum ? coveredSum / expectedSum : 0;
const resumeRate = resumeCases ? resumeHit / resumeCases : 0;
const followRate = questionSum ? followSum / questionSum : 0;
const uniqueRate = questionSum ? uniqueSum / questionSum : 0;
const standardRate = rows.length ? standardOk / rows.length : 0;
const avgQuestions = rows.length ? questionSum / rows.length : 0;

const lines = [];
lines.push('# 模拟面试官 · 生成质量评测');
lines.push('');
lines.push(`- 用例数：**${CASES.cases.length}** 组（JD + 简历，人工标注核心能力）`);
lines.push('- 评测方式：Node 沙箱直接调用页面里的 `generateQuestions`，不经过浏览器、不调用模型');
lines.push(`- 题库：${api.BANK.length} 项能力，每项 1 道能力题 + 1 个追问`);
lines.push('');
lines.push('## 总体结果');
lines.push('');
lines.push('| 指标 | 数值 | 说明 |');
lines.push('|---|---|---|');
lines.push(`| 核心能力覆盖率 | **${pct(coverage)}** | 人工标注的核心能力里，被岗位题覆盖的比例（${coveredSum}/${expectedSum}） |`);
lines.push(`| 简历引用率 | **${pct(resumeRate)}** | 简历非空的用例中，生成了至少 1 道引用简历原句的深挖题（${resumeHit}/${resumeCases}） |`);
lines.push(`| 追问完整度 | **${pct(followRate)}** | 每道题都带一个追问的比例 |`);
lines.push(`| 去重率 | **${pct(uniqueRate)}** | 生成题目中没有重复问法的比例 |`);
lines.push(`| 通用题齐全率 | **${pct(standardRate)}** | 同时包含自我介绍与反问环节的用例比例 |`);
lines.push(`| 平均题数 | **${avgQuestions.toFixed(1)} 道** | 一套面试准备列表的长度 |`);
lines.push('');
lines.push('> 说明：这套评测只看「覆盖与完整度」，**不评价问题本身写得好不好**');
lines.push('> （那需要人工逐题打分）。所以这里不宣称"题库质量高"，只说明规则层跑得住。');
lines.push('');
lines.push('## 逐用例');
lines.push('');
lines.push('| 用例 | 标注核心 | 覆盖 | 漏掉 | 题目数 | 简历题 | 带追问 | 不重复 | 通用题 |');
lines.push('|---|---|---|---|---|---|---|---|---|');
rows.forEach((row) => {
  lines.push(`| ${row.id} | ${row.expected} | ${row.covered} | ${row.missed.join('、') || '无'} | ${row.total} | ${row.resume} | ${row.follow} | ${row.unique} | ${row.standard ? '✅' : '❌'} |`);
});
lines.push('');
lines.push('## 已知局限');
lines.push('');
lines.push('1. 规则层是"题库 + 关键词匹配"，不同 JD 措辞变了就可能漏掉能力（例如把"用户洞察"写成不命中用户研究）；');
lines.push('2. 题目是通用问法，个性化程度有限——所以产品里把 AI 改写做成可选项；');
lines.push('3. 只测了 8 组用例、单人标注，覆盖率是方向性指标；');
lines.push('4. 没有测"问题是否真正针对候选人"，这需要真实面试官评分。');
lines.push('');
lines.push('## 怎么复现');
lines.push('');
lines.push('```bash');
lines.push('node eval/mock-interview/run.mjs');
lines.push('```');
lines.push('');
lines.push('## 下一步');
lines.push('');
lines.push('- 扩到 20 组 JD+简历，2 人交叉标注覆盖率；');
lines.push('- 加"问题难度分层"（一面/二面/HR 面分别出什么题）；');
lines.push('- 接真实面试官做 10 条问题的相关性评分，补质量指标。');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(`能力覆盖=${pct(coverage)} 简历引用=${pct(resumeRate)} 追问完整=${pct(followRate)} 平均题数=${avgQuestions.toFixed(1)}（n=${CASES.cases.length}）`);
console.log('报告已写入 eval/mock-interview/REPORT.md');
