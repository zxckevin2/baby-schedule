// 早教页：分类胶囊，点击标记「今天练过」

import { h } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';

let root = null;
export function mount(c) { root = c; }

export function render() {
  if (!root) return;
  const t = store.activeTemplate();
  root.textContent = '';
  t.edu.forEach((sec) => {
    const card = h('div', { class: 'edu-card' });
    card.appendChild(h('div', { class: 'edu-head', text: sec.title }));
    const tags = h('div', { class: 'chips' });
    sec.items.forEach((it) => {
      const c = h('button', { class: 'chip' + (it.done ? ' done' : ''), type: 'button', text: it.text });
      c.addEventListener('click', () => {
        haptics.tap();
        it.done = !it.done;
        c.classList.toggle('done', it.done);
        store.save();
      });
      tags.appendChild(c);
    });
    card.appendChild(tags);
    root.appendChild(card);
  });
}
