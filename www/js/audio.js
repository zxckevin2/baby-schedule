// 哄睡音频：优先原生 MediaPlayer（熄屏可播），网页端回退 HTML5 Audio

const ASSET_ID = 'sleep';
const ASSET_PATH = 'assets/sleep.mp3';

let mode = null;          // 'native' | 'web'
let htmlAudio = null;
let playing = false;
let volume = 0.7;
let looping = true;

function plugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeAudio) || null;
}

export async function init(settings = {}) {
  volume = typeof settings.volume === 'number' ? settings.volume : 0.7;
  looping = settings.loop !== false;
  const p = plugin();
  if (p) {
    try {
      await p.preload({ assetId: ASSET_ID, assetPath: ASSET_PATH, volume, audioChannelNum: 1, isUrl: false });
      await p.setVolume({ assetId: ASSET_ID, volume });
      p.addListener('complete', () => { if (looping) play(); });
      mode = 'native';
      return mode;
    } catch (e) {
      console.warn('native audio preload failed, fallback web', e);
    }
  }
  try {
    htmlAudio = new Audio(ASSET_PATH);
    htmlAudio.loop = looping;
    htmlAudio.volume = volume;
    htmlAudio.addEventListener('ended', () => { if (looping) play(); });
    mode = 'web';
  } catch (e) {
    mode = null;
  }
  return mode;
}

export function isReady() { return mode !== null; }
export function isPlaying() { return playing; }
export function getVolume() { return volume; }
export function getLoop() { return looping; }

export async function play() {
  if (mode === 'native') {
    const p = plugin();
    try {
      await p.setVolume({ assetId: ASSET_ID, volume });
      await p.play({ assetId: ASSET_ID });
      // play 内部会把 looping 重置为 false，这里补偿开启循环
      await p.loop({ assetId: ASSET_ID });
      playing = true;
    } catch (e) { console.warn('play failed', e); }
  } else if (mode === 'web' && htmlAudio) {
    htmlAudio.loop = looping;
    htmlAudio.volume = volume;
    try { await htmlAudio.play(); playing = true; } catch (e) { console.warn(e); }
  }
  return playing;
}

export async function pause() {
  if (mode === 'native') {
    const p = plugin();
    try { await p.pause({ assetId: ASSET_ID }); } catch (e) { }
  } else if (mode === 'web' && htmlAudio) {
    try { htmlAudio.pause(); } catch (e) { }
  }
  playing = false;
  return playing;
}

export async function stop() {
  if (mode === 'native') {
    const p = plugin();
    try { await p.stop({ assetId: ASSET_ID }); } catch (e) { }
  } else if (mode === 'web' && htmlAudio) {
    try { htmlAudio.pause(); htmlAudio.currentTime = 0; } catch (e) { }
  }
  playing = false;
  return playing;
}

export async function toggle() {
  if (playing) return pause();
  return play();
}

export async function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (mode === 'native') {
    const p = plugin();
    try { await p.setVolume({ assetId: ASSET_ID, volume }); } catch (e) { }
  } else if (htmlAudio) {
    htmlAudio.volume = volume;
  }
  return volume;
}

export async function getProgress() {
  if (mode === 'native') {
    const p = plugin();
    try {
      const c = await p.getCurrentTime({ assetId: ASSET_ID });
      const d = await p.getDuration({ assetId: ASSET_ID });
      return d ? Math.min(1, c / d) : 0;
    } catch (e) { return 0; }
  }
  if (htmlAudio && htmlAudio.duration) return Math.min(1, htmlAudio.currentTime / htmlAudio.duration);
  return 0;
}

export function setLoop(b) {
  looping = !!b;
  if (htmlAudio) htmlAudio.loop = looping;
  // 原生端循环通过 play 时补偿 loop()；已在播放时再调一次
  if (mode === 'native' && looping) {
    const p = plugin();
    try { p.loop({ assetId: ASSET_ID }); } catch (e) { }
  }
  return looping;
}
