// Gamebreakers College Football — Two dice per player (0–4 or “–” to skip).
// Coach: two dice; each can be Off, Def, or “–”.

// --- Tables ---------------------------------------------------------------
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
const DEF_SLOTS = ["DL","LB","DB","FLEX"];

// --- Utilities ------------------------------------------------------------
function d6(){ return 1 + Math.floor(Math.random()*6); }
function isDash(v){ return v === "-" || v === "–" || v === "" || v == null; }
function toRating(v){ return isDash(v) ? null : Math.max(0, Math.min(4, v|0)); }

// --- Populate selects -----------------------------------------------------
function fillRatingSelect(id){
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  const dash = document.createElement("option");
  dash.value = "-"; dash.textContent = "–";
  sel.appendChild(dash);
  for(let v=0; v<=4; v++){
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = String(v);
    sel.appendChild(opt);
  }
}
function fillCoachTypeSelect(id){
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  [["-","–"],["OFF","Off"],["DEF","Def"]].forEach(([val,txt])=>{
    const opt = document.createElement("option");
    opt.value = val; opt.textContent = txt;
    sel.appendChild(opt);
  });
}
function populateAllSelects(){
  const ids = [];
  OFF_SLOTS.forEach(slot=>{
    ids.push(`home_${slot}_o1`,`home_${slot}_o2`,`away_${slot}_o1`,`away_${slot}_o2`);
  });
  DEF_SLOTS.forEach(slot=>{
    ids.push(`home_${slot}_d1`,`home_${slot}_d2`,`away_${slot}_d1`,`away_${slot}_d2`);
  });
  ids.forEach(fillRatingSelect);

  // Coach type + rating (two each per team)
  ["home","away"].forEach(side=>{
    fillCoachTypeSelect(`${side}_COACH_t1`);
    fillCoachTypeSelect(`${side}_COACH_t2`);
    fillRatingSelect(`${side}_COACH_r1`);
    fillRatingSelect(`${side}_COACH_r2`);
  });
}

// --- Team config ----------------------------------------------------------
function getTeamConfig(side){
  const name = document.getElementById(`${side}Name`).value.trim() || (side==="home"?"Home":"Away");

  const offense = OFF_SLOTS.map(slot=>{
    const o1 = toRating(document.getElementById(`${side}_${slot}_o1`).value);
    const o2 = toRating(document.getElementById(`${side}_${slot}_o2`).value);
    return { slot, o1, o2 };
  });

  const defense = DEF_SLOTS.map(slot=>{
    const d1 = toRating(document.getElementById(`${side}_${slot}_d1`).value);
    const d2 = toRating(document.getElementById(`${side}_${slot}_d2`).value);
    return { slot, d1, d2 };
  });

  const coach = {
    t1: document.getElementById(`${side}_COACH_t1`).value, // "-", "OFF", "DEF"
    r1: toRating(document.getElementById(`${side}_COACH_r1`).value),
    t2: document.getElementById(`${side}_COACH_t2`).value,
    r2: toRating(document.getElementById(`${side}_COACH_r2`).value),
  };

  return { name, offense, defense, coach };
}

// --- Randomize / Clear ----------------------------------------------------
function randomPickOrDash(probDash){
  if (Math.random() < probDash) return "-";
  const r = Math.random();
  if (r < 0.15) return "0";
  if (r < 0.55) return "2";
  if (r < 0.80) return "1";
  if (r < 0.95) return "3";
  return "4";
}
function randomCoachType(){
  const r = Math.random();
  if (r < 0.35) return "OFF";
  if (r < 0.70) return "DEF";
  if (r < 0.85) return "-";
  return "OFF"; // slight lean to having a coach die
}
function randomizeTeam(side){
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_o1`).value = randomPickOrDash(0.15);
    document.getElementById(`${side}_${slot}_o2`).value = randomPickOrDash(0.40);
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = randomPickOrDash(0.15);
    document.getElementById(`${side}_${slot}_d2`).value = randomPickOrDash(0.40);
  });
  // Coach
  document.getElementById(`${side}_COACH_t1`).value = randomCoachType();
  document.getElementById(`${side}_COACH_t2`).value = randomCoachType();
  document.getElementById(`${side}_COACH_r1`).value = randomPickOrDash(0.20);
  document.getElementById(`${side}_COACH_r2`).value = randomPickOrDash(0.35);
}
function clearTeam(side){
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_o1`).value = "–";
    document.getElementById(`${side}_${slot}_o2`).value = "–";
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = "–";
    document.getElementById(`${side}_${slot}_d2`).value = "–";
  });
  document.getElementById(`${side}_COACH_t1`).value = "-";
  document.getElementById(`${side}_COACH_t2`).value = "-";
  document.getElementById(`${side}_COACH_r1`).value = "–";
  document.getElementById(`${side}_COACH_r2`).value = "–";
}

