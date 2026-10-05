import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNavigationPeriod } from './period.mjs';

const period = (message, asOf = '2026-10-04', extra = {}) => resolveNavigationPeriod({ message, asOf, mode:'chat', ...extra });
const bounded = [
  ['rolling week', '帮我看看最近一周的变化', '2026-10-04', '2026-09-28', '2026-10-04'],
  ['this week is partial', '看看这周的状态', '2026-10-07', '2026-10-05', '2026-10-07'],
  ['last week', '回看上周', '2026-10-04', '2026-09-21', '2026-09-27'],
  ['last week crosses year', '上周', '2026-01-01', '2025-12-22', '2025-12-28'],
  ['yesterday leap year', '昨天', '2024-03-01', '2024-02-29', '2024-02-29'],
  ['recent three days', '最近3天', '2026-10-04', '2026-10-02', '2026-10-04'],
  ['Chinese number', '回看最近十三天', '2026-10-04', '2026-09-22', '2026-10-04'],
  ['missing years', '9月10日到10月3日', '2026-10-04', '2026-09-10', '2026-10-03'],
  ['missing years use client year', '回看9月10日到10月3日', '2027-10-04', '2027-09-10', '2027-10-03'],
  ['full cross year', '回看2025年12月25日至2026年1月2日', '2026-10-04', '2025-12-25', '2026-01-02'],
  ['ISO range', '回看2026-09-10到2026-10-03', '2026-10-04', '2026-09-10', '2026-10-03'],
  ['Chinese calendar', '回看九月十号到十月三号', '2026-10-04', '2026-09-10', '2026-10-03'],
  ['today is context for rolling week', '今天想回看最近一周', '2026-10-04', '2026-09-28', '2026-10-04'],
  ['previous month leap year', '回看上个月', '2024-03-09', '2024-02-01', '2024-02-29']
];
for (const [name, message, asOf, since, until] of bounded) test(name, () => {
  const found = period(message, asOf); assert.equal(found.kind,'bounded'); assert.equal(found.period.since,since); assert.equal(found.period.until,until); assert(found.period.basis);
});

for (const message of ['练习七天以后会熟吗', '我学过7天，但还没掌握', '每天看一点，怎么继续', '《昨天》这首歌让我想到朋友', '我明年毕业，最近有点迷茫', '下周怎么安排', '帮我想想下周学什么', '明天先做哪件事', '我9月10日去看了展，今天想聊方向', '我9月10日生日，想聊聊人生方向']) {
  test('ordinary conversation is not a lookback: ' + message, () => { const found=period(message); assert.equal(found.kind,'unbounded'); assert.equal(found.period.since,null); assert.equal(found.period.until,null); assert(!found.clarification); });
}
for (const message of ['最近', '这段时间', '看看这段时间有什么变化', '最近学过7天']) test('vague interval stays unfixed: ' + message, () => {
  const found=period(message); assert.equal(found.kind,'unbounded'); assert.equal(found.period.since,null); assert.match(found.period.basis,/没有换算成固定天数/);
});
for (const message of ['回看2026年2月30日', '回看9月31日到10月3日', '回看12月25日到1月2日', '回看9月10日到10月', '回看最近1000天', '回看最近三个月', '回看上周末', '回看下周的记录', '回看9月10日到今天', '回看9月10日之前']) test('unresolved requested interval asks once: ' + message, () => {
  const found=period(message); assert.equal(found.kind,'clarify'); assert.equal(found.period.since,null); assert(found.clarification); assert(!found.clarification.includes('填写表'));
});
test('two periods may be compared without asking to pick one', () => {
  const found=period('对比上周和这周的变化'); assert.equal(found.kind,'bounded'); assert.equal(found.period.since,'2026-09-21'); assert.equal(found.period.until,'2026-10-04'); assert.equal(found.period.segments.length,2); assert.match(found.period.basis,/分别对照/);
});
test('today remains an actual period in a yesterday/today comparison', () => {
  const found=period('对比昨天和今天的变化'); assert.equal(found.kind,'bounded'); assert.equal(found.period.since,'2026-10-03'); assert.equal(found.period.until,'2026-10-04'); assert.equal(found.period.segments.length,2);
});
test('legacy explicit bounds retain precedence and allow open endpoint', () => {
  const found=period('回看最近一周','2026-10-04',{mode:'review',since:'2026-09-10',until:'2026-10-03'}); assert.equal(found.period.since,'2026-09-10'); assert.equal(found.period.until,'2026-10-03');
  assert.equal(period('回看','2026-10-04',{mode:'review',since:'2026-09-10'}).period.until,null);
});
test('invalid asOf and explicit dates never use the server calendar', () => {
  assert.throws(()=>period('昨天','2026-02-30'),TypeError);
  assert.throws(()=>period('回看','2026-10-04',{since:'2026-02-30'}),TypeError);
});
