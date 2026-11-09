#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
let fail = 0;
function ok(c, m) { if (!c) { console.error("FAIL", m); fail++; } else console.log("OK", m); }

const fates = data.fates || [];
ok(fates.length >= 20, "fates present");
for (const f of fates) {
  const fx = f.effects || {};
  ok(fx.soul == null || fx.soul === 0, f.id + " no soul");
  ok(!(typeof fx.gold === "number" && fx.gold < 0), f.id + " no gold penalty");
}
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
ok(!/if \(typeof fx\.soul === "number"\) state\.soul/.test(app), "applyFate no longer adds soul");
ok(app.includes("命運嚴禁動 meta 膠幣") || app.includes("t452"), "t452 guard comment");
ok(app.includes("have > 0") && app.includes("fx.gold"), "gold loss gated");

const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
ok(/t452-/.test(idx), "cache bust t452");

console.log(fail ? `\n${fail} failures` : "\nALL PASS");
process.exit(fail ? 1 : 0);
