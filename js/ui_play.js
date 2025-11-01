import { OFF_SLOTS, DEF_SLOTS, EXP_OPTIONS } from "./constants.js";
import { toRating, fromRating, randOf } from "./rng.js";
import { resolveSide, finalizeScore, resolveTieByCoaches } from "./engine.js";

export function fillRatingSelect(sel){
  sel.innerHTML = "";
  [["-","–"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"]].forEach(([val,txt])=>{
    const opt = document.createElement("option"); opt.value = val; opt.textContent = txt; sel.appendChild(opt);
  });
}
export function fillCoachTypeSelect(sel){
  sel.innerHTML = "";
  [["-","–"],["OFF","Off"],["DEF","Def"]].forEach(([val,txt])=>{
    const opt = document.createElement("option"); opt.value = val; opt.textContent = txt; sel.appendChild(opt);
  });
}
export function fillExpSelect(sel){
  sel.innerHTML = "";
  EXP_OPTIONS.forEach(v=>{
    const opt = document.createElement("option"); opt.value = v; opt.textContent = v; sel.appendChild(opt);
  });
}

export function fillAllPlaySelects(){
  const ids = [];
  OFF_SLOTS.forEach(s=>{ ids.push(`home_${s}_o1`,`home_${s}_o2`,`away_${s}_o1`,`away_${s}_o2`); });
  DEF_SLOTS.forEach(s=>{ ids.push(`home_${s}_d1`,`home_${s}_d2`,`away_${s}_d1`,`away_${s}_d2`); });
  ids.forEach(id=> fillRatingSelect(document.getElementById(id)));
  ["home_COACH_r1","home_COACH_r2","away_COACH_r1","away_COACH_r2"].forEach(id=> fillRatingSelect(document.getElementById(id)));
  ["home_COACH_t1","home_COACH_t2","away_COACH_t1","away_COACH_t2"].forEach(id=> fillCoachTypeSelect(document.getElementById(id)));
  const expIds = []; ["home","away"].forEach(side=>{
    [...OFF_SLOTS, ...DEF_SLOTS].forEach(s=> expIds.push(`${side}_${s}_exp`));
    expIds.push(`${side}_COACH_exp`);
  }); expIds.forEach(id => fillExpSelect(document.getElementById(id)));
}

export function neutralDefaultsPlay(){
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`home_${slot}_o1`).value="2";
    document.getElementById(`home_${slot}_o2`).value="-";
    document.getElementById(`away_${slot}_o1`).value="2";
    document.getElementById(`away_${slot}_o2`).value="-";
    document.getElementById(`home_${slot}_exp`).value="FR";
    document.getElementById(`away_${slot}_exp`).value="FR";
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`home_${slot}_d1`).value="2";
    document.getElementById(`home_${slot}_d2`).value="-";
    document.getElementById(`away_${slot}_d1`).value="2";
    document.getElementById(`away_${slot}_d2`).value="-";
    document.getElementById(`home_${slot}_exp`).value="FR";
    document.getElementById(`away_${slot}_exp`).value="FR";
  });
  ["home","away"].forEach(side=>{
    document.getElementById(`${side}Name`).value = side==="home"?"Home":"Away";
    document.getElementById(`${side}_COACH_t1`).value="-";
    document.getElementById(`${side}_COACH_t2`).value="-";
    document.getElementById(`${side}_COACH_r1`).value="-";
    document.getElementById(`${side}_COACH_r2`).value="-";
    document.getElementById(`${side}_COACH_exp`).value="JR";
    ["QB","RB","WR","OL","DL","LB","DB"].forEach(p=>{ document.getElementById(`${side}_${p}_name`).value = ""; });
    document.getElementById(`${side}_COACH_name`).value = "";
  });
  document.getElementById("homeLabel").textContent = "Home";
  document.getElementById("awayLabel").textContent = "Away";
}

function randomPickOrDash(probDash){
  if (Math.random()<probDash) return "-";
  const r = Math.random();
  if (r < 0.15) return "0";
  if (r < 0.55) return "2";
  if (r < 0.80) return "1";
  if (r < 0.95) return "3";
  return "4";
}
function randomCoachType(){ const r = Math.random(); if (r < 0.35) return "OFF"; if (r < 0.70) return "DEF"; if (r < 0.85) return "-"; return "OFF"; }

