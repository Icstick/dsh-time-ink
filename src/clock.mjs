/**
 * 时钟格式化与注入判定 —— 纯函数模块（零依赖，可单测）。
 * @module dsh-time-ink/clock
 */

/**
 * 格式化时间为 YYYY-MM-DD HH:mm。
 * @param {Date} now - 时刻（默认当前）。
 * @param {string} [timeZone] - IANA 时区名（如 Asia/Shanghai）；缺省/空串 = 宿主本地时区。
 * @returns {string} 例：2026-09-08 07:51
 */
export function formatClock(now = new Date(), timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    ...(timeZone && timeZone.length > 0 ? { timeZone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = {}
  for (const part of fmt.formatToParts(now)) parts[part.type] = part.value
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/**
 * 真实用户消息判定：role=user 且 source.kind=user。
 * 排除一切注入/快照/审批/目录/工作状态等非用户来源（source.kind !== 'user'）。
 * @param {unknown} message - 一条 UserMessage 形状的值。
 * @returns {boolean}
 */
export function isRealUserMessage(message) {
  return message !== null && typeof message === 'object'
    && message.role === 'user'
    && message.source !== null && typeof message.source === 'object'
    && message.source.kind === 'user'
}

/**
 * 消息列表里是否存在真实用户消息。
 * @param {unknown} messages - pre-step 决策的 messages。
 * @returns {boolean}
 */
export function hasRealUserMessage(messages) {
  return Array.isArray(messages) && messages.some(isRealUserMessage)
}

/**
 * 组装注入文本（前缀 + 时间；前缀可空）。
 * @param {string} prefix - 前缀（默认 '当前时间：'）。
 * @param {string} timeZone - IANA 时区名；空串 = 本地。
 * @param {Date} [now] - 注入时刻（可注入以便测试）。
 * @returns {string}
 */
export function clockText(prefix, timeZone, now = new Date()) {
  const text = formatClock(now, timeZone)
  return typeof prefix === 'string' && prefix.length > 0 ? prefix + text : text
}

/**
 * 每会话节流：同一文本不重复注入（分钟粒度天然节流：同一分钟内多回合只注一次）。
 * 有界：超过 limit 时按插入序淘汰最旧会话（Map 保序）。
 */
export class ClockThrottle {
  /** @param {number} limit - 跟踪的会话数上限 */
  constructor(limit = 2000) {
    this.limit = limit
    this.lastBySession = new Map()
  }

  /**
   * 提议注入：会话最新文本与本次相同则返回 null（跳过），否则记录并返回文本。
   * @param {string} sessionId - 会话标识（空串共用）。
   * @param {string} text - 本次注入文本。
   * @returns {string | null}
   */
  propose(sessionId, text) {
    if (this.lastBySession.get(sessionId) === text) return null
    this.lastBySession.set(sessionId, text)
    if (this.lastBySession.size > this.limit) {
      const oldest = this.lastBySession.keys().next().value
      this.lastBySession.delete(oldest)
    }
    return text
  }

  /** 当前跟踪的会话数。 */
  get size() {
    return this.lastBySession.size
  }
}