// Bulk helpers for O2/D2 remain (coach dice are independent)
function copyAllO2fromO1(){
  ["home","away"].forEach(side=>{
    OFF_SLOTS.forEach(slot=>{
      document.getElementById(`${side}_${slot}_o2`).value =
        document.getElementById(`${side}_${slot}_o1`).value;
    });
  });
}
function clearAllO2(){
  ["home","away"].forEach(side=>{
    OFF_SLOTS.forEach(slot=>{
      document.getElementById(`${side}_${slot}_o2`).value = "–";
    });
  });
}
function copyAllD2fromD1(){
  ["home","away"].forEach(side=>{
    DEF_SLOTS.forEach(slot=>{
      document.getElementById(`${side}_${slot}_d2`).value =
        document.getElementById(`${side}_${slot}_d1`).value;
    });
  });
}
function clearAllD2(){
  ["home","away"].forEach(side=>{
    DEF_SLOTS.forEach(slot=>{
      document.getElementById(`${side}_${slot}_d2`).value = "–";
    });
  });
}

// --- Rolling --------------------------------------------------------------
function rollOffDie(rating){
  const face = d6();
  const pts = OFF_TABLE[rating][face-1];
  return { face, pts };
}
function rollDefDie(rating){
  const face = d6();
  const code = DEF_TABLE[rating][face-1]; // 1=block, 7=+7, 2=+2, 0
  return { face, code };
}

// Coach processing: returns {offResults[], defResults[]}
function rollCoach(coach){
  const offResults = [];
  const defResults = [];

  const doOne = (which, t, r)=>{
    if (t === "-" || r == null) return;
    if (t === "OFF"){
      const {face, pts} = rollOffDie(r);
      offResults.push({slot:"Coach", which, rating:r, face, pts});
    } else if (t === "DEF"){
      const {face, code} = rollDefDie(r);
      defResults.push({slot:"Coach", which, rating:r, face, code});
    }
  };

  doOne("C1", coach.t1, coach.r1);
  doOne("C2", coach.t2, coach.r2);

  return { offResults, defResults };
}

function resolveSide(my){
  // OFFENSE (players)
  const offResults = [];
  my.offense.forEach(gb=>{
    if (gb.o1!=null){
      const r = rollOffDie(gb.o1);
      offResults.push({slot:gb.slot, which:"O1", rating:gb.o1, ...r});
    }
    if (gb.o2!=null){
      const r = rollOffDie(gb.o2);
      offResults.push({slot:gb.slot, which:"O2", rating:gb.o2, ...r});
    }
  });

  // DEFENSE (players)
  const defResults = [];
  my.defense.forEach(gb=>{
    if (gb.d1!=null){
      const r = rollDefDie(gb.d1);
      defResults.push({slot:gb.slot, which:"D1", rating:gb.d1, ...r});
    }
    if (gb.d2!=null){
      const r = rollDefDie(gb.d2);
      defResults.push({slot:gb.slot, which:"D2", rating:gb.d2, ...r});
    }
  });

  // COACH (adds to offense or defense buckets depending on type)
  const coachPack = rollCoach(my.coach);
  const offAll = offResults.concat(coachPack.offResults);
  const defAll = defResults.concat(coachPack.defResults);

  // Tally
  const own7 = offAll.filter(r=>r.pts===7).length;
  const own3 = offAll.filter(r=>r.pts===3).length;
  const ownBase = offAll.reduce((a,r)=>a + r.pts, 0);

  const blocks = defAll.filter(r=>r.code===1).length;
  const bonus = defAll.reduce((a,r)=>a + (r.code===7?7:(r.code===2?2:0)), 0);

  return { offResults: offAll, defResults: defAll, own7, own3, ownBase, blocks, bonus };
}

