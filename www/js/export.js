// 日报导出：Canvas 绘制 PNG，写入缓存后调用系统分享

import { fullDateLabel } from './util.js';

function capPlugins() {
  return (window.Capacitor && window.Capacitor.Plugins) || {};
}

export function summarize(snap) {
  const rows = snap.rows || [];
  const total = rows.length;
  const done = rows.filter((r) => r.done).length;
  const amountRows = rows.filter((r) => r.amountMl != null);
  const totalMl = amountRows.reduce((s, r) => s + (r.amountMl || 0), 0);
  let playDone = 0, playTotal = 0;
  rows.forEach((r) => (r.plays || []).forEach((p) => { playTotal++; if (p.done) playDone++; }));
  const sleeps = rows.map((r) => r.sleep).filter(Boolean);
  return { total, done, feedCount: rows.length, amountRows: amountRows.length, totalMl, playDone, playTotal, sleeps };
}

export function reportText(dateStr, snap, babyName) {
  const s = summarize(snap);
  const who = babyName ? babyName + ' ' : '';
  const lines = [];
  lines.push(`${who}${fullDateLabel(dateStr)} 作息日报`);
  lines.push(`模板：${snap.templateName}`);
  lines.push(`完成：${s.done}/${s.total}`);
  lines.push(`奶量：已记录 ${s.amountRows} 次，合计 ${s.totalMl}ml`);
  lines.push(`陪玩：完成 ${s.playDone}/${s.playTotal} 项`);
  if (s.sleeps.length) lines.push(`睡眠：${s.sleeps.join(' / ')}`);
  lines.push('');
  (snap.rows || []).forEach((r) => {
    const mark = r.done ? '✓' : '·';
    const feed = r.amountMl != null ? `${r.feedType} ${r.amountMl}ml` : r.feedType;
    const plays = (r.plays || []).filter((p) => p.done).map((p) => p.text).join('、');
    lines.push(`${mark} ${r.time || '--:--'}  ${feed}${plays ? '  · ' + plays : ''}${r.sleep ? '  · 睡' + r.sleep : ''}`);
  });
  return lines.join('\n');
}

function drawReport(dateStr, snap, babyName) {
  const scale = 2;
  const W = 720, pad = 40;
  const rows = snap.rows || [];
  const s = summarize(snap);
  const rowH = 62;
  const headerH = 150;
  const summaryH = 150;
  const H = headerH + summaryH + rows.length * rowH + 90;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const FONT = '"PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f7faf1');
  bg.addColorStop(1, '#eef3e6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 头部
  const hd = ctx.createLinearGradient(0, 0, W, headerH);
  hd.addColorStop(0, '#7aa83a');
  hd.addColorStop(1, '#5f8a27');
  ctx.fillStyle = hd;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#fff';
  ctx.font = `800 38px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText((babyName ? babyName + ' ' : '') + '作息日报', pad, 56);
  ctx.font = `400 22px ${FONT}`;
  ctx.globalAlpha = 0.92;
  ctx.fillText(fullDateLabel(dateStr) + ' · ' + snap.templateName, pad, 100);
  ctx.globalAlpha = 1;

  // 完成率大数字
  ctx.fillStyle = '#5f8a27';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(`${s.done}/${s.total}`, W - pad - 150, 82);
  ctx.fillStyle = '#7d8a6b';
  ctx.font = `400 20px ${FONT}`;
  ctx.fillText('已完成', W - pad - 150, 124);

  // 汇总卡
  let y = headerH + 24;
  roundRect(ctx, pad, y, W - pad * 2, 96, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#2f3a24';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`🍼 喂奶 ${s.amountRows} 次 · 合计 ${s.totalMl}ml`, pad + 24, y + 34);
  ctx.fillText(`🧩 陪玩完成 ${s.playDone}/${s.playTotal} 项`, pad + 24, y + 72);
  y += 96 + 24;

  // 明细行
  rows.forEach((r) => {
    roundRect(ctx, pad, y, W - pad * 2, rowH - 10, 14);
    ctx.fillStyle = r.done ? '#eef6e0' : '#ffffff';
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5f8a27';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(r.time || '--:--', pad + 18, y + (rowH - 10) / 2);

    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = r.done ? '#98a58a' : '#2f3a24';
    const feed = r.amountMl != null ? `${r.feedType} ${r.amountMl}ml` : r.feedType;
    const plays = (r.plays || []).filter((p) => p.done).map((p) => p.text).join('、');
    let detail = feed + (plays ? ' · ' + plays : '') + (r.sleep ? ' · 睡' + r.sleep : '');
    if (detail.length > 30) detail = detail.slice(0, 30) + '…';
    ctx.fillText(detail, pad + 130, y + (rowH - 10) / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = r.done ? '#5f8a27' : '#c9d3ba';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(r.done ? '✓' : '—', W - pad - 18, y + (rowH - 10) / 2);
    ctx.textAlign = 'left';

    y += rowH;
  });

  // 页脚
  ctx.fillStyle = '#9aa78a';
  ctx.font = `400 18px ${FONT}`;
  ctx.fillText('宝宝作息 · 自动生成', pad, H - 40);

  return canvas;
}

function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareReport(dateStr, snap, babyName) {
  const P = capPlugins();
  const canvas = drawReport(dateStr, snap, babyName);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const fileName = `baby-report-${dateStr}.png`;
  const text = reportText(dateStr, snap, babyName);

  if (P.Filesystem && P.Share) {
    const written = await P.Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
    await P.Share.share({ title: '宝宝作息日报', text, files: [written.uri], dialogTitle: '分享日报' });
    return 'shared';
  }
  // 网页端：直接下载
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
  return 'downloaded';
}
