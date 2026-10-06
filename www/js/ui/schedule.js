// 作息页：磨玻璃卡片 + 可点胶囊 + 奶量滑块 + 原生时间选择器

import { h, normTime, promptInput } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import * as widget from '../widget.js';
import { FEED_PRESETS, SLEEP_PRESETS } from '../templates.js';
import { ensurePermission, syncAll } from '../notifications.js';

let root = null;

export function mount(container) { root = container; }

export function render() {
  if (!root) return;
  const t = store.activeTemplate();
  root.textContent = '';
  root.appendChild(renderBar(t));
  const list = h('div', { class: 'schedule-list' });
  const rows = t.schedule.filter((r) => !r.deleted);
  if (!rows.length) list.appendChild(h('div', { class: 'empty', text: '暂无安排，点「＋ 添加一行」开始' }));
  rows.forEach((row) => list.appendChild(renderCard(row, t)));
  root.appendChild(list);
  widget.update();
}

function progress(t) {
  const rows = t.schedule.filter((r) => !r.deleted);
  return { done: rows.filter((r) => r.done).length, total: rows.length };
}

function renderBar(t) {
  const bar = h('div', { class: 'page-bar' });

  const chips = h('div', { class: 'template-chips' });
  const templates = store.getState().templates;
  for (const id of Object.keys(templates)) {
    const c = h('button', { class: 'tchip' + (id === store.getState().activeTemplate ? ' on' : ''), type: 'button', text: templates[id].name });
    c.addEventListener('click', () => {
      haptics.tap();
      store.setActive(id, true);
      render();
      syncAll(store.getState());
    });
    chips.appendChild(c);
  }
  bar.appendChild(chips);

  const p = progress(t);
  bar.appendChild(h('div', { class: 'progress', text: `已完成 ${p.done}/${p.total}` }));

  const tools = h('div', { class: 'toolbar' });
  const newDay = h('button', { class: 'btn btn-primary', type: 'button', text: '新的一天' });
  newDay.addEventListener('click', () => { haptics.tap(); store.newDay(); render(); syncAll(store.getState()); });
  const add = h('button', { class: 'btn btn-ghost', type: 'button', text: '＋ 添加一行' });
  add.addEventListener('click', () => { haptics.tap(); const row = store.addRow(); render(); focusTime(row.id); });
  tools.appendChild(newDay);
  tools.appendChild(add);
  bar.appendChild(tools);

  return bar;
}

function focusTime(rowId) {
  const cards = root.querySelectorAll('.card');
  for (const c of cards) {
    if (+c.dataset.id === rowId) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = c.querySelector('.time'); if (i) i.focus(); break; }
  }
}

function singleSelectChips(values, current, onPick) {
  const wrap = h('div', { class: 'chips' });
  const list = values.slice();
  if (current && !list.includes(current)) list.unshift(current);
  const mk = (val) => {
    const c = h('button', { class: 'chip' + (val === current ? ' on' : ''), type: 'button', text: val || '—' });
    c.addEventListener('click', () => {
      if (val === current) return;
      haptics.tap();
      current = val;
      wrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
      onPick(val);
    });
    return c;
  };
  list.forEach((v) => wrap.appendChild(mk(v)));
  return wrap;
}

