// 记录页：今日时间线 + 汇总胶囊 + 底部快捷打点

import { h, fullDateLabel, todayStr, ageLabel } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import * as sync from '../cloud/sync.js';
import { openForm } from './recordForm.js';
import { TYPES, typeMeta, timeStr, agoLabel, gapMin, orderByType, summarize, recordTitle, recordDetail, recordRight } from '../records.js';

let root = null;

export function mount(c) { root = c; }

export function render() {
  if (!root) return;
  const date = todayStr();
  const recs = store.recordsOf(date);
  root.textContent = '';
  root.appendChild(head());
  root.appendChild(summaryBar(recs));
  root.appendChild(timeline(recs));
  root.appendChild(quickBar());
}

function head() {
  const s = store.getState();
  const name = (s.baby && s.baby.name) || '宝宝';
  const age = s.baby && s.baby.birthday ? ' · ' + ageLabel(s.baby.birthday) : '';
  return h('div', { class: 'rec-head' },
    h('div', { class: 'rec-avatar', text: '👶' }),
    h('div', {},
      h('div', { class: 'rec-name', text: name + age }),
      h('div', { class: 'rec-date', text: '今天 · ' + fullDateLabel(todayStr()) })));
}

function summaryBar(recs) {
  const s = summarize(recs);
  const chips = [];
  if (s.bottle.count) chips.push(`🍼 ${s.bottle.count}次 ${s.bottle.ml}ml`);
  if (s.nursing.count) chips.push(`🤱 ${s.nursing.count}次${s.nursing.min ? ' ' + s.nursing.min + '分' : ''}`);
  if (s.sleep.count) chips.push(`😴 ${s.sleep.count}次${s.sleep.min ? ' ' + fmt(s.sleep.min) : ''}`);
  if (s.diaper.count) chips.push(`💩 ${s.diaper.count}次`);
  if (s.supplement.count) chips.push(`💊 ${s.supplement.count}次`);
  const wrap = h('div', { class: 'rec-summary' });
  if (!chips.length) wrap.appendChild(h('span', { class: 'rec-sum-chip', text: '今天还没有记录，点下面的按钮开始吧 🍼' }));
  else chips.forEach((c) => wrap.appendChild(h('span', { class: 'rec-sum-chip', text: c })));
  return wrap;
}

function fmt(min) {
  min = Math.round(min);
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh > 0 ? hh + '时' + (mm ? mm + '分' : '') : mm + '分';
}

function timeline(recs) {
  const wrap = h('div', { class: 'rec-timeline' });
  if (!recs.length) {
    wrap.appendChild(h('div', { class: 'empty', text: '🌱 今天还没有记录' }));
    return wrap;
  }
  // 预先算每类型的升序，用于间隔
  const asc = {};
  for (const t of TYPES) asc[t.key] = orderByType(recs, t.key);

  const now = Date.now();
  recs.forEach((r) => {
    const m = typeMeta(r.type);
    const gap = gapMin(r, asc[r.type]);
    const left = h('div', { class: 'tl-left' },
      h('div', { class: 'tl-time', text: timeStr(r.startTs) }),
      gap != null ? h('div', { class: 'tl-gap', text: fmt(gap) }) : null);
    const card = h('div', { class: 'tl-card' + (r.endTs === null && r.type === 'sleep' ? ' ongoing' : '') },
      h('div', { class: 'tl-ico', text: m.ico }),
      h('div', { class: 'tl-main' },
        h('div', { class: 'tl-title', text: recordTitle(r) }),
        recordDetail(r, now) ? h('div', { class: 'tl-sub', text: recordDetail(r, now) }) : null),
      h('div', { class: 'tl-right', text: recordRight(r, now) }));
    card.addEventListener('click', () => { haptics.tap(); openForm({ type: r.type, record: r, onDone: render }); });
    wrap.appendChild(h('div', { class: 'tl-item' }, left, card));
  });
  return wrap;
}

function quickBar() {
  const bar = h('div', { class: 'rec-quick' });
  const ongoing = store.ongoingSleep();
  TYPES.forEach((t) => {
    let label = 'ag';
    const last = store.lastOfType(t.key);
    let sub = last ? agoLabel(last.endTs || last.startTs) : '暂无';
    if (t.key === 'sleep' && ongoing) sub = '进行中';
    const btn = h('button', { class: 'qb' + (t.key === 'sleep' && ongoing ? ' active' : ''), type: 'button' },
      h('div', { class: 'qb-ico', text: t.ico }),
      h('div', { class: 'qb-name', text: t.name }),
      h('div', { class: 'qb-sub', text: sub }));
    btn.addEventListener('click', () => {
      haptics.tap();
      if (t.key === 'sleep' && ongoing) {
        store.updateRecord(ongoing.uid, { endTs: Date.now() });
        sync.schedulePush();
        render();
        return;
      }
      openForm({ type: t.key, onDone: render });
    });
    bar.appendChild(btn);
  });
  const more = h('button', { class: 'qb qb-add', type: 'button' },
    h('div', { class: 'qb-ico', text: '＋' }),
    h('div', { class: 'qb-name', text: '补录' }),
    h('div', { class: 'qb-sub', text: '' }));
  more.addEventListener('click', () => { haptics.tap(); pickType(); });
  bar.appendChild(more);
  return bar;
}

function pickType() {
  const overlay = h('div', { class: 'modal-overlay' });
  const box = h('div', { class: 'modal-box' });
  box.appendChild(h('div', { class: 'modal-title', text: '选择记录类型' }));
  const list = h('div', { class: 'pick-list' });
  TYPES.forEach((t) => {
    const b = h('button', { class: 'pick-item', type: 'button' }, h('span', { class: 'pick-ico', text: t.ico }), h('span', { text: t.name }));
    b.addEventListener('click', () => { overlay.remove(); openForm({ type: t.key, onDone: render }); });
    list.appendChild(b);
  });
  box.appendChild(list);
  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
