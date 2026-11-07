/**
 * 橫版對打試玩：左阿油／右後巷影。
 * 出牌用本機 GSAP timeline：前衝 → Canvas 砍擊 → 受擊震動閃紅 → 飄字 → 回位 → 更新血條。
 * 唔改主遊戲戰鬥循環；零 CDN。
 */
import { CHARACTERS, CARDS, enemyById } from "./data.js?v=16";
import { sfx, isMuted, toggleMuted } from "./sfx.js";

const gsap = window.gsap;
const HAND_IDS = ["S01", "S15", "S07"];
const IDLE_FRAME = 0;
const KICK_FRAMES = [0, 1, 2, 3, 4, 5];
const KICK_HIT = 4;
const PUNCH_FRAMES = [6, 7, 8, 9, 10, 11];
const PUNCH_HIT = 1;
const FRAME_STEP = 0.12;

const SPRITE_BY_CHAR = {
  oil: {
    src: "assets/art/sprites/oil_default.jpg",
    cols: 6,
    rows: 2,
    key: "paper",
  },
  asan: {
    src: "assets/art/sprites/asan_default.png",
    cols: 6,
    rows: 2,
    key: "alpha",
  },
};

const params = new URLSearchParams(location.search);
const charId = params.get("char") === "asan" ? "asan" : "oil";
const player = CHARACTERS[charId] || CHARACTERS.oil;
const sheet = SPRITE_BY_CHAR[player.id] || SPRITE_BY_CHAR.oil;
const SPRITE_SRC = player.sprite || sheet.src;
const SPRITE_COLS = player.spriteCols || sheet.cols;
const SPRITE_ROWS = player.spriteRows || sheet.rows;
const SPRITE_KEY = player.spriteKey || sheet.key;
const enemyDef = enemyById("E01");

const state = {
  playerHp: player.maxHp,
  playerMax: player.maxHp,
  enemyHp: enemyDef.hp,
  enemyMax: enemyDef.hp,
  busy: false,
  over: false,
};

const $ = (id) => document.getElementById(id);

const canvas = $("fx-canvas");
const ctx = canvas.getContext("2d");
const stage = $("stage");
const actorPlayer = $("actor-player");
const actorEnemy = $("actor-enemy");
const enemyFlash = $("enemy-flash");

const rain = Array.from({ length: 56 }, () => ({
  x: Math.random(),
  y: Math.random(),
  len: 10 + Math.random() * 14,
  spd: 0.006 + Math.random() * 0.01,
}));
const slashes = [];
let sparks = [];

/** 6×2 sprite sheet：用紙白去背，再以 12 個連通色塊各裁一格（唔用均分格，免鞋落到第二排頭頂） */
const sprite = {
  sheet: null,
  ready: false,
  frame: IDLE_FRAME,
  frames: [],
  layoutW: 1,
  layoutH: 1,
  maxLeft: 0,
};

function isKnockableFringe(r, g, b, distToInk) {
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  const sat = maxv - minv;
  if (avg >= 224 && sat <= 24) return true;
  if (avg >= 165 && sat <= 42 && distToInk <= 4) return true;
  if (minv >= 190 && distToInk <= 3) return true;
  return false;
}

