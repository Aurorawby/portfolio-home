/**
 * 3 人试用数据汇总：读 timing_sheet.csv，算每个任务的完成率 / 平均耗时 / 卡点。
 *
 * 用法：node user-test-3/analyze.mjs user-test-3/timing_sheet.csv
 * 输出：控制台摘要 + user-test-3/RESULTS.md（只在有真实数据时生成）
 */
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'timing_sheet.csv');
const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();

function parseCsv(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',').map((item) => item.trim());
  const rows = lines.map((line) => {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') { quoted = !quoted; continue; }
      if (char === ',' && !quoted) { cells.push(value); value = ''; continue; }
      value += char;
    }
    cells.push(value);
    const row = {};
    header.forEach((key, index) => { row[key] = (cells[index] || '').trim(); });
    return row;
  });
  return rows.filter((row) => Object.values(row).some(Boolean));
}

const rows = parseCsv(text);
if (!rows.length) {
  console.log('没有数据：请先按 record_template 运行测试，把结果填进 timing_sheet.csv');
  process.exit(0);
}

const byTask = new Map();
for (const row of rows) {
  const task = row.task || '未命名';
  if (!byTask.has(task)) byTask.set(task, []);
  byTask.get(task).push(row);
}

const participants = new Set(rows.map((row) => row.participant));
const lines = ['# 3 人试用结果', '', `- 被试：${participants.size} 人（${[...participants].join('、')}）`, ''];
lines.push('| 任务 | 样本 | 完成率 | 平均耗时（完成者） | 卡点 |');
lines.push('|---|---|---|---|---|');

console.log(`被试人数：${participants.size}`);
for (const [task, taskRows] of byTask) {
  const done = taskRows.filter((row) => /yes|y|true|1/i.test(row.completed || ''));
  const times = done.map((row) => Number(row.seconds)).filter((value) => Number.isFinite(value) && value > 0);
  const avg = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;
  const blockers = taskRows.map((row) => row.blocker).filter(Boolean);
  console.log(`- ${task}: ${done.length}/${taskRows.length} 完成, 平均 ${avg}s, 卡点 ${blockers.length} 个`);
  lines.push(`| ${task} | ${taskRows.length} | ${done.length}/${taskRows.length} | ${avg ? avg + 's' : '—'} | ${blockers.join('；') || '—'} |`);
}

lines.push('', '## 卡点清单', '');
const allBlockers = rows.map((row) => row.blocker).filter(Boolean);
if (!allBlockers.length) lines.push('- 无');
allBlockers.forEach((blocker) => lines.push(`- ${blocker}`));
lines.push('', '## 下一步', '');
lines.push('1. 按出现频次最高的卡点改一处（只改一处，改完再测）；');
lines.push('2. 简历里写"X 人试用"、真实完成率与平均耗时，不写未测的指标。');

const outName = file.toLowerCase().includes('example') ? 'RESULTS.example.md' : 'RESULTS.md';
const out = path.join(path.dirname(file), outName);
fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
console.log(`\n已写入 ${out}`);
if (outName !== 'RESULTS.md') {
  console.log('⚠️ 注意：这是示例数据，输出到 RESULTS.example.md；真实数据请填 timing_sheet.csv 后再跑。');
}
