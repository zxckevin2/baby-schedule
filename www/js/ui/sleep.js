// 哄睡底部面板：播放/暂停、音量、定时、循环

import { h, toast } from '../util.js';
import * as store from '../store.js';
import * as audio from '../audio.js';
import * as haptics from '../haptics.js';

let backdrop = null;
let sheet = null;
let refs = {};
let timerHandle = null;
let tickHandle = null;
let remainingSec = 0;

const TIMERS = [
  { label: '不定时', min: 0 },
  { label: '15分', min: 15 },
  { label: '30分', min: 30 },
  { label: '60分', min: 60 }
];

export function mount() {
  backdrop = h('div', { class: 'sheet-backdrop' });
  backdrop.addEventListener('click', close);

  sheet = h('div', { class: 'sheet' });
  sheet.appendChild(h('div', { class: 'sheet-grip' }));
  sheet.appendChild(h('div', { class: 'sheet-moon', text: '🌙' }));
  sheet.appendChild(h('div', { class: 'sheet-title', text: '哄睡 · 白噪音' }));

  // 播放行
  const playRow = h('div', { class: 'sheet-playrow' });
  refs.playBtn = h('button', { class: 'play-btn', type: 'button', text: '▶' });
  refs.playBtn.addEventListener('click', onTogglePlay);
  const track = h('div', { class: 'track' }, h('div', { class: 'track-fill' }));
  refs.fill = track.querySelector('.track-fill');
  playRow.appendChild(refs.playBtn);
  playRow.appendChild(track);
  sheet.appendChild(playRow);

  refs.status = h('div', { class: 'sheet-status', text: '已暂停' });
  sheet.appendChild(refs.status);

  // 音量
  const volRow = h('div', { class: 'sheet-volrow' });
  volRow.appendChild(h('span', { class: 'vico', text: '🔈' }));
  refs.vol = h('input', { type: 'range', min: '0', max: '100', step: '1' });
  refs.vol.addEventListener('input', async () => {
    const v = +refs.vol.value / 100;
    await audio.setVolume(v);
    store.getState().settings.volume = v;
    store.save();
  });
  volRow.appendChild(refs.vol);
  volRow.appendChild(h('span', { class: 'vico', text: '🔊' }));
  sheet.appendChild(volRow);

  // 定时 + 循环
  const chips = h('div', { class: 'sheet-chips' });
  refs.timerChips = [];
  TIMERS.forEach((t) => {
    const c = h('button', { class: 'tchip', type: 'button', text: t.label });
    c.dataset.min = t.min;
    c.addEventListener('click', () => setTimer(t.min));
    refs.timerChips.push(c);
    chips.appendChild(c);
  });
  refs.loopChip = h('button', { class: 'tchip', type: 'button', text: '🔁 循环' });
  refs.loopChip.addEventListener('click', () => {
    haptics.tap();
    const on = !audio.getLoop();
    audio.setLoop(on);
    store.getState().settings.loop = on;
    store.save();
    refreshLoop();
  });
  chips.appendChild(refs.loopChip);
  sheet.appendChild(chips);

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}

export function open() {
  if (!sheet) return;
  backdrop.classList.add('show');
  sheet.classList.add('show');
  refs.vol.value = String(Math.round(audio.getVolume() * 100));
  refreshLoop();
  refreshTimerChips();
  refreshPlay();
  if (!tickHandle) tickHandle = setInterval(tick, 500);
}

export function close() {
  if (!sheet) return;
  backdrop.classList.remove('show');
  sheet.classList.remove('show');
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  // 注意：关闭面板不停止播放
}

async function onTogglePlay() {
  haptics.tap();
  if (!audio.isReady()) await audio.init(store.getState().settings);
  await audio.toggle();
  refreshPlay();
}

function refreshPlay() {
  const p = audio.isPlaying();
  refs.playBtn.textContent = p ? '⏸' : '▶';
  refs.playBtn.classList.toggle('on', p);
  refreshStatus();
}

function refreshStatus() {
  const p = audio.isPlaying();
  let s = p ? '播放中' : '已暂停';
  if (remainingSec > 0) s += ' · 剩 ' + fmt(Math.ceil(remainingSec));
  refs.status.textContent = s;
}

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function setTimer(min) {
  haptics.tap();
  if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; }
  remainingSec = min * 60;
  store.getState().settings.sleepTimerMin = min;
  store.save();
  refreshTimerChips();
  if (min > 0) {
    timerHandle = setTimeout(async () => {
      await audio.pause();
      remainingSec = 0;
      timerHandle = null;
      refreshPlay();
      refreshTimerChips();
      toast('哄睡定时结束，已暂停');
    }, min * 60 * 1000);
  }
  refreshStatus();
}

function refreshTimerChips() {
  const cur = store.getState().settings.sleepTimerMin || 0;
  refs.timerChips.forEach((c) => c.classList.toggle('on', +c.dataset.min === cur));
}

function refreshLoop() {
  refs.loopChip.classList.toggle('on', audio.getLoop());
}

async function tick() {
  if (!audio.isPlaying()) return;
  const pr = await audio.getProgress();
  refs.fill.style.width = Math.round(pr * 100) + '%';
  if (remainingSec > 0) {
    remainingSec = Math.max(0, remainingSec - 0.5);
    refreshStatus();
  }
}
