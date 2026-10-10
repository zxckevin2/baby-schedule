// 记录表单：5 类记录的录入/编辑（底部面板，含自定义时间选择）

import { h } from '../util.js';
import * as store from '../store.js';
import * as sync from '../cloud/sync.js';
import { typeMeta, MILK_TYPES, DIAPER_KINDS, DIAPER_AMOUNTS, DIAPER_COLORS, DIAPER_SHAPES, SIDES, SUPPLEMENTS } from '../records.js';
import { pickDateTime, fmtDateTime } from '../picker.js';

let sheet = null;
let backdrop = null;

const SLEEP_QUICK = [['20分钟', 20], ['40分钟', 40], ['1小时', 60], ['1.5小时', 90], ['2小时', 120]];

function ensureDom() {
  if (sheet) return;
  backdrop = h('div', { class: 'sheet-backdrop' });
  backdrop.addEventListener('click', close);
  sheet = h('div', { class: 'sheet form-sheet' });
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}

export function close() {
  if (backdrop) backdrop.classList.remove('show');
  if (sheet) sheet.classList.remove('show');
}

export function openForm({ type, record = null, onDone = () => { } }) {
  ensureDom();
  const editing = !!record;
  const meta = typeMeta(type);
  const base = record || { type };
  const now = Date.now();
  const vals = {
    startTs: base.startTs || (type === 'sleep' ? now - 60 * 60000 : now),
    endTs: base.endTs != null ? base.endTs : (type === 'sleep' ? now : null),
    amountMl: base.amountMl != null ? base.amountMl : (type === 'bottle' ? 100 : null),
    milkType: base.milkType || 'breast',
    side: base.side || 'left',
    durationMin: base.durationMin != null ? base.durationMin : '',
    diaperKind: base.diaperKind || 'pee',
    diaperAmount: base.diaperAmount || '',
    diaperColor: base.diaperColor || '',
    diaperShape: base.diaperShape || '',
    diaperNote: base.diaperNote || '',
    supplementName: base.supplementName || '',
    dose: base.dose || '',
    note: base.note || ''
  };

  sheet.textContent = '';
  sheet.appendChild(h('div', { class: 'sheet-grip' }));
  sheet.appendChild(h('div', { class: 'sheet-title', text: (editing ? '编辑' : '记录') + ' · ' + meta.name }));

  const body = h('div', { class: 'form-body' });

  if (type === 'bottle') {
    body.appendChild(bigAmount(vals));
    body.appendChild(chipSection('🍼 瓶喂', MILK_TYPES, vals.milkType, (v) => { vals.milkType = v; }));
  }

  if (type === 'nursing') {
    body.appendChild(chipSection('🤱 侧', SIDES, vals.side, (v) => { vals.side = v; }));
    body.appendChild(numSection('⏱️ 时长（分钟）', vals.durationMin, (v) => { vals.durationMin = v; }));
  }

  if (type === 'diaper') {
    const detail = h('div', {});
    const renderDetail = () => {
      detail.textContent = '';
      if (vals.diaperKind === 'poop' || vals.diaperKind === 'mix') {
        detail.appendChild(chipSection('🎨 便便颜色', DIAPER_COLORS, vals.diaperColor, (v) => { vals.diaperColor = v; }));
        detail.appendChild(chipSection('🌀 便便形状', DIAPER_SHAPES, vals.diaperShape, (v) => { vals.diaperShape = v; }));
      }
    };
    body.appendChild(chipSection('💩 尿布类型', DIAPER_KINDS, vals.diaperKind, (v) => { vals.diaperKind = v; renderDetail(); }));
    body.appendChild(chipSection('📏 量', DIAPER_AMOUNTS, vals.diaperAmount, (v) => { vals.diaperAmount = v; }));
    body.appendChild(detail);
    renderDetail();
  }

  if (type === 'supplement') {
    const nameInp = h('input', { class: 'set-input', type: 'text', placeholder: '如 AD', value: vals.supplementName });
    nameInp.addEventListener('input', () => { vals.supplementName = nameInp.value.trim(); });
    const quick = h('div', { class: 'form-sec' });
    quick.appendChild(h('div', { class: 'form-sec-label', text: '💊 常用' }));
    const chips = h('div', { class: 'chips' });
    SUPPLEMENTS.forEach(([text, val]) => {
      const c = h('button', { class: 'chip' + (vals.supplementName === val ? ' on' : ''), type: 'button', text });
      c.addEventListener('click', () => {
        vals.supplementName = val;
        nameInp.value = val;
        chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
      });
      chips.appendChild(c);
    });
    quick.appendChild(chips);
    body.appendChild(quick);
    const nameSec = h('div', { class: 'form-sec' });
    nameSec.appendChild(h('div', { class: 'form-sec-label', text: '✏️ 名称' }));
    nameSec.appendChild(nameInp);
    body.appendChild(nameSec);
    body.appendChild(inputSection('💧 剂量', '如 1滴', vals.dose, (v) => { vals.dose = v; }));
  }

  if (type === 'sleep') {
    body.appendChild(sleepSection(vals));
  } else {
    body.appendChild(singleTimeSection(vals));
  }

  body.appendChild(noteSection(vals));
  sheet.appendChild(body);

  const actions = h('div', { class: 'modal-actions' });
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button', text: '取消' });
  cancel.addEventListener('click', close);
  if (editing) {
    const del = h('button', { class: 'btn btn-danger', type: 'button', text: '🗑 删除' });
    del.addEventListener('click', () => { store.deleteRecord(record.uid); sync.schedulePush(); close(); onDone(); });
    actions.appendChild(cancel);
    actions.appendChild(del);
  } else {
    actions.appendChild(cancel);
  }
  const save = h('button', { class: 'btn', type: 'button', text: editing ? '保存' : '确认' });
  save.addEventListener('click', () => {
    const patch = buildPatch(type, vals);
    if (editing) store.updateRecord(record.uid, patch);
    else store.addRecord(patch);
    sync.schedulePush();
    close();
    onDone();
  });
  actions.appendChild(save);
  sheet.appendChild(actions);

  backdrop.classList.add('show');
  sheet.classList.add('show');
}

