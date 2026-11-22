'use strict';
/* ===================== ÇEKİCİ VARDİYASI =====================
   Arcade çekici sürüş oyunu. Dünya metre cinsinden, x/z düzleminde.
   Yön: h açısı, ileri = (cos h, sin h), sağ = (-sin h, cos h).      */
const T = THREE, $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const P = 60, NR = 9, NB = NR - 1, CEN = (NR - 1) / 2, HALF = CEN * P, LANE = 4, ROADW = 16, rc = i => (i - CEN) * P, bc = i => (i - (NB - 1) / 2) * P;   // 9x9 yol ızgarası, 8x8 blok
const MS = 0.4, NTRAF = 22, WORLD = 1150, HW0 = HALF + 8, LN1 = 3.85, LN2 = 7.55;   // MS: minimap ölçeği
const SHIFT_LEN = 300, HOOK_OFF = 3.45, ROPE_MIN = 3.7, BODY = 3.6;

/* ---------- Kayıt ve geliştirmeler ---------- */
const UPS = [
  { k: 'motor', name: 'Motor', desc: '+%8 hız ve ivme', base: 250 },
  { k: 'turbo', name: 'Turbo tankı', desc: '+%25 turbo kapasitesi', base: 200 },
  { k: 'rope', name: 'Halat ve kasa', desc: 'Çarpışma hasarı -%12', base: 300 },
  { k: 'grip', name: 'Lastikler', desc: '+%10 yol tutuşu', base: 200 }
];
const save = { money: 0, best: 0, up: { motor: 0, turbo: 0, rope: 0, grip: 0 }, owned: ['std'], truck: 'std', settings: { vol: 80, cam: 0, quality: 'high', shake: true, arrow: true, mini: true, mute: false } };
try { const s = JSON.parse(localStorage.getItem('cekici_v2')); if (s) { save.money = s.money || 0; save.best = s.best || 0; Object.assign(save.up, s.up || {}); if (Array.isArray(s.owned)) save.owned = s.owned; if (s.truck) save.truck = s.truck; if (!save.owned.includes('std')) save.owned.push('std'); if (s.settings) Object.assign(save.settings, s.settings); } } catch (e) {}
const persist = () => { try { localStorage.setItem('cekici_v2', JSON.stringify(save)); } catch (e) {} };
const upCost = k => UPS.find(u => u.k === k).base * (save.up[k] + 1);
const tmk = o => Object.assign({ scale: 1, mode: 'rope', cap: 1, wb: 4.6, len: 6.4, circ: [2.1, 0, -2.1], rad: 1.35, loadT: 1.5, cam: 0, lift: 0, tilt: 0 }, o);
/* Şimdilik tüm çekiciler ücretsiz (price: 0). Planlanan fiyatlar 'plan' alanında; geri dönmek için price = plan yap. */
const TRUCKS = [
  tmk({ id: 'std', variant: 'winch', name: 'Vinçli Çekici', icon: '🔗', price: 0, plan: 0, color: '#ffb703', accent: '#ffb703', label: 'VİNÇLİ ÇEKİCİ', mass: 3, vmax: 30, acc: 15, steer: 1, grip: 1, towSlow: 0.84, towAcc: 0.8, dmg: 1, hookOff: 3.45,
    classes: ['car', 'moto'], mix: { car: 85, moto: 15 }, desc: 'Vinç kolu ve halatla aracı arkasından sürükler. Dengeli, her işe yarar. Başlangıç çekicin.', stats: [3, 3, 3, 3, 3] }),
  tmk({ id: 'lift', variant: 'lift', name: 'Kaldırma Aparatlı Çekici', icon: '⬆️', price: 0, plan: 800, color: '#1fb5a6', accent: '#ffffff', label: 'LİFT ÇEKİCİ', mass: 3, vmax: 33, acc: 17, steer: 1.08, grip: 1.05, towSlow: 0.9, towAcc: 0.88, dmg: 0.75, mode: 'lift', hookOff: 5.4, lift: 0.62, tilt: 0.28,
    classes: ['car'], mix: { car: 100 }, desc: 'Aracın iki tekerini kaldırıp arkasında taşır. Sallanmaz, hızlıdır, ama sadece otomobil alır.', stats: [4, 4, 4, 2, 3] }),
  tmk({ id: 'moto', variant: 'moto', name: 'Motosiklet Çekicisi', icon: '🏍️', price: 0, plan: 900, color: '#ff7a1a', accent: '#16296b', label: 'MOTO TAŞIMA', mass: 2.2, vmax: 36, acc: 19, steer: 1.2, grip: 1.12, towSlow: 0.97, towAcc: 0.95, dmg: 0.4, mode: 'flat', hookOff: 3.6, loadT: 1.0, cap: 3,
    slots: [{ x: -1.3, y: 1.55, z: -0.85 }, { x: -1.3, y: 1.55, z: 0 }, { x: -1.3, y: 1.55, z: 0.85 }], classes: ['moto'], mix: { moto: 100 }, desc: 'Motosiklet ve scooter taşır, aynı anda 3 tane. Çok hızlı ve çevik. Sadece motosiklet çağrıları gelir.', stats: [5, 5, 5, 2, 3] }),
  tmk({ id: 'flat', variant: 'slide', name: 'Kayar Kasa Çekici', icon: '🚚', price: 0, plan: 1200, color: '#f2f2f6', accent: '#ff7a1a', label: 'KAYAR KASA', mass: 4, vmax: 27, acc: 13, steer: 0.92, grip: 1, towSlow: 0.93, towAcc: 0.9, dmg: 0.35, mode: 'flat', hookOff: 5.0,
    slots: [{ x: -1.5, y: 1.55, z: 0 }], classes: ['car', 'moto'], mix: { car: 85, moto: 15 }, desc: 'Hidrolik platform kayıp aracı kasaya alır. Savrulma yok, hasar çok az.', stats: [3, 3, 3, 4, 5] }),
  tmk({ id: 'under', variant: 'under', name: 'Alt Kaldırmalı Çekici', icon: '🔩', price: 0, plan: 1800, color: '#8e44ad', accent: '#cfd3da', label: 'UNDERLIFT', mass: 3.4, vmax: 32, acc: 16, steer: 1.05, grip: 1.05, towSlow: 0.92, towAcc: 0.9, dmg: 0.55, mode: 'lift', hookOff: 6.2, lift: 0.38, tilt: 0.17,
    classes: ['car'], mix: { car: 100 }, desc: 'Aracı altından kavrayıp yarı kaldırır. Hızlı, hasarı düşük, sadece otomobil.', stats: [4, 3, 4, 3, 4] }),
  tmk({ id: 'heavy', variant: 'heavy', name: 'Ağır Vasıta Kurtarıcı', icon: '🏗️', price: 0, plan: 2000, color: '#2a9d5a', accent: '#f2c200', label: 'AĞIR VASITA', scale: 1.18, mass: 5, vmax: 24, acc: 11, steer: 0.85, grip: 0.95, towSlow: 0.97, towAcc: 0.95, dmg: 0.6, hookOff: 3.45 * 1.18,
    classes: ['heavy', 'car', 'moto'], mix: { heavy: 60, car: 25, moto: 15 }, desc: 'Otobüs ve kamyon kurtarır. Yük çekerken yavaşlamaz ama kendisi yavaş ve ağırdır.', stats: [2, 2, 2, 5, 4] }),
  tmk({ id: 'machine', variant: 'machine', name: 'İş Makinesi Kurtarıcısı', icon: '🚜', price: 0, plan: 2200, color: '#f2b01e', accent: '#23252b', label: 'İŞ MAKİNESİ', len: 12.4, circ: [2.1, 0, -2.3, -4.6, -6.9, -9.0], mass: 6, vmax: 21, acc: 8.5, steer: 0.85, wb: 5.5, grip: 0.9, towSlow: 0.96, towAcc: 0.9, dmg: 0.4,
    mode: 'flat', hookOff: 9.2, loadT: 2.4, slots: [{ x: -4.4, y: 1.15, z: 0 }], classes: ['machine'], mix: { machine: 100 }, cam: 3, desc: 'Ekskavatör ve forklift gibi iş makinelerini alçak platformunda taşır. Sadece iş makinesi çağrıları gelir.', stats: [2, 1, 2, 5, 4] }),
  tmk({ id: 'multi', variant: 'multi', name: 'Çoklu Çekici', icon: '🚛', price: 0, plan: 3000, color: '#2f7bff', accent: '#cfd8e8', label: 'ÇOKLU TAŞIYICI', len: 16.8, circ: [2.1, 0, -2.4, -4.8, -7.2, -9.6, -12.0], mass: 6, vmax: 25, acc: 10, steer: 0.8, wb: 6, grip: 0.9, towSlow: 0.95, towAcc: 0.9, dmg: 0.45,
    mode: 'flat', cap: 3, hookOff: 13.6, slots: [{ x: -2.1, y: 1.55, z: 0 }, { x: -6.6, y: 1.55, z: 0 }, { x: -11.1, y: 1.55, z: 0 }], classes: ['car', 'moto'], mix: { car: 90, moto: 10 }, cam: 6, desc: 'Tek seferde 3 otomobil taşır. Uzun ve ağır: dönüşlerde dikkat.', stats: [3, 2, 1, 5, 3] }),
  tmk({ id: 'octopus', variant: 'octopus', name: 'Ahtapot Çekici (Kollu Kurtarıcı)', icon: '🐙', price: 0, plan: 3500, color: '#f4f4f6', accent: '#d62a22', label: 'KOLLU KURTARICI', mass: 4, vmax: 29, acc: 13, steer: 0.95, grip: 1, towSlow: 0.92, towAcc: 0.9, dmg: 0.3,
    mode: 'flat', hookOff: 5.0, loadT: 2.2, arc: 3.4, reach: 17, anyDir: true, slots: [{ x: -1.9, y: 1.55, z: 0 }], classes: ['car', 'moto'], mix: { car: 85, moto: 15 },
    desc: 'Platformlu kamyon + hidrolik vinç kolu. Aracı yandan ya da arkadan havadan alıp kasaya yükler; uzaktan da yükler, arkasına geçmen gerekmez.', stats: [3, 3, 3, 4, 5] }),
  tmk({ id: 'semi', variant: 'heavy', name: 'Tır ve Römork Kurtarıcısı', icon: '🚛', price: 0, plan: 4000, color: '#2a5db0', accent: '#ffffff', label: 'TIR KURTARMA', scale: 1.3, mass: 7, vmax: 22, acc: 9, steer: 0.8, wb: 5.8, grip: 0.92, towSlow: 0.96, towAcc: 0.94, dmg: 0.5, hookOff: 3.45 * 1.3,
    classes: ['trailer', 'heavy'], mix: { trailer: 60, heavy: 40 }, desc: 'Tır, çekici ve yarı römork kurtarır. Çok güçlü, çok büyük. Sadece büyük araç çağrıları gelir.', stats: [2, 1, 1, 5, 4] }),
  tmk({ id: 'double', variant: 'double', name: 'Çift Katlı Oto Taşıyıcı', icon: '🏬', price: 0, plan: 4500, color: '#f4f4f6', accent: '#d62a22', label: 'ÇİFT KATLI', len: 12.8, circ: [2.1, 0, -2.4, -4.8, -7.2, -9.2], mass: 6.5, vmax: 22, acc: 8.5, steer: 0.8, wb: 5.6, grip: 0.88, towSlow: 0.95, towAcc: 0.9, dmg: 0.4,
    mode: 'flat', cap: 4, hookOff: 10.4, slots: [{ x: -2.1, y: 1.55, z: 0 }, { x: -6.6, y: 1.55, z: 0 }, { x: -2.1, y: 3.7, z: 0 }, { x: -6.6, y: 3.7, z: 0 }], classes: ['car', 'moto'], mix: { car: 92, moto: 8 }, cam: 5, desc: 'Alt ve üst platformda 4 araç taşır. En yüksek kapasite, en yavaş dönüş.', stats: [2, 1, 1, 5, 3] }),
  tmk({ id: 'rotator', variant: 'rotator', name: 'Rotatör Çekici', icon: '🌀', price: 0, plan: 5500, color: '#c8201c', accent: '#f4f4f6', label: 'ROTATÖR', scale: 1.25, mass: 6, vmax: 22, acc: 9.5, steer: 0.85, wb: 5.2, grip: 0.95, towSlow: 0.97, towAcc: 0.95, dmg: 0.4, hookOff: 3.45 * 1.25,
    classes: ['car', 'heavy', 'machine', 'trailer'], mix: { heavy: 35, trailer: 25, machine: 15, car: 25 }, desc: '360° dönen dev vinçli kurtarıcı. Otobüs, tır, römork ve iş makinesi dahil neredeyse her şeyi alır.', stats: [2, 2, 1, 5, 5] })
];
if (!TRUCKS.some(t => t.id === save.truck)) save.truck = 'std';
save.owned = save.owned.filter(id => TRUCKS.some(t => t.id === id)); TRUCKS.forEach(t => { if (t.price === 0 && !save.owned.includes(t.id)) save.owned.push(t.id); t.show = ({ std: 'car', heavy: 'heavy', rotator: 'trailer', semi: 'trailer' })[t.id] || 'car'; });
const curSpec = () => TRUCKS.find(t => t.id === save.truck) || TRUCKS[0];

/* ---------- Ses ---------- */
let AC = null, muted = save.settings.mute, eng = null, siren = null, heliSnd = null, sirenEnd = 0, sirenNext = 0, master = null;
function masterOut() { if (!master) { master = AC.createGain(); master.connect(AC.destination); applyVolume(); } return master; }
function audioPause(on) { if (!AC) return; try { if (on) AC.suspend(); else AC.resume(); } catch (e) {} }
function applyVolume() { if (master) master.gain.value = Math.max(0, Math.min(1, save.settings.vol / 100)); }
function audioInit() {
  if (AC) { if (AC.resume) AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(masterOut()); o.start(); o2.start(); eng = { o, o2, g, f };
    const so = AC.createOscillator(), sg = AC.createGain(); so.type = 'triangle'; so.frequency.value = 700; sg.gain.value = 0; so.connect(sg); sg.connect(masterOut()); so.start(); siren = { o: so, g: sg };
    const nb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), nd2 = nb.getChannelData(0); for (let i = 0; i < nd2.length; i++) nd2[i] = Math.random() * 2 - 1;
    const ns = AC.createBufferSource(), bp = AC.createBiquadFilter(), hg = AC.createGain(), mg = AC.createGain(), lfo = AC.createOscillator(), ld = AC.createGain();
    ns.buffer = nb; ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 170; bp.Q.value = 0.9; hg.gain.value = 0.5; mg.gain.value = 0; lfo.frequency.value = 13; ld.gain.value = 0.5;
    ns.connect(bp); bp.connect(hg); hg.connect(mg); mg.connect(masterOut()); lfo.connect(ld); ld.connect(hg.gain); ns.start(); lfo.start(); heliSnd = { g: mg };
  } catch (e) {}
}
function tone(freq, dur, type, vol, slide) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + dur);
  g.gain.value = vol || 0.08; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(masterOut()); o.start(); o.stop(AC.currentTime + dur);
}
function noiseBurst(dur, vol) {
  if (!AC || muted) return;
  const n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(masterOut()); s.start();
}
const horn = () => { tone(350, 0.45, 'square', 0.06); tone(440, 0.45, 'square', 0.06); };

/* ---------- Sahne ---------- */
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
$('gl').appendChild(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(60, 1.6, 0.3, 1900);
scene.fog = new T.Fog(0xcf9482, 100, 1000);
scene.add(new T.HemisphereLight(0x93a4dc, 0x40363f, 0.95));
const sun = new T.DirectionalLight(0xffc58a, 0.75); sun.position.set(-100, 60, 50); scene.add(sun);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
function applyQuality() { const q = save.settings.quality; renderer.setPixelRatio(q === 'low' ? 0.65 : q === 'mid' ? 1 : Math.min(devicePixelRatio || 1, 2)); resize(); }
applyQuality();

const GB = new T.BoxGeometry(1, 1, 1), GC = new T.CylinderGeometry(1, 1, 1, 14);
const matCache = {}, mat = c => matCache[c] || (matCache[c] = new T.MeshLambertMaterial({ color: c }));
const basic = c => new T.MeshBasicMaterial({ color: c });
function bx(parent, w, h, d, color, x, y, z, cast) {
  const m = new T.Mesh(GB, typeof color === 'string' ? mat(color) : color); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m;
}
const _o = new T.Object3D();
function instanced(geom, material, list) {
  const m = new T.InstancedMesh(geom, material, list.length);
  list.forEach((q, i) => { _o.position.set(q.x, q.y, q.z); _o.scale.set(q.sx || 1, q.sy || 1, q.sz || 1); _o.rotation.set(0, q.ry || 0, 0); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
  m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; scene.add(m); return m;
}
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
})();

/* Gökyüzü kubbesi (kamerayı izler) */
const sky = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#1b2b66'); gr.addColorStop(0.28, '#4a4a90'); gr.addColorStop(0.43, '#d9806a'); gr.addColorStop(0.5, '#ffc58a'); gr.addColorStop(0.52, '#c88a78'); gr.addColorStop(1, '#8a6a70');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const m = new T.Mesh(new T.SphereGeometry(1600, 24, 16), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10; scene.add(m);
  const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffb060, fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending }));
  s.scale.set(560, 560, 1); s.position.set(-1100, 150, 680); m.add(s); return m;
})();

/* ---------- Dünya ---------- */
const boxes = [], trees = [], zones = [];
/* Trafik ışıkları: tüm kavşaklar senkron, 24 sn döngü. 'x' ekseni önce yeşil. */
const SIG = 24;
function sigState(axis) {
  const ph = time % SIG;
  if (axis === 'x') return ph < 9 ? 'g' : ph < 11 ? 'y' : 'r';
  return ph < 12 ? 'r' : ph < 21 ? 'g' : ph < 23 ? 'y' : 'r';
}
let sigMats = null;
const isLit = (ix, iz) => ix % 2 === 1 && iz % 2 === 1;      // sadece 9 ana kavşakta ışık var
function redViolation(axis) { const ph = time % SIG; return axis === 'x' ? ph >= 12.2 : (ph >= 0.2 && ph < 12); }  // kırmızıya döndükten 1.2 sn sonra
function addCollider(x, z, w, d, h) { boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h }); }
// kenar duvarları (görünmez)
boxes.push({ x0: -WORLD - 500, x1: -WORLD, z0: -WORLD - 500, z1: WORLD + 500, h: 0 }, { x0: WORLD, x1: WORLD + 500, z0: -WORLD - 500, z1: WORLD + 500, h: 0 },
  { x0: -WORLD - 500, x1: WORLD + 500, z0: -WORLD - 500, z1: -WORLD, h: 0 }, { x0: -WORLD - 500, x1: WORLD + 500, z0: WORLD, z1: WORLD + 500, h: 0 });

const STYLES = [
  { wall: '#9b5a4a', frame: '#d8cdbd', glass: '#26364a', brick: 1 }, { wall: '#cdbf9d', frame: '#f0e8d8', glass: '#2a4058' },
  { wall: '#7d8996', frame: '#c4ccd6', glass: '#1e2f42' }, { wall: '#d8d6d0', frame: '#ffffff', glass: '#34506e' },
  { wall: '#4f6f8f', frame: '#9ab8d4', glass: '#142438' }, { wall: '#6f5646', frame: '#cdb79e', glass: '#222f3d' }
];
const facCan = {}, facTex = {};
function facadeCanvases(si, vi) {
  const key = si + '_' + vi; if (facCan[key]) return facCan[key];
  const S = STYLES[si], c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = c.height = e.width = e.height = 128;
  const g = c.getContext('2d'), eg = e.getContext('2d'); g.fillStyle = S.wall; g.fillRect(0, 0, 128, 128); eg.fillStyle = '#000'; eg.fillRect(0, 0, 128, 128);
  if (S.brick) { g.fillStyle = 'rgba(0,0,0,.13)'; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 1); }
  for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) {
    const x = cx * 64 + 12, y = cy * 64 + 10, w = 40, h = 40, lit = Math.random() < 0.5;
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#6f93b3'); gr.addColorStop(0.5, S.glass); gr.addColorStop(1, '#101b28');
    g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = S.frame; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.fillStyle = S.frame; g.fillRect(x - 3, y + h, w + 6, 4); g.fillRect(x + w / 2 - 1, y, 2, h);
    if (lit) { eg.fillStyle = pick(['#ffd89a', '#ffe7b8', '#ffc880', '#cfe6ff']); eg.fillRect(x + 2, y + 2, w - 4, h - 4); eg.fillStyle = '#000'; eg.fillRect(x + w / 2 - 1, y, 2, h); }
  }
  return (facCan[key] = { c, e });
}
function ftex(si, vi, kind, rx, ry) {
  const key = [si, vi, kind, rx, ry].join('_'); if (facTex[key]) return facTex[key];
  const t = new T.CanvasTexture(facadeCanvases(si, vi)[kind]); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return (facTex[key] = t);
}
function facade(x, z, w, d, h, collide, style) {
  const si = style !== undefined ? style : Math.random() * STYLES.length | 0, vi = Math.random() * 2 | 0;
  const ny = Math.max(2, Math.round(h / 8)), mk = (rx) => new T.MeshLambertMaterial({ map: ftex(si, vi, 'c', rx, ny), emissiveMap: ftex(si, vi, 'e', rx, ny), emissive: 0xffffff });
  const mx = mk(Math.max(1, Math.round(d / 8))), mz = mk(Math.max(1, Math.round(w / 8))), top = mat('#34373e');
  const m = new T.Mesh(GB, [mx, mx, top, top, mz, mz]); m.scale.set(w, h, d); m.position.set(x, h / 2, z); scene.add(m);
  bx(scene, w + 0.8, 0.8, d + 0.8, '#2c2f36', x, h + 0.4, z);
  if (h > 40) bx(scene, 0.5, 8, 0.5, '#555', x + w * 0.2, h + 4.8, z);
  if (collide) addCollider(x, z, w, d, h);
}
function roadCanvas(horizontal) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#2e3035'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.09)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const r = (a, b, w, h, col) => { g.fillStyle = col; if (horizontal) g.fillRect(b, a, h, w); else g.fillRect(a, b, w, h); };
  r(121, 0, 4, 256, '#e0b000'); r(131, 0, 4, 256, '#e0b000'); r(10, 0, 5, 256, '#d8d8d8'); r(241, 0, 5, 256, '#d8d8d8');
  for (let y = 0; y < 256; y += 64) { r(64, y, 3, 28, '#cfcfcf'); r(189, y, 3, 28, '#cfcfcf'); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
}
function lotTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#5e5b56'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
  g.lineWidth = 6;
  if (kind === 'parking') {
    g.strokeStyle = '#e8e8e8';
    for (let r = 0; r < 2; r++) for (let i = 0; i <= 8; i++) { const x = 40 + i * 54, y = r ? 330 : 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 140); g.stroke(); }
  } else {
    g.strokeStyle = '#e0b000'; g.setLineDash([26, 18]); g.strokeRect(14, 14, 484, 484); g.setLineDash([]);
  }
  return new T.CanvasTexture(c);
}
function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,12,20,.75)'; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 496, 112, 24) : g.rect(8, 8, 496, 112); g.fill();
  g.lineWidth = 6; g.strokeStyle = color; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 64px "Segoe UI","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false })); return s;
}
const ZONE_BLOCKS = { service: [[1, 6], [6, 1], [2, 5]], parking: [[6, 6], [1, 1], [5, 2]] }, PARKS = [[3, 3], [4, 4], [0, 7], [7, 0], [5, 5]], HOSP_BLOCKS = [[2, 2]], FIRE_BLOCKS = [[5, 3], [3, 6]], CARGO_BLOCKS = [[6, 3], [1, 4]];