function knockOutWhite(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const { width, height } = c;
  const count = width * height;
  if (SPRITE_KEY === "alpha") {
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 16) {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = 0;
      }
    }
    x.putImageData(data, 0, 0);
    return c;
  }
  const dist = new Uint16Array(count);
  dist.fill(65535);
  const queue = [];
  let qh = 0;
  for (let y = 0; y < height; y += 1) {
    for (let col = 0; col < width; col += 1) {
      const i = (y * width + col) * 4;
      if ((px[i] + px[i + 1] + px[i + 2]) / 3 <= 90) {
        dist[y * width + col] = 0;
        queue.push(col, y);
      }
    }
  }
  while (qh < queue.length) {
    const cx = queue[qh];
    const cy = queue[qh + 1];
    qh += 2;
    const nd = dist[cy * width + cx] + 1;
    const nbs = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
    for (let k = 0; k < 8; k += 2) {
      const nx = nbs[k];
      const ny = nbs[k + 1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = ny * width + nx;
      if (dist[idx] <= nd) continue;
      dist[idx] = nd;
      queue.push(nx, ny);
    }
  }
  const seen = new Uint8Array(count);
  const stack = [];
  const push = (x0, y0) => {
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;
    stack.push(x0, y0);
  };
  for (let x0 = 0; x0 < width; x0 += 1) {
    push(x0, 0);
    push(x0, height - 1);
  }
  for (let y0 = 0; y0 < height; y0 += 1) {
    push(0, y0);
    push(width - 1, y0);
  }
  while (stack.length) {
    const y0 = stack.pop();
    const x0 = stack.pop();
    const idx = y0 * width + x0;
    if (seen[idx]) continue;
    seen[idx] = 1;
    const i = idx * 4;
    if (px[i + 3] > 16 && !isKnockableFringe(px[i], px[i + 1], px[i + 2], dist[idx])) continue;
    px[i + 3] = 0;
    push(x0 + 1, y0);
    push(x0 - 1, y0);
    push(x0, y0 + 1);
    push(x0, y0 - 1);
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const kill = [];
    for (let y0 = 0; y0 < height; y0 += 1) {
      for (let x0 = 0; x0 < width; x0 += 1) {
        const idx = y0 * width + x0;
        const i = idx * 4;
        if (px[i + 3] <= 16) continue;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const avg = (r + g + b) / 3;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (avg < 170 || sat > 48) continue;
        const nbs = [x0 + 1, y0, x0 - 1, y0, x0, y0 + 1, x0, y0 - 1];
        let edge = false;
        for (let k = 0; k < 8; k += 2) {
          const nx = nbs[k];
          const ny = nbs[k + 1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || px[(ny * width + nx) * 4 + 3] <= 16) {
            edge = true;
            break;
          }
        }
        if (edge) kill.push(idx);
      }
    }
    for (const idx of kill) px[idx * 4 + 3] = 0;
  }
  for (let y0 = 0; y0 < height; y0 += 1) {
    for (let x0 = 0; x0 < width; x0 += 1) {
      const i = (y0 * width + x0) * 4;
      if (px[i + 3] <= 16) continue;
      const nbs = [
        x0 + 1, y0, x0 - 1, y0, x0, y0 + 1, x0, y0 - 1,
        x0 + 1, y0 + 1, x0 - 1, y0 - 1, x0 + 1, y0 - 1, x0 - 1, y0 + 1,
      ];
      let edge = false;
      for (let k = 0; k < 16; k += 2) {
        const nx = nbs[k];
        const ny = nbs[k + 1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || px[(ny * width + nx) * 4 + 3] <= 16) {
          edge = true;
          break;
        }
      }
      if (!edge) continue;
      const avg = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (avg <= 110) continue;
      const f = avg >= 180 ? 0.42 : avg >= 140 ? 0.55 : 0.72;
      px[i] = Math.round(px[i] * f);
      px[i + 1] = Math.round(px[i + 1] * f);
      px[i + 2] = Math.round(px[i + 2] * f);
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) {
      px[i] = 0;
      px[i + 1] = 0;
      px[i + 2] = 0;
    }
  }
  x.putImageData(data, 0, 0);
  return c;
}

function findCharacterBlobs(px, width, height) {
  const seen = new Uint8Array(width * height);
  const labels = new Uint16Array(width * height);
  const blobs = [];
  const stack = [];
  let nextId = 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start] || px[start * 4 + 3] <= 16) continue;
      const id = nextId;
      nextId += 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let n = 0;
      let footSum = 0;
      let footN = 0;
      stack.push(x, y);
      seen[start] = 1;
      while (stack.length) {
        const cy = stack.pop();
        const cx = stack.pop();
        const idx = cy * width + cx;
        labels[idx] = id;
        n += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const next = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
        for (let k = 0; k < 8; k += 2) {
          const nx = next[k];
          const ny = next[k + 1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (seen[ni] || px[ni * 4 + 3] <= 16) continue;
          seen[ni] = 1;
          stack.push(nx, ny);
        }
      }
      if (n < 400) continue;
      const footY0 = maxY - Math.max(6, Math.floor((maxY - minY) * 0.12));
      for (let fy = footY0; fy <= maxY; fy += 1) {
        for (let fx = minX; fx <= maxX; fx += 1) {
          if (labels[fy * width + fx] === id) {
            footSum += fx;
            footN += 1;
          }
        }
      }
      blobs.push({
        id,
        minX,
        minY,
        maxX,
        maxY,
        n,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        footX: footN ? footSum / footN : (minX + maxX) / 2,
      });
    }
  }
  return { blobs, labels };
}