function finalizeScore(myDetail, oppDetail){
  const cancel7 = Math.min(myDetail.own7, oppDetail.blocks);
  const rem = oppDetail.blocks - cancel7;
  const cancel3 = Math.min(myDetail.own3, rem);
  const canceledPoints = cancel7*7 + cancel3*3;
  const final = Math.max(0, myDetail.ownBase - canceledPoints) + myDetail.bonus;
  return { final, cancel7, cancel3, canceledPoints };
}

// --- UI details -----------------------------------------------------------
function detailText(name, my, opp, fin){
  const offLines = my.offResults.map(r=>`${r.slot}/${r.which}[${r.rating}] ${r.face}→${r.pts}`).join(", ");
  const defLines = my.defResults.map(r=>{
    const sym = r.code===1?"block":(r.code===7?"+7":(r.code===2?"+2":"0"));
    return `${r.slot}/${r.which}[${r.rating}] ${r.face}→${sym}`;
  }).join(", ");

  return [
    `Off dice: ${offLines || "—"}`,
    `Def dice: ${defLines || "—"}`,
    `Own offense before blocks: ${my.ownBase}`,
    `Opponent blocks used: ${opp.blocks} (−${fin.canceledPoints} = ${fin.cancel7}×7 + ${fin.cancel3}×3)`,
    `Defense bonus added: +${my.bonus}`,
  ].join("\n");
}

// --- Play -----------------------------------------------------------------
function play(){
  const home = getTeamConfig("home");
  const away = getTeamConfig("away");

  document.getElementById("homeLabel").textContent = home.name;
  document.getElementById("awayLabel").textContent = away.name;

  const h = resolveSide(home);
  const a = resolveSide(away);
  const hf = finalizeScore(h, a);
  const af = finalizeScore(a, h);

  document.getElementById("homeScore").textContent = hf.final;
  document.getElementById("awayScore").textContent = af.final;

  document.getElementById("homeDetail").textContent = detailText(home.name, h, a, hf);
  document.getElementById("awayDetail").textContent = detailText(away.name, a, h, af);

  const log = document.getElementById("log");
  const ev = document.createElement("div");
  ev.className = "event";
  const verdict = hf.final>af.final ? `${home.name} win` : hf.final<af.final ? `${away.name} win` : "Tie";
  ev.innerHTML = `<strong>${home.name} ${hf.final} — ${af.final} ${away.name}</strong> <em>${verdict}</em>`;
  log.prepend(ev);
  while (log.children.length > 40) log.removeChild(log.lastChild);
}

// --- Boot -----------------------------------------------------------------
window.addEventListener("DOMContentLoaded", ()=>{
  populateAllSelects();

  // Defaults: players O1/D1 at 2, O2/D2 “–”; Coach both “–”
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`home_${slot}_o1`).value = "2";
    document.getElementById(`home_${slot}_o2`).value = "–";
    document.getElementById(`away_${slot}_o1`).value = "2";
    document.getElementById(`away_${slot}_o2`).value = "–";
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`home_${slot}_d1`).value = "2";
    document.getElementById(`home_${slot}_d2`).value = "–";
    document.getElementById(`away_${slot}_d1`).value = "2";
    document.getElementById(`away_${slot}_d2`).value = "–";
  });
  ["home","away"].forEach(side=>{
    document.getElementById(`${side}_COACH_t1`).value = "-";
    document.getElementById(`${side}_COACH_t2`).value = "-";
    document.getElementById(`${side}_COACH_r1`).value = "–";
    document.getElementById(`${side}_COACH_r2`).value = "–";
  });

  // Buttons
  document.getElementById("homeRandom").addEventListener("click", ()=>randomizeTeam("home"));
  document.getElementById("homeClear").addEventListener("click", ()=>clearTeam("home"));
  document.getElementById("awayRandom").addEventListener("click", ()=>randomizeTeam("away"));
  document.getElementById("awayClear").addEventListener("click", ()=>clearTeam("away"));
  document.getElementById("bothRandom").addEventListener("click", ()=>{
    randomizeTeam("home"); randomizeTeam("away");
  });
  document.querySelector('[data-bulk="o2-copy"]').addEventListener("click", copyAllO2fromO1);
  document.querySelector('[data-bulk="o2-clear"]').addEventListener("click", clearAllO2);
  document.querySelector('[data-bulk="d2-copy"]').addEventListener("click", copyAllD2fromD1);
  document.querySelector('[data-bulk="d2-clear"]').addEventListener("click", clearAllD2);
  document.getElementById("rollAll").addEventListener("click", play);

  // First roll
  play();
});



