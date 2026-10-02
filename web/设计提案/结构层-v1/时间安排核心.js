/* Main-island planning estimates. No clock, storage, network, or progress mutation. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.IslandTimeCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DAY = 1440;
  const MIN_WINDOW = 10;

  function validMinute(value) {
    return Number.isSafeInteger(value) && value >= 0 && value < DAY * 3;
  }

  function parseTime(value) {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
    const parts = value.split(':').map(Number);
    return parts[0] < 24 && parts[1] < 60 ? parts[0] * 60 + parts[1] : null;
  }

  function formatTime(value) {
    if (!validMinute(value)) return '时间待确认';
    const day = Math.floor(value / DAY);
    const minute = value % DAY;
    const clock = String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
    return (day === 1 ? '次日 ' : day > 1 ? '第 ' + (day + 1) + ' 天 ' : '') + clock;
  }

  function windowItem(id, label, start, end, enabled, optional) {
    return { id, label, start, end, enabled, optional };
  }

  function template(mode, referenceMinute, duration) {
    if (!validMinute(referenceMinute)) throw new RangeError('开始时间需要有效的分钟数。');
    let windows;
    // Templates use the calendar day containing referenceMinute. A late arrival
    // leaves elapsed windows visible; evaluate never moves them into tomorrow.
    const dayStart = Math.floor(referenceMinute / DAY) * DAY;
    if (mode === 'full') {
      windows = [
        windowItem('morning', '上午', dayStart + 600, dayStart + 705, true, false),
        windowItem('afternoon', '下午', dayStart + 870, dayStart + 990, true, false),
        windowItem('evening', '晚上，可选', dayStart + 1170, dayStart + 1230, false, true)
      ];
    } else if (mode === 'afternoon') {
      windows = [
        windowItem('afternoon', '下午', dayStart + 870, dayStart + 990, true, false),
        windowItem('evening', '晚饭后', dayStart + 1170, dayStart + 1260, true, true)
      ];
    } else if (mode === 'block') {
      const length = duration === undefined ? 180 : duration;
      if (!Number.isSafeInteger(length) || length < MIN_WINDOW || length > DAY || !validMinute(referenceMinute + length)) {
        throw new RangeError('连续时段需要为 10—1440 分钟，并有有效的结束时间。');
      }
      windows = [windowItem('block', '这一段时间', referenceMinute, referenceMinute + length, true, false)];
    } else {
      throw new RangeError('请选择全天、下午＋晚上或一段时间。');
    }
    return { mode, reference: referenceMinute, windows };
  }

  function failure(error, windows) {
    return { ok: false, error, windows: windows || [], currentWindow: null, availableMinutes: 0, step: null, budget: null, later: [] };
  }

  function evaluate(input) {
    if (!input || typeof input !== 'object') return failure('请先选择一个时间入口。');
    if (!validMinute(input.reference)) return failure('请填写有效的开始时间。');
    if (!Array.isArray(input.windows)) return failure('请先设定可用时段。');
    if (input.taskType !== 'course' && input.taskType !== 'practice') return failure('请选择继续课程或推进练习／作品。');
    const lesson = input.lessonMinutes === undefined || input.lessonMinutes === null || input.lessonMinutes === '' ? null : input.lessonMinutes;
    if (input.taskType === 'course' && lesson !== null && (!Number.isSafeInteger(lesson) || lesson <= 0 || lesson > DAY)) {
      return failure('课长请填 1—1440 之间的整数分钟；暂时不知道可以留空。');
    }
    const ids = new Set();
    const windows = [];
    for (let i = 0; i < input.windows.length; i += 1) {
      const raw = input.windows[i];
      if (!raw || typeof raw !== 'object') return failure('有一个时段缺少起止时间。', windows);
      const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : '时段 ' + (i + 1);
      const id = typeof raw.id === 'string' && raw.id ? raw.id : 'window-' + i;
      if (ids.has(id)) return failure('时段标识重复，请重新选择时间入口。', windows);
      ids.add(id);
      if (!validMinute(raw.start) || !validMinute(raw.end) || raw.end <= raw.start) {
        return failure(label + '需要有效的起止时间；跨午夜请明确选择次日。', windows);
      }
      if (raw.end - raw.start < MIN_WINDOW || raw.end - raw.start > DAY) {
        return failure(label + '请保留至少 10 分钟，单段不超过 24 小时。', windows);
      }
      const effectiveStart = Math.max(raw.start, input.reference);
      const minutes = Math.max(0, raw.end - effectiveStart);
      windows.push({
        id, label, start: raw.start, end: raw.end,
        enabled: raw.enabled !== false, optional: raw.optional === true,
        effectiveStart, minutes, past: raw.end <= input.reference,
        usable: raw.enabled !== false && minutes >= MIN_WINDOW
      });
    }
    windows.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    const enabled = windows.filter(function (item) { return item.enabled; });
    for (let i = 1; i < enabled.length; i += 1) {
      if (enabled[i].start < enabled[i - 1].end) return failure('启用的时段有重叠，请先调整，避免重复计算时间。', windows);
    }
    const usable = windows.filter(function (item) { return item.usable; });
    const currentWindow = usable[0] || null;
    const availableMinutes = usable.reduce(function (sum, item) { return sum + item.minutes; }, 0);
    if (!currentWindow) {
      return {
        ok: true, windows, currentWindow: null, availableMinutes: 0,
        step: { kind: 'none', title: '今天先到这里，或调整可用时段', reason: '当前没有启用且还剩至少 10 分钟的时段。', finish: '已有内容保留；没有未完成的欠账。', estimate: '暂无可安排时间', estimateMinutes: 0 },
        budget: { reserve: 0, activity: 0, preparation: 0, rest: 0, closing: 0 },
        later: makeLater(windows, null, input.taskType)
      };
    }

    const capacity = currentWindow.minutes;
    // These are editable-planning estimates, not biological focus limits or
    // mandatory breaks. Short lessons should not inherit long-lesson overhead.
    const courseReserve = lesson === null ? 30 : lesson <= 20 ? 10 : lesson <= 60 ? 20 : 30;
    const reserveTarget = input.taskType === 'course' ? courseReserve : capacity >= 90 ? 30 : capacity >= 45 ? 15 : 10;
    const fitsCourse = input.taskType === 'course' && lesson !== null && lesson + courseReserve <= capacity;
    const reserve = fitsCourse ? courseReserve : Math.min(reserveTarget, Math.floor(capacity / 2));
    const preparation = Math.min(10, Math.floor(reserve / 3));
    const closing = Math.min(5, Math.floor(reserve / 6));
    const budget = { reserve, activity: capacity - reserve, preparation, rest: reserve - preparation - closing, closing };
    const intent = typeof input.intent === 'string' ? input.intent.trim() : '';
    let step;
    if (input.taskType === 'practice') {
      const estimate = Math.min(60, budget.activity);
      step = {
        kind: 'practice', title: capacity <= 30 ? '打开当前版本，只改一处' : '打开当前版本，推进一个具体问题',
        reason: intent ? '围绕“' + intent + '”直接实践，不必先看新课。' : '从已有草稿或作品开始，先挑一个具体问题，不必先看新课。',
        finish: '留下一份小样、一次修改，或一个清楚的停止处；做到其中一项即可。',
        estimate: '先用约 ' + estimate + ' 分钟，余下时间留给休息、比较与收尾。', estimateMinutes: estimate
      };
    } else if (lesson === null) {
      step = {
        kind: 'check', title: '找到这节课，确认时长与停止处',
        reason: '还不知道真实课长，先不假定能看完，也不替你编排章节。',
        finish: '知道这次要看哪一节、剩余多久，再决定整课或自然停点。',
        estimate: '约 5—10 分钟准备；看课用时待确认。', estimateMinutes: Math.min(10, budget.activity)
      };
    } else if (fitsCourse) {
      step = {
        kind: 'course', title: '打开这节课，连贯学到自然收尾',
        reason: '当前连续窗口放得下 ' + lesson + ' 分钟课程，并试留 ' + courseReserve + ' 分钟给准备、笔记暂停、休息与收尾；可按实际节奏调整。',
        finish: '看完本次选定课程，或按实际状态留自然停止处；观看完成不等于掌握。',
        estimate: lesson + ' 分钟课程，另试留 ' + courseReserve + ' 分钟准备、暂停与收尾。其余时间暂留弹性，应用随后再定。',
        estimateMinutes: lesson + courseReserve
      };
    } else {
      step = {
        kind: 'prepare', title: '整理这节课的材料，留下下次起点',
        reason: '这段剩余 ' + capacity + ' 分钟，放不下 ' + lesson + ' 分钟整课和暂估 ' + courseReserve + ' 分钟准备、休息与收尾。不同窗口不能拼成连续时间。',
        finish: '找到课程和纸笔，标出真实停止处；想只看一小段时，自行选择自然停点并调整本次范围。',
        estimate: '约 5—10 分钟准备；整课保留为后续候选。', estimateMinutes: Math.min(10, budget.activity)
      };
    }
    if (currentWindow.effectiveStart > input.reference) {
      step.reason += ' 这段从 ' + formatTime(currentWindow.effectiveStart) + ' 开始，之前的时间不计作学习。';
    }
    return {
      ok: true, windows, currentWindow, availableMinutes, step, budget,
      later: makeLater(windows, currentWindow, input.taskType)
    };
  }

  function makeLater(windows, current, taskType) {
    return windows.filter(function (item) {
      return !item.past && (!current || item.id !== current.id) && (!current || item.start >= current.end);
    }).map(function (item) {
      return {
        windowId: item.id, label: item.label, start: item.effectiveStart, end: item.end,
        minutes: item.minutes, enabled: item.enabled, optional: item.optional, candidate: true,
        title: !item.enabled ? '暂不安排，可以随时开启' : taskType === 'practice'
          ? '接着当前版本，按实际情况比较或修改'
          : '回来先看真实停止处，再决定继续课程或小应用'
      };
    });
  }

  return Object.freeze({ parseTime, formatTime, template, evaluate });
});
