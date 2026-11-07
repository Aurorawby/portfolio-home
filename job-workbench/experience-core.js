/**
 * 经历深挖 · 纯逻辑层（浏览器 + Node 共用）。
 *
 * 设计原则：
 * - 不编事实：用户没给的数字，只写“待补”，绝不自动补一个看起来漂亮的数字；
 * - 不替用户写经历：只做提问、结构化、改写建议；
 * - 离线可用：不调用模型也能完成 5 问深挖 + STAR 初稿。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ExperienceCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STEPS = [
    {
      id: 'background',
      label: '背景与目标',
      q: '先给这段经历一个“镜头”：你在哪家公司/团队、什么时间、你的角色，目标是什么？',
      hint: '说清：团队多大、你负责哪块、当时要解决什么问题。'
    },
    {
      id: 'action',
      label: '你做了什么',
      q: '你具体做了哪 2–3 件事？其中哪些是你亲手做的，而不是“参与/配合”？',
      hint: '用动词：调研、拆需求、写方案、跑数据、推上线。'
    },
    {
      id: 'challenge',
      label: '难点与冲突',
      q: '最难或最冲突的一个点是什么？你当时怎么处理的？',
      hint: '可以是资源不够、时间紧、和同事意见不一致、数据拿不到。'
    },
    {
      id: 'result',
      label: '结果与证据',
      q: '结果是什么？有没有数字、前后对比、覆盖范围或频率？',
      hint: '没有数字就写范围/频率/时长；不要编一个数字。'
    },
    {
      id: 'reflection',
      label: '反思与迁移',
      q: '如果再做一次，你会先改什么？这段经历和目标岗位最相关的能力是什么？',
      hint: '反思不是“学到了很多”，要说一个具体的判断或动作。'
    }
  ];

  var WEAK_VERBS = ['负责', '参与', '协助', '帮忙', '配合', '支持'];
  var RESULT_WORDS = ['提升', '降低', '增长', '节省', '缩短', '覆盖', '上线', '交付', '通过', '转化', '产出', '完成', '改善', '减少'];

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function trimSentence(value, max) {
    var text = clean(value);
    if (max && text.length > max) return text.slice(0, max) + '…';
    return text;
  }

  function analyze(answer) {
    var text = clean(answer);
    var numbers = (text.match(/[0-9０-９]+(?:\.[0-9]+)?\s*(?:%|％|倍|万|亿|人|次|篇|份|小时|天|周|月|年)?/g) || []);
    var weak = WEAK_VERBS.filter(function (word) { return text.indexOf(word) >= 0; });
    var results = RESULT_WORDS.filter(function (word) { return text.indexOf(word) >= 0; });
    return {
      length: text.length,
      hasNumber: numbers.length > 0,
      numbers: numbers.slice(0, 6),
      weak: weak,
      results: results,
      iCount: (text.match(/我/g) || []).length,
      weCount: (text.match(/我们/g) || []).length
    };
  }

  function emptySession(input) {
    input = input || {};
    return {
      title: clean(input.title),
      role: clean(input.role),
      period: clean(input.period),
      raw: clean(input.raw),
      jd: clean(input.jd),
      answers: {},
      step: 0,
      done: false,
      updatedAt: new Date().toISOString()
    };
  }

  function firstQuestion() {
    return STEPS[0].q;
  }

  function coachFeedback(step, analysis, text) {
    text = clean(text);
    var notes = [];
    if (step.id === 'background') {
      if (analysis.length < 35) notes.push('再具体一点：团队多大、你负责哪块、目标是什么？');
      if (!analysis.hasNumber) notes.push('可以补一个范围：团队人数、用户量、时间跨度。');
    } else if (step.id === 'action') {
      if (analysis.weak.length) notes.push('这里有“' + analysis.weak.join('、') + '”——把它换成你亲自做的动作。');
      if (analysis.length < 50) notes.push('再拆细一点：先做什么、后做什么、你改了哪一版。');
    } else if (step.id === 'challenge') {
      if (!/(冲突|不同意|卡|难|缺|来不及|拿不到|失败|返工|资源)/.test(text)) {
        notes.push('有没有一个具体的卡点？比如资源不够、时间紧、和同事意见不一致。');
      }
    } else if (step.id === 'result') {
      if (!analysis.hasNumber) notes.push('结果最好有数字/前后对比；没有就写范围或频率，不要编。');
      if (!analysis.results.length) notes.push('用结果词收尾：提升/降低/节省/覆盖/上线。');
    } else if (step.id === 'reflection') {
      if (!/(下次|如果|重来|学到|判断|迁移)/.test(text)) {
        notes.push('别写“学到了很多”；说一个具体的判断或下次会改的动作。');
      }
    }
    if (analysis.weCount > analysis.iCount) notes.push('“我们”有点多，面试官想知道你个人做了什么。');
    return notes.length ? notes.join(' ') : '这一条够具体，继续。';
  }

  function currentStep(session) {
    return STEPS[Math.min(session.step || 0, STEPS.length - 1)];
  }

  function answer(session, content) {
    var s = JSON.parse(JSON.stringify(session || emptySession({})));
    var step = currentStep(s);
    var text = clean(content);
    if (!text) {
      return { session: s, reply: '先写一句也行；如果这块确实没有，可以点“跳过这题”。', done: false, skipped: false };
    }
    s.answers[step.id] = text;
    var analysis = analyze(text);
    var reply = coachFeedback(step, analysis, text);
    s.step = Math.min((s.step || 0) + 1, STEPS.length);
    s.done = s.step >= STEPS.length;
    if (!s.done) reply += '\n\n' + STEPS[s.step].q;
    else reply += '\n\n五个问题够了，点「生成故事」看 STAR 版本。';
    s.updatedAt = new Date().toISOString();
    return { session: s, reply: reply, done: s.done, skipped: false };
  }

  function skip(session) {
    var s = JSON.parse(JSON.stringify(session || emptySession({})));
    var step = currentStep(s);
    s.step = Math.min((s.step || 0) + 1, STEPS.length);
    s.done = s.step >= STEPS.length;
    var reply = '好，这题先空着；生成故事时我会把它标成“待补”。';
    if (!s.done) reply += '\n\n' + STEPS[s.step].q;
    s.updatedAt = new Date().toISOString();
    return { session: s, reply: reply, done: s.done, skipped: true };
  }

  function ensureFirst(text) {
    var t = clean(text);
    if (!t) return '';
    return /^我/.test(t) ? t : '我' + t;
  }

  function pickTask(background, role) {
    var text = clean(background);
    var hit = text.match(/[^。；;]*?(目标|任务|负责|要做)[^。；;]*/);
    if (hit && clean(hit[0]).length >= 8) return clean(hit[0]);
    return role ? '作为' + role + '，完成这段经历里的核心任务' : '（待补：你的目标/任务）';
  }

  function buildStory(session) {
    var s = session || emptySession({});
    var a = s.answers || {};
    var title = s.title || '这段经历';
    var role = s.role ? '（' + s.role + '）' : '';
    var allText = [a.background, a.action, a.challenge, a.result, a.reflection].join(' ');
    var analysis = analyze(allText);
    var resultAnalysis = analyze(a.result || '');

    var gaps = [];
    if (!a.result) gaps.push('结果还没写：面试官一定会追问“所以呢”。');
    else if (!resultAnalysis.hasNumber) gaps.push('结果没有数字：补规模/频率/前后对比；没有就写定性，不要编。');
    if (analysis.weak.length) gaps.push('出现弱动词“' + analysis.weak.join('、') + '”：改成你亲自做的动作。');
    if (analysis.weCount > analysis.iCount) gaps.push('“我们”多于“我”：要讲清个人贡献。');
    if (!s.jd) gaps.push('没有关联目标岗位：面试官会问“这段经历和岗位有什么关系”。');
    if (!a.reflection) gaps.push('没有反思：补一个“如果重来会改什么”。');

    var star = {
      S: a.background || s.raw || '（待补：这段经历发生的场景）',
      T: pickTask(a.background, s.role),
      A: [a.action, a.challenge].filter(Boolean).join(' ') || '（待补：你具体做了什么）',
      R: a.result || '（待补：结果与证据）'
    };

    var short = [
      a.background ? ensureFirst(a.background) : '我在' + title + role + '。',
      a.action ? ensureFirst(a.action) : '',
      a.result ? '结果是：' + a.result : '结果部分还需要补一个可核验的证据。'
    ].filter(Boolean).join(' ');

    var long = [
      '这段经历是' + title + role + '。',
      a.background ? '当时的情况是：' + trimSentence(a.background, 150) : '',
      a.action ? '我主要做了：' + ensureFirst(a.action).replace(/^我/, '') : '',
      a.challenge ? '最难的是：' + trimSentence(a.challenge, 150) : '',
      a.result ? '结果是：' + trimSentence(a.result, 130) : '',
      a.reflection ? '如果再做一次，我会：' + trimSentence(a.reflection, 120) : ''
    ].filter(Boolean).join(' ');

    var probes = [
      '你个人具体负责哪一部分？团队其他人做了什么？',
      '结果有没有基线/对照？这个数字是怎么算出来的？',
      '如果重做一次，你会先改哪一步？为什么？',
      '这段经历和目标岗位的哪项能力最相关？能举个例子吗？'
    ];
    if (!resultAnalysis.hasNumber) probes.unshift('结果有没有数字？没有数字的话，覆盖范围/频率/前后对比是什么？');

    var rewrites = [];
    rewrites.push('把“负责/参与”换成“主导/推动/落地/设计/跑通”，后面接一个具体动作。');
    if (!resultAnalysis.hasNumber) rewrites.push('补一个可核验的数字：人数、次数、时长、覆盖范围、前后对比；没有就写“定性”，不要编。');
    if (analysis.weCount > analysis.iCount) rewrites.push('把“我们”改成“我”，明确你个人做的部分。');
    if (!s.jd) rewrites.push('把结果和目标岗位的能力对齐：这段经历证明了你会哪一项岗位能力？');

    var markdown = renderMarkdown(s, star, short, long, probes, gaps, rewrites);

    return {
      title: title,
      role: s.role,
      period: s.period,
      target_jd: s.jd,
      star: star,
      versions: { short: short, long: long },
      probes: probes,
      gaps: gaps,
      rewrites: rewrites,
      analysis: analysis,
      markdown: markdown
    };
  }

  function renderMarkdown(s, star, short, long, probes, gaps, rewrites) {
    var lines = [];
    lines.push('# 经历深挖：' + (s.title || '未命名经历'));
    lines.push('');
    lines.push('> 由「经历深挖官」根据你的回答生成。');
    lines.push('> **所有数字/事实必须本人核对；没有提供的数字不会自动编造。**');
    if (s.period) lines.push('> 时间：' + s.period);
    if (s.role) lines.push('> 角色：' + s.role);
    if (s.jd) lines.push('> 目标岗位：' + trimSentence(s.jd, 200));
    lines.push('');
    lines.push('## 一、STAR 结构');
    lines.push('');
    lines.push('| 结构 | 内容 |');
    lines.push('|---|---|');
    [['S 情境', 'S'], ['T 任务', 'T'], ['A 行动', 'A'], ['R 结果', 'R']].forEach(function (pair) {
      lines.push('| ' + pair[0] + ' | ' + star[pair[1]].replace(/\|/g, '\\|') + ' |');
    });
    lines.push('');
    lines.push('## 二、30 秒版本（电梯陈述）');
    lines.push('');
    lines.push(short);
    lines.push('');
    lines.push('## 三、90 秒版本（面试展开）');
    lines.push('');
    lines.push(long);
    lines.push('');
    lines.push('## 四、面试官可能追问');
    lines.push('');
    probes.forEach(function (q) { lines.push('- ' + q); });
    lines.push('');
    lines.push('## 五、需要补的证据（不要编）');
    lines.push('');
    if (gaps.length) gaps.forEach(function (g) { lines.push('- [ ] ' + g); });
    else lines.push('- 暂时没发现明显缺口；仍建议补一个可核验数字。');
    lines.push('');
    lines.push('## 六、改写建议');
    lines.push('');
    rewrites.forEach(function (r) { lines.push('- ' + r); });
    lines.push('');
    lines.push('## 七、原始回答（保留证据，不润色）');
    lines.push('');
    ['background', 'action', 'challenge', 'result', 'reflection'].forEach(function (id) {
      var step = STEPS.filter(function (x) { return x.id === id; })[0];
      lines.push('### ' + step.label);
      lines.push('');
      lines.push(s.answers && s.answers[id] ? s.answers[id] : '（未填写/跳过）');
      lines.push('');
    });
    return lines.join('\n');
  }


  var TAG_RULES = {
    '用户研究': ['用户研究', '访谈', '调研', '问卷', '用户需求'],
    '产品定义': ['产品定义', 'PRD', '需求分析', '优先级', 'MVP', '从0到1', '0→1'],
    '数据分析': ['数据', '指标', 'A/B', 'SQL', '转化', '漏斗', '复盘', 'ROI'],
    '内容增长': ['内容', '选题', '涨粉', '阅读', '投放', 'KOL', '账号', '私域', '爆款'],
    'AI/评测': ['AI', '模型', '评测', 'RAG', 'Agent', 'Prompt', '文献', '引用', 'κ', 'P@10'],
    '项目推进': ['推进', '协调', '跨团队', '上线', '交付', '排期', '统筹', '联动']
  };

  function classifyStory(story) {
    var text = [
      story && story.title, story && story.role,
      story && story.star && story.star.S, story && story.star && story.star.T,
      story && story.star && story.star.A, story && story.star && story.star.R,
      story && story.versions && story.versions.short,
      story && story.versions && story.versions.long
    ].filter(Boolean).join(' ');
    var tags = [];
    Object.keys(TAG_RULES).forEach(function (tag) {
      var count = 0;
      TAG_RULES[tag].forEach(function (word) {
        var idx = 0;
        while (text.indexOf(word, idx) >= 0) { count += 1; idx += word.length; }
      });
      if (count > 0) tags.push({ tag: tag, count: count });
    });
    tags.sort(function (a, b) { return b.count - a.count; });
    return tags;
  }

  function jdCoverage(stories, jd) {
    var jdText = clean(jd);
    var expected = Object.keys(TAG_RULES).filter(function (tag) {
      return TAG_RULES[tag].some(function (word) { return jdText.indexOf(word) >= 0; });
    });
    var present = {};
    (stories || []).forEach(function (story) {
      classifyStory(story).forEach(function (x) { present[x.tag] = true; });
    });
    return {
      expected: expected,
      covered: expected.filter(function (tag) { return present[tag]; }),
      gaps: expected.filter(function (tag) { return !present[tag]; })
    };
  }

  function buildLibraryMarkdown(stories, jd) {
    var list = (stories || []).slice();
    var lines = [];
    lines.push('# 经历库 / 面试故事库');
    lines.push('');
    lines.push('> 由「经历深挖」保存的故事自动汇总；所有事实与数字需本人核对。');
    lines.push('');
    lines.push('- 故事数：' + list.length);
    if (jd) lines.push('- 目标 JD：' + trimSentence(jd, 140));
    lines.push('');
    if (jd) {
      var cover = jdCoverage(list, jd);
      lines.push('## JD 关键词覆盖（规则匹配，仅作提示）');
      lines.push('');
      lines.push('- 已覆盖：' + (cover.covered.length ? cover.covered.join('、') : '无'));
      lines.push('- 缺口：' + (cover.gaps.length ? cover.gaps.join('、') : '无明显缺口'));
      lines.push('');
    }
    list.forEach(function (story, i) {
      lines.push('## ' + (i + 1) + '. ' + (story.title || '未命名经历'));
      lines.push('');
      if (story.role || story.period) {
        lines.push('> ' + [story.role, story.period].filter(Boolean).join(' ｜ '));
        lines.push('');
      }
      var tags = classifyStory(story).map(function (x) { return x.tag; });
      if (tags.length) lines.push('**能力标签**：' + tags.join(' / '));
      if (story.versions && story.versions.short) {
        lines.push('');
        lines.push('**30 秒版**：' + story.versions.short);
      }
      if (story.versions && story.versions.long) {
        lines.push('');
        lines.push('**90 秒版**：' + story.versions.long);
      }
      if (story.probes && story.probes.length) {
        lines.push('');
        lines.push('**可能追问**：');
        story.probes.forEach(function (q) { lines.push('- ' + q); });
      }
      if (story.gaps && story.gaps.length) {
        lines.push('');
        lines.push('**待补**：');
        story.gaps.forEach(function (g) { lines.push('- [ ] ' + g); });
      }
      lines.push('');
    });
    return lines.join('\n').trim() + '\n';
  }

  return {
    STEPS: STEPS,
    analyze: analyze,
    emptySession: emptySession,
    firstQuestion: firstQuestion,
    answer: answer,
    skip: skip,
    buildStory: buildStory,
    renderMarkdown: renderMarkdown,
    classifyStory: classifyStory,
    jdCoverage: jdCoverage,
    buildLibraryMarkdown: buildLibraryMarkdown
  };
});
