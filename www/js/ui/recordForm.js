// 记录表单：5 类记录的录入/编辑（底部面板，含自定义时间选择）

import { h } from '../util.js';
import * as store from '../store.js';
import { typeMeta, MILK_TYPES, DIAPER_KINDS, DIAPER_AMOUNTS, DIAPER_COLORS, DIAPER_SHAPES, SIDES, labelOf } from '../records.js';
import { pickDateTime, fmtDateTime } from '../picker.js';

let sheet = null;
let backdrop = null;

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
    startTs: base.startTs || now,
    endTs: base.endTs || null,
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
    body.appendChild(chipSection('瓶喂', MILK_TYPES, vals.milkType, (v) => { vals.milkType = v; }));
  }

  if (type === 'nursing') {
    body.appendChild(chipSection('侧', SIDES, vals.side, (v) => { vals.side = v; }));
    body.appendChild(numSection('时长（分钟）', vals.durationMin, (v) => { vals.durationMin = v; }));
  }

  if (type === 'diaper') {
    const detail = h('div', {});
    const renderDetail = () => {
      detail.textContent = '';
      if (vals.diaperKind === 'poop' || vals.diaperKind === 'mix') {
        detail.appendChild(chipSection('便便颜色', DIAPER_COLORS, vals.diaperColor, (v) => { vals.diaperColor = v; }, true));
        detail.appendChild(chipSection('便便形状', DIAPER_SHAPES, vals.diaperShape, (v) => { vals.diaperShape = v; }, true));
      }
    };
    body.appendChild(chipSection('尿布类型', DIAPER_KINDS, vals.diaperKind, (v) => { vals.diaperKind = v; renderDetail(); }));
    body.appendChild(chipSection('量', DIAPER_AMOUNTS, vals.diaperAmount, (v) => { vals.diaperAmount = v; }, true));
    body.appendChild(detail);
    renderDetail();
  }

  if (type === 'supplement') {
    body.appendChild(inputSection('名称', '如 AD', vals.supplementName, (v) => { vals.supplementName = v; }));
    body.appendChild(inputSection('剂量', '如 1滴', vals.dose, (v) => { vals.dose = v; }));
  }

  // 时间（自定义选择器）
  const timeSection = h('div', { class: 'form-sec' },
    h('div', { class: 'form-sec-label', text: '时间' }));
  const timeBtn = h('button', { class: 'value-row', type: 'button' }, h('span', { text: fmtDateTime(vals.startTs) }), h('span', { class: 'value-arrow', text: '›' }));
  timeBtn.addEventListener('click', () => {
    pickDateTime(vals.startTs, (ts) => { vals.startTs = ts; timeBtn.firstChild.textContent = fmtDateTime(ts); });
  });
  timeSection.appendChild(timeBtn);
  body.appendChild(timeSection);

  // 备注
  body.appendChild(noteSection(vals));

  sheet.appendChild(body);

  const actions = h('div', { class: 'modal-actions' });
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button', text: '取消' });
  cancel.addEventListener('click', close);
  if (editing) {
    const del = h('button', { class: 'btn btn-danger', type: 'button', text: '删除' });
    del.addEventListener('click', () => { store.deleteRecord(record.id); close(); onDone(); });
    actions.appendChild(cancel);
    actions.appendChild(del);
  } else {
    actions.appendChild(cancel);
  }
  const save = h('button', { class: 'btn', type: 'button', text: editing ? '保存' : '确认' });
  save.addEventListener('click', () => {
    const patch = buildPatch(type, vals);
    if (editing) store.updateRecord(record.id, patch);
    else store.addRecord(patch);
    close();
    onDone();
  });
  actions.appendChild(save);
  sheet.appendChild(actions);

  backdrop.classList.add('show');
  sheet.classList.add('show');
}

/* ---------------- 控件 ---------------- */
function bigAmount(vals) {
  const box = h('div', { class: 'form-sec amount-sec' });
  box.appendChild(h('div', { class: 'form-sec-label', text: '进食量' }));
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

function chipSection(label, opts, current, onChange, allowEmpty) {
  const sec = h('div', { class: 'form-sec' });
  sec.appendChild(h('div', { class: 'form-sec-label', text: label }));
  const chips = h('div', { class: 'chips' });
  const list = opts.slice();
  let cur = current;
  list.forEach(([text, val]) => {
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
  sec.appendChild(h('div', { class: 'form-sec-label', text: '备注' }));
  const ta = h('textarea', { class: 'set-input', rows: '2', placeholder: '备注', value: vals.note });
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
