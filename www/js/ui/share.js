// 家人共享：创建/加入家庭、成员、动态、同步

import { h, toast } from '../util.js';
import * as store from '../store.js';
import * as haptics from '../haptics.js';
import * as sync from '../cloud/sync.js';
import { timeStr } from '../records.js';

let backdrop = null;
let sheet = null;

export function mount() {
  backdrop = h('div', { class: 'sheet-backdrop' });
  backdrop.addEventListener('click', close);
  sheet = h('div', { class: 'sheet settings-sheet' });
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}

export function open() { render(); backdrop.classList.add('show'); sheet.classList.add('show'); }
export function close() { backdrop.classList.remove('show'); sheet.classList.remove('show'); }

function render() {
  sheet.textContent = '';
  sheet.appendChild(h('div', { class: 'sheet-grip' }));
  sheet.appendChild(h('div', { class: 'sheet-title', text: '👨‍👩‍👧 家人共享' }));
  const body = h('div', { class: 'settings-body' });
  sheet.appendChild(body);

  if (!sync.configured()) {
    body.appendChild(h('div', { class: 'set-hint', text: '云同步尚未配置。配置腾讯云开发环境后即可与家人实时共享记录。' }));
    return;
  }
  if (sync.joined()) renderJoined(body);
  else renderJoin(body);
}

function renderJoin(body) {
  const c = store.getState().cloud;
  body.appendChild(h('div', { class: 'set-hint', text: '创建家庭后把邀请码发给家人；家人输入邀请码即可加入，实时共享记录。' }));

  body.appendChild(h('div', { class: 'set-label', text: '创建家庭' }));
  const nameInp = h('input', { class: 'set-input', type: 'text', placeholder: '家庭名称（如：佑佑的家）', value: c.roomName || '' });
  const meInp = h('input', { class: 'set-input', type: 'text', placeholder: '你的称呼（如：妈妈）', value: c.memberName || '' });
  body.appendChild(nameInp);
  body.appendChild(meInp);
  const createBtn = h('button', { class: 'btn', type: 'button', text: '创建家庭' });
  createBtn.addEventListener('click', async () => {
    haptics.tap();
    createBtn.disabled = true; createBtn.textContent = '创建中…';
    try {
      const r = await sync.createRoom(nameInp.value.trim() || '我的家庭', meInp.value.trim() || '家人');
      toast('已创建，邀请码 ' + r.inviteCode);
      render();
    } catch (e) { toast('创建失败：' + (e.message || e)); createBtn.disabled = false; createBtn.textContent = '创建家庭'; }
  });
  body.appendChild(createBtn);

  body.appendChild(h('div', { class: 'set-label', text: '加入家庭' }));
  const codeInp = h('input', { class: 'set-input', type: 'text', inputmode: 'numeric', placeholder: '输入 6 位邀请码' });
  body.appendChild(codeInp);
  const joinBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: '加入家庭' });
  joinBtn.addEventListener('click', async () => {
    haptics.tap();
    const code = codeInp.value.trim();
    if (!/^\d{6}$/.test(code)) { toast('请输入 6 位邀请码'); return; }
    joinBtn.disabled = true; joinBtn.textContent = '加入中…';
    try {
      await sync.joinRoom(code, '家人');
      toast('已加入家庭');
      render();
    } catch (e) { toast('加入失败：' + (e.message || e)); joinBtn.disabled = false; joinBtn.textContent = '加入家庭'; }
  });
  body.appendChild(joinBtn);
}

function renderJoined(body) {
  const c = store.getState().cloud;
  const card = h('div', { class: 'share-card' },
    h('div', { class: 'share-room', text: '🏠 ' + (c.roomName || '我的家庭') }),
    h('div', { class: 'share-code-row' },
      h('span', { class: 'share-code-label', text: '邀请码' }),
      h('span', { class: 'share-code', text: c.inviteCode || '------' }),
      copyBtn(c.inviteCode)));
  body.appendChild(card);

  const status = h('div', { class: 'set-hint', text: c.lastSync ? '上次同步：' + timeStr(c.lastSync) : '尚未同步' });
  body.appendChild(status);

  const membersBox = h('div', { class: 'set-label', text: '成员' });
  body.appendChild(membersBox);
  const membersList = h('div', { class: 'share-members' });
  membersList.appendChild(h('div', { class: 'set-hint', text: '加载中…' }));
  body.appendChild(membersList);

  const logBox = h('div', { class: 'set-label', text: '动态' });
  body.appendChild(logBox);
  const logList = h('div', { class: 'share-log' });
  body.appendChild(logList);

  const actions = h('div', { class: 'toolbar' });
  const syncBtn = h('button', { class: 'btn', type: 'button', text: '立即同步' });
  syncBtn.addEventListener('click', async () => {
    haptics.tap();
    syncBtn.disabled = true; syncBtn.textContent = '同步中…';
    try { await sync.fullSync(); status.textContent = '上次同步：' + timeStr(Date.now()); await loadLists(membersList, logList); toast('同步完成'); }
    catch (e) { toast('同步失败：' + (e.message || e)); }
    syncBtn.disabled = false; syncBtn.textContent = '立即同步';
  });
  const leaveBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: '退出家庭' });
  leaveBtn.addEventListener('click', async () => {
    haptics.tap();
    await sync.leaveRoom();
    toast('已退出家庭共享');
    render();
  });
  actions.appendChild(syncBtn);
  actions.appendChild(leaveBtn);
  body.appendChild(actions);

  loadLists(membersList, logList);
}

async function loadLists(membersList, logList) {
  try {
    const members = await sync.pullMembers();
    membersList.textContent = '';
    if (!members.length) membersList.appendChild(h('div', { class: 'set-hint', text: '暂无成员' }));
    members.forEach((m) => {
      const isMe = m.device_id === store.getState().cloud.deviceId;
      membersList.appendChild(h('span', { class: 'share-member' + (isMe ? ' me' : ''), text: '👤 ' + (m.name || '家人') + (isMe ? '（我）' : '') }));
    });
  } catch (e) {
    membersList.textContent = '';
    const retry = h('button', { class: 'share-copy', type: 'button', text: '加载失败，点此重试' });
    retry.addEventListener('click', () => loadLists(membersList, logList));
    membersList.appendChild(retry);
  }

  try {
    const logs = await sync.pullLog();
    logList.textContent = '';
    if (!logs.length) logList.appendChild(h('div', { class: 'set-hint', text: '暂无动态' }));
    logs.forEach((l) => {
      logList.appendChild(h('div', { class: 'share-log-item' },
        h('span', { class: 'sl-time', text: timeStr(Number(l.ts)) }),
        h('span', { class: 'sl-text', text: (l.member_name || '家人') + ' ' + l.text })));
    });
  } catch (e) { logList.textContent = '动态加载失败'; }
}

function copyBtn(text) {
  const b = h('button', { class: 'share-copy', type: 'button', text: '复制' });
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(String(text || '')); toast('已复制邀请码'); }
    catch (e) { toast('复制失败，请手动记录：' + text); }
  });
  return b;
}
