// 记录表单：5 类记录的录入/编辑（底部面板）

import { h, toast } from '../util.js';
import * as store from '../store.js';
import { typeMeta, sideName, diaperName, two } from '../records.js';

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

function timeValue(ts) {
  const d = new Date(ts);
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
function tsFromTime(str) {
  const m = /(\d{1,2}):(\d{2})/.exec(str || '');
  const d = new Date();
  if (m) d.setHours(+m[1], +m[2], 0, 0);
  return d.getTime();
}

export function openForm({ type, record = null, onDone = () => { } }) {
  ensureDom();
  const editing = !!record;
  const meta = typeMeta(type);
  const base = record || { type };
  const vals = {
    startTs: base.startTs || Date.now(),
    endTs: base.endTs || null,
    amountMl: base.amountMl != null ? base.amountMl : '',
    milkType: base.milkType || 'breast',
    side: base.side || 'left',
    durationMin: base.durationMin != null ? base.durationMin : '',
    diaperKind: base.diaperKind || 'pee',
    diaperNote: base.diaperNote || '',
    supplementName: base.supplementName || '',
    dose: base.dose || ''
  };

  sheet.textContent = '';
  sheet.appendChild(h('div', { class: 'sheet-grip' }));
  sheet.appendChild(h('div', { class: 'sheet-title', text: (editing ? '编辑' : '记录') + ' · ' + meta.name }));

  const body = h('div', { class: 'form-body' });

  // 时间
  const startVal = timeValue(vals.startTs);
  body.appendChild(row('时间', h('input', {
    class: 'set-input', type: 'time', value: startVal,
    onchange: (e) => { vals.startTs = tsFromTime(e.target.value); }
  })));

  if (type === 'sleep') {
    body.appendChild(row('结束', h('input', {
      class: 'set-input', type: 'time', value: vals.endTs ? timeValue(vals.endTs) : '',
      onchange: (e) => { vals.endTs = e.target.value ? tsFromTime(e.target.value) : null; }
    })));
    body.appendChild(h('div', { class: 'set-hint', text: '结束时间留空 = 正在睡（进行中）' }));
  }

  if (type === 'bottle') {
    body.appendChild(row('奶量(ml)', numInput(vals.amountMl, (v) => { vals.amountMl = v; })));
    body.appendChild(row('类型', chipRow([['母乳', 'breast'], ['配方奶', 'formula']], vals.milkType, (v) => { vals.milkType = v; })));
  }

  if (type === 'nursing') {
    body.appendChild(row('侧', chipRow([['左', 'left'], ['右', 'right'], ['双侧', 'both']], vals.side, (v) => { vals.side = v; })));
    body.appendChild(row('时长(分钟)', numInput(vals.durationMin, (v) => { vals.durationMin = v; })));
  }

  if (type === 'diaper') {
    body.appendChild(row('类型', chipRow([['尿', 'pee'], ['大便', 'poop'], ['混合', 'mix']], vals.diaperKind, (v) => { vals.diaperKind = v; })));
    body.appendChild(row('性状', h('input', { class: 'set-input', type: 'text', placeholder: '如 量多,黄色,糊状', value: vals.diaperNote, oninput: (e) => { vals.diaperNote = e.target.value.trim(); } })));
  }

  if (type === 'supplement') {
    body.appendChild(row('名称', h('input', { class: 'set-input', type: 'text', placeholder: '如 AD', value: vals.supplementName, oninput: (e) => { vals.supplementName = e.target.value.trim(); } })));
    body.appendChild(row('剂量', h('input', { class: 'set-input', type: 'text', placeholder: '如 1滴', value: vals.dose, oninput: (e) => { vals.dose = e.target.value.trim(); } })));
  }

  sheet.appendChild(body);

  const actions = h('div', { class: 'modal-actions' });
  if (editing) {
    const del = h('button', { class: 'btn btn-danger', type: 'button', text: '删除' });
    del.addEventListener('click', () => { store.deleteRecord(record.id); close(); onDone(); });
    actions.appendChild(del);
  }
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button', text: '取消' });
  cancel.addEventListener('click', close);
  const save = h('button', { class: 'btn', type: 'button', text: editing ? '保存' : '记录' });
  save.addEventListener('click', () => {
    const patch = buildPatch(type, vals);
    if (editing) store.updateRecord(record.id, patch);
    else store.addRecord(patch);
    close();
    onDone();
  });
  actions.appendChild(cancel);
  actions.appendChild(save);
  sheet.appendChild(actions);

  backdrop.classList.add('show');
  sheet.classList.add('show');
}

function row(label, control) {
  return h('div', { class: 'form-row' }, h('span', { class: 'form-label', text: label }), control);
}
function numInput(value, onChange) {
  const inp = h('input', { class: 'set-input', type: 'number', inputmode: 'numeric', value: value === '' ? '' : String(value) });
  inp.addEventListener('input', () => { onChange(inp.value === '' ? '' : Number(inp.value)); });
  return inp;
}
function chipRow(opts, current, onChange) {
  const wrap = h('div', { class: 'chips' });
  let cur = current;
  opts.forEach(([label, val]) => {
    const c = h('button', { class: 'chip' + (val === cur ? ' on' : ''), type: 'button', text: label });
    c.addEventListener('click', () => {
      cur = val; onChange(val);
      wrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
    });
    wrap.appendChild(c);
  });
  return wrap;
}

function buildPatch(type, v) {
  const p = { type, startTs: v.startTs, endTs: null };
  if (type === 'sleep') { p.endTs = v.endTs || null; }
  if (type === 'bottle') { p.amountMl = v.amountMl === '' ? null : Number(v.amountMl); p.milkType = v.milkType; }
  if (type === 'nursing') { p.side = v.side; p.durationMin = v.durationMin === '' ? null : Number(v.durationMin); }
  if (type === 'diaper') { p.diaperKind = v.diaperKind; p.diaperNote = v.diaperNote; }
  if (type === 'supplement') { p.supplementName = v.supplementName; p.dose = v.dose; }
  return p;
}
