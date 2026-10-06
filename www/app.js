(function () {
  'use strict';

  var STORAGE_KEY = 'baby_schedule_v1';

  var DEFAULT_SCHEDULE = [
    { time: '07:30', feed: '喂奶', play: '洗漱、黑白卡片、被动操、吃D或AD', sleep: '1-1.5小时' },
    { time: '10:00', feed: '喂奶', play: '读故事、听音乐、俯卧抬头、排气操', sleep: '1小时' },
    { time: '12:30', feed: '喂奶', play: '唱歌、俯卧抬头、被动操、追视追听', sleep: '2小时' },
    { time: '15:30', feed: '喂奶', play: '黑白卡片、追视追听、被动操、听音乐', sleep: '1-1.5小时' },
    { time: '18:00', feed: '喂奶', play: '唱歌闲聊、练抬头、被动操、洗澡抚触', sleep: '30分钟' },
    { time: '20:00', feed: '喂奶', play: '吃完奶睡前仪式：读故事、唱歌，然后直接睡', sleep: '' },
    { time: '03:00', feed: '夜奶1', play: '喂奶到一半换尿布拍嗝，吃完剩下一半直接睡。', sleep: '' }
  ];

  var DEFAULT_NOTES = [
    '出生60-90天的宝宝，清醒时间40-60分钟，5次小觉。',
    '一天喂奶7次，1顿夜奶，可根据宝宝情况奶点前后20分钟灵活调整。',
    '坚持规律作息的宝宝减少夜奶会更顺利，睡前母乳亲喂多喂10分钟，瓶喂增加20-30ml的量。',
    '一天睡眠时间15-18小时，奶量600-800ml/天。喂完奶需拍嗝。',
    '天气合适每天推车带宝宝出去户外时间1小时。',
    '专注力培养：每天独立玩耍时间5-10分钟，一天2次。',
    '每天玩环节可以练抬头3-5次，抬头能力是所有大运动的基础。',
    '白天“吃-玩-睡”模式：吃好奶陪玩后固定时间放小床睡觉，窗帘拉开，正常走路和说话，不需要刻意营造过于安静的睡眠环境。',
    '夜里“吃-睡”模式：开小夜灯，拉上窗帘，让宝宝分清昼夜。',
    '母乳亲喂：每边10-15分钟，每次喂奶时间20-30分钟。',
    '如果现在的哄睡方式出现反效果宝宝反而睡不好，可以考虑培养引导自主入睡，让宝宝学会吃手自我安抚入睡和接觉，长期可以让宝宝拥有更好的睡眠质量。',
    '宝宝这个月龄可能会出现攒肚，甚至有超过10天的，攒肚不需要特别处理；排便困难并且干燥的需处理，配合吃益生菌或开塞露。'
  ];

  var DEFAULT_EDU = [
    { title: '大运动', items: ['俯卧抬头', '被动操', '抬头转头', '俯卧摇铃追视', '健身架踢一踢', '左右转身'] },
    { title: '精细运动', items: ['让宝宝吃手', '抓握沙锤', '手指按摩操', '俯卧拍布书', '抓握彩带', '打开小手掌'] },
    { title: '认知能力', items: ['黑白红片', '手指谣', '红球追视', '摇铃追听', '照镜子', '看布书'] },
    { title: '语言启蒙', items: ['说话闲聊', '发aoe和bpm的音', '读故事', '唱歌', '听音乐'] },
    { title: '感统训练', items: ['牵拉坐起', '触感球', '洗澡抚触', '摸不同材质', '俯卧摇一摇', '床单荡秋千'] }
  ];

  var state = { seq: 0, date: '', schedule: [], notes: [], edu: [] };
  var saveTimer = null;

  /* ---------------- plugins ---------------- */
  function plugins() { return (window.Capacitor && window.Capacitor.Plugins) || {}; }
  function prefs() { return plugins().Preferences || null; }
  function notif() { return plugins().LocalNotifications || null; }

  /* ---------------- helpers ---------------- */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateLabel() {
    var d = new Date();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function parseTime(s) {
    var m = /(\d{1,2})\s*[:：]\s*(\d{1,2})/.exec(String(s || ''));
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return { h: h, m: mi };
  }
  function autosize(t) {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  /* ---------------- state ---------------- */
  function freshState() {
    var seq = 0;
    var schedule = DEFAULT_SCHEDULE.map(function (r) {
      seq += 1;
      return { id: seq, time: r.time, feed: r.feed, play: r.play, sleep: r.sleep, done: false, remind: false };
    });
    return { seq: seq, date: todayStr(), schedule: schedule, notes: DEFAULT_NOTES.slice(), edu: DEFAULT_EDU };
  }

  async function load() {
    var raw = null;
    var p = prefs();
    if (p) { try { var r = await p.get({ key: STORAGE_KEY }); raw = r.value; } catch (e) { } }
    if (raw == null) { try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { } }

    var data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
    if (!data || !Array.isArray(data.schedule)) data = freshState();

    data.notes = (data.notes && data.notes.length) ? data.notes : DEFAULT_NOTES.slice();
    data.edu = (data.edu && data.edu.length) ? data.edu : DEFAULT_EDU;

    var maxId = 0;
    data.schedule = data.schedule.map(function (r) {
      return {
        id: (typeof r.id === 'number' && r.id > 0) ? r.id : 0,
        time: r.time || '', feed: r.feed || '', play: r.play || '', sleep: r.sleep || '',
        done: !!r.done, remind: !!r.remind
      };
    });
    data.schedule.forEach(function (r) {
      if (r.id) { if (r.id > maxId) maxId = r.id; }
      else { maxId += 1; r.id = maxId; }
    });
    data.seq = Math.max(data.seq || 0, maxId);

    var today = todayStr();
    if (data.date !== today) { data.date = today; data.schedule.forEach(function (r) { r.done = false; }); }

    return data;
  }

  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 250);
  }
  async function doSave() {
    var v = JSON.stringify(state);
    var p = prefs();
    if (p) { try { await p.set({ key: STORAGE_KEY, value: v }); return; } catch (e) { } }
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { }
  }

  /* ---------------- header ---------------- */
  function updateHeader() {
    var total = state.schedule.length;
    var done = state.schedule.filter(function (r) { return r.done; }).length;
    document.getElementById('headerSub').textContent = dateLabel() + ' · 已完成 ' + done + '/' + total;
  }

  /* ---------------- render schedule ---------------- */
  function buildCard(row) {
    var card = document.createElement('div');
    card.className = 'card' + (row.done ? ' done' : '');

    var top = document.createElement('div');
    top.className = 'card-top';

    var check = document.createElement('label');
    check.className = 'check';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = row.done;
    var box = document.createElement('span');
    box.className = 'box';
    check.appendChild(cb);
    check.appendChild(box);
    cb.addEventListener('change', function () {
      row.done = cb.checked;
      card.classList.toggle('done', row.done);
      updateHeader();
      save();
    });
    top.appendChild(check);

    var time = document.createElement('input');
    time.className = 'time';
    time.type = 'text';
    time.value = row.time;
    time.placeholder = '07:30';
    time.inputMode = 'numeric';
    time.addEventListener('input', function () { row.time = time.value; save(); });
    time.addEventListener('change', function () { row.time = time.value; save(); syncReminders(); });
    top.appendChild(time);

    var bell = document.createElement('button');
    bell.className = 'icon-btn bell' + (row.remind ? ' on' : '');
    bell.innerHTML = '<span class="ico">' + (row.remind ? '🔔' : '🔕') + '</span>';
    bell.title = '每天提醒';
    bell.addEventListener('click', async function () {
      if (!row.remind) {
        var ok = await ensureNotifPermission();
        if (!ok) return;
        if (!parseTime(row.time)) { toast('请先填写有效时间，如 07:30'); return; }
        row.remind = true;
      } else {
        row.remind = false;
      }
      bell.classList.toggle('on', row.remind);
      bell.querySelector('.ico').textContent = row.remind ? '🔔' : '🔕';
      save();
      await syncReminders();
      toast(row.remind ? ('已开启 ' + row.time + ' 每天提醒') : '已关闭提醒');
    });
    top.appendChild(bell);

    var del = document.createElement('button');
    del.className = 'icon-btn del';
    del.innerHTML = '<span class="ico">🗑</span>';
    del.title = '删除';
    del.addEventListener('click', async function () {
      var i = state.schedule.indexOf(row);
      if (i >= 0) state.schedule.splice(i, 1);
      save();
      renderSchedule();
      updateHeader();
      await syncReminders();
      toast('已删除');
    });
    top.appendChild(del);

    card.appendChild(top);

    var body = document.createElement('div');
    body.className = 'card-body';

    var feedInput;
    body.appendChild(field('吃', row.feed, false, function (el) { feedInput = el; }));
    var playInput;
    body.appendChild(field('陪玩', row.play, true, function (el) { playInput = el; }));
    body.appendChild(field('睡小觉', row.sleep, false, function (el) { }));

    card.appendChild(body);

    function field(label, value, multi, assign) {
      var wrap = document.createElement('div');
      wrap.className = 'field';
      var l = document.createElement('span');
      l.className = 'lbl';
      l.textContent = label;
      var el = multi ? document.createElement('textarea') : document.createElement('input');
      el.className = 'val';
      if (!multi) el.type = 'text';
      el.value = value;
      var key = label === '吃' ? 'feed' : (label === '陪玩' ? 'play' : 'sleep');
      el.addEventListener('input', function () {
        row[key] = el.value;
        if (multi) autosize(el);
        save();
      });
      el.addEventListener('change', function () { row[key] = el.value; save(); });
      assign(el);
      wrap.appendChild(l);
      wrap.appendChild(el);
      setTimeout(function () { if (multi) autosize(el); }, 0);
      return wrap;
    }

    setTimeout(function () {
      card.querySelectorAll('textarea.val').forEach(autosize);
    }, 0);

    return card;
  }

  function renderSchedule() {
    var wrap = document.getElementById('scheduleList');
    wrap.textContent = '';
    state.schedule.forEach(function (row) { wrap.appendChild(buildCard(row)); });
  }

  /* ---------------- render edu + notes ---------------- */
  function renderEdu() {
    var wrap = document.getElementById('eduWrap');
    wrap.textContent = '';
    state.edu.forEach(function (sec) {
      var card = document.createElement('div');
      card.className = 'edu-card';
      var head = document.createElement('div');
      head.className = 'edu-head';
      head.textContent = sec.title;
      var items = document.createElement('div');
      items.className = 'edu-items';
      (sec.items || []).forEach(function (it) {
        var tag = document.createElement('span');
        tag.className = 'edu-item';
        tag.textContent = it;
        items.appendChild(tag);
      });
      card.appendChild(head);
      card.appendChild(items);
      wrap.appendChild(card);
    });
  }

  function renderNotes() {
    var list = document.getElementById('notesList');
    list.textContent = '';
    state.notes.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      list.appendChild(li);
    });
  }

  /* ---------------- notifications ---------------- */
  async function ensureNotifPermission() {
    var n = notif();
    if (!n) { toast('当前环境不支持提醒，安装 APK 后可用'); return false; }
    try {
      var perm = await n.checkPermissions();
      if (perm.display !== 'granted') {
        var req = await n.requestPermissions();
        if (req.display !== 'granted') { toast('未获得通知权限，请到系统设置开启'); return false; }
      }
      return true;
    } catch (e) {
      toast('通知权限请求失败');
      return false;
    }
  }

  async function syncReminders() {
    var n = notif();
    if (!n) return;
    try {
      var pending = await n.getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await n.cancel({ notifications: pending.notifications.map(function (x) { return { id: x.id }; }) });
      }
      var list = [];
      state.schedule.forEach(function (row) {
        if (!row.remind) return;
        var t = parseTime(row.time);
        if (!t) return;
        var body = row.time + ' ' + (row.feed || '');
        if (row.play) body += ' · ' + row.play.slice(0, 24);
        list.push({
          id: row.id,
          title: '宝宝作息提醒',
          body: body,
          schedule: { on: { hour: t.h, minute: t.m }, repeats: true, allowWhileIdle: true }
        });
      });
      if (list.length) await n.schedule({ notifications: list });
    } catch (e) {
      console.warn('syncReminders failed', e);
    }
  }

  /* ---------------- actions ---------------- */
  function newDay() {
    state.date = todayStr();
    state.schedule.forEach(function (r) { r.done = false; });
    save();
    renderSchedule();
    updateHeader();
    toast('已开始新的一天，勾选已清空');
  }

  function addRow() {
    state.seq += 1;
    state.schedule.push({ id: state.seq, time: '', feed: '喂奶', play: '', sleep: '', done: false, remind: false });
    save();
    renderSchedule();
    updateHeader();
    var cards = document.querySelectorAll('#scheduleList .card');
    var last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var t = last.querySelector('.time');
      if (t) t.focus();
    }
  }

  /* ---------------- init ---------------- */
  async function init() {
    state = await load();
    renderSchedule();
    renderEdu();
    renderNotes();
    updateHeader();

    document.getElementById('btnNewDay').addEventListener('click', newDay);
    document.getElementById('btnAddRow').addEventListener('click', addRow);

    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('page-' + btn.dataset.tab).classList.add('active');
      });
    });

    syncReminders();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
