// Gamebreakers College Football — League Manager + Play
// Two dice per player (0–4 or "–"). Coach: two dice; Off/Def/–.
// Defense slots: DL, LB, DB (no FLEX).

// ---------- Core tables ----------
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

// ---------- Utilities ----------
const LS_KEY = "GBCF_LEAGUE_V1";
function d6(){ return 1 + Math.floor(Math.random()*6); }
function isDash(v){ return v === "-" || v === "–" || v === "" || v == null; }
function toRating(v){ return isDash(v) ? null : Math.max(0, Math.min(4, v|0)); }
function fromRating(r){ return (r==null?"-":String(r)); }

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

// ---------- League data ----------
function defaultTeam(name){
  return {
    name,
    offense:{
      QB:{o1:2,o2:null}, RB:{o1:2,o2:null}, WR:{o1:2,o2:null}, OL:{o1:2,o2:null}
    },
    defense:{
      DL:{d1:2,d2:null}, LB:{d1:2,d2:null}, DB:{d1:2,d2:null}
    },
    coach:{ t1:"-", r1:null, t2:"-", r2:null }
  };
}
function defaultLeague(){
  const confNames = ["Atlantic","Midwest","South","Pacific","Mountain","Northeast"];
  const league = confNames.map((cName, ci)=>{
    const teams = [];
    for(let i=1;i<=12;i++){
      teams.push(defaultTeam(`${cName} ${i}`));
    }
    return { name:cName, teams };
  });
  return league;
}
function loadLeague(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){ const def = defaultLeague(); localStorage.setItem(LS_KEY, JSON.stringify(def)); return def; }
    return JSON.parse(raw);
  }catch(e){
    console.warn("League load error; using defaults", e);
    const def = defaultLeague();
    localStorage.setItem(LS_KEY, JSON.stringify(def));
    return def;
  }
}
function saveLeague(league){ localStorage.setItem(LS_KEY, JSON.stringify(league)); }

let LEAGUE = loadLeague();

// ---------- Tabs ----------
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
    });
  });
}

// ---------- PLAY: selects + UI ----------
function fillAllPlaySelects(){
  const ids = [];
  OFF_SLOTS.forEach(s=>{
    ids.push(`home_${s}_o1`,`home_${s}_o2`,`away_${s}_o1`,`away_${s}_o2`);
  });
  DEF_SLOTS.forEach(s=>{
    ids.push(`home_${s}_d1`,`home_${s}_d2`,`away_${s}_d1`,`away_${s}_d2`);
  });
  ids.forEach(id=>{
    const el = document.getElementById(id);
    fillRatingSelect(el);
  });
  ["home_COACH_r1","home_COACH_r2","away_COACH_r1","away_COACH_r2"].forEach(id=>{
    fillRatingSelect(document.getElementById(id));
  });
  ["home_COACH_t1","home_COACH_t2","away_COACH_t1","away_COACH_t2"].forEach(id=>{
    fillCoachTypeSelect(document.getElementById(id));
  });
}
function neutralDefaultsPlay(){
  OFF_SLOTS.forEach(slot=>{
    document.getElementById(`home_${slot}_o1`).value="2";
    document.getElementById(`home_${slot}_o2`).value="-";
    document.getElementById(`away_${slot}_o1`).value="2";
    document.getElementById(`away_${slot}_o2`).value="-";
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`home_${slot}_d1`).value="2";
    document.getElementById(`home_${slot}_d2`).value="-";
    document.getElementById(`away_${slot}_d1`).value="2";
    document.getElementById(`away_${slot}_d2`).value="-";
  });
  ["home","away"].forEach(side=>{
    document.getElementById(`${side}Name`).value = side==="home"?"Home":"Away";
    document.getElementById(`${side}_COACH_t1`).value="-";
    document.getElementById(`${side}_COACH_t2`).value="-";
    document.getElementById(`${side}_COACH_r1`).value="-";
    document.getElementById(`${side}_COACH_r2`).value="-";
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
function randomCoachType(){
  const r = Math.random();
  if (r < 0.35) return "OFF";
  if (r < 0.70) return "DEF";
  if (r < 0.85) return "-";
  return "OFF";
}
function randomizeSide(side){
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
  });
  DEF_SLOTS.forEach(slot=>{
    document.getElementById(`${side}_${slot}_d1`).value = "-";
    document.getElementById(`${side}_${slot}_d2`).value = "-";
  });
  document.getElementById(`${side}_COACH_t1`).value="-";
  document.getElementById(`${side}_COACH_t2`).value="-";
  document.getElementById(`${side}_COACH_r1`).value="-";
  document.getElementById(`${side}_COACH_r2`).value="-";
  document.getElementById(`${side}Name`).value = side==="home"?"Home":"Away";
}

