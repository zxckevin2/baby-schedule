// 云同步（腾讯云开发 CloudBase · PostgreSQL / PostgREST 模式）
// 匿名登录 → 家庭组 → 记录同步（实时推送 + 轮询兜底）→ 动态。未配置时安全空转。

import * as store from '../store.js';
import { CLOUD } from './config.js';

let app = null, auth = null, db = null, initPromise = null;
let pollTimer = null;
let channel = null;
let listeners = [];
let pushTimer = null;

export function configured() { return CLOUD.enabled && !!CLOUD.envId; }
export function joined() { const c = store.getState().cloud; return !!(c && c.roomId); }
export function onSync(cb) { listeners.push(cb); return () => { listeners = listeners.filter((f) => f !== cb); }; }
function emit() { listeners.forEach((f) => { try { f(); } catch (e) { } }); }

export async function init() {
  if (!configured()) return false;
  if (app) return true;
  if (!initPromise) {
    initPromise = (async () => {
      const cb = window.cloudbase;
      if (!cb) throw new Error('CloudBase SDK 未加载');
      app = cb.init({ env: CLOUD.envId, region: CLOUD.region || 'ap-shanghai' });
      auth = (typeof app.auth === 'function') ? app.auth() : app.auth;
      db = app.rdb();
      return true;
    })();
  }
  return initPromise;
}

export async function ensureAuth() {
  if (!(await init())) throw new Error('云同步未配置');
  try { if (auth && auth.hasLoginState && await auth.hasLoginState()) return true; } catch (e) { }
  try {
    const res = await auth.signInAnonymously();
    if (res && res.error) throw new Error(res.error.message || '匿名登录失败');
  } catch (e) { /* 可能已登录 */ }
  return true;
}

function rand(n) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function genInviteCode() {
  for (let i = 0; i < 6; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data } = await db.from('rooms').select('id').eq('invite_code', code).limit(1);
    if (!data || !data.length) return code;
  }
  return String(Date.now()).slice(-6);
}

async function addMember(roomId, name) {
  const c = store.getState().cloud;
  const id = roomId + '_' + c.deviceId;
  await db.from('members').upsert({
    id, room_id: roomId, device_id: c.deviceId,
    name: name || c.memberName || '家人', joined_at: Date.now()
  }, { onConflict: 'id' });
}

export async function createRoom(roomName, memberName) {
  await ensureAuth();
  const deviceId = store.ensureDeviceId();
  const roomId = 'r' + rand(20);
  const inviteCode = await genInviteCode();
  const { error } = await db.from('rooms').upsert({
    id: roomId, name: roomName || '我的家庭', invite_code: inviteCode,
    owner_device: deviceId, created_at: Date.now()
  }, { onConflict: 'id' });
  if (error) throw new Error(error.message || '创建失败');
  store.setCloud({ roomId, roomName: roomName || '我的家庭', inviteCode, memberName: memberName || '家人', joinedAt: Date.now() });
  await addMember(roomId, memberName);
  await addLog('创建了家庭共享');
  await fullSync();
  startRealtime();
  startPolling();
  return { roomId, inviteCode };
}

export async function joinRoom(inviteCode, memberName) {
  await ensureAuth();
  store.ensureDeviceId();
  const code = String(inviteCode).trim();
  const { data, error } = await db.from('rooms').select('*').eq('invite_code', code).limit(1);
  if (error) throw new Error(error.message || '查询失败');
  const room = data && data[0];
  if (!room) throw new Error('邀请码无效');
  store.setCloud({ roomId: room.id, roomName: room.name, inviteCode: code, memberName: memberName || '家人', joinedAt: Date.now() });
  await addMember(room.id, memberName);
  await addLog('加入了家庭共享');
  await fullSync();
  startRealtime();
  startPolling();
  return room;
}

export async function leaveRoom() {
  stopPolling();
  stopRealtime();
  store.setCloud({ roomId: '', roomName: '', inviteCode: '', joinedAt: 0 });
}

export async function pullMembers() {
  const c = store.getState().cloud;
  if (!c.roomId) return [];
  await ensureAuth();
  const { data } = await db.from('members').select('*').eq('room_id', c.roomId);
  return data || [];
}

export async function addLog(text) {
  const c = store.getState().cloud;
  if (!c.roomId) return;
  try {
    await ensureAuth();
    await db.from('logs').insert({ room_id: c.roomId, ts: Date.now(), device_id: c.deviceId, member_name: c.memberName || '家人', text });
  } catch (e) { }
}

