/**
 * 长文档阅读卡：验证两件事
 * 1) AI 卡片的「原文摘录」是否真的能在原文里逐字找到（防幻觉的核验逻辑）；
 * 2) 离线「划重点」选出的句子是否真的来自原文、覆盖了多少关键词。
 *
 * 运行：node eval/doc-cards/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInlineScript, runScript } from '../harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAGE = path.join(ROOT, 'doc-cards', 'index.html');

const code = loadInlineScript(PAGE);
const api = runScript(code, ['SAMPLE', 'SAMPLE_CARDS', 'splitSentences', 'keywords', 'topSentences']);

const article = api.SAMPLE;
const cards = api.SAMPLE_CARDS;
const normalize = (text) => String(text).replace(/\s+/g, '');

// ---------- 1. 引用核验 ----------
const quoteChecks = (cards.cards || []).map((card) => ({
  title: card.title,
  quote: card.quote,
  found: article && card.quote ? normalize(article).includes(normalize(card.quote)) : false,
}));
const found = quoteChecks.filter((item) => item.found).length;

// 篡改一条摘录，确认核验逻辑能识别出来（而不是永远返回 true）
const tampered = '这句话被人为改写过，原文里绝对不存在这句话';
const tamperedDetected = !normalize(article).includes(normalize(tampered));

// ---------- 2. 离线划重点 ----------
const sentences = api.topSentences(article, 5);
const sentenceGrounded = sentences.filter((sentence) => normalize(article).includes(normalize(sentence))).length;
const keywordFreq = api.keywords(article);
const keywords = Object.entries(keywordFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([word]) => word);
const coveredKeywords = keywords.filter((keyword) => sentences.some((sentence) => sentence.includes(keyword)));

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const lines = [];
lines.push('# 长文档阅读卡 · 评测报告');
lines.push('');
lines.push('- 评测方式：Node 沙箱直接调用页面里的纯函数（`topSentences` / `keywords`），不经过浏览器、不调用模型');
lines.push('- 样例：页面内置示例文章（约 ' + Math.round(article.length / 100) / 10 + ' 千字）');
lines.push('');
lines.push('## 结果');
lines.push('');
lines.push('| 检查项 | 结果 | 说明 |');
lines.push('|---|---|---|');
lines.push(`| AI 摘录原文命中率 | **${found}/${quoteChecks.length}（${pct(found / quoteChecks.length)}）** | 卡片里的 quote 是否逐字出现在原文里 |`);
lines.push(`| 篡改摘录检出 | **${tamperedDetected ? '1/1' : '0/1'}** | 故意改写的句子是否会被标为"未命中" |`);
lines.push(`| 离线划重点 · 原文合规 | **${sentenceGrounded}/${sentences.length}** | 选出的句子是否逐字来自原文（不允许模型改写） |`);
lines.push(`| 离线划重点 · 关键词覆盖 | **${coveredKeywords.length}/${keywords.length}** | top-5 句覆盖了多少 top-10 关键词 |`);
lines.push('');
lines.push('## 摘录明细');
lines.push('');
lines.push('| # | 卡片 | 摘录（前 40 字） | 原文命中 |');
lines.push('|---|---|---|---|');
quoteChecks.forEach((item, index) => {
  const short = String(item.quote || '').slice(0, 40).replace(/\|/g, '／');
  lines.push(`| ${index + 1} | ${item.title} | ${short} | ${item.found ? '✅' : '❌'} |`);
});
lines.push('');
lines.push('## 离线划重点选出的句子');
lines.push('');
sentences.forEach((sentence, index) => {
  lines.push(`${index + 1}. ${sentence.slice(0, 90)}`);
});
lines.push('');
lines.push('## 已知局限');
lines.push('');
lines.push('1. 样例只有 1 篇内置文章，且 AI 卡片是随页面预置的（演示模式），不是当场调用模型生成；');
lines.push('2. 离线划重点用的是"关键词密度 + 位置"启发式，对论述型文章有效，对列表/数据型文章效果会差；');
lines.push('3. 关键词覆盖率是启发式指标，不等于"摘要质量"；真正的质量需要人工评分（相关性/完整性）。');
lines.push('');
lines.push('## 怎么复现');
lines.push('');
lines.push('```bash');
lines.push('node eval/doc-cards/run.mjs');
lines.push('```');
lines.push('');

fs.writeFileSync(path.join(HERE, 'REPORT.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(`摘录命中 ${found}/${quoteChecks.length}，离线句原文合规 ${sentenceGrounded}/${sentences.length}，关键词覆盖 ${coveredKeywords.length}/${keywords.length}`);
console.log('报告已写入 eval/doc-cards/REPORT.md');
