/**
 * 求职工作台：跨工具数据流的集成测试。
 *
 * 模拟三个工具各自产生的 localStorage 数据，验证工作台能读取、汇总、导出，
 * 以及「把预测题带入复盘器」能把题目合并进复盘数据。
 *
 * 运行：node eval/job-workbench/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'job-workbench', 'index.html');
const require = createRequire(import.meta.url);
const CORE = require(path.join(ROOT, 'job-workbench', 'experience-core.js'));

const jdText = '岗位：AI 产品经理（内容平台）\n职责：负责 AI 写作助手的产品定义与路线图，拆解用户需求；设计提示词策略与 RAG 知识库；建立指标体系与埋点；跨部门推动上线。';
const resumeText = '2025.06–2026.04 校园二手平台｜产品负责人\n- 主导用户调研，30 名学生访谈，首页转化率从 12% 提升到 19%\n- 设计发布流程，把步骤从 5 步压到 3 步，发布成功率提升 23%';

const storage = {
  jwb_state: JSON.stringify({jd: jdText, resume: resumeText, updatedAt: '2026-11-01T22:00:00.000Z'}),
  jd_last: JSON.stringify({
    updatedAt: '2026-11-01T22:01:00.000Z',
    jdCount: 3,
    top: [
      {id: 'product_def', name: '产品定义', group: 'insight', jdCount: 3, count: 4},
      {id: 'requirement', name: '需求分析', group: 'insight', jdCount: 2, count: 3},
      {id: 'rag', name: 'RAG / 知识库', group: 'ai', jdCount: 2, count: 2},
    ],
    groups: {insight: 1, data: 0.6, ai: 0.8, delivery: 0.4, collab: 0.5, biz: 0.2},
  }),
  mock_interview_state_v1: JSON.stringify({
    jd: jdText, resume: resumeText, ratings: {}, notes: {},
    result: {
      competencies: ['产品定义', '需求分析', 'RAG / 知识库'],
      questions: [
        {kind: 'resume', tag: '简历深挖', text: '你简历里写到「首页转化率从 12% 提升到 19%」，具体讲讲你的角色和动作？', focus: '真实性 + 贡献度', frame: 'STAR', follow: '哪个决定是你做的？', competence: '简历成果'},
        {kind: 'job', tag: '能力题 · 产品定义', text: '挑一个你做过的功能：目标用户是谁、决定不做什么？', focus: '考察产品定义', frame: 'STAR', follow: '砍掉一半会砍哪半？', competence: '产品定义'},
        {kind: 'job', tag: '能力题 · RAG / 知识库', text: '让你设计知识库问答，切块、召回、引用怎么定？', focus: '考察 RAG', frame: 'STAR', follow: '召回不准先改哪层？', competence: 'RAG / 知识库'},
      ],
    },
  }),
  ir_state: JSON.stringify({
    items: [
      {q: '讲一个你最失败的项目', type: '行为面', intent: '复盘能力', framework: [], followup: '', notes: '', rating: 2},
      {q: '你的北极星指标怎么定的？', type: '产品方法', intent: '', framework: [], followup: '', notes: '', rating: 4},
    ],
  }),
};

const code = loadInlineScript(PAGE);
const api = runScript(code, ['loadAll', 'buildDossier', 'carryQuestionsToReview'], {storage: storage});

const problems = [];
const data = api.loadAll();
if (!data.jwb || !data.jwb.jd) problems.push('没读到工作台的 JD');

const dossier = api.buildDossier(data);
const mustHave = ['# 求职档案', '## 基本信息', '## ① JD 能力扫描', '## ② 预测面试题', '## ③ 真实面试复盘', '## 下一步行动'];
mustHave.forEach((section) => { if (!dossier.includes(section)) problems.push('档案缺少章节：' + section); });
if (!/产品定义/.test(dossier)) problems.push('档案里没有 JD 高频能力');
if (!/首页转化率/.test(dossier)) problems.push('档案里没有引用简历的预测题');
if (!/讲一个你最失败的项目/.test(dossier)) problems.push('档案里没有真实复盘问题');
if (!/薄弱 1 道/.test(dossier)) problems.push('薄弱题统计不对（应为 1 道）');

// 把预测题带入复盘器：3 道预测题里有 2 道是新的（第 1 道与复盘已有问题不重复）
api.carryQuestionsToReview();
const after = JSON.parse(api.__store.get('ir_state'));
const added = after.items.length - 2;
if (added !== 3) problems.push('带入复盘器新增题数不正确：' + added + '（期望 3）');
if (!after.items.some((item) => /首页转化率/.test(item.q))) problems.push('带入的题里没有简历深挖题');

// 经历深挖 core：5 问流程、弱动词识别、不编数字、STAR/Markdown 生成
if (CORE.STEPS[0].id !== 'background') problems.push('经历深挖：第一问不是背景');
let expSession = CORE.emptySession({title: '内容运营实习', role: '内容运营', jd: 'AI 产品经理（内容方向）'});
const answers = [
  '我在教育公司内容组实习，团队 5 人，负责公众号和小红书。',
  '我负责每周选题、写标题、排版和发布。',
  '最难的是选题会没人拍板，我先做小测试再用数据说服。',
  '阅读量有提升，但没有统计到具体数字。',
  '如果重来，我会先定北极星指标。',
];
for (const text of answers) expSession = CORE.answer(expSession, text).session;
const expStory = CORE.buildStory(expSession);
if (!expStory.star.S || !expStory.star.A || !expStory.star.R) problems.push('经历深挖：STAR 缺字段');
if (!expStory.markdown.includes('## 一、STAR 结构')) problems.push('经历深挖：Markdown 缺 STAR');
if (!expStory.gaps.some((g) => /数字/.test(g))) problems.push('经历深挖：没提示“结果缺数字”');
if (!CORE.analyze('负责公众号').weak.includes('负责')) problems.push('经历深挖：没识别弱动词“负责”');

console.log('档案长度：' + dossier.length + ' 字');
console.log('复盘题数：带入前 2 → 带入后 ' + after.items.length);
console.log('经历深挖：' + expStory.markdown.length + ' 字，' + expStory.gaps.length + ' 项待补');
if (problems.length) {
  console.log('✗ 发现问题：');
  problems.forEach((problem) => console.log('  - ' + problem));
  process.exit(1);
}
console.log('✓ 工作台测试通过：数据流 6 项 + 经历深挖 4 项');
