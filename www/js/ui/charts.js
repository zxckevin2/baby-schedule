// 图表页：喂养趋势（天/周）+ 时间规律 + 成长趋势

import { h, fullDateLabel, todayStr } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import { setupCanvas, roundRect, FONT, isDark } from '../chart.js';
import { summarize, recDurationMin } from '../records.js';

let root = null;
let view = 'feeding';   // feeding | pattern | growth
let range = 'day';      // day | week
let viewDate = todayStr();

export function mount(c) { root = c; }

export function render() {
  if (!root) return;
  root.textContent = '';
  root.appendChild(topTabs());
  if (view === 'feeding') renderFeeding();
  else if (view === 'pattern') renderPattern();
  else renderGrowth();
}

function topTabs() {
  const wrap = h('div', { class: 'chart-tabs' });
  [['feeding', '喂养趋势'], ['pattern', '时间规律'], ['growth', '成长趋势']].forEach(([k, name]) => {
    const b = h('button', { class: 'ctab' + (view === k ? ' on' : ''), type: 'button', text: name });
    b.addEventListener('click', () => { haptics.tap(); view = k; render(); });
    wrap.appendChild(b);
  });
  return wrap;
}

function dateNav() {
  const wrap = h('div', { class: 'chart-nav' });
  const prev = h('button', { class: 'nav-btn', type: 'button', text: '‹' });
  const next = h('button', { class: 'nav-btn', type: 'button', text: '›' });
  const label = h('div', { class: 'nav-label', text: range === 'day' ? labelDay() : labelWeek() });
  const step = range === 'day' ? 1 : 7;
  prev.addEventListener('click', () => { haptics.tap(); viewDate = shift(viewDate, -step); render(); });
  next.addEventListener('click', () => { haptics.tap(); const n = shift(viewDate, step); if (n <= todayStr()) { viewDate = n; render(); } });
  wrap.appendChild(prev); wrap.appendChild(label); wrap.appendChild(next);
  return wrap;
}

function rangeToggle() {
  const wrap = h('div', { class: 'range-toggle' });
  [['day', '天'], ['week', '周']].forEach(([k, name]) => {
    const b = h('button', { class: 'rt' + (range === k ? ' on' : ''), type: 'button', text: name });
    b.addEventListener('click', () => { haptics.tap(); range = k; render(); });
    wrap.appendChild(b);
  });
  return wrap;
}

function shift(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function labelDay() { return (viewDate === todayStr() ? '今天 ' : '') + fullDateLabel(viewDate); }
function labelWeek() {
  const end = viewDate, start = shift(viewDate, -6);
  const f = (s) => { const d = new Date(s + 'T00:00:00'); return (d.getMonth() + 1) + '.' + String(d.getDate()).padStart(2, '0'); };
  return f(start) + ' - ' + f(end);
}

/* ---------------- 喂养趋势 ---------------- */
function renderFeeding() {
  root.appendChild(rangeToggle());
  root.appendChild(dateNav());
  if (range === 'day') renderDay();
  else renderWeek();
}

function renderDay() {
  const recs = store.recordsOf(viewDate);
  const canvasWrap = h('div', { class: 'chart-card' });
  canvasWrap.appendChild(h('div', { class: 'cc-title', text: '⏱️ 24 小时时间轴' }));
  const canvas = h('canvas');
  canvasWrap.appendChild(canvas);
  root.appendChild(canvasWrap);
  drawTimeline(canvas, viewDate, recs);

  const s = summarize(recs);
  const refs = store.activeRefs();
  root.appendChild(statCard('😴 睡眠', `${s.sleep.count} 次`,
    h('div', { class: 'stat-big', text: fmtMin(s.sleep.min) }),
    refs ? refRow('参考睡眠', refs.sleep[0] + '~' + refs.sleep[1] + ' 小时', s.sleep.min / 60, refs.sleep) : null,
    subGrid([['平均每次', s.sleep.count ? fmtMin(s.sleep.min / s.sleep.count) : '—']])));

  root.appendChild(statCard('🍼 瓶喂', `${s.bottle.count} 次`,
    h('div', { class: 'stat-big', text: s.bottle.ml + ' ml' }),
    refs ? refRow('参考奶量', refs.milk[0] + '~' + refs.milk[1] + ' ml', s.bottle.ml, refs.milk) : null));

  root.appendChild(statCard('🤱 亲喂', `${s.nursing.count} 次`,
    h('div', { class: 'stat-big', text: s.nursing.min ? s.nursing.min + ' 分钟' : '—' })));

  root.appendChild(statCard('💩 换尿布', `${s.diaper.count} 次`,
    h('div', { class: 'stat-sub', text: `尿 ${s.diaper.pee} · 大便 ${s.diaper.poop}` })));
}

function renderWeek() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const ds = shift(viewDate, -i);
    days.push({ date: ds, recs: store.recordsOf(ds) });
  }
  const canvasWrap = h('div', { class: 'chart-card' });
  canvasWrap.appendChild(h('div', { class: 'cc-title', text: '📊 每日奶量与睡眠' }));
  const canvas = h('canvas');
  canvasWrap.appendChild(canvas);
  root.appendChild(canvasWrap);
  drawWeekBars(canvas, days);
  canvasWrap.appendChild(h('div', { class: 'legend' },
    h('span', { class: 'lg' }, h('i', { class: 'dot milk' }), h('span', { text: '奶量(ml)' })),
    h('span', { class: 'lg' }, h('i', { class: 'dot sleep' }), h('span', { text: '睡眠(h)' }))));
}