function orderSheetFrames(blobs) {
  const topN = SPRITE_COLS * SPRITE_ROWS;
  const ranked = blobs.slice().sort((a, b) => b.n - a.n).slice(0, topN);
  const meanY = ranked.reduce((s, b) => s + b.cy, 0) / Math.max(1, ranked.length);
  const top = ranked.filter((b) => b.cy < meanY).sort((a, b) => a.cx - b.cx);
  const bot = ranked.filter((b) => b.cy >= meanY).sort((a, b) => a.cx - b.cx);
  return top.concat(bot);
}

function isInteriorPaper(r, g, b, a) {
  if (a <= 16) return false;
  const avg = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return avg >= 230 && sat <= 28;
}

function isPocketFringe(r, g, b, a) {
  if (a <= 16) return false;
  const avg = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return (avg >= 200 && sat <= 45) || Math.min(r, g, b) >= 188;
}

/** 清踢腿夾縫入面嘅封閉紙白；下半截白襪唔郁。 */
function clearEnclosedPaper(px, sw, sh) {
  const seen = new Uint8Array(sw * sh);
  const sockY = Math.floor(sh * 0.55);
  const punched = [];
  const stack = [];
  for (let y = 0; y < sh; y += 1) {
    for (let col = 0; col < sw; col += 1) {
      const idx = y * sw + col;
      if (seen[idx]) continue;
      const i = idx * 4;
      if (!isInteriorPaper(px[i], px[i + 1], px[i + 2], px[i + 3])) {
        seen[idx] = 1;
        continue;
      }
      const cells = [];
      let sumY = 0;
      stack.push(col, y);
      seen[idx] = 1;
      while (stack.length) {
        const cy = stack.pop();
        const cx = stack.pop();
        cells.push(cx, cy);
        sumY += cy;
        const nbs = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
        for (let k = 0; k < 8; k += 2) {
          const nx = nbs[k];
          const ny = nbs[k + 1];
          if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
          const ni = ny * sw + nx;
          if (seen[ni]) continue;
          const j = ni * 4;
          if (!isInteriorPaper(px[j], px[j + 1], px[j + 2], px[j + 3])) continue;
          seen[ni] = 1;
          stack.push(nx, ny);
        }
      }
      const cy = sumY / Math.max(1, cells.length / 2);
      if (cy >= sockY) continue;
      for (let k = 0; k < cells.length; k += 2) {
        const j = (cells[k + 1] * sw + cells[k]) * 4;
        px[j] = 0;
        px[j + 1] = 0;
        px[j + 2] = 0;
        px[j + 3] = 0;
        punched.push(cells[k], cells[k + 1]);
      }
    }
  }
  const reached = new Uint8Array(sw * sh);
  const queue = punched;
  let qh = 0;
  for (let p = 0; p < punched.length; p += 2) {
    reached[punched[p + 1] * sw + punched[p]] = 1;
  }
  while (qh < queue.length) {
    const cx = queue[qh];
    const cy = queue[qh + 1];
    qh += 2;
    const nbs = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
    for (let k = 0; k < 8; k += 2) {
      const nx = nbs[k];
      const ny = nbs[k + 1];
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
      const ni = ny * sw + nx;
      if (reached[ni]) continue;
      const j = ni * 4;
      if (!isPocketFringe(px[j], px[j + 1], px[j + 2], px[j + 3])) continue;
      reached[ni] = 1;
      px[j] = 0;
      px[j + 1] = 0;
      px[j + 2] = 0;
      px[j + 3] = 0;
      queue.push(nx, ny);
    }
  }
}