export async function pullLog(limit = 60) {
  const c = store.getState().cloud;
  if (!c.roomId) return [];
  await ensureAuth();
  let data = null;
  try { const r = await db.from('logs').select('*').eq('room_id', c.roomId).order('ts', { ascending: false }).limit(limit); data = r.data; }
  catch (e) { try { const r = await db.from('logs').select('*').eq('room_id', c.roomId).limit(limit); data = r.data; } catch (e2) { return []; } }
  return (data || []).sort((a, b) => Number(b.ts) - Number(a.ts));
}

/* ---------- 记录映射 ---------- */
function recToRow(r, roomId, deviceId) {
  return {
    uid: r.uid, room_id: roomId, device_id: deviceId,
    type: r.type, start_ts: r.startTs, end_ts: r.endTs == null ? null : r.endTs,
    amount_ml: r.amountMl == null ? null : r.amountMl, milk_type: r.milkType || null,
    side: r.side || null, duration_min: r.durationMin == null ? null : r.durationMin,
    diaper_kind: r.diaperKind || null, diaper_amount: r.diaperAmount || null,
    diaper_color: r.diaperColor || null, diaper_shape: r.diaperShape || null, diaper_note: r.diaperNote || null,
    supplement_name: r.supplementName || null, dose: r.dose || null, note: r.note || null,
    updated_at: r.updatedAt, deleted: !!r.deleted
  };
}
function rowToRec(row) {
  const uid = row.uid;
  const id = Number(String(uid).split('-').pop()) || 0;
  const n = (v) => (v == null ? null : Number(v));
  return {
    uid, id, type: row.type,
    startTs: Number(row.start_ts), endTs: n(row.end_ts),
    amountMl: n(row.amount_ml), milkType: row.milk_type || '', side: row.side || '',
    durationMin: n(row.duration_min),
    diaperKind: row.diaper_kind || '', diaperAmount: row.diaper_amount || '',
    diaperColor: row.diaper_color || '', diaperShape: row.diaper_shape || '', diaperNote: row.diaper_note || '',
    supplementName: row.supplement_name || '', dose: row.dose || '', note: row.note || '',
    updatedAt: Number(row.updated_at), deleted: !!row.deleted
  };
}

export async function pushRecords() {
  const c = store.getState().cloud;
  if (!c.roomId) return 0;
  await ensureAuth();
  const rows = Object.values(store.getState().records).map((r) => recToRow(r, c.roomId, c.deviceId));
  if (!rows.length) return 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await db.from('records').upsert(chunk, { onConflict: 'uid' });
    if (error) console.warn('push records error', error);
  }
  return rows.length;
}

export async function pullRecords() {
  const c = store.getState().cloud;
  if (!c.roomId) return false;
  await ensureAuth();
  const { data, error } = await db.from('records').select('*').eq('room_id', c.roomId).limit(2000);
  if (error) { console.warn('pull records error', error); return false; }
  const changed = store.upsertRecords((data || []).map(rowToRec));
  store.setCloud({ lastSync: Date.now() });
  return changed;
}

export async function fullSync() {
  if (!joined()) return;
  await pushRecords();
  if (await pullRecords()) emit();
}

export function schedulePush() {
  if (!joined()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; fullSync().catch(() => { }); }, 1200);
}

export function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { if (!document.hidden) pullRecords().then((ch) => { if (ch) emit(); }).catch(() => { }); }, 5000);
}
export function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// PostgreSQL 实时推送（Postgres CDC）
export function startRealtime() {
  stopRealtime();
  const c = store.getState().cloud;
  if (!CLOUD.realtime) return;
  if (!c.roomId || !app || typeof app.realtime !== 'function') return;
  try {
    const rt = app.realtime();
    channel = rt.channel('room-' + c.roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'room_id=eq.' + c.roomId }, (payload) => {
        const row = payload && (payload.new || payload.record);
        if (row && row.uid) { if (store.upsertRecords([rowToRec(row)])) emit(); }
        else { pullRecords().then((ch) => { if (ch) emit(); }).catch(() => { }); }
      })
      .subscribe();
  } catch (e) { console.warn('realtime failed', e); }
}
export function stopRealtime() { if (channel) { try { channel.unsubscribe(); } catch (e) { } channel = null; } }

export async function resume() {
  if (!joined()) return;
  try { await ensureAuth(); await fullSync(); startRealtime(); startPolling(); } catch (e) { }
}
