// 桌面小组件：计算「下一项」摘要并推送给原生插件

import * as store from './store.js';
import { parseTime } from './util.js';

function plugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ScheduleWidget) || null;
}

function minutesOf(timeStr) {
  const t = parseTime(timeStr);
  return t ? t.h * 60 + t.m : null;
}

function epochToday(minutes) {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

export async function update() {
  const p = plugin();
  if (!p) return;
  const s = store.getState();
  if (!s) return;
  const t = s.templates[s.activeTemplate];
  if (!t) return;

  const rows = t.schedule
    .filter((r) => !r.deleted && minutesOf(r.time) != null)
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  const done = rows.filter((r) => r.done).length;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let next = null;
  for (const r of rows) {
    if (minutesOf(r.time) >= nowMin) { next = r; break; }
  }
  let nextEpochMs = 0;
  let nextTomorrow = false;
  if (!next && rows.length) {
    next = rows[0];
    nextTomorrow = true;
  }
  if (next) {
    nextEpochMs = epochToday(minutesOf(next.time));
    if (nextTomorrow) nextEpochMs += 86400000;
  }

  const label = next
    ? (next.feed.type + (next.play.length ? ' · ' + next.play.map((x) => x.text).slice(0, 2).join('、') : (next.sleep.label ? ' · 睡' + next.sleep.label : '')))
    : '今日安排已完成';

  const payload = {
    baby: s.baby.name || '宝宝',
    done,
    total: rows.length,
    nextTime: next ? next.time : '',
    nextLabel: label,
    nextEpochMs,
    updated: Date.now()
  };

  try { await p.update({ json: JSON.stringify(payload) }); } catch (e) { console.warn('widget update failed', e); }
}
