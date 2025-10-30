// Gamebreakers College Football — Browser Edition
// Up to two dice per GB slot (separately for offense and defense)

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

const OFF_SLOTS = ["QB","RB","WR","OL"];
const DEF_SLOTS = ["DL","LB","DB","FLEX"];

// ---- UI helpers -----------------------------------------------------------
function populateRatingSelects(){
  document.querySelectorAll("select").forEach(sel=>{
    sel.innerHTML = "";
    for(let v=0; v<=4; v++){
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      sel.appendChild(opt);
    }
  });
}
function clamp0to4(v){ return Math.max(0, Math.min(4, v|0)); }
function d6(){ return 1 + Math.floor(Math.random()*6); }

function getTeamConfig(side){
  const name = document.getElementById(`${side}Name`).value.trim() || (side==="home"?"Home":"Away");

  const offense = OFF_SLOTS.map(slot=>{
    return {
      slot,
      o: clamp0to4(parseInt(document.getElementById(`${side}_${slot}_o`).value,10)),
      d: clamp0to4(parseInt(document.getElementById(`${side}_${slot}_d`).value,10)),
      offDie2: !!document.getElementById(`${side}_${slot}_o2`).checked // second OFF die?
    };
  });

  const defense = DEF_SLOTS.map(slot=>{
    return {
      slot,
      o: clamp0to4(parseInt(document.getElementById(`${side}_${slot}_o`).value,10)),
      d: clamp0to4(parseInt(document.getElementById(`${side}_${slot}_d`).value,10)),
      defDie2: !!document.getElementById(`${side}_${slot}_d2`).checked // second DEF die?
    };
  });

  return { name, offense, defense };
}