/* ---------- Dükkânlar: ekmek fırını ve market ---------- */
const chimneys = [], shops = [];
function signTex(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.lineWidth = 10; g.strokeStyle = fg; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = fg; g.font = 'bold 74px "Segoe UI","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); return new T.CanvasTexture(c);
}
function stripeTex(c1, c2) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 16, 0, 16, 32); } const t = new T.CanvasTexture(c); return t;
}
const banks = [];
function makeBank(x, z, w, d, sx, sz) {
  facade(x, z, w, d, 14, true, 2);
  const alongZ = Math.random() < 0.5, fw = alongZ ? w : d, fx = alongZ ? x : x + sx * (w / 2 + 0.03), fz = alongZ ? z + sz * (d / 2 + 0.03) : z;
  const ry = alongZ ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2), fg = new T.Group(); fg.position.set(fx, 0.25, fz); fg.rotation.y = ry; scene.add(fg);
  bx(fg, fw * 0.74, 0.35, 2.0, '#cfcac0', 0, 0.18, 1.0);
  bx(fg, 6.4, 3.8, 0.14, '#2a2f3a', 0, 2.3, 0); const gl = new T.Mesh(new T.PlaneGeometry(5.8, 3.4), new T.MeshBasicMaterial({ color: 0xfff0c8 })); gl.position.set(0, 2.3, 0.09); fg.add(gl);
  [-0.34, -0.12, 0.12, 0.34].forEach(k => bx(fg, 0.7, 5.2, 0.7, '#ece8de', k * fw, 2.95, 1.5));
  bx(fg, fw * 0.8, 0.9, 2.4, '#ece8de', 0, 5.9, 1.2); bx(fg, fw * 0.7, 0.7, 2.0, '#d8d3c8', 0, 6.7, 1.2);
  const sg = new T.Mesh(new T.PlaneGeometry(9, 1.8), new T.MeshBasicMaterial({ map: signTex('🏦 BANKA', '#0f2a4a', '#ffd98a') })); sg.position.set(0, 8.6, 0.14); fg.add(sg);
  bx(fg, 1.1, 2.2, 0.8, '#3a4250', fw * 0.42, 1.35, 0.6); bx(fg, 0.8, 0.5, 0.05, new T.MeshBasicMaterial({ color: 0x7fe0ff }), fw * 0.42, 1.85, 1.02); bx(fg, 0.8, 0.12, 0.3, '#222', fw * 0.42, 1.35, 1.1);
  const wv = (lx, lz) => ({ x: fx + lx * Math.cos(ry) + lz * Math.sin(ry), z: fz - lx * Math.sin(ry) + lz * Math.cos(ry) });
  [[fw * 0.42, 1.8], [fw * 0.42 + 0.9, 1.9], [-1.8, 2.4]].forEach(q => { const p = wv(q[0], q[1]), pd = makePed3(); pd.position.set(p.x, 0.25, p.z); pd.rotation.y = -Math.atan2(-Math.cos(ry), -Math.sin(ry)) + rnd(-0.3, 0.3); });
  const c = wv(0, 3); banks.push({ x: c.x, z: c.z });
}
const posts = [];
function makePost(x, z, w, d, sx, sz) {
  facade(x, z, w, d, 10, true, 1);
  const alongZ = Math.random() < 0.5, fw = alongZ ? w : d, fx = alongZ ? x : x + sx * (w / 2 + 0.03), fz = alongZ ? z + sz * (d / 2 + 0.03) : z;
  const ry = alongZ ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2), fg = new T.Group(); fg.position.set(fx, 0.25, fz); fg.rotation.y = ry; scene.add(fg);
  bx(fg, fw * 0.86, 3.5, 0.12, '#2a2f3a', 0, 2.0, 0); const gl = new T.Mesh(new T.PlaneGeometry(fw * 0.8, 3.1), new T.MeshBasicMaterial({ color: 0xfff3c8 })); gl.position.set(0, 2.0, 0.08); fg.add(gl);
  bx(fg, 1.7, 2.7, 0.14, '#1d3f7a', fw * 0.32, 1.55, 0.1);
  bx(fg, fw * 0.9, 0.9, 1.5, '#ffcc00', 0, 4.2, 0.75); bx(fg, fw * 0.9, 0.2, 1.55, '#0b3d91', 0, 3.65, 0.78);
  const sg = new T.Mesh(new T.PlaneGeometry(9, 1.8), new T.MeshBasicMaterial({ map: signTex('✉️ POSTANE', '#ffcc00', '#0b3d91') })); sg.position.set(0, 5.6, 0.12); fg.add(sg);
  for (let i = 0; i < 3; i++) { const px = -fw * 0.3 + i * 1.5; bx(fg, 0.75, 1.2, 0.75, i === 1 ? '#0b3d91' : '#ffcc00', px, 0.85, 1.4); bx(fg, 0.8, 0.12, 0.8, '#222', px, 1.5, 1.4); bx(fg, 0.5, 0.08, 0.04, '#222', px, 1.25, 1.79); }
  bx(fg, 1.1, 0.55, 0.8, '#8b7d62', fw * 0.12, 0.55, 1.5); bx(fg, 0.9, 0.45, 0.7, '#a89878', fw * 0.12 + 0.1, 1.05, 1.5);
  const wv = (lx, lz) => ({ x: fx + lx * Math.cos(ry) + lz * Math.sin(ry), z: fz - lx * Math.sin(ry) + lz * Math.cos(ry) });
  [[-fw * 0.3 + 2.2, 1.9], [fw * 0.2, 1.9], [fw * 0.2 + 1, 1.3]].forEach(q => { const p = wv(q[0], q[1]), pd = makePed3(); pd.position.set(p.x, 0.25, p.z); pd.rotation.y = -Math.atan2(-Math.cos(ry), -Math.sin(ry)) + rnd(-0.3, 0.3); });
  const c = wv(0, 3); posts.push({ x: c.x, z: c.z });
}
function bakeryTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#5e2c14'; g.fillRect(0, 0, 1024, 256); g.lineWidth = 8; g.strokeStyle = '#e8b85a'; g.strokeRect(10, 10, 1004, 236); g.lineWidth = 2; g.strokeRect(24, 24, 976, 208);
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = '110px "Segoe UI Emoji","Segoe UI",sans-serif'; g.fillStyle = '#fff'; g.fillText('🥖', 112, 122);
  let fs0 = 104; g.fillStyle = '#ffd98a'; do { g.font = 'bold ' + fs0 + 'px Georgia,"Times New Roman",serif'; fs0 -= 4; } while (g.measureText('Fırın Anatolia').width > 760 && fs0 > 40);
  g.fillText('Fırın Anatolia', 580, 104);
  g.fillStyle = '#f5e6c8'; g.font = '600 50px "Segoe UI",sans-serif'; if ('letterSpacing' in g) g.letterSpacing = '9px'; g.fillText('ARTISAN BAKERY', 590, 190); if ('letterSpacing' in g) g.letterSpacing = '0px';
  return new T.CanvasTexture(c);
}
function makeShop(type, x, z, w, d, sx, sz) {
  if (type === 'banka') return makeBank(x, z, w, d, sx, sz);
  if (type === 'postane') return makePost(x, z, w, d, sx, sz);
  const bak = type === 'firin', h = bak ? 10 : 8;
  facade(x, z, w, d, h, true, bak ? 1 : 3);
  const alongZ = Math.random() < 0.5, fw = alongZ ? w : d, fx = alongZ ? x : x + sx * (w / 2 + 0.03), fz = alongZ ? z + sz * (d / 2 + 0.03) : z;
  const ry = alongZ ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2), fg = new T.Group(); fg.position.set(fx, 0.25, fz); fg.rotation.y = ry; scene.add(fg);
  bx(fg, fw * 0.86, 3.5, 0.12, '#2a2f3a', 0, 2.0, 0);
  const glass = new T.Mesh(new T.PlaneGeometry(fw * 0.8, 3.1), new T.MeshBasicMaterial({ color: bak ? 0xffc27a : 0xdff2ff })); glass.position.set(0, 2.0, 0.08); fg.add(glass);
  bx(fg, 1.7, 2.7, 0.14, '#3b2a1c', fw * 0.32, 1.55, 0.1);
  const sign = new T.Mesh(new T.PlaneGeometry(bak ? 9.6 : 8, bak ? 2.4 : 2), new T.MeshBasicMaterial({ map: bak ? bakeryTex() : signTex('🛒 MARKET', '#1d6b3a', '#ffffff') })); sign.position.set(0, bak ? 5.3 : 5.1, 0.12); fg.add(sign);
  const aw = bx(fg, fw * 0.86, 0.15, 1.7, new T.MeshLambertMaterial({ map: stripeTex(bak ? '#c0392b' : '#27ae60', '#f4f4f4') }), 0, 3.95, 0.9); aw.rotation.x = 0.16;
  if (bak) { for (let i = 0; i < 3; i++) { const px = -fw * 0.28 + i * 1.5; bx(fg, 1.0, 0.7, 0.8, '#b98a52', px, 0.35, 1.4); for (let k = 0; k < 3; k++) bx(fg, 0.7, 0.18, 0.18, '#c98a3a', px, 0.8 + 0.0, 1.25 + k * 0.22); } }
  else { const cols = ['#d63b3b', '#4fb36c', '#f08a24', '#e8c130']; for (let i = 0; i < 3; i++) { const px = -fw * 0.3 + i * 1.9; bx(fg, 1.6, 0.6, 0.9, '#6a4a2a', px, 0.3, 1.4); for (let k = 0; k < 4; k++) bx(fg, 0.36, 0.3, 0.7, cols[(i + k) % 4], px - 0.55 + k * 0.37, 0.75, 1.4); } }
  if (bak) { const cxm = x - sx * 3.5, czm = z - sz * 3.5; bx(scene, 1.5, 3.2, 1.5, '#6a4b3a', cxm, h + 1.6, czm); chimneys.push({ x: cxm, y: h + 3.4, z: czm, t: rnd(0, 1) }); }
  const wv = (lx, lz) => ({ x: fx + lx * Math.cos(ry) + lz * Math.sin(ry), z: fz - lx * Math.sin(ry) + lz * Math.cos(ry) });
  for (let i = 0; i < 3; i++) { const p = wv(-fw * 0.2 + i * 1.3 + rnd(-0.3, 0.3), 1.3 + rnd(0, 0.4)), pd = makePed3(); pd.position.set(p.x, 0.25, p.z); pd.rotation.y = -Math.atan2(-Math.cos(ry), -Math.sin(ry)) + rnd(-0.3, 0.3); }
  const c = wv(0, 3); shops.push({ type, x: c.x, z: c.z });
}

/* ---------- Petrol istasyonu ---------- */
const stations = [];
let stationCd = 0, inStation = false;
function priceTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#16181f'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#d62a22'; g.fillRect(0, 0, 256, 90);
  g.fillStyle = '#fff'; g.font = 'bold 54px "Segoe UI","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⛽ PETROL', 128, 48);
  g.font = 'bold 26px "Segoe UI",sans-serif'; g.fillStyle = '#9fe6a8'; g.fillText('BENZİN  42,90', 128, 125); g.fillStyle = '#ffd98a'; g.fillText('MOTORİN 40,50', 128, 168); g.fillStyle = '#9ec9ff'; g.fillText('LPG  19,80', 128, 211);
  return new T.CanvasTexture(c);
}
function makeStation(cx, cz) {
  const pad = new T.Mesh(new T.PlaneGeometry(40, 40), mat('#43464d')); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.27, cz); scene.add(pad);
  bx(scene, 40, 0.02, 0.25, '#e0b000', cx, 0.29, cz - 5.5); bx(scene, 40, 0.02, 0.25, '#e0b000', cx, 0.29, cz + 9.5);
  // saçak
  bx(scene, 17, 0.6, 11, '#f4f4f6', cx, 5.7, cz + 2); bx(scene, 17.2, 0.45, 11.2, '#d62a22', cx, 5.2, cz + 2);
  const lamp = new T.Mesh(new T.PlaneGeometry(16.4, 10.4), new T.MeshBasicMaterial({ color: 0xfff1cf })); lamp.rotation.x = Math.PI / 2; lamp.position.set(cx, 4.95, cz + 2); scene.add(lamp);
  [[-7.6, -3], [7.6, -3], [-7.6, 7], [7.6, 7]].forEach(q => { bx(scene, 0.7, 5, 0.7, '#cfd3da', cx + q[0], 2.75, cz + q[1]); addCollider(cx + q[0], cz + q[1], 0.9, 0.9, 5); });
  [-0.6, 4.6].forEach(pz => [-3.2, 3.2].forEach(px => {
    bx(scene, 1.5, 0.18, 2.8, '#9a978f', cx + px, 0.36, cz + pz); bx(scene, 0.9, 1.7, 0.7, '#d62a22', cx + px, 1.2, cz + pz); bx(scene, 0.55, 0.38, 0.06, '#0e2438', cx + px, 1.75, cz + pz + 0.38); bx(scene, 0.12, 0.7, 0.12, '#222', cx + px + 0.5, 0.95, cz + pz + 0.3);
    addCollider(cx + px, cz + pz, 1.4, 1.2, 1.9);
  }));
  // kulübe
  facade(cx, cz - 15, 18, 7, 5.5, true, 3);
  const fg = new T.Group(); fg.position.set(cx, 0.25, cz - 15 + 3.5 + 0.03); scene.add(fg);
  bx(fg, 15.4, 3.1, 0.12, '#2a2f3a', 0, 1.8, 0); const gl = new T.Mesh(new T.PlaneGeometry(14.8, 2.7), new T.MeshBasicMaterial({ color: 0xe3f4ff })); gl.position.set(0, 1.8, 0.08); fg.add(gl); bx(fg, 1.7, 2.6, 0.14, '#3b2a1c', 5.4, 1.5, 0.1);
  const sg = new T.Mesh(new T.PlaneGeometry(8, 2), new T.MeshBasicMaterial({ map: signTex('⛽ PETROL', '#b3201a', '#ffffff') })); sg.position.set(0, 4.75, 0.12); fg.add(sg);
  // fiyat panosu
  const px = cx - 17, pz = cz + 17; bx(scene, 0.8, 13, 0.8, '#cfd3da', px, 6.75, pz); addCollider(px, pz, 1, 1, 13);
  const pt = priceTex(); [0, Math.PI].forEach(ry => { const p = new T.Mesh(new T.PlaneGeometry(5.6, 5.6), new T.MeshBasicMaterial({ map: pt })); p.position.set(px + (ry ? -0.45 : 0.45) * 0, 11.8, pz + (ry ? -0.45 : 0.45)); p.rotation.y = ry; scene.add(p); });
  // varil ve lastik
  for (let i = 0; i < 3; i++) { const b = new T.Mesh(GC, mat(i % 2 ? '#2d5db0' : '#c0392b')); b.scale.set(0.45, 1.0, 0.45); b.position.set(cx + 17 + (i % 2) * 0.1, 0.8, cz - 8 + i * 1.1); scene.add(b); addCollider(cx + 17, cz - 8 + i * 1.1, 0.9, 0.9, 1); }
  for (let i = 0; i < 4; i++) { const t = new T.Mesh(GC, mat('#16171c')); t.scale.set(0.55, 0.28, 0.55); t.position.set(cx + 18.2, 0.4 + i * 0.28, cz - 12.5); scene.add(t); }
  // pompadaki araçlar ve çalışanlar
  [[-3.2, -2.6, 0], [3.2, 6.6, Math.PI]].forEach(q => { const cm = carMesh(pick(CAR_COLORS)); cm.g.position.set(cx + q[0], 0.25, cz + q[1]); cm.g.rotation.y = q[2]; cm.haz.forEach(m => m.color.setHex(0x3a2200)); scene.add(cm.g); addCollider(cx + q[0], cz + q[1], 4.6, 2.1, 2); });
  [[-1.6, -2.2], [4.9, -10.4], [1.8, 6.3]].forEach(q => { const pd = makePed3(); pd.position.set(cx + q[0], 0.25, cz + q[1]); pd.rotation.y = rnd(0, 6.28); });
  stations.push({ x: cx, z: cz + 2, r: 10 });
}
function stationStep(dt) {
  stationCd -= dt; inStation = stations.some(st => Math.hypot(truck.x - st.x, truck.z - st.z) < st.r);
  if (inStation && Math.hypot(truck.vx, truck.vz) < 10 && truck.turbo < 99.5) {
    truck.turbo = Math.min(100, truck.turbo + 50 * dt); if (stationCd <= 0) { toast('⛽ Turbo dolduruluyor…', 'good'); stationCd = 15; }
  }
}

/* ---------- Hastane ---------- */
const hospitals = [], hospVehs = [];
function crossTex(w, h, label) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#d62a22'; const u = h * 0.7, cx = h * 0.5, cy = h * 0.5;
  g.fillRect(cx - u * 0.17, cy - u * 0.5, u * 0.34, u); g.fillRect(cx - u * 0.5, cy - u * 0.17, u, u * 0.34);
  if (label) { g.font = 'bold ' + (h * 0.46) + 'px "Segoe UI",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, h * 1.05, h * 0.52); }
  g.strokeStyle = '#d62a22'; g.lineWidth = h * 0.05; g.strokeRect(0, 0, w, h); return new T.CanvasTexture(c);
}
function helipadTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#3a3d46'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#f4f4f6'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.fillStyle = '#f4f4f6'; g.font = 'bold 150px "Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 138); return new T.CanvasTexture(c);
}
function makeHospital(cx, cz) {
  const pad = new T.Mesh(new T.PlaneGeometry(40, 40), mat('#b9bdc4')); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.27, cz); scene.add(pad);
  facade(cx - 3, cz - 12, 30, 14, 30, true, 3); facade(cx + 15.5, cz + 2, 9, 14, 14, true, 3);
  // giriş
  const fz = cz - 5 + 0.05, fg = new T.Group(); fg.position.set(cx - 3, 0.25, fz); scene.add(fg);
  bx(fg, 8.4, 3.6, 0.14, '#2a2f3a', 0, 1.9, 0); const gl = new T.Mesh(new T.PlaneGeometry(7.8, 3.2), new T.MeshBasicMaterial({ color: 0xe8f6ff })); gl.position.set(0, 1.9, 0.1); fg.add(gl);
  const sg = new T.Mesh(new T.PlaneGeometry(12, 3), new T.MeshBasicMaterial({ map: crossTex(512, 128, 'HASTANE') })); sg.position.set(0, 6.4, 0.12); fg.add(sg);
  bx(scene, 12, 0.4, 5.2, '#f4f4f6', cx - 3, 4.5, fz + 2.6); bx(scene, 12.2, 0.25, 5.4, '#d62a22', cx - 3, 4.2, fz + 2.6);
  [-5.4, 5.4].forEach(px => { bx(scene, 0.5, 4.3, 0.5, '#cfd3da', cx - 3 + px, 2.4, fz + 4.8); addCollider(cx - 3 + px, fz + 4.8, 0.7, 0.7, 4.3); });
  // çatı haçı
  bx(scene, 12, 12, 0.8, '#ffffff', cx - 3, 37, cz - 12); bx(scene, 2.6, 9, 1.0, '#d62a22', cx - 3, 37, cz - 12); bx(scene, 9, 2.6, 1.0, '#d62a22', cx - 3, 37, cz - 12);
  // helikopter pisti
  const hp = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshBasicMaterial({ map: helipadTex() })); hp.rotation.x = -Math.PI / 2; hp.position.set(cx + 15.5, 14.95, cz + 2); scene.add(hp);
  // ambulans bölümü
  [[-14, 8, 0.15], [-14, 13, -0.1]].forEach(q => { const v = makeAmbulance('wreck'); v.x = cx + q[0]; v.z = cz + q[1]; v.h = q[2]; v.sync(); scene.remove(v.mesh); scene.add(v.mesh); hospVehs.push(v); addCollider(cx + q[0], cz + q[1], 4.8, 2.3, 2.5); });
  bx(scene, 12, 0.3, 11, '#9aa3ad', cx - 14, 3.6, cz + 10.5); [[-19.5, 5.4], [-8.5, 5.4], [-19.5, 15.6], [-8.5, 15.6]].forEach(q => { bx(scene, 0.4, 3.4, 0.4, '#cfd3da', cx + q[0], 1.9, cz + q[1]); });
  [[-8, 3.5], [0.5, 6.2], [4, 3.2], [-12, 5.5]].forEach(q => { const pd = makePed3(); pd.position.set(cx + q[0], 0.25, cz + q[1]); pd.rotation.y = rnd(0, 6.28); });
  hospitals.push({ x: cx, z: cz });
}

/* ---------- İtfaiye istasyonu ---------- */
const firestations = [];
function makeFireStation(cx, cz) {
  const pad = new T.Mesh(new T.PlaneGeometry(40, 40), mat('#b8b5b2')); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.27, cz); scene.add(pad);
  bx(scene, 40, 0.02, 0.3, '#d8262b', cx, 0.29, cz + 1.5);
  facade(cx, cz - 10, 34, 16, 12, true, 0); facade(cx + 13.5, cz - 13, 5, 5, 23, true, 0);
  // garaj kapıları
  const fz = cz - 2 + 0.05, fg = new T.Group(); fg.position.set(cx, 0.25, fz); scene.add(fg);
  [-10.5, 0, 10.5].forEach(px => { bx(fg, 8.4, 5.8, 0.2, '#c8ccd2', px, 3.0, 0); bx(fg, 7.6, 5.0, 0.22, '#15171d', px, 2.7, 0.04); bx(fg, 7.6, 2.0, 0.28, '#d8dce2', px, 4.7, 0.08); for (let k = 0; k < 4; k++) bx(fg, 7.6, 0.07, 0.3, '#9aa0ad', px, 3.8 + k * 0.5, 0.1); });
  const sg = new T.Mesh(new T.PlaneGeometry(14, 2.6), new T.MeshBasicMaterial({ map: signTex('🚒 İTFAİYE', '#b3201a', '#ffffff') })); sg.position.set(0, 8.4, 0.12); fg.add(sg);
  // bayrak
  bx(scene, 0.2, 10, 0.2, '#cfd3da', cx - 16, 5.3, cz + 3); bx(scene, 2.2, 1.3, 0.05, '#d8262b', cx - 14.9, 9.9, cz + 3);
  // itfaiye araçları (park halinde)
  [-10.5, 0].forEach((px, i) => { const v = makeFireTruck('wreck'); v.x = cx + px; v.z = cz + 4.5; v.h = Math.PI / 2; v.sync(); hospVehs.push(v); addCollider(cx + px, cz + 4.5, 3.1, 6.2, 3.5); });
  // yangın musluğu ve itfaiyeciler
  [[-17, 8], [17, 8], [-17, -5]].forEach(q => { const h = new T.Mesh(GC, mat('#d8262b')); h.scale.set(0.28, 0.9, 0.28); h.position.set(cx + q[0], 0.7, cz + q[1]); scene.add(h); });
  [[5, 3], [6.4, 4], [-5, 2.5], [-4, 7], [10, 5]].forEach(q => { const pd = makePed3(); pd.position.set(cx + q[0], 0.25, cz + q[1]); pd.rotation.y = rnd(0, 6.28); });
  firestations.push({ x: cx, z: cz });
}

/* ---------- Fleet Mole Servis tabelaları (logo: assets/logo.js içinde gömülü) ---------- */
const logoImg = new Image(), logoCbs = []; let logoReady = false;
logoImg.onload = () => { logoReady = true; logoCbs.forEach(f => f()); };
if (window.FLEETMOLE_LOGO) logoImg.src = window.FLEETMOLE_LOGO;
function fleetSignTex(kind, label, accent, sub) {
  const strip = kind === 'strip', W = strip ? 1800 : 1024, H = strip ? 260 : 640, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), tex = new T.CanvasTexture(c); tex.anisotropy = 8; const long = label.length > 6;
  const draw = () => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = '#243a6b'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14); g.fillStyle = accent; g.fillRect(0, 14, W, 8);
    const lw = strip ? 1060 : 880, ar = logoReady ? logoImg.width / logoImg.height : 7.7, lh = lw / ar, lx = strip ? 50 : (W - lw) / 2, ly = strip ? (H - lh) / 2 : 110;
    if (logoReady) g.drawImage(logoImg, lx, ly, lw, lh); else { g.fillStyle = '#243a6b'; g.font = 'bold 100px "Segoe UI",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('FleetMole', lx, ly + lh / 2); }
    g.textBaseline = 'middle';
    if (strip) { g.fillStyle = accent; g.fillRect(1190, 50, 8, H - 100); g.fillStyle = '#243a6b'; g.font = 'bold ' + (long ? 104 : 120) + 'px "Segoe UI",sans-serif'; g.textAlign = 'center'; g.fillText(label, 1500, H / 2 + 6); }
    else { g.fillStyle = accent; g.fillRect(100, 300, W - 200, 10); g.fillStyle = '#243a6b'; g.font = 'bold ' + (long ? 165 : 190) + 'px "Segoe UI",sans-serif'; g.textAlign = 'center'; g.fillText(label, W / 2, 440); g.fillStyle = '#6a7390'; g.font = '48px "Segoe UI",sans-serif'; g.fillText(sub, W / 2, 565); }
    tex.needsUpdate = true;
  };
  draw(); logoCbs.push(draw); return tex;
}
function makeFleetSigns(cx, cz, zkind) {
  const svc = zkind === 'service', label = svc ? 'SERVİS' : 'OTOPARK', accent = svc ? '#f58220' : '#1e88e5', sub = svc ? 'Araç Kurtarma · Bakım · Onarım' : 'Güvenli · Gözetimli · 7/24 Araç Park Alanı';
  const st = new T.Mesh(new T.PlaneGeometry(18, 2.6), new T.MeshBasicMaterial({ map: fleetSignTex('strip', label, accent, sub) })); st.position.set(cx, 5.9, cz - 12.78); scene.add(st);
  bx(scene, 18.4, 3.0, 0.2, '#243a6b', cx, 5.9, cz - 12.9);
  const px = cx + 17, pz = cz + 17; bx(scene, 0.9, 9, 0.9, '#cfd3da', px, 4.75, pz); addCollider(px, pz, 1.2, 1.2, 14);
  bx(scene, 11.6, 7.2, 0.5, '#243a6b', px, 11.9, pz);
  const bt = fleetSignTex('board', label, accent, sub); [[0, 0.3], [Math.PI, -0.3]].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(11, 6.9), new T.MeshBasicMaterial({ map: bt })); p.position.set(px, 11.9, pz + q[1]); p.rotation.y = q[0]; scene.add(p); });
}

/* ---------- Yıldız Kargo ---------- */
const cargohubs = [];
function cargoTex(kind) {
  const bn = kind === 'banner', sd = kind === 'side', c = document.createElement('canvas'); c.width = bn ? 1760 : sd ? 512 : 256; c.height = bn ? 208 : sd ? 128 : 256; const g = c.getContext('2d'); g.textBaseline = 'middle';
  if (bn) {
    g.fillStyle = '#16296b'; g.fillRect(0, 0, 1760, 208); g.fillStyle = '#ffc20e'; g.fillRect(0, 0, 1760, 12); g.fillRect(0, 196, 1760, 12);
    g.font = '150px "Segoe UI Symbol","Segoe UI",sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffc20e'; g.fillText('★', 120, 108);
    g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = 'bold 128px "Segoe UI",sans-serif'; g.fillText('YILDIZ KARGO', 230, 108);
    g.fillStyle = '#ffc20e'; g.font = '600 40px "Segoe UI",sans-serif'; g.fillText('Hızlı · Güvenli', 1330, 78); g.fillText('Kapıda Teslim', 1330, 136);
  } else if (sd) {
    g.fillStyle = '#f7f7fa'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#16296b'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 118, 512, 10);
    g.font = '80px "Segoe UI Symbol","Segoe UI",sans-serif'; g.textAlign = 'center'; g.fillStyle = '#f2a500'; g.fillText('★', 62, 66); g.textAlign = 'left'; g.fillStyle = '#16296b'; g.font = 'bold 62px "Segoe UI",sans-serif'; g.fillText('YILDIZ KARGO', 112, 68);
  } else {
    g.fillStyle = '#16296b'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffc20e'; g.fillRect(0, 0, 256, 12); g.font = '110px "Segoe UI Symbol","Segoe UI",sans-serif'; g.textAlign = 'center'; g.fillText('★', 128, 62);
    g.fillStyle = '#fff'; g.font = 'bold 62px "Segoe UI",sans-serif'; g.fillText('YILDIZ', 128, 138); g.fillText('KARGO', 128, 196); g.fillStyle = '#ffc20e'; g.fillRect(40, 232, 176, 6);
  }
  return new T.CanvasTexture(c);
}
function makeCargo(kind, big) {
  const v = new Veh(kind, '#f4f4f6'), g = v.mesh, L = big ? 4.2 : 2.8, x0 = big ? -1.2 : -0.85, H = big ? 2.0 : 1.5, y0 = big ? 1.95 : 1.6, W = big ? 2.0 : 1.9;
  bx(g, L, H, W, '#f4f4f6', x0, y0, 0); bx(g, L + 0.02, 0.3, W + 0.04, '#ff7a1a', x0, y0 - H * 0.28, 0); bx(g, L + 0.04, 0.12, W + 0.06, '#16296b', x0, y0 + H / 2 + 0.06, 0);
  makeCargo.side = makeCargo.side || new T.MeshBasicMaterial({ map: cargoTex('side') });
  [[W / 2 + 0.03, 0], [-(W / 2 + 0.03), Math.PI]].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(L * 0.8, L * 0.2), makeCargo.side); p.position.set(x0, y0 + H * 0.12, q[0]); p.rotation.y = q[1]; g.add(p); });
  if (big) g.scale.setScalar(1.12);
  if (kind === 'ai') { v.cm.tail.color.setHex(0xaa1818); v.cm.head.color.setHex(0xfff2c0); }
  return v;
}
function makeCargoHub(cx, cz) {
  const y0 = 0.25, pad = new T.Mesh(new T.PlaneGeometry(40, 40), mat('#a3a7ae')); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.27, cz); scene.add(pad);
  bx(scene, 34, 9, 14, '#e9ecf2', cx, y0 + 4.5, cz - 14); addCollider(cx, cz - 14, 34, 14, 9.25);
  bx(scene, 34.2, 1.3, 14.2, '#16296b', cx, y0 + 8.3, cz - 14); bx(scene, 35, 0.5, 15, '#4a4f5a', cx, y0 + 9.2, cz - 14);
  const fg = new T.Group(); fg.position.set(cx, y0, cz - 7 + 0.05); scene.add(fg);
  [-12, -4, 4, 12].forEach(x => { bx(fg, 5.4, 4.2, 0.2, '#cfd3da', x, 2.3, 0); bx(fg, 4.8, 3.6, 0.22, '#14161c', x, 2.2, 0.04); bx(fg, 4.8, 1.1, 0.26, '#d8dce2', x, 3.85, 0.08); [-2.2, 2.2].forEach(k => bx(fg, 0.5, 0.8, 0.5, '#222', x + k, 1.0, 0.3)); });
  const sg = new T.Mesh(new T.PlaneGeometry(22, 2.6), new T.MeshBasicMaterial({ map: cargoTex('banner') })); sg.position.set(0, 6.9, 0.14); fg.add(sg);
  [-12, 4].forEach(x => { const v = makeCargo('wreck', true); v.x = cx + x; v.z = cz - 7 + 4.1; v.h = Math.PI / 2; v.sync(); addCollider(cx + x, cz - 7 + 4.1, 3.2, 6.6, 3.8); });
  [[-7.5, -3], [-7.5, -1.4], [9, -3], [10.8, -3], [9, -1.4], [15, -1]].forEach(q => {
    bx(scene, 1.6, 0.2, 1.2, '#8a6b3b', cx + q[0], y0 + 0.1, cz + q[1]); const n = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) { bx(scene, 1.4, 0.55, 1.0, i % 2 ? '#c8a06a' : '#d5b27a', cx + q[0], y0 + 0.48 + i * 0.56, cz + q[1]); bx(scene, 1.42, 0.06, 0.2, '#efe0b0', cx + q[0], y0 + 0.78 + i * 0.56, cz + q[1]); }
    addCollider(cx + q[0], cz + q[1], 1.7, 1.3, 1.6);
  });
  bx(scene, 1.7, 1.0, 1.1, '#f2b01e', cx + 16.5, y0 + 0.7, cz - 3); bx(scene, 1.0, 1.6, 0.9, '#333', cx + 16.3, y0 + 1.5, cz - 3); bx(scene, 0.2, 2.4, 0.2, '#444', cx + 17.5, y0 + 1.5, cz - 3.3); bx(scene, 0.2, 2.4, 0.2, '#444', cx + 17.5, y0 + 1.5, cz - 2.7); bx(scene, 1.2, 0.1, 0.12, '#666', cx + 18.1, y0 + 0.3, cz - 3.3); bx(scene, 1.2, 0.1, 0.12, '#666', cx + 18.1, y0 + 0.3, cz - 2.7);
  addCollider(cx + 17, cz - 3, 2.6, 1.4, 2);
  const px = cx - 17, pz = cz + 17; bx(scene, 0.8, 11, 0.8, '#cfd3da', px, y0 + 5.5, pz); addCollider(px, pz, 1, 1, 11);
  const pt = cargoTex('pylon'); [0, Math.PI].forEach(ry => { const p = new T.Mesh(new T.PlaneGeometry(5.2, 5.2), new T.MeshBasicMaterial({ map: pt })); p.position.set(px, 11.2, pz + (ry ? -0.45 : 0.45)); p.rotation.y = ry; scene.add(p); });
  bx(scene, 5.6, 5.6, 0.7, '#16296b', px, 11.2, pz);
  [[-9, -4], [8, -4.5], [-14.5, -1.5], [13, -2.5]].forEach(q => { const pd = makePed3(); pd.position.set(cx + q[0], y0, cz + q[1]); pd.rotation.y = rnd(0, 6.28); });
  cargohubs.push({ x: cx, z: cz });
}

