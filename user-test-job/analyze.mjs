/**
 * 求职副驾驶用户测试汇总：读 timing_sheet.csv + survey.csv，生成 RESULTS.md。
 *
 * 运行：
 *   node user-test-job/analyze.mjs user-test-job/timing_sheet.csv user-test-job/survey.csv
 *
 * 不编数据：没有记录就写“待采集”，退出码 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const timingPath = process.argv[2] || path.join(HERE, 'timing_sheet.csv');
const surveyPath = process.argv[3] || path.join(HERE, 'survey.csv');
const outPath = process.argv[4] || path.join(HERE, 'RESULTS.md');

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  text = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  if (!rows.length) return { header: [], rows: [] };
  const header = rows[0].map(s => s.trim());
  const data = rows.slice(1).map(values => {
    const obj = {};
    header.forEach((key, i) => { obj[key] = (values[i] ?? '').trim(); });
    return obj;
  });
  return { header, rows: data };
}

function num(v) { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; }
function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '—'; }
function secondsLabel(s) { return s == null ? '—' : (s >= 60 ? (s / 60).toFixed(1) + ' 分钟' : s.toFixed(1) + ' 秒'); }

const timing = parseCsv(fs.existsSync(timingPath) ? fs.readFileSync(timingPath, 'utf8') : '');
const survey = parseCsv(fs.existsSync(surveyPath) ? fs.readFileSync(surveyPath, 'utf8') : '');

const tasks = ['T1', 'T2', 'T3', 'T4'];
const taskNames = { T1: 'T1 工作台输入', T2: 'T2 JD 雷达', T3: 'T3 经历深挖', T4: 'T4 模拟面试（可选）' };
const participants = new Set(timing.rows.map(r => r.participant).filter(Boolean));
const taskStats = tasks.map(t => {
  const rows = timing.rows.filter(r => String(r.task || '').toUpperCase() === t);
  const done = rows.filter(r => /^(yes|y|是|完成|1)$/i.test(String(r.success || '').trim()));
  const times = rows.map(r => num(r.seconds)).filter(v => v != null);
  const helps = rows.map(r => num(r.help_count)).filter(v => v != null);
  return {
    task: t, label: taskNames[t], rows: rows.length, done: done.length,
    rate: pct(done.length, rows.length),
    avgTime: times.length ? secondsLabel(times.reduce((a, b) => a + b, 0) / times.length) : '—',
    avgHelp: helps.length ? (helps.reduce((a, b) => a + b, 0) / helps.length).toFixed(1) : '—',
  };
});

const susRows = survey.rows.filter(r => Array.from({ length: 10 }, (_, i) => num(r['SUS' + (i + 1)])).every(v => v != null));
const susScores = susRows.map(r => {
  let sum = 0;
  for (let i = 1; i <= 10; i++) {
    const v = num(r['SUS' + i]);
    sum += i % 2 === 1 ? v - 1 : 5 - v;
  }
  return sum * 2.5;
});
const susMean = susScores.length ? (susScores.reduce((a, b) => a + b, 0) / susScores.length).toFixed(1) : '—';
const wtp = survey.rows.map(r => String(r.WTP || '').trim()).filter(Boolean);
const wtpCount = {};
wtp.forEach(v => { wtpCount[v] = (wtpCount[v] || 0) + 1; });

const lines = [];
lines.push('# 求职副驾驶 · 用户测试结果');
lines.push('');
lines.push('> 由 `user-test-job/analyze.mjs` 从真实 CSV 生成；**没有数据的地方写“待采集”，不编造。**');
lines.push('');
lines.push(`- 原始数据：\`${path.basename(timingPath)}\` + \`${path.basename(surveyPath)}\``);
lines.push(`- 计时记录：${timing.rows.length} 行；问卷：${survey.rows.length} 行`);
lines.push(`- 被试代号：${participants.size ? [...participants].sort().join('、') : '待采集'}`);
lines.push('');
lines.push('## 一、任务完成情况');
lines.push('');
lines.push('| 任务 | 记录数 | 完成数 | 完成率 | 平均耗时 | 平均求助次数 |');
lines.push('|---|---|---|---|---|---|');
taskStats.forEach(s => lines.push(`| ${s.label} | ${s.rows} | ${s.done} | ${s.rate} | ${s.avgTime} | ${s.avgHelp} |`));
lines.push('');
lines.push('## 二、SUS 可用性');
lines.push('');
lines.push(susRows.length
  ? `- 样本：${susRows.length} 人；均分：**${susMean} / 100**（SUS 不是百分比，>68 通常视为高于平均）`
  : '- 待采集（`survey.csv` 还没有 10 题完整的记录）。');
lines.push('');
lines.push('## 三、付费意愿');
lines.push('');
if (wtp.length) {
  lines.push('| 价格 | 人数 |');
  lines.push('|---|---|');
  Object.entries(wtpCount).sort().forEach(([k, v]) => lines.push(`| ${k} | ${v} |`));
} else {
  lines.push('- 待采集。');
}
lines.push('');
lines.push('## 四、关键原话 / 卡点');
lines.push('');
const notes = timing.rows.map(r => r.notes).filter(Boolean);
if (notes.length) {
  notes.slice(0, 12).forEach(n => lines.push('- ' + n));
} else {
  lines.push('- 待采集：访谈时至少记 2 句原话（匿名）。');
}
lines.push('');
lines.push('## 五、下一步');
lines.push('');
lines.push('- [ ] 把结论变成 3 个具体改动（改哪个页面、改哪句话、改哪个流程）');
lines.push('- [ ] 改完再测 1–2 人，确认卡点是否消失');
lines.push('- [ ] 只把真实数据写进简历/面试；没有数据就写“已设计测试，待采集”');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log('\n✓ 已写入 ' + outPath);
