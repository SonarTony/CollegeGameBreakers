import { OFF_TABLE, DEF_TABLE } from "./constants.js";
import { d6 } from "./rng.js";

export function rollOffDie(rating){ const face=d6(); const pts=OFF_TABLE[rating][face-1]; return { face, pts }; }
export function rollDefDie(rating){ const face=d6(); const code=DEF_TABLE[rating][face-1]; return { face, code }; }

export function rollCoach(coach){
  const offResults=[]; const defResults=[];
  const rollOne=(which,t,r)=>{
    if (t === "-" || r == null) return;
    if (t === "OFF"){ const {face, pts}=rollOffDie(r); offResults.push({slot:"Coach",which,rating:r,face,pts,name:coach.name,exp:coach.exp}); }
    else if (t === "DEF"){ const {face, code}=rollDefDie(r); defResults.push({slot:"Coach",which,rating:r,face,code,name:coach.name,exp:coach.exp}); }
  };
  rollOne("C1",coach.t1,coach.r1);
  rollOne("C2",coach.t2,coach.r2);
  return { offResults, defResults };
}

export function resolveSide(sideObj){
  const offResults=[]; ["QB","RB","WR","OL"].forEach(s=>{
    const o1 = sideObj.offense[s].o1; const o2 = sideObj.offense[s].o2;
    if(o1!=null){ const r=rollOffDie(o1); offResults.push({slot:s,which:"O1",rating:o1,...r,name:sideObj.offense[s].name,exp:sideObj.offense[s].exp}); }
    if(o2!=null){ const r=rollOffDie(o2); offResults.push({slot:s,which:"O2",rating:o2,...r,name:sideObj.offense[s].name,exp:sideObj.offense[s].exp}); }
  });

  const defResults=[]; ["DL","LB","DB"].forEach(s=>{
    const d1 = sideObj.defense[s].d1; const d2 = sideObj.defense[s].d2;
    if(d1!=null){ const r=rollDefDie(d1); defResults.push({slot:s,which:"D1",rating:d1,...r,name:sideObj.defense[s].name,exp:sideObj.defense[s].exp}); }
    if(d2!=null){ const r=rollDefDie(d2); defResults.push({slot:s,which:"D2",rating:d2,...r,name:sideObj.defense[s].name,exp:sideObj.defense[s].exp}); }
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

/**
 * Final scoring with NEW block priority:
 * - Blocks MUST cancel all 3-point results before any 7-point results.
 */
export function finalizeScore(myDetail, oppDetail){
  // Opponent's blocks apply to my offense.
  const cancel3 = Math.min(myDetail.own3, oppDetail.blocks);
  const rem = oppDetail.blocks - cancel3;
  const cancel7 = Math.min(myDetail.own7, rem);
  const canceledPoints = cancel3*3 + cancel7*7;
  const final = Math.max(0, myDetail.ownBase - canceledPoints) + myDetail.bonus;
  return { final, cancel7, cancel3, canceledPoints };
}

// Tiebreaker — coach only, repeat until not tied
function sumDefBonus(defResults){
  return defResults.reduce((a,r)=> a + (r.code===7 ? 7 : (r.code===2 ? 2 : 0)), 0);
}

/**
 * Coach-only delta with NEW block priority (3s cancelled before 7s).
 */
function coachTiebreakDelta(myCoachPack, oppCoachPack){
  const myOff = myCoachPack.offResults;
  const myDef = myCoachPack.defResults;
  const oppDef = oppCoachPack.defResults;

  const my7 = myOff.filter(r=>r.pts===7).length;
  const my3 = myOff.filter(r=>r.pts===3).length;
  const myBase = myOff.reduce((a,r)=>a + r.pts, 0);

  const oppBlocks = oppDef.filter(r=>r.code===1).length;

  // NEW ORDER: cancel 3s first, then 7s
  const cancel3 = Math.min(my3, oppBlocks);
  const remainingBlocks = oppBlocks - cancel3;
  const cancel7 = Math.min(my7, remainingBlocks);
  const canceled = cancel3*3 + cancel7*7;

  const offenseDelta = Math.max(0, myBase - canceled);
  const defenseBonus = sumDefBonus(myDef);
  return offenseDelta + defenseBonus;
}

export function resolveTieByCoaches(homeTeam, awayTeam, startHome, startAway, logFn = ()=>{}){
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
