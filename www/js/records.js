// 记录相关的共享逻辑：类型元数据、格式化、当日汇总、间隔

export const TYPES = [
  { key: 'bottle', name: '瓶喂', ico: '🍼' },
  { key: 'nursing', name: '亲喂', ico: '🤱' },
  { key: 'sleep', name: '睡眠', ico: '😴' },
  { key: 'diaper', name: '换尿布', ico: '💩' },
  { key: 'supplement', name: '补剂', ico: '💊' }
];

export const MILK_TYPES = [['母乳', 'breast'], ['配方奶', 'formula'], ['鲜奶', 'fresh'], ['水', 'water']];
export const SIDES = [['左', 'left'], ['右', 'right'], ['双侧', 'both']];
export const SUPPLEMENTS = [['AD', 'AD'], ['D3', 'D3'], ['维生素D', '维生素D'], ['益生菌', '益生菌'], ['钙', '钙'], ['铁', '铁'], ['DHA', 'DHA']];
export const DIAPER_KINDS = [['大便', 'poop'], ['小便', 'pee'], ['混合', 'mix']];
export const DIAPER_AMOUNTS = [['不选择', ''], ['少', 'little'], ['中', 'mid'], ['多', 'much']];
export const DIAPER_COLORS = [['不选择', ''], ['黄色', 'yellow'], ['黄绿色', 'yellowgreen'], ['深绿色', 'darkgreen'], ['绿色', 'green'], ['棕色', 'brown'], ['黑色', 'black'], ['红色', 'red']];
export const DIAPER_SHAPES = [['不选择', ''], ['成形', 'formed'], ['干燥', 'dry'], ['卷曲', 'curly'], ['糊状', 'paste'], ['水样', 'watery']];

export function labelOf(pairs, val) {
  const f = pairs.find((p) => p[1] === val);
  return f ? f[0] : (val || '');
}

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

export function gapMin(rec, sameTypeAsc) {
  const idx = sameTypeAsc.indexOf(rec);
  if (idx <= 0) return null;
  const prev = sameTypeAsc[idx - 1];
  const from = rec.type === 'sleep' ? (prev.endTs || prev.startTs) : prev.startTs;
  return Math.max(0, Math.round((rec.startTs - from) / 60000));
}

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
  if (rec.type === 'bottle') return m.name + (rec.milkType ? '　' + labelOf(MILK_TYPES, rec.milkType) : '');
  if (rec.type === 'nursing') return m.name + (rec.side ? '　' + labelOf(SIDES, rec.side) : '');
  if (rec.type === 'diaper') return m.name + (rec.diaperKind ? '　' + labelOf(DIAPER_KINDS, rec.diaperKind) : '');
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
  if (rec.type === 'diaper') {
    const parts = [];
    if (rec.diaperAmount) parts.push('量' + labelOf(DIAPER_AMOUNTS, rec.diaperAmount));
    if (rec.diaperColor) parts.push(labelOf(DIAPER_COLORS, rec.diaperColor));
    if (rec.diaperShape) parts.push(labelOf(DIAPER_SHAPES, rec.diaperShape));
    if (rec.diaperNote) parts.push(rec.diaperNote);
    return parts.join(' · ');
  }
  if (rec.type === 'supplement') return [rec.supplementName, rec.dose].filter(Boolean).join(' ');
  return rec.note || '';
}

export function recordRight(rec, now = Date.now()) {
  if (rec.type === 'sleep') return fmtDuration(recDurationMin(rec, now));
  if (rec.type === 'bottle') return rec.amountMl ? fmtMl(rec.amountMl) : '';
  return '';
}