function renderCard(row, t) {
  const card = h('div', { class: 'card' + (row.done ? ' done' : ''), 'data-id': row.id });

  const top = h('div', { class: 'card-top' });
  const cb = h('input', { type: 'checkbox' });
  cb.checked = row.done;
  const check = h('label', { class: 'check' }, cb, h('span', { class: 'box' }));
  cb.addEventListener('change', () => {
    haptics.tap();
    row.done = cb.checked;
    card.classList.toggle('done', row.done);
    store.save();
    refreshProgress();
    widget.update();
  });
  top.appendChild(check);

  const time = h('input', { class: 'time', type: 'time', value: normTime(row.time) });
  time.addEventListener('change', () => {
    row.time = time.value;
    store.save();
    syncAll(store.getState());
    widget.update();
  });
  top.appendChild(time);

  const bell = h('button', { class: 'icon-btn bell' + (row.remind ? ' on' : ''), type: 'button' });
  const bellIco = h('span', { class: 'ico', text: '🔔' });
  bell.appendChild(bellIco);
  bell.addEventListener('click', async () => {
    haptics.tap();
    if (!row.remind) {
      const ok = await ensurePermission();
      if (!ok) return;
      if (!row.time) return;
      row.remind = true;
    } else {
      row.remind = false;
    }
    bell.classList.toggle('on', row.remind);
    store.save();
    await syncAll(store.getState());
  });
  top.appendChild(bell);

  const del = h('button', { class: 'icon-btn del', type: 'button' }, h('span', { class: 'ico', text: '🗑' }));
  del.addEventListener('click', () => { haptics.tap(); store.softDeleteRow(row.id); render(); syncAll(store.getState()); });
  top.appendChild(del);
  card.appendChild(top);

  // 吃
  const feedRow = h('div', { class: 'frow' }, h('span', { class: 'flabel', text: '吃' }));
  feedRow.appendChild(singleSelectChips(FEED_PRESETS, row.feed.type, (v) => { row.feed.type = v; store.save(); widget.update(); }));
  card.appendChild(feedRow);

  // 奶量滑块独占一行，与胶囊左对齐
  const amtLabel = h('span', { class: 'sl-val', text: row.feed.amountMl ? row.feed.amountMl + 'ml' : '—' });
  const slider = h('input', { type: 'range', min: '0', max: '240', step: '10', value: String(row.feed.amountMl || 0) });
  slider.addEventListener('input', () => {
    const v = +slider.value;
    row.feed.amountMl = v > 0 ? v : null;
    amtLabel.textContent = v > 0 ? v + 'ml' : '—';
    store.save();
  });
  slider.addEventListener('change', () => widget.update());
  const sliderRow = h('div', { class: 'frow' },
    h('span', { class: 'flabel', text: '' }),
    h('span', { class: 'slwrap' }, h('span', { class: 'sl', text: '奶量' }), slider, amtLabel));
  card.appendChild(sliderRow);

  // 陪玩
  const playRow = h('div', { class: 'frow' }, h('span', { class: 'flabel', text: '陪玩' }));
  const playChips = h('div', { class: 'chips' });
  row.play.forEach((item) => {
    const c = h('button', { class: 'chip play' + (item.done ? ' done' : ''), type: 'button', text: item.text });
    c.addEventListener('click', () => {
      haptics.tap();
      item.done = !item.done;
      c.classList.toggle('done', item.done);
      store.save();
    });
    playChips.appendChild(c);
  });
  const addPlay = h('button', { class: 'chip add', type: 'button', text: '＋' });
  addPlay.addEventListener('click', async () => {
    haptics.tap();
    const txt = await promptInput({ title: '添加陪玩项', placeholder: '如：抓握沙锤' });
    if (txt) { store.addPlayItem(row.id, txt); render(); }
  });
  playChips.appendChild(addPlay);
  playRow.appendChild(playChips);
  card.appendChild(playRow);

  // 睡
  const sleepRow = h('div', { class: 'frow' }, h('span', { class: 'flabel', text: '睡' }));
  const sleepChips = singleSelectChips(SLEEP_PRESETS, row.sleep.label, (v) => { row.sleep.label = v; store.save(); widget.update(); });
  const addSleep = h('button', { class: 'chip add', type: 'button', text: '＋' });
  addSleep.addEventListener('click', async () => {
    haptics.tap();
    const txt = await promptInput({ title: '自定义睡眠时长', placeholder: '如：1小时20分' });
    if (txt) { row.sleep.label = txt; store.save(); render(); }
  });
  sleepChips.appendChild(addSleep);
  sleepRow.appendChild(sleepChips);
  card.appendChild(sleepRow);

  return card;
}

function refreshProgress() {
  const t = store.activeTemplate();
  const el = root.querySelector('.progress');
  if (el) { const p = progress(t); el.textContent = `已完成 ${p.done}/${p.total}`; }
}
