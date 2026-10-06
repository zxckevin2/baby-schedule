// 主题：跟随系统 / 浅色 / 深色

import * as store from './store.js';

export function applyTheme() {
  const s = store.getState();
  const pref = (s && s.settings && s.settings.theme) || 'auto';
  const sysDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = pref === 'dark' || (pref === 'auto' && sysDark);
  document.body.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#3a4a28' : '#7aa83a');
}

export function watchSystemTheme() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', applyTheme);
}