/* ---------------- 睡眠：快捷时长 + 起止时间反推 ---------------- */
function sleepSection(vals) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: '😴 睡眠时长（快捷）' }));
  const chips = h('div', { class: 'chips' });
  const chipEls = [];
  const paint = (selMin) => chipEls.forEach(([btn, m]) => btn.classList.toggle('on', m === selMin));
  SLEEP_QUICK.forEach(([label, min]) => {
    const c = h('button', { class: 'chip', type: 'button', text: label });
    c.addEventListener('click', () => {
      const end = vals.endTs || Date.now();
      vals.endTs = end;
      vals.startTs = end - min * 60000;
      paint(min);
      refresh();
    });
    chipEls.push([c, min]);
    chips.appendChild(c);
  });
  sec.appendChild(chips);

  // 起止时间
  const startRow = timeValueRow('🌙 开始', vals.startTs, (ts) => { vals.startTs = ts; paint(null); refresh(); });
  const endRow = timeValueRow('☀️ 结束', vals.endTs, (ts) => { vals.endTs = ts; paint(null); refresh(); });
  sec.appendChild(startRow.el);
  sec.appendChild(h('div', { class: 'set-hint', text: '结束时间留空 = 正在睡（计时中）' }));
  sec.appendChild(endRow.el);

  // 结束时间可清空
  const clearEnd = h('button', { class: 'chip add', type: 'button', text: vals.endTs ? '结束时间留空（正在睡）' : '设置结束时间' });
  clearEnd.addEventListener('click', () => {
    if (vals.endTs) { vals.endTs = null; } else { vals.endTs = Date.now(); }
    clearEnd.textContent = vals.endTs ? '结束时间留空（正在睡）' : '设置结束时间';
    refresh();
  });
  sec.appendChild(clearEnd);

  function refresh() {
    startRow.set(vals.startTs);
    endRow.set(vals.endTs);
    // 反推匹配的时长高亮
    if (vals.endTs) {
      const min = Math.round((vals.endTs - vals.startTs) / 60000);
      paint(SLEEP_QUICK.find(([, m]) => m === min) ? min : null);
    } else {
      paint(null);
    }
  }
  // 初始：若默认正好 60 分钟则高亮 1 小时
  refresh();

  return sec;
}

function singleTimeSection(vals) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: '⏰ 时间' }));
  const row = timeValueRow('', vals.startTs, (ts) => { vals.startTs = ts; });
  row.el.classList.add('plain');
  sec.appendChild(row.el);
  return sec;
}

