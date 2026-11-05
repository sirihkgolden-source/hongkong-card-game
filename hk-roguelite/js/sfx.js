/**
 * 極簡 WebAudio stub（無音檔）— 出牌 click／命中／受擊／擋
 */

let ctx = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function beep(freq, durMs, type = "square", gain = 0.04) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + durMs / 1000);
  o.start(t);
  o.stop(t + durMs / 1000 + 0.02);
}

export const sfx = {
  click() {
    beep(880, 40, "square", 0.035);
  },
  whoosh() {
    beep(220, 50, "triangle", 0.025);
  },
  hit() {
    beep(140, 55, "square", 0.05);
    setTimeout(() => beep(90, 40, "sawtooth", 0.03), 30);
  },
  block() {
    beep(520, 45, "triangle", 0.04);
  },
  hurt() {
    beep(110, 70, "sawtooth", 0.055);
  },
  kuaisou() {
    beep(660, 40, "square", 0.04);
    setTimeout(() => beep(990, 50, "square", 0.035), 45);
  },
  win() {
    beep(523, 60, "triangle", 0.04);
    setTimeout(() => beep(659, 70, "triangle", 0.04), 70);
  },
  lose() {
    beep(160, 120, "sawtooth", 0.045);
  },
};