/* ---------- Teksas: otoban ve çevresi ---------- */
const pumpjacks = [], turbines = [], windpumps = [], hwCars = [], reserved = [];
function fitText(g, text, maxW, size, weight, fam) { let sz = size; do { g.font = weight + ' ' + sz + 'px ' + fam; sz -= 4; } while (g.measureText(text).width > maxW && sz > 20); }
function sandTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#c9a56a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(150,100,55,' + rnd(0.05, 0.14) + ')'; g.beginPath(); g.ellipse(rnd(0, 512), rnd(0, 512), rnd(20, 70), rnd(10, 40), rnd(0, 3), 0, 7); g.fill(); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,235,190,.12)' : 'rgba(110,80,45,.16)'; g.fillRect(rnd(0, 512), rnd(0, 512), rnd(2, 5), rnd(2, 4)); }
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(106,120,60,.35)'; g.beginPath(); g.arc(rnd(0, 512), rnd(0, 512), rnd(3, 9), 0, 7); g.fill(); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
function hwCanvas(horizontal) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#2b2d32'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.1)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const r = (a, b, w, h, col) => { g.fillStyle = col; if (horizontal) g.fillRect(b, a, h, w); else g.fillRect(a, b, w, h); }, X = m => (13 + m) / 26 * 256;
  r(X(-12.7), 0, 5, 256, '#e8e8e8'); r(X(12.7) - 5, 0, 5, 256, '#e8e8e8'); r(X(-2.4), 0, 4, 256, '#e0b000'); r(X(2.4) - 4, 0, 4, 256, '#e0b000');
  [-5.7, 5.7].forEach(m => r(X(m) - 2, 0, 4, 64, '#e8e8e8')); [-9.4, 9.4].forEach(m => r(X(m) - 1, 0, 2, 256, 'rgba(255,255,255,.25)'));
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
}
function flagTex() {
  const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 300, 100); g.fillStyle = '#bf0a30'; g.fillRect(100, 100, 200, 100); g.fillStyle = '#002868'; g.fillRect(0, 0, 100, 200); g.fillStyle = '#ffffff'; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 16 : 40, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(50 + Math.cos(a) * r, 100 + Math.sin(a) * r); } g.closePath(); g.fill(); return new T.CanvasTexture(c);
}
function signBoardTex(l1, l2) {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 360; const g = c.getContext('2d');
  g.fillStyle = '#0b6b3a'; g.fillRect(0, 0, 1400, 360); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(14, 14, 1372, 332); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, l1, 1200, 170, 'bold', '"Segoe UI",sans-serif'); g.fillText(l1, 700, 135); fitText(g, l2, 1200, 90, '600', '"Segoe UI",sans-serif'); g.fillText(l2, 700, 270); return new T.CanvasTexture(c);
}
function billboardTex(i) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 440; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  const D = [['#f4e3b2', '#5a2a10', 'WELCOME TO TEXAS', 'Teksas\'a hoş geldiniz · Yeehaw!'], ['#7a2a14', '#ffd98a', 'REAL TEXAS BBQ', 'Next exit · 2 mi'], ['#16296b', '#ffffff', 'OIL & GAS', 'Proudly pumping since 1901'], ['#bf0a30', '#ffffff', "DON'T MESS WITH TEXAS", 'Please keep it clean'], ['#1a1a1e', '#ffe14a', 'TRUCK STOP · 24 HRS', 'Fuel · Food · Showers']][i % 5];
  g.fillStyle = D[0]; g.fillRect(0, 0, 1024, 440); g.strokeStyle = D[1]; g.lineWidth = 14; g.strokeRect(12, 12, 1000, 416);
  if (i % 5 === 0) { g.drawImage(flagTex().image, 40, 100, 240, 160); }
  g.fillStyle = D[1]; fitText(g, D[2], i % 5 === 0 ? 640 : 900, 120, 'bold', 'Georgia,serif'); g.fillText(D[2], i % 5 === 0 ? 640 : 512, 180); fitText(g, D[3], 880, 60, '600', '"Segoe UI",sans-serif'); g.fillText(D[3], 512, 320);
  return new T.CanvasTexture(c);
}
function makeGantry(axis, sg, s, l1, l2) {
  const g = new T.Group(); g.position.set(axis === 'x' ? sg * s : 0, 0, axis === 'x' ? 0 : sg * s); g.rotation.y = axis === 'x' ? 0 : Math.PI / 2; scene.add(g);
  [-14.8, 14.8].forEach(z => { bx(g, 0.7, 8, 0.7, '#9aa0ad', 0, 4, z); bx(g, 1.4, 0.5, 1.4, '#6a6e78', 0, 0.25, z); addCollider(axis === 'x' ? sg * s : z, axis === 'x' ? z : sg * s, 1.4, 1.4, 8); });
  bx(g, 0.7, 0.7, 30.4, '#9aa0ad', 0, 7.9, 0); bx(g, 0.3, 4.0, 14.4, '#154d2d', 0, 6.0, 0);
  const tex = signBoardTex(l1, l2); [[0.4, Math.PI / 2], [-0.4, -Math.PI / 2]].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(14, 3.6), new T.MeshBasicMaterial({ map: tex })); p.position.set(q[0], 6.0, 0); p.rotation.y = q[1]; g.add(p); });
}
function makeBillboard(axis, sg, s, side, i) {
  const g = new T.Group(), lat = side * 25; g.position.set(axis === 'x' ? sg * s : lat, 0, axis === 'x' ? lat : sg * s); g.rotation.y = axis === 'x' ? 0 : Math.PI / 2; scene.add(g);
  [-5, 5].forEach(z => { bx(g, 0.6, 10, 0.6, '#555a66', 0, 5, z); addCollider(g.position.x + (axis === 'x' ? 0 : z), g.position.z + (axis === 'x' ? z : 0), 0.8, 0.8, 10); }); bx(g, 0.4, 6.4, 15.2, '#222222', 0, 10.5, 0);
  const tex = billboardTex(i); [[0.3, Math.PI / 2], [-0.3, -Math.PI / 2]].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(14.4, 6.0), new T.MeshBasicMaterial({ map: tex })); p.position.set(q[0], 10.5, 0); p.rotation.y = q[1]; g.add(p); });
}
function makePumpjack(x, z, ry) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  bx(g, 4.2, 0.5, 2.0, '#33363e', 0, 0.25, 0); bx(g, 1.4, 0.9, 1.0, '#c8262a', -2.6, 0.9, 0);
  [-0.7, 0.7].forEach(zz => { const l1 = bx(g, 0.25, 4.2, 0.25, '#2b2f3a', -0.1, 2.3, zz); l1.rotation.z = 0.16; const l2 = bx(g, 0.25, 4.2, 0.25, '#2b2f3a', 0.9, 2.3, zz); l2.rotation.z = -0.16; });
  const beam = new T.Group(); beam.position.set(0.4, 4.4, 0); g.add(beam); bx(beam, 6.4, 0.45, 0.6, '#d9a21b', 0, 0, 0); bx(beam, 0.9, 1.3, 0.6, '#d9a21b', 3.3, -0.2, 0); bx(beam, 1.2, 1.1, 0.6, '#444444', -3.2, -0.4, 0);
  bx(g, 0.18, 3.2, 0.18, '#aaaaaa', 3.6, 1.9, 0); bx(g, 0.5, 1.2, 0.5, '#444444', 3.6, 0.6, 0); pumpjacks.push({ beam, ph: rnd(0, 6) }); addCollider(x, z, 5.2, 3, 5);
}
function makeTurbine(x, z) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rnd(-0.3, 0.3); scene.add(g);
  const tw = new T.Mesh(GC, mat('#eceef2')); tw.scale.set(1.1, 62, 1.1); tw.position.y = 31; g.add(tw); bx(g, 4.2, 2.4, 2.4, '#f4f4f6', 0.8, 63, 0);
  const rotor = new T.Group(); rotor.position.set(3.1, 63, 0); [0, 1, 2].forEach(i => { const bg = new T.Group(); bg.rotation.x = i * 2.094; rotor.add(bg); bx(bg, 0.4, 26, 1.5, '#f4f4f6', 0, 13.5, 0); }); bx(rotor, 1.6, 1.6, 1.6, '#d8d8dc', 0, 0, 0);
  g.add(rotor); turbines.push({ rotor, sp: rnd(0.5, 1.1) }); addCollider(x, z, 2.4, 2.4, 65);
}
function makeRanch(x, z) {
  const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
  bx(g, 10, 4, 7, '#e8dcc0', -8, 2, -6); [-1, 1].forEach(sd => { const r = bx(g, 11, 0.3, 4.4, '#7a3b26', -8, 4.9, -6 + sd * 1.9); r.rotation.x = -sd * 0.5; }); bx(g, 2.2, 3.2, 0.2, '#6b4b2e', -8, 1.6, -2.45);
  bx(g, 12, 7, 9, '#a8322a', 10, 3.5, -4); [-1, 1].forEach(sd => { const r = bx(g, 13, 0.4, 5.6, '#4a2220', 10, 8.1, -4 + sd * 2.3); r.rotation.x = -sd * 0.62; }); [0.65, -0.65].forEach(a => { const d = bx(g, 5.2, 0.3, 0.2, '#f4f4f6', 10, 2.8, 0.55); d.rotation.z = a; }); bx(g, 5.4, 5.4, 0.15, '#7a2420', 10, 2.8, 0.52);
  const sl = new T.Mesh(GC, mat('#c9ccd2')); sl.scale.set(2.2, 12, 2.2); sl.position.set(22, 6, -8); g.add(sl); const dm = new T.Mesh(new T.SphereGeometry(2.2, 12, 8), mat('#aab0ba')); dm.position.set(22, 12, -8); dm.scale.y = 0.6; g.add(dm);
  const wp = new T.Group(); wp.position.set(-18, 0, 6); g.add(wp); [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(q => bx(wp, 0.22, 10, 0.22, '#7a7f89', q[0] * 0.8, 5, q[1] * 0.8)); bx(wp, 2.0, 2.0, 2.0, '#6a6f79', 0, 1, 0);
  const wheel = new T.Group(); wheel.position.set(1.2, 10.4, 0); wp.add(wheel); for (let i = 0; i < 16; i++) { const bg = new T.Group(); bg.rotation.x = i * Math.PI / 8; wheel.add(bg); bx(bg, 0.1, 1.9, 0.55, '#cfd3da', 0, 1.7, 0); } bx(wp, 0.15, 0.4, 3.0, '#b0b4bc', -1.6, 10.4, 0); windpumps.push({ wheel, sp: rnd(1.2, 2.2) });
  const tk = new T.Mesh(GC, mat('#7d8591')); tk.scale.set(2.4, 2.4, 2.4); tk.position.set(-24, 3.5, -2); g.add(tk); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => bx(g, 0.25, 2.4, 0.25, '#555a66', -24 + q[0] * 1.5, 1.2, -2 + q[1] * 1.5));
  for (let i = 0; i <= 14; i++) { const px = -28 + i * 4; [-14, 14].forEach(pz => bx(g, 0.2, 1.3, 0.2, '#6b5a45', px, 0.65, pz)); } for (let i = 0; i <= 8; i++) { const pz = -14 + i * 3.5; [-28, 28].forEach(px => bx(g, 0.2, 1.3, 0.2, '#6b5a45', px, 0.65, pz)); }
  [0.55, 1.05].forEach(y => { bx(g, 56, 0.1, 0.08, '#8a7a5a', 0, y, -14); bx(g, 56, 0.1, 0.08, '#8a7a5a', 0, y, 14); bx(g, 0.08, 0.1, 28, '#8a7a5a', -28, y, 0); bx(g, 0.08, 0.1, 28, '#8a7a5a', 28, y, 0); });
  for (let i = 0; i < 9; i++) { const cw = new T.Group(), col = pick(['#5a3a24', '#f4f4f0', '#8a5a34', '#222222']); cw.position.set(rnd(-24, 24), 0, rnd(4, 12)); cw.rotation.y = rnd(0, 6.28); g.add(cw);
    bx(cw, 2.6, 1.2, 1.0, col, 0, 1.3, 0); bx(cw, 0.8, 0.7, 0.7, col, 1.6, 1.5, 0); [[-0.9, -0.35], [-0.9, 0.35], [0.9, -0.35], [0.9, 0.35]].forEach(q => bx(cw, 0.25, 0.9, 0.25, '#2b2b2b', q[0], 0.45, q[1])); }
  const cm = carMesh(pick(CAR_COLORS)); cm.haz.forEach(m => m.color.setHex(0x3a2200)); cm.g.position.set(-8, 0, 2); cm.g.rotation.y = 0.4; g.add(cm.g);
  addCollider(x - 8, z - 6, 10, 7, 5); addCollider(x + 10, z - 4, 12, 9, 8); addCollider(x + 22, z - 8, 4.6, 4.6, 12); reserved.push({ x, z, r: 60 });
}
function makeRoadside(cx, cz) {
  const pad = new T.Mesh(new T.PlaneGeometry(76, 50), mat('#55585f')); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.03, cz); scene.add(pad);
  bx(scene, 16, 4.4, 9, '#ececf0', cx - 16, 2.2, cz - 14); bx(scene, 16.2, 0.7, 9.2, '#c0392b', cx - 16, 3.1, cz - 14); bx(scene, 16.4, 0.3, 9.4, '#8a8e98', cx - 16, 4.55, cz - 14); bx(scene, 12, 1.4, 0.15, '#1b2a3a', cx - 16, 2.2, cz - 9.4);
  addCollider(cx - 16, cz - 14, 16, 9, 4.6);
  bx(scene, 34, 4.2, 8, '#d9c9a3', cx + 14, 2.1, cz - 14); bx(scene, 34.2, 0.4, 8.2, '#8a3b2a', cx + 14, 4.3, cz - 14); for (let i = 0; i < 8; i++) { bx(scene, 1.5, 2.5, 0.15, '#8a3b2a', cx + 0 + i * 4, 1.3, cz - 9.9); bx(scene, 1.6, 1.0, 0.1, '#1b2a3a', cx + 2 + i * 4, 2.3, cz - 9.95); } addCollider(cx + 14, cz - 14, 34, 8, 4.4);
  const sg = new T.Mesh(new T.PlaneGeometry(9, 4.4), new T.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 250; const g = c.getContext('2d'); g.fillStyle = '#16111f'; g.fillRect(0, 0, 512, 250); g.strokeStyle = '#ff4fa3'; g.lineWidth = 10; g.strokeRect(10, 10, 492, 230); g.textAlign = 'center'; g.fillStyle = '#ff7ac3'; g.font = 'bold 86px Georgia,serif'; g.fillText('MOTEL', 256, 95); g.fillStyle = '#7ae6ff'; g.font = 'bold 60px "Segoe UI",sans-serif'; g.fillText('DINER 24H', 256, 175); g.fillStyle = '#ffe14a'; g.font = '44px "Segoe UI",sans-serif'; g.fillText('★ VACANCY ★', 256, 222); return new T.CanvasTexture(c); })() }));
  sg.position.set(cx + 2, 12, cz + 4); scene.add(sg); bx(scene, 0.6, 11, 0.6, '#555a66', cx + 2, 5.5, cz + 4); addCollider(cx + 2, cz + 4, 0.8, 0.8, 11);
  [-6, 0, 12, 18].forEach((dx, i) => { const cm = carMesh(pick(CAR_COLORS)); cm.haz.forEach(m => m.color.setHex(0x3a2200)); cm.g.position.set(cx + dx - 4, 0.03, cz + 8 + (i % 2) * 6); cm.g.rotation.y = Math.PI / 2; scene.add(cm.g); addCollider(cx + dx - 4, cz + 8 + (i % 2) * 6, 2.2, 4.6, 2); });
  const tm = vehMesh('trailer', '#e0782c'); tm.g.position.set(cx + 24, 0.03, cz + 6); tm.g.rotation.y = Math.PI / 2; scene.add(tm.g); addCollider(cx + 24, cz + 6, 3, 15.4, 4.5);
  [[-8, -1], [4, 0], [20, 2]].forEach(q => { const pd = makePed3(); pd.position.set(cx + q[0], 0.03, cz - 7 + q[1]); pd.rotation.y = rnd(0, 6.28); });
  reserved.push({ x: cx, z: cz, r: 55 });
}
function desertPoint(minHw) {
  for (let t = 0; t < 60; t++) {
    const x = rnd(-WORLD + 30, WORLD - 30), z = rnd(-WORLD + 30, WORLD - 30), m = minHw || 30;
    if (Math.abs(x) < HALF + 40 && Math.abs(z) < HALF + 40) continue; if ((Math.abs(z) < m && Math.abs(x) > HALF) || (Math.abs(x) < m && Math.abs(z) > HALF)) continue;
    if (reserved.some(r => Math.hypot(r.x - x, r.z - z) < r.r)) continue; return { x, z };
  }
  return null;
}
let rampT = null;
function rampTexture() {
  if (rampT) return rampT; const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#2b2d32'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.1)'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 5, 128, 5); g.fillRect(0, 118, 128, 5); rampT = new T.CanvasTexture(c); rampT.wrapS = rampT.wrapT = T.RepeatWrapping; rampT.anisotropy = 8; return rampT;
}
function roadStrip(x1, z1, x2, z2, w) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), t = rampTexture().clone(); t.needsUpdate = true; t.repeat.set(len / 8, 1);
  const gr = new T.Group(); gr.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); gr.rotation.y = -Math.atan2(dz, dx);
  const m = new T.Mesh(new T.PlaneGeometry(len, w), new T.MeshLambertMaterial({ map: t })); m.rotation.x = -Math.PI / 2; gr.add(m); scene.add(gr);
  [[x1, z1], [x2, z2]].forEach(q => { const d = new T.Mesh(new T.CircleGeometry(w / 2, 20), new T.MeshLambertMaterial({ color: 0x2b2d32 })); d.rotation.x = -Math.PI / 2; d.position.set(q[0], 0.013, q[1]); scene.add(d); });
}
function makeExit(axis, sg, srel, side, num) {
  const P2 = (st, lat) => axis === 'x' ? [sg * (HW0 + st), lat] : [lat, sg * (HW0 + st)], pts = [[srel, 12], [srel + 90, 44], [srel + 250, 44], [srel + 340, 12]].map(q => P2(q[0], side * q[1]));
  for (let i = 0; i < 3; i++) roadStrip(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 9);
  const sp = P2(srel + 170, side * 72); makeStation(sp[0], sp[1]); reserved.push({ x: sp[0], z: sp[1], r: 58 }); const fp = P2(srel + 170, side * 44); reserved.push({ x: fp[0], z: fp[1], r: 75 });
  [srel - 70, srel + 340 + 70].forEach(st => {
    const p = P2(st, side * 18); bx(scene, 0.4, 6, 0.4, '#9aa0ad', p[0], 3, p[1]); addCollider(p[0], p[1], 0.8, 0.8, 6);
    const tex = signBoardTex('ÇIKIŞ ' + num, '⛽ Benzin · Yemek · 1 mil'); [0, Math.PI].forEach(ry => { const pl = new T.Mesh(new T.PlaneGeometry(7.4, 1.9), new T.MeshBasicMaterial({ map: tex }));
      pl.position.set(p[0] + (axis === 'x' ? (ry ? -0.3 : 0.3) : 0), 6.4, p[1] + (axis === 'x' ? 0 : (ry ? -0.3 : 0.3))); pl.rotation.y = (axis === 'x' ? Math.PI / 2 : 0) + ry; scene.add(pl); });
  });
}
function buildTexas() {
  const sand = new T.Mesh(new T.PlaneGeometry(4400, 4400), new T.MeshLambertMaterial({ map: sandTex() })); sand.material.map.repeat.set(4400 / 60, 4400 / 60); sand.rotation.x = -Math.PI / 2; sand.position.y = -0.09; scene.add(sand);
  const len = WORLD - HW0, th = hwCanvas(true), tv = hwCanvas(false); th.repeat.set(len / 12, 1); tv.repeat.set(1, len / 12);
  const posts = [], poleA = [], poleB = [];
  [1, -1].forEach(sg => {
    const e = new T.Mesh(new T.PlaneGeometry(len, 26), new T.MeshLambertMaterial({ map: th })); e.rotation.x = -Math.PI / 2; e.position.set(sg * (HW0 + len / 2), 0.011, 0); scene.add(e);
    const n = new T.Mesh(new T.PlaneGeometry(26, len), new T.MeshLambertMaterial({ map: tv })); n.rotation.x = -Math.PI / 2; n.position.set(0, 0.011, sg * (HW0 + len / 2)); scene.add(n);
    for (let st = HW0 + 12; st < WORLD - 20; st += 360) { const L = Math.min(336, WORLD - 20 - st), mid = st + L / 2;
      bx(scene, L, 0.9, 0.7, '#b9b6ae', sg * mid, 0.45, 0); addCollider(sg * mid, 0, L, 0.7, 0.9); bx(scene, 0.7, 0.9, L, '#b9b6ae', 0, 0.45, sg * mid); addCollider(0, sg * mid, 0.7, L, 0.9); }
    for (let st = HW0 + 15; st < WORLD - 10; st += 30) [-1, 1].forEach(sd => { posts.push({ x: sg * st, y: 0.45, z: sd * 12.9, sx: 0.12, sy: 0.9, sz: 0.12 }); posts.push({ x: sd * 12.9, y: 0.45, z: sg * st, sx: 0.12, sy: 0.9, sz: 0.12 }); });
    for (let st = HW0 + 30; st < WORLD - 20; st += 70) [-1, 1].forEach(sd => { poleA.push({ x: sg * st, y: 4.5, z: sd * 19, sx: 0.18, sy: 9, sz: 0.18 }); poleB.push({ x: sg * st, y: 8.5, z: sd * 19, sx: 0.2, sy: 0.2, sz: 3.2 }); poleA.push({ x: sd * 19, y: 4.5, z: sg * st, sx: 0.18, sy: 9, sz: 0.18 }); poleB.push({ x: sd * 19, y: 8.5, z: sg * st, sx: 3.2, sy: 0.2, sz: 0.2 }); });
    const endS = WORLD - 8; for (let i = 0; i < 13; i++) { const lat = -12.5 + i * 2.08, col = i % 2 ? '#d62a22' : '#f4f4f6'; bx(scene, 0.8, 1.1, 2.0, col, sg * endS, 0.55, lat); bx(scene, 2.0, 1.1, 0.8, col, lat, 0.55, sg * endS); }
  });
  instanced(GB, mat('#e8e8e8'), posts); instanced(GC, mat('#6b5236'), poleA); instanced(GB, mat('#6b5236'), poleB);
  // tabelalar, panolar, bayraklar
  const NAMES = { x1: ['HOUSTON', '180 mil'], 'x-1': ['EL PASO', '610 mil'], z1: ['SAN ANTONIO', '95 mil'], 'z-1': ['DALLAS', '220 mil'] }, fl = flagTex();
  [['x', 1], ['x', -1], ['z', 1], ['z', -1]].forEach(([axis, sg], i) => {
    const nm = NAMES[axis + sg]; makeGantry(axis, sg, HW0 + 70, nm[0], nm[1]); makeGantry(axis, sg, HW0 + 480, 'TEXAS ' + (60 + i * 7), 'sonraki çıkış 12 mil');
    makeBillboard(axis, sg, HW0 + 36, 1, 0); makeBillboard(axis, sg, HW0 + 170, -1, 1 + i % 4); makeBillboard(axis, sg, HW0 + 330, 1, 2 + i % 3); makeBillboard(axis, sg, HW0 + 700, -1, (i + 3) % 5); makeBillboard(axis, sg, HW0 + 880, 1, (i + 1) % 5);
    [-1, 1].forEach(sd => { const px = axis === 'x' ? sg * (HW0 + 22) : sd * 19, pz = axis === 'x' ? sd * 19 : sg * (HW0 + 22); bx(scene, 0.35, 15, 0.35, '#cfd3da', px, 7.5, pz); addCollider(px, pz, 0.6, 0.6, 15);
      const f = new T.Mesh(new T.PlaneGeometry(6, 4), new T.MeshBasicMaterial({ map: fl, side: T.DoubleSide })); f.position.set(px + (axis === 'x' ? 0 : 3.2), 13, pz + (axis === 'x' ? 3.2 : 0)); f.rotation.y = axis === 'x' ? Math.PI / 2 : 0; scene.add(f); });
  });
  // kamyon duraklari, motel
  makeRoadside(330, 62); makeRoadside(-330, 62); let en = 10; [['x', 1], ['x', -1], ['z', 1], ['z', -1]].forEach(([axis, sg]) => { makeExit(axis, sg, 120, 1, ++en); makeExit(axis, sg, 540, -1, ++en); });
  // ciftlikler
  [[-620, -330], [560, 380], [-420, 640], [690, -540], [300, -760]].forEach(q => makeRanch(q[0], q[1]));
  // petrol pompalari (pumpjack)
  for (let i = 0; i < 18; i++) { const p = i < 8 ? (() => { const sg = Math.random() < 0.5 ? 1 : -1, st = rnd(HW0 + 60, WORLD - 120), lat = (Math.random() < 0.5 ? 1 : -1) * rnd(45, 150); return Math.random() < 0.5 ? { x: sg * st, z: lat } : { x: lat, z: sg * st }; })() : desertPoint(60); if (p) makePumpjack(p.x, p.z, rnd(0, 6.28)); }
  // ruzgar turbinleri
  for (let i = 0; i < 30; i++) { const p = desertPoint(120); if (p && Math.hypot(p.x, p.z) > 380) makeTurbine(p.x, p.z); }
  // mesalar
  for (let i = 0; i < 18; i++) { const a = rnd(0, 6.28), r = rnd(480, 1060), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 170 || Math.abs(z) < 170 || Math.abs(x) > WORLD - 140 || Math.abs(z) > WORLD - 140 || reserved.some(q => Math.hypot(q.x - x, q.z - z) < q.r + 90)) continue;
    const w = rnd(110, 260), d = rnd(90, 190), h1 = rnd(40, 95), cols = ['#b86a3c', '#c47c4a', '#a85c32']; bx(scene, w, h1, d, cols[0], x, h1 / 2, z); bx(scene, w * 0.78, h1 * 0.55, d * 0.78, cols[1], x + rnd(-10, 10), h1 + h1 * 0.275, z + rnd(-8, 8)); bx(scene, w * 0.5, h1 * 0.4, d * 0.5, cols[2], x + rnd(-14, 14), h1 * 1.55 + h1 * 0.2, z + rnd(-10, 10)); addCollider(x, z, w, d, h1); }
  // kaktus, kaya, calilik
  const cT = [], cA = [], cV = [], cA2 = [], cV2 = [], rocks = [], bush = [], tufts = [];
  for (let i = 0; i < 280; i++) { let p; if (i < 90) { const sg = Math.random() < 0.5 ? 1 : -1, st = rnd(HW0 + 20, WORLD - 40), lat = (Math.random() < 0.5 ? 1 : -1) * rnd(20, 90); p = Math.random() < 0.5 ? { x: sg * st, z: lat } : { x: lat, z: sg * st }; } else p = desertPoint(26);
    if (!p) continue; const ry = rnd(0, 6.28), sc = rnd(0.8, 1.5), c = Math.cos(ry), sn = Math.sin(ry);
    cT.push({ x: p.x, y: 2.5 * sc, z: p.z, sx: 0.7 * sc, sy: 5 * sc, sz: 0.7 * sc, ry }); cA.push({ x: p.x + c * 0.9 * sc, y: 2.4 * sc, z: p.z - sn * 0.9 * sc, sx: 1.4 * sc, sy: 0.55 * sc, sz: 0.55 * sc, ry }); cV.push({ x: p.x + c * 1.5 * sc, y: 3.2 * sc, z: p.z - sn * 1.5 * sc, sx: 0.55 * sc, sy: 1.8 * sc, sz: 0.55 * sc, ry });
    cA2.push({ x: p.x - c * 0.8 * sc, y: 3.2 * sc, z: p.z + sn * 0.8 * sc, sx: 1.2 * sc, sy: 0.5 * sc, sz: 0.5 * sc, ry }); cV2.push({ x: p.x - c * 1.35 * sc, y: 3.9 * sc, z: p.z + sn * 1.35 * sc, sx: 0.5 * sc, sy: 1.4 * sc, sz: 0.5 * sc, ry }); }
  const cm = mat('#4f7a3c'); [cT, cA, cV, cA2, cV2].forEach(l => instanced(GB, cm, l));
  for (let i = 0; i < 170; i++) { const p = desertPoint(26); if (p) { const sc = rnd(0.6, 2.6); rocks.push({ x: p.x, y: 0.35 * sc, z: p.z, sx: 1.6 * sc, sy: 0.8 * sc, sz: 1.2 * sc, ry: rnd(0, 6.28) }); } }
  for (let i = 0; i < 340; i++) { const p = desertPoint(26); if (p) { const sc = rnd(0.7, 1.6); bush.push({ x: p.x, y: 0.4 * sc, z: p.z, sx: 1.3 * sc, sy: 0.8 * sc, sz: 1.3 * sc, ry: rnd(0, 6.28) }); } }
  for (let i = 0; i < 700; i++) { const p = desertPoint(26); if (p) { const sc = rnd(0.6, 1.4); tufts.push({ x: p.x, y: 0.35 * sc, z: p.z, sx: 0.45 * sc, sy: 0.7 * sc, sz: 0.45 * sc }); } }
  instanced(GB, mat('#8f7a63'), rocks); instanced(GB, mat('#7d7340'), bush); instanced(new T.ConeGeometry(1, 1, 5), mat('#b49a52'), tufts);
  // otobanda trafik
  const ARMS = [{ axis: 'x', sg: 1 }, { axis: 'x', sg: -1 }, { axis: 'z', sg: 1 }, { axis: 'z', sg: -1 }];
  for (let i = 0; i < 18; i++) { const r = Math.random(), cls = r < 0.62 ? 'car' : r < 0.86 ? 'trailer' : 'heavy', v = new Veh('ai', pick(CAR_COLORS), cls); v.cm.tail.color.setHex(0xaa1818); v.cm.head.color.setHex(0xfff2c0); v.hwArm = ARMS[i % 4]; v.hwV = cls === 'car' ? rnd(25, 34) : rnd(19, 25); hwCars.push(v); placeHw(v); }
}
function hwTeleport(v, st) {
  const a = v.hwArm, d = (v.hwOut ? 1 : -1) * a.sg, lane = v.hwLane ? LN2 : LN1, lc = a.axis === 'x' ? lane * d : -lane * d;
  if (a.axis === 'x') { v.x = a.sg * st; v.z = lc; v.h = d > 0 ? 0 : Math.PI; } else { v.z = a.sg * st; v.x = lc; v.h = d > 0 ? Math.PI / 2 : -Math.PI / 2; }
  v.speed = v.hwV * 0.7; v.vx = Math.cos(v.h) * v.speed; v.vz = Math.sin(v.h) * v.speed;
}
function placeHw(v) { v.hwOut = Math.random() < 0.5; v.hwLane = Math.random() < 0.5 ? 0 : 1; hwTeleport(v, rnd(HW0 + 80, WORLD - 90)); }
function updateHw(v, dt) {
  const a = v.hwArm, ax = a.axis, st = ax === 'x' ? Math.abs(v.x) : Math.abs(v.z);
  if (v.hwOut && st > WORLD - 45) { v.hwOut = false; v.hwLane = Math.random() < 0.5 ? 0 : 1; hwTeleport(v, WORLD - 50); }
  else if (!v.hwOut && st < HW0 + 50) { v.hwOut = true; v.hwLane = Math.random() < 0.5 ? 0 : 1; hwTeleport(v, HW0 + 55); }
  const d = (v.hwOut ? 1 : -1) * a.sg, lane = v.hwLane ? LN2 : LN1, lc = ax === 'x' ? lane * d : -lane * d, hh = ax === 'x' ? (d > 0 ? 0 : Math.PI) : (d > 0 ? Math.PI / 2 : -Math.PI / 2);
  v.h += clamp(angDiff(v.h, hh), -1.5 * dt, 1.5 * dt); if (ax === 'x') v.z += clamp(lc - v.z, -2.5 * dt, 2.5 * dt); else v.x += clamp(lc - v.x, -2.5 * dt, 2.5 * dt);
  const fx = Math.cos(v.h), fz = Math.sin(v.h); let tgt = v.hwV;
  for (const o of [truck, ...hwCars, ...freeCars()]) { if (o === v) continue; const dx = o.x - v.x, dz = o.z - v.z; if (Math.abs(dx) > 70 || Math.abs(dz) > 70) continue; const f = dx * fx + dz * fz, l = Math.abs(-dx * fz + dz * fx); if (f > 0 && f < 28 + v.speed * 0.6 && l < 2.9) tgt = Math.min(tgt, Math.max(0, (f - 10) * 1.1)); }
  v.speed += clamp(tgt - v.speed, -12 * dt, 4 * dt); v.vx = fx * v.speed; v.vz = fz * v.speed; v.x += v.vx * dt; v.z += v.vz * dt;
}
function stepTexas(dt) {
  for (const p of pumpjacks) p.beam.rotation.z = Math.sin(time * 1.4 + p.ph) * 0.2;
  for (const t of turbines) t.rotor.rotation.x += dt * t.sp; for (const w of windpumps) w.wheel.rotation.x += dt * w.sp;
}

