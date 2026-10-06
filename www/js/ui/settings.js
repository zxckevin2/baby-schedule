// 设置面板：宝宝信息 / 主题 / 震动 / 月龄自动推进

import { h, toast, ageLabel } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import { applyTheme } from '../theme.js';

let backdrop = null;
let sheet = null;
let refs = {};
let onChanged = () => { };

export function mount(opts = {}) {
  onChanged = opts.onChanged || onChanged;

  backdrop = h('div', { class: 'sheet-backdrop' });
  backdrop.addEventListener('click', close);
  sheet = h('div', { class: 'sheet settings-sheet' });
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}

export function open() {
  build();
  backdrop.classList.add('show');
  sheet.classList.add('show');
}
export function close() {
  if (backdrop) backdrop.classList.remove('show');
  if (sheet) sheet.classList.remove('show');
}

function build() {
  sheet.textContent = '';
  refs = {};
  sheet.appendChild(h('div', { class: 'sheet-grip' }));
  sheet.appendChild(h('div', { class: 'sheet-title', text: '设置' }));

  const s = store.getState();
  const body = h('div', { class: 'settings-body' });

  // 宝宝信息
  body.appendChild(h('div', { class: 'set-label', text: '宝宝信息' }));
  const nameInput = h('input', { class: 'set-input', type: 'text', placeholder: '宝宝昵称', value: s.baby.name });
  nameInput.addEventListener('input', () => store.setBaby({ name: nameInput.value.trim() }));
  body.appendChild(nameInput);

  const genderChips = h('div', { class: 'chips' });
  [['男宝', 'boy'], ['女宝', 'girl']].forEach(([label, val]) => {
    const c = h('button', { class: 'chip' + (s.baby.gender === val ? ' on' : ''), type: 'button', text: label });
    c.addEventListener('click', () => {
      haptics.tap();
      const nv = s.baby.gender === val ? '' : val;
      store.setBaby({ gender: nv });
      genderChips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      if (nv) c.classList.add('on');
      onChanged();
    });
    genderChips.appendChild(c);
  });
  body.appendChild(genderChips);

  const dateInput = h('input', { class: 'set-input', type: 'date', value: s.baby.birthday });
  dateInput.addEventListener('change', () => {
    store.setBaby({ birthday: dateInput.value });
    refs.age.textContent = dateInput.value ? '当前月龄：' + ageLabel(dateInput.value) : '填写出生日期后自动匹配月龄模板';
    onChanged();
  });
  body.appendChild(dateInput);
  refs.age = h('div', { class: 'set-hint', text: s.baby.birthday ? '当前月龄：' + ageLabel(s.baby.birthday) : '填写出生日期后自动匹配月龄模板' });
  body.appendChild(refs.age);

  // 开关行
  body.appendChild(h('div', { class: 'set-label', text: '偏好' }));
  body.appendChild(toggleRow('月龄自动推进', '打开后按宝宝月龄自动切换作息模板', s.settings.autoAge, (v) => {
    store.setSetting('autoAge', v); onChanged();
  }));
  body.appendChild(toggleRow('震动反馈', '点击胶囊/勾选时轻微震动', s.settings.haptics, (v) => {
    store.setSetting('haptics', v);
  }));

  // 主题
  body.appendChild(h('div', { class: 'set-label', text: '主题' }));
  const themes = h('div', { class: 'chips' });
  [['跟随系统', 'auto'], ['浅色', 'light'], ['深色', 'dark']].forEach(([label, val]) => {
    const c = h('button', { class: 'chip' + (s.settings.theme === val ? ' on' : ''), type: 'button', text: label });
    c.addEventListener('click', () => {
      haptics.tap();
      store.setSetting('theme', val);
      applyTheme();
      themes.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
    });
    themes.appendChild(c);
  });
  body.appendChild(themes);

  body.appendChild(h('div', { class: 'set-foot', text: '宝宝作息 v2.1' }));

  sheet.appendChild(body);
}

function toggleRow(title, desc, value, onChange) {
  const row = h('div', { class: 'set-row' },
    h('div', { class: 'set-row-text' }, h('div', { class: 'set-row-title', text: title }), h('div', { class: 'set-row-desc', text: desc })));
  const sw = h('button', { class: 'switch' + (value ? ' on' : ''), type: 'button' });
  sw.appendChild(h('span', { class: 'knob' }));
  sw.addEventListener('click', () => {
    haptics.tap();
    const nv = !sw.classList.contains('on');
    sw.classList.toggle('on', nv);
    onChange(nv);
  });
  row.appendChild(sw);
  return row;
}
