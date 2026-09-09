---
id: DOC-RESEARCH-PEER-SURVEY-20260909
status: draft
surveyed_on: 2026-09-09
scope: dsh-time-ink 同类插件与相邻项目同行调研
---

# dsh-time-ink 同行调研与可吸纳方法（2026-09-09）

## 0. 调研方法与范围

- **时间**：2026-09-09 20:20–21:15（Asia/Shanghai）。星数用 `gh api repos/<owner>/<repo> --jq '.stargazers_count'` 逐个实测，与 `pushed_at` 同批取回。
- **同行原文**：cuteG41cute/dsh-time-stamp（98 行）、moon16u/dsh-pouch（107 行）、omdsh-dev/dsh-tool-time（185 行）、tufeiping/dsh-plugin-chat-timestamps（43 行）均用 `gh api .../readme -H "Accept: application/vnd.github.raw"` 落盘后逐行读取。
- **官方同功能包**：本机 `D:\deepseek-harness\packages\context\time-context` 完整源码（`src/index.ts` 221 行）+ `README.zh.md` 152 行 + 决策记录 `.agents/notes/implemented/feature/2026-07-16-durable-per-step-time-context.zh.md`。这是本次调研最关键的一手材料。
- **生态外**：tianpan.co 两篇全文、OpenClaw `@cuttingwater/openclaw-temporal-context` 插件页全文、GitHub issue/PR 原文（anthropics/claude-code #87487、#67120；openai/codex PR #12947、issue #14814，均用 `gh api` 取 `.body`）、Microsoft Copilot Studio date-context 模式（经 DeepWiki 索引页，标注为二手）。
- **没做**：未安装任何同行插件；未实测其注入行为（全部基于源码/README/issue 原文）；未验证 DSH 0.1.5-alpha.1 之外版本的兼容性；hermes-agent #693/#27742 仅见标题摘要，未读正文（标为待核验）。

## 1. 我们的定位（一句话）

让模型在**每个真实用户回合**都拿到一行「现在几点」，用尾部 append 注入（前缀缓存几乎无损）+ 分钟节流 + 折叠呈现 + fail-open——只解决「模型知不知道现在」，不解决时间算术。

与官方 `@deepseek-ai/dsh-time-context` 的差别是定位而非能力：官方是**显式启用**、**每步**注入、英文、带浏览器时区与 elapsed、随 Schedule Web overlay 挂载；我们是**常驻**、**每回合首步**、中文单行、分钟粒度、零配置。

## 2. 同行地图