function randomizeTeam(side){
  // Bias: mainly 1-3; occasional 0/4
  const pick = ()=> {
    const r = Math.random();
    if (r < 0.07) return 0;
    if (r < 0.25) return 1;
    if (r < 0.75) return 2;
    if (r < 0.93) return 3;
    return 4;
  };

  [...OFF_SLOTS, ...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o`).value = String(pick());
    document.getElementById(`${side}_${slot}_d`).value = String(pick());
  });

  // Randomly enable some second dice (about 30% chance each)
  [...OFF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o2`).checked = (Math.random()<0.3);
  });
  [...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_d2`).checked = (Math.random()<0.3);
  });
}

function clearTeam(side){
  [...OFF_SLOTS, ...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o`).value = "0";
    document.getElementById(`${side}_${slot}_d`).value = "0";
  });
  [...OFF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_o2`).checked = false;
  });
  [...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`${side}_${slot}_d2`).checked = false;
  });
}

// ---- Resolution -----------------------------------------------------------
function rollOffDiceForSlot(rating, count){
  const faces = [];
  const pts = [];
  for(let i=0;i<count;i++){
    const f = d6();
    faces.push(f);
    pts.push( OFF_TABLE[rating][f-1] );
  }
  return {faces, pts}; // pts are 0/3/7
}

function rollDefDiceForSlot(rating, count){
  const faces = [];
  const codes = [];
  for(let i=0;i<count;i++){
    const f = d6();
    faces.push(f);
    codes.push( DEF_TABLE[rating][f-1] ); // 1,7,2,0
  }
  return {faces, codes};
}

// Calculate one side’s raw details
function resolveSide(my){
  // Offense: each OFF slot has 1 die + optional second
  const offResults = my.offense.map(gb=>{
    const n = 1 + (gb.offDie2 ? 1 : 0);
    const {faces, pts} = rollOffDiceForSlot(gb.o, n);
    return {slot: gb.slot, rating: gb.o, faces, pts};
  });

  // Defense: each DEF slot has 1 die + optional second
  const defResults = my.defense.map(gb=>{
    const n = 1 + (gb.defDie2 ? 1 : 0);
    const {faces, codes} = rollDefDiceForSlot(gb.d, n);
    return {slot: gb.slot, rating: gb.d, faces, codes};
  });

  // Tally offense 7s & 3s and base
  const offFlatPts = offResults.flatMap(r => r.pts);
  const own7 = offFlatPts.filter(v=>v===7).length;
  const own3 = offFlatPts.filter(v=>v===3).length;
  const ownBase = offFlatPts.reduce((a,v)=>a+v,0);

  // Tally defense: blocks + bonus (7/2)
  const defFlatCodes = defResults.flatMap(r => r.codes);
  const blocks = defFlatCodes.filter(c=>c===1).length;
  const bonus = defFlatCodes.reduce((a,c)=>a + (c===7?7: c===2?2:0), 0);

  return {offResults, defResults, own7, own3, ownBase, blocks, bonus};
}

// Apply opponent blocks (7s first, then 3s), then add my defense bonus
function finalizeScore(myDetail, oppDetail){
  const cancel7 = Math.min(myDetail.own7, oppDetail.blocks);
  const remBlocks = oppDetail.blocks - cancel7;
  const cancel3 = Math.min(myDetail.own3, remBlocks);
  const canceledPoints = cancel7*7 + cancel3*3;

  const final = Math.max(0, myDetail.ownBase - canceledPoints) + myDetail.bonus;

  return { final, cancel7, cancel3, canceledPoints };
}

// Pretty detail text
function detailText(name, my, opp, fin){
  const offLines = my.offResults.map(r=>{
    const f = r.faces.map((x,i)=>`${x}→${r.pts[i]}`).join(", ");
    return `${r.slot} [O${r.rating}] : ${f}`;
  }).join("\n");
  const defLines = my.defResults.map(r=>{
    const f = r.faces.map((x,i)=>{
      const code = r.codes[i];
      const sym = (code===1?"block":(code===7?"+7":(code===2?"+2":"0")));
      return `${x}→${sym}`;
    }).join(", ");
    return `${r.slot} [D${r.rating}] : ${f}`;
  }).join("\n");

  return [
    `Off dice:\n${offLines}`,
    `Def dice:\n${defLines}`,
    `Own offense before blocks: ${my.ownBase}`,
    `Opponent blocks used: ${opp.blocks} (−${fin.canceledPoints} = ${fin.cancel7}×7 + ${fin.cancel3}×3)`,
    `Defense bonus added: +${my.bonus}`,
  ].join("\n");
}

// Play one game
function play(){
  const home = getTeamConfig("home");
  const away = getTeamConfig("away");

  document.getElementById("homeLabel").textContent = home.name;
  document.getElementById("awayLabel").textContent = away.name;

  const homeDetail = resolveSide(home);
  const awayDetail = resolveSide(away);

  const homeFinal = finalizeScore(homeDetail, awayDetail);
  const awayFinal = finalizeScore(awayDetail, homeDetail);

  document.getElementById("homeScore").textContent = homeFinal.final;
  document.getElementById("awayScore").textContent = awayFinal.final;

  document.getElementById("homeDetail").textContent = detailText(home.name, homeDetail, awayDetail, homeFinal);
  document.getElementById("awayDetail").textContent = detailText(away.name, awayDetail, homeDetail, awayFinal);

  const log = document.getElementById("log");
  const ev = document.createElement("div");
  ev.className = "event";
  const verdict =
    homeFinal.final>awayFinal.final ? `${home.name} win` :
    homeFinal.final<awayFinal.final ? `${away.name} win` :
    "Tie";
  ev.innerHTML = `<strong>${home.name} ${homeFinal.final} — ${awayFinal.final} ${away.name}</strong> <em>${verdict}</em>`;
  log.prepend(ev);
  while (log.children.length > 40) log.removeChild(log.lastChild);
}

// ---- Boot -----------------------------------------------------------------
window.addEventListener("DOMContentLoaded", ()=>{
  populateRatingSelects();

  // Defaults (neutral 2:2 everywhere)
  const defVal = "2";
  [...OFF_SLOTS, ...DEF_SLOTS].forEach(slot=>{
    document.getElementById(`home_${slot}_o`).value = defVal;
    document.getElementById(`home_${slot}_d`).value = defVal;
    document.getElementById(`away_${slot}_o`).value = defVal;
    document.getElementById(`away_${slot}_d`).value = defVal;
  });

  document.getElementById("homeRandom").addEventListener("click", ()=>randomizeTeam("home"));
  document.getElementById("homeClear").addEventListener("click", ()=>clearTeam("home"));
  document.getElementById("awayRandom").addEventListener("click", ()=>randomizeTeam("away"));
  document.getElementById("awayClear").addEventListener("click", ()=>clearTeam("away"));
  document.getElementById("bothRandom").addEventListener("click", ()=>{
    randomizeTeam("home");
    randomizeTeam("away");
  });

  document.getElementById("rollAll").addEventListener("click", play);

  // First roll
  play();
});
