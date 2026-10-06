import * as store from './store.js';
import * as notifications from './notifications.js';
import * as audio from './audio.js';
import * as schedule from './ui/schedule.js';
import * as edu from './ui/edu.js';
import * as notes from './ui/notes.js';
import * as sleep from './ui/sleep.js';
import { dateLabel } from './util.js';

let booted = false;

async function boot() {
  await store.load();

  schedule.mount(document.getElementById('page-schedule'));
  edu.mount(document.getElementById('page-edu'));
  notes.mount(document.getElementById('page-notes'));
  sleep.mount();

  document.getElementById('headerDate').textContent = dateLabel();

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const page = document.getElementById('page-' + btn.dataset.tab);
      page.classList.add('active');
      page.scrollTop = 0;
    });
  });

  schedule.render();
  edu.render();
  notes.render();

  document.getElementById('fabSleep').addEventListener('click', () => sleep.open());

  // 预加载音频（不阻塞界面）
  audio.init(store.getState().settings).catch(() => { });
  // 重新同步提醒
  notifications.syncAll(store.getState());
}

function bootOnce() {
  if (booted) return;
  booted = true;
  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootOnce);
} else {
  bootOnce();
}