function timeValueRow(label, ts, onChange) {
  const valSpan = h('span', { text: ts != null ? fmtDateTime(ts) : '未设置' });
  const row = h('button', { class: 'value-row', type: 'button' },
    label ? h('span', { class: 'value-label', text: label }) : null,
    h('span', { class: 'value-right' }, valSpan, h('span', { class: 'value-arrow', text: '›' })));
  row.addEventListener('click', () => {
    pickDateTime(ts != null ? ts : Date.now(), (v) => { onChange(v); });
  });
  return {
    el: row,
    set(v) { valSpan.textContent = v != null ? fmtDateTime(v) : '未设置'; }
  };
}

/* ---------------- 控件 ---------------- */
function bigAmount(vals) {
  const box = h('div', { class: 'form-sec amount-sec' });
  box.appendChild(h('div', { class: 'form-sec-label', text: '🍼 进食量' }));
  const num = h('span', { class: 'amount-num', text: String(vals.amountMl == null ? 0 : vals.amountMl) });
  const row = h('div', { class: 'amount-box' });
  const minus = h('button', { class: 'step-btn', type: 'button', text: '−' });
  const plus = h('button', { class: 'step-btn', type: 'button', text: '＋' });
  const val = h('div', { class: 'amount-val' }, num, h('span', { class: 'amount-unit', text: 'ml' }));
  const setVal = (v) => { vals.amountMl = Math.max(0, Math.min(300, v)); num.textContent = String(vals.amountMl); };
  minus.addEventListener('click', () => setVal((vals.amountMl || 0) - 10));
  plus.addEventListener('click', () => setVal((vals.amountMl || 0) + 10));
  row.appendChild(minus); row.appendChild(val); row.appendChild(plus);
  box.appendChild(row);
  const presets = h('div', { class: 'amount-presets' });
  [60, 90, 120, 150, 180].forEach((p) => {
    const b = h('button', { class: 'pre-chip' + (vals.amountMl === p ? ' on' : ''), type: 'button', text: String(p) });
    b.addEventListener('click', () => {
      setVal(p);
      presets.querySelectorAll('.pre-chip').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
    presets.appendChild(b);
  });
  box.appendChild(presets);
  return box;
}

function chipSection(label, opts, current, onChange) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: label }));
  const chips = h('div', { class: 'chips' });
  let cur = current;
  opts.forEach(([text, val]) => {
    const c = h('button', { class: 'chip' + (val === cur ? ' on' : ''), type: 'button', text });
    c.addEventListener('click', () => {
      cur = val; onChange(val);
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
    });
    chips.appendChild(c);
  });
  sec.appendChild(chips);
  return sec;
}

function numSection(label, value, onChange) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: label }));
  const inp = h('input', { class: 'set-input', type: 'number', inputmode: 'numeric', value: value === '' ? '' : String(value) });
  inp.addEventListener('input', () => onChange(inp.value === '' ? '' : Number(inp.value)));
  sec.appendChild(inp);
  return sec;
}

function inputSection(label, placeholder, value, onChange) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: label }));
  const inp = h('input', { class: 'set-input', type: 'text', placeholder, value });
  inp.addEventListener('input', () => onChange(inp.value.trim()));
  sec.appendChild(inp);
  return sec;
}

function noteSection(vals) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: '📝 备注' }));
  const ta = h('textarea', { class: 'set-input', rows: '2', placeholder: '想记点啥…', value: vals.note });
  ta.addEventListener('input', () => { vals.note = ta.value.trim(); });
  sec.appendChild(ta);
  return sec;
}

function buildPatch(type, v) {
  const p = { type, startTs: v.startTs, endTs: null, note: v.note || '' };
  if (type === 'sleep') p.endTs = v.endTs || null;
  if (type === 'bottle') { p.amountMl = v.amountMl === '' ? null : Number(v.amountMl); p.milkType = v.milkType; }
  if (type === 'nursing') { p.side = v.side; p.durationMin = v.durationMin === '' ? null : Number(v.durationMin); }
  if (type === 'diaper') {
    p.diaperKind = v.diaperKind; p.diaperAmount = v.diaperAmount; p.diaperNote = v.diaperNote;
    if (v.diaperKind === 'poop' || v.diaperKind === 'mix') { p.diaperColor = v.diaperColor; p.diaperShape = v.diaperShape; }
    else { p.diaperColor = ''; p.diaperShape = ''; }
  }
  if (type === 'supplement') { p.supplementName = v.supplementName; p.dose = v.dose; }
  return p;
}
