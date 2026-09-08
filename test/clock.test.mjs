import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, isRealUserMessage, hasRealUserMessage, clockText, ClockThrottle } from '../src/clock.mjs'

const SHAPE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

test('formatClock: Asia/Shanghai 偏移正确（UTC 零点 → 08:00）', () => {
  const now = new Date('2026-09-08T00:00:00Z')
  assert.equal(formatClock(now, 'Asia/Shanghai'), '2026-09-08 08:00')
})

test('formatClock: UTC 午夜输出 00 而非 24（hourCycle h23）', () => {
  const now = new Date('2026-09-08T00:05:00Z')
  assert.equal(formatClock(now, 'UTC'), '2026-09-08 00:05')
})

test('formatClock: 分钟取整不四舍五入到秒', () => {
  const now = new Date('2026-09-08T07:51:59Z')
  assert.equal(formatClock(now, 'UTC'), '2026-09-08 07:51')
})

test('formatClock: 空/缺省时区 = 本地（形状校验）', () => {
  assert.match(formatClock(new Date('2026-09-08T07:51:00Z'), ''), SHAPE)
  assert.match(formatClock(new Date('2026-09-08T07:51:00Z'), undefined), SHAPE)
  assert.match(formatClock(), SHAPE)
})

test('isRealUserMessage: 真实用户消息通过', () => {
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'user' } }), true)
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'user', rpcId: 'x' } }), true)
})

test('isRealUserMessage: 注入/快照/审批/目录均排除', () => {
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'plugin', plugin: 'dsh-time-ink' } }), false)
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt', form: 'snapshot' } }), false)
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'user-approval' } }), false)
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'skill-catalog' } }), false)
  assert.equal(isRealUserMessage({ role: 'user', source: { kind: 'agent-instructions' } }), false)
  assert.equal(isRealUserMessage({ role: 'user' }), false)
  assert.equal(isRealUserMessage({ role: 'assistant', source: { kind: 'user' } }), false)
  assert.equal(isRealUserMessage(null), false)
  assert.equal(isRealUserMessage(undefined), false)
})

test('hasRealUserMessage: 混合 messages 只认真实用户消息', () => {
  const injected = { role: 'user', source: { kind: 'plugin', plugin: 'dsh-adaptive-context' } }
  const real = { role: 'user', source: { kind: 'user' } }
  assert.equal(hasRealUserMessage([injected]), false)
  assert.equal(hasRealUserMessage([injected, real]), true)
  assert.equal(hasRealUserMessage([]), false)
  assert.equal(hasRealUserMessage(undefined), false)
})

test('clockText: 前缀拼接与裸时间', () => {
  const now = new Date('2026-09-08T07:51:00Z')
  assert.equal(clockText('当前时间：', 'UTC', now), '当前时间：2026-09-08 07:51')
  assert.equal(clockText('', 'UTC', now), '2026-09-08 07:51')
  assert.equal(clockText('当前时间：', 'Asia/Shanghai', now), '当前时间：2026-09-08 15:51')
})

test('ClockThrottle: 同文本跳过、异文本放行、空串共用槽', () => {
  const t = new ClockThrottle()
  assert.equal(t.propose('s1', '当前时间：2026-09-08 07:51'), '当前时间：2026-09-08 07:51')
  assert.equal(t.propose('s1', '当前时间：2026-09-08 07:51'), null)
  assert.equal(t.propose('s1', '当前时间：2026-09-08 07:52'), '当前时间：2026-09-08 07:52')
  assert.equal(t.propose('s2', '当前时间：2026-09-08 07:52'), '当前时间：2026-09-08 07:52')
  assert.equal(t.size, 2)
})

test('ClockThrottle: 超限淘汰最旧会话', () => {
  const t = new ClockThrottle(2)
  t.propose('a', 't1')
  t.propose('b', 't2')
  t.propose('c', 't3') // a 被淘汰
  assert.equal(t.size, 2)
  assert.equal(t.propose('a', 't4'), 't4') // a 重新可注入（槽已清）
})