// Collect side config from Play UI
function collectSide(side){
  const name = document.getElementById(`${side}Name`).value.trim() || (side==="home"?"Home":"Away");
  const offense = {};
  OFF_SLOTS.forEach(s=>{
    offense[s] = {
      o1: toRating(document.getElementById(`${side}_${s}_o1`).value),
      o2: toRating(document.getElementById(`${side}_${s}_o2`).value)
    };
  });
  const defense = {};
  DEF_SLOTS.forEach(s=>{
    defense[s] = {
      d1: toRating(document.getElementById(`${side}_${s}_d1`).value),
      d2: toRating(document.getElementById(`${side}_${s}_d2`).value)
    };
  });
  const coach = {
    t1: document.getElementById(`${side}_COACH_t1`).value,
    r1: toRating(document.getElementById(`${side}_COACH_r1`).value),
    t2: document.getElementById(`${side}_COACH_t2`).value,
    r2: toRating(document.getElementById(`${side}_COACH_r2`).value),
  };
  return { name, offense, defense, coach };
}

// Apply a team object to a side (Play)
function applyTeamToSide(team, side){
  document.getElementById(`${side}Name`).value = team.name || (side==="home"?"Home":"Away");
  OFF_SLOTS.forEach(s=>{
    document.getElementById(`${side}_${s}_o1`).value = fromRating(team.offense[s].o1);
    document.getElementById(`${side}_${s}_o2`).value = fromRating(team.offense[s].o2);
  });
  DEF_SLOTS.forEach(s=>{
    document.getElementById(`${side}_${s}_d1`).value = fromRating(team.defense[s].d1);
    document.getElementById(`${side}_${s}_d2`).value = fromRating(team.defense[s].d2);
  });
  document.getElementById(`${side}_COACH_t1`).value = team.coach.t1 || "-";
  document.getElementById(`${side}_COACH_t2`).value = team.coach.t2 || "-";
  document.getElementById(`${side}_COACH_r1`).value = fromRating(team.coach.r1);
  document.getElementById(`${side}_COACH_r2`).value = fromRating(team.coach.r2);
  document.getElementById(`${side}Label`).textContent = team.name || (side==="home"?"Home":"Away");
}

