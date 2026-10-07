// 自定义滚轮选择器：日期 / 时间（替代安卓原生控件）

import { h } from './util.js';

const ITEM_H = 44;
const VISIBLE = 5;
const SPACER = ((VISIBLE - 1) / 2) * ITEM_H;

function pad(n) { return String(n).padStart(2, '0'); }

function buildColumn(items, selectedIndex) {
  const col = h('div', { class: 'wheel-col' });
  col.appendChild(h('div', { class: 'wheel-spacer', style: { height: SPACER + 'px' } }));
  const els = items.map((it, i) => h('div', { class: 'wheel-item', 'data-i': i, text: it.label }));
  els.forEach((el) => col.appendChild(el));
  col.appendChild(h('div', { class: 'wheel-spacer', style: { height: SPACER + 'px' } }));

  let index = selectedIndex;
  let raf = null;
  function paint() {
    const i = Math.round(col.scrollTop / ITEM_H);
    index = Math.max(0, Math.min(items.length - 1, i));
    els.forEach((el, k) => el.classList.toggle('center', k === index));
  }
  col.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; paint(); });
  }, { passive: true });
  requestAnimationFrame(() => { col.scrollTop = selectedIndex * ITEM_H; paint(); });
  return { el: col, items, get index() { return index; }, len: items.length };
}

function closeOverlay(overlay) { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 220); }

export function openPicker({ title = '选择时间', date = true, time = true, value = Date.now(), onConfirm }) {
  const d = new Date(value);
  const today = new Date();
  const cols = [];
  const meta = [];

  let years = [], months = [], days = [], hours = [], minutes = [];
  if (date) {
    for (let y = today.getFullYear() - 3; y <= today.getFullYear() + 1; y++) years.push({ label: y + '', value: y });
    for (let m = 1; m <= 12; m++) months.push({ label: pad(m), value: m });
    for (let dd = 1; dd <= 31; dd++) days.push({ label: pad(dd), value: dd });
  }
  if (time) {
    for (let hh = 0; hh <= 23; hh++) hours.push({ label: pad(hh), value: hh });
    for (let mi = 0; mi <= 59; mi++) minutes.push({ label: pad(mi), value: mi });
  }

  const overlay = h('div', { class: 'wheel-overlay' });
  const sheet = h('div', { class: 'wheel-sheet' });
  const head = h('div', { class: 'wheel-head' },
    h('button', { class: 'wh-btn', type: 'button', text: '取消' }),
    h('div', { class: 'wh-title', text: title }),
    h('button', { class: 'wh-btn ok', type: 'button', text: '确认' }));
  sheet.appendChild(head);

  const body = h('div', { class: 'wheel-body' });
  body.appendChild(h('div', { class: 'wheel-band' }));

  if (date) {
    cols.push(buildColumn(years, years.findIndex((y) => y.value === d.getFullYear())));
    cols.push(buildColumn(months, d.getMonth()));
    cols.push(buildColumn(days, d.getDate() - 1));
  }
  if (time) {
    cols.push(buildColumn(hours, d.getHours()));
    cols.push(buildColumn(minutes, d.getMinutes()));
  }
  cols.forEach((c) => body.appendChild(c.el));
  sheet.appendChild(body);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  head.querySelector('.wh-btn').addEventListener('click', () => closeOverlay(overlay));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay); });
  head.querySelector('.wh-btn.ok').addEventListener('click', () => {
    let i = 0;
    const out = new Date(d);
    if (date) {
      const y = years[cols[i++].index].value;
      const mo = months[cols[i++].index].value;
      let day = days[cols[i++].index].value;
      const maxDay = new Date(y, mo, 0).getDate();
      day = Math.min(day, maxDay);
      out.setFullYear(y, mo - 1, day);
    }
    if (time) {
      out.setHours(hours[cols[i++].index].value, minutes[cols[i++].index].value, 0, 0);
    }
    closeOverlay(overlay);
    onConfirm(out.getTime());
  });
}

export function pickDateTime(value, onConfirm) { openPicker({ title: '选择时间', date: true, time: true, value, onConfirm }); }
export function pickTime(value, onConfirm) { openPicker({ title: '选择时间', date: false, time: true, value, onConfirm }); }
export function pickDate(value, onConfirm) { openPicker({ title: '选择日期', date: true, time: false, value, onConfirm }); }

export function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
