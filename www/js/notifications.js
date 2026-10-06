// 本地通知：每行按时间每天提醒

import { parseTime, toast } from './util.js';

function plugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}

export async function ensurePermission() {
  const n = plugin();
  if (!n) { toast('当前环境不支持提醒，安装 APK 后可用'); return false; }
  try {
    const perm = await n.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await n.requestPermissions();
      if (req.display !== 'granted') { toast('未获得通知权限，请到系统设置开启'); return false; }
    }
    return true;
  } catch (e) {
    toast('通知权限请求失败');
    return false;
  }
}

// 取消全部并按当前所有模板中已开启的提醒重新排期
export async function syncAll(state) {
  const n = plugin();
  if (!n) return;
  try {
    const pending = await n.getPending();
    if (pending && pending.notifications && pending.notifications.length) {
      await n.cancel({ notifications: pending.notifications.map((x) => ({ id: x.id })) });
    }
    const list = [];
    for (const t of Object.values(state.templates)) {
      for (const row of t.schedule) {
        if (!row.remind || row.deleted) continue;
        const tm = parseTime(row.time);
        if (!tm) continue;
        const feed = row.feed && row.feed.type ? row.feed.type : '';
        const body = `${t.name} ${row.time} ${feed}`.trim();
        list.push({
          id: row.id,
          title: '宝宝作息提醒',
          body,
          schedule: { on: { hour: tm.h, minute: tm.m }, repeats: true, allowWhileIdle: true }
        });
      }
    }
    if (list.length) await n.schedule({ notifications: list });
  } catch (e) {
    console.warn('syncAll failed', e);
  }
}
