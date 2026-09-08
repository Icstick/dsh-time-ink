/**
 * dsh-time-ink：用户消息回合首步注入当前系统时间。
 *
 * 机制（详见 docs/design.md）：
 *   agent/pre-step waterfall —— 仅 step===1 且决策 messages 含真实用户消息
 *   （role=user 且 source.kind=user）时，把一条 source-labelled 的 user 消息
 *   追加到决策 messages 尾部，由 agent-loop 统一落 session（append 型）：
 *     - 位置在对话尾部 → DeepSeek 前缀缓存几乎无损；
 *     - 每用户回合刷新 → 不被 compaction 折叠丢失（早期条目可丢，新的总在尾）；
 *     - UI 以折叠的「上下文注入」DisclosureRow 呈现（与 ACP/WC 注入同款）；
 *     - 会话历史可审计（消息带 plugin source 标记）。
 *   fail-open：任何注入故障只降级日志，不得阻断回合。
 * @module dsh-time-ink
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import { ClockThrottle, clockText, hasRealUserMessage } from './clock.mjs'

export const name = 'time-ink'

export const Config = z.object({
  /** 注入文本前缀（空字符串 = 无前缀，只注入裸时间）。 */
  prefix: z.string().default('当前时间：'),
  /** IANA 时区名（如 Asia/Shanghai）；空字符串 = 跟随宿主进程本地时区。 */
  timeZone: z.string().default(''),
})

const PLUGIN = 'dsh-time-ink'
const DEFAULTS = { prefix: '当前时间：', timeZone: '' }

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...(config && typeof config === 'object' ? config : {}) }
  const throttle = new ClockThrottle()

  ctx.on('agent/pre-step', async (payload, next) => {
    // 下游先行：先拿到完整决策（含 ACP/WC/maid 等注入），错误照常传播。
    const decision = await next()
    if (payload?.step !== 1) return decision
    if (!decision || decision.kind !== 'enter') return decision
    try {
      if (!hasRealUserMessage(decision.messages)) return decision
      const sessionId = payload.agent?.session?.id ?? payload.agent?.id ?? ''
      const text = clockText(cfg.prefix, cfg.timeZone)
      if (throttle.propose(sessionId, text) === null) return decision
      decision.messages.push(createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'plugin', plugin: PLUGIN },
      }))
    } catch (err) {
      // fail-open：注入故障不得阻断 turn。
      ctx.logger?.warn?.('[time-ink] inject degraded: '
        + (err instanceof Error ? err.message : String(err)))
    }
    return decision
  })
}
