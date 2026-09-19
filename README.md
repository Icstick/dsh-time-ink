# dsh-time-ink

> **状态：已退役（2026-09-09）** —— 官方 `@deepseek-ai/dsh-time-context` 提供同功能且更完整
> （ISO 时间 + IANA 时区 + 浏览器时区策略 + 经过时长、`refreshIntervalMs` 节流、持久 user 消息）。
> 用户决定「既然官方有，就用官方的」。本仓库保留为设计记录，**不再维护**。
> 迁移记录：`~/.dsh/profiles/web/package.json` 的 bundles 已把 `dsh-time-ink` 换成
> `@deepseek-ai/dsh-time-context`；`cordis.patch.yml` 增加 `time-context` 配置
> （`timeZone: Asia/Shanghai` / `refreshIntervalMs: 60000`）。dependency 条目保留，换回即恢复。
> 同行调研与迁移依据见 [docs/research/PEER-SURVEY-20260909.md](docs/research/PEER-SURVEY-20260909.md)。

给 DeepSeek Harness 的每次用户消息注入当前系统时间。

## 背景

LLM 不知道「现在几点」——深夜问候、跨天任务、deadline 判断全凭猜。
本插件在你每次发消息时，往模型上下文里放一条当前时间
（例：`当前时间：2026-09-08 07:51`），让时间感知成为模型每次思考的默认输入，
不需要你开口问、也不需要模型额外调时间工具。

## 效果与呈现

- 每个**用户回合的首个 step**（携带真实用户消息）注入一条时钟 user 消息，追加在该回合消息尾部；
- 模型输入里时钟始终在对话**尾部附近**（最新、最显眼）；
- 聊天界面里显示为**折叠的「上下文注入 · dsh-time-ink」小行**（与 ACP 回忆、工作状态注入同款呈现），点开可见具体时间；
- 同一分钟内重复消息不重复注入（分钟粒度节流）。

## 设计取舍（为什么是这种注入方式）

| 候选 | 缓存 | 压缩后存活 | UI | 结论 |
|---|---|---|---|---|
| system prompt 段 | 时间变化断整条前缀缓存（变化点在请求最前） | ✓ | 隐藏 | ✗ 成本 |
| runtime-context 快照（context 注册） | ✓（但每变化投影一条进历史） | 早期被压缩 | 折叠行 | ✗ 秒级变化=历史逐条累积 |
| surface replace 原位更新 | 断点在首回合 → 全历史 miss | 被 compaction 折叠丢失 | **真隐藏** | ✗ 缓存+存活双输 |
| **pre-step append 尾部注入（本插件）** | 前缀一致几乎全命中，仅尾部增量 | 每回合新时钟在尾部 | 折叠行 | ✓ |

详细分析见 [docs/design.md](docs/design.md)。

## 装配

1. 把本仓库 link 进目标 profile（以 web profile 为例，路径按实际）：

   ```jsonc
   // C:\Users\<you>\.dsh\profiles\web\package.json
   {
     "dependencies": {
       "dsh-time-ink": "link:D:/DSH_workspace/my-plugins/dsh-time-ink"
     },
     "dsh": {
       "profile": { "bundles": [ /* 已有… */, "dsh-time-ink" ] }
     }
   }
   ```

2. `pnpm install`（在 profile 目录）
3. 重启 DSH 实例

## 配置

`settings.yaml` 中（命名空间 `time-ink`）：

| 键 | 默认 | 说明 |
|---|---|---|
| `prefix` | `当前时间：` | 注入文本前缀；空串 = 只注入裸时间 |
| `timeZone` | ``（空） | IANA 时区名（如 `Asia/Shanghai`）；空 = 跟随宿主进程本地时区 |

## 局限（已知，接受）

- 回合内（长工具循环中途）不刷新——只在你发消息的回合锚点注入；要中途时间感需另做每 N 步刷新（成本权衡见 design.md）；
- UI 可见折叠行（要完全隐藏需动 core chat 渲染，权衡后不做）；
- 子代理会话若携带 source.kind=user 的消息也会注入（无害，子代理同样受益）。

## 开发

- 测试：`pnpm test`（node --test，纯函数测试不依赖 DSH 运行时）
- 代码纪律：纯 ESM、零运行时依赖、fail-open、source 标记可审计
