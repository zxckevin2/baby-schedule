// 状态管理：加载/保存/迁移、每日重置、软删除、结构操作

import { TEMPLATES } from './templates.js';
import { todayStr } from './util.js';

const KEY = 'baby_schedule_v3';
const VERSION = 3;

let state = null;
let saveTimer = null;

function prefsPlugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) || null;
}

async function readRaw() {
  const p = prefsPlugin();
  if (p) { try { const r = await p.get({ key: KEY }); return r.value; } catch (e) { } }
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

async function writeRaw(v) {
  const p = prefsPlugin();
  if (p) { try { await p.set({ key: KEY, value: v }); return; } catch (e) { } }
  try { localStorage.setItem(KEY, v); } catch (e) { }
}

// ---------- 构建 ----------

function buildTemplate(def, seq) {
  const schedule = def.schedule.map((r) => ({
    id: ++seq.n,
    time: r.time,
    feed: { type: r.feed, amountMl: null },
    play: r.play.map((txt) => ({ id: ++seq.n, text: txt, done: false })),
    sleep: { label: r.sleep },
    remind: false,
    done: false,
    deleted: false
  }));
  const edu = def.edu.map((s) => ({
    title: s.title,
    items: s.items.map((txt) => ({ id: ++seq.n, text: txt, done: false }))
  }));
  return { id: def.id, name: def.name, schedule, notes: def.notes.slice(), edu };
}

function freshState() {
  const seq = { n: 0 };
  const templates = {};
  for (const def of TEMPLATES) templates[def.id] = buildTemplate(def, seq);
  return {
    version: VERSION,
    seq: seq.n,
    activeTemplate: 'm3',
    templates,
    date: todayStr(),
    settings: { volume: 0.7, loop: true, sleepTimerMin: 30 }
  };
}

// ---------- 归一化 ----------

function normFeed(f) {
  if (typeof f === 'string') return { type: f, amountMl: null };
  if (f && typeof f === 'object') return { type: f.type || '喂奶', amountMl: typeof f.amountMl === 'number' ? f.amountMl : null };
  return { type: '喂奶', amountMl: null };
}
function normSleep(s) {
  if (typeof s === 'string') return { label: s };
  if (s && typeof s === 'object') return { label: s.label || '' };
  return { label: '' };
}
function normRow(r, seq) {
  return {
    id: r.id || ++seq.n,
    time: r.time || '',
    feed: normFeed(r.feed),
    play: Array.isArray(r.play)
      ? r.play.map((p) => typeof p === 'string'
          ? { id: ++seq.n, text: p, done: false }
          : { id: p.id || ++seq.n, text: p.text || '', done: !!p.done })
      : [],
    sleep: normSleep(r.sleep),
    remind: !!r.remind,
    done: !!r.done,
    deleted: !!r.deleted
  };
}
function normEdu(edu, def, seq) {
  if (!Array.isArray(edu) || !edu.length) {
    return def.edu.map((s) => ({ title: s.title, items: s.items.map((txt) => ({ id: ++seq.n, text: txt, done: false })) }));
  }
  return edu.map((s) => ({
    title: s.title || '',
    items: Array.isArray(s.items) ? s.items.map((it) => typeof it === 'string'
      ? { id: ++seq.n, text: it, done: false }
      : { id: it.id || ++seq.n, text: it.text || '', done: !!it.done }) : []
  }));
}

function normalize(data) {
  const seq = { n: 0 };
  const out = {};
  for (const def of TEMPLATES) {
    const src = data.templates && data.templates[def.id];
    if (!src) { out[def.id] = buildTemplate(def, seq); continue; }
    out[def.id] = {
      id: def.id,
      name: def.name,
      schedule: Array.isArray(src.schedule) ? src.schedule.map((r) => normRow(r, seq)) : [],
      notes: (src.notes && src.notes.length) ? src.notes : def.notes.slice(),
      edu: normEdu(src.edu, def, seq)
    };
  }
  const active = (data.activeTemplate && out[data.activeTemplate]) ? data.activeTemplate : 'm3';
  const settings = Object.assign({ volume: 0.7, loop: true, sleepTimerMin: 30 }, data.settings || {});
  return {
    version: VERSION, seq: seq.n, activeTemplate: active, templates: out,
    date: data.date || todayStr(), settings
  };
}

// ---------- 每日重置 ----------

function resetDay(data) {
  for (const t of Object.values(data.templates)) {
    for (const r of t.schedule) {
      r.done = false;
      r.deleted = false;            // 恢复被删除的内置行
      for (const p of r.play) p.done = false;
    }
    for (const s of t.edu) for (const it of s.items) it.done = false;
  }
  data.date = todayStr();
}

// ---------- 生命周期 ----------

export async function load() {
  const raw = await readRaw();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
  if (!data || data.version !== VERSION || !data.templates) {
    data = freshState();
  } else {
    data = normalize(data);
  }
  if (data.date !== todayStr()) resetDay(data);
  state = data;
  return state;
}

export function getState() { return state; }

export function activeTemplate() { return state.templates[state.activeTemplate]; }

export function getTemplate(id) { return state.templates[id]; }

export function nextId() { return ++state.seq; }

export function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

export function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!state) return;
  writeRaw(JSON.stringify(state));
}

export function setActive(id) {
  if (state.templates[id]) { state.activeTemplate = id; saveNow(); }
}

export function newDay() {
  resetDay(state);
  saveNow();
}

export function addRow() {
  const t = activeTemplate();
  const row = {
    id: nextId(), time: '', feed: { type: '喂奶', amountMl: null },
    play: [], sleep: { label: '' }, remind: false, done: false, deleted: false
  };
  t.schedule.push(row);
  saveNow();
  return row;
}

export function softDeleteRow(rowId) {
  const t = activeTemplate();
  const r = t.schedule.find((x) => x.id === rowId);
  if (r) { r.deleted = true; r.remind = false; }
  saveNow();
}

export function addPlayItem(rowId, text) {
  const t = activeTemplate();
  const r = t.schedule.find((x) => x.id === rowId);
  if (!r) return null;
  const it = { id: nextId(), text, done: false };
  r.play.push(it);
  saveNow();
  return it;
}