function buildWorld() {
  const ground = new T.Mesh(new T.PlaneGeometry(2 * (HALF + 16), 2 * (HALF + 16)), mat('#3a3d42')); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const len = 2 * (HALF + 8), tv = roadCanvas(false), th = roadCanvas(true);
  for (let i = 0; i < NR; i++) {
    const t1 = tv.clone(); t1.needsUpdate = true; t1.repeat.set(1, len / 16);
    const rv = new T.Mesh(new T.PlaneGeometry(ROADW, len), new T.MeshLambertMaterial({ map: t1 })); rv.rotation.x = -Math.PI / 2; rv.position.set(rc(i), 0.01, 0); scene.add(rv);
    const t2 = th.clone(); t2.needsUpdate = true; t2.repeat.set(len / 16, 1);
    const rh = new T.Mesh(new T.PlaneGeometry(len, ROADW), new T.MeshLambertMaterial({ map: t2 })); rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.012, rc(i)); scene.add(rh);
  }
  const inter = [], cross = [], lamps = [], lampHeads = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < NR; j++) {
    inter.push({ x: rc(i), y: 0.03, z: rc(j), sx: ROADW, sy: 0.02, sz: ROADW });
    for (let k = -3; k <= 3; k++) {
      cross.push({ x: rc(i) + 10.5, y: 0.05, z: rc(j) + k * 2, sx: 4, sy: 0.02, sz: 1 }, { x: rc(i) - 10.5, y: 0.05, z: rc(j) + k * 2, sx: 4, sy: 0.02, sz: 1 },
        { x: rc(i) + k * 2, y: 0.05, z: rc(j) + 10.5, sx: 1, sy: 0.02, sz: 4 }, { x: rc(i) + k * 2, y: 0.05, z: rc(j) - 10.5, sx: 1, sy: 0.02, sz: 4 });
    }
  }
  instanced(GB, mat('#2e3035'), inter); instanced(GB, mat('#e6e6e6'), cross);
  {
    const poles = [], house = [], lamp = { x: { r: [], y: [], g: [] }, z: { r: [], y: [], g: [] } }, stops = [];
    for (let i = 0; i < NR; i++) for (let j = 0; j < NR; j++) {
      if (!isLit(i, j)) continue; const cx = rc(i), cz = rc(j);
      [[-9, 9, -1, 0, 'x'], [9, -9, 1, 0, 'x'], [-9, -9, 0, -1, 'z'], [9, 9, 0, 1, 'z']].forEach(q => {
        const x = cx + q[0], z = cz + q[1], fx = q[2], fz = q[3], ax = q[4], lx = x + fx * 0.45, lz = z + fz * 0.45, sx = fx ? 0.14 : 0.58, sz = fz ? 0.14 : 0.58;
        poles.push({ x, y: 3.1, z, sx: 0.16, sy: 6.2, sz: 0.16 }); house.push({ x, y: 5.3, z, sx: 0.85, sy: 2.3, sz: 0.85 });
        lamp[ax].r.push({ x: lx, y: 6.05, z: lz, sx, sy: 0.58, sz }); lamp[ax].y.push({ x: lx, y: 5.3, z: lz, sx, sy: 0.58, sz }); lamp[ax].g.push({ x: lx, y: 4.55, z: lz, sx, sy: 0.58, sz });
      });
      stops.push({ x: cx - 13.8, y: 0.055, z: cz + 4, sx: 0.5, sy: 0.02, sz: 7.4 }, { x: cx + 13.8, y: 0.055, z: cz - 4, sx: 0.5, sy: 0.02, sz: 7.4 },
        { x: cx - 4, y: 0.055, z: cz - 13.8, sx: 7.4, sy: 0.02, sz: 0.5 }, { x: cx + 4, y: 0.055, z: cz + 13.8, sx: 7.4, sy: 0.02, sz: 0.5 });
    }
    instanced(GC, mat('#3b3f48'), poles); instanced(GB, mat('#15171c'), house); instanced(GB, mat('#e6e6e6'), stops);
    sigMats = { x: {}, z: {} };
    ['x', 'z'].forEach(ax => ['r', 'y', 'g'].forEach(c => { sigMats[ax][c] = basic(0x000000); instanced(GB, sigMats[ax][c], lamp[ax][c]); }));
  }
  const treeList = [], shopMap = {}, stationMap = {};
  { const ord = []; for (let a = 0; a < NB; a++) for (let b = 0; b < NB; b++) { const zk0 = ['service', 'parking'].find(k => ZONE_BLOCKS[k].some(q => q[0] === a && q[1] === b)); if (!zk0 && !PARKS.some(q => q[0] === a && q[1] === b) && !HOSP_BLOCKS.some(q => q[0] === a && q[1] === b) && !FIRE_BLOCKS.some(q => q[0] === a && q[1] === b) && !CARGO_BLOCKS.some(q => q[0] === a && q[1] === b)) ord.push([a, b]); }
    for (let i = ord.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [ord[i], ord[j]] = [ord[j], ord[i]]; }
    ord.slice(22, 25).forEach(q => { shopMap[q[0] + ',' + q[1]] = { type: 'postane', qi: Math.random() * 4 | 0 }; });
    ord.slice(19, 22).forEach(q => { shopMap[q[0] + ',' + q[1]] = { type: 'banka', qi: Math.random() * 4 | 0 }; });
    ord.slice(16, 19).forEach(q => { stationMap[q[0] + ',' + q[1]] = true; });
    ord.slice(0, 16).forEach((q, i) => { shopMap[q[0] + ',' + q[1]] = { type: i % 2 ? 'market' : 'firin', qi: Math.random() * 4 | 0 }; }); }
  for (let bx_ = 0; bx_ < NB; bx_++) for (let bz = 0; bz < NB; bz++) {
    const cx = bc(bx_), cz = bc(bz), LOT = 44;
    bx(scene, LOT + 1.2, 0.2, LOT + 1.2, '#6b6862', cx, 0.1, cz); bx(scene, LOT, 0.25, LOT, '#9a978f', cx, 0.125, cz);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => { lamps.push({ x: cx + q[0] * (LOT / 2 - 1.2), y: 3.2, z: cz + q[1] * (LOT / 2 - 1.2), sx: 0.12, sy: 6.4, sz: 0.12 }); lampHeads.push({ x: cx + q[0] * (LOT / 2 - 1.2), y: 6.5, z: cz + q[1] * (LOT / 2 - 1.2), sx: 1.4, sy: 0.3, sz: 0.8 }); });
    const zk = ['service', 'parking'].find(k => ZONE_BLOCKS[k].some(b => b[0] === bx_ && b[1] === bz));
    const isPark = PARKS.some(b => b[0] === bx_ && b[1] === bz), isHosp = HOSP_BLOCKS.some(b => b[0] === bx_ && b[1] === bz), isFire = FIRE_BLOCKS.some(b => b[0] === bx_ && b[1] === bz), isCargo = CARGO_BLOCKS.some(b => b[0] === bx_ && b[1] === bz);
    if (zk) {
      const lot = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshLambertMaterial({ map: lotTexture(zk) })); lot.rotation.x = -Math.PI / 2; lot.position.set(cx, 0.27, cz); scene.add(lot);
      bx(scene, 30, 7, 8, zk === 'service' ? '#b86a2a' : '#3f5f8f', cx, 3.75, cz - 17); addCollider(cx, cz - 17, 30, 8, 7);
      bx(scene, 14, 4, 0.4, '#1b1d24', cx, 2.3, cz - 12.8);
      makeFleetSigns(cx, cz, zk);
      const zone = { kind: zk, name: zk === 'service' ? 'SERVİS' : 'OTOPARK', x: cx, z: cz + 4, r: 11 }; zones.push(zone);
      const col = zk === 'service' ? 0xff8a1f : 0x35b8ff;
      const ring = new T.Mesh(new T.RingGeometry(zone.r - 1, zone.r, 56), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide, transparent: true, opacity: 0.95 })); ring.rotation.x = -Math.PI / 2; ring.position.set(zone.x, 0.32, zone.z); scene.add(ring);
      const disc = new T.Mesh(new T.CircleGeometry(zone.r - 1, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set(zone.x, 0.31, zone.z); scene.add(disc);
      const beam = new T.Mesh(new T.CylinderGeometry(zone.r - 1, zone.r - 1, 70, 32, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); beam.position.set(zone.x, 35, zone.z); scene.add(beam);
      const lab = labelSprite(zk === 'service' ? '🔧 SERVİS' : '🅿️ OTOPARK', zk === 'service' ? '#ff8a1f' : '#35b8ff'); lab.scale.set(40, 10, 1); lab.position.set(zone.x, 32, zone.z); scene.add(lab);
      zone.ring = ring;
    } else if (isCargo) {
      makeCargoHub(cx, cz);
    } else if (isFire) {
      makeFireStation(cx, cz);
    } else if (isHosp) {
      makeHospital(cx, cz);
    } else if (isPark) {
      const g = new T.Mesh(new T.PlaneGeometry(LOT - 2, LOT - 2), mat('#2f5a38')); g.rotation.x = -Math.PI / 2; g.position.set(cx, 0.27, cz); scene.add(g);
      for (let i = 0; i < 16; i++) { const x = cx + rnd(-18, 18), z = cz + rnd(-18, 18), s = rnd(0.9, 1.5); treeList.push({ x, z, s }); trees.push({ x, z, r: 1.1 * s }); }
    } else {
      const ht = (hf) => 16 + hf * 52 * (1 - Math.hypot(cx, cz) / (HALF * 1.83));
      const sh = shopMap[bx_ + ',' + bz];
      if (stationMap[bx_ + ',' + bz]) makeStation(cx, cz); else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((q, qi) => {
        const w = rnd(17, 19), d = rnd(17, 19);
        if (sh && sh.qi === qi) makeShop(sh.type, cx + q[0] * 11, cz + q[1] * 11, w, d, q[0], q[1]); else facade(cx + q[0] * 11, cz + q[1] * 11, w, d, Math.max(14, ht(Math.random())), true);
      });
    }
  }
  buildTexas();
  instanced(GC, mat('#4a4d55'), lamps); instanced(GB, basic(0xffd9a0), lampHeads);
  instanced(GC, mat('#5b3f26'), treeList.map(t => ({ x: t.x, y: 1.2 * t.s, z: t.z, sx: 0.25 * t.s, sy: 2.4 * t.s, sz: 0.25 * t.s })));
  instanced(new T.ConeGeometry(1, 1, 8), mat('#2d7040'), treeList.map(t => ({ x: t.x, y: 4.2 * t.s, z: t.z, sx: 2.0 * t.s, sy: 5 * t.s, sz: 2.0 * t.s })));
  // minimap statik katmanı
  const mc = document.createElement('canvas'); mc.width = mc.height = 200; const g = mc.getContext('2d'); g.fillStyle = '#1a1d26'; g.fillRect(0, 0, 200, 200);
  g.fillStyle = '#2b2f3c'; for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) g.fillRect(100 + bc(i) * MS - 9, 100 + bc(j) * MS - 9, 18, 18);
  g.strokeStyle = '#555b6e'; g.lineWidth = 6; for (let i = 0; i < NR; i++) { g.beginPath(); g.moveTo(100 + rc(i) * MS, 100 - HALF * MS); g.lineTo(100 + rc(i) * MS, 100 + HALF * MS); g.stroke(); g.beginPath(); g.moveTo(100 - HALF * MS, 100 + rc(i) * MS); g.lineTo(100 + HALF * MS, 100 + rc(i) * MS); g.stroke(); }
  cargohubs.forEach(k => { g.fillStyle = '#ffc20e'; g.fillRect(100 + k.x * MS - 6, 100 + k.z * MS - 6, 12, 12); g.fillStyle = '#16296b'; g.font = 'bold 10px Segoe UI'; g.textAlign = 'center'; g.fillText('K', 100 + k.x * MS, 100 + k.z * MS + 3.5); });
  firestations.forEach(f => { g.fillStyle = '#e8452a'; g.fillRect(100 + f.x * MS - 6, 100 + f.z * MS - 6, 12, 12); g.fillStyle = '#fff'; g.font = 'bold 10px Segoe UI'; g.textAlign = 'center'; g.fillText('F', 100 + f.x * MS, 100 + f.z * MS + 3.5); });
  hospitals.forEach(h => { g.fillStyle = '#fff'; g.fillRect(100 + h.x * MS - 6, 100 + h.z * MS - 6, 12, 12); g.fillStyle = '#d62a22'; g.fillRect(100 + h.x * MS - 1.5, 100 + h.z * MS - 5, 3, 10); g.fillRect(100 + h.x * MS - 5, 100 + h.z * MS - 1.5, 10, 3); });
  stations.forEach(st => { g.fillStyle = '#ff5a4a'; g.fillRect(100 + st.x * MS - 4, 100 + st.z * MS - 4, 8, 8); g.fillStyle = '#fff'; g.font = 'bold 9px Segoe UI'; g.textAlign = 'center'; g.fillText('G', 100 + st.x * MS, 100 + st.z * MS + 3.5); });
  posts.forEach(b => { g.fillStyle = '#2f7bff'; g.beginPath(); g.moveTo(100 + b.x * MS, 100 + b.z * MS - 4); g.lineTo(100 + b.x * MS + 4, 100 + b.z * MS + 3); g.lineTo(100 + b.x * MS - 4, 100 + b.z * MS + 3); g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke(); });
  banks.forEach(b => { g.fillStyle = '#ffd54a'; g.fillRect(100 + b.x * MS - 3, 100 + b.z * MS - 3, 6, 6); g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(100 + b.x * MS - 3, 100 + b.z * MS - 3, 6, 6); });
  shops.forEach(sp2 => { g.fillStyle = sp2.type === 'firin' ? '#e0a860' : '#6bd18a'; g.beginPath(); g.arc(100 + sp2.x * MS, 100 + sp2.z * MS, 3, 0, 7); g.fill(); });
  zones.forEach(z => { g.fillStyle = z.kind === 'service' ? '#ff8a1f' : '#35b8ff'; g.fillRect(100 + z.x * MS - 9, 100 + z.z * MS - 9, 18, 18); g.fillStyle = '#111'; g.font = 'bold 12px Segoe UI'; g.textAlign = 'center'; g.fillText(z.kind === 'service' ? 'S' : 'P', 100 + z.x * MS, 100 + z.z * MS + 4); });
  miniBase = mc;
}
let miniBase = null;

