// 记录相关的共享逻辑：类型元数据、格式化、当日汇总、间隔

export const TYPES = [
  { key: 'bottle', name: '瓶喂', ico: '🍼' },
  { key: 'nursing', name: '亲喂', ico: '🤱' },
  { key: 'sleep', name: '睡眠', ico: '😴' },
  { key: 'diaper', name: '换尿布', ico: '💩' },
  { key: 'supplement', name: '补剂', ico: '💊' }
];

export function typeMeta(key) {
  return TYPES.find((t) => t.key === key) || { key, name: key, ico: '•' };
}

export function two(n) { return String(n).padStart(2, '0'); }

export function timeStr(ts) {
  const d = new Date(ts);
  return two(d.getHours()) + ':' + two(d.getMinutes());
}

export function fmtDuration(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return h + '时' + (m ? m + '分' : '');
  return m + '分';
}

export function fmtMl(ml) { return Math.round(ml) + 'ml'; }

export function agoLabel(ts, now = Date.now()) {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + '分前';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + '时' + (m ? m + '分' : '') + '前';
}

export function recDurationMin(rec, now = Date.now()) {
  if (rec.type !== 'sleep') return null;
  const end = rec.endTs || now;
  return Math.max(0, Math.round((end - rec.startTs) / 60000));
}

// 与「上一个同类型记录」的间隔（分钟）；睡眠用上一个的结束时间
export function gapMin(rec, sameTypeAsc) {
  const idx = sameTypeAsc.indexOf(rec);
  if (idx <= 0) return null;
  const prev = sameTypeAsc[idx - 1];
  const from = rec.type === 'sleep' ? (prev.endTs || prev.startTs) : prev.startTs;
  return Math.max(0, Math.round((rec.startTs - from) / 60000));
}

// 每条记录在「同类型升序」里的前一天记录，用于算间隔
export function orderByType(records, type) {
  return records.filter((r) => r.type === type).sort((a, b) => a.startTs - b.startTs);
}

export function summarize(records, now = Date.now()) {
  const s = {
    bottle: { count: 0, ml: 0 },
    nursing: { count: 0, min: 0 },
    sleep: { count: 0, min: 0 },
    diaper: { count: 0, pee: 0, poop: 0 },
    supplement: { count: 0 }
  };
  for (const r of records) {
    if (r.deleted) continue;
    if (r.type === 'bottle') { s.bottle.count++; s.bottle.ml += r.amountMl || 0; }
    else if (r.type === 'nursing') { s.nursing.count++; s.nursing.min += r.durationMin || 0; }
    else if (r.type === 'sleep') { s.sleep.count++; s.sleep.min += recDurationMin(r, now) || 0; }
    else if (r.type === 'diaper') { s.diaper.count++; if (r.diaperKind === 'poop') s.diaper.poop++; else if (r.diaperKind === 'pee') s.diaper.pee++; else { s.diaper.poop++; s.diaper.pee++; } }
    else if (r.type === 'supplement') s.supplement.count++;
  }
  return s;
}

export function recordTitle(rec) {
  const m = typeMeta(rec.type);
  if (rec.type === 'bottle') return m.name + (rec.milkType ? '　' + (rec.milkType === 'formula' ? '配方奶' : '母乳') : '');
  if (rec.type === 'nursing') return m.name + (rec.side ? '　' + sideName(rec.side) : '');
  if (rec.type === 'diaper') return m.name + (rec.diaperKind ? '　' + diaperName(rec.diaperKind) : '');
  if (rec.type === 'supplement') return m.name;
  return m.name;
}

export function recordDetail(rec, now = Date.now()) {
  if (rec.type === 'sleep') {
    const dur = fmtDuration(recDurationMin(rec, now));
    if (!rec.endTs) return '进行中 · ' + dur;
    return timeStr(rec.startTs) + '-' + timeStr(rec.endTs) + ' · ' + dur;
  }
  if (rec.type === 'bottle') return rec.amountMl ? fmtMl(rec.amountMl) : '';
  if (rec.type === 'nursing') return rec.durationMin ? '共 ' + rec.durationMin + ' 分钟' : '';
  if (rec.type === 'diaper') return rec.diaperNote || '';
  if (rec.type === 'supplement') return [rec.supplementName, rec.dose].filter(Boolean).join(' ');
  return rec.note || '';
}

export function recordRight(rec, now = Date.now()) {
  if (rec.type === 'sleep') return fmtDuration(recDurationMin(rec, now));
  if (rec.type === 'bottle') return rec.amountMl ? fmtMl(rec.amountMl) : '';
  return '';
}

export function sideName(s) { return s === 'left' ? '左' : s === 'right' ? '右' : s === 'both' ? '双侧' : s; }
export function diaperName(s) { return s === 'pee' ? '尿' : s === 'poop' ? '大便' : s === 'mix' ? '混合' : s; }
