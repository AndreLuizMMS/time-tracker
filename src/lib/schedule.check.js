// Self-check: node src/lib/schedule.check.js
import assert from 'node:assert/strict'
import { organizeDay } from './schedule.js'
import { timeToSecs } from './format.js'

const mk = (id, start, end, manualTime = false) => ({ id, start, end, dur: timeToSecs(end) - timeToSecs(start), manualTime })
const H = 3600
const day = [
  mk(1, '10:00', '11:00', true),  // fixa
  mk(2, '08:00', '10:30'),        // 2h30 flexível
  mk(3, '15:00', '17:00'),        // 2h flexível
  mk(4, '16:00', '16:30'),
]
const out = organizeDay(day, 100)
const fixed = out.find(e => e.id === 1)
assert.deepEqual([fixed.start, fixed.end], ['10:00', '11:00'], 'fixa não se move')
const iv = e => [timeToSecs(e.start), timeToSecs(e.start) + e.dur]
const flex = out.filter(e => !e.manualTime)
assert.equal(flex.reduce((s, e) => s + e.dur, 0), 2.5 * H + 2 * H + 0.5 * H, 'horas preservadas')
const all = out.map(iv).sort((a, b) => a[0] - b[0])
for (let i = 1; i < all.length; i++) assert(all[i][0] >= all[i - 1][1], 'sem sobreposição')
for (const [s, e] of flex.map(iv)) assert(e <= 12 * H || s >= 13 * H + 40 * 60, 'almoço pulado')
assert(flex.every(e => !e.start || timeToSecs(e.start) >= 9 * H), 'começa às 9h')
console.log('schedule.check OK')
