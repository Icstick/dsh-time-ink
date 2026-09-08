# AGENTS.md —— dsh-time-ink 仓库导航

> 任何 agent 在本仓库动手前先读这里。

## 这是什么

dsh-time-ink：DSH 插件。用户消息回合首步注入当前系统时间
（append 型 user 消息，尾部刷新，折叠呈现）。核心诉求：模型永远知道「现在几点」。

## 结构

- `src/index.mjs` —— 插件入口（Config、apply、agent/pre-step listener、fail-open）
- `src/clock.mjs` —— 纯函数（formatClock / 用户消息判定 / 节流），零依赖可单测
- `test/clock.test.mjs` —— node:test
- `cordis.patch.yml` —— bundle 装配补丁
- `docs/design.md` —— 方案对比与决策记录
- `README.md` —— 中文主文档（背景/装配/配置/局限）

## 铁律

1. **fail-open**：注入任何故障只降级日志，绝不阻断回合（agent/pre-step 是主链路）。
2. **只注入真实用户回合**：判定 = `role=user && source.kind=user`（source 是排除注入/快照/审批/目录的唯一可靠依据，勿用文本启发式）。
3. **source 标记**：注入消息必须带 `{kind:'plugin', plugin:'dsh-time-ink'}`（审计/UI/未来清理依赖它）。
4. **纯 ESM 零运行时依赖**：src 一律 .mjs；新增依赖先讨论。
5. **改代码必须补测试**：test/ 下同名 .test.mjs；判定/格式化是纯函数，直接单测。

## 常用命令

- `pnpm test` —— node --test test/*.test.mjs
