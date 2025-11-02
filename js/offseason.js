// js/offseason.js
// Player advancement + replacement (SR graduates → new FR), and summary HTML.

import { OFF_SLOTS, DEF_SLOTS } from "./constants.js";
import { makeFreshmanOffSlot, makeFreshmanDefSlot } from "./league.js";

/** Advance one exp step: FR->SO, SO->JR, JR->SR (SR returned as 'GRAD') */
function nextExp(exp){
  if (exp === "FR") return "SO";
  if (exp === "SO") return "JR";
  if (exp === "JR") return "SR";
  return "GRAD";
}

function advanceTeam(team, tier){
  const summary = {
    teamName: team.name,
    promoted: [],       // { side:'O'|'D', slot, name, from, to }
    graduated: [],      // { side, slot, name }
    additions: []       // { side, slot, name, detail }
  };

  // Offense
  OFF_SLOTS.forEach(slot=>{
    const p = team.offense[slot];
    const nxt = nextExp(p.exp);
    if (nxt === "GRAD"){
      summary.graduated.push({ side:"O", slot, name: p.name || slot });
      const fresh = makeFreshmanOffSlot(tier, slot);
      team.offense[slot] = fresh;
      summary.additions.push({
        side:"O", slot,
        name: fresh.name || slot,
        detail: `o1:${fresh.o1 ?? "–"} o2:${fresh.o2 ?? "–"}`
      });
    }else{
      summary.promoted.push({ side:"O", slot, name: p.name || slot, from: p.exp, to: nxt });
      p.exp = nxt;
    }
  });

  // Defense
  DEF_SLOTS.forEach(slot=>{
    const p = team.defense[slot];
    const nxt = nextExp(p.exp);
    if (nxt === "GRAD"){
      summary.graduated.push({ side:"D", slot, name: p.name || slot });
      const fresh = makeFreshmanDefSlot(tier, slot);
      team.defense[slot] = fresh;
      summary.additions.push({
        side:"D", slot,
        name: fresh.name || slot,
        detail: `d1:${fresh.d1 ?? "–"} d2:${fresh.d2 ?? "–"}`
      });
    }else{
      summary.promoted.push({ side:"D", slot, name: p.name || slot, from: p.exp, to: nxt });
      p.exp = nxt;
    }
  });

  // Coaches: unchanged per your guardrails
  return summary;
}

export function advanceSeasonAndSummarize(LEAGUE){
  const all = [];
  LEAGUE.forEach(conf=>{
    conf.teams.forEach(team=>{
      const s = advanceTeam(team, conf.tier);
      all.push(s);
    });
  });
  return buildSummaryHTML(all);
}

function row(side, slot, name, right){
  const badge = side==="O" ? "Off" : "Def";
  return `<div class="game-row">
    <div class="game-names"><span class="badge">${badge}</span> ${slot}: <strong>${name}</strong></div>
    <div class="game-score">${right||""}</div>
    <div class="game-actions"></div>
  </div>`;
}

export function buildSummaryHTML(teamSummaries){
  if (!teamSummaries || teamSummaries.length===0) return "<em>No changes</em>";
  const blocks = teamSummaries.map(ts=>{
    const grads = ts.graduated.map(g=> row(g.side, g.slot, g.name, "Graduated")).join("") || `<div class="small-muted">No graduates</div>`;
    const promos = ts.promoted.map(p=> row(p.side, p.slot, p.name, `${p.from}→${p.to}`)).join("") || `<div class="small-muted">No promotions</div>`;
    const adds = ts.additions.map(a=> row(a.side, a.slot, a.name, `New FR (${a.detail})`)).join("") || `<div class="small-muted">No additions</div>`;
    return `<div class="standings-block">
      <h4>${ts.teamName}</h4>
      <div class="games-list">${grads}</div>
      <div class="games-list">${promos}</div>
      <div class="games-list">${adds}</div>
    </div>`;
  }).join("");
  return blocks;
}

