// Bounded Chinese date rules. Relative dates use the request's frozen client
// calendar date, never the server clock or a model classification call.
const DAY = 86400000;
const CN = '[零〇一二两三四五六七八九十]{1,3}';
const NUMBER = `(?:\\d{1,3}|${CN})`;
const DATE = `(?:[1-9]\\d{3}[-/]\\d{1,2}[-/]\\d{1,2}|(?:[1-9]\\d{3}年)?(?:\\d{1,2}|${CN})月(?:\\d{1,2}|${CN})(?:日|号))`;

export function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function move(date, days) { return new Date(new Date(date + 'T00:00:00Z').getTime() + days * DAY).toISOString().slice(0, 10); }
function number(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const digits = { 零:0, 〇:0, 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
  if (text === '十') return 10;
  if (text.includes('十')) {
    const parts = text.split('十');
    if (parts.length !== 2 || parts.some(part => part.length > 1) || parts.some(part => part && !Object.hasOwn(digits, part))) return NaN;
    return (parts[0] ? digits[parts[0]] : 1) * 10 + (parts[1] ? digits[parts[1]] : 0);
  }
  return text.length === 1 && Object.hasOwn(digits, text) ? digits[text] : NaN;
}
function dateParts(text) {
  const iso = /^([1-9]\d{3})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (iso) return { year:Number(iso[1]), month:Number(iso[2]), day:Number(iso[3]), explicitYear:true };
  const chinese = /^([1-9]\d{3}年)?(.+)月(.+)(?:日|号)$/.exec(text);
  return chinese ? { year:chinese[1] ? Number(chinese[1].slice(0,-1)) : null, month:number(chinese[2]), day:number(chinese[3]), explicitYear:!!chinese[1] } : null;
}
function dateFrom(parts, fallbackYear) {
  if (!parts) return null;
  const value = `${parts.year ?? fallbackYear}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
  return validCalendarDate(value) ? value : null;
}
function result(kind, since, until, label, basis, clarification) {
  return Object.freeze({ kind, period:Object.freeze({ since, until, label, basis }), ...(clarification ? { clarification } : {}) });
}
function clarify(text, detail) {
  return result('clarify', null, null, '日期范围待确认', detail, text);
}
function unbounded(text, mode) {
  const vague = /这段时间|这一段时间|最近|近期|近来|前几天|这些天|这阵子/.exec(text);
  return result('unbounded', null, null, '已有记录，未限定日期', vague ? `“${vague[0]}”没有换算成固定天数；所用范围以实际选取的已存记录为准，不代表全部生活。` : `${mode === 'review' ? '未填写回看起止日期' : '本次没有明确要求按日期筛选记录；叙述和规划中的日期保留在原问题中'}；所用范围以实际选取的已存记录为准。`);
}

export function resolveNavigationPeriod({ message, asOf, since, until, mode = 'chat' }) {
  if (!validCalendarDate(asOf)) throw new TypeError('asOf must be a valid YYYY-MM-DD calendar date');
  if (since && !validCalendarDate(since) || until && !validCalendarDate(until) || since && until && since > until) throw new TypeError('Invalid explicit date interval');
  if (since || until) return result('bounded', since || null, until || null, '指定日期范围', '使用请求中明确提供的起止日期；起止当日均包含。');
  const original = String(message ?? '');
  // A book/song title or code example is not an instruction to select dates.
  let remaining = original.normalize('NFKC').replace(/《[^》]*》|`[^`]*`/g, ' ').replace(/\s+/g, ' ');
  const comparison = /对比|比较|相比|对照/.test(remaining);
  const retrospective = /回看|回顾|复盘|翻看|找回|(?:查找|检索|对比|比较|看看|看一下|查看).{0,24}(?:记录|旅程|日记|经历)|(?:记录|旅程|日记).{0,12}(?:对比|比较|回看)/.test(remaining);
  const futureContext = /明天|后天|下周|下个月|明年/.test(remaining);
  const temporalToken = `(?:${DATE}|(?:最近|近|过去)(?:的)?${NUMBER}(?:个)?(?:天|周|星期)|这周|本周|上周|这个星期|上个星期|本星期|上星期|昨天|前天|今天|本月|这个月|上个月|今年|去年)`;
  const dateOnly = new RegExp(`^\\s*${temporalToken}(?:\\s*(?:到|至|直到|[~～—–-]|和|、)\\s*${temporalToken})?[？?！!。\\s]*$`).test(remaining);
  const reflective = /总结|梳理|整理|变化|收获|卡点|反复|状态|表现|发生了什么|做了什么|过得|怎么样|看看|看一下|帮我看|分析/.test(remaining);
  // A date mentioned as biography or a future plan must not shrink the whole
  // personal context. Selection starts only for a lookback or a date-only reply.
  if (mode !== 'review' && !retrospective && !dateOnly && !(reflective && !futureContext)) return unbounded(remaining, mode);
  const unsupportedRange = new RegExp(`(?:${DATE})\\s*(?:(?:到|至|直到)\\s*(?:今天|昨天|前天|明天)|以来|之前|之后|以前|以后)|(?:截至|直到|截止到)\\s*(?:${DATE})`).exec(remaining);
  if (unsupportedRange) return clarify('这个起止说法还不能准确换成日期范围，你想从哪一天看到哪一天？', unsupportedRange[0]);
  const candidates = [];
  const year = Number(asOf.slice(0,4));
  const range = new RegExp(`(${DATE})\\s*(?:到|至|直到|[~～—–-])\\s*(${DATE})`, 'g');
  let failure = null;
  remaining = remaining.replace(range, (whole, startText, endText) => {
    const start = dateParts(startText), end = dateParts(endText);
    const selectedYear = start?.year ?? end?.year ?? year;
    const from = dateFrom(start, selectedYear), to = dateFrom(end, selectedYear);
    if (!from || !to) failure = clarify('这段起止日期里有一天不在日历上，你想从哪一天看到哪一天？直接说一句就好。', whole);
    else if (from > to) failure = clarify('这段日期的结束早于开始；如果是跨年，你想从哪一年的哪一天看到哪一天？', whole);
    else candidates.push({ since:from, until:to, label:whole, basis:start.explicitYear && end.explicitYear ? '使用明确日期，起止当日均包含。' : `省略的年份按${selectedYear}年；起止当日均包含。` });
    return ' ';
  });
  if (failure) return failure;
  const single = new RegExp(DATE, 'g');
  remaining = remaining.replace(single, whole => {
    const parts = dateParts(whole), date = dateFrom(parts, year);
    if (!date) failure = clarify('这个日期不在日历上，你指的是哪一天？可以直接更正日期。', whole);
    else candidates.push({ since:date, until:date, label:whole, basis:parts.explicitYear ? '使用明确的这一天。' : `省略的年份按客户端日期所在的${year}年。` });
    return ' ';
  });
  if (failure) return failure;

  const rolling = new RegExp(`(?:最近|近|过去)(?:的)?(${NUMBER})(?:个)?(天|周|星期)(?!目)`, 'g');
  remaining = remaining.replace(rolling, (whole, amount, unit, offset, text) => {
    const days = number(amount) * (unit === '天' ? 1 : 7);
    if (!Number.isSafeInteger(days) || days < 1 || days > 366 || /^(?:以?后|之后|以前|之前)/.test(text.slice(offset + whole.length))) {
      failure = clarify('这个期间还不能准确换成起止日期，你想从哪一天看到哪一天？直接说日期即可。', whole);
    } else candidates.push({ since:move(asOf, 1-days), until:asOf, label:whole + '（含当日）', basis:`以客户端日期${asOf}为准，取连续${days}个日历日。` });
    return ' ';
  });
  if (failure) return failure;

  const fixed = /这周(?!末)|本周(?!末)|这个星期(?!末)|本星期(?!末)|上周(?!末)|上个星期(?!末)|上星期(?!末)|昨天|前天|今天|本月|这个月|上个月|今年|去年/g;
  remaining = remaining.replace(fixed, whole => {
    let from, to;
    if (/星期|周/.test(whole)) {
      const weekday = new Date(asOf + 'T00:00:00Z').getUTCDay();
      const monday = move(asOf, -((weekday + 6) % 7));
      const previous = whole.startsWith('上'); from = previous ? move(monday,-7) : monday; to = previous ? move(monday,-1) : asOf;
    } else if (/月/.test(whole)) {
      const first = asOf.slice(0,7) + '-01';
      to = whole === '上个月' ? move(first,-1) : asOf; from = whole === '上个月' ? to.slice(0,7) + '-01' : first;
    } else if (whole === '今年' || whole === '去年') { from = `${whole === '去年' ? year-1 : year}-01-01`; to = whole === '去年' ? `${year-1}-12-31` : asOf; }
    else { from = move(asOf, whole === '昨天' ? -1 : whole === '前天' ? -2 : 0); to = from; }
    candidates.push({ since:from, until:to, label:whole, basis:`以客户端日期${asOf}为准；自然周从周一开始，本周或本月截至当日。`, contextualToday:whole === '今天' });
    return ' ';
  });

  // Reject an explicit but unsupported or only partially consumed interval.
  // Durations such as “练习七天” contain none of these date-selection patterns.
  const unresolved = /[1-9]\d{3}[-/]\d|[1-9]\d{3}年|[一二两三四五六七八九十\d]+月(?:份|[一二三四五六七八九十\d]+)?|(?:最近|近|过去)[一二两三四五六七八九十百半\d]+(?:个)?(?:天|周|星期|月|年)|(?:上|这|本|下)周末|(?:明天|后天|下周|下个月|去年|今年|明年)/.exec(remaining);
  if (unresolved) return clarify('这次的日期范围还没确定清楚，你想从哪一天看到哪一天？直接说一句即可。', unresolved[0]);

  // “今天想回看最近一周” uses today as the conversational anchor.
  const anchorToday = /^\s*今天(?:我|想|要|来|我们|请|帮|[，,])/.test(original);
  const scoped = candidates.length > 1 && anchorToday && !comparison ? candidates.filter(item => !item.contextualToday) : candidates;
  const unique = [...new Map(scoped.map(item => [item.since + '/' + item.until, item])).values()];
  if (unique.length > 1 && comparison && unique.length <= 3) {
    const segments = unique.map(({since,until,label}) => Object.freeze({since,until,label}));
    const from = unique.map(item => item.since).sort()[0], to = unique.map(item => item.until).sort().at(-1);
    const description = unique.map(item => `${item.label}（${item.since}至${item.until}）`).join('与');
    const base = result('bounded', from, to, unique.map(item => item.label).join('与') + '的记录对照', `分别对照${description}；本次读取覆盖这些期间的共同外包范围。若期间不连续，中间记录仅作背景，不混成一段；没有记录不等于没有经历。`);
    return Object.freeze({...base,period:Object.freeze({...base.period,segments:Object.freeze(segments)})});
  }
  if (unique.length > 1) return clarify('你提到了不止一个期间，这次想看哪一段？也可以直接说“对比这两段”。', unique.map(item => item.label).join('、'));
  if (unique.length === 1) {
    const item = unique[0];
    return result('bounded', item.since, item.until, item.label, item.basis);
  }
  return unbounded(remaining, mode);
}
