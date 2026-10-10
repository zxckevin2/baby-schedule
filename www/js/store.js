// 状态管理：加载/保存/迁移(v3→v4)、每日重置、软删除、历史归档、宝宝信息

import { TEMPLATES } from './templates.js';
import { todayStr, suggestTemplateId } from './util.js';

const KEY_V5 = 'baby_schedule_v5';
const KEY_V4 = 'baby_schedule_v4';
const KEY_V3 = 'baby_schedule_v3';
const VERSION = 5;

let state = null;
let saveTimer = null;

function prefsPlugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) || null;
}
async function readRaw(key) {
  const p = prefsPlugin();
  if (p) { try { const r = await p.get({ key }); return r.value; } catch (e) { } }
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
async function writeRaw(key, v) {
  const p = prefsPlugin();
  if (p) { try { await p.set({ key, value: v }); return; } catch (e) { } }
  try { localStorage.setItem(key, v); } catch (e) { }
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
  return { id: def.id, name: def.name, refs: def.refs || null, schedule, notes: def.notes.slice(), edu };
}

function defaultSettings() {
  return { volume: 0.7, loop: true, sleepTimerMin: 30, theme: 'auto', haptics: true, autoAge: true, manualPickDate: '' };
}

function defaultCloud() {
  return { roomId: '', roomName: '', inviteCode: '', deviceId: '', memberName: '', joinedAt: 0, lastSync: 0 };
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
    settings: defaultSettings(),
    baby: { name: '', gender: '', birthday: '' },
    history: {},
    records: {},
    growth: {},
    cloud: defaultCloud()
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
      refs: def.refs || null,
      schedule: Array.isArray(src.schedule) ? src.schedule.map((r) => normRow(r, seq)) : [],
      notes: (src.notes && src.notes.length) ? src.notes : def.notes.slice(),
      edu: normEdu(src.edu, def, seq)
    };
  }
  const active = (data.activeTemplate && out[data.activeTemplate]) ? data.activeTemplate : 'm3';
  const settings = Object.assign(defaultSettings(), data.settings || {});
  const baby = Object.assign({ name: '', gender: '', birthday: '' }, data.baby || {});
  const history = (data.history && typeof data.history === 'object') ? data.history : {};
  const records = normRecords(data.records);
  const growth = normRecords(data.growth);
  const cloud = Object.assign(defaultCloud(), data.cloud || {});
  return {
    version: VERSION, seq: seq.n, activeTemplate: active, templates: out,
    date: data.date || todayStr(), settings, baby, history, records, growth, cloud
  };
}

function normRecords(obj) {
  const out = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const r = obj[k];
      if (r && typeof r === 'object') {
        const id = (typeof r.id === 'number' && r.id > 0) ? r.id : Number(k) || null;
        if (id) out[id] = Object.assign({}, r, { id });
      }
    }
  }
  return out;
}

// 迁移：确保有 deviceId，并把记录按全局唯一 uid 作键（为云同步准备）
function migrateCloud(data) {
  if (!data.cloud) data.cloud = defaultCloud();
  if (!data.cloud.deviceId) data.cloud.deviceId = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const dev = data.cloud.deviceId;
  for (const field of ['records', 'growth']) {
    const src = data[field] || {};
    const out = {};
    for (const k of Object.keys(src)) {
      const r = src[k];
      if (!r) continue;
      if (!r.uid) r.uid = dev + '-' + r.id;
      out[r.uid] = r;
    }
    data[field] = out;
  }
  return data;
}

// ---------- 历史 ----------

function snapshot(data) {
  const t = data.templates[data.activeTemplate];
  if (!t) return null;
  const rows = t.schedule.filter((r) => !r.deleted).map((r) => ({
    time: r.time,
    feedType: r.feed.type,
    amountMl: r.feed.amountMl,
    sleep: r.sleep.label,
    done: !!r.done,
    plays: r.play.map((p) => ({ text: p.text, done: !!p.done }))
  }));
  const edu = t.edu.map((s) => ({ title: s.title, items: s.items.map((i) => ({ text: i.text, done: !!i.done })) }));
  return { templateId: t.id, templateName: t.name, rows, edu, archivedAt: Date.now() };
}

function hasActivity(snap) {
  if (!snap) return false;
  const rowAct = snap.rows.some((r) => r.done || (r.amountMl != null) || r.plays.some((p) => p.done));
  const eduAct = snap.edu.some((s) => s.items.some((i) => i.done));
  return rowAct || eduAct;
}

function archive(data) {
  const snap = snapshot(data);
  if (hasActivity(snap)) {
    data.history = data.history || {};
    data.history[data.date] = snap;
  }
}

// ---------- 每日重置 ----------

function resetDay(data) {
  for (const t of Object.values(data.templates)) {
    for (const r of t.schedule) {
      r.done = false;
      r.deleted = false;
      for (const p of r.play) p.done = false;
    }
    for (const s of t.edu) for (const it of s.items) it.done = false;
  }
  data.date = todayStr();
}