// Populate the pickers with all league teams
function refreshTeamPickers(){
  const lists = [
    document.getElementById("pickHomeTeam"),
    document.getElementById("pickAwayTeam")
  ];
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

function getTeamByIndexStr(indexStr){
  const [ci, ti] = indexStr.split(":").map(x=>parseInt(x,10));
  return LEAGUE[ci].teams[ti];
}
function setTeamByIndexStr(indexStr, teamObj){
  const [ci, ti] = indexStr.split(":").map(x=>parseInt(x,10));
  LEAGUE[ci].teams[ti] = teamObj;
  saveLeague(LEAGUE);
}

// ---------- Dice + Resolution ----------
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
function rollCoach(coach){
  const offResults = []; const defResults = [];
  const doOne = (which, t, r)=>{
    if (t === "-" || r == null) return;
    if (t === "OFF"){ const {face, pts} = rollOffDie(r); offResults.push({slot:"Coach", which, rating:r, face, pts}); }
    else if (t === "DEF"){ const {face, code} = rollDefDie(r); defResults.push({slot:"Coach", which, rating:r, face, code}); }
  };
  doOne("C1", coach.t1, coach.r1); doOne("C2", coach.t2, coach.r2);
  return { offResults, defResults };
}
function resolveSide(sideObj){
  const offResults = [];
  OFF_SLOTS.forEach(s=>{
    const {o1,o2} = sideObj.offense[s];
    if(o1!=null){ const r=rollOffDie(o1); offResults.push({slot:s,which:"O1",rating:o1,...r}); }
    if(o2!=null){ const r=rollOffDie(o2); offResults.push({slot:s,which:"O2",rating:o2,...r}); }
  });

  const defResults = [];
  DEF_SLOTS.forEach(s=>{
    const {d1,d2} = sideObj.defense[s];
    if(d1!=null){ const r=rollDefDie(d1); defResults.push({slot:s,which:"D1",rating:d1,...r}); }
    if(d2!=null){ const r=rollDefDie(d2); defResults.push({slot:s,which:"D2",rating:d2,...r}); }
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
function playOne(){
  const home = collectSide("home");
  const away = collectSide("away");

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

// ---------- League Manager UI ----------
let selectedCI = null; // conference index
let selectedTI = null; // team index

function renderLeagueSidebar(){
  const box = document.getElementById("leagueSidebar");
  box.innerHTML = "";
  LEAGUE.forEach((conf, ci)=>{
    const block = document.createElement("div");
    block.className = "conf-block";
    const title = document.createElement("div");
    title.className = "conf-title";
    title.textContent = conf.name;
    block.appendChild(title);

    conf.teams.forEach((t, ti)=>{
      const item = document.createElement("div");
      item.className = "team-item";
      item.dataset.ci = ci;
      item.dataset.ti = ti;
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

function editorSelectIds(){
  const ids = [];
  OFF_SLOTS.forEach(s=>{ ids.push(`edit_${s}_o1`,`edit_${s}_o2`); });
  DEF_SLOTS.forEach(s=>{ ids.push(`edit_${s}_d1`,`edit_${s}_d2`); });
  ids.push("edit_COACH_t1","edit_COACH_r1","edit_COACH_t2","edit_COACH_r2");
  return ids;
}
function setupEditorSelects(){
  editorSelectIds().forEach(id=>{
    const el = document.getElementById(id);
    if (id.includes("_t")) fillCoachTypeSelect(el);
    else fillRatingSelect(el);
  });
}
function clearEditorSelection(){
  document.getElementById("editTeamTitle").textContent = "Select a team";
  document.getElementById("editTeamName").value = "";
  editorSelectIds().forEach(id=>{
    const el = document.getElementById(id);
    if (id.includes("_t")) el.value = "-";
    else el.value = "-";
  });
}
function loadTeamIntoEditor(team){
  document.getElementById("editTeamTitle").textContent = team.name;
  document.getElementById("editTeamName").value = team.name;

  OFF_SLOTS.forEach(s=>{
    document.getElementById(`edit_${s}_o1`).value = fromRating(team.offense[s].o1);
    document.getElementById(`edit_${s}_o2`).value = fromRating(team.offense[s].o2);
  });
  DEF_SLOTS.forEach(s=>{
    document.getElementById(`edit_${s}_d1`).value = fromRating(team.defense[s].d1);
    document.getElementById(`edit_${s}_d2`).value = fromRating(team.defense[s].d2);
  });
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
    team.offense[s].o1 = toRating(document.getElementById(`edit_${s}_o1`).value);
    team.offense[s].o2 = toRating(document.getElementById(`edit_${s}_o2`).value);
  });
  DEF_SLOTS.forEach(s=>{
    team.defense[s].d1 = toRating(document.getElementById(`edit_${s}_d1`).value);
    team.defense[s].d2 = toRating(document.getElementById(`edit_${s}_d2`).value);
  });
  team.coach.t1 = document.getElementById("edit_COACH_t1").value;
  team.coach.t2 = document.getElementById("edit_COACH_t2").value;
  team.coach.r1 = toRating(document.getElementById("edit_COACH_r1").value);
  team.coach.r2 = toRating(document.getElementById("edit_COACH_r2").value);

  return team;
}

// ---------- Wire up ----------
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
  document.getElementById("rollAll").addEventListener("click", playOne);

  // Team pickers
  refreshTeamPickers();
  document.getElementById("btnLoadHome").addEventListener("click", ()=>{
    const id = document.getElementById("pickHomeTeam").value;
    if(!id) return;
    const team = getTeamByIndexStr(id);
    applyTeamToSide(team, "home");
  });
  document.getElementById("btnLoadAway").addEventListener("click", ()=>{
    const id = document.getElementById("pickAwayTeam").value;
    if(!id) return;
    const team = getTeamByIndexStr(id);
    applyTeamToSide(team, "away");
  });

  document.getElementById("btnSaveHomeBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickHomeTeam").value;
    if(!sel) return;
    const team = collectSide("home");
    setTeamByIndexStr(sel, team);
    renderLeagueSidebar(); // update names if changed
    refreshTeamPickers();
  });
  document.getElementById("btnSaveAwayBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickAwayTeam").value;
    if(!sel) return;
    const team = collectSide("away");
    setTeamByIndexStr(sel, team);
    renderLeagueSidebar();
    refreshTeamPickers();
  });

  // LEAGUE setup
  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();

  // Editor buttons
  document.getElementById("editRandom").addEventListener("click", ()=>{
    if(selectedCI==null) return;
    const side = "edit"; // reuse helpers
    // quick randomize in editor
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
      document.getElementById(`edit_${s}_o1`).value = "-";
      document.getElementById(`edit_${s}_o2`).value = "-";
    });
    DEF_SLOTS.forEach(s=>{
      document.getElementById(`edit_${s}_d1`).value = "-";
      document.getElementById(`edit_${s}_d2`).value = "-";
    });
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
    renderLeagueSidebar();
    refreshTeamPickers();
    loadTeamIntoEditor(updated); // reflect normalized values
  });

  // Export / Import / Reset
  document.getElementById("exportLeague").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(LEAGUE, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "league.json"; a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("importLeagueFile").addEventListener("change", async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const txt = await f.text();
    try{
      const data = JSON.parse(txt);
      // naive validation
      if (!Array.isArray(data) || data.length!==6) throw new Error("Invalid league file.");
      LEAGUE = data;
      saveLeague(LEAGUE);
      renderLeagueSidebar(); refreshTeamPickers(); clearEditorSelection();
    }catch(err){
      alert("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
  document.getElementById("resetLeague").addEventListener("click", ()=>{
    if(!confirm("Reset league to defaults? This overwrites all saved teams.")) return;
    LEAGUE = defaultLeague();
    saveLeague(LEAGUE);
    renderLeagueSidebar(); refreshTeamPickers(); clearEditorSelection();
  });

  // First visible roll result
  playOne();
});





