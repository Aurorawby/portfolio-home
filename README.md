# portfolio-home · 我的作品集主页

**线上版**：https://aurorawby.github.io/portfolio-home/

这是我的 AI 产品作品集门面：8 个项目 + 1 条求职工作流，分三条主线——

| 主线 | 项目 |
|---|---|
| 🎯 求职工具箱 | **求职工作台**（工作流入口）、JD 雷达、模拟面试官、面试复盘器 |
| 🎨 内容工具 | Quiz Factory 测试库 / AI 生成器 / 测试工厂·数据版 |
| 📚 研究工具 | 长文档阅读卡、本地文献 Agent |

每条线都有 PRD 或产品说明；纯前端项目配了**可复现的评测**。

## 怎么玩

| 卡片 | 说明 |
|---|---|
| 求职工作台 / JD 雷达 / 模拟面试官 | 本仓库内，点开即用（纯前端，不调模型） |
| 面试复盘器 / 长文档阅读卡 | 本仓库内，点开即用（纯前端） |
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
| [`eval/job-workbench/REPORT.md`](eval/job-workbench/REPORT.md) | 求职工作台：跨三工具的数据流集成测试（6 项断言全部通过） |

**复现**（不需要浏览器、不调用模型，只依赖 Node）：

```bash
node eval/interview-extract/run.mjs                    # 开发集
node eval/interview-extract/run.mjs cases-holdout.json # 留出集
node eval/doc-cards/run.mjs
node eval/jd-radar/run.mjs
node eval/mock-interview/run.mjs
node eval/job-workbench/run.mjs
```

## 用户测试

`user-test-3/` 是 3 人小规模试用的执行包：主试话术、任务卡、计时表、记录模板、汇总脚本。
跑完把真实数据填进 `timing_sheet.csv`，`node user-test-3/analyze.mjs` 生成 `RESULTS.md`。

## 发布

Push 到 main 分支即自动部署（GitHub Pages → main / root）。
