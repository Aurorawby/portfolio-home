# portfolio-home · 我的作品集主页

**线上版**：https://aurorawby.github.io/portfolio-home/

这是我的 AI 产品作品集门面：17 个产品 + 2 条工作流，分四条主线——

| 主线 | 项目 |
|---|---|
| 🎯 求职工具箱 | **求职工作台**（工作流入口）、JD 雷达、模拟面试官、面试复盘器、投递看板 |
| 🎨 内容工具 | **内容工作台**（全流程工作流入口）、**图文工作室**（5 种爆款形态 schema 化）、选题雷达、笔记工坊、公众号排版器、汇报一页纸、Quiz Factory 测试库 / AI 生成器 / 测试工厂·数据版 |
| 📚 研究工具 | 图表解读器、长文档阅读卡、本地文献 Agent |
| 🧭 生活场景 | 行程一页纸、吃什么决策器（方法论迁移实验：检验「解析→诊断→渲染」与「多准则决策」两套方法的可迁移性） |

每条线都有 PRD 或产品说明；纯前端项目配了**可复现的评测**。

## 怎么玩

| 卡片 | 说明 |
|---|---|
| 求职工作台 / JD 雷达 / 模拟面试官 | 本仓库内，点开即用（纯前端；模拟面试官可选 AI 增强） |
| 面试复盘器 / 长文档阅读卡 / 选题雷达 / 投递看板 / 笔记工坊 / 汇报一页纸 / 公众号排版器 / 内容工作台 / 图文工作室 / 行程一页纸 / 吃什么决策器 | 本仓库内，点开即用（纯前端；带 AI 的可选 BYOK，无 Key 用演示模式） |
| 图表解读器 | 本仓库内，点开即用（数字解读与看图清单完全离线；图片解读需视觉模型 Key，如智谱 glm-4v-flash 免费） |
| Quiz Factory 测试库 / AI 生成器 | 在 [quiz-factory 仓库](https://github.com/Aurorawby/quiz-factory)的 Pages 上 |
| 测试工厂·数据版 | 需要本地跑：`cd quiz-server && python server.py`，然后开 http://127.0.0.1:8800 |

## 评测与审计（重点）

| 文档 | 内容 |
|---|---|
| [`AUDIT.md`](AUDIT.md) | 逐项目审计：真实度 / 深度证据 / 已知不足 / 下一步优先级 |
| [`IDEAS.md`](IDEAS.md) | 下一步做什么、以及"不建议做什么" |
| [`eval/interview-extract/REPORT.md`](eval/interview-extract/REPORT.md) | 面试复盘器**开发集**：P/R 100%（27 题，规则迭代用过，有过拟合风险） |
| [`eval/interview-extract/REPORT-holdout.md`](eval/interview-extract/REPORT-holdout.md) | 面试复盘器**留出集**：P 88.9% / R 94.1%（17 题，未参与调规则） |
| [`eval/doc-cards/REPORT.md`](eval/doc-cards/REPORT.md) | 阅读卡：摘录逐字核验 4/4、离线句原文合规 5/5、关键词覆盖 9/10 |
| [`eval/jd-radar/REPORT.md`](eval/jd-radar/REPORT.md) | JD 雷达：核心能力召回 92.7%、Top-5 召回 94.0%、命中密度 13.6 项/份 |
| [`eval/mock-interview/REPORT.md`](eval/mock-interview/REPORT.md) | 模拟面试官：能力覆盖 74.1%、简历引用 100%、追问完整 100%（8 组 JD+简历） |
| [`eval/topic-radar/REPORT.md`](eval/topic-radar/REPORT.md) | 选题雷达：16 条人工标注标题，好坏命中率双 100%、区分度 40.5 分（含同源风险声明） |
| [`eval/note-craft/REPORT.md`](eval/note-craft/REPORT.md) | 笔记工坊：违禁词召回 100%（12 处）、干净样本误报 0%（19 条标注） |
| [`eval/application-board/REPORT.md`](eval/application-board/REPORT.md) | 投递看板：漏斗 / 提醒 / 渠道 / 死因统计与手工计算逐字段一致（回归 9/9） |
| [`eval/one-pager/REPORT.md`](eval/one-pager/REPORT.md) | 汇报一页纸：大纲解析与结构诊断回归 8/8 一致 |
| [`eval/chart-lens/REPORT.md`](eval/chart-lens/REPORT.md) | 图表解读器：数字解读引擎（基数陷阱 / pp 口径 / 样本量分级）回归 13/13 一致 |
| [`eval/content-workbench/REPORT.md`](eval/content-workbench/REPORT.md) | 内容工作台：周简报引擎（漏斗 / 类型聚合 / 建议三态）回归 9/9 一致 |
| [`eval/mp-formatter/REPORT.md`](eval/mp-formatter/REPORT.md) | 公众号排版器：手写 Markdown 解析器与内联样式渲染回归 10/10 一致 |
| [`eval/trip-onepager/REPORT.md`](eval/trip-onepager/REPORT.md) | 行程一页纸：攻略解析与结构诊断回归 5/5 一致 |
| [`eval/food-picker/REPORT.md`](eval/food-picker/REPORT.md) | 吃什么决策器：过滤与加权排序（含 tie-break）回归 9/9 一致 |
| [`eval/xhs-studio/REPORT.md`](eval/xhs-studio/REPORT.md) | 图文工作室：脚本校验引擎 7/7 一致（基线满分 + 4 变异体 + 形态区分度 + 红线声明） |
| [`eval/job-workbench/REPORT.md`](eval/job-workbench/REPORT.md) | 求职工作台：跨三工具的数据流集成测试（6 项断言全部通过） |

**复现**（不需要浏览器、不调用模型，只依赖 Node）：

```bash
node eval/interview-extract/run.mjs                    # 开发集
node eval/interview-extract/run.mjs cases-holdout.json # 留出集
node eval/doc-cards/run.mjs
node eval/jd-radar/run.mjs
node eval/mock-interview/run.mjs
node eval/topic-radar/run.mjs
node eval/note-craft/run.mjs
node eval/application-board/run.mjs
node eval/one-pager/run.mjs
node eval/chart-lens/run.mjs
node eval/content-workbench/run.mjs
node eval/mp-formatter/run.mjs
node eval/trip-onepager/run.mjs
node eval/food-picker/run.mjs
node eval/xhs-studio/run.mjs
node eval/job-workbench/run.mjs
```

## 用户测试

`user-test-3/` 是 3 人小规模试用的执行包：主试话术、任务卡、计时表、记录模板、汇总脚本。
跑完把真实数据填进 `timing_sheet.csv`，`node user-test-3/analyze.mjs` 生成 `RESULTS.md`。

## 发布

Push 到 main 分支即自动部署（GitHub Pages → main / root）。
