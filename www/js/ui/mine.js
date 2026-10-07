// 我的页：宝宝信息 / 偏好 / 主题 / 作息历史 / 关于

import { h, ageLabel, toast } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import { applyTheme } from '../theme.js';
import * as history from './history.js';

let root = null;
let historyBox = null;
let historyOpen = false;

export function mount(c) { root = c; }

export function render() {
  if (!root) return;
  root.textContent = '';
  const s = store.getState();

  // 宝宝信息
  root.appendChild(h('div', { class: 'mine-title', text: '宝宝信息' }));
  const nameInput = h('input', { class: 'set-input', type: 'text', placeholder: '宝宝昵称', value: s.baby.name });
  nameInput.addEventListener('input', () => store.setBaby({ name: nameInput.value.trim() }));
  root.appendChild(nameInput);

  const genderChips = h('div', { class: 'chips' });
  [['男宝', 'boy'], ['女宝', 'girl']].forEach(([label, val]) => {
    const c = h('button', { class: 'chip' + (s.baby.gender === val ? ' on' : ''), type: 'button', text: label });
    c.addEventListener('click', () => {
      haptics.tap();
      const nv = s.baby.gender === val ? '' : val;
      store.setBaby({ gender: nv });
      genderChips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      if (nv) c.classList.add('on');
    });
    genderChips.appendChild(c);
  });
  root.appendChild(genderChips);

  const dateInput = h('input', { class: 'set-input', type: 'date', value: s.baby.birthday });
  const ageHint = h('div', { class: 'set-hint', text: s.baby.birthday ? '当前月龄：' + ageLabel(s.baby.birthday) : '填写出生日期后自动匹配月龄模板' });
  dateInput.addEventListener('change', () => {
    store.setBaby({ birthday: dateInput.value });
    ageHint.textContent = dateInput.value ? '当前月龄：' + ageLabel(dateInput.value) : '填写出生日期后自动匹配月龄模板';
  });
  root.appendChild(dateInput);
  root.appendChild(ageHint);

  // 偏好
  root.appendChild(h('div', { class: 'mine-title', text: '偏好' }));
  root.appendChild(toggleRow('月龄自动推进', s.settings.autoAge, (v) => store.setSetting('autoAge', v)));
  root.appendChild(toggleRow('震动反馈', s.settings.haptics, (v) => store.setSetting('haptics', v)));

  // 主题
  root.appendChild(h('div', { class: 'mine-title', text: '主题' }));
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
  root.appendChild(themes);

  // 作息历史
  root.appendChild(h('div', { class: 'mine-title', text: '作息历史' }));
  const histBtn = h('button', { class: 'mine-link', type: 'button', text: '查看每日作息完成记录 ›' });
  historyBox = h('div', { class: 'mine-history' });
  histBtn.addEventListener('click', () => {
    if (!historyOpen) {
      historyOpen = true;
      historyBox.classList.add('open');
      history.mount(historyBox);
      history.reset();
      history.render();
    } else {
      historyOpen = false;
      historyBox.classList.remove('open');
    }
  });
  root.appendChild(histBtn);
  root.appendChild(historyBox);

  root.appendChild(h('div', { class: 'set-foot', text: '宝宝作息 v3.0' }));
}

function toggleRow(title, value, onChange) {
  const row = h('div', { class: 'set-row' }, h('div', { class: 'set-row-title', text: title }));
  const sw = h('button', { class: 'switch' + (value ? ' on' : ''), type: 'button' }, h('span', { class: 'knob' }));
  sw.addEventListener('click', () => {
    haptics.tap();
    const nv = !sw.classList.contains('on');
    sw.classList.toggle('on', nv);
    onChange(nv);
  });
  row.appendChild(sw);
  return row;
}

export function onShow() { }
