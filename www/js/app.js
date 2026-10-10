import * as store from './store.js';
import * as notifications from './notifications.js';
import * as audio from './audio.js';
import * as widget from './widget.js';
import * as record from './ui/record.js';
import * as schedule from './ui/schedule.js';
import * as edu from './ui/edu.js';
import * as notes from './ui/notes.js';
import * as charts from './ui/charts.js';
import * as mine from './ui/mine.js';
import * as sleep from './ui/sleep.js';
import * as share from './ui/share.js';
import * as sync from './cloud/sync.js';
import { applyTheme, watchSystemTheme } from './theme.js';
import { dateLabel, toast } from './util.js';

let booted = false;

async function boot() {
  const st = await store.load();
  applyTheme();
  watchSystemTheme();

  record.mount(document.getElementById('page-record'));
  schedule.mount(document.getElementById('sub-schedule'));
  edu.mount(document.getElementById('sub-edu'));
  notes.mount(document.getElementById('sub-notes'));
  charts.mount(document.getElementById('page-charts'));
  mine.mount(document.getElementById('page-mine'));
  sleep.mount();
  share.mount();
  sync.onSync(() => { record.render(); });

  document.getElementById('headerDate').textContent =
    dateLabel() + (st.baby && st.baby.name ? ' · ' + st.baby.name : '');

  // 作息页内 子标签
  const subRenders = { 'sub-schedule': () => schedule.render(), 'sub-edu': () => edu.render(), 'sub-notes': () => notes.render() };
  document.querySelectorAll('.subtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach((b) => b.classList.remove('on'));
      document.querySelectorAll('.subpage').forEach((p) => p.classList.remove('active'));
      btn.classList.add('on');
      const id = btn.dataset.sub;
      document.getElementById(id).classList.add('active');
      if (subRenders[id]) subRenders[id]();
    });
  });

  const renders = {
    record: () => record.render(),
    schedule: () => schedule.render(),
    charts: () => charts.render(),
    mine: () => mine.render()
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
      if (renders[key]) renders[key]();
    });
  });

  record.render();
  schedule.render();
  edu.render();
  notes.render();
  charts.render();
  mine.render();

  document.getElementById('fabSleep').addEventListener('click', () => sleep.open());

  audio.init(store.getState().settings).catch(() => { });
  notifications.syncAll(store.getState());
  widget.update();

  // 云同步：启动时恢复
  sync.resume();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync.resume(); });

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