/* ---------- Araç modelleri ---------- */
function blob(parent, l, w) {
  const m = new T.Mesh(new T.PlaneGeometry(l, w), new T.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; parent.add(m);
}
function wheelMesh(r, w, x, z) {
  const steer = new T.Group(), spin = new T.Group(), m = new T.Mesh(GC, mat('#15171c')); m.rotation.x = Math.PI / 2; m.scale.set(r, w, r);
  spin.add(m); steer.add(spin); steer.position.set(x, r, z);
  const hub = new T.Mesh(GC, mat('#9aa0ad')); hub.rotation.x = Math.PI / 2; hub.scale.set(r * 0.5, w * 1.05, r * 0.5); spin.add(hub);
  return { steer, spin };
}
function carMesh(color) {
  const g = new T.Group(), o = { g, haz: [], tail: null };
  bx(g, 4.4, 0.7, 1.9, color, 0, 0.78, 0); bx(g, 2.3, 0.7, 1.7, color, -0.2, 1.43, 0); bx(g, 2.32, 0.42, 1.72, '#18222e', -0.2, 1.45, 0); bx(g, 1.9, 0.08, 1.6, color, -0.2, 1.82, 0);
  bx(g, 4.5, 0.3, 1.95, '#22242a', 0, 0.45, 0);
  o.tail = basic(0x7a1010); o.head = basic(0x6b6550);
  [-0.65, 0.65].forEach(z => { bx(g, 0.1, 0.22, 0.4, o.tail, -2.2, 0.85, z); bx(g, 0.1, 0.22, 0.4, o.head, 2.2, 0.85, z); });
  [[-1.4, -0.95], [-1.4, 0.95], [1.4, -0.95], [1.4, 0.95]].forEach(w => { const wm = wheelMesh(0.38, 0.28, w[0], w[1]); g.add(wm.steer); });
  for (let i = 0; i < 4; i++) { const m = basic(0x3a2200); o.haz.push(m); bx(g, 0.18, 0.18, 0.18, m, i < 2 ? 2.25 : -2.25, 1.0, i % 2 ? 0.8 : -0.8); }
  blob(g, 6, 3); return o;
}
const CLS = {
  car: { len: 4.4, wid: 1.9, icon: '🚗', pay: 1, mass: 1 }, moto: { len: 2.0, wid: 0.75, icon: '🏍️', pay: 0.75, mass: 0.4 }, heavy: { len: 10.2, wid: 2.6, icon: '🚌', pay: 1.9, mass: 3 },
  machine: { len: 6.0, wid: 2.7, icon: '🚜', pay: 1.7, mass: 3 }, trailer: { len: 15.0, wid: 2.6, icon: '🚛', pay: 2.4, mass: 5 }
};
function baseMesh() { const g = new T.Group(); return { g, haz: [], tail: basic(0x7a1010), head: basic(0x6b6550) }; }
function hazards(o, x1, x2, y, zz) { for (let i = 0; i < 4; i++) { const m = basic(0x3a2200); o.haz.push(m); bx(o.g, 0.18, 0.18, 0.18, m, i < 2 ? x1 : x2, y, i % 2 ? zz : -zz); } }
function motoMesh(color) {
  const o = baseMesh(), g = o.g;
  [-0.7, 0.7].forEach(x => { const w = new T.Mesh(GC, mat('#15171c')); w.rotation.x = Math.PI / 2; w.scale.set(0.34, 0.12, 0.34); w.position.set(x, 0.34, 0); g.add(w); });
  bx(g, 1.3, 0.28, 0.32, color, 0, 0.62, 0); bx(g, 0.5, 0.2, 0.34, '#2a2a30', -0.35, 0.82, 0); bx(g, 0.34, 0.3, 0.34, color, 0.45, 0.85, 0);
  bx(g, 0.1, 0.1, 0.8, '#bbbbbb', 0.78, 1.1, 0); bx(g, 0.08, 0.5, 0.08, '#999999', 0.72, 0.75, 0); bx(g, 0.08, 0.1, 0.14, o.head, 0.84, 0.95, 0); bx(g, 0.08, 0.08, 0.2, o.tail, -0.78, 0.7, 0);
  const hz = basic(0x3a2200); o.haz.push(hz); bx(g, 0.1, 0.1, 0.1, hz, -0.7, 1.1, 0); blob(g, 3, 1.4); return o;
}
function busMesh(color) {
  const o = baseMesh(), g = o.g;
  bx(g, 10.2, 2.4, 2.5, color, 0, 1.85, 0); bx(g, 9.6, 0.85, 2.54, '#1b2a3a', 0, 2.45, 0); bx(g, 10.0, 0.14, 2.4, '#e8e8ea', 0, 3.1, 0); bx(g, 0.1, 1.2, 2.2, '#1b2a3a', 5.12, 2.3, 0); bx(g, 10.3, 0.25, 2.55, '#22242a', 0, 0.62, 0);
  [-0.9, 0.9].forEach(z => { bx(g, 0.1, 0.25, 0.4, o.tail, -5.12, 0.95, z); bx(g, 0.1, 0.25, 0.4, o.head, 5.12, 0.95, z); });
  [[3.4, -1.2], [3.4, 1.2], [-3.2, -1.2], [-3.2, 1.2]].forEach(w => g.add(wheelMesh(0.55, 0.4, w[0], w[1]).steer)); hazards(o, 5.15, -5.15, 1.6, 1.0); blob(g, 12, 3.4); return o;
}
function boxTruckMesh(color) {
  const o = baseMesh(), g = o.g;
  bx(g, 10.2, 0.4, 2.2, '#22242a', 0, 0.65, 0); bx(g, 7.6, 2.8, 2.5, '#eceef2', -1.3, 2.3, 0); bx(g, 7.62, 0.35, 2.52, color, -1.3, 1.3, 0); bx(g, 2.4, 2.0, 2.4, color, 3.9, 1.7, 0); bx(g, 0.1, 0.8, 2.0, '#1b2a3a', 5.12, 2.1, 0);
  [-0.9, 0.9].forEach(z => { bx(g, 0.1, 0.25, 0.4, o.tail, -5.12, 0.9, z); bx(g, 0.1, 0.25, 0.4, o.head, 5.12, 0.9, z); });
  [[3.9, -1.2], [3.9, 1.2], [-2.0, -1.2], [-2.0, 1.2], [-3.6, -1.2], [-3.6, 1.2]].forEach(w => g.add(wheelMesh(0.55, 0.4, w[0], w[1]).steer)); hazards(o, 5.15, -5.15, 1.5, 1.0); blob(g, 12, 3.4); return o;
}
function excavatorMesh() {
  const o = baseMesh(), g = o.g;
  [-1, 1].forEach(z => bx(g, 5.6, 0.9, 0.95, '#2a2c30', 0, 0.45, z * 0.9)); bx(g, 3.0, 1.1, 2.5, '#f2b01e', -0.6, 1.5, 0); bx(g, 1.4, 1.5, 1.5, '#f2b01e', 0.7, 2.3, -0.3); bx(g, 0.1, 0.9, 1.3, '#1b2a3a', 1.45, 2.4, -0.3);
  const boom = bx(g, 3.2, 0.45, 0.5, '#f2b01e', 2.4, 2.4, 0.5); boom.rotation.z = 0.5; const arm = bx(g, 2.4, 0.35, 0.4, '#e0a010', 3.9, 2.55, 0.5); arm.rotation.z = -0.9; bx(g, 0.9, 0.8, 1.2, '#444444', 4.7, 1.6, 0.5);
  const hz = basic(0x3a2200); o.haz.push(hz); bx(g, 0.2, 0.2, 0.2, hz, -1.9, 3.0, 0.9); blob(g, 7, 3.2); return o;
}
function trailerMesh(color) {
  const o = baseMesh(), g = o.g;
  bx(g, 15, 0.4, 2.3, '#22242a', 0, 0.75, 0); bx(g, 11.2, 3.3, 2.6, color, -1.8, 2.75, 0); bx(g, 11.22, 0.4, 2.62, '#222831', -1.8, 1.2, 0); bx(g, 2.4, 2.8, 2.5, '#c62828', 6.2, 2.0, 0); bx(g, 0.1, 1.0, 2.2, '#1b2a3a', 7.42, 2.6, 0);
  [-0.9, 0.9].forEach(z => { bx(g, 0.1, 0.25, 0.4, o.tail, -7.42, 1.0, z); bx(g, 0.1, 0.25, 0.4, o.head, 7.42, 1.0, z); });
  [[6.2, -1.2], [6.2, 1.2], [4.4, -1.2], [4.4, 1.2], [-4.8, -1.2], [-4.8, 1.2], [-6.2, -1.2], [-6.2, 1.2]].forEach(w => g.add(wheelMesh(0.55, 0.4, w[0], w[1]).steer)); hazards(o, 7.45, -7.45, 1.7, 1.0); blob(g, 17, 3.6); return o;
}
function forkliftMesh() {
  const o = baseMesh(), g = o.g; o.len = 4.0; o.wid = 1.8;
  bx(g, 2.4, 1.0, 1.6, '#f2b01e', -0.4, 1.0, 0); bx(g, 0.9, 0.9, 1.6, '#2a2c30', -1.55, 1.0, 0); [[-0.9, -0.7], [-0.9, 0.7], [0.4, -0.7], [0.4, 0.7]].forEach(q => bx(g, 0.1, 1.4, 0.1, '#333333', q[0], 2.0, q[1])); bx(g, 1.5, 0.1, 1.6, '#333333', -0.25, 2.72, 0);
  bx(g, 0.7, 0.6, 0.9, '#22262e', -0.5, 1.7, 0); [-0.55, 0.55].forEach(z => bx(g, 0.18, 3.0, 0.14, '#444444', 1.2, 1.7, z)); [-0.45, 0.45].forEach(z => bx(g, 1.3, 0.1, 0.2, '#999999', 1.85, 0.35, z)); bx(g, 0.2, 0.9, 1.5, '#555555', 1.2, 0.8, 0);
  [[-1.1, -0.85], [-1.1, 0.85], [0.6, -0.85], [0.6, 0.85]].forEach(w => g.add(wheelMesh(0.42, 0.3, w[0], w[1]).steer));
  const hz = basic(0x3a2200); o.haz.push(hz); bx(g, 0.2, 0.2, 0.2, hz, -0.4, 2.85, 0); blob(g, 5.4, 2.8); return o;
}
function loaderMesh() {
  const o = baseMesh(), g = o.g; o.len = 7.0; o.wid = 2.7;
  bx(g, 2.8, 1.5, 2.4, '#f2b01e', -1.7, 1.55, 0); bx(g, 1.7, 2.0, 2.1, '#f2b01e', -0.3, 2.3, 0); bx(g, 0.1, 1.0, 1.8, '#1b2a3a', 0.58, 2.5, 0); bx(g, 1.9, 0.12, 2.2, '#2a2c30', -0.3, 3.35, 0); bx(g, 0.9, 0.9, 2.0, '#2a2c30', -3.1, 1.2, 0);
  [-1.15, 1.15].forEach(z => { const arm = bx(g, 3.4, 0.38, 0.4, '#e0a010', 1.7, 1.7, z); arm.rotation.z = -0.12; }); bx(g, 1.0, 1.0, 3.0, '#444444', 3.5, 1.0, 0); bx(g, 0.2, 0.5, 3.0, '#555555', 4.0, 1.55, 0);
  [[-1.9, -1.35], [-1.9, 1.35], [1.0, -1.35], [1.0, 1.35]].forEach(w => g.add(wheelMesh(0.9, 0.7, w[0], w[1]).steer));
  const hz = basic(0x3a2200); o.haz.push(hz); bx(g, 0.2, 0.2, 0.2, hz, -0.3, 3.5, 0); blob(g, 8.4, 3.4); return o;
}
function vehMesh(cls, color) {
  if (cls === 'moto') return motoMesh(color);
  if (cls === 'heavy') return Math.random() < 0.5 ? busMesh(color) : boxTruckMesh(color);
  if (cls === 'machine') { const r = Math.random(); return r < 0.5 ? excavatorMesh() : r < 0.75 ? forkliftMesh() : loaderMesh(); }
  if (cls === 'trailer') return trailerMesh(pick(['#e8e8ea', '#2f7fd6', '#e0782c']));
  return carMesh(color);
}
function buildTruck(spec) {
  spec = spec || TRUCKS[0];
  const g = new T.Group(), o = { g, front: [], spin: [] }, Y = spec.color, A = spec.accent, D = '#23252b', v = spec.variant || 'winch', L = spec.len || 6.4, cxm = 3.2 - L / 2, heavyLike = v === 'heavy' || v === 'rotator';
  bx(g, L, 0.55, 2.3, D, cxm, 0.95, 0); bx(g, 2.2, 1.7, 2.3, Y, 1.9, 2.05, 0); bx(g, 0.06, 0.8, 2.0, '#1d3042', 3.02, 2.3, 0);
  bx(g, 1.2, 0.7, 2.34, '#1d3042', 1.7, 2.35, 0); bx(g, 0.5, 0.5, 2.5, '#c8ccd4', 3.3, 0.8, 0); bx(g, 0.2, 0.5, 1.5, '#555a66', 3.15, 1.35, 0);
  const deck = (len, xc, y, w) => { bx(g, len, 0.28, w || 2.4, '#2c2f36', xc, y, 0); [-1, 1].forEach(sd => bx(g, len, 0.18, 0.12, A, xc, y + 0.17, sd * ((w || 2.4) / 2 - 0.1))); };
  const ramp = (x, y, ang, w) => { const r = bx(g, 2.0, 0.12, w || 2.3, '#3a3d46', x, y, 0); r.rotation.z = ang; };
  const boom = (th, col) => { const b = bx(g, th, 3.0, th, col, -2.62, 2.9, 0); b.rotation.z = 0.58; bx(g, 0.5, 0.4, 0.5, '#999999', -3.45, 4.2, 0); };
  if (v === 'slide') { deck(4.8, -1.5, 1.4); bx(g, 0.25, 0.3, 2.4, A, -3.95, 1.5, 0); ramp(-4.8, 1.25, 0.42); [-1.0, 1.0].forEach(z => bx(g, 0.3, 0.9, 0.3, '#888888', -0.3, 1.8, z)); bx(g, 0.4, 1.7, 2.3, '#3a3d46', 0.6, 2.2, 0); }
  else if (v === 'winch') { deck(3.7, -1.2, 1.4); bx(g, 0.3, 0.2, 2.4, A, -3.05, 1.5, 0); bx(g, 1.5, 0.9, 1.6, '#3a3d46', -0.6, 1.9, 0); boom(0.3, '#d9d9df'); bx(g, 0.5, 1.4, 0.3, '#333333', -1.7, 1.9, 0.8); }
  else if (heavyLike) {
    deck(3.7, -1.2, 1.4); bx(g, 0.3, 0.2, 2.4, A, -3.05, 1.5, 0); bx(g, 1.5, 0.9, 1.6, '#3a3d46', -0.6, 1.9, 0); boom(0.5, A); bx(g, 1.4, 1.2, 2.0, '#444a55', -2.6, 2.1, 0); bx(g, 0.6, 1.0, 0.6, A, -1.2, 2.3, -0.7);
    if (v === 'rotator') { const tt = new T.Mesh(GC, mat('#555a66')); tt.scale.set(1.3, 0.35, 1.3); tt.position.set(-1.3, 1.75, 0); g.add(tt); [-1, 1].forEach(sd => { bx(g, 0.35, 0.3, 1.6, '#666666', -2.0, 0.9, sd * 2.0); bx(g, 0.9, 0.12, 0.9, '#222222', -2.0, 0.1, sd * 2.7); }); }
  }
  else if (v === 'lift') { deck(3.0, -1.5, 1.4); bx(g, 2.4, 0.38, 0.45, A, -4.4, 1.4, 0); bx(g, 0.3, 0.3, 2.2, '#9aa0ad', -5.5, 1.1, 0); [-0.9, 0.9].forEach(z => bx(g, 0.6, 0.14, 0.5, '#444444', -5.5, 0.82, z)); const cy = bx(g, 0.2, 1.2, 0.2, '#aaaaaa', -3.7, 2.0, 0); cy.rotation.z = 0.7; }
  else if (v === 'under') { deck(3.0, -1.5, 1.4); bx(g, 3.2, 0.5, 0.5, '#cfd3da', -4.8, 1.05, 0); bx(g, 0.4, 0.4, 2.3, '#9aa0ad', -6.3, 1.0, 0); [-0.8, 0.8].forEach(z => bx(g, 0.9, 0.3, 0.45, '#444444', -6.3, 1.25, z)); }
  else if (v === 'octopus') {
    deck(4.8, -1.5, 1.4); bx(g, 0.25, 0.3, 2.4, A, -3.95, 1.5, 0); ramp(-4.8, 1.25, 0.42); bx(g, 2.22, 0.32, 2.32, '#16181d', 1.9, 1.45, 0); bx(g, 2.3, 0.18, 2.36, '#16181d', 1.9, 2.95, 0);
    for (let i = 0; i < 9; i++) [-1, 1].forEach(sd => bx(g, 0.5, 0.14, 0.14, i % 2 ? '#d62a22' : '#f4f4f6', -3.7 + i * 0.5, 1.98, sd * 1.1));
    bx(g, 0.5, 2.6, 0.55, '#f4f4f6', 0.45, 2.7, -0.8); bx(g, 0.4, 0.7, 0.4, '#3a3d46', 0.45, 1.5, -0.8);
    const b1 = bx(g, 3.6, 0.38, 0.42, '#f4f4f6', -1.3, 4.6, -0.8); b1.rotation.z = -0.05; bx(g, 2.6, 0.28, 0.3, '#cfd3da', -3.5, 4.55, -0.8);
    const b2 = bx(g, 1.7, 0.26, 0.28, '#e8e8ec', 0.5, 4.2, -0.8); b2.rotation.z = 0.9; bx(g, 0.08, 1.9, 0.08, '#222222', -4.9, 3.6, -0.8); bx(g, 0.3, 0.3, 0.3, '#999999', -4.9, 2.6, -0.8);
    bx(g, 0.35, 1.6, 0.18, '#d62a22', 0.1, 2.2, 1.0); bx(g, 0.35, 1.6, 0.18, '#f4f4f6', 0.1, 2.2, 1.0);
  }
  else if (v === 'moto') { deck(3.6, -1.4, 1.4); [-1, 1].forEach(sd => bx(g, 3.6, 0.45, 0.08, A, -1.4, 1.75, sd * 1.18)); bx(g, 0.1, 0.5, 2.4, A, -3.2, 1.7, 0); ramp(-4.3, 1.2, 0.4); }
  else if (v === 'machine') { deck(7.4, -4.6, 1.0, 2.8); bx(g, 0.5, 0.5, 2.4, A, -8.4, 1.15, 0); ramp(-9.4, 0.8, 0.3, 2.6); bx(g, 1.4, 0.9, 2.0, '#3a3d46', -0.4, 1.5, 0); }
  else if (v === 'multi') { deck(13.8, -6.7, 1.4); for (let i = 0; i < 7; i++) [-1, 1].forEach(sd => bx(g, 0.12, 0.8, 0.12, A, 0.2 - i * 2.2, 1.9, sd * 1.15)); ramp(-14.5, 1.2, 0.4); bx(g, 0.2, 1.4, 2.4, A, 0.5, 2.0, 0); }
  else if (v === 'double') { deck(9.8, -4.7, 1.4); [0.3, -9.2].forEach(x => [-1.2, 1.2].forEach(z => bx(g, 0.22, 2.4, 0.22, '#9aa0ad', x, 2.6, z))); deck(9.6, -4.5, 3.55); ramp(-10.4, 2.3, 0.5); bx(g, 0.2, 1.2, 2.4, A, 0.5, 4.2, 0); }
  o.lbA = basic(0xffae00); o.lbB = basic(0x553300); bx(g, 0.5, 0.18, 0.9, o.lbA, 1.9, 3.0, -0.5); bx(g, 0.5, 0.18, 0.9, o.lbB, 1.9, 3.0, 0.5);
  o.tail = basic(0x7a1010); o.head = basic(0xfff2c0); const rx = 3.2 - L - 0.05;
  [-0.9, 0.9].forEach(z => { bx(g, 0.12, 0.28, 0.5, o.tail, rx, 1.0, z); bx(g, 0.12, 0.3, 0.45, o.head, 3.56, 1.25, z); });
  [-1.0, 1.0].forEach(z => { bx(g, 0.18, 1.6, 0.18, '#777777', 1.0, 3.0, z * 1.05); });
  const wl = [[2.4, -1.15, 1], [2.4, 1.15, 1], [-0.4, -1.15, 0], [-0.4, 1.15, 0], [-1.8, -1.15, 0], [-1.8, 1.15, 0]];
  const extra = heavyLike ? [-3.0] : v === 'multi' ? [-10.8, -12.2] : v === 'double' ? [-7.6, -9.0] : v === 'machine' ? [-6.0, -7.4, -8.8] : [];
  extra.forEach(x => wl.push([x, -1.15, 0], [x, 1.15, 0]));
  wl.forEach(w => { const wm = wheelMesh(0.62, 0.5, w[0], w[1]); g.add(wm.steer); o.spin.push(wm.spin); if (w[2]) o.front.push(wm.steer); });
  const sideTxt = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = A; x.fillRect(0, 0, 512, 128); x.fillStyle = (A === '#ffffff' || A === '#f4f4f6' || A === '#cfd8e8') ? '#103a8a' : '#111111'; x.font = 'bold ' + (spec.label.length > 11 ? 56 : 78) + 'px "Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(spec.label, 256, 68); return new T.CanvasTexture(c); })();
  const tx = L > 7 ? cxm : -1.2;
  [[1.21, 0], [-1.21, Math.PI]].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(3.2, 0.7), new T.MeshBasicMaterial({ map: sideTxt })); p.position.set(tx, 1.1, q[0]); p.rotation.y = q[1]; g.add(p); });
  const a = new T.Group(), am = new T.MeshBasicMaterial({ color: 0xffe14a }), head = new T.Mesh(new T.ConeGeometry(0.55, 2.4, 4), am); head.rotation.z = -Math.PI / 2; a.add(head); a.position.set(1.9, 5.3, 0); g.add(a); o.arrow = a;
  o.spots = [-0.8, 0.8].map(z => { const sp = new T.SpotLight(0xfff0d0, 1.5, 90, 0.55, 0.6, 1.2); sp.position.set(3.3, 1.3, z); sp.target.position.set(30, 0, z); g.add(sp); g.add(sp.target); return sp; });
  const bl = new T.Mesh(new T.PlaneGeometry(L + 3, 4.5), new T.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })); bl.rotation.x = -Math.PI / 2; bl.position.set(cxm, 0.06, 0); g.add(bl);
  return o;
}
const groundArrow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128); g.scale(2.4, 2.4);
  g.beginPath(); g.moveTo(0, -46); g.lineTo(36, 4); g.lineTo(13, 4); g.lineTo(13, 42); g.lineTo(-13, 42); g.lineTo(-13, 4); g.lineTo(-36, 4); g.closePath();
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#111'; g.stroke(); g.fillStyle = '#ffe14a'; g.fill();
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false })); sp.renderOrder = 999; sp.visible = false; scene.add(sp); return sp;
})();
const arrowLabel = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = 999; sp.visible = false; sp.userData = { c, key: '' }; scene.add(sp); return sp;
})();
function setArrowLabel(text, color) {
  const u = arrowLabel.userData, key = text + color; if (u.key === key) return; u.key = key;
  const g = u.c.getContext('2d'); g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(10,12,20,.86)'; g.beginPath(); if (g.roundRect) g.roundRect(6, 10, 500, 108, 26); else g.rect(6, 10, 500, 108); g.fill();
  g.lineWidth = 8; g.strokeStyle = color; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 60px "Segoe UI","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66); arrowLabel.material.map.needsUpdate = true;
}
const ropeMesh = new T.Mesh(GC, mat('#1a1a1a')), hookMesh = new T.Mesh(GB, mat('#c9c9d0'));
function setRope(ax, ay, az, bx_, by, bz) {
  const dx = bx_ - ax, dy = by - ay, dz = bz - az, l = Math.hypot(dx, dy, dz) || 0.01;
  ropeMesh.position.set((ax + bx_) / 2, (ay + by) / 2, (az + bz) / 2); ropeMesh.scale.set(0.06, l, 0.06);
  ropeMesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / l, dy / l, dz / l)); hookMesh.position.set(bx_, by, bz); hookMesh.scale.set(0.3, 0.3, 0.3);
}

/* ---------- Parçacıklar ---------- */
const parts = [];
for (let i = 0; i < 260; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); parts.push({ s, life: 0 }); }
function emit(x, y, z, vx, vy, vz, life, size, color, grow, grav, add) {
  const p = parts.find(p => p.life <= 0); if (!p) return;
  Object.assign(p, { life, max: life, vx, vy, vz, size, grow: grow || 0, grav: grav || 0 }); p.s.material.color.setHex(color); p.s.material.blending = add ? T.AdditiveBlending : T.NormalBlending;
  p.s.position.set(x, y, z); p.s.visible = true;
}
function stepParts(dt) {
  for (const p of parts) if (p.life > 0) {
    p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
    p.vy -= p.grav * dt; p.s.position.x += p.vx * dt; p.s.position.y = Math.max(0.1, p.s.position.y + p.vy * dt); p.s.position.z += p.vz * dt;
    const k = p.life / p.max, sz = p.size * (1 + p.grow * (1 - k)); p.s.scale.set(sz, sz, 1); p.s.material.opacity = Math.min(1, k * 1.6) * 0.8;
  }
}
const sparks = (x, y, z, n, col) => { for (let i = 0; i < n; i++) emit(x, y, z, rnd(-5, 5), rnd(1, 6), rnd(-5, 5), rnd(0.3, 0.7), 0.45, col || 0xffc040, 0, 14, true); };

/* ---------- Çarpışma yardımcıları ---------- */
const sp = { dx: 0, dz: 0, nx: 0, nz: 0, hit: false };
function staticPush(x, z, r) {
  sp.hit = false; sp.dx = 0; sp.dz = 0;
  for (const b of boxes) {
    if (x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) continue;
    const qx = clamp(x, b.x0, b.x1), qz = clamp(z, b.z0, b.z1), ex = x - qx, ez = z - qz, d2 = ex * ex + ez * ez;
    if (d2 >= r * r) continue;
    let nx, nz, pen; const d = Math.sqrt(d2);
    if (d > 1e-4) { nx = ex / d; nz = ez / d; pen = r - d; }
    else { const l = x - b.x0, rr = b.x1 - x, t = z - b.z0, bt = b.z1 - z, m = Math.min(l, rr, t, bt); if (m === l) { nx = -1; nz = 0; pen = l + r; } else if (m === rr) { nx = 1; nz = 0; pen = rr + r; } else if (m === t) { nx = 0; nz = -1; pen = t + r; } else { nx = 0; nz = 1; pen = bt + r; } }
    sp.dx += nx * pen; sp.dz += nz * pen; sp.nx = nx; sp.nz = nz; sp.hit = true; x += nx * pen; z += nz * pen;
  }
  for (const t of trees) {
    const ex = x - t.x, ez = z - t.z, rr = r + t.r; if (ex > rr || ex < -rr || ez > rr || ez < -rr) continue; const d2 = ex * ex + ez * ez; if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1e-3, nx = ex / d, nz = ez / d, pen = rr - d; sp.dx += nx * pen; sp.dz += nz * pen; sp.nx = nx; sp.nz = nz; sp.hit = true; x += nx * pen; z += nz * pen;
  }
  return sp;
}

/* ---------- Varlıklar ---------- */
const truck = {
  kind: 'truck', x: -20, z: LANE, h: 0, vx: 0, vz: 0, steer: 0, turbo: 100, turboOn: false, loads: [], mass: 3, towed: false, crashCd: 0, drift: 0, scale: 1, hookOff: HOOK_OFF, circ: [2.1, 0, -2.1], rad: 1.35, mode: 'rope',
  get towJob() { return this.loads[0] || null; },
  set towJob(v) { if (!v) this.loads.length = 0; else if (!this.loads.includes(v)) this.loads.push(v); },
  circles() {
    const c = Math.cos(this.h), s = Math.sin(this.h), k = this.scale || 1, out = this.circ.map(o => ({ x: this.x + c * o * k, z: this.z + s * o * k, r: this.rad * k }));
    if (this.mode === 'lift') for (const J of this.loads) for (const q of J.car.circles()) out.push(q);
    return out;
  }
};
const hookPoint = () => ({ x: truck.x - Math.cos(truck.h) * truck.hookOff, z: truck.z - Math.sin(truck.h) * truck.hookOff });
let TM = buildTruck(TRUCKS[0]); scene.add(TM.g);
function applyTruck() {
  const sp = curSpec(); scene.remove(TM.g); TM = buildTruck(sp); TM.g.scale.setScalar(sp.scale); scene.add(TM.g);
  truck.loads.length = 0; Object.assign(truck, { scale: sp.scale, mass: sp.mass, hookOff: sp.hookOff, circ: sp.circ, rad: sp.rad, mode: sp.mode });
}
scene.add(ropeMesh); scene.add(hookMesh);

class Veh {
  constructor(kind, color, cls) {
    this.kind = kind; this.x = 0; this.z = 0; this.h = 0; this.flip = 0; this.vx = 0; this.vz = 0; this.towed = false; this.cls = cls || 'car';
    const C = CLS[this.cls]; this.len = C.len; this.wid = C.wid; this.half = C.len / 2; this.body = C.len * 0.82; this.mass = (kind === 'ai' ? 1.5 : 1.2) * C.mass;
    this.cm = vehMesh(this.cls, color); this.mesh = this.cm.g; if (this.cm.len) { this.len = this.cm.len; this.half = this.len / 2; this.body = this.len * 0.82; } if (this.cm.wid) this.wid = this.cm.wid; scene.add(this.mesh); this.job = null; this.smokeT = 0;
  }
  circles() {
    const r = this.wid * 0.57, n = Math.max(2, Math.round(this.len / 2.2)), c = Math.cos(this.h), s = Math.sin(this.h), span = this.len / 2 - r, out = [];
    for (let i = 0; i < n; i++) { const o = -span + 2 * span * i / (n - 1); out.push({ x: this.x + c * o, z: this.z + s * o, r }); }
    return out;
  }
  sync() { this.mesh.position.set(this.x, this.yoff || 0, this.z); this.mesh.rotation.y = -(this.h + this.flip * Math.PI); }
}
function shiftV(v, dx, dz) { if (v.towed) { v.F.x += dx; v.F.z += dz; v.Rr.x += dx; v.Rr.z += dz; } v.x += dx; v.z += dz; }

const CAR_COLORS = ['#d63b3b', '#2f7fd6', '#e8c130', '#2fb36a', '#8e4fc9', '#e8e8ea', '#e0782c', '#1fb5a6', '#333640'];
const wrecks = [], allObjs = [];
const ais = []; for (let i = 0; i < NTRAF; i++) { const v = new Veh('ai', pick(CAR_COLORS)); v.cm.tail.color.setHex(0xaa1818); v.cm.head.color.setHex(0xfff2c0); ais.push(v); }
const laneCoord = (axis, line, d) => axis === 'x' ? line + LANE * d : line - LANE * d;
for (let i = 0; i < 4; i++) ais.push(makeCargo('ai', i < 1));
for (let i = 0; i < 6; i++) { const v = i < 2 ? makePolice('ai') : i < 4 ? makeAmbulance('ai') : makeFireTruck('ai'); v.emerg = true; ais.push(v); }
function placeAI(v) {
  for (let t = 0; t < 40; t++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z', line = rc(Math.random() * NR | 0), d = Math.random() < 0.5 ? 1 : -1, s = rnd(-HALF + 20, HALF - 20);
    if (Math.abs(s - Math.round(s / P) * P) < 20) continue;
    const lc = laneCoord(axis, line, d); v.axis = axis; v.line = line; v.d = d; v.x = axis === 'x' ? s : lc; v.z = axis === 'x' ? lc : s;
    v.h = axis === 'x' ? (d > 0 ? 0 : Math.PI) : (d > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (Math.hypot(v.x - truck.x, v.z - truck.z) > 40) break;
  }
  v.failing = false; v.stall = 0; v.speed = rnd(8, 12); v.vmax = v.speed; if (v.emerg) { v.vmax = rnd(13, 16); v.speed = v.vmax; } v.decided = null; v.vx = Math.cos(v.h) * v.speed; v.vz = Math.sin(v.h) * v.speed;
}
function updateAI(v, dt) {
  const al = v.axis === 'x', s = al ? v.x : v.z, lc = laneCoord(v.axis, v.line, v.d), look = 10 + v.speed * 0.5;
  // kavşak kararı
  const k = Math.ceil(s * v.d / P - 1e-6) * v.d, ic = k * P, key = v.axis + k + v.line;
  if (Math.abs(ic - s) < 9 && v.decided !== key && Math.abs(k) <= CEN) {
    v.decided = key; const opts = [];
    if (Math.abs(k + v.d) <= CEN) opts.push(['s', 3]);
    const crossPos = al ? v.line : v.line;           // çapraz yoldaki konum, sınırda kalınmalı
    [1, -1].forEach(nd => { const lim = Math.abs(crossPos + 0) >= HALF - 1 && Math.sign(crossPos) === nd; if (!lim) opts.push([nd, 1]); });
    const tot = opts.reduce((a, o) => a + o[1], 0); let r = Math.random() * tot, ch = opts[0];
    for (const o of opts) { r -= o[1]; if (r <= 0) { ch = o; break; } }
    if (ch[0] !== 's') { const nl = ic, nd = ch[0]; v.axis = al ? 'z' : 'x'; v.line = nl; v.d = nd; v.decided = null; }
  }
  const lane2 = laneCoord(v.axis, v.line, v.d), al2 = v.axis === 'x';
  const tx = al2 ? v.x + v.d * look : lane2, tz = al2 ? lane2 : v.z + v.d * look;
  const want = Math.atan2(tz - v.z, tx - v.x), dh = angDiff(v.h, want); v.h += clamp(dh, -2.2 * dt, 2.2 * dt);
  // engel
  let tgt = v.vmax * (Math.abs(dh) > 0.5 ? 0.55 : 1), obs = false; const fx = Math.cos(v.h), fz = Math.sin(v.h), ahead = 5 + v.speed * 0.9;
  const others = [truck, ...ais, ...(freeCars())];
  for (const o of others) {
    if (o === v) continue; const dx = o.x - v.x, dz = o.z - v.z, f = dx * fx + dz * fz, l = Math.abs(-dx * fz + dz * fx);
    if (f > 0 && f < ahead + 3 && l < 2.6) { const t2 = Math.max(0, (f - 6) * 1.2); if (t2 < 1) obs = true; tgt = Math.min(tgt, t2); }
  }
  v.stall = (v.stall || 0) + ((v.speed < 0.4 && obs) ? dt : -dt * 2); if (v.stall < 0) v.stall = 0;
  if (v.stall > 3) { v.stall = 0; v.d = -v.d; v.h += Math.PI; v.speed = 0; v.decided = null; return; }
  { const dist = (ic - s) * v.d, st = sigState(v.axis);
    const lit = al ? isLit(k + CEN, Math.round(v.line / P) + CEN) : isLit(Math.round(v.line / P) + CEN, k + CEN);
    if (!v.emerg && lit && Math.abs(k) <= CEN && dist > 3 && dist < 45) { const gap = dist - 16, brake = v.speed * v.speed / 14;
      if (gap > -0.5 && (st === 'r' || (st === 'y' && gap > brake))) tgt = Math.min(tgt, Math.max(0, gap) * 0.9); } }
  if (v.failing) tgt = 0;
  v.speed += clamp(tgt - v.speed, -(v.failing ? 3.2 : 14) * dt, 5 * dt); v.vx = fx * v.speed; v.vz = fz * v.speed; v.x += v.vx * dt; v.z += v.vz * dt;
  v.x = clamp(v.x, -HALF - 4, HALF + 4); v.z = clamp(v.z, -HALF - 4, HALF + 4);
}

/* Çağrılar */
let jobs = [], jobSeq = 1, spawnQ = [];
const freeCars = () => [...jobs.filter(j => j.state === 'waiting' || j.state === 'dropped').map(j => j.car), ...wrecks];
class Cone { constructor() { this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.tilt = 0; this.on = false; } }
const cones = Array.from({ length: 320 }, () => new Cone());
const coneMesh = new T.InstancedMesh(new T.ConeGeometry(0.32, 0.9, 8), new T.MeshLambertMaterial({ color: 0xff6a1a }), cones.length);
coneMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); coneMesh.frustumCulled = false; scene.add(coneMesh);
function addCone(x, z) { const c = cones.find(c => !c.on); if (c) { c.on = true; c.x = x; c.z = z; c.vx = c.vz = 0; c.tilt = 0; } }
function scatterCones() {
  cones.forEach(c => c.on = false);
  for (let g = 0; g < 11; g++) { const horiz = Math.random() < 0.5, line = rc(Math.random() * NR | 0), s0 = rnd(-HALF + 30, HALF - 60), side = Math.random() < 0.5 ? 1 : -1; for (let i = 0; i < 6; i++) { const s = s0 + i * 3; if (Math.abs(s - Math.round(s / P) * P) < 14) continue; addCone(horiz ? s : line + side * 6.5, horiz ? line + side * 6.5 : s); } }
}

