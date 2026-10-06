import * as store from './store.js';
import * as notifications from './notifications.js';
import * as audio from './audio.js';
import * as widget from './widget.js';
import * as schedule from './ui/schedule.js';
import * as edu from './ui/edu.js';
import * as notes from './ui/notes.js';
import * as history from './ui/history.js';
import * as sleep from './ui/sleep.js';
import * as settings from './ui/settings.js';
import { applyTheme, watchSystemTheme } from './theme.js';
import { dateLabel, toast } from './util.js';

let booted = false;

async function boot() {
  const st = await store.load();
  applyTheme();
  watchSystemTheme();

  schedule.mount(document.getElementById('page-schedule'));
  edu.mount(document.getElementById('page-edu'));
  notes.mount(document.getElementById('page-notes'));
  history.mount(document.getElementById('page-history'));
  sleep.mount();
  settings.mount({ onChanged: () => { applyTheme(); schedule.render(); } });

  document.getElementById('headerDate').textContent =
    dateLabel() + (st.baby && st.baby.name ? ' · ' + st.baby.name : '');

  const tabs = {
    schedule: () => schedule.render(),
    edu: () => edu.render(),
    notes: () => notes.render(),
    history: () => { history.reset(); history.render(); }
  };
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.dataset.tab;
      const page = document.getElementById('page-' + key);
      page.classList.add('active');
      page.scrollTop = 0;
      if (tabs[key]) tabs[key]();
    });
  });

  schedule.render();
  edu.render();
  notes.render();
  history.render();

  document.getElementById('fabSleep').addEventListener('click', () => sleep.open());
  document.getElementById('btnSettings').addEventListener('click', () => settings.open());

  audio.init(store.getState().settings).catch(() => { });
  notifications.syncAll(store.getState());
  widget.update();

  if (st._autoSwitched) {
    const name = st._autoSwitched;
    delete st._autoSwitched;
    toast('已按宝宝月龄切到「' + name + '」');
  }
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