export function randomizeSide(side){
  document.getElementById(`${side}_QB_name`).value = "";
  document.getElementById(`${side}_RB_name`).value = "";
  document.getElementById(`${side}_WR_name`).value = "";
  document.getElementById(`${side}_OL_name`).value = "Off Line";
  document.getElementById(`${side}_DL_name`).value = "D-Line";
  document.getElementById(`${side}_LB_name`).value = "Linebackers";
  document.getElementById(`${side}_DB_name`).value = "Secondary";
  document.getElementById(`${side}_COACH_name`).value = "";

  [...["QB","RB","WR","OL","DL","LB","DB"].map(p=>`${side}_${p}_exp`), `${side}_COACH_exp`]
    .forEach(id=>{
      const el = document.getElementById(id);
      el.value = id.endsWith("_COACH_exp") ? "JR" : randOf(["FR","SO","JR","SR"]);
    });

  ["QB","RB","WR","OL"].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o1`).value = randomPickOrDash(0.15);
    document.getElementById(`${side}_${slot}_o2`).value = randomPickOrDash(0.40);
  });
  ["DL","LB","DB"].forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = randomPickOrDash(0.15);
    document.getElementById(`${side}_${slot}_d2`).value = randomPickOrDash(0.40);
  });

  document.getElementById(`${side}_COACH_t1`).value = randomCoachType();
  document.getElementById(`${side}_COACH_t2`).value = randomCoachType();
  document.getElementById(`${side}_COACH_r1`).value = randomPickOrDash(0.20);
  document.getElementById(`${side}_COACH_r2`).value = randomPickOrDash(0.35);
}

export function clearSide(side){
  ["QB","RB","WR","OL"].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o1`).value = "-";
    document.getElementById(`${side}_${slot}_o2`).value = "-";
    document.getElementById(`${side}_${slot}_exp`).value = "FR";
    document.getElementById(`${side}_${slot}_name`).value = "";
  });
  ["DL","LB","DB"].forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = "-";
    document.getElementById(`${side}_${slot}_d2`).value = "-";
    document.getElementById(`${side}_${slot}_exp`).value = "FR";
    document.getElementById(`${side}_${slot}_name`).value = "";
  });
  document.getElementById(`${side}_COACH_name`).value = "";
  document.getElementById(`${side}_COACH_t1`).value="-";
  document.getElementById(`${side}_COACH_t2`).value="-";
  document.getElementById(`${side}_COACH_r1`).value="-";
  document.getElementById(`${side}_COACH_r2`).value="-";
  document.getElementById(`${side}_COACH_exp`).value="JR";
  document.getElementById(`${side}Name`).value = side==="home"?"Home":"Away";
}

export function collectSide(side){
  const name = document.getElementById(`${side}Name`).value.trim() || (side==="home"?"Home":"Away");
  const offense = {};
  ["QB","RB","WR","OL"].forEach(s=>{
    offense[s] = {
      name: document.getElementById(`${side}_${s}_name`).value.trim(),
      exp: document.getElementById(`${side}_${s}_exp`).value,
      o1: toRating(document.getElementById(`${side}_${s}_o1`).value),
      o2: toRating(document.getElementById(`${side}_${s}_o2`).value)
    };
  });
  const defense = {};
  ["DL","LB","DB"].forEach(s=>{
    defense[s] = {
      name: document.getElementById(`${side}_${s}_name`).value.trim(),
      exp: document.getElementById(`${side}_${s}_exp`).value,
      d1: toRating(document.getElementById(`${side}_${s}_d1`).value),
      d2: toRating(document.getElementById(`${side}_${s}_d2`).value)
    };
  });
  const coach = {
    name: document.getElementById(`${side}_COACH_name`).value.trim(),
    exp: document.getElementById(`${side}_COACH_exp`).value,
    t1: document.getElementById(`${side}_COACH_t1`).value,
    r1: toRating(document.getElementById(`${side}_COACH_r1`).value),
    t2: document.getElementById(`${side}_COACH_t2`).value,
    r2: toRating(document.getElementById(`${side}_COACH_r2`).value),
  };
  return { name, offense, defense, coach };
}

export function applyTeamToSide(team, side){
  document.getElementById(`${side}Name`).value = team.name || (side==="home"?"Home":"Away");
  ["QB","RB","WR","OL"].forEach(s=>{
    document.getElementById(`${side}_${s}_name`).value = team.offense[s].name || "";
    document.getElementById(`${side}_${s}_exp`).value = team.offense[s].exp || "FR";
    document.getElementById(`${side}_${s}_o1`).value = fromRating(team.offense[s].o1);
    document.getElementById(`${side}_${s}_o2`).value = fromRating(team.offense[s].o2);
  });
  ["DL","LB","DB"].forEach(s=>{
    document.getElementById(`${side}_${s}_name`).value = team.defense[s].name || "";
    document.getElementById(`${side}_${s}_exp`).value = team.defense[s].exp || "FR";
    document.getElementById(`${side}_${s}_d1`).value = fromRating(team.defense[s].d1);
    document.getElementById(`${side}_${s}_d2`).value = fromRating(team.defense[s].d2);
  });
  document.getElementById(`${side}_COACH_name`).value = team.coach.name || "";
  document.getElementById(`${side}_COACH_exp`).value = team.coach.exp || "JR";
  document.getElementById(`${side}_COACH_t1`).value = team.coach.t1 || "-";
  document.getElementById(`${side}_COACH_t2`).value = team.coach.t2 || "-";
  document.getElementById(`${side}_COACH_r1`).value = fromRating(team.coach.r1);
  document.getElementById(`${side}_COACH_r2`).value = fromRating(team.coach.r2);
  document.getElementById(`${side}Label`).textContent = team.name || (side==="home"?"Home":"Away");
}

