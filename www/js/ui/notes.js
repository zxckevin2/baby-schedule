// 带养页：编号卡片列表

import { h } from '../util.js';
import * as store from '../store.js';

let root = null;
export function mount(c) { root = c; }

export function render() {
  if (!root) return;
  const t = store.activeTemplate();
  root.textContent = '';
  const list = h('ol', { class: 'notes-list' });
  t.notes.forEach((n) => list.appendChild(h('li', { text: n })));
  root.appendChild(list);
}