/* ---------- Yayalar ---------- */
const SKIN = ['#f0c8a0', '#d9a577', '#a9714a', '#6e4a32'], CLOTH = ['#d94b4b', '#3f7fd9', '#e0b43a', '#4fb36c', '#9a5bd1', '#eeeeee', '#e0803a', '#1fb5a6', '#333640', '#c0568f'];
function makePed3() {
  const g = new T.Group(), shirt = pick(CLOTH), pants = pick(['#2b3040', '#4a4f5a', '#5a4636', '#23252b']);
  bx(g, 0.5, 0.7, 0.3, shirt, 0, 1.2, 0); bx(g, 0.3, 0.3, 0.3, pick(SKIN), 0, 1.72, 0); bx(g, 0.32, 0.12, 0.32, pick(['#222', '#5a3a1a', '#c9a050', '#111']), 0, 1.93, 0);
  const limb = (w, h, d, col, y, z) => { const p = new T.Group(); p.position.set(0, y, z); bx(p, w, h, d, col, 0, -h / 2, 0); g.add(p); return p; };
  g.userData = { legL: limb(0.2, 0.85, 0.2, pants, 0.85, -0.13), legR: limb(0.2, 0.85, 0.2, pants, 0.85, 0.13), armL: limb(0.15, 0.7, 0.15, shirt, 1.5, -0.33), armR: limb(0.15, 0.7, 0.15, shirt, 1.5, 0.33) };
  scene.add(g); return g;
}
const PH = 21.3, PL = 8 * PH, peds = [];
function pedPerim(u) { u = ((u % PL) + PL) % PL; const s2 = 2 * PH; if (u < s2) return [-PH + u, -PH, 0]; u -= s2; if (u < s2) return [PH, -PH + u, Math.PI / 2]; u -= s2; if (u < s2) return [PH - u, PH, Math.PI]; u -= s2; return [-PH, PH - u, -Math.PI / 2]; }
for (let i = 0; i < 90; i++) peds.push({ g: makePed3(), cx: 0, cz: 0, u: 0, dir: 1, sp: 1.3, ph: rnd(0, 6), lat: rnd(-0.5, 0.2), state: 'walk', t: 0, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, hd: 0 });
function resetPeds() {
  peds.forEach(p => { p.cx = bc(Math.floor(Math.random() * NB)); p.cz = bc(Math.floor(Math.random() * NB)); p.u = rnd(0, PL); p.dir = Math.random() < 0.5 ? 1 : -1; p.sp = rnd(1.0, 1.7); p.state = 'walk'; p.y = 0; p.g.rotation.z = 0; });
}
let pedCd = 0;
function stepPeds(dt) {
  const tsp = Math.hypot(truck.vx, truck.vz); pedCd -= dt;
  for (const p of peds) {
    const g = p.g, u = g.userData;
    if (p.state === 'walk') {
      const q = pedPerim(p.u), a = q[2], rx = -Math.sin(a), rz = Math.cos(a);
      p.x = p.cx + q[0] + rx * p.lat; p.z = p.cz + q[1] + rz * p.lat; p.hd = a + (p.dir < 0 ? Math.PI : 0);
      if (Math.abs(p.x - truck.x) < 40 && Math.abs(p.z - truck.z) < 40) {
        const dx = p.x - truck.x, dz = p.z - truck.z, d = Math.hypot(dx, dz); let sp2 = p.sp, run = false;
        if (d < 16 && tsp > 5) { p.dir = (dx * Math.cos(a) + dz * Math.sin(a)) >= 0 ? 1 : -1; sp2 = 4.8; run = true; }
        p.u += p.dir * sp2 * dt; p.run = run;
        if (tsp > 3 && pedCd <= 0) for (const c of truck.circles()) if (Math.hypot(c.x - p.x, c.z - p.z) < c.r + 0.45) {
          p.state = 'hit'; p.t = 3; p.vx = truck.vx * 0.7 + rnd(-1, 1); p.vz = truck.vz * 0.7 + rnd(-1, 1); p.vy = 5 + tsp * 0.15; p.y = 0;
          pedCd = 1.2; shift.crashes++; shift.money = Math.max(0, shift.money - 50); save.money = Math.max(0, save.money - 50);
          toast('🚶💥 Yayaya çarptın!  -$50', 'bad'); noiseBurst(0.2, 0.15); shake = Math.max(shake, 0.5); break;
        }
      } else { p.u += p.dir * p.sp * dt; p.run = false; }
      const sw = Math.sin(time * (p.run ? 14 : 6) + p.ph) * (p.run ? 0.95 : 0.6);
      u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.armL.rotation.z = -sw; u.armR.rotation.z = sw; g.rotation.z = 0;
    } else {
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= 22 * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.vx *= Math.exp(-4 * dt); p.vz *= Math.exp(-4 * dt); }
      p.t -= dt; g.rotation.z = lerp(g.rotation.z, p.t > 0.6 ? Math.PI / 2 : 0, Math.min(1, dt * 8));
      if (p.t <= 0) { p.state = 'walk'; g.rotation.z = 0; }
    }
    g.position.set(p.x, 0.25 + p.y, p.z); g.rotation.y = -p.hd; g.visible = Math.abs(p.x - truck.x) < 150 && Math.abs(p.z - truck.z) < 150;
  }
  for (const j of jobs) if (j.ped && j.state === 'waiting') { const w = j.ped.userData; w.armR.rotation.x = Math.PI * 0.88 + Math.sin(time * 9) * 0.35; w.armL.rotation.z = 0.05; }
}

/* ---------- Kaza sahneleri ---------- */
function makePolice(kind) {
  const v = new Veh(kind || 'wreck', '#f2f4f8'); v.mass = 2; v.police = true; const g = v.mesh;
  bx(g, 4.45, 0.3, 1.95, '#1a2230', 0, 0.78, 0); bx(g, 1.2, 0.08, 1.7, '#1a2230', -0.2, 1.84, 0);
  v.pl = { a: basic(0xff2020), b: basic(0x2060ff) }; bx(g, 0.35, 0.16, 0.7, v.pl.a, -0.2, 1.98, -0.45); bx(g, 0.35, 0.16, 0.7, v.pl.b, -0.2, 1.98, 0.45);
  return v;
}
function makeAmbulance(kind) {
  const v = new Veh(kind || 'wreck', '#f6f6f8'); v.mass = 2.2; v.ambulance = true; const g = v.mesh;
  bx(g, 3.0, 1.15, 1.95, '#f6f6f8', -0.7, 1.55, 0); bx(g, 3.02, 0.22, 1.97, '#d8262b', -0.7, 1.2, 0);
  [-1, 1].forEach(sd => { bx(g, 0.9, 0.28, 0.04, '#e0242a', -0.9, 1.72, sd * 0.99); bx(g, 0.28, 0.9, 0.04, '#e0242a', -0.9, 1.72, sd * 0.99); });
  bx(g, 0.1, 0.5, 1.7, '#18222e', 0.62, 1.6, 0);
  v.pl = { a: basic(0xff2020), b: basic(0x2060ff) }; bx(g, 0.35, 0.18, 0.7, v.pl.a, 0.4, 2.2, -0.45); bx(g, 0.35, 0.18, 0.7, v.pl.b, 0.4, 2.2, 0.45);
  return v;
}
function makeFireTruck(kind) {
  const v = new Veh(kind || 'wreck', '#d62a22'); v.mass = 3; v.fireTruck = true; const g = v.mesh;
  bx(g, 3.2, 1.55, 2.0, '#d62a22', -0.95, 1.75, 0); bx(g, 3.22, 0.14, 2.02, '#f4f4f6', -0.95, 1.3, 0);
  [-0.5, 0.5].forEach(z => { bx(g, 3.4, 0.1, 0.1, '#cfd3da', -0.95, 2.66, z); }); for (let i = 0; i < 8; i++) bx(g, 0.08, 0.08, 1.1, '#cfd3da', -2.4 + i * 0.4, 2.66, 0);
  bx(g, 0.1, 0.5, 1.7, '#18222e', 0.62, 1.6, 0); bx(g, 0.5, 0.5, 0.5, '#9aa0ad', -2.5, 1.2, 0);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#d62a22'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = 'bold 44px "Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('İTFAİYE', 128, 34);
  const tm = new T.MeshBasicMaterial({ map: new T.CanvasTexture(c) }); [[1.02, 0], [-1.02, Math.PI]].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(2.4, 0.6), tm); p.position.set(-0.95, 1.85, q[0]); p.rotation.y = q[1]; g.add(p); });
  v.pl = { a: basic(0xff2020), b: basic(0x2060ff) }; bx(g, 0.35, 0.18, 0.7, v.pl.a, 0.4, 2.0, -0.45); bx(g, 0.35, 0.18, 0.7, v.pl.b, 0.4, 2.0, 0.45);
  g.scale.setScalar(1.12); return v;
}
function wreckFx(w, dt) {
  if (Math.abs(w.x - truck.x) > 130 || Math.abs(w.z - truck.z) > 130) return;
  const c = Math.cos(w.h), s2 = Math.sin(w.h);
  if (w.fire) for (let i = 0; i < 2; i++) emit(w.x + c * rnd(-1, 1.6) - s2 * rnd(-0.6, 0.6), 1.3, w.z + s2 * rnd(-1, 1.6) + c * rnd(-0.6, 0.6), rnd(-0.4, 0.4), rnd(2.5, 4), rnd(-0.4, 0.4), rnd(0.5, 0.9), rnd(1.0, 1.8), pick([0xff5a14, 0xffb030, 0xffe070]), -0.4, 0, true);
  if (w.hose) { const t = w.hose, dx = t.x - w.x, dz = t.z - w.z, d = Math.hypot(dx, dz) || 1; emit(w.x + c * 2.6, 2.9, w.z + s2 * 2.6, dx / d * 11 + rnd(-0.5, 0.5), 5.2, dz / d * 11 + rnd(-0.5, 0.5), 0.95, 0.6, 0xbfe6ff, 0.3, 11); }
}
function laneSpot(minTruck, avoid) {
  for (let t = 0; t < 80; t++) {
    const horiz = Math.random() < 0.5, line = rc(Math.random() * NR | 0), s = rnd(-HALF + 30, HALF - 30), d = Math.random() < 0.5 ? 1 : -1;
    if (Math.abs(s - Math.round(s / P) * P) < 26) continue;
    let x, z, h; if (horiz) { z = line + LANE * d; x = s; h = d > 0 ? 0 : Math.PI; } else { x = line - LANE * d; z = s; h = d > 0 ? Math.PI / 2 : -Math.PI / 2; }
    if (Math.hypot(x - truck.x, z - truck.z) < minTruck || avoid.some(p => Math.hypot(p.x - x, p.z - z) < 70)) continue;
    return { x, z, h };
  }
  return null;
}
function makeAccidentScene(x, z, h, jobCar) {
  const f = { x: Math.cos(h), z: Math.sin(h) }, r = { x: -f.z, z: f.x }, at = (a, b) => ({ x: x + f.x * a + r.x * b, z: z + f.z * a + r.z * b }), sc = { vehs: [], objs: [] };
  const place = (v, p, hh, roll, pitch, yoff) => { v.x = p.x; v.z = p.z; v.h = hh; v.cm.g.rotation.order = 'YXZ'; v.cm.g.rotation.x = roll || 0; v.cm.g.rotation.z = pitch || 0; v.yoff = yoff || 0; v.sync(); };
  const mk = (v) => { wrecks.push(v); sc.vehs.push(v); return v; };
  let A = jobCar; if (!A) A = mk(new Veh('wreck', pick(CAR_COLORS)));
  place(A, at(0, 0), h + 0.45, 0.07, -0.05);
  const B = mk(new Veh('wreck', pick(CAR_COLORS))), flip = Math.random() < 0.4; place(B, at(3.3, 1.9), h - 1.25, flip ? Math.PI : 0.16, 0, flip ? 1.86 : 0);
  if (Math.random() < 0.5) { const C = mk(new Veh('wreck', pick(CAR_COLORS))); place(C, at(-4.4, -2.4), h + 0.9, -0.12, 0.05); }
  const pol = mk(makePolice()); place(pol, at(-11, 2.4), h - 0.14, 0, 0);
  if (Math.random() < 0.35) { B.fire = true; const ft = mk(makeFireTruck()); place(ft, at(9, -3.6), h + 0.06, 0, 0); ft.hose = B; }
  if (Math.random() < 0.65) { const am = mk(makeAmbulance()); place(am, at(-6.8, -3.3), h + 0.12, 0, 0); }
  for (let i = 0; i < 8; i++) addCone(at(-17 - i * 2.2, 3.6 - i * 0.55).x, at(-17 - i * 2.2, 3.6 - i * 0.55).z);
  for (let i = 0; i < 9; i++) { const p = at(rnd(-3, 7), rnd(-3, 4)), m = bx(scene, rnd(0.2, 0.7), 0.12, rnd(0.2, 0.7), pick(['#222', '#8d95a0', '#7fb7d6', '#5a1a1a']), p.x, 0.1, p.z); m.rotation.y = rnd(0, 6); sc.objs.push(m); allObjs.push(m); }
  for (let i = 0; i < 4; i++) { const p = at(rnd(-3, 6), 4.9 + rnd(0, 0.8)), pd = makePed3(); pd.position.set(p.x, 0.25, p.z); pd.rotation.y = -Math.atan2(-r.z, -r.x) + rnd(-0.5, 0.5); sc.objs.push(pd); allObjs.push(pd); }
  return sc;
}
function removeScene(sc) {
  sc.vehs.forEach(v => { scene.remove(v.mesh); const i = wrecks.indexOf(v); if (i >= 0) wrecks.splice(i, 1); }); sc.objs.forEach(o => scene.remove(o));
}
function clearScenes() { wrecks.forEach(v => scene.remove(v.mesh)); wrecks.length = 0; allObjs.forEach(o => scene.remove(o)); allObjs.length = 0; }

function registerJob(car, kind, zone, horiz, d) {
  const x = car.x, z = car.z, h = car.h, dist0 = Math.hypot(zone.x - x, zone.z - z);
  const col = kind === 'service' ? 0xff8a1f : 0x35b8ff, beam = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 90, 10, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  beam.position.set(x, 45, z); scene.add(beam);
  const lab = labelSprite(kind === 'service' ? '🔧 SERVİS' : '🅿️ OTOPARK', kind === 'service' ? '#ff8a1f' : '#35b8ff'); lab.scale.set(14, 3.5, 1); lab.position.set(x, 6.5, z); scene.add(lab);
  const job = { id: jobSeq++, car, kind, zone, state: 'waiting', hp: 100, dist0, allowed: 28 + dist0 / 5, left: 0, ttl: 200, base: 80 + dist0 * 0.55, beam, lab };
  car.job = job; jobs.push(job); job.cls = car.cls; job.base *= CLS[car.cls].pay; if (car.cls !== 'car' && car.cls !== 'moto') job.allowed += 12;
  { const nx = horiz ? 0 : -d, nz = horiz ? d : 0, pd = makePed3(); pd.position.set(x + nx * 4.7, 0.25, z + nz * 4.7); pd.rotation.y = -Math.atan2(-nz, -nx); job.ped = pd; }
  for (let i = 0; i < 4; i++) { const b = -(car.half + 3.8) - i * 2.2, off = (i % 2 ? 1 : -1) * 0.9; addCone(x + Math.cos(h) * b - Math.sin(h) * off, z + Math.sin(h) * b + Math.cos(h) * off); }
  return job;
}
/* Trafikteki araçlar yolda arıza yapar ve çağrıya dönüşür */
let breakT = 14, aiT = 3;
function addTrafficCar() { const v = new Veh('ai', pick(CAR_COLORS)); v.cm.tail.color.setHex(0xaa1818); v.cm.head.color.setHex(0xfff2c0); ais.push(v); placeAI(v); return v; }
function breakdownStep(dt) {
  breakT -= dt;
  if (breakT <= 0) {
    breakT = rnd(20, 34);
    if (jobs.length < 5 && curSpec().classes.includes('car')) {
      const c = ais.filter(a => !a.emerg && !a.failing && a.speed > 4 && Math.hypot(a.x - truck.x, a.z - truck.z) > 50 && Math.hypot(a.x - truck.x, a.z - truck.z) < 240 &&
        Math.abs((a.axis === 'x' ? a.x : a.z) - Math.round((a.axis === 'x' ? a.x : a.z) / P) * P) > 24 && !jobs.some(j => Math.hypot(j.car.x - a.x, j.car.z - a.z) < 50));
      if (c.length) { const v = pick(c); v.failing = true; v.failT = 0; v.smokeT = 0; }
    }
  }
  for (const v of ais.slice()) if (v.failing) {
    v.failT += dt; v.smokeT -= dt; if (v.smokeT <= 0) { v.smokeT = 0.09; emit(v.x + Math.cos(v.h) * 1.4, 1.3, v.z + Math.sin(v.h) * 1.4, rnd(-0.4, 0.4), rnd(1.8, 3), rnd(-0.4, 0.4), 1.8, 1.3, 0x8a8a8a, 3, 0); }
    if (v.speed < 0.3 && v.failT > 1) {
      ais.splice(ais.indexOf(v), 1); v.failing = false; v.kind = 'broken'; v.mass = 1.2; v.vx = v.vz = 0; v.speed = 0;
      const kind = Math.random() < 0.5 ? 'service' : 'parking', zs = zones.filter(q => q.kind === kind && Math.hypot(q.x - v.x, q.z - v.z) > 80), zone = pick(zs.length ? zs : zones.filter(q => q.kind === kind));
      const job = registerJob(v, kind, zone, v.axis === 'x', v.d); job.breakdown = true;
      toast('⚙️ Yolda bir araç arıza yaptı!  ' + (kind === 'service' ? '🔧 SERVİS' : '🅿️ OTOPARK'), '');
    }
  }
  aiT -= dt; if (aiT <= 0) { aiT = 3; if (ais.filter(a => !a.emerg).length < NTRAF) addTrafficCar(); }
}

function pickClass() { const mix = curSpec().mix, tot = Object.values(mix).reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (const k in mix) { r -= mix[k]; if (r <= 0) return k; } return 'car'; }
function spawnJob(first) {
  const hw = !first && Math.random() < 0.22, acc = !hw && !first && curSpec().classes.includes('car') && Math.random() < 0.25, cls = acc ? 'car' : pickClass(), minInt = acc ? 26 : (cls === 'trailer' ? 27 : cls === 'heavy' ? 25 : cls === 'machine' ? 21 : 18);
  for (let t = 0; t < 80; t++) {
    const horiz = Math.random() < 0.5, line = rc(Math.random() * NR | 0), d = Math.random() < 0.5 ? 1 : -1; let s = rnd(-HALF + 25, HALF - 25), x, z, h;
    if (hw) { const sg = Math.random() < 0.5 ? 1 : -1; s = sg * rnd(HALF + 110, HALF + 560); if (horiz) { z = 10.9 * d; x = s; h = d > 0 ? 0 : Math.PI; } else { x = -10.9 * d; z = s; h = d > 0 ? Math.PI / 2 : -Math.PI / 2; } }
    else { if (Math.abs(s - Math.round(s / P) * P) < minInt) continue; if (horiz) { z = line + LANE * d; x = s; h = d > 0 ? 0 : Math.PI; } else { x = line - LANE * d; z = s; h = d > 0 ? Math.PI / 2 : -Math.PI / 2; } }
    if (Math.hypot(x - truck.x, z - truck.z) < (first ? 60 : 90) || jobs.some(j => Math.hypot(j.car.x - x, j.car.z - z) < 70)) continue;
    const kind = Math.random() < 0.5 ? 'service' : 'parking', zs = zones.filter(q => q.kind === kind && Math.hypot(q.x - x, q.z - z) > 110);
    if (!zs.length) continue; const zone = pick(zs), car = new Veh('broken', pick(CAR_COLORS), cls);
    car.x = x; car.z = z; car.h = h; car.sync();
    const job = registerJob(car, kind, zone, horiz, d);
    if (acc) { job.accident = true; job.hp = 55; job.base *= 1.4; job.sc = makeAccidentScene(x, z, h, car); }
    return job;
  }
}
function removeJobVisuals(j) { scene.remove(j.beam); scene.remove(j.lab); if (j.ped) { scene.remove(j.ped); j.ped = null; } }
function removeJob(j, delay) {
  if (j.sc) { const sc2 = j.sc; setTimeout(() => removeScene(sc2), 20000); }
  removeJobVisuals(j); jobs.splice(jobs.indexOf(j), 1);
  const rm = () => { scene.remove(j.car.mesh); }; if (delay) setTimeout(rm, delay); else rm();
  spawnQ.push(rnd(2, 5));
}

/* ---------- Helikopterler ---------- */
const helis = [];
function makeHeli(color, accent) {
  const g = new T.Group(), o = { g };
  const body = new T.Mesh(new T.SphereGeometry(1, 14, 10), mat(color)); body.scale.set(3.1, 1.5, 1.7); g.add(body);
  const glass = new T.Mesh(new T.SphereGeometry(1, 12, 8), mat('#1d3a55')); glass.scale.set(1.5, 1.0, 1.55); glass.position.set(1.7, 0.2, 0); g.add(glass);
  bx(g, 6.5, 0.45, 0.5, color, -5.2, 0.35, 0); bx(g, 0.5, 1.6, 0.18, accent, -8.3, 1.0, 0); bx(g, 3.0, 0.1, 0.14, accent, 0, 0.1, 1.72); bx(g, 3.0, 0.1, 0.14, accent, 0, 0.1, -1.72);
  [-1, 1].forEach(sd => { bx(g, 5, 0.12, 0.12, '#222', 0, -1.7, sd * 1.1); bx(g, 0.12, 0.9, 0.12, '#222', 1.2, -1.25, sd * 1.1); bx(g, 0.12, 0.9, 0.12, '#222', -1.2, -1.25, sd * 1.1); });
  bx(g, 0.3, 0.7, 0.3, '#222', 0, 1.7, 0);
  const rotor = new T.Group(); rotor.position.y = 2.1; bx(rotor, 13, 0.07, 0.55, '#2a2a2a', 0, 0, 0); bx(rotor, 0.55, 0.07, 13, '#2a2a2a', 0, 0, 0);
  const disc = new T.Mesh(new T.CircleGeometry(6.5, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; rotor.add(disc); g.add(rotor); o.rotor = rotor;
  const tr = new T.Group(); tr.position.set(-8.3, 1.0, 0.25); bx(tr, 0.12, 1.8, 0.08, '#2a2a2a', 0, 0, 0); g.add(tr); o.tail = tr;
  o.nav = basic(0xff2020); bx(g, 0.3, 0.3, 0.3, o.nav, -8.3, 2.0, 0);
  scene.add(g); return o;
}
function initHelis() {
  [['#1c2a4a', '#f2f2f4', true], ['#f4f4f6', '#d8262b', false]].forEach((q, i) => {
    const o = makeHeli(q[0], q[1]); o.blob = new T.Mesh(new T.PlaneGeometry(14, 8), new T.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })); o.blob.rotation.x = -Math.PI / 2; o.blob.position.y = 0.4; scene.add(o.blob);
    const h = { o, cx: rnd(-80, 80), cz: rnd(-80, 80), tx: 0, tz: 0, retarget: 0, a: rnd(0, 6.28), r: 38 + i * 14, alt: 52 + i * 10, spd: (0.22 + i * 0.05) * (i ? -1 : 1), x: 0, z: 0, hd: 0, search: q[2] };
    if (h.search) {
      h.beam = new T.Mesh(new T.ConeGeometry(6, h.alt, 20, 1, true), new T.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); scene.add(h.beam);
      h.spot = new T.Mesh(new T.CircleGeometry(6, 24), new T.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending })); h.spot.rotation.x = -Math.PI / 2; h.spot.position.y = 0.4; scene.add(h.spot);
    }
    h.tx = h.cx; h.tz = h.cz; helis.push(h);
  });
}
function stepHelis(dt) {
  for (const h of helis) {
    h.retarget -= dt;
    if (h.retarget <= 0) { h.retarget = rnd(18, 32); const w = wrecks.filter(v => !v.pl); if (w.length && Math.random() < 0.7) { const p = pick(w); h.tx = p.x; h.tz = p.z; } else { h.tx = rnd(-HALF * 0.8, HALF * 0.8); h.tz = rnd(-HALF * 0.8, HALF * 0.8); } }
    const k = 1 - Math.exp(-dt * 0.35); h.cx += (h.tx - h.cx) * k; h.cz += (h.tz - h.cz) * k; h.a += h.spd * dt;
    const nx = h.cx + Math.cos(h.a) * h.r, nz = h.cz + Math.sin(h.a) * h.r; if (h.x || h.z) h.hd = Math.atan2(nz - h.z, nx - h.x); h.x = nx; h.z = nz;
    const o = h.o, y = h.alt + Math.sin(time * 0.7 + h.r) * 1.4; o.g.position.set(h.x, y, h.z); o.g.rotation.order = 'YXZ'; o.g.rotation.set(Math.sign(h.spd) * 0.2, -h.hd, -0.07);
    o.rotor.rotation.y += dt * 32; o.tail.rotation.z += dt * 40; o.nav.color.setHex(Math.floor(time * 2) % 2 ? 0xff2020 : 0x330808);
    o.blob.position.x = h.x; o.blob.position.z = h.z; o.blob.rotation.z = -h.hd;
    if (h.beam) { h.beam.position.set(h.x, h.alt / 2, h.z); h.spot.position.x = h.x; h.spot.position.z = h.z; }
  }
}
initHelis();

/* ---------- Oyun durumu ---------- */
let state = 'title', paused = false, camMode = save.settings.cam || 0, camAng = 0, shake = 0, lastDt = 1 / 60, time = 0;
const shift = { left: SHIFT_LEN, money: 0, deliveries: 0, crashes: 0, damage: 0, bestJob: 0 };
const keys = new Set();
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !/INPUT|SELECT/.test(e.target.tagName)) e.preventDefault();
  const first = !keys.has(e.code); keys.add(e.code); if (!first) return;
  if (e.code === 'Escape') { if (state === 'play') togglePause(); else if (!$('menu').hidden) closeMenu(); return; }
  if (state === 'title' && $('menu').hidden && !/INPUT|SELECT/.test(e.target.tagName)) { if (e.code === 'ArrowLeft') { stepTruck(-1); return; } if (e.code === 'ArrowRight') { stepTruck(1); return; } }
  if (state !== 'play') return; if (paused && e.code !== 'KeyP' && e.code !== 'KeyM') return;
  if (e.code === 'KeyE') toggleHook(); else if (e.code === 'KeyH') horn(); else if (e.code === 'KeyR') recover();
  else if (e.code === 'KeyC') camMode = (camMode + 1) % 3; else if (e.code === 'KeyP') togglePause(); else if (e.code === 'KeyM') setMute(!muted);
});
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
const K = (...c) => c.some(x => keys.has(x));
function toast(t, cls) { const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = t; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3300); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); }

