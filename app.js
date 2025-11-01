// Gamebreakers College Football — Season Mode with Coach Tiebreak (no ties)

// ====== TABLES & UTILITIES ======
const OFF_TABLE = {
  0: [3,0,0,0,0,0],
  1: [7,3,0,0,0,0],
  2: [7,3,3,0,0,0],
  3: [7,7,3,0,0,0],
  4: [7,7,7,3,0,0]
};
const DEF_TABLE = {
  0: [1,0,0,0,0,0],
  1: [7,2,0,0,0,0],
  2: [1,1,0,0,0,0],
  3: [1,1,1,0,0,0],
  4: [1,1,1,1,0,0]
};
const OFF_SLOTS = ["QB","RB","WR","OL"];
const DEF_SLOTS = ["DL","LB","DB"];
const EXP_OPTIONS = ["FR","SO","JR","SR"];

const LS_LEAGUE = "GBCF_LEAGUE_V4";
const LS_SEASON = "GBCF_SEASON_V1";

function d6(){ return 1 + Math.floor(Math.random()*6); }
function isDash(v){ return v === "-" || v === "–" || v === "" || v == null; }
function toRating(v){ return isDash(v) ? null : Math.max(0, Math.min(4, v|0)); }
function fromRating(r){ return (r==null?"-":String(r)); }
function randOf(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pickWeighted(weights){
  const total = weights.reduce((a,x)=>a+x.w,0);
  let r = Math.random()*total;
  for(const x of weights){ if((r-=x.w)<=0) return x.v; }
  return weights[weights.length-1].v;
}
const FIRST = ["Jalen","Cade","DeShawn","Evan","Noah","Grant","Miles","Ty","Luca","Andre","Owen","Blake","Darius","Cole","Julian","Nate","Kendrick","Logan","Mason","Dillon","Ari","Trey","Roman","Xavier"];
const LAST  = ["Hart","Lewis","Carter","Bishop","Reeves","Nguyen","Douglas","Price","Summers","Owens","Cruz","Wallace","Green","Higgins","Pierce","Foster","Sampson","Wolfe","King","Morrison","Sullivan","Brooks","Hayes"];
function randName(){ return `${FIRST[Math.floor(Math.random()*FIRST.length)]} ${LAST[Math.floor(Math.random()*LAST.length)]}`; }
function unitName(kind){ const map = {OL:"Off Line", DL:"D-Line", LB:"Linebackers", DB:"Secondary"}; return map[kind] || kind; }
function fillRatingSelect(sel){
  sel.innerHTML = "";
  [["-","–"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"]].forEach(([val,txt])=>{
    const opt = document.createElement("option"); opt.value = val; opt.textContent = txt; sel.appendChild(opt);
  });
}
function fillCoachTypeSelect(sel){
  sel.innerHTML = "";
  [["-","–"],["OFF","Off"],["DEF","Def"]].forEach(([val,txt])=>{
    const opt = document.createElement("option"); opt.value = val; opt.textContent = txt; sel.appendChild(opt);
  });
}
function fillExpSelect(sel){
  sel.innerHTML = "";
  EXP_OPTIONS.forEach(v=>{
    const opt = document.createElement("option"); opt.value = v; opt.textContent = v; sel.appendChild(opt);
  });
}

// ====== LEAGUE SEEDING ======
function defaultTeam(name){
  const blankO = ()=>({ name:"", exp:"FR", o1:2, o2:null });
  const blankD = ()=>({ name:"", exp:"FR", d1:2, d2:null });
  return {
    name,
    offense:{ QB:blankO(), RB:blankO(), WR:blankO(), OL:blankO() },
    defense:{ DL:blankD(), LB:blankD(), DB:blankD() },
    coach:{ name:"", exp:"JR", t1:"-", r1:null, t2:"-", r2:null }
  };
}

const CONFERENCES = [
  { name: "Atlantic Premier",  tier: 1, teams: [
    "Coastal State Mariners","Bayview Tech Hawks","New Harbor University","Carolina Metro College",
    "Old Dominion Ridge","Tri-County Institute","Rivergate University","Greenwood State",
    "Capital City College","Lowland A&M","Summit Shoreline","Seaboard University"
  ]},
  { name: "Pacific Elite",     tier: 1, teams: [
    "Pacific Northern","Golden Bay University","Redwood State","Inland Empire Tech",
    "Sierra Vista College","Harborline Institute","Cascade Metropolitan","Silver Coast",
    "Sunset Valley","Westcrest University","Canyon Ridge","Monterey Plains"
  ]},
  { name: "Heartland",         tier: 2, teams: [
    "Prairie State","Great Plains Tech","Mid-River University","Twin Forks College",
    "Frontier A&M","Bluegrass Institute","Cedar Valley","Northern Prairie",
    "Iron Range College","Crossroads University","Wabash River","Gateway State"
  ]},
  { name: "Southern",          tier: 2, teams: [
    "Gulfshore University","Magnolia State","Pinebelt College","Lowcountry Tech",
    "Bayou Plains","Blue Delta","Savannah Ridge","Oakcrest University",
    "Peachtree State","Sunrise Coast","Riverbend College","Crescent City"
  ]},
  { name: "Mountain Valley",   tier: 3, teams: [
    "High Mesa College","Timberline State","Basin & Range","Great Divide Tech",
    "Arrowhead University","Dry Creek A&M","Painted Desert","Silver Basin",
    "Bighorn College","Sagebrush State","Clearwater Institute","Yellow Rock"
  ]},
  { name: "Northeastern",      tier: 3, teams: [
    "Commonwealth Tech","Hudson Valley","Maritime & Mechanical","Patriot State",
    "Granite Ridge","Seacoast University","Maplewood College","Pioneer Institute",
    "Harbor City State","Blackstone College","Mohawk River","Pine Grove University"
  ]}
];

const TIER_PROFILES = {
  1: {
    o2_present_p: 0.55, d2_present_p: 0.55,
    ratingWeights: [{v:0,w:5},{v:1,w:15},{v:2,w:40},{v:3,w:28},{v:4,w:12}],
    coachTypeWeights: [{v:"OFF",w:40},{v:"DEF",w:40},{v:"-",w:20}],
    coachRatingWeights: [{v:0,w:6},{v:1,w:18},{v:2,w:40},{v:3,w:26},{v:4,w:10}],
    expWeights: [{v:"FR",w:20},{v:"SO",w:26},{v:"JR",w:30},{v:"SR",w:24}],
    coachExpWeights: [{v:"SO",w:8},{v:"JR",w:40},{v:"SR",w:52}]
  },
  2: {
    o2_present_p: 0.40, d2_present_p: 0.40,
    ratingWeights: [{v:0,w:10},{v:1,w:25},{v:2,w:40},{v:3,w:20},{v:4,w:5}],
    coachTypeWeights: [{v:"OFF",w:35},{v:"DEF",w:35},{v:"-",w:30}],
    coachRatingWeights: [{v:0,w:12},{v:1,w:28},{v:2,w:38},{v:3,w:18},{v:4,w:4}],
    expWeights: [{v:"FR",w:26},{v:"SO",w:28},{v:"JR",w:28},{v:"SR",w:18}],
    coachExpWeights: [{v:"SO",w:24},{v:"JR",w:44},{v:"SR",w:32}]
  },
  3: {
    o2_present_p: 0.20, d2_present_p: 0.20,
    ratingWeights: [{v:0,w:20},{v:1,w:35},{v:2,w:35},{v:3,w:9},{v:4,w:1}],
    coachTypeWeights: [{v:"OFF",w:28},{v:"DEF",w:28},{v:"-",w:44}],
    coachRatingWeights: [{v:0,w:22},{v:1,w:40},{v:2,w:28},{v:3,w:8},{v:4,w:2}],
    expWeights: [{v:"FR",w:34},{v:"SO",w:32},{v:"JR",w:22},{v:"SR",w:12}],
    coachExpWeights: [{v:"SO",w:36},{v:"JR",w:44},{v:"SR",w:20}]
  }
};

function randomDieByProfile(profile, present_p){ if (Math.random() > present_p) return null; return pickWeighted(profile.ratingWeights); }
function randomCoachByProfile(profile){
  const t1 = pickWeighted(profile.coachTypeWeights);
  const t2 = pickWeighted(profile.coachTypeWeights);
  const r1 = (t1 === "-") ? null : pickWeighted(profile.coachRatingWeights);
  const r2 = (t2 === "-") ? null : pickWeighted(profile.coachRatingWeights);
  const exp = pickWeighted(profile.coachExpWeights);
  return { t1, r1, t2, r2, exp };
}
function randomTeamByTier(name, tier){
  const p = TIER_PROFILES[tier];
  const team = defaultTeam(name);

  team.offense.QB.name = randName(); team.offense.QB.exp = pickWeighted(p.expWeights);
  team.offense.RB.name = randName(); team.offense.RB.exp = pickWeighted(p.expWeights);
  team.offense.WR.name = randName(); team.offense.WR.exp = pickWeighted(p.expWeights);
  team.offense.OL.name = unitName("OL"); team.offense.OL.exp = pickWeighted(p.expWeights);

  team.defense.DL.name = unitName("DL"); team.defense.DL.exp = pickWeighted(p.expWeights);
  team.defense.LB.name = unitName("LB"); team.defense.LB.exp = pickWeighted(p.expWeights);
  team.defense.DB.name = unitName("DB"); team.defense.DB.exp = pickWeighted(p.expWeights);

  const coachRoll = randomCoachByProfile(p);
  team.coach.name = randName();
  team.coach.exp = coachRoll.exp;

  OFF_SLOTS.forEach(s=>{
    team.offense[s].o1 = pickWeighted(p.ratingWeights);
    team.offense[s].o2 = randomDieByProfile(p, p.o2_present_p);
  });
  DEF_SLOTS.forEach(s=>{
    team.defense[s].d1 = pickWeighted(p.ratingWeights);
    team.defense[s].d2 = randomDieByProfile(p, p.d2_present_p);
  });
  team.coach.t1 = coachRoll.t1; team.coach.r1 = coachRoll.r1;
  team.coach.t2 = coachRoll.t2; team.coach.r2 = coachRoll.r2;

  return team;
}

function defaultLeague(){
  return CONFERENCES.map(conf=>{
    const teams = conf.teams.map(name => randomTeamByTier(name, conf.tier));
    return { name: conf.name, tier: conf.tier, teams };
  });
}
function loadLeague(){
  try{
    const raw = localStorage.getItem(LS_LEAGUE);
    if(!raw){
      const seeded = defaultLeague();
      localStorage.setItem(LS_LEAGUE, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  }catch(e){
    const seeded = defaultLeague();
    localStorage.setItem(LS_LEAGUE, JSON.stringify(seeded));
    return seeded;
  }
}
function saveLeague(league){ localStorage.setItem(LS_LEAGUE, JSON.stringify(league)); }

let LEAGUE = loadLeague();

// ====== CORE ROLLING ENGINE ======
function rollOffDie(rating){ const face=d6(); const pts=OFF_TABLE[rating][face-1]; return { face, pts }; }
function rollDefDie(rating){ const face=d6(); const code=DEF_TABLE[rating][face-1]; return { face, code }; }
function rollCoach(coach){
  const offResults=[]; const defResults=[];
  const doOne=(which,t,r)=>{
    if (t === "-" || r == null) return;
    if (t === "OFF"){ const {face, pts}=rollOffDie(r); offResults.push({slot:"Coach",which,rating:r,face,pts,name:coach.name,exp:coach.exp}); }
    else if (t === "DEF"){ const {face, code}=rollDefDie(r); defResults.push({slot:"Coach",which,rating:r,face,code,name:coach.name,exp:coach.exp}); }
  };
  doOne("C1",coach.t1,coach.r1); doOne("C2",coach.t2,coach.r2);
  return { offResults, defResults };
}
function resolveSide(sideObj){
  const offResults=[]; OFF_SLOTS.forEach(s=>{
    const {name,exp,o1,o2}=sideObj.offense[s];
    if(o1!=null){ const r=rollOffDie(o1); offResults.push({slot:s,which:"O1",rating:o1,...r,name,exp}); }
    if(o2!=null){ const r=rollOffDie(o2); offResults.push({slot:s,which:"O2",rating:o2,...r,name,exp}); }
  });
  const defResults=[]; DEF_SLOTS.forEach(s=>{
    const {name,exp,d1,d2}=sideObj.defense[s];
    if(d1!=null){ const r=rollDefDie(d1); defResults.push({slot:s,which:"D1",rating:d1,...r,name,exp}); }
    if(d2!=null){ const r=rollDefDie(d2); defResults.push({slot:s,which:"D2",rating:d2,...r,name,exp}); }
  });
  const coachPack = rollCoach(sideObj.coach);
  const offAll = offResults.concat(coachPack.offResults);
  const defAll = defResults.concat(coachPack.defResults);

  const own7 = offAll.filter(r=>r.pts===7).length;
  const own3 = offAll.filter(r=>r.pts===3).length;
  const ownBase = offAll.reduce((a,r)=>a+r.pts,0);

  const blocks = defAll.filter(r=>r.code===1).length;
  const bonus = defAll.reduce((a,r)=>a+(r.code===7?7:(r.code===2?2:0)),0);

  return { offResults:offAll, defResults:defAll, own7, own3, ownBase, blocks, bonus };
}
function finalizeScore(myDetail, oppDetail){
  const cancel7 = Math.min(myDetail.own7, oppDetail.blocks);
  const rem = oppDetail.blocks - cancel7;
  const cancel3 = Math.min(myDetail.own3, rem);
  const canceledPoints = cancel7*7 + cancel3*3;
  const final = Math.max(0, myDetail.ownBase - canceledPoints) + myDetail.bonus;
  return { final, cancel7, cancel3, canceledPoints };
}

// ====== TIEBREAKER (COACH-ONLY REROLLS) ======
function sumDefBonus(defResults){
  return defResults.reduce((a,r)=> a + (r.code===7 ? 7 : (r.code===2 ? 2 : 0)), 0);
}
function coachTiebreakDelta(myCoachPack, oppCoachPack){
  const myOff = myCoachPack.offResults;
  const myDef = myCoachPack.defResults;
  const oppDef = oppCoachPack.defResults;

  const my7 = myOff.filter(r=>r.pts===7).length;
  const my3 = myOff.filter(r=>r.pts===3).length;
  const myBase = myOff.reduce((a,r)=>a + r.pts, 0);

  const oppBlocks = oppDef.filter(r=>r.code===1).length;

  const cancel7 = Math.min(my7, oppBlocks);
  const remainingBlocks = oppBlocks - cancel7;
  const cancel3 = Math.min(my3, remainingBlocks);
  const canceled = cancel7*7 + cancel3*3;

  const offenseDelta = Math.max(0, myBase - canceled);
  const defenseBonus = sumDefBonus(myDef);
  return offenseDelta + defenseBonus;
}
function resolveTieByCoaches(homeTeam, awayTeam, startHome, startAway, logFn = ()=>{}){
  let home = startHome;
  let away = startAway;
  let rounds = 0;
  const MAX_ROUNDS = 100;

  while (home === away && rounds < MAX_ROUNDS){
    rounds++;
    const hc = rollCoach(homeTeam.coach);
    const ac = rollCoach(awayTeam.coach);
    const hDelta = coachTiebreakDelta(hc, ac);
    const aDelta = coachTiebreakDelta(ac, hc);
    home += hDelta;
    away += aDelta;
    logFn(`Tiebreaker #${rounds}: Home +${hDelta}, Away +${aDelta} → ${home}-${away}`);
  }
  return { home, away, rounds };
}

// ====== UI RENDER HELPERS ======
function pill(text, type){ const cls = type || "neu"; return `<span class="pill ${cls}">${text}</span>`; }
function offPill(face, pts){ return pill(`d6:${face} → ${pts}`, pts===7?"ok":(pts===3?"warn":"neu")); }
function defPill(face, code){ const label = code===1?"block":(code===7?"+7":(code===2?"+2":"0"));
  const t = code===1?"bad":(code===7||code===2?"ok":"neu"); return pill(`d6:${face} → ${label}`, t); }
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
function buildBreakdownHTML(detail, oppDetail, fin){
  const offGrouped = groupByPlayer(detail.offResults, true);
  const defGrouped = groupByPlayer(detail.defResults, false);
  const offSec = sectionHTML("Offense Dice", `7s: ${detail.own7} • 3s: ${detail.own3} • Base: ${detail.ownBase}`, playersHTML(offGrouped, true));
  const defSec = sectionHTML("Defense Dice", `Blocks: ${detail.blocks} • Bonus: +${detail.bonus}`, playersHTML(defGrouped, false));
  const summary = `Base ${detail.ownBase} − blocks ${fin.canceledPoints} + defense bonus ${detail.bonus}`;
  const body = `<div class="breakdown">${offSec}${defSec}</div>`;
  return { summary, body };
}

// ====== PLAY TAB WIRING ======
function fillAllPlaySelects(){
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
function neutralDefaultsPlay(){
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
function randomizeSide(side){
  document.getElementById(`${side}_QB_name`).value = randName();
  document.getElementById(`${side}_RB_name`).value = randName();
  document.getElementById(`${side}_WR_name`).value = randName();
  document.getElementById(`${side}_OL_name`).value = unitName("OL");
  document.getElementById(`${side}_DL_name`).value = unitName("DL");
  document.getElementById(`${side}_LB_name`).value = unitName("LB");
  document.getElementById(`${side}_DB_name`).value = unitName("DB");
  document.getElementById(`${side}_COACH_name`).value = randName();
  [...OFF_SLOTS, ...DEF_SLOTS].forEach(s=>{ document.getElementById(`${side}_${s}_exp`).value = randOf(EXP_OPTIONS); });
  document.getElementById(`${side}_COACH_exp`).value = randOf(["SO","JR","SR"]);
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_o1`).value = randomPickOrDash(0.15);
    document.getElementById(`${side}_${slot}_o2`).value = randomPickOrDash(0.40);
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = randomPickOrDash(0.15);
    document.getElementById(`${side}_${slot}_d2`).value = randomPickOrDash(0.40);
  });
  document.getElementById(`${side}_COACH_t1`).value = randomCoachType();
  document.getElementById(`${side}_COACH_t2`).value = randomCoachType();
  document.getElementById(`${side}_COACH_r1`).value = randomPickOrDash(0.20);
  document.getElementById(`${side}_COACH_r2`).value = randomPickOrDash(0.35);
}
function clearSide(side){
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_o1`).value = "-";
    document.getElementById(`${side}_${slot}_o2`).value = "-";
    document.getElementById(`${side}_${slot}_exp`).value = "FR";
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = "-";
    document.getElementById(`${side}_${slot}_d2`).value = "-";
    document.getElementById(`${side}_${slot}_exp`).value = "FR";
  });
  ["QB","RB","WR","OL","DL","LB","DB"].forEach(s=>{ document.getElementById(`${side}_${s}_name`).value = ""; });
  document.getElementById(`${side}_COACH_name`).value = "";
  document.getElementById(`${side}_COACH_t1`).value="-";
  document.getElementById(`${side}_COACH_t2`).value="-";
  document.getElementById(`${side}_COACH_r1`).value="-";
  document.getElementById(`${side}_COACH_r2`).value="-";
  document.getElementById(`${side}_COACH_exp`).value="JR";
  document.getElementById(`${side}Name`).value = side==="home"?"Home":"Away";
}
function collectSide(side){
  const name = document.getElementById(`${side}Name`).value.trim() || (side==="home"?"Home":"Away");
  const offense = {};
  OFF_SLOTS.forEach(s=>{
    offense[s] = {
      name: document.getElementById(`${side}_${s}_name`).value.trim(),
      exp: document.getElementById(`${side}_${s}_exp`).value,
      o1: toRating(document.getElementById(`${side}_${s}_o1`).value),
      o2: toRating(document.getElementById(`${side}_${s}_o2`).value)
    };
  });
  const defense = {};
  DEF_SLOTS.forEach(s=>{
    defense[s] = {
      name: document.getElementById(`${side}_${s}_name`).value.trim(),
      exp: document.getElementById(`${side}_${s}_exp`).value,
      d1: toRating(document.getElementById(`${side}_${s}_d1`).value),
      d2: toRating(document.getElementById(`${side}_${s}_d2`).value) // ← fixed: no stray }
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
function applyTeamToSide(team, side){
  document.getElementById(`${side}Name`).value = team.name || (side==="home"?"Home":"Away");
  OFF_SLOTS.forEach(s=>{
    document.getElementById(`${side}_${s}_name`).value = team.offense[s].name || "";
    document.getElementById(`${side}_${s}_exp`).value = team.offense[s].exp || "FR";
    document.getElementById(`${side}_${s}_o1`).value = fromRating(team.offense[s].o1);
    document.getElementById(`${side}_${s}_o2`).value = fromRating(team.offense[s].o2);
  });
  DEF_SLOTS.forEach(s=>{
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

// ====== TABS ======
function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.dataset.tab;
      document.querySelectorAll(".tabpanel").forEach(p=>p.classList.remove("active"));
      document.getElementById(`tab-${name}`).classList.add("active");
      if(name==="league"){ renderLeagueSidebar(); clearEditorSelection(); }
      if(name==="play"){ refreshTeamPickers(); }
      if(name==="season"){ ensureSeason(); renderWeekPicker(); renderGames(); renderStandingsAll(); }
    });
  });
}

// ====== LEAGUE MANAGER ======
let selectedCI = null, selectedTI = null;

function renderLeagueSidebar(){
  const box = document.getElementById("leagueSidebar");
  box.innerHTML = "";
  LEAGUE.forEach((conf, ci)=>{
    const block = document.createElement("div");
    block.className = "conf-block";
    const title = document.createElement("div");
    title.className = "conf-title";
    title.innerHTML = `<span>${conf.name} <small>(Tier ${conf.tier})</small></span>`;
    const mini = document.createElement("div");
    mini.className = "mini";
    const btnRnd = document.createElement("button");
    btnRnd.className = "ghost";
    btnRnd.textContent = "🎲 Randomize Conference";
    btnRnd.addEventListener("click", ()=>{ randomizeConference(ci); });
    mini.appendChild(btnRnd);
    title.appendChild(mini);
    block.appendChild(title);

    conf.teams.forEach((t, ti)=>{
      const item = document.createElement("div");
      item.className = "team-item";
      item.dataset.ci = ci; item.dataset.ti = ti;
      item.innerHTML = `<span>${t.name}</span><small>#${ti+1}</small>`;
      if (ci===selectedCI && ti===selectedTI) item.classList.add("active");
      item.addEventListener("click", ()=>{
        selectedCI = ci; selectedTI = ti;
        renderLeagueSidebar();
        loadTeamIntoEditor(LEAGUE[ci].teams[ti]);
      });
      block.appendChild(item);
    });
    box.appendChild(block);
  });
}
function randomizeConference(ci){
  const conf = LEAGUE[ci];
  conf.teams = conf.teams.map(t => randomTeamByTier(t.name, conf.tier));
  saveLeague(LEAGUE);
  renderLeagueSidebar(); refreshTeamPickers();
  if(selectedCI===ci && selectedTI!=null){ loadTeamIntoEditor(conf.teams[selectedTI]); }
}
function editorSelectIds(){
  const ids = [];
  OFF_SLOTS.forEach(s=>{ ids.push(`edit_${s}_o1`,`edit_${s}_o2`); });
  DEF_SLOTS.forEach(s=>{ ids.push(`edit_${s}_d1`,`edit_${s}_d2`); });
  ids.push("edit_COACH_t1","edit_COACH_r1","edit_COACH_t2","edit_COACH_r2");
  return ids;
}
function editorExpIds(){ const ids=[]; [...OFF_SLOTS, ...DEF_SLOTS].forEach(s=> ids.push(`edit_${s}_exp`)); ids.push("edit_COACH_exp"); return ids; }
function setupEditorSelects(){
  editorSelectIds().forEach(id=>{ const el=document.getElementById(id); if(id.includes("_t")) fillCoachTypeSelect(el); else fillRatingSelect(el); });
  editorExpIds().forEach(id=> fillExpSelect(document.getElementById(id)));
}
function clearEditorSelection(){
  document.getElementById("editTeamTitle").textContent = "Select a team";
  document.getElementById("editTeamName").value = "";
  ["QB","RB","WR","OL","DL","LB","DB"].forEach(s=>{
    const f = document.getElementById(`edit_${s}_name`); if (f) f.value = "";
    const e = document.getElementById(`edit_${s}_exp`); if (e) e.value = "FR";
  });
  const cn = document.getElementById("edit_COACH_name"); if (cn) cn.value = "";
  const ce = document.getElementById("edit_COACH_exp"); if (ce) ce.value = "JR";
  editorSelectIds().forEach(id=>{ const el=document.getElementById(id); el.value = id.includes("_t") ? "-" : "-"; });
}
function loadTeamIntoEditor(team){
  document.getElementById("editTeamTitle").textContent = team.name;
  document.getElementById("editTeamName").value = team.name;
  OFF_SLOTS.forEach(s=>{
    document.getElementById(`edit_${s}_name`).value = team.offense[s].name || "";
    document.getElementById(`edit_${s}_exp`).value = team.offense[s].exp || "FR";
    document.getElementById(`edit_${s}_o1`).value = fromRating(team.offense[s].o1);
    document.getElementById(`edit_${s}_o2`).value = fromRating(team.offense[s].o2);
  });
  DEF_SLOTS.forEach(s=>{
    document.getElementById(`edit_${s}_name`).value = team.defense[s].name || "";
    document.getElementById(`edit_${s}_exp`).value = team.defense[s].exp || "FR";
    document.getElementById(`edit_${s}_d1`).value = fromRating(team.defense[s].d1);
    document.getElementById(`edit_${s}_d2`).value = fromRating(team.defense[s].d2);
  });
  document.getElementById("edit_COACH_name").value = team.coach.name || "";
  document.getElementById("edit_COACH_exp").value = team.coach.exp || "JR";
  document.getElementById("edit_COACH_t1").value = team.coach.t1 || "-";
  document.getElementById("edit_COACH_t2").value = team.coach.t2 || "-";
  document.getElementById("edit_COACH_r1").value = fromRating(team.coach.r1);
  document.getElementById("edit_COACH_r2").value = fromRating(team.coach.r2);
}
function collectEditorToTeam(baseTeam){
  const name = document.getElementById("editTeamName").value.trim() || baseTeam.name;
  const team = JSON.parse(JSON.stringify(baseTeam));
  team.name = name;
  OFF_SLOTS.forEach(s=>{
    team.offense[s].name = document.getElementById(`edit_${s}_name`).value.trim();
    team.offense[s].exp  = document.getElementById(`edit_${s}_exp`).value;
    team.offense[s].o1   = toRating(document.getElementById(`edit_${s}_o1`).value);
    team.offense[s].o2   = toRating(document.getElementById(`edit_${s}_o2`).value);
  });
  DEF_SLOTS.forEach(s=>{
    team.defense[s].name = document.getElementById(`edit_${s}_name`).value.trim();
    team.defense[s].exp  = document.getElementById(`edit_${s}_exp`).value;
    team.defense[s].d1   = toRating(document.getElementById(`edit_${s}_d1`).value);
    team.defense[s].d2   = toRating(document.getElementById(`edit_${s}_d2`).value);
  });
  team.coach.name = document.getElementById("edit_COACH_name").value.trim();
  team.coach.exp  = document.getElementById("edit_COACH_exp").value;
  team.coach.t1   = document.getElementById("edit_COACH_t1").value;
  team.coach.t2   = document.getElementById("edit_COACH_t2").value;
  team.coach.r1   = toRating(document.getElementById("edit_COACH_r1").value);
  team.coach.r2   = toRating(document.getElementById("edit_COACH_r2").value);
  return team;
}

// ====== TEAM PICKERS FOR PLAY TAB ======
function refreshTeamPickers(){
  const lists = [document.getElementById("pickHomeTeam"), document.getElementById("pickAwayTeam")];
  lists.forEach(sel=>{
    sel.innerHTML = "";
    LEAGUE.forEach((conf, ci)=>{
      const optg = document.createElement("optgroup");
      optg.label = conf.name;
      conf.teams.forEach((t, ti)=>{
        const opt = document.createElement("option");
        opt.value = `${ci}:${ti}`;
        opt.textContent = t.name;
        optg.appendChild(opt);
      });
      sel.appendChild(optg);
    });
  });
}
function getTeamByIndex(ci, ti){ return LEAGUE[ci].teams[ti]; }
function getTeamByIndexStr(indexStr){
  const [ci, ti] = indexStr.split(":").map(x=>parseInt(x,10));
  return getTeamByIndex(ci, ti);
}
function setTeamByIndexStr(indexStr, teamObj){
  const [ci, ti] = indexStr.split(":").map(x=>parseInt(x,10));
  LEAGUE[ci].teams[ti] = teamObj;
  saveLeague(LEAGUE);
}

// ====== SEASON ENGINE ======
let SEASON = null;

function ensureSeason(){
  if (SEASON) return;
  const raw = localStorage.getItem(LS_SEASON);
  if (raw){
    try { SEASON = JSON.parse(raw); return; } catch(e){ /* fallthrough */ }
  }
  SEASON = createSeasonFromLeague();
  saveSeason();
}
function saveSeason(){ localStorage.setItem(LS_SEASON, JSON.stringify(SEASON)); }

function teamKey(ci, ti){ return `${ci}:${ti}`; }

function createStandings(){
  const tbl = {};
  LEAGUE.forEach((conf, ci)=>{
    conf.teams.forEach((t, ti)=>{
      tbl[teamKey(ci,ti)] = { w:0, l:0, pf:0, pa:0 };
    });
  });
  return tbl;
}

// Round-robin for 12 teams → 11 rounds
function roundRobinIndices(n){
  const arr = [...Array(n).keys()];
  const rounds = n-1;
  const half = n/2;
  const a = arr.slice(0,half);
  const b = arr.slice(half).reverse();
  const weeks = [];
  for(let r=0; r<rounds; r++){
    const pairs = [];
    for(let i=0;i<half;i++){ pairs.push([a[i], b[i]]); }
    weeks.push(pairs);
    const aMove = a.splice(1, a.length-1);
    const bMove = b.splice(0,1);
    a.splice(1,0, ...bMove);
    b.push(aMove.pop());
  }
  return weeks;
}

function createSeasonFromLeague(){
  const standings = createStandings();
  const weeks = [];
  const perConfWeeks = LEAGUE.map((conf,ci)=>{
    const n = conf.teams.length; // 12
    const rr = roundRobinIndices(n); // 11 weeks of pair indices
    return rr.map(pairs=> pairs.map(([i,j])=>({
      confIndex: ci,
      home: {ci, ti: i},
      away: {ci, ti: j},
      played: false,
      score: null,
    })));
  });
  const rounds = perConfWeeks[0].length; // 11
  for(let r=0; r<rounds; r++){
    const games = [];
    perConfWeeks.forEach(confWeeks=>{ games.push(...confWeeks[r]); });
    weeks.push({ week: r+1, games });
  }
  return { weeks, standings, currentWeek: 1 };
}

function renderWeekPicker(){
  const sel = document.getElementById("seasonWeek");
  sel.innerHTML = "";
  SEASON.weeks.forEach(w=>{
    const opt = document.createElement("option");
    opt.value = w.week;
    opt.textContent = `Week ${w.week}`;
    if (w.week === SEASON.currentWeek) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", ()=>{
    SEASON.currentWeek = parseInt(sel.value,10);
    saveSeason();
    renderGames();
  }, { once: true });
}

function gameLabel(g){
  const h = getTeamByIndex(g.home.ci, g.home.ti).name;
  const a = getTeamByIndex(g.away.ci, g.away.ti).name;
  return `${a} @ ${h}`;
}
function renderGames(){
  const wrap = document.getElementById("gamesList");
  wrap.innerHTML = "";
  const w = SEASON.weeks.find(x=>x.week===SEASON.currentWeek);
  w.games.forEach((g, idx)=>{
    const row = document.createElement("div");
    row.className = "game-row" + (g.played ? " played":"");
    const names = document.createElement("div");
    names.className = "game-names";
    names.textContent = gameLabel(g);
    const score = document.createElement("div");
    score.className = "game-score";
    score.textContent = g.played ? `${g.score.home}–${g.score.away}` : "—";
    const actions = document.createElement("div");
    actions.className = "game-actions";
    const btnPlay = document.createElement("button");
    btnPlay.textContent = g.played ? "Rewatch" : "Play";
    btnPlay.className = g.played ? "ghost" : "primary";
    btnPlay.addEventListener("click", ()=> playScheduledGame(g, {replay: g.played}));
    actions.appendChild(btnPlay);
    row.appendChild(names); row.appendChild(score); row.appendChild(actions);
    wrap.appendChild(row);
  });
}

function renderStandingsAll(){
  const box = document.getElementById("standingsAll");
  box.innerHTML = "";
  LEAGUE.forEach((conf, ci)=>{
    const blk = document.createElement("div");
    blk.className = "standings-block";
    blk.innerHTML = `<h4>${conf.name}</h4>${standingsTableHTML(ci)}`;
    box.appendChild(blk);
  });
}
function standingsTableHTML(ci){
  const conf = LEAGUE[ci];
  const rows = conf.teams.map((t, ti)=>{
    const rec = SEASON.standings[teamKey(ci,ti)];
    return { name: t.name, w: rec.w, l: rec.l, pf: rec.pf, pa: rec.pa, diff: rec.pf - rec.pa };
  }).sort((a,b)=> (b.w - a.w) || (b.diff - a.diff) || (b.pf - a.pf) || a.name.localeCompare(b.name));
  const header = `<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>`;
  const body = rows.map(r=> `<tr><td>${r.name}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff>=0?'+':''}${r.diff}</td></tr>`).join("");
  return `${header}${body}</tbody></table>`;
}

// ====== SIMULATION (with no ties) ======
function simulateMatchByTeams(homeTeam, awayTeam){
  const h = resolveSide(homeTeam);
  const a = resolveSide(awayTeam);
  const hf = finalizeScore(h, a);
  const af = finalizeScore(a, h);

  let homeScore = hf.final;
  let awayScore = af.final;

  // No ties: reroll coaches only until someone wins
  if (homeScore === awayScore){
    const t = resolveTieByCoaches(homeTeam, awayTeam, homeScore, awayScore);
    homeScore = t.home;
    awayScore = t.away;
  }

  const hRender = buildBreakdownHTML(h, a, hf);
  const aRender = buildBreakdownHTML(a, h, af);
  return {
    score: { home: homeScore, away: awayScore },
    homeDetailHTML: hRender.body,
    awayDetailHTML: aRender.body,
    homeSummary: hRender.summary,
    awaySummary: aRender.summary
  };
}

function playScheduledGame(g, {replay=false}={}){
  const home = JSON.parse(JSON.stringify(getTeamByIndex(g.home.ci, g.home.ti)));
  const away = JSON.parse(JSON.stringify(getTeamByIndex(g.away.ci, g.away.ti)));
  const res = simulateMatchByTeams(home, away);

  // render into Play tab for a boxscore-style view
  document.querySelector('[data-tab="play"]').click();
  applyTeamToSide(getTeamByIndex(g.home.ci, g.home.ti), "home");
  applyTeamToSide(getTeamByIndex(g.away.ci, g.away.ti), "away");
  document.getElementById("homeScore").textContent = res.score.home;
  document.getElementById("awayScore").textContent = res.score.away;
  document.getElementById("homeSummary").textContent = res.homeSummary;
  document.getElementById("awaySummary").textContent = res.awaySummary;
  document.getElementById("homeDetail").innerHTML = res.homeDetailHTML;
  document.getElementById("awayDetail").innerHTML = res.awayDetailHTML;

  // update season only if not replay
  if (!replay){
    if (!g.played){
      g.played = true;
      g.score = res.score;
      const hk = teamKey(g.home.ci, g.home.ti);
      const ak = teamKey(g.away.ci, g.away.ti);
      SEASON.standings[hk].pf += res.score.home;
      SEASON.standings[hk].pa += res.score.away;
      SEASON.standings[ak].pf += res.score.away;
      SEASON.standings[ak].pa += res.score.home;
      if (res.score.home > res.score.away){ SEASON.standings[hk].w++; SEASON.standings[ak].l++; }
      else if (res.score.home < res.score.away){ SEASON.standings[ak].w++; SEASON.standings[hk].l++; }
      saveSeason();
    }
    document.querySelector('[data-tab="season"]').click();
    renderGames();
    renderStandingsAll();
  }
}

function simulateWeek(weekNum){
  const w = SEASON.weeks.find(x=>x.week===weekNum);
  w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
}
function simulateSeason(){
  SEASON.weeks.forEach(w=> simulateWeek(w.week));
}
function resetSeason(){
  if(!confirm("Reset season schedule and standings?")) return;
  SEASON = createSeasonFromLeague();
  saveSeason();
  renderWeekPicker(); renderGames(); renderStandingsAll();
}

// ====== SEASON UI WIRING ======
function wireSeasonButtons(){
  const weekSel = document.getElementById("seasonWeek");
  document.getElementById("btnSimWeek").addEventListener("click", ()=> simulateWeek(parseInt(weekSel.value,10)));
  document.getElementById("btnSimSeason").addEventListener("click", simulateSeason);
  document.getElementById("btnResetSeason").addEventListener("click", resetSeason);
}

// ====== STARTUP ======
window.addEventListener("DOMContentLoaded", ()=>{
  initTabs();

  // PLAY setup
  fillAllPlaySelects();
  neutralDefaultsPlay();
  document.getElementById("homeRandom").addEventListener("click", ()=>randomizeSide("home"));
  document.getElementById("homeClear").addEventListener("click", ()=>clearSide("home"));
  document.getElementById("awayRandom").addEventListener("click", ()=>randomizeSide("away"));
  document.getElementById("awayClear").addEventListener("click", ()=>clearSide("away"));
  document.getElementById("bothRandom").addEventListener("click", ()=>{ randomizeSide("home"); randomizeSide("away"); });

  document.getElementById("rollAll").addEventListener("click", ()=>{
    const home = collectSide("home");
    const away = collectSide("away");
    const h = resolveSide(home);
    const a = resolveSide(away);
    const hf = finalizeScore(h, a);
    const af = finalizeScore(a, h);

    let homeScore = hf.final;
    let awayScore = af.final;

    // No ties in Play tab: reroll coaches until winner
    if (homeScore === awayScore){
      const tieRes = resolveTieByCoaches(home, away, homeScore, awayScore, (line)=> {
        const log = document.getElementById("log");
        if (log){
          const el = document.createElement("div");
          el.className = "event";
          el.innerHTML = `<strong>Tiebreak</strong> ${line}`;
          log.appendChild(el);
          log.scrollTop = log.scrollHeight;
        }
      });
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

  // Pickers
  refreshTeamPickers();
  document.getElementById("btnLoadHome").addEventListener("click", ()=>{
    const id = document.getElementById("pickHomeTeam").value; if(!id) return;
    const team = getTeamByIndexStr(id); applyTeamToSide(team, "home");
  });
  document.getElementById("btnLoadAway").addEventListener("click", ()=>{
    const id = document.getElementById("pickAwayTeam").value; if(!id) return;
    const team = getTeamByIndexStr(id); applyTeamToSide(team, "away");
  });
  document.getElementById("btnSaveHomeBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickHomeTeam").value; if(!sel) return;
    const team = collectSide("home"); setTeamByIndexStr(sel, team);
    renderLeagueSidebar(); refreshTeamPickers();
  });
  document.getElementById("btnSaveAwayBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickAwayTeam").value; if(!sel) return;
    const team = collectSide("away"); setTeamByIndexStr(sel, team);
    renderLeagueSidebar(); refreshTeamPickers();
  });

  // League Manager
  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();
  document.getElementById("editRandom").addEventListener("click", ()=>{
    if(selectedCI==null) return;
    document.getElementById("edit_QB_name").value = randName();
    document.getElementById("edit_RB_name").value = randName();
    document.getElementById("edit_WR_name").value = randName();
    document.getElementById("edit_OL_name").value = unitName("OL");
    document.getElementById("edit_DL_name").value = unitName("DL");
    document.getElementById("edit_LB_name").value = unitName("LB");
    document.getElementById("edit_DB_name").value = unitName("DB");
    document.getElementById("edit_COACH_name").value = randName();
    [...editorExpIds()].forEach(id=>{
      const el = document.getElementById(id);
      if(id==="edit_COACH_exp") el.value = randOf(["SO","JR","SR"]);
      else el.value = randOf(EXP_OPTIONS);
    });
    OFF_SLOTS.forEach(s=>{
      document.getElementById(`edit_${s}_o1`).value = randomPickOrDash(0.15);
      document.getElementById(`edit_${s}_o2`).value = randomPickOrDash(0.40);
    });
    DEF_SLOTS.forEach(s=>{
      document.getElementById(`edit_${s}_d1`).value = randomPickOrDash(0.15);
      document.getElementById(`edit_${s}_d2`).value = randomPickOrDash(0.40);
    });
    document.getElementById("edit_COACH_t1").value = randomCoachType();
    document.getElementById("edit_COACH_t2").value = randomCoachType();
    document.getElementById("edit_COACH_r1").value = randomPickOrDash(0.20);
    document.getElementById("edit_COACH_r2").value = randomPickOrDash(0.35);
  });
  document.getElementById("editClear").addEventListener("click", ()=>{
    if(selectedCI==null) return;
    OFF_SLOTS.forEach(s=>{
      document.getElementById(`edit_${s}_name`).value = "";
      document.getElementById(`edit_${s}_exp`).value = "FR";
      document.getElementById(`edit_${s}_o1`).value = "-";
      document.getElementById(`edit_${s}_o2`).value = "-";
    });
    DEF_SLOTS.forEach(s=>{
      document.getElementById(`edit_${s}_name`).value = "";
      document.getElementById(`edit_${s}_exp`).value = "FR";
      document.getElementById(`edit_${s}_d1`).value = "-";
      document.getElementById(`edit_${s}_d2`).value = "-";
    });
    document.getElementById("edit_COACH_name").value = "";
    document.getElementById("edit_COACH_exp").value = "JR";
    document.getElementById("edit_COACH_t1").value = "-";
    document.getElementById("edit_COACH_t2").value = "-";
    document.getElementById("edit_COACH_r1").value = "-";
    document.getElementById("edit_COACH_r2").value = "-";
  });
  document.getElementById("editSave").addEventListener("click", ()=>{
    if(selectedCI==null) return;
    const base = LEAGUE[selectedCI].teams[selectedTI];
    const updated = collectEditorToTeam(base);
    LEAGUE[selectedCI].teams[selectedTI] = updated;
    saveLeague(LEAGUE);
    renderLeagueSidebar(); refreshTeamPickers();
    loadTeamIntoEditor(updated);
  });

  // Season
  ensureSeason();
  wireSeasonButtons();
  renderWeekPicker();
  renderGames();
  renderStandingsAll();
});