function stampFrame(sheet, labels, blob) {
  const pad = 4;
  const sx = Math.max(0, blob.minX - pad);
  const sy = Math.max(0, blob.minY - pad);
  const ex = Math.min(sheet.width, blob.maxX + pad + 1);
  const ey = Math.min(sheet.height, blob.maxY + pad + 1);
  const sw = ex - sx;
  const sh = ey - sy;
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const x = c.getContext("2d");
  x.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = x.getImageData(0, 0, sw, sh);
  const px = data.data;
  for (let y = 0; y < sh; y += 1) {
    for (let col = 0; col < sw; col += 1) {
      const src = labels[(sy + y) * sheet.width + (sx + col)];
      if (src !== blob.id) {
        const j = (y * sw + col) * 4;
        px[j] = 0;
        px[j + 1] = 0;
        px[j + 2] = 0;
        px[j + 3] = 0;
      }
    }
  }
  if (SPRITE_KEY === "paper") clearEnclosedPaper(px, sw, sh);
  x.putImageData(data, 0, 0);
  return {
    canvas: c,
    sw,
    sh,
    footX: blob.footX - sx,
  };
}

function loadSprite() {
  return new Promise((resolve, reject) => {
    if (!SPRITE_SRC) {
      reject(new Error("未設定動作表路徑"));
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        sprite.sheet = knockOutWhite(img);
        const { width, height } = sprite.sheet;
        const px = sprite.sheet.getContext("2d").getImageData(0, 0, width, height).data;
        const { blobs, labels } = findCharacterBlobs(px, width, height);
        const ordered = orderSheetFrames(blobs);
        sprite.frames = ordered.map((blob) => stampFrame(sprite.sheet, labels, blob));
        sprite.maxLeft = Math.max(1, ...sprite.frames.map((f) => f.footX));
        const maxRight = Math.max(1, ...sprite.frames.map((f) => f.sw - f.footX));
        sprite.layoutW = sprite.maxLeft + maxRight;
        sprite.layoutH = Math.max(1, ...sprite.frames.map((f) => f.sh));
        sprite.ready = sprite.frames.length > 0;
        const qf = Number.parseInt(new URLSearchParams(location.search).get("f") || "", 10);
        const start =
          Number.isInteger(qf) && qf >= 0 && qf < sprite.frames.length ? qf : IDLE_FRAME;
        drawPlayerFrame(start);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("sprite sheet 載入失敗"));
    img.src = SPRITE_SRC;
  });
}

function drawPlayerFrame(currentFrame) {
  if (!sprite.ready) return;
  sprite.frame = currentFrame;
  const frame = sprite.frames[currentFrame];
  if (!frame) return;
  const canvasEl = $("player-sprite");
  const x = canvasEl.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const boxH = actorPlayer.clientHeight || stage.clientHeight;
  const destH = Math.max(1, Math.round(boxH * 0.96));
  const scale = destH / sprite.layoutH;
  const destW = Math.max(1, Math.round(sprite.layoutW * scale));
  canvasEl.width = Math.max(1, Math.floor(destW * dpr));
  canvasEl.height = Math.max(1, Math.floor(destH * dpr));
  canvasEl.style.width = `${destW}px`;
  canvasEl.style.height = `${destH}px`;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.clearRect(0, 0, destW, destH);
  const dw = Math.max(1, Math.round(frame.sw * scale));
  const dh = Math.max(1, Math.round(frame.sh * scale));
  const dx = Math.round((sprite.maxLeft - frame.footX) * scale);
  const dy = Math.round(destH - dh);
  x.drawImage(frame.canvas, 0, 0, frame.sw, frame.sh, dx, dy, dw, dh);
}

function playClip(frames, step = FRAME_STEP) {
  const tl = gsap.timeline();
  frames.forEach((f, i) => {
    tl.call(() => drawPlayerFrame(f), null, i * step);
  });
  return tl;
}

function resizeCanvas() {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (sprite.ready) drawPlayerFrame(sprite.frame);
}

function enemyAnchor() {
  const s = stage.getBoundingClientRect();
  const e = actorEnemy.getBoundingClientRect();
  return {
    x: e.left - s.left + e.width * 0.45,
    y: e.top - s.top + e.height * 0.42,
  };
}