function resetShift() {
  applyTruck();
  Object.assign(shift, { left: SHIFT_LEN, money: 0, deliveries: 0, crashes: 0, damage: 0, bestJob: 0 });
  jobs.forEach(j => { removeJobVisuals(j); scene.remove(j.car.mesh); }); jobs = []; spawnQ = []; jobSeq = 1;
  Object.assign(truck, { x: -20, z: LANE, h: 0, vx: 0, vz: 0, steer: 0, turbo: 100, turboOn: false, towJob: null, crashCd: 0 });
  clearScenes(); breakT = 14; aiT = 3; while (ais.filter(a => !a.emerg).length < NTRAF) addTrafficCar(); ais.forEach(placeAI); hwCars.forEach(placeHw); resetPeds(); scatterCones(); { const used = []; for (let i = 0; i < 6; i++) { const sp2 = laneSpot(100, used); if (sp2) { used.push(sp2); makeAccidentScene(sp2.x, sp2.z, sp2.h, null); } } } for (let i = 0, n0 = Math.max(3, curSpec().cap + 1); i < n0; i++) spawnJob(i === 0);
  camAng = 0; shake = 0; paused = false; $('pauseMsg').hidden = true; $('toasts').innerHTML = '';
}
function startShift() { audioInit(); resetShift(); state = 'play'; $('title').hidden = true; $('results').hidden = true; $('hud').hidden = false; snapCamera(); toast('Çekici: ' + curSpec().name); }
function endShift() {
  state = 'over'; if (truck.towJob) { truck.towJob = null; }
  save.money += 0; if (shift.money > save.best) save.best = shift.money; persist(); if (eng) eng.g.gain.value = 0;
  const rows = [['Kazanç', '$' + shift.money], ['Teslim edilen araç', shift.deliveries], ['Kaza (trafik)', shift.crashes], ['Araçlara verilen hasar', Math.round(shift.damage) + ' puan'], ['En iyi iş', '$' + shift.bestJob], ['Rekor', '$' + save.best], ['Cüzdan', '$' + save.money]];
  $('resBody').innerHTML = rows.map(r => `<div class="stat"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  $('hud').hidden = true; $('results').hidden = false;
}
function showTitle() { state = 'title'; $('results').hidden = true; $('title').hidden = false; $('hud').hidden = true; renderGarage(); }
let prRenderer = null, prScene = null, prCam = null, prTruck = null, prId = null;
function initPreview() {
  const host = $('pvStage'); if (!host || prRenderer) return;
  const w = host.clientWidth || 360, h = host.clientHeight || 230;
  prRenderer = new T.WebGLRenderer({ antialias: true, alpha: true }); prRenderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); prRenderer.setSize(w, h); host.appendChild(prRenderer.domElement);
  prScene = new T.Scene(); prScene.add(new T.HemisphereLight(0xeaf3ff, 0x77736b, 1.05)); const dl = new T.DirectionalLight(0xffe0b0, 0.9); dl.position.set(-6, 10, 8); prScene.add(dl);
  const fl = new T.Mesh(new T.CircleGeometry(7.5, 40), new T.MeshBasicMaterial({ color: 0x3a0c14 })); fl.rotation.x = -Math.PI / 2; prScene.add(fl);
  prCam = new T.PerspectiveCamera(34, w / h, 0.5, 100); prCam.position.set(9, 4.6, 9); prCam.lookAt(0, 1.7, 0);
}
function fitPreview() { const host = $('pvStage'); if (!prRenderer || !host || !host.clientWidth || !host.clientHeight) return; prRenderer.setSize(host.clientWidth, host.clientHeight); prCam.aspect = host.clientWidth / host.clientHeight; prCam.updateProjectionMatrix(); }
if (window.ResizeObserver) new ResizeObserver(fitPreview).observe($('pvStage')); addEventListener('resize', fitPreview);
function ropeBetween(ax, ay, bx2, by) {
  const dx = bx2 - ax, dy = by - ay, l = Math.hypot(dx, dy), m = new T.Mesh(GC, mat('#1a1a1a')); m.scale.set(0.07, l, 0.07); m.position.set((ax + bx2) / 2, (ay + by) / 2, 0);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / l, dy / l, 0)); return m;
}
function setPreview(id) {
  initPreview(); fitPreview(); if (!prRenderer || prId === id) return; prId = id; if (prTruck) prScene.remove(prTruck.g);
  const idx = TRUCKS.findIndex(t => t.id === id), sp = TRUCKS[Math.max(0, idx)], o = buildTruck(sp); o.spots.forEach(l => { o.g.remove(l); o.g.remove(l.target); }); o.arrow.visible = false; o.g.scale.setScalar(sp.scale);
  const COLS = ['#d63b3b', '#2f7fd6', '#e8c130', '#2fb36a', '#8e4fc9', '#e0782c'], inner = new T.Group(); inner.add(o.g);
  let front = 3.4 * sp.scale, rear = -(sp.len - 3.2) * sp.scale - 1.6;
  if (sp.mode === 'flat') sp.slots.slice(0, sp.cap).forEach((sl, i) => { const m = vehMesh(sp.classes[0], COLS[i % COLS.length]); m.haz.forEach(h => h.color.setHex(0x3a2200)); m.g.position.set(sl.x, sl.y, sl.z); o.g.add(m.g); });
  else if (sp.mode === 'lift') { const c = carMesh('#d63b3b'); c.haz.forEach(h => h.color.setHex(0x3a2200)); c.g.position.set(-(sp.hookOff + 2.2 - 0.9), sp.lift, 0); c.g.rotation.order = 'YXZ'; c.g.rotation.z = sp.tilt; o.g.add(c.g); rear = -(sp.hookOff + 2.2 - 0.9 + 2.2); }
  else {
    const m = vehMesh(sp.show, COLS[idx % COLS.length]), L = m.len || CLS[sp.show].len, cx = -(sp.hookOff + 3.7 + L / 2); m.haz.forEach(h => h.color.setHex(0x3a2200)); m.g.position.set(cx, 0, 0); inner.add(m.g);
    inner.add(ropeBetween(-sp.hookOff, 4.2 * sp.scale, -(sp.hookOff + 3.7), 0.8)); rear = cx - L / 2;
  }
  inner.position.x = -(front + rear) / 2; const holder = new T.Group(); holder.add(inner); prScene.add(holder); prTruck = { g: holder };
  const k = Math.max(0.95, sp.scale * 0.95, (front - rear) / 9.2 * 0.72); prCam.position.set(9 * k, 4.4 * k, 9 * k); prCam.lookAt(0, 1.8 * k, 0);
  const dd = $('pvDesc'); if (dd) dd.textContent = sp.desc; const nm = $('pvName'); if (nm) nm.textContent = sp.icon + ' ' + sp.name + '   ·   ' + (idx + 1) + ' / ' + TRUCKS.length;
}
function stepTruck(d) {
  const i = TRUCKS.findIndex(t => t.id === (prId || save.truck)), t = TRUCKS[(i + d + TRUCKS.length) % TRUCKS.length];
  if (save.owned.includes(t.id)) save.truck = t.id; persist(); audioInit(); tone(560, 0.07, 'triangle', 0.05); setPreview(t.id); renderGarage();
  const card = $('trucks').querySelector('.tcard[data-id="' + t.id + '"]'); if (card) { const r = card.getBoundingClientRect(), c0 = $('trucks').getBoundingClientRect(); $('trucks').scrollBy({ left: (r.left + r.width / 2) - (c0.left + c0.width / 2), behavior: 'smooth' }); }
}
function renderTrucks() {
  const dots = n => '<span class="dots">' + '●'.repeat(n) + '<i>' + '●'.repeat(5 - n) + '</i></span>', modeName = { rope: 'halat', flat: 'platform', lift: 'kaldırma kolu' };
  $('trucks').innerHTML = TRUCKS.map(t => { const owned = save.owned.includes(t.id), sel = save.truck === t.id, can = save.money >= t.price, st = t.stats;
    return `<div class="tcard ${sel ? 'sel' : ''}" data-id="${t.id}"><div class="row"><b>${t.icon} ${t.name}</b><span class="sub">${sel ? 'SEÇİLİ' : t.price === 0 ? 'Ücretsiz' : owned ? 'Sahipsin' : '$' + t.price}</span></div><div class="sub">${t.desc}</div>
      <div class="stats"><span>Hız</span>${dots(st[0])}<span>İvme</span>${dots(st[1])}<span>Direksiyon</span>${dots(st[2])}<span>Çekme gücü</span>${dots(st[3])}<span>Araç koruma</span>${dots(st[4])}</div>
      <div class="sub" style="margin-bottom:7px">Taşır: ${t.classes.map(c => CLS[c].icon).join(' ')} · Kapasite: <b>${t.cap}</b> · ${modeName[t.mode]}</div>
      <button data-id="${t.id}" class="${sel || (!owned && !can) ? 'dis' : ''}">${sel ? 'Kullanımda' : owned ? 'Bunu kullan' : 'Satın al $' + t.price}</button></div>`; }).join('');
  $('trucks').querySelectorAll('.tcard').forEach(c => { c.onclick = e => { if (e.target.closest('button')) return; const tt = TRUCKS.find(x => x.id === c.dataset.id); if (save.owned.includes(tt.id) || tt.price === 0) c.querySelector('button').click(); else setPreview(tt.id); }; });
  $('trucks').querySelectorAll('button').forEach(b => b.onclick = () => {
    const t = TRUCKS.find(x => x.id === b.dataset.id), owned = save.owned.includes(t.id); audioInit();
    if (owned) save.truck = t.id; else if (save.money >= t.price) { save.money -= t.price; save.owned.push(t.id); save.truck = t.id; tone(880, 0.2, 'triangle'); } else return;
    persist(); tone(520, 0.1, 'triangle'); setPreview(t.id); renderGarage();
  });
  if (!renderTrucks.done) { renderTrucks.done = true; const sc = $('trucks').querySelector('.tcard.sel'); if (sc) { const r = sc.getBoundingClientRect(), c0 = $('trucks').getBoundingClientRect(); $('trucks').scrollLeft += r.left - c0.left - 6; } }
  setPreview(prId || save.truck);
}
function renderGarage() {
  renderTrucks();
  $('wallet').textContent = save.money; $('bestT').textContent = save.best;
  $('ups').innerHTML = UPS.map(u => { const lv = save.up[u.k], max = lv >= 5, c = upCost(u.k);
    return `<div class="up" title="${u.desc}"><b>${u.name}</b><div class="sub">${u.desc}</div><div class="lv">${[0, 1, 2, 3, 4].map(i => `<i class="${i < lv ? 'f' : ''}"></i>`).join('')}</div><button data-k="${u.k}" class="${max || save.money < c ? 'dis' : ''}">${max ? 'MAKS' : 'Geliştir $' + c}</button></div>`; }).join('');
  $('ups').querySelectorAll('button').forEach(b => b.onclick = () => { const k = b.dataset.k, c = upCost(k); if (save.up[k] >= 5 || save.money < c) return; save.money -= c; save.up[k]++; persist(); audioInit(); tone(660, 0.15, 'triangle'); renderGarage(); });
}
/* ---------- Duraklatma ve ayarlar menüsü ---------- */
function setMute(v) { muted = v; save.settings.mute = v; persist(); if ($('sMute')) $('sMute').checked = v; if (!v) tone(660, 0.1, 'triangle', 0.05); }
function applySettings() { applyVolume(); applyQuality(); $('mini').style.display = save.settings.mini ? '' : 'none'; }
function syncMenu() {
  const st = save.settings; $('sVol').value = st.vol; $('sVolV').textContent = st.vol + '%'; $('sMute').checked = muted; $('sCam').value = camMode; $('sQual').value = st.quality;
  $('sShake').checked = st.shake; $('sArrow').checked = st.arrow; $('sMini').checked = st.mini;
}
function openMenu(mode) {
  const pause = mode === 'pause'; $('menuTitle').innerHTML = pause ? 'DURAKLATILDI' : 'AYARLAR'; $('menuBtns').style.display = pause ? 'grid' : 'none'; $('mClose').style.display = pause ? 'none' : 'inline-block';
  syncMenu(); $('menu').hidden = false;
}
function closeMenu() { $('menu').hidden = true; }
function togglePause() { if (state !== 'play') return; paused = !paused; audioPause(paused); if (paused) openMenu('pause'); else closeMenu(); }
$('mResume').onclick = togglePause;
$('mRestart').onclick = () => { closeMenu(); paused = false; audioPause(false); startShift(); };
$('mEnd').onclick = () => { closeMenu(); paused = false; audioPause(false); endShift(); };
$('mGarage').onclick = () => { closeMenu(); paused = false; audioPause(false); if (shift.money > save.best) save.best = shift.money; persist(); if (eng) eng.g.gain.value = 0; showTitle(); };
$('mClose').onclick = closeMenu; $('btnMenu').onclick = togglePause; $('btnSettings').onclick = () => { audioInit(); openMenu('title'); };
$('sVol').oninput = e => { save.settings.vol = +e.target.value; $('sVolV').textContent = save.settings.vol + '%'; applyVolume(); persist(); };
$('sVol').onchange = () => tone(660, 0.12, 'triangle', 0.06);
$('sMute').onchange = e => setMute(e.target.checked);
$('sCam').onchange = e => { camMode = +e.target.value; save.settings.cam = camMode; persist(); };
$('sQual').onchange = e => { save.settings.quality = e.target.value; persist(); applyQuality(); };
$('sShake').onchange = e => { save.settings.shake = e.target.checked; persist(); };
$('sArrow').onchange = e => { save.settings.arrow = e.target.checked; persist(); };
$('sMini').onchange = e => { save.settings.mini = e.target.checked; persist(); applySettings(); };
addEventListener('click', e => { if (e.target.tagName === 'BUTTON') e.target.blur(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) audioPause(true); else if (!paused) audioPause(false); });
applySettings();
$('pvPrev').onclick = () => stepTruck(-1); $('pvNext').onclick = () => stepTruck(1);
$('btnStart').onclick = startShift; $('btnAgain').onclick = showTitle;

/* ---------- Kanca / yükleme mantığı ---------- */
const canTow = j => curSpec().classes.includes(j.cls || 'car');
const reachOf = c => (curSpec().reach || 12) + Math.max(0, c.half - 2.2);
const behindOK = (c) => { const H = hookPoint(), dx = c.x - truck.x, dz = c.z - truck.z, d = Math.hypot(dx, dz); return { d: Math.hypot(c.x - H.x, c.z - H.z), behind: (dx * Math.cos(truck.h) + dz * Math.sin(truck.h)) / (d || 1) < -0.25 }; };
const loadInfo = c => curSpec().anyDir ? { d: Math.max(0, Math.hypot(c.x - truck.x, c.z - truck.z) - 3), behind: true } : behindOK(c);
const nearestWaiting = () => { let b = null, bd = 1e9; for (const j of jobs) if ((j.state === 'waiting' || j.state === 'dropped') && canTow(j)) { const d = Math.hypot(j.car.x - truck.x, j.car.z - truck.z); if (d < bd) { bd = d; b = j; } } return b; };
function zoneOf(x, z) { return zones.find(q => Math.hypot(q.x - x, q.z - z) < q.r) || null; }
const kindName = k => k === 'service' ? 'SERVİS' : 'OTOPARK';
function tryLoad(silent) {
  const sp = curSpec(), c0 = nearestWaiting(); if (!c0) { if (!silent) toast('Çekebileceğin bir araç yok', 'bad'); return false; }
  const c = c0.car, info = loadInfo(c);
  if (info.d > reachOf(c)) { if (!silent) toast('Araca biraz daha yaklaş', 'bad'); return !silent; }
  if (!info.behind) { if (!silent) toast('Aracın ARKASINA geç: geri vitesle yanaş', 'bad'); return !silent; }
  if (Math.hypot(truck.vx, truck.vz) > (sp.mode === 'rope' ? 9 : 4)) { if (!silent) toast('Yavaşla!', 'bad'); return !silent; }
  attach(c0); return true;
}
function attach(c0) {
  const sp = curSpec(), c = c0.car, f = { x: Math.cos(c.h), z: Math.sin(c.h) };
  c.vx = c.vz = 0; c.towed = true; c.load = 0; c.sx = c.x; c.sz = c.z; c.sh = c.h; c.slotIdx = -1;
  if (sp.mode === 'rope') {
    const H = hookPoint(), front = { x: c.x + f.x * c.half, z: c.z + f.z * c.half }, rear = { x: c.x - f.x * c.half, z: c.z - f.z * c.half };
    const df = Math.hypot(front.x - H.x, front.z - H.z), dr = Math.hypot(rear.x - H.x, rear.z - H.z), tip = df <= dr ? front : rear, oth = df <= dr ? rear : front, ux = tip.x - oth.x, uz = tip.z - oth.z, l = Math.hypot(ux, uz);
    c.flip = df <= dr ? 0 : 1; c.h = Math.atan2(uz, ux); c.F = { x: tip.x, z: tip.z }; c.Rr = { x: tip.x - ux / l * c.body, z: tip.z - uz / l * c.body }; c.ropeLen = Math.hypot(tip.x - H.x, tip.z - H.z);
  } else {
    c.F = { x: c.x, z: c.z }; c.Rr = { x: c.x, z: c.z }; c.flip = 0;
    if (sp.mode === 'flat') c.slotIdx = sp.slots.findIndex((sl, i) => !truck.loads.some(j => j.car.slotIdx === i));
  }
  truck.loads.push(c0); c0.state = 'towing'; if (c0.ped) { scene.remove(c0.ped); c0.ped = null; } c0.left = c0.allowed; c0.ttl = 999;
  tone(520, 0.1, 'square', 0.07); setTimeout(() => tone(300, sp.mode === 'rope' ? 0.15 : 0.2, sp.mode === 'rope' ? 'square' : 'sawtooth', 0.06), 130);
  const what = sp.mode === 'rope' ? 'Kanca takıldı' : sp.mode === 'flat' ? 'Platforma yükleniyor' : 'Kollar aracı kavradı';
  toast(what + ' → ' + (c0.kind === 'service' ? '🔧 SERVİS' : '🅿️ OTOPARK') + (sp.cap > 1 ? '   (' + truck.loads.length + '/' + sp.cap + ')' : ''), 'good');
}
function unloadJob(J, doDeliver) {
  const sp = curSpec(), c = J.car, i = truck.loads.indexOf(J); if (i >= 0) truck.loads.splice(i, 1); c.towed = false;
  if (sp.mode === 'rope') c.h = Math.atan2(c.F.z - c.Rr.z, c.F.x - c.Rr.x);
  else { const back = sp.hookOff + c.half + 1.0; c.x = truck.x - Math.cos(truck.h) * back; c.z = truck.z - Math.sin(truck.h) * back; c.h = truck.h; c.flip = 0; c.yoff = 0; c.cm.g.rotation.z = 0; }
  c.vx = c.vz = 0; c.load = 0; tone(220, 0.15, 'square', 0.07);
  if (doDeliver) deliver(J); else J.state = 'dropped';
}
function toggleHook() {
  const sp = curSpec();
  if (truck.loads.length) {
    const zOf = j => sp.mode === 'rope' ? zoneOf(j.car.x, j.car.z) : zoneOf(truck.x, truck.z);
    const match = truck.loads.filter(j => { const z = zOf(j); return z && z.kind === j.kind; });
    if (match.length) { match.forEach(j => unloadJob(j, true)); return; }
    if (sp.cap > 1 && truck.loads.length < sp.cap && tryLoad(true)) return;
    const j = truck.loads[truck.loads.length - 1], z = zOf(j); unloadJob(j, false);
    toast(z ? 'Burası ' + z.name + ' — bu araç ' + kindName(j.kind) + ' istiyor' : (sp.mode === 'rope' ? 'Araç bırakıldı' : 'Araç indirildi'), 'bad'); return;
  }
  tryLoad(false);
}
function deliver(J) {
  const sp2 = clamp(1 + 0.5 * (J.left / J.allowed), 1, 1.5), hpf = 0.35 + 0.65 * J.hp / 100, pay = Math.round(J.base * sp2 * hpf);
  shift.money += pay; shift.deliveries++; shift.bestJob = Math.max(shift.bestJob, pay); save.money += pay; persist(); shift.left += 12;
  J.state = 'done'; const c = J.car; for (let i = 0; i < 40; i++) emit(c.x, 2, c.z, rnd(-6, 6), rnd(4, 11), rnd(-6, 6), 1.4, 0.8, pick([0xffd54a, 0xffffff, 0x35b8ff, 0xff8a1f]), 0, 9, true);
  tone(880, 0.18, 'triangle', 0.09); setTimeout(() => tone(1175, 0.25, 'triangle', 0.09), 110);
  toast(`+$${pay}   (hız ×${sp2.toFixed(2)} · hasar ×${hpf.toFixed(2)})  +12 sn`, 'good'); removeJob(J, 900);
}
function failJob(J, why) {
  const i = truck.loads.indexOf(J); if (i >= 0) truck.loads.splice(i, 1); J.car.towed = false;
  toast(why, 'bad'); for (let k = 0; k < 20; k++) emit(J.car.x, 1.5, J.car.z, rnd(-4, 4), rnd(2, 6), rnd(-4, 4), 1.2, 1.5, 0x333333, 2, 0);
  noiseBurst(0.5, 0.25); removeJob(J, 0);
}
function recover() {
  const hx = Math.abs(truck.z - Math.round(truck.z / P) * P), hz = Math.abs(truck.x - Math.round(truck.x / P) * P);
  if (Math.abs(truck.x) > HALF + 6 || Math.abs(truck.z) > HALF + 6) {
    if (Math.abs(truck.x) >= Math.abs(truck.z)) { const d = Math.cos(truck.h) >= 0 ? 1 : -1; truck.z = LN2 * d; truck.h = d > 0 ? 0 : Math.PI; truck.x = clamp(truck.x, -WORLD + 30, WORLD - 30); }
    else { const d = Math.sin(truck.h) >= 0 ? 1 : -1; truck.x = -LN2 * d; truck.h = d > 0 ? Math.PI / 2 : -Math.PI / 2; truck.z = clamp(truck.z, -WORLD + 30, WORLD - 30); }
  }
  else if (hx <= hz) { truck.z = Math.round(truck.z / P) * P + LANE * (Math.cos(truck.h) >= 0 ? 1 : -1); truck.h = Math.cos(truck.h) >= 0 ? 0 : Math.PI; truck.x = clamp(truck.x, -HALF + 10, HALF - 10); }
  else { truck.x = Math.round(truck.x / P) * P - LANE * (Math.sin(truck.h) >= 0 ? 1 : -1); truck.h = Math.sin(truck.h) >= 0 ? Math.PI / 2 : -Math.PI / 2; truck.z = clamp(truck.z, -HALF + 10, HALF - 10); }
  truck.vx = truck.vz = 0;
  if (curSpec().mode === 'rope') for (const J of truck.loads) { const c = J.car, H = hookPoint(), f = { x: Math.cos(truck.h), z: Math.sin(truck.h) }; c.F = { x: H.x - f.x * c.ropeLen, z: H.z - f.z * c.ropeLen }; c.Rr = { x: c.F.x - f.x * c.body, z: c.F.z - f.z * c.body }; syncTowed(c); }
  toast('Yola geri konuldu');
}
function syncTowed(c) {
  const dx = c.F.x - c.Rr.x, dz = c.F.z - c.Rr.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = c.F.x - ux * c.half, nz = c.F.z - uz * c.half;
  c.vx = (nx - c.x) / lastDt; c.vz = (nz - c.z) / lastDt; c.x = nx; c.z = nz; c.h = Math.atan2(uz, ux);
}
function vehImpact(v, imp) {
  const J = v.job; if (!J || imp < 3.5) return;
  const towing = J.state === 'towing', mul = (1 - 0.12 * save.up.rope) * (towing ? curSpec().dmg : 1), dmg = (imp - 3.5) * 2.6 * mul * (towing ? 1 : 0.5);
  if (dmg < 1) return; J.hp -= dmg; shift.damage += dmg; sparks(v.x, 1, v.z, 8); noiseBurst(0.25, clamp(imp * 0.03, 0.05, 0.3)); shake = Math.max(shake, clamp(imp * 0.05, 0.2, 1));
  if (J.hp <= 0) failJob(J, '💥 Araç hurdaya döndü!'); else if (imp > 7) toast('💥 Hasar: -' + Math.round(dmg) + ' (kalan ' + Math.round(J.hp) + ')', 'bad');
}

/* ---------- Fizik ---------- */
function updateTruck(dt) {
  const thr = (K('KeyW', 'ArrowUp') ? 1 : 0) - (K('KeyS', 'ArrowDown') ? 1 : 0), st = (K('KeyD', 'ArrowRight') ? 1 : 0) - (K('KeyA', 'ArrowLeft') ? 1 : 0), hand = K('Space');
  const f = { x: Math.cos(truck.h), z: Math.sin(truck.h) }, r = { x: -f.z, z: f.x };
  let vf = truck.vx * f.x + truck.vz * f.z, vl = truck.vx * r.x + truck.vz * r.z;
  const ts = curSpec(), up = save.up, towing = !!truck.towJob, wantTurbo = K('ShiftLeft', 'ShiftRight') && thr > 0 && truck.turbo > 1;
  truck.turboOn = wantTurbo; const tmax = 100 * (1 + 0.25 * up.turbo);
  truck.turbo = clamp(truck.turbo + (wantTurbo ? -35 : 10) * dt * (100 / tmax) * (wantTurbo ? 1 : 1) , 0, 100);
  const vmax = ts.vmax * (1 + 0.08 * up.motor) * (towing ? ts.towSlow : 1) * (wantTurbo ? 1.3 : 1), acc = ts.acc * (1 + 0.08 * up.motor) * (towing ? ts.towAcc : 1) * (wantTurbo ? 1.8 : 1);
  if (thr > 0) { if (vf < vmax) vf += acc * (1 - Math.max(0, vf) / vmax * 0.75) * dt; else vf -= 8 * dt; }
  else if (thr < 0) { if (vf > 0.5) vf -= 34 * dt; else vf = Math.max(vf - 12 * dt, -9); }
  else vf *= Math.exp(-0.32 * dt);
  if (hand) vf *= Math.exp(-1.2 * dt);
  vl *= Math.exp(-(hand ? 1.4 : 7.5 * (1 + 0.1 * up.grip) * ts.grip) * dt);
  truck.steer += (st - truck.steer) * Math.min(1, dt * 7);
  const delta = lerp(0.62, 0.17, Math.min(1, Math.abs(vf) / 24)) * truck.steer * ts.steer, om = vf / ts.wb * Math.tan(delta) * (hand ? 1.7 : 1);
  truck.vx = f.x * vf + r.x * vl; truck.vz = f.z * vf + r.z * vl; truck.h += om * dt; truck.x += truck.vx * dt; truck.z += truck.vz * dt;
  truck.vf = vf; truck.vl = vl; truck.crashCd -= dt;
  for (const w of TM.spin) w.rotation.z -= vf * dt / 0.62; TM.front.forEach(w => w.rotation.y = -truck.steer * 0.45);
}
let wasInter = false, redImmune = 0;
function checkRedLight(dt) {
  redImmune -= dt;
  const ix = Math.round(truck.x / P), iz = Math.round(truck.z / P), inside = Math.abs(ix) <= CEN && Math.abs(iz) <= CEN && Math.abs(truck.x - ix * P) < 8 && Math.abs(truck.z - iz * P) < 8;
  if (inside && !wasInter && isLit(ix + CEN, iz + CEN) && Math.hypot(truck.vx, truck.vz) > 6 && redImmune <= 0) {
    const axis = Math.abs(Math.cos(truck.h)) >= Math.abs(Math.sin(truck.h)) ? 'x' : 'z';
    if (redViolation(axis)) { redImmune = 8; shift.money = Math.max(0, shift.money - 20); save.money = Math.max(0, save.money - 20); toast('🚦 Kırmızı ışık ihlali  -$20', 'bad'); tone(300, 0.25, 'sawtooth', 0.06, 200); }
  }
  wasInter = inside;
}
function collideTruckStatic() {
  let worst = 0;
  for (const c of truck.circles()) {
    const r = staticPush(c.x, c.z, c.r); if (!r.hit) continue; truck.x += r.dx; truck.z += r.dz;
    const vn = truck.vx * r.nx + truck.vz * r.nz; if (vn < 0) { truck.vx -= 1.25 * vn * r.nx; truck.vz -= 1.25 * vn * r.nz; worst = Math.max(worst, -vn); }
  }
  if (worst > 4 && curSpec().mode !== 'rope') truck.loads.forEach(j => vehImpact(j.car, worst * 0.7));
  if (worst > 4) { shake = Math.max(shake, clamp(worst * 0.04, 0.1, 0.8)); sparks(truck.x, 1, truck.z, 6); if (worst > 6) noiseBurst(0.3, clamp(worst * 0.02, 0.05, 0.25)); }
}
function updateFree(v, dt) { v.x += v.vx * dt; v.z += v.vz * dt; const k = Math.exp(-2.4 * dt); v.vx *= k; v.vz *= k; if (Math.abs(v.vx) + Math.abs(v.vz) < 0.05) v.vx = v.vz = 0; }
function collideStatic(v) {
  let worst = 0;
  for (const c of v.circles()) {
    const r = staticPush(c.x, c.z, c.r); if (!r.hit) continue; shiftV(v, r.dx, r.dz);
    const vn = v.vx * r.nx + v.vz * r.nz; if (vn < 0) { if (!v.towed) { v.vx -= 1.3 * vn * r.nx; v.vz -= 1.3 * vn * r.nz; } worst = Math.max(worst, -vn); }
  }
  if (worst > 0) vehImpact(v, worst);
}
function collideVehicles() {
  const ropeMode = curSpec().mode === 'rope', riding = ropeMode ? [] : truck.loads, towCar = ropeMode && truck.loads[0] ? truck.loads[0].car : null, all = [truck, ...ais, ...hwCars, ...freeCars()]; if (towCar) all.push(towCar);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]; if ((a === truck && b === towCar) || (b === truck && a === towCar)) continue;
    const lim = (a === truck || b === truck || a.len > 8 || b.len > 8) ? 22 : 8; if (Math.abs(a.x - b.x) > lim || Math.abs(a.z - b.z) > lim) continue;
    const ia = a.towed ? 0.5 : 1 / a.mass, ib = b.towed ? 0.5 : 1 / b.mass;
    for (const ca of a.circles()) for (const cb of b.circles()) {
      let dx = ca.x - cb.x, dz = ca.z - cb.z; const md = ca.r + cb.r, d2 = dx * dx + dz * dz; if (d2 >= md * md) continue; const d = Math.sqrt(d2) || 1e-3; dx /= d; dz /= d; const pen = md - d, wa = ia / (ia + ib);
      shiftV(a, dx * pen * wa, dz * pen * wa); shiftV(b, -dx * pen * (1 - wa), -dz * pen * (1 - wa));
      const vn = (a.vx - b.vx) * dx + (a.vz - b.vz) * dz;
      if (vn < 0) {
        const jm = -1.25 * vn / (ia + ib); a.vx += dx * jm * ia; a.vz += dz * jm * ia; b.vx -= dx * jm * ib; b.vz -= dz * jm * ib;
        const imp = -vn; if (a.job) vehImpact(a, imp); if (b.job) vehImpact(b, imp); if (riding.length && (a === truck || b === truck)) riding.forEach(j => vehImpact(j.car, imp * 0.6));
        const tr = a === truck ? b : b === truck ? a : null;
        if (imp > 3.5) { shake = Math.max(shake, clamp(imp * 0.04, 0.1, 0.7)); if (imp > 6) noiseBurst(0.25, clamp(imp * 0.02, 0.05, 0.25)); }
        if (tr && tr.kind === 'ai' && imp > 3.5 && truck.crashCd <= 0) { truck.crashCd = 1.8; shift.crashes++; shift.money = Math.max(0, shift.money - 25); save.money = Math.max(0, save.money - 25); toast('🚗💥 Trafik kazası  -$25', 'bad'); sparks(tr.x, 1, tr.z, 10); }
      }
    }
  }
  for (const v of ais.concat(hwCars)) { const s = v.vx * Math.cos(v.h) + v.vz * Math.sin(v.h); v.speed = Math.max(0, s); }
}
function updateTow(dt) {
  const sp = curSpec(); if (!truck.loads.length) return;
  if (sp.mode !== 'rope') {
    const f = { x: Math.cos(truck.h), z: Math.sin(truck.h) }, r = { x: -f.z, z: f.x };
    for (const J of truck.loads) {
      const c = J.car; c.load = Math.min(1, (c.load || 0) + dt / (sp.loadT || 1.5)); const p = c.load * c.load * (3 - 2 * c.load);
      let tx, tz, ty, pitch = 0;
      if (sp.mode === 'flat') { const sl = sp.slots[Math.max(0, c.slotIdx)]; tx = truck.x + f.x * sl.x + r.x * sl.z; tz = truck.z + f.z * sl.x + r.z * sl.z; ty = sl.y; }
      else { const back = sp.hookOff + c.half - 0.9; tx = truck.x - f.x * back; tz = truck.z - f.z * back; ty = sp.lift; pitch = sp.tilt; }
      c.x = lerp(c.sx, tx, p); c.z = lerp(c.sz, tz, p); c.h = c.sh + angDiff(c.sh, truck.h) * p; c.yoff = ty * p + (sp.arc || 0) * Math.sin(Math.PI * p); c.flip = 0;
      c.cm.g.rotation.order = 'YXZ'; c.cm.g.rotation.z = pitch * p; c.vx = truck.vx; c.vz = truck.vz; c.F.x = c.Rr.x = c.x; c.F.z = c.Rr.z = c.z;
    }
    return;
  }
  const J = truck.loads[0], c = J.car, H = hookPoint();
  c.ropeLen = Math.max(ROPE_MIN, c.ropeLen - 6 * dt);
  let dx = c.F.x - H.x, dz = c.F.z - H.z, d = Math.hypot(dx, dz) || 1e-3; if (d > c.ropeLen) { c.F.x = H.x + dx / d * c.ropeLen; c.F.z = H.z + dz / d * c.ropeLen; }
  const ex = c.Rr.x - c.F.x, ez = c.Rr.z - c.F.z, el = Math.hypot(ex, ez) || 1e-3; c.Rr.x = c.F.x + ex / el * c.body; c.Rr.z = c.F.z + ez / el * c.body;
  syncTowed(c); collideStatic(c);
  const H2 = hookPoint(); dx = c.F.x - H2.x; dz = c.F.z - H2.z; d = Math.hypot(dx, dz) || 1e-3;
  if (d > c.ropeLen + 0.25) {
    const nx = dx / d, nz = dz / d, away = -(truck.vx * nx + truck.vz * nz); if (away > 0) { truck.vx += nx * away * 0.7; truck.vz += nz * away * 0.7; }
    const cor = (d - c.ropeLen) * 0.35; truck.x += nx * cor; truck.z += nz * cor;
  }
}
function updateCones(dt) {
  const vs = [truck, ...ais, ...freeCars()]; if (curSpec().mode === 'rope' && truck.loads[0]) vs.push(truck.loads[0].car);
  cones.forEach((c, i) => {
    if (!c.on) { _o.position.set(0, -50, 0); _o.scale.set(0.001, 0.001, 0.001); _o.rotation.set(0, 0, 0); }
    else {
      for (const v of vs) { const lim = v === truck ? 22 : Math.max(6, (v.len || 4.4) / 2 + 2); if (Math.abs(v.x - c.x) > lim || Math.abs(v.z - c.z) > lim) continue; for (const q of v.circles()) { const dx = c.x - q.x, dz = c.z - q.z, d = Math.hypot(dx, dz), md = q.r + 0.35; if (d < md) { const sp2 = Math.hypot(v.vx, v.vz); c.vx += dx / (d || 1) * (3 + sp2 * 0.9); c.vz += dz / (d || 1) * (3 + sp2 * 0.9); c.tilt = 1.5; if (sp2 > 6 && Math.random() < 0.2) tone(900, 0.05, 'triangle', 0.03); } } }
      c.x += c.vx * dt; c.z += c.vz * dt; const k = Math.exp(-3 * dt); c.vx *= k; c.vz *= k; c.tilt = Math.max(0.0, c.tilt - dt * 0.2);
      const sc = staticPush(c.x, c.z, 0.3); if (sc.hit) { c.x += sc.dx; c.z += sc.dz; }
      const vmag = Math.hypot(c.vx, c.vz); _o.position.set(c.x, c.tilt > 0.3 ? 0.3 : 0.45, c.z); _o.scale.set(1, 1, 1);
      _o.rotation.set(c.tilt > 0.3 ? Math.PI / 2 * Math.min(1, c.tilt) * (c.vz >= 0 ? 1 : -1) : 0, 0, c.tilt > 0.3 ? 0 : 0); _o.rotation.y = vmag > 1 ? Math.atan2(c.vx, c.vz) : _o.rotation.y;
    }
    _o.updateMatrix(); coneMesh.setMatrixAt(i, _o.matrix);
  });
  coneMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- Görseller / efektler ---------- */
function syncVisuals(dt) {
  TM.g.position.set(truck.x, 0, truck.z); TM.g.rotation.y = -truck.h;
  const bl = Math.floor(time * 4) % 2 === 0; TM.lbA.color.setHex(bl ? 0xffae00 : 0x553300); TM.lbB.color.setHex(bl ? 0x553300 : 0xffae00);
  const br = K('KeyS', 'ArrowDown') && (truck.vf || 0) > 0.5; TM.tail.color.setHex(br ? 0xff2222 : 0x7a1010);
  for (const j of jobs) { const c = j.car; if (!c.towed) { c.sync(); } else c.sync(); }
  { const p3 = Math.floor(time * 6) % 2; hospVehs.forEach(v => { v.pl.a.color.setHex(p3 ? 0xff2020 : 0x330808); v.pl.b.color.setHex(p3 ? 0x081033 : 0x2a6aff); }); }
  hwCars.forEach(v => v.sync());
  ais.forEach(v => { v.sync(); if (v.pl) { const p2 = Math.floor(time * 6) % 2; v.pl.a.color.setHex(p2 ? 0xff2020 : 0x330808); v.pl.b.color.setHex(p2 ? 0x081033 : 0x2a6aff); } });
  { const ph = Math.floor(time * 6) % 2; for (const w of wrecks) { w.sync(); wreckFx(w, dt); if (w.pl) { w.pl.a.color.setHex(ph ? 0xff2020 : 0x330808); w.pl.b.color.setHex(ph ? 0x081033 : 0x2a6aff); } else { w.cm.haz.forEach(m => m.color.setHex(bl ? 0xffae00 : 0x3a2200)); w.smokeT -= dt; if (w.smokeT <= 0) { w.smokeT = 0.1; emit(w.x + Math.cos(w.h) * 1.4, 1.3, w.z + Math.sin(w.h) * 1.4, rnd(-0.4, 0.4), rnd(1.8, 3), rnd(-0.4, 0.4), 2, 1.4, 0x1c1c1c, 3, 0); } } } }
  const J = truck.towJob, H = hookPoint();
  { const rope = curSpec().mode === 'rope'; ropeMesh.visible = hookMesh.visible = rope; if (rope) { if (J) setRope(H.x, 4.2 * truck.scale, H.z, J.car.F.x, 0.8, J.car.F.z); else setRope(H.x, 4.2 * truck.scale, H.z, H.x, 2.8 * truck.scale, H.z); } }
  // yön oku
  let tgt = null, tk = null;
  if (truck.loads.length) {
    const kinds = new Set(truck.loads.map(j => j.kind)), zs = zones.filter(z => kinds.has(z.kind)).sort((a, b) => Math.hypot(a.x - truck.x, a.z - truck.z) - Math.hypot(b.x - truck.x, b.z - truck.z))[0];
    tgt = zs || null; tk = zs ? zs.kind : null;
    if (truck.loads.length < curSpec().cap) { const n = nearestWaiting(); if (n) { const dn = Math.hypot(n.car.x - truck.x, n.car.z - truck.z); if (dn < 150 && (!zs || dn < Math.hypot(zs.x - truck.x, zs.z - truck.z))) { tgt = n.car; tk = null; } } }
  } else { const n = nearestWaiting(); if (n) tgt = n.car; }
  truck.target = tgt; truck.tgtKind = tk; TM.arrow.visible = false;
  if (tgt) { const rel = Math.atan2(tgt.z - truck.z, tgt.x - truck.x) - Math.atan2(camLook.z - camera.position.z, camLook.x - camera.position.x); groundArrow.visible = save.settings.arrow; groundArrow.material.rotation = -rel; groundArrow.position.set(truck.x, 5.0 * truck.scale + Math.sin(time * 4) * 0.15, truck.z); const sc = 2.08 + 0.1 * Math.sin(time * 6); groundArrow.scale.set(sc, sc, 1);
    { const dd = Math.round(Math.hypot(tgt.x - truck.x, tgt.z - truck.z) / 5) * 5; setArrowLabel(tk ? (tk === 'service' ? '🔧 SERVİS ' : '🅿️ OTOPARK ') + dd + ' m' : '🚧 ARIZALI ARAÇ ' + dd + ' m', tk ? (tk === 'service' ? '#ff8a1f' : '#35b8ff') : '#ffe14a');
      arrowLabel.visible = save.settings.arrow; arrowLabel.position.set(truck.x, 7.0 * truck.scale + Math.sin(time * 4) * 0.12, truck.z); arrowLabel.scale.set(4.8, 1.2, 1); } } else { groundArrow.visible = false; arrowLabel.visible = false; }
  const bk = bl; jobs.forEach(j => { j.car.cm.haz.forEach(m => m.color.setHex(bk && j.state === 'waiting' ? 0xffae00 : 0x3a2200)); j.beam.material.opacity = 0.25 + 0.15 * Math.sin(time * 3 + j.id); });
  if (sigMats) ['x', 'z'].forEach(ax => { const st = sigState(ax), m = sigMats[ax]; m.r.color.setHex(st === 'r' ? 0xff2a1a : 0x3a0a08); m.y.color.setHex(st === 'y' ? 0xffc21a : 0x3a2e08); m.g.color.setHex(st === 'g' ? 0x2aff6a : 0x0a3a1a); });
  for (const ch of chimneys) { ch.t -= dt; if (ch.t <= 0 && Math.abs(ch.x - truck.x) < 140 && Math.abs(ch.z - truck.z) < 140) { ch.t = 0.35; emit(ch.x, ch.y, ch.z, rnd(-0.3, 0.3) + 0.8, rnd(1.6, 2.6), rnd(-0.3, 0.3), 3.2, 2.4, 0xe6e6e6, 3, 0); } else if (ch.t <= 0) ch.t = 0.5; }
  zones.forEach(z => z.ring.material.opacity = 0.65 + 0.3 * Math.sin(time * 3));
  // duman / efekt
  for (const j of jobs) { const c = j.car; c.smokeT -= dt; const bad = j.hp < 50 || j.accident; if (c.smokeT <= 0 && (j.state === 'waiting' || bad)) { c.smokeT = bad ? 0.07 : 0.22; emit(c.x + Math.cos(c.h) * 1.5, 1.3, c.z + Math.sin(c.h) * 1.5, rnd(-0.4, 0.4), rnd(1.5, 2.6), rnd(-0.4, 0.4), 1.8, 1.2, bad ? 0x222222 : 0x888888, 3, 0); } }
  const sp3 = Math.hypot(truck.vx, truck.vz);
  if (Math.abs(truck.vl || 0) > 5 && sp3 > 6) { const b = { x: truck.x - Math.cos(truck.h) * 2, z: truck.z - Math.sin(truck.h) * 2 }; emit(b.x, 0.4, b.z, rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), 0.9, 1.6, 0xdddddd, 3, 0); }
  if (truck.turboOn) { const b = { x: truck.x + Math.cos(truck.h) * 1.0 - Math.sin(truck.h) * 1.05, z: truck.z + Math.sin(truck.h) * 1.0 + Math.cos(truck.h) * 1.05 }; emit(b.x, 3.8, b.z, rnd(-0.5, 0.5), rnd(4, 7), rnd(-0.5, 0.5), 0.3, 0.9, 0xff8a1f, -0.3, 0, true); }
  if (siren || heliSnd) {
    let nd = 1e9, hd = 1e9; for (const v of ais) if (v.emerg) nd = Math.min(nd, Math.hypot(v.x - truck.x, v.z - truck.z)); for (const w of wrecks) if (w.pl) nd = Math.min(nd, Math.hypot(w.x - truck.x, w.z - truck.z));
    for (const h of helis) hd = Math.min(hd, Math.hypot(h.x - truck.x, h.z - truck.z));
    const on = state === 'play' && !paused && !muted;
    if (siren) { if (on && time > sirenNext && nd < 70) { sirenEnd = time + 5.5; sirenNext = time + 40; }   // yaklaşınca ~5 sn çalar, sonra 40 sn susar
      siren.o.frequency.setTargetAtTime(Math.floor(time * 1.6) % 2 ? 960 : 700, AC.currentTime, 0.03); siren.g.gain.setTargetAtTime(on && time < sirenEnd ? clamp(1 - nd / 100, 0.15, 1) * 0.025 : 0, AC.currentTime, 0.1); }
    if (heliSnd) heliSnd.g.gain.setTargetAtTime(on ? Math.pow(clamp(1 - hd / 170, 0, 1), 1.5) * 0.14 : 0, AC.currentTime, 0.15);
  }
  // motor sesi
  if (eng) { const on = state === 'play' && !paused && !muted; eng.o.frequency.setTargetAtTime(38 + sp3 * 3.2 + (truck.turboOn ? 25 : 0), AC.currentTime, 0.08); eng.o2.frequency.setTargetAtTime(19 + sp3 * 1.6, AC.currentTime, 0.08); eng.g.gain.setTargetAtTime(on ? 0.035 + Math.abs(K('KeyW') ? 0.012 : 0) : 0, AC.currentTime, 0.1); }
}
const camPos = new T.Vector3(), camLook = new T.Vector3();
function camTargets() {
  const sp3 = Math.hypot(truck.vx, truck.vz), vang = sp3 > 4 && (truck.vf || 0) > 0 ? Math.atan2(truck.vz, truck.vx) : truck.h;
  const dist = [11 + sp3 * 0.12, 22, 26][camMode] + (truck.towJob ? 3 : 0) + (truck.scale - 1) * 8 + (curSpec().cam || 0), hgt = [4.8, 10, 95][camMode];
  const bf = { x: Math.cos(camAng), z: Math.sin(camAng) };
  const pos = new T.Vector3(truck.x - bf.x * dist, hgt, truck.z - bf.z * dist), look = new T.Vector3(truck.x + bf.x * [7, 3, 0][camMode], [1.8, 1.5, 0][camMode], truck.z + bf.z * [7, 3, 0][camMode]);
  return { pos, look, vang, fov: [58 + sp3 * 0.5, 62, 55][camMode] };
}
function snapCamera() { camAng = truck.h; const t = camTargets(); camPos.copy(t.pos); camLook.copy(t.look); camera.position.copy(camPos); camera.lookAt(camLook); }
function updateCamera(dt) {
  let t = camTargets(); camAng += angDiff(camAng, truck.h + angDiff(truck.h, t.vang) * 0.35) * Math.min(1, dt * 3.2);
  t = camTargets(); const k = 1 - Math.exp(-dt * 9); camPos.lerp(t.pos, k); camLook.lerp(t.look, k);
  const p = camPos.clone(); for (let i = 0; i < 10; i++) { if (!boxes.some(b => b.h > 0 && p.y < b.h + 1 && p.x > b.x0 - 1.5 && p.x < b.x1 + 1.5 && p.z > b.z0 - 1.5 && p.z < b.z1 + 1.5)) break; p.x += (truck.x - p.x) * 0.2; p.z += (truck.z - p.z) * 0.2; p.y += 0.6; }
  shake = Math.max(0, shake - dt * 2.2); const shk = save.settings.shake ? shake : 0; camera.position.set(p.x + rnd(-1, 1) * shk, p.y + rnd(-1, 1) * shk * 0.5, p.z + rnd(-1, 1) * shk); camera.lookAt(camLook);
  if (Math.abs(camera.fov - t.fov) > 0.05) { camera.fov = lerp(camera.fov, t.fov, 0.1); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
}

/* ---------- HUD ---------- */
const miniCtx = $('mini').getContext('2d');
function updateHUD() {
  $('hMoney').textContent = save.money; $('hShift').textContent = shift.money; $('hDel').textContent = shift.deliveries;
  const m = Math.floor(shift.left / 60), s = Math.floor(shift.left % 60); $('hTimer').textContent = m + ':' + String(s).padStart(2, '0'); $('tc').classList.toggle('low', shift.left < 30);
  const sp3 = Math.hypot(truck.vx, truck.vz); $('hSpeed').textContent = Math.round(sp3 * 3.6); $('hSpeedBar').style.width = clamp(sp3 / 40 * 100, 0, 100) + '%'; $('hTurbo').style.width = truck.turbo + '%';
  $('jobs').innerHTML = jobs.map(j => { const st = j.state === 'towing' ? '🔗 ' + Math.max(0, Math.ceil(j.left)) + ' sn' : j.state === 'dropped' ? '⚠ yolda' : '⏳ bekliyor'; return `<div class="j ${j.state === 'towing' ? 'on' : ''}"><span>#${j.id} ${CLS[j.cls || 'car'].icon} ${j.accident ? '💥 ' : j.breakdown ? '⚙️ ' : ''}${j.kind === 'service' ? '🔧 Servis' : '🅿️ Otopark'}</span><span>${st}</span></div>`; }).join('') || '<div class="sub">Yeni çağrı bekleniyor…</div>';
  const tg = truck.target, tk = truck.tgtKind, nl = truck.loads.length, sp0 = curSpec();
  $('target').innerHTML = tg ? (tk ? '🎯 ' + kindName(tk) : '🎯 Arızalı araç') + ' · <b>' + Math.round(Math.hypot(tg.x - truck.x, tg.z - truck.z)) + ' m</b>' : '—';
  $('towbar').hidden = !nl;
  if (nl) { const worst = truck.loads.reduce((a, j) => Math.min(a, j.hp), 100); $('towLabel').textContent = sp0.cap > 1 ? 'Yük ' + nl + '/' + sp0.cap + ' — en düşük araç sağlığı ' + Math.round(worst) + '%' : 'Araç hasarı — kalan ' + Math.round(worst) + '%'; const b = $('hHp'); b.style.width = worst + '%'; b.style.background = worst > 60 ? '#4cd37b' : worst > 30 ? '#ffb02e' : '#ff5a4f'; }
  const cy = Math.atan2(camLook.z - camera.position.z, camLook.x - camera.position.x);
  if (tg) { const rel = Math.atan2(tg.z - truck.z, tg.x - truck.x) - cy; $('cArrow').style.transform = 'rotate(' + rel + 'rad)'; $('compass').style.opacity = 1; $('cLabel').textContent = tk ? (tk === 'service' ? '🔧 SERVİS' : '🅿️ OTOPARK') : '🚧 ARIZALI ARAÇ'; $('cDist').textContent = Math.round(Math.hypot(tg.x - truck.x, tg.z - truck.z)) + ' m'; } else $('compass').style.opacity = 0.3;
  { let best = null, bd = 80; const fx = Math.cos(truck.h), fz = Math.sin(truck.h);
    for (let i = 1; i <= NR - 2; i += 2) for (let j = 1; j <= NR - 2; j += 2) { const dx = rc(i) - truck.x, dz = rc(j) - truck.z, d = Math.hypot(dx, dz), f = dx * fx + dz * fz, lat = Math.abs(-dx * fz + dz * fx); if (f > 10 && lat < 10 && d < bd) { bd = d; best = true; } }
    if (best) { const axis = Math.abs(fx) >= Math.abs(fz) ? 'x' : 'z', st = sigState(axis); $('cSig').textContent = (st === 'r' ? '🔴 DUR' : st === 'y' ? '🟡 YAVAŞLA' : '🟢 GEÇ') + ' · ışık ' + Math.round(bd) + ' m'; $('cSig').style.color = st === 'r' ? '#ff6b5e' : st === 'y' ? '#ffd54a' : '#6bff9a'; } else { const out = Math.abs(truck.x) > HALF + 8 || Math.abs(truck.z) > HALF + 8; $('cSig').textContent = out ? '🌵 Teksas otobanı' : ''; $('cSig').style.color = '#ffd98a'; } }
  // ipucu
  let pr = '';
  if (nl) {
    const zOf = j => sp0.mode === 'rope' ? zoneOf(j.car.x, j.car.z) : zoneOf(truck.x, truck.z), match = truck.loads.filter(j => { const z = zOf(j); return z && z.kind === j.kind; }), last = truck.loads[nl - 1];
    if (match.length) pr = '<b>E</b> Teslim et' + (match.length > 1 ? ' (' + match.length + ' araç)' : '');
    else if (zOf(last)) pr = 'Yanlış yer! Gereken: ' + kindName(last.kind);
    else { const n = sp0.cap > 1 && nl < sp0.cap ? nearestWaiting() : null; pr = n && loadInfo(n.car).d < reachOf(n.car) ? '<b>E</b> Bir araç daha yükle' : '<b>E</b> ' + (sp0.mode === 'rope' ? 'Kancayı çöz' : 'Aracı indir'); }
  } else { const n = nearestWaiting(); if (n) { const i = loadInfo(n.car); if (i.d < reachOf(n.car) + 2) pr = i.behind ? '<b>E</b> ' + (sp0.mode === 'rope' ? 'Kancayı tak' : sp0.mode === 'flat' ? 'Platforma yükle' : 'Aracı kaldır') : 'Aracın ARKASINA geç (geri vites)'; } }
  if (!pr && inStation) pr = '⛽ Petrol istasyonu — turbo doluyor';
  $('prompt').innerHTML = pr;
  // minimap
  const g = miniCtx; g.drawImage(miniBase, 0, 0); const mx = x => 100 + x * MS, mz = z => 100 + z * MS;
  for (const j of jobs) { const c = j.car, pul = 4 + 2 * Math.sin(time * 5); g.fillStyle = j.kind === 'service' ? '#ff8a1f' : '#35b8ff'; g.beginPath(); g.arc(clamp(mx(c.x), 6, 194), clamp(mz(c.z), 6, 194), j.state === 'towing' ? 3 : pul, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = '#ff4040'; for (const w of wrecks) if (!w.pl) g.fillRect(mx(w.x) - 1.5, mz(w.z) - 1.5, 3, 3);
  g.save(); g.translate(clamp(mx(truck.x), 8, 192), clamp(mz(truck.z), 8, 192)); g.rotate(truck.h); g.fillStyle = '#ffe14a'; g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -4.5); g.lineTo(-5, 4.5); g.closePath(); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); g.restore();
}

/* ---------- Ana döngü ---------- */
let last = performance.now();
function stepGame(dt) {
  time += dt; lastDt = Math.max(dt, 1e-3);
  shift.left -= dt; if (shift.left <= 0) { shift.left = 0; endShift(); return; }
  updateTruck(dt); stationStep(dt); checkRedLight(dt); collideTruckStatic(); updateTow(dt);
  ais.forEach(v => { updateAI(v, dt); collideStatic(v); });
  for (const j of jobs.slice()) { const c = j.car; if (!c.towed) { updateFree(c, dt); collideStatic(c); } if (j.state === 'towing') j.left -= dt; else if (j.state === 'waiting') { j.ttl -= dt; if (j.ttl <= 0) { toast('Çağrı iptal oldu (#' + j.id + ')', 'bad'); removeJob(j, 0); } } }
  hwCars.forEach(v => updateHw(v, dt));
  for (const w of wrecks) { updateFree(w, dt); collideStatic(w); }
  breakdownStep(dt);
  collideVehicles(); updateCones(dt); stepPeds(dt); stepHelis(dt); stepTexas(dt); stepParts(dt);
  for (let i = spawnQ.length - 1; i >= 0; i--) { spawnQ[i] -= dt; if (spawnQ[i] <= 0) { spawnQ.splice(i, 1); spawnJob(); } }
  syncVisuals(dt); updateCamera(dt); updateHUD();
}
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (state === 'play' && !paused) stepGame(dt);
  else if (state === 'title' || state === 'over') {
    time += dt; lastDt = Math.max(dt, 1e-3); const a = time * 0.07; camera.position.set(Math.cos(a) * 60, 22, Math.sin(a) * 60); camera.lookAt(0, 6, 0); sky.position.copy(camera.position); stepParts(dt); stepHelis(dt); stepTexas(dt); syncVisuals(dt); groundArrow.visible = false; arrowLabel.visible = false;
    if (prTruck && state === 'title' && !$('title').hidden) { prTruck.g.rotation.y = time * 0.35; prRenderer.render(prScene, prCam); }
  } else time += dt;
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
buildWorld(); resetShift(); showTitle(); requestAnimationFrame(frame);
window.__dbg = { stations, boxes, cargohubs, posts, banks, firestations, hospitals, stations, shops, chimneys, helis, wrecks, setTime(t) { time = t; }, getTime: () => time, peds, step: stepGame, truck, jobs: () => jobs, shift, zones, startShift, toggleHook, get state() { return state; }, ais, keys };