| 项目 | ★ | 做什么 | 与我们的关系 |
|---|---|---|---|
| [@deepseek-ai/dsh-time-context](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/context/time-context)（官方，本机源码） | 上游仓库 217 064 | opt-in 的**每步**时钟上下文：时间戳 + 浏览器时区 + 距今间隔 | 官方同功能包，我们必须在机制上对齐或明确差异 |
| [cuteG41cute/dsh-time-stamp](https://github.com/cuteG41cute/dsh-time-stamp) | 1 | 每个用户提问前注入持久时钟消息（含距上一条提问间隔），按工作区开关 | **直接同款**，机制级对比见 §3 |
| [moon16u/dsh-pouch](https://github.com/moon16u/dsh-pouch) → `@moon16u/dsh-plugin-current-time` | 1 | 每回合首步 append 真实日期/时间/时区 | 独立走到同一条路（印证） |
| [omdsh-dev/dsh-tool-time](https://github.com/omdsh-dev/dsh-tool-time) | 5 | 工具面时间能力：严格 ISO、IANA 转换、UTC 日历运算、固定时长差 | 互补路线，非竞品 |
| [tufeiping/dsh-plugin-chat-timestamps](https://github.com/tufeiping/dsh-plugin-chat-timestamps) | 0 | UI 层秒级时间戳（browser-only，Node 侧故意为空） | 呈现层对照，不进模型 |
| [OpenClaw temporal-context](https://clawhubcn.com/en/plugins/@cuttingwater/openclaw-temporal-context) | — | `before_prompt_build` 注入 `<temporal_context>` 块：本地日期时间、ISO 日期、时区、会话渠道、距上一条用户回合的间隔、上一条用户回合时间 | 生态外同款，字段最全 |
| [anthropics/claude-code #87487](https://github.com/anthropics/claude-code/issues/87487) | — | 请求「关掉每日 date 注入」：日期每天变 → 每天一次全量前缀重写 | 我们缓存论证的反证支撑 |
| [anthropics/claude-code #67120](https://github.com/anthropics/claude-code/issues/67120) | — | system prompt 的 date line 随端点与时区漂移（含 `Asia/Shanghai` 分隔符变 `/`） | 时区/格式不确定性的现实案例 |
| [openai/codex PR #12947](https://github.com/openai/codex/pull/12947) | — | `<environment_context>` 带 `current_date` + IANA `timezone`，且把 date/tz 变化当环境更新 | 印证「带时区 + 每回合」 |
| [openai/codex #14814](https://github.com/openai/codex/issues/14814) | — | 请求原生 pre-turn 动态上下文注入 hook（现靠外部 wrapper） | 印证我们选的注入位 |
| [Microsoft Copilot Studio date-context 模式](https://deepwiki.com/microsoft/skills-for-copilot-studio/6.4-date-context-injection)（二手） | — | `Today()` 注入 instructions，推荐 LongDate（含星期、无歧义） | 格式选择依据 |
| [tianpan.co「当时钟成为工具」](https://tianpan.co/zh/blog/2026-07-01-when-the-clock-is-a-tool-agents-time-zones-and-the-midnight-bug) | — | 上下文漂移、工具被动性、prompt 缓存陷阱、时区/夏令时 | 论证我们路线的外部证据 |

## 3. 可吸纳的方法（核心）

### 🔴 P0-1 注入「距上一条用户消息的间隔」+ 一句相对时间锚定指令
- **出处**：cuteG41cute/dsh-time-stamp 注入样例——`Time the user's latest message was received: 2026-08-17T15:33:51+08:00[Asia/Shanghai]. Elapsed since the previous user message: 4m 40s. Interpret relative time references (now, today, yesterday, 现在, 今天, 刚才) against this instant.`（[README](https://github.com/cuteG41cute/dsh-time-stamp)）；官方 `time-context` 三行读数第 3 行即 elapsed（`src/index.ts:104-107`），step 1 基线是「上一条模型可见消息」，后续步骤是「同一轮次中前一个 time-context 事件」，挂钟倒退钳零、无基线报 `unavailable`。
- **它怎么做**：把「现在」和「离上次多久」一起给模型，并显式命令它用这个时刻去解析「刚才/今天/下周」这类相对表述——相对时间才是真正容易出错的地方。
- **我们现状**：没有。`src/clock.mjs:9-24` 的 `formatClock` 只产出 `YYYY-MM-DD HH:mm`；`ClockThrottle` 只存文本、不留时间戳，无从计算间隔。
- **建议**：`ClockThrottle` 改存上次注入的时间戳，注入文本追加 `（距上次提问 4 分钟；「刚才/今天」等相对表述以此为准）`。

### 🔴 P0-2 每条时间戳带显式 IANA 时区与偏移
- **出处**：tianpan.co「为智能体看到或发出的每个时间戳附加一个显式的 IANA 时区（例如 `America/New_York`，而不是 "EST"）」；openai/codex PR #12947 的 `<environment_context><current_date>…</current_date><timezone>America/Los_Angeles</timezone></environment_context>`；anthropics/claude-code #67120 记录 date line 会随系统时区改变分隔符。
- **它怎么做**：时区感知要从系统时钟一路贯穿到模型看到的自然语言，缺一层就重新产生歧义；缩写（EST/CET）不足以判断夏令时是否生效。
- **我们现状**：弱。`src/clock.mjs:9-24` 无时区后缀；`src/index.mjs:25-27` 的 `timeZone` 默认空串 = 跟随宿主进程时区，**模型无从知道这是哪个时区**（官方 `time-context` 会在读数里写明 IANA 名，`README.zh.md:105-113`）。
- **建议**：默认注入 `2026-09-09 20:20（Asia/Shanghai，UTC+08:00）`；`timeZone` 为空时用 `Intl.DateTimeFormat().resolvedOptions().timeZone` 解析出名字。

### 🔴 P0-3 source 声明 `form: 'snapshot'` + `sections`
- **出处**：官方 `packages/context/time-context/src/index.ts:216`——`source: { kind: 'plugin', plugin: name, form: 'snapshot', sections: [{ name, text }] }`；`packages/llm/llm/src/message.ts:50-96` 定义词表（instructions/catalog/snapshot/notice/relay/recall），snapshot = 「Current state, where a later snapshot from the same producer supersedes an earlier one」；`packages/client/ui-chat/src/client/chat/ContextBody.tsx:388-411` 为 snapshot 提供专门渲染（含「取代先前快照」的语义行）。
- **它怎么做**：注入消息声明「这是什么形态的东西」，UI 据此渲染；时钟天然是 snapshot（后一条取代前一条）。
- **我们现状**：未声明。`src/index.mjs:46-49` 只有 `{ kind: 'plugin', plugin: PLUGIN }`。折叠行本身没问题（`ui-chat/src/client/conversation-nodes/message.ts:55-64`：`source.kind !== 'user'` 一律折叠成 context 节点），但展开正文走 opaque 分支。
- **建议**：改成 `{ kind:'plugin', plugin:'dsh-time-ink', form:'snapshot', sections:[{ name:'time-ink', text }] }`；`form` 是**语义**词表，不要自造值。

### 🔴 P0-4 节流状态从持久日志派生，而不是进程内 Map
- **出处**：官方决策记录「进程本地刷新缓存会使显示时间依赖于无法在恢复后保留的状态」「事件时间戳在压缩和恢复后仍是判断依据，无需进程本地缓存」；实现用 `ctx.sessionProjections.register` 折叠 `lastInjectionTime/lastTurnInjectionTime`（`src/index.ts:152-178`）。dsh-time-stamp 静态版把配置落到 `settings.yaml` 的 `time-stamp` 段（每工作区覆盖 + 全局默认，schema 校验）。
- **它怎么做**：把「上次注入了什么/何时」做成从持久事件折叠出来的状态，重启、resume、fork 后依然成立。
- **我们现状**：弱。`src/clock.mjs:64-92` 的 `ClockThrottle` 是进程内 `Map`（limit 2000），DSH 重启后同一分钟内可能再注入一次；键只有 sessionId，不区分工作区。
- **建议**：改用 session projection 或读会话事件里最新一条 `plugin='dsh-time-ink'` 消息的时间；若坚持进程内缓存，在 README 写明「重启后节流失效」。

### 🟠 P1-1 可选的回合内刷新间隔（refreshIntervalMs）
- **出处**：官方 `Config.refreshIntervalMs`（默认 0 = 每个合格步骤；正数 = 同一会话两次持久注入的最小毫秒数，`src/index.ts:49-60, 188-193`）；dsh-time-stamp「每条用户消息（提问、追问/steer）在进入模型步骤前自动附带时钟读数；工具循环的中间步骤不重复注入」。
- **它怎么做**：把「多久刷新一次」变成配置，默认按步，正数则抑制过密注入；steer/追问这类中途消息也拿到读数。
- **我们现状**：没有。`src/index.mjs:41` 硬性 `payload?.step !== 1` 直接返回——回合内长工具循环与中途 steer 都没有新读数（`README.md`「局限」已自认）。
- **建议**：加 `refreshIntervalMs`（默认 0 = 保持现状，不改变现有行为），在 step>1 按间隔补读；缓存代价只是尾部增量。

### 🟠 P1-2 加入星期，并保持确定性格式
- **出处**：Microsoft Copilot Studio date-context 模式推荐 LongDate（`Thursday, March 13, 2026`）：「includes day of week for additional temporal context」「Unambiguous month/day ordering」，开销 5–10 token/回合（二手，经 DeepWiki 索引）。
- **它怎么做**：星期是相对时间推理（「下周三」「周末」）的必要锚点，成本极低。
- **我们现状**：没有。`formatClock` 输出无星期。
- **建议**：追加 `星期三`，保留 `en-CA` + `hourCycle:'h23'`（与 dsh-tool-time 的 Intl 固定做法一致，`README.md`「安全模型」段）。

### 🟠 P1-3 注入块尾部加一句「如何使用 / 不要复述」
- **出处**：OpenClaw temporal-context 注入块末行——`Use this for temporal grounding, recency, scheduling language, and stale-context checks. Do not mention it unless it helps the user.`
- **它怎么做**：给模型一条使用说明，顺带压掉「把注入内容复述给用户」的倾向。
- **我们现状**：裸时间（`src/clock.mjs:44-48` 的 `clockText`）。
- **建议**：加半句：`（用于时间锚定与排期判断；除非有助于用户，否则不必提及本行）`。

### 🟠 P1-4 持久化状态：只落时间戳，不落消息文本，且有上界
- **出处**：OpenClaw temporal-context 的隐私声明——state 文件「stores session keys, channel labels, timestamps, and turn counts only. It does not store message text」，`maxStateEntries` 默认 500。
- **它怎么做**：把「为了功能必须持久化的最小事实」与「用户内容」严格分开，并给状态文件一个条数上界。
- **我们现状**：`ClockThrottle` 只存 sessionId→时间字符串（不含用户文本，安全），limit 2000 有界——现状合格；但如果 P0-4 改成持久化，这条纪律必须写进设计。
- **建议**：设计文档明确「持久层只写 sessionId + 注入时间戳，不写消息文本」，并保留上界淘汰。

### 🟡 P2-1 时钟注入的确定性（为 replay/eval 铺路）
- **出处**：tianpan.co「在需要确定性的地方冻结 now——对于任何你想要测试、回放或重现的内容，传递一个显式的 now，而不是让每个组件独立读取系统时钟」。
- **它怎么做**：把 `now` 作为参数传入，而不是让每处直接读系统时钟。
- **我们现状**：已具备。`src/clock.mjs:44` 的 `clockText(prefix, timeZone, now = new Date())` 与 `formatClock(now, timeZone)` 都允许注入 now（印证我们的判断）。
- **建议**：补一条断言「同一 now + 同一时区 → 逐字节相同文本」的回归测试，锁死这条性质。

### 🟡 P2-2 README 增加「模型体验 / KV Cache 影响」两节
- **出处**：官方 `time-context` README 有 `### Token 影响` 与 `### KV Cache 影响`（「仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效」）；tufeiping/dsh-plugin-chat-timestamps 有 `## Model Experience` 与 `#### KV Cache effect`（明确写 None）。
- **它怎么做**：把「这条注入对模型和缓存到底做了什么」写成可核对的声明，而不是散在设计文档里。
- **我们现状**：`docs/design.md` 有完整的候选对比表与缓存分析，README 只有一段摘要。
- **建议**：README 增设两节，直接引用 design.md 的结论。

### 🟡 P2-3 配置正规化：settings 命名空间合法，但存储域名不能用连字符
- **出处**：cuteG41cute/dsh-time-stamp 的已知坑——「存储域名必须匹配 `/^[a-z][a-z0-9_]*$/`（**不允许连字符**），曾因域名 `time-stamp` 含 `-` 导致写入路径静默失败」。本机源码核实：storage 的 `UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/`（`packages/storage/storage/src/backend.ts:10`），而 settings 命名空间是 `/^[a-z][a-z0-9-]*$/`（`packages/settings/settings/src/index.ts:20`，**允许**连字符）。
- **它怎么做**：两个持久化面的命名规则不同；settings 可以有连字符，storage 域名必须是下划线风格。
- **我们现状**：`time-ink` 目前不落 storage、不注册 settings（`src/index.mjs:21-28` 只有 Config），暂未踩坑。
- **建议**：将来加 `enabled`/`settings.register` 时用 `time-ink`（合法）；一旦需要落盘状态，域名用 `time_ink`。

### 🟡 P2-4 时间算术不要自己造
- **出处**：omdsh-dev/dsh-tool-time 的严格 ISO 8601 解析、IANA 转换、UTC 日历运算与月份钳制、`timezoneSource` 字段、63 个用例（含 fake clock）。
- **它怎么做**：把「精确算术」放工具面，把「现在几点」放注入面，各司其职。
- **我们现状**：我们不做工具，也不该做。
- **建议**：README 指向 dsh-tool-time 作为「需要换算/加减/时差」时的推荐，避免用户以为我们覆盖了算术。

## 4. 印证我们判断的地方

- **注入优于工具**：tianpan.co「工具是被动的……只有当智能体有理由怀疑它所认知的当前时间时，它才会决定去检查时间」；官方决策记录「只通过工具提供时间：不予采纳，因为普通时间推理会产生本可避免的往返」。
- **尾部 append 保前缀缓存**：官方「仅追加；新可见内容位于可复用请求前缀之后」；dsh-time-stamp「注入消息一次性写入会话日志，之后每次请求逐字节重放同一内容，不扩大模型前缀缓存的未命中区」；反证是 claude-code #87487（system prompt 每日 date 注入导致「每天一次全量前缀重写」）。
- **每回合一次而非每步**：moon16u「Once per turn rather than per step, so a tool-call loop does not bury the transcript in near-identical timestamps」——与我们的 `step===1` 完全同结论（官方 `time-context` 反而默认每步，这是它的 Schedule 场景取舍）。
- **只对真实用户来源注入**：dsh-time-stamp「确认该项目开关为『开』，且消息确实是用户来源（系统消息/工具消息不触发）」；我们 `clock.mjs:32-36` 的 `role=user && source.kind=user` 同判据。
- **`en-CA` + `hourCycle:'h23'`**：dsh-tool-time「Intl 环境固定：`'en-CA'` + `hourCycle: 'h23'`（避免午夜 `24:00` 与本地化数字）」——我们 `clock.mjs:10-18` 一字不差。
- **折叠「上下文注入」行是产品原生呈现**：dsh-time-stamp「本插件采用官方 `time-context` 同款持久化方案，界面呈现为产品原生设计的折叠式『上下文注入』小字行」；本机 `message.ts:55-64` 证实任何 `source.kind !== 'user'` 的 append 消息都进 context 节点。

## 5. 我们不该学的

- **不学默认每步注入**。官方 `refreshIntervalMs` 默认 0（每步），代价是「每次合格尝试都会保留一条读数」直到压缩遮蔽。我们的诉求是「发消息时知道时间」，每步会灌满近重复读数。做成开关（P1-1）即可，默认保持现状。
- **不学把时钟放进 system prompt**。claude-code 的现状（每日 date line）已被 #87487 举证为缓存成本；我们的 design.md 也已否决。tianpan.co 的「粗化到日期」是折中方案，但收益只在我们想要跨天长会话的「日期锚」时才成立——不要为了抄而抄。
- **不学浏览器时区派生**。官方从 `user-rpc` 来源派生浏览器 IANA 时区，并处理 mixed/unavailable 策略——这套依赖「每个请求都有浏览器来源」。我们的运行场景包含子代理、headless、CLI，没有这个前提；强行引入会让 headless 语义变复杂。保持显式 `timeZone` + 进程时区回退。
- **不学 elapsed 的全套基线复杂度**。官方基线要处理「上一条模型可见消息（含 assistant/tool result）」与「被压缩遮蔽的读数」，还要扫原始事件。我们分钟粒度、用途是「现在几点」，取「上一条 time-ink 注入时间」足够；要完全对齐官方语义就得连 session projection 一起做。
- **不学 UI 层秒级时间戳**。tufeiping 的方案刻意不进模型（`Model Experience: None`），与我们「让模型有感知」是两件事；混在一起会让「注入」变成「显示」。
- **不学「每工作区开关」先上**。dsh-time-stamp 的每工作区开关背后是完整的 settings + client 按钮链；先落地 `enabled` + settings 命名空间，再看是否需要工作区粒度。

## 6. 落地建议（最多 3 条）

1. **source 声明 `form:'snapshot'` + `sections`（10 分钟）**：零行为风险，立刻让注入正文走官方 snapshot 渲染路径，语义与官方对齐。
2. **注入文本升级（半天）**：加 IANA 时区/偏移 + 星期 + 距上次提问间隔 + 一句相对时间锚定与「不必提及」——这是本次调研收益最大的一条，且完全不需要新通道。
3. **节流改日志派生 + 可选 `refreshIntervalMs`（1 天）**：解决重启后重复注入与回合内无时间感两个已知缺口，默认值不变。

## 7. 来源清单

**原文（一手，2026-09-09 抓取）**

- https://github.com/cuteG41cute/dsh-time-stamp — README 全文（★1）
- https://github.com/moon16u/dsh-pouch — README 全文（★1，含 `dsh-plugin-current-time` 小节）
- https://github.com/omdsh-dev/dsh-tool-time — README 全文（★5）
- https://github.com/tufeiping/dsh-plugin-chat-timestamps — README 全文（★0）
- https://github.com/anthropics/claude-code/issues/87487 — issue body 原文（`gh api`）
- https://github.com/anthropics/claude-code/issues/67120 — issue body 原文（`gh api`）
- https://github.com/openai/codex/pull/12947 — PR body 原文（`gh api`）
- https://github.com/openai/codex/issues/14814 — issue body 原文（`gh api`）
- https://tianpan.co/zh/blog/2026-07-01-when-the-clock-is-a-tool-agents-time-zones-and-the-midnight-bug — 全文（付费墙前的公开部分）
- https://clawhubcn.com/en/plugins/@cuttingwater/openclaw-temporal-context — 插件页全文
- 本机 `D:\deepseek-harness\packages\context\time-context` — `src/index.ts`、`README.zh.md`、`package.json`（官方同功能包）
- 本机 `.agents/notes/implemented/feature/2026-07-16-durable-per-step-time-context.zh.md` — 官方决策记录
- 本机 `packages/llm/llm/src/message.ts`、`packages/client/ui-chat/src/client/chat/ContextBody.tsx`、`packages/client/ui-chat/src/client/conversation-nodes/message.ts`、`packages/settings/settings/src/index.ts`、`packages/storage/storage/src/backend.ts` — 机制与命名规则核实

**二手（仅作线索，未逐字核验）**

- https://deepwiki.com/microsoft/skills-for-copilot-studio/6.4-date-context-injection — Copilot Studio date-context 模式（索引页，非微软原文）
- NousResearch/hermes-agent issues #693 / #27742 — 仅见搜索摘要（「Time-of-Day Context Injection」「Agent lacks internal clock」），**正文未读，待核验**
- OpenClaw temporal-context 的 ★ 数未实测（ClawHub 插件页不提供 GitHub 星数）——标为「—」