function drawRain(w, h) {
  ctx.strokeStyle = "rgba(180, 210, 255, 0.28)";
  ctx.lineWidth = 1;
  for (const d of rain) {
    const x = d.x * w;
    const y = d.y * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y + d.len);
    ctx.stroke();
    d.y += d.spd;
    if (d.y > 1) {
      d.y = -0.05;
      d.x = Math.random();
    }
  }
}

function drawSlash(slash, w, h) {
  const a = enemyAnchor();
  const t = slash.t;
  const alpha = 1 - t;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(slash.rot);
  ctx.strokeStyle =
    slash.kind === "heavy"
      ? `rgba(255, 45, 149, ${0.95 * alpha})`
      : `rgba(61, 224, 255, ${0.95 * alpha})`;
  ctx.shadowColor = slash.kind === "heavy" ? "#ff2d95" : "#3de0ff";
  ctx.shadowBlur = 18;
  ctx.lineWidth = (slash.kind === "heavy" ? 11 : 7) * (1 - t * 0.4);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, 28 + t * 62, -0.2, Math.PI * 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, -6, 18 + t * 40, 0.1, Math.PI * 0.8);
  ctx.stroke();
  ctx.restore();
  void w;
  void h;
}

function drawSparks(w, h) {
  const next = [];
  for (const p of sparks) {
    ctx.fillStyle = `rgba(255, 230, 210, ${p.a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.a -= 0.035;
    p.r *= 0.96;
    if (p.a > 0) next.push(p);
  }
  sparks = next;
  void w;
  void h;
}

function tick() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  ctx.clearRect(0, 0, w, h);
  drawRain(w, h);
  for (const s of slashes) drawSlash(s, w, h);
  drawSparks(w, h);
  requestAnimationFrame(tick);
}

function spawnSlash(kind) {
  const slash = { t: 0, kind, rot: kind === "heavy" ? -0.85 : -0.55 };
  slashes.push(slash);
  gsap.to(slash, {
    t: 1,
    duration: 0.34,
    ease: "power2.out",
    onComplete: () => {
      const i = slashes.indexOf(slash);
      if (i >= 0) slashes.splice(i, 1);
    },
  });
  const a = enemyAnchor();
  for (let i = 0; i < 14; i += 1) {
    const ang = -Math.PI * 0.2 - Math.random() * 1.2;
    const spd = 2.2 + Math.random() * 3.4;
    sparks.push({
      x: a.x,
      y: a.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 1.6 + Math.random() * 2.2,
      a: 0.95,
    });
  }
}

function floatDamage(amount, crit) {
  const pop = document.createElement("span");
  pop.className = `dmg-pop ${crit ? "is-red" : "is-white"}`;
  pop.textContent = `-${amount}`;
  const s = stage.getBoundingClientRect();
  const e = actorEnemy.getBoundingClientRect();
  pop.style.left = `${e.left - s.left + e.width * 0.35}px`;
  pop.style.top = `${e.top - s.top - 8}px`;
  stage.appendChild(pop);
  gsap.fromTo(
    pop,
    { y: 0, opacity: 1, scale: 0.7 },
    {
      y: -56,
      opacity: 0,
      scale: 1.15,
      duration: 0.72,
      ease: "power2.out",
      onComplete: () => pop.remove(),
    }
  );
}

function setHpBar(fillEl, textEl, hp, max, fromRight) {
  const pct = Math.max(0, (hp / max) * 100);
  textEl.textContent = `${Math.max(0, hp)}/${max}`;
  gsap.to(fillEl, {
    width: `${pct}%`,
    duration: 0.28,
    ease: "power1.out",
  });
  void fromRight;
}

function shake(el, power) {
  return gsap
    .timeline()
    .to(el, { x: power, y: power * 0.35, duration: 0.04 })
    .to(el, { x: -power * 0.8, y: -power * 0.2, duration: 0.05 })
    .to(el, { x: power * 0.45, y: power * 0.15, duration: 0.05 })
    .to(el, { x: 0, y: 0, duration: 0.08 });
}

function dashDistance() {
  const p = actorPlayer.getBoundingClientRect();
  const e = actorEnemy.getBoundingClientRect();
  return Math.max(80, e.left - p.right - 12);
}

function playSkill(card) {
  if (state.busy || state.over) return;
  state.busy = true;
  setHandEnabled(false);
  sfx.card();
  sfx.whoosh();

  const dmg = card.dmg || 5;
  const heavy = dmg >= 14;
  const dashX = dashDistance();
  const frames = heavy ? KICK_FRAMES : PUNCH_FRAMES;
  const hitIndex = heavy ? KICK_HIT : PUNCH_HIT;
  const clip = playClip(frames);
  const hitAt = hitIndex * FRAME_STEP;

  const tl = gsap.timeline({
    onComplete: () => {
      drawPlayerFrame(IDLE_FRAME);
      state.busy = false;
      if (!state.over) setHandEnabled(true);
    },
  });

  tl.add(clip, 0)
    .to(
      actorPlayer,
      {
        x: dashX,
        duration: hitAt,
        ease: "power3.in",
      },
      0
    )
    .add(() => {
      spawnSlash(heavy ? "heavy" : "slash");
      sfx.hit();
      sfx.hurt();
      gsap.fromTo(
        enemyFlash,
        { opacity: 0.85 },
        { opacity: 0, duration: 0.22, ease: "power1.out" }
      );
      shake(actorEnemy, heavy ? 14 : 8);
      shake(stage, heavy ? 7 : 4);
      const next = Math.max(0, state.enemyHp - dmg);
      state.enemyHp = next;
      floatDamage(dmg, heavy);
      setHpBar($("enemy-hp-fill"), $("enemy-hp-text"), next, state.enemyMax, true);
      if (next <= 0) {
        state.over = true;
        gsap.to(actorEnemy, { opacity: 0.28, filter: "grayscale(0.8)", duration: 0.35 });
        const banner = $("banner");
        banner.hidden = false;
        banner.textContent = "影散咗。巷尾仲有幾滴未乾——你行得過。";
        sfx.win();
      }
    }, hitAt)
    .to(actorPlayer, {
      x: 0,
      duration: 0.45,
      ease: "power2.out",
    });
}

function setHandEnabled(on) {
  for (const btn of document.querySelectorAll(".skill-card")) {
    btn.disabled = !on || state.over;
  }
}

function renderHand() {
  const hand = $("hand");
  hand.innerHTML = HAND_IDS.map((id) => {
    const c = CARDS[id];
    return `<button type="button" class="skill-card" data-card="${c.id}">
      <img src="${c.art}" alt="" />
      <span class="card-name">${c.name}</span>
      <span class="card-stats">傷 ${c.dmg}</span>
    </button>`;
  }).join("");
  hand.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".skill-card");
    if (!btn || btn.disabled) return;
    const card = CARDS[btn.dataset.card];
    if (card) playSkill(card);
  });
}

function bindMute() {
  const btn = $("btn-mute");
  const sync = () => {
    const m = isMuted();
    btn.textContent = m ? "已靜音" : "音效開";
    btn.setAttribute("aria-pressed", m ? "true" : "false");
  };
  btn.addEventListener("click", () => {
    toggleMuted();
    sync();
  });
  sync();
}

async function boot() {
  $("player-name").textContent = player.name;
  const spriteEl = $("player-sprite");
  if (spriteEl) spriteEl.setAttribute("aria-label", player.name);
  for (const link of document.querySelectorAll(".char-switch a")) {
    link.classList.toggle("is-on", link.dataset.char === player.id);
  }
  $("enemy-name").textContent = enemyDef.name;
  $("enemy-art").src = enemyDef.art;
  $("player-hp-fill").style.width = "100%";
  $("enemy-hp-fill").style.width = "100%";
  $("player-hp-text").textContent = `${state.playerHp}/${state.playerMax}`;
  $("enemy-hp-text").textContent = `${state.enemyHp}/${state.enemyMax}`;
  renderHand();
  bindMute();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  tick();
  try {
    await loadSprite();
  } catch {
    $("banner").hidden = false;
    $("banner").textContent = `動作表未載入——確認 ${SPRITE_SRC}。`;
  }
}

if (!gsap) {
  $("banner").hidden = false;
  $("banner").textContent = "GSAP 未載入——請用本機 http.server 開 arena.html。";
} else {
  boot();
}