// ---------- 生命周期 ----------

export async function load() {
  let data = null;
  for (const key of [KEY_V5, KEY_V4, KEY_V3]) {
    const raw = await readRaw(key);
    if (!raw) continue;
    try { const d = JSON.parse(raw); if (d && d.templates) { data = d; break; } } catch (e) { }
  }
  if (!data || !data.templates) data = freshState();
  else data = normalize(data);

  // 跨天：先归档昨天，再重置
  if (data.date !== todayStr()) { archive(data); resetDay(data); }

  // 月龄自动推进（当天未手动选过模板时）
  if (data.settings.autoAge && data.baby.birthday && data.settings.manualPickDate !== todayStr()) {
    const sug = suggestTemplateId(data.baby.birthday);
    if (sug && data.templates[sug] && sug !== data.activeTemplate) {
      data.activeTemplate = sug;
      data._autoSwitched = data.templates[sug].name;
    }
  }

  state = migrateCloud(data);
  saveNow();
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
  writeRaw(KEY_V5, JSON.stringify(state));
}

export function setActive(id, manual) {
  if (!state.templates[id]) return;
  state.activeTemplate = id;
  if (manual) state.settings.manualPickDate = todayStr();
  saveNow();
}

export function newDay() {
  archive(state);
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

export function setSetting(key, value) {
  state.settings[key] = value;
  saveNow();
}

export function setBaby(patch) {
  state.baby = Object.assign({}, state.baby, patch);
  saveNow();
}

export function getHistoryList() {
  return Object.keys(state.history)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => ({ date, snap: state.history[date] }));
}
export function deleteHistory(date) {
  if (state.history[date]) { delete state.history[date]; saveNow(); }
}

// ---------- 实际记录 ----------

function tsToDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function recInDate(r, dateStr) {
  if (r.type === 'sleep' && r.endTs) {
    const dayStart = new Date(dateStr + 'T00:00:00').getTime();
    const dayEnd = dayStart + 86400000;
    return r.startTs < dayEnd && r.endTs > dayStart;
  }
  return tsToDate(r.startTs) === dateStr;
}

export function recordsOf(dateStr) {
  return Object.values(state.records)
    .filter((r) => !r.deleted && recInDate(r, dateStr))
    .sort((a, b) => b.startTs - a.startTs);
}

export function addRecord(rec) {
  const id = nextId();
  const r = Object.assign({ id, uid: state.cloud.deviceId + '-' + id, updatedAt: Date.now(), deleted: false }, rec);
  state.records[r.uid] = r;
  saveNow();
  return r;
}

export function updateRecord(uid, patch) {
  const r = state.records[uid];
  if (!r) return null;
  Object.assign(r, patch, { updatedAt: Date.now() });
  saveNow();
  return r;
}

export function deleteRecord(uid) {
  const r = state.records[uid];
  if (r) { r.deleted = true; r.updatedAt = Date.now(); saveNow(); }
}

export function ongoingSleep() {
  return Object.values(state.records).find((r) => !r.deleted && r.type === 'sleep' && !r.endTs) || null;
}

export function lastOfType(type) {
  let best = null;
  for (const r of Object.values(state.records)) {
    if (r.deleted || r.type !== type) continue;
    if (!best || r.startTs > best.startTs) best = r;
  }
  return best;
}

export function activeRefs() {
  const t = activeTemplate();
  return (t && t.refs) || null;
}

export function addGrowth(g) {
  const id = nextId();
  const r = Object.assign({ id, uid: state.cloud.deviceId + '-' + id, updatedAt: Date.now(), deleted: false }, g);
  state.growth[r.uid] = r;
  saveNow();
  return r;
}

export function growthList() {
  return Object.values(state.growth).filter((g) => !g.deleted).sort((a, b) => a.ts - b.ts);
}

export function deleteGrowth(uid) {
  const g = state.growth[uid];
  if (g) { g.deleted = true; g.updatedAt = Date.now(); saveNow(); }
}

// ---------- 云同步辅助 ----------

export function ensureDeviceId() {
  if (!state.cloud.deviceId) {
    state.cloud.deviceId = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    saveNow();
  }
  return state.cloud.deviceId;
}

export function setCloud(patch) {
  state.cloud = Object.assign({}, state.cloud, patch);
  saveNow();
}

export function uidOf(rec) {
  const d = (state.cloud && state.cloud.deviceId) || 'd0';
  return d + '-' + rec.id;
}

export function upsertRecords(list) {
  let changed = false;
  for (const r of list) {
    if (!r || !r.uid) continue;
    const local = state.records[r.uid];
    if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) {
      state.records[r.uid] = r;
      changed = true;
      if ((r.id || 0) >= (state.seq || 0)) state.seq = r.id;
    }
  }
  if (changed) saveNow();
  return changed;
}
