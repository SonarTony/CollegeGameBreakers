// js/roster.js
// Season advancement helpers: advance players (FR->SO->JR->SR graduates) and coach years.

import { OFF_SLOTS, DEF_SLOTS } from "./constants.js";
import { randName, unitName } from "./league.js";

// Helpers to create a baseline freshman for a slot
function makeFreshmanOff(slot){
  return { name: slot==="OL" ? unitName("OL") : randName(), exp: "FR", o1: 2, o2: null };
}
function makeFreshmanDef(slot){
  return { name: unitName(slot), exp: "FR", d1: 2, d2: null };
}

function advanceClass(exp){
  if (exp === "FR") return "SO";
  if (exp === "SO") return "JR";
  if (exp === "JR") return "SR";
  // SR or anything else → graduate (signal by returning null)
  return null;
}

function advanceTeamInPlace(team){
  // Offense
  OFF_SLOTS.forEach(slot=>{
    const p = team.offense[slot];
    const next = advanceClass(p.exp);
    if (next){ // still on roster
      p.exp = next;
    } else {   // SR graduated → replace with new FR baseline
      const neo = makeFreshmanOff(slot);
      team.offense[slot] = neo;
    }
  });

  // Defense
  DEF_SLOTS.forEach(slot=>{
    const p = team.defense[slot];
    const next = advanceClass(p.exp);
    if (next){
      p.exp = next;
    } else {
      const neo = makeFreshmanDef(slot);
      team.defense[slot] = neo;
    }
  });

  // Coach: years +1, cap at 6 (aligns with UI picker)
  const yrs = parseInt(team.coach.exp, 10);
  const cur = Number.isFinite(yrs) ? yrs : 3; // back-compat for "JR" etc.
  team.coach.exp = String(Math.max(1, Math.min(6, cur + 1)));

  return team;
}

export function advanceLeagueRosters(LEAGUE){
  LEAGUE.forEach(conf=>{
    conf.teams = conf.teams.map(t => advanceTeamInPlace(t));
  });
  return LEAGUE;
}
