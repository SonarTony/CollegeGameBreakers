// Gamebreakers College Football — Browser Edition (HTML/CSS/JS only)

// ---- Tables ---------------------------------------------------------------
// Offense mapping: rating -> points by d6 face [1..6]
const OFF_TABLE = {
  0: [3,0,0,0,0,0],
  1: [7,3,0,0,0,0],
  2: [7,3,3,0,0,0],
  3: [7,7,3,0,0,0],
  4: [7,7,7,3,0,0]
};
// Defense mapping: rating -> special by d6 face [1..6]
// 1 = BLOCK (cancels opponent scoring die, 7s before 3s)
// 7 = +7 points to own offense
// 2 = +2 points to own offense
// 0 = no effect
const DEF_TABLE = {
  0: [1,0,0,0,0,0],
  1: [7,2,0,0,0,0],
  2: [1,1,0,0,0,0],
  3: [1,1,1,0,0,0],
  4: [1,1,1,1,0,0]
};

// Positions (eight GB slots per team)
const OFF_SLOTS = ["QB","RB","WR","OL"];
const DEF_SLOTS = ["DL","LB","DB","FLEX"];

// Build 0..4 options for each <select>
function populateRatingSelects(){
  const allSelects = document.querySelectorAll("select");
  allSelects.forEach(sel=>{
    sel.innerHTML = "";
    for(let v=0; v<=4; v++){
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      sel.appendChild(opt);
    }
  });
}

// Helpers to fetch team config from UI
function getTeamConfig(side){ // side: 'home' | 'away'
  const name = document.getElementById(`${side}Name`).value.trim() || (side==="home"?"Home":"Away");
  const offense = OFF_SLOTS.map(slot=>{
    const o = parseInt(document.getElementById(`${side}_${slot}_o`).value,10);
    const d = parseInt(document.getElementById(`${side}_${slot}_d`).value,10);
    return {slot, o, d};
  });
  const defense = DEF_SLOTS.map(slot=>{
    const o = parseInt(document.getElementById(`${side}_${slot}_o`).value,10);
    const d = parseInt(document.getElementById(`${side}_${slot}_d`).value,10);
    return {slot, o, d};
  });
  return { name, offense, defense };
}

// Randomize a team's ratings with a mild bias (offense slightly higher)
function randomizeTeam(side){
  const bias = (slot, isOff) => {
    // Slightly favor 1..3; occasionally 4; rarely 0
    const r = Math.random();
    if (r < 0.05) return 0;
    if (r < 0.55) return 2; // most common
    if (r < 0.80) return 1;
    if (r < 0.95) return 3;
    return 4;
  };
  [...OFF_SLOTS, ...DEF_SLOTS].forEach(slot=>{
    const oSel = document.getElementById(`${side}_${slot}_o`);
    const dSel = document.getElementById(`${side}_${slot}_d`);
    oSel.value = String(bias(slot, true));
    dSel.value = String(bias(slot, false));
  });
}

