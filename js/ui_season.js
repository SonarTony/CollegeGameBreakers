import { saveSeason } from "./season.js";
import { getTeam } from "./ui_league.js";

export function gameLabel(g){
  const h = getTeam(g.home.ci, g.home.ti).name;
  const a = getTeam(g.away.ci, g.away.ti).name;
  return `${a} @ ${h}`;
}

/**
 * Re-renders on change using provided callback
 */
export function renderWeekPicker(SEASON, onChange){
  const sel = document.getElementById("seasonWeek");
  sel.innerHTML = "";
  SEASON.weeks.forEach(w=>{
    const opt = document.createElement("option");
    opt.value = w.week;
    opt.textContent = `Week ${w.week}`;
    if (w.week === SEASON.currentWeek) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = ()=>{
    SEASON.currentWeek = parseInt(sel.value,10);
    saveSeason(SEASON);
    if (typeof onChange === "function") onChange(SEASON.currentWeek);
  };
}

export function renderGames(SEASON){
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

    const btn = document.createElement("button");
    btn.textContent = g.played ? "Rewatch" : "Play";
    btn.className = g.played ? "ghost" : "primary";
    btn.addEventListener("click", ()=> window.playScheduledGame(g, {replay: g.played}));
    actions.appendChild(btn);

    row.appendChild(names); row.appendChild(score); row.appendChild(actions);
    wrap.appendChild(row);
  });
}

export function standingsTableHTML(SEASON, LEAGUE, ci){
  const conf = LEAGUE[ci];
  const rows = conf.teams.map((t, ti)=>{
    const rec = SEASON.standings[`${ci}:${ti}`];
    return { name: t.name, w: rec.w, l: rec.l, pf: rec.pf, pa: rec.pa, diff: rec.pf - rec.pa };
  }).sort((a,b)=> (b.w - a.w) || (b.diff - a.diff) || (b.pf - a.pf) || a.name.localeCompare(b.name));
  const header = `<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>`;
  const body = rows.map(r=> `<tr><td>${r.name}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff>=0?'+':''}${r.diff}</td></tr>`).join("");
  return `${header}${body}</tbody></table>`;
}