/* ---------------- 时间规律 ---------------- */
function renderPattern() {
  root.appendChild(dateNav());
  const canvasWrap = h('div', { class: 'chart-card' });
  canvasWrap.appendChild(h('div', { class: 'cc-title', text: '🗓️ 一周作息分布（0–24 时）' }));
  const canvas = h('canvas');
  canvasWrap.appendChild(canvas);
  root.appendChild(canvasWrap);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const ds = shift(viewDate, -i);
    days.push({ date: ds, recs: store.recordsOf(ds) });
  }
  drawPattern(canvas, days);
}

/* ---------------- 成长趋势（Phase 3） ---------------- */
function renderGrowth() {
  root.appendChild(h('div', { class: 'chart-card' }, h('div', { class: 'cc-title', text: '📏 成长趋势' }),
    h('div', { class: 'empty', text: '📈 身高 / 体重 / 头围 生长曲线 —— 即将上线' })));
}

/* ---------------- 卡片 ---------------- */
function statCard(title, badge, ...rest) {
  const card = h('div', { class: 'stat-card' });
  card.appendChild(h('div', { class: 'stat-head' }, h('div', { class: 'stat-title', text: title }), h('div', { class: 'stat-badge', text: badge })));
  rest.filter(Boolean).forEach((el) => card.appendChild(el));
  return card;
}
function refRow(label, rangeText, value, ref) {
  const pct = Math.max(0, Math.min(100, (value / (ref[1] || 1)) * 100));
  const wrap = h('div', { class: 'ref-row' });
  wrap.appendChild(h('div', { class: 'ref-top' }, h('span', { class: 'ref-label', text: label }), h('span', { class: 'ref-range', text: rangeText })));
  const bar = h('div', { class: 'ref-bar' }, h('div', { class: 'ref-fill', style: { width: pct + '%' } }));
  wrap.appendChild(bar);
  return wrap;
}
function subGrid(pairs) {
  const grid = h('div', { class: 'stat-grid' });
  pairs.forEach(([k, v]) => grid.appendChild(h('div', { class: 'stat-cell' }, h('div', { class: 'sc-k', text: k }), h('div', { class: 'sc-v', text: v }))));
  return grid;
}
function fmtMin(min) {
  min = Math.round(min);
  const hh = Math.floor(min / 60), mm = min % 60;
  if (hh > 0) return hh + '时' + (mm ? mm + '分' : '');
  return mm + '分';
}

