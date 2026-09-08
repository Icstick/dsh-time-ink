# dsh-time-ink 设计

## 需求

用户每次发消息时，让模型看到当前系统时间（格式 `2026-09-08 07:51`）。

## 注入位候选与证据（2026-09-08 于 D:\deepseek-harness 源码核实）

DSH 模型请求 = 每 step 重建的 system prompt（`agent-loop/src/agent.ts:349`
`renderPrompt(assembly)`，assemble 在 `agent.ts:242` preStep 内每 step 执行）
+ session surface 折叠历史（`deriveMessages`）。注入通道与代价：

1. **system prompt 段**（`systemPrompt.section`，动态 text）
   - 每请求重建、零事件、UI 隐藏；
   - 但 DeepSeek 前缀缓存精确匹配：system prompt 在请求最前，时间文本一变
     （分钟粒度下每分钟首次 step），变化点之后的**全部历史**失配 → 全量未命中
     重算。重度使用日增量估算可观 → 否决。

2. **runtime-context 快照**（`systemPrompt.context`，sandbox:policy 同款）
   - `RuntimeContextProjection.project` 只在快照文本变化时投影新 user 消息
     （`runtime-context.ts:64-75`），append 型、无回收；
   - 时钟分钟级变化 → 每变化一次投影一条 → 历史逐步累积（session 存档验证：
     当前会话 285 事件仅 1 条快照，因为 sandbox 文本稳定；时钟会把它变成
     每分钟一条）→ 否决。

3. **surface replace 原位更新**（新消息 replace 旧时钟）
   - `surface.ts:382` replace 把新节点 splice 到被阴影节点的**原位**；
   - 原位 = 首个回合附近 → 前缀断点靠前（每次更新 ≈ 全历史 miss）；
     且 compaction 折叠早期历史后时钟被挤出窗口 → 双输 → 否决。

4. **pre-step append 尾部注入（选定）**
   - 借 `agent/pre-step` waterfall（ACP/memos adapter 验证过的范式）：
     `await next()` 拿下游决策 → 仅 `step===1` 且 messages 含真实用户消息
     （`source.kind==='user'`，从真实会话存档核实的判据）→ 尾部 append
     一条 `{kind:'plugin', plugin:'dsh-time-ink'}` 的 user 消息；
   - 缓存：消息在对话尾部新增，前缀与上请求一致 → 近全命中；
   - 压缩：每回合刷新一条在尾部，早期条目被折叠无碍；
   - UI：append 注入按 `ui-chat message.ts:55` 规则渲染为折叠的
     「上下文注入」DisclosureRow（与 ACP/WC 注入同款呈现；完全隐藏需改
     core chat 渲染，改动面权衡后不做——用户拍板接受折叠行）。

## 行为语义

- 触发：真实用户消息的回合首步（step===1）。同一回合多条消息合并注入一次。
- 节流：每会话记住上次注入文本；同文本跳过（分钟粒度 → 同分钟多回合只注一次）。
- 顺序：注入消息位于该 step 决策 messages 尾部 → agent-loop 统一 append →
  模型视野在「用户消息 + 其他注入 + 快照」之后、回复之前。
- fail-open：任何异常降级日志，返回原决策。

## 局限与未来

- 回合内不刷新：工具循环长跑中途模型不知道时间流逝。若要，可加「每 N 步
  补一条」开关（同样 append 尾部，缓存代价 = 每 N 步一次小尾部增量）或
  system prompt 尾段（接受每分钟一次断链）——均需用户确认后做。
- UI 完全隐藏需要 core ui-chat match 过滤一行 + rebuild（有升级维护成本），
  作为未来 PR 上游化的候选，本版本不做。