// ------- Rendering helpers (EXPORTED) -------

function pill(text, type){ const cls = type || "neu"; return `<span class="pill ${cls}">${text}</span>`; }
function offPill(face, pts){ return pill(`d6:${face} → ${pts}`, pts===7?"ok":(pts===3?"warn":"neu")); }
function defPill(face, code){
  const label = code===1?"block":(code===7?"+7":(code===2?"+2":"0"));
  const t = code===1?"bad":(code===7||code===2?"ok":"neu");
  return pill(`d6:${face} → ${label}`, t);
}
function groupByPlayer(results, isOff){
  const map = new Map();
  for(const r of results){
    const key = `${r.slot}|${r.name||""}|${r.exp||""}`;
    if(!map.has(key)) map.set(key, { slot:r.slot, name:r.name||"", exp:r.exp||"", items:[] });
    map.get(key).items.push(isOff ? {face:r.face, pts:r.pts, rating:r.rating, which:r.which}
                                  : {face:r.face, code:r.code, rating:r.rating, which:r.which});
  }
  return [...map.values()];
}
function sectionHTML(title, small, playersHTML){
  return `<div class="break-section"><div class="break-header"><h4>${title}</h4><span class="small-muted">${small}</span></div>${playersHTML}</div>`;
}
function playersHTML(rows, isOff){
  if(rows.length===0) return `<div class="small-muted">—</div>`;
  return rows.map(p=>{
    const id = `<div class="player-id"><span class="badge">${p.slot}</span><strong>${p.name || p.slot}</strong><span class="badge">${p.exp || ""}</span></div>`;
    const pills = p.items.map(it=> isOff ? offPill(it.face,it.pts) : defPill(it.face,it.code)).join("");
    return `<div class="player-row">${id}<div class="pills">${pills}</div></div>`;
  }).join("");
}

export function buildBreakdownHTML(detail, oppDetail, fin){
  const offGrouped = groupByPlayer(detail.offResults, true);
  const defGrouped = groupByPlayer(detail.defResults, false);
  const offSec = sectionHTML("Offense Dice", `7s: ${detail.own7} • 3s: ${detail.own3} • Base: ${detail.ownBase}`, playersHTML(offGrouped, true));
  const defSec = sectionHTML("Defense Dice", `Blocks: ${detail.blocks} • Bonus: +${detail.bonus}`, playersHTML(defGrouped, false));
  const summary = `Base ${detail.ownBase} − blocks ${fin.canceledPoints} + defense bonus ${detail.bonus}`;
  const body = `<div class="breakdown">${offSec}${defSec}</div>`;
  return { summary, body };
}

// ------- Play tab wiring (unchanged) -------

export function wirePlayTab(tieLogFn){
  document.getElementById("rollAll").addEventListener("click", ()=>{
    const home = collectSide("home");
    const away = collectSide("away");
    const h = resolveSide(home);
    const a = resolveSide(away);
    const hf = finalizeScore(h, a);
    const af = finalizeScore(a, h);

    let homeScore = hf.final;
    let awayScore = af.final;

    if (homeScore === awayScore){
      const tieRes = resolveTieByCoaches(home, away, homeScore, awayScore, tieLogFn);
      homeScore = tieRes.home;
      awayScore = tieRes.away;
    }

    const hRender = buildBreakdownHTML(h, a, hf);
    const aRender = buildBreakdownHTML(a, h, af);
    document.getElementById("homeScore").textContent = homeScore;
    document.getElementById("awayScore").textContent = awayScore;
    document.getElementById("homeSummary").textContent = hRender.summary;
    document.getElementById("awaySummary").textContent = aRender.summary;
    document.getElementById("homeDetail").innerHTML = hRender.body;
    document.getElementById("awayDetail").innerHTML = aRender.body;
  });

  document.getElementById("homeRandom").addEventListener("click", ()=>randomizeSide("home"));
  document.getElementById("homeClear").addEventListener("click", ()=>clearSide("home"));
  document.getElementById("awayRandom").addEventListener("click", ()=>randomizeSide("away"));
  document.getElementById("awayClear").addEventListener("click", ()=>clearSide("away"));
  document.getElementById("bothRandom").addEventListener("click", ()=>{ randomizeSide("home"); randomizeSide("away"); });
}

export function tieLogToPanel(line){
  const log = document.getElementById("log");
  if (!log) return;
  const el = document.createElement("div");
  el.className = "event";
  el.innerHTML = `<strong>Tiebreak</strong> ${line}`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