/* ---------------- 绘制 ---------------- */
function drawTimeline(canvas, dateStr, recs) {
  const w = canvas.parentElement.clientWidth - 24;
  const hCss = 96;
  if (w <= 40) return;
  const ctx = setupCanvas(canvas, w, hCss);
  const dark = isDark();
  ctx.clearRect(0, 0, w, hCss);
  const x0 = 6, x1 = w - 6, y = 34, barH = 26;
  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const dayEnd = dayStart + 86400000;
  const end = Math.min(Date.now(), dayEnd);
  const X = (ts) => x0 + ((Math.max(dayStart, Math.min(ts, dayEnd)) - dayStart) / (dayEnd - dayStart)) * (x1 - x0);

  // 轨道
  ctx.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  roundRect(ctx, x0, y, x1 - x0, barH, barH / 2); ctx.fill();

  recs.slice().sort((a, b) => a.startTs - b.startTs).forEach((r) => {
    if (r.type === 'sleep') {
      const s = Math.max(r.startTs, dayStart);
      const e = Math.min(r.endTs || end, dayEnd);
      if (e <= s) return;
      ctx.fillStyle = '#7c86d6';
      roundRect(ctx, X(s), y, Math.max(3, X(e) - X(s)), barH, 6); ctx.fill();
    }
  });
  recs.forEach((r) => {
    if (r.type === 'bottle' || r.type === 'nursing') {
      ctx.fillStyle = '#e0a94a';
      ctx.beginPath(); ctx.arc(X(r.startTs), y - 8, 4, 0, Math.PI * 2); ctx.fill();
    } else if (r.type === 'diaper') {
      ctx.fillStyle = '#8b7a5a';
      ctx.beginPath(); ctx.arc(X(r.startTs), y + barH + 8, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  });

  // 刻度
  ctx.fillStyle = dark ? '#9cab86' : '#7d8a6b';
  ctx.font = `400 10px ${FONT}`;
  ctx.textBaseline = 'top';
  for (let hh = 0; hh <= 24; hh += 3) {
    const x = x0 + (hh / 24) * (x1 - x0);
    ctx.textAlign = hh === 0 ? 'left' : hh === 24 ? 'right' : 'center';
    ctx.fillText(String(hh), Math.max(x0, Math.min(x, x1)), y + barH + 16);
  }
  ctx.textAlign = 'left';
}

function drawWeekBars(canvas, days) {
  const w = canvas.parentElement.clientWidth - 24;
  const hCss = 200;
  if (w <= 40) return;
  const ctx = setupCanvas(canvas, w, hCss);
  const dark = isDark();
  ctx.clearRect(0, 0, w, hCss);
  const padL = 30, padB = 24, padT = 10;
  const x0 = padL, x1 = w - 8, y0 = padT, y1 = hCss - padB;
  const data = days.map((d) => {
    const s = summarize(d.recs);
    return { label: d.date.slice(5), milk: s.bottle.ml, sleepH: s.sleep.min / 60 };
  });
  const maxMilk = Math.max(300, ...data.map((d) => d.milk));
  const maxSleep = Math.max(6, ...data.map((d) => d.sleepH));
  const colW = (x1 - x0) / data.length;
  const bw = Math.min(14, colW / 3);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  ctx.fillStyle = dark ? '#9cab86' : '#7d8a6b';
  ctx.font = `400 10px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  data.forEach((d, i) => {
    const cx = x0 + colW * i + colW / 2;
    const mh = (d.milk / maxMilk) * (y1 - y0);
    ctx.fillStyle = '#e0a94a';
    roundRect(ctx, cx - bw - 2, y1 - mh, bw, Math.max(1, mh), 4); ctx.fill();
    const sh = (d.sleepH / maxSleep) * (y1 - y0);
    ctx.fillStyle = '#7c86d6';
    roundRect(ctx, cx + 2, y1 - sh, bw, Math.max(1, sh), 4); ctx.fill();
    ctx.fillStyle = dark ? '#9cab86' : '#7d8a6b';
    ctx.fillText(d.label, cx, y1 + 6);
  });
  ctx.textAlign = 'left';
}

function drawPattern(canvas, days) {
  const w = canvas.parentElement.clientWidth - 24;
  const hCss = 340;
  if (w <= 40) return;
  const ctx = setupCanvas(canvas, w, hCss);
  const dark = isDark();
  ctx.clearRect(0, 0, w, hCss);
  const padL = 26, padR = 6, padT = 6, padB = 26;
  const x0 = padL, x1 = w - padR, y0 = padT, y1 = hCss - padB;
  const colW = (x1 - x0) / 7;
  const Y = (hour) => y0 + (hour / 24) * (y1 - y0);
  // 网格
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)';
  ctx.fillStyle = dark ? '#9cab86' : '#7d8a6b';
  ctx.font = `400 9px ${FONT}`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let hh = 0; hh <= 24; hh += 3) {
    const yy = Y(hh);
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
    ctx.fillText(String(hh), x0 - 4, yy);
  }
  days.forEach((d, i) => {
    const cx = x0 + colW * i + colW / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = dark ? '#9cab86' : '#7d8a6b';
    const dd = new Date(d.date + 'T00:00:00');
    ctx.fillText('周' + ['日', '一', '二', '三', '四', '五', '六'][dd.getDay()], cx, y1 + 6);
    d.recs.forEach((r) => {
      if (r.type === 'sleep') {
        const sH = hourOfDay(r.startTs);
        let eH = r.endTs ? hourOfDay(r.endTs) : hourOfDay(Date.now());
        if (eH <= sH) eH = Math.min(24, eH + 24);
        ctx.fillStyle = 'rgba(124,134,214,.75)';
        roundRect(ctx, cx - colW * 0.3, Y(sH), colW * 0.6, Math.max(3, Y(eH) - Y(sH)), 3); ctx.fill();
      } else if (r.type === 'bottle' || r.type === 'nursing') {
        ctx.fillStyle = '#e0a94a';
        ctx.beginPath(); ctx.arc(cx, Y(hourOfDay(r.startTs)), 3, 0, Math.PI * 2); ctx.fill();
      } else if (r.type === 'diaper') {
        ctx.fillStyle = '#8b7a5a';
        ctx.beginPath(); ctx.arc(cx, Y(hourOfDay(r.startTs)), 2.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  });
  ctx.textAlign = 'left';
}

function hourOfDay(ts, orPrev) {
  const d = new Date(ts);
  return d.getHours() + d.getMinutes() / 60;
}
