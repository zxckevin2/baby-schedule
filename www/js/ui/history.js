// 记录页：历史日期列表 + 单日日报明细 + 导出

import { h, fullDateLabel, toast } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import { summarize, shareReport } from '../export.js';

let root = null;
let currentDate = null;

export function mount(c) { root = c; }

export function render() {
  if (!root) return;
  if (currentDate) return renderDetail(currentDate);
  renderList();
}

function renderList() {
  root.textContent = '';
  const list = store.getHistoryList();
  if (!list.length) {
    root.appendChild(h('div', { class: 'empty', text: '还没有历史记录。完成今天的安排后，点「新的一天」就会自动归档。' }));
    return;
  }
  const wrap = h('div', { class: 'history-list' });
  list.forEach(({ date, snap }) => {
    const s = summarize(snap);
    const item = h('div', { class: 'history-item' },
      h('div', { class: 'hi-top' },
        h('span', { class: 'hi-date', text: fullDateLabel(date) }),
        h('span', { class: 'hi-tpl', text: snap.templateName })),
      h('div', { class: 'hi-sub', text: `完成 ${s.done}/${s.total} · 记录奶量 ${s.totalMl}ml · 陪玩 ${s.playDone}/${s.playTotal}` }));
    item.addEventListener('click', () => { haptics.tap(); currentDate = date; render(); });
    wrap.appendChild(item);
  });
  root.appendChild(wrap);
}

function renderDetail(date) {
  root.textContent = '';
  const snap = store.getState().history[date];
  if (!snap) { currentDate = null; return render(); }

  const back = h('button', { class: 'link-btn', type: 'button', text: '‹ 返回记录' });
  back.addEventListener('click', () => { currentDate = null; render(); });
  root.appendChild(back);

  const s = summarize(snap);
  const head = h('div', { class: 'report-head' },
    h('div', { class: 'rh-title', text: fullDateLabel(date) }),
    h('div', { class: 'rh-sub', text: snap.templateName + ' · 完成 ' + s.done + '/' + s.total }));
  root.appendChild(head);

  const sum = h('div', { class: 'report-sum' },
    h('div', { class: 'rs-line', text: `🍼 喂奶 ${s.amountRows} 次 · 合计 ${s.totalMl}ml` }),
    h('div', { class: 'rs-line', text: `🧩 陪玩完成 ${s.playDone}/${s.playTotal} 项` }),
    s.sleeps.length ? h('div', { class: 'rs-line', text: `😴 睡眠：${s.sleeps.join(' / ')}` }) : null);
  root.appendChild(sum);

  const rows = h('div', { class: 'report-rows' });
  (snap.rows || []).forEach((r) => {
    const plays = (r.plays || []).filter((p) => p.done).map((p) => p.text).join('、');
    const feed = r.amountMl != null ? `${r.feedType} ${r.amountMl}ml` : r.feedType;
    const detail = [feed, plays, r.sleep ? '睡' + r.sleep : ''].filter(Boolean).join(' · ');
    rows.appendChild(h('div', { class: 'report-row' + (r.done ? ' done' : '') },
      h('span', { class: 'rr-time', text: r.time || '--:--' }),
      h('span', { class: 'rr-detail', text: detail }),
      h('span', { class: 'rr-mark', text: r.done ? '✓' : '—' })));
  });
  root.appendChild(rows);

  const actions = h('div', { class: 'toolbar' });
  const share = h('button', { class: 'btn btn-primary', type: 'button', text: '分享日报（图片）' });
  share.addEventListener('click', async () => {
    haptics.tap();
    try { await shareReport(date, snap, store.getState().baby.name); }
    catch (e) { toast('分享失败：' + (e && e.message ? e.message : e)); }
  });
  const del = h('button', { class: 'btn btn-ghost', type: 'button', text: '删除这一天' });
  del.addEventListener('click', () => {
    store.deleteHistory(date);
    currentDate = null;
    toast('已删除该记录');
    render();
  });
  actions.appendChild(share);
  actions.appendChild(del);
  root.appendChild(actions);
}

// 供外部调用：切到记录页时刷新
export function reset() { currentDate = null; }
