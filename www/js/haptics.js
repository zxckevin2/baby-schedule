// 震动反馈：原生 Haptics，网页端回退 navigator.vibrate

import * as store from './store.js';

function plugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) || null;
}

export function enabled() {
  const s = store.getState();
  return !s || !s.settings || s.settings.haptics !== false;
}

export async function tap() {
  if (!enabled()) return;
  const p = plugin();
  if (p) {
    try { await p.impact({ style: 'LIGHT' }); return; } catch (e) { }
  }
  if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { } }
}