// Clear a team's ratings to 0:0
function clearTeam(side){
  [...OFF_SLOTS, ...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o`).value = "0";
    document.getElementById(`${side}_${slot}_d`).value = "0";
  });
}

// Roll a d6
function d6(){ return 1 + Math.floor(Math.random()*6); }

// Calculate one side’s score details based on its GB slots and the opponent defense
function resolveSide(my, opp){
  // my: {offense:[{slot,o,d}], defense:[{slot,o,d}]}
  // Step 1: roll offense dice for my 4 offense slots
  const offRolls = my.offense.map(gb => {
    const face = d6();
    const rating = clamp0to4(gb.o);
    const pts = OFF_TABLE[rating][face-1];
    return {slot:gb.slot, face, rating, pts};
  });

  // Step 2: roll defense dice for my 4 defense slots (this affects opp’s scoring; but bonuses add to my own)
  const defRolls = my.defense.map(gb => {
    const face = d6();
    const rating = clamp0to4(gb.d);
    const code = DEF_TABLE[rating][face-1]; // 1=block, 7=+7, 2=+2, 0=none
    return {slot:gb.slot, face, rating, code};
  });

  // Tally own offense before blocks
  let own7 = offRolls.filter(r=>r.pts===7).length;
  let own3 = offRolls.filter(r=>r.pts===3).length;
  let ownBase = offRolls.reduce((a,r)=>a + r.pts, 0);

  // Tally defense: blocks and bonus
  let blocks = defRolls.filter(r=>r.code===1).length;
  let bonus = defRolls.reduce((a,r)=> a + (r.code===7?7: r.code===2?2:0), 0);

  return {offRolls, defRolls, own7, own3, ownBase, blocks, bonus};
}

// Apply opponent blocks to my offense (7s first, then 3s), then add my defense bonus
function finalizeScore(myDetail, oppDetail){
  let canceled7 = Math.min(myDetail.own7, oppDetail.blocks);
  let remainingBlocks = oppDetail.blocks - canceled7;
  let canceled3 = Math.min(myDetail.own3, remainingBlocks);

  const canceledPoints = canceled7*7 + canceled3*3;
  let final = Math.max(0, myDetail.ownBase - canceledPoints) + myDetail.bonus;

  return {
    final,
    canceled7,
    canceled3,
    canceledPoints
  };
}

// Clamp helper
function clamp0to4(v){
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(4, v|0));
}

// Pretty print details for the UI
function detailText(name, my, opp, fin){
  const offFaces = my.offRolls.map(r=>`${r.slot}:${r.face}→${r.pts}`).join("  ");
  const defFaces = my.defRolls.map(r=>{
    const sym = (r.code===1?"block":(r.code===7?"+7":(r.code===2?"+2":"0")));
    return `${r.slot}:${r.face}→${sym}`;
  }).join("  ");

  return [
    `Off dice → ${offFaces}`,
    `Def dice → ${defFaces}`,
    `Own offense before blocks: ${my.ownBase}`,
    `Opponent blocks used: ${opp.blocks} (canceled ${fin.canceled7}×7 and ${fin.canceled3}×3 = −${fin.canceledPoints})`,
    `Defense bonus added: +${my.bonus}`,
  ].join("\n");
}

// Run a full game (or re-roll only one side)
function play({rollHome=true, rollAway=true} = {}){
  const home = getTeamConfig("home");
  const away = getTeamConfig("away");
  document.getElementById("homeLabel").textContent = home.name;
  document.getElementById("awayLabel").textContent = away.name;

  // If re-rolling a single side, preserve the other’s prior details? Simpler: always fresh both — consistent runs.
  const homeDetail = resolveSide(home, away);
  const awayDetail = resolveSide(away, home);

  // Final scores after cross-effects
  const homeFinal = finalizeScore(homeDetail, awayDetail);
  const awayFinal = finalizeScore(awayDetail, homeDetail);

  // Update UI
  document.getElementById("homeScore").textContent = homeFinal.final;
  document.getElementById("awayScore").textContent = awayFinal.final;

  document.getElementById("homeDetail").textContent = detailText(home.name, homeDetail, awayDetail, homeFinal);
  document.getElementById("awayDetail").textContent = detailText(away.name, awayDetail, homeDetail, awayFinal);

  // Log summary
  const log = document.getElementById("log");
  const ev = document.createElement("div");
  ev.className = "event";
  const winner =
    homeFinal.final>awayFinal.final ? `${home.name} win`
    : homeFinal.final<awayFinal.final ? `${away.name} win`
    : "Tie";
  ev.innerHTML = `<strong>${home.name} ${homeFinal.final} — ${awayFinal.final} ${away.name}</strong> <em>${winner}</em>`;
  log.prepend(ev);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

// --- UI wiring ----------------------------------------------------------------
window.addEventListener("DOMContentLoaded", ()=>{
  populateRatingSelects();

  // sensible defaults: offense ~2, defense ~2
  const def0 = () => "2";
  const off0 = () => "2";

  [...OFF_SLOTS, ...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`home_${slot}_o`).value = off0();
    document.getElementById(`home_${slot}_d`).value = def0();
    document.getElementById(`away_${slot}_o`).value = off0();
    document.getElementById(`away_${slot}_d`).value = def0();
  });

  document.getElementById("homeRandom").addEventListener("click", ()=>randomizeTeam("home"));
  document.getElementById("homeClear").addEventListener("click", ()=>clearTeam("home"));
  document.getElementById("awayRandom").addEventListener("click", ()=>randomizeTeam("away"));
  document.getElementById("awayClear").addEventListener("click", ()=>clearTeam("away"));
  document.getElementById("bothRandom").addEventListener("click", ()=>{
    randomizeTeam("home");
    randomizeTeam("away");
  });

  document.getElementById("rollAll").addEventListener("click", ()=>play());
  document.getElementById("rerollHome").addEventListener("click", ()=>play({rollHome:true, rollAway:false}));
  document.getElementById("rerollAway").addEventListener("click", ()=>play({rollHome:false, rollAway:true}));

  // First roll
  play();
});
