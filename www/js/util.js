// 通用工具：DOM 助手、时间、弹窗、toast

export function h(tag, props, ...children) {
  const e = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'value') e.value = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function dateLabel() {
  const d = new Date();
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${w}`;
}

export function parseTime(s) {
  const m = /(\d{1,2})\s*[:：]\s*(\d{1,2})/.exec(String(s || ''));
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh > 23 || mm > 59) return null;
  return { h: hh, m: mm };
}

export function normTime(s) {
  const t = parseTime(s);
  if (!t) return s;
  return String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0');
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function ageMonths(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday + 'T00:00:00');
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

export function ageLabel(birthday) {
  const m = ageMonths(birthday);
  if (m == null) return '';
  if (m < 1) {
    const b = new Date(birthday + 'T00:00:00');
    const days = Math.max(0, Math.floor((Date.now() - b.getTime()) / 86400000));
    return days + ' 天';
  }
  return m + ' 个月';
}

export function suggestTemplateId(birthday) {
  const m = ageMonths(birthday);
  if (m == null) return null;
  if (m < 3) return 'm2';
  if (m < 4) return 'm3';
  return 'm45';
}

export function fullDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${w}`;
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

// 轻量输入弹窗，返回 Promise<string|null>
export function promptInput({ title = '输入', placeholder = '', value = '', multiline = false } = {}) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'modal-overlay' });
    const box = h('div', { class: 'modal-box' });
    box.appendChild(h('div', { class: 'modal-title', text: title }));
    const input = multiline
      ? h('textarea', { class: 'modal-input', placeholder, value, rows: '3' })
      : h('input', { class: 'modal-input', type: 'text', placeholder, value });
    box.appendChild(input);
    const row = h('div', { class: 'modal-actions' });
    const cancel = h('button', { class: 'btn btn-ghost', text: '取消' });
    const ok = h('button', { class: 'btn', text: '确定' });
    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const close = (val) => {
      overlay.remove();
      resolve(val);
    };
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', () => close(input.value.trim()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); close(input.value.trim()); }
    });
    setTimeout(() => input.focus(), 50);
  });
}
