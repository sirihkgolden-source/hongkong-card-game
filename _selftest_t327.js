const fs = require("fs");
const path = require("path");
const root = __dirname;
const dataJs = fs.readFileSync(path.join(root, "data.js"), "utf8");
const dataJson = fs.readFileSync(path.join(root, "data.json"), "utf8");
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function loadData() {
  const body = dataJs.replace(/^window\.HK_SLICE_DATA\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(body);
}
const DATA = loadData();
const JSONDATA = JSON.parse(dataJson);

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name); }
}

const neon = (DATA.story_packs || []).find((p) => p.id === "neon_mei_wan");
ok("pack status available", neon && neon.status === "available");
ok("pack event_ids EV46-48", neon && Array.isArray(neon.event_ids) &&
  neon.event_ids.includes("EV46") && neon.event_ids.includes("EV47") && neon.event_ids.includes("EV48"));
ok("pack blurb 霓虹", neon && /缺劃燈管仍閃/.test(neon.blurb || ""));
ok("pack cover path", neon && neon.cover === "assets/story-packs/neon-mei-wan.jpg");
ok("cover file exists", fs.existsSync(path.join(root, "assets/story-packs/neon-mei-wan.jpg")));

for (const id of ["EV46", "EV47", "EV48"]) {
  const ev = (DATA.events || []).find((e) => e.id === id);
  ok(id + " exists", !!ev);
  ok(id + " story_pack_id", ev && ev.story_pack_id === "neon_mei_wan");
}
const ev46 = (DATA.events || []).find((e) => e.id === "EV46");
const ev47 = (DATA.events || []).find((e) => e.id === "EV47");
const ev48 = (DATA.events || []).find((e) => e.id === "EV48");
ok("EV46 main+battle E03", ev46 && ev46.category === "main" && ev46.battle === "E03");
ok("EV47 main+battle E04", ev47 && ev47.category === "main" && ev47.battle === "E04");
ok("EV48 minigame memory_pads", ev48 && ev48.category === "minigame" &&
  ev48.minigame && ev48.minigame.kind === "memory_pads" &&
  ev48.minigame.rounds === 3 && ev48.minigame.pad_count === 4 &&
  ev48.minigame.time_limit_sec === 35);
ok("EV48 flag_on_win", ev48 && ev48.flag_on_win === "neon_tube_clear");
ok("EV48 attrs luck", ev48 && ev48.attrs_delta && ev48.attrs_delta.luck === 1);
ok("EV48 reward_gold", ev48 && ev48.reward_gold === 4);

ok("index ?v=t327-1", /\?v=t327-1/.test(idx));
ok("machine-ref ?v=t327-1", /machine-ref\.webp\?v=t327-1/.test(app));
ok("app prefer pack minigame", /mgPref/.test(app) && /boostMg/.test(app));

// sync keywords between data.js and data.json
for (const kw of ["neon_mei_wan", "EV46", "EV47", "EV48", "neon_tube_clear", "缺劃燈箱", "雨夜燈海", "燈管記憶"]) {
  ok("sync js+json " + kw, dataJs.includes(kw) && dataJson.includes(kw));
}
ok("json pack available", ((JSONDATA.story_packs || []).find((p) => p.id === "neon_mei_wan") || {}).status === "available");
ok("only two story packs", (DATA.story_packs || []).length === 2);

console.log(fail ? `FAIL ${fail}` : `ALL PASS ${pass}/${pass}`);
process.exit(fail ? 1 : 0);
