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
  w.games.forEach((g)=>{
    const row = document.createElement("div");
    row.className = "game-row" + (g.played ? " played":"");
    const names = document.createElement("div");
    names.className = "game-names";
    names.textContent = gameLabel(g);

    const score = document.createElement("div");
    score.className = "game-score";
    // VISITOR–HOME display
    score.textContent = g.played ? `${g.score.away}–${g.score.home}` : "—";

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

export function teamNameOf(ref){
  const t = getTeam(ref.ci, ref.ti);
  return t ? t.name : "(?)";
}

function gameRowHTML(refHome, refAway, played, score, label, onClick){
  const names = `${teamNameOf(refAway)} @ ${teamNameOf(refHome)}`;
  const scr = played ? `${score.away}–${score.home}` : "—"; // VISITOR–HOME
  const klass = "ps-item" + (played ? " played":"");
  const btn = played ? `<button class="ghost" ${onClick ? `data-on="${onClick}"`:""}>Rewatch</button>`
                     : `<button class="primary" ${onClick ? `data-on="${onClick}"`:""}>Play</button>`;
  return `<div class="${klass}">
    <div>${names}${label?` <span class="badge round">${label}</span>`:""}</div>
    <div class="ps-score">${scr}</div>
    <div class="ps-actions">${btn}</div>
  </div>`;
}

export function renderPostseason(SEASON){
  const holder = document.getElementById("postseasonView");
  holder.innerHTML = "";
  const ps = SEASON.postseason;
  if(!ps){
    holder.innerHTML = `<div class="ps-stage"><em>No postseason yet — click "Generate Bowls".</em></div>`;
    return;
  }

  // ---------- Bowls (Play-in + Non-playoff) ----------
  const initHTML = (ps.bowlsInitial || []).map(b=>{
    const chip = b.playoff ? `<span class="chip pl">Playoff</span>` : `<span class="chip nb">Non-Playoff</span>`;
    const on = `bowl:${b.id}`;
    const scr = b.played ? `${b.score.away}–${b.score.home}` : "—"; // VISITOR–HOME
    return `<div class="ps-item${b.played?" played":""}">
      <div>${b.name} — ${teamNameOf(b.away)} @ ${teamNameOf(b.home)} ${chip}</div>
      <div class="ps-score">${scr}</div>
      <div class="ps-actions"><button ${b.played?'class="ghost"':'class="primary"'} data-on="${on}">${b.played?"Rewatch":"Play"}</button></div>
    </div>`;
  }).join("");
  const st1 = `<div class="ps-stage">
    <h4>Bowls (Play-in + Non-Playoff)</h4>
    <div class="ps-list">${initHTML || "<em>None</em>"}</div>
  </div>`;

  // ---------- Quarterfinals ----------
  let qHTML = `<em>Not set</em>`;
  if ((ps.quarters||[]).length){
    qHTML = (ps.quarters||[]).map(m=> gameRowHTML(m.home, m.away, m.played, m.score, m.id, `q:${m.id}`)).join("");
  }
  const st2 = `<div class="ps-stage">
    <h4>Quarterfinals</h4>
    <div class="ps-list">${qHTML}</div>
    <div class="ps-controls">
      <button class="ghost" id="btnBuildQF">Build Quarterfinals</button>
      <button class="ghost" id="btnPlayAllQF">Play Quarterfinals</button>
    </div>
  </div>`;

  // ---------- Semifinals ----------
  let sHTML = `<em>Not set</em>`;
  if ((ps.semis||[]).length){
    sHTML = (ps.semis||[]).map(m=> gameRowHTML(m.home, m.away, m.played, m.score, m.id, `s:${m.id}`)).join("");
  }
  const st3 = `<div class="ps-stage">
    <h4>Semifinals</h4>
    <div class="ps-list">${sHTML}</div>
    <div class="ps-controls">
      <button class="ghost" id="btnBuildSF">Build Semifinals</button>
      <button class="ghost" id="btnPlayAllSF">Play Semifinals</button>
    </div>
  </div>`;

  // ---------- National Championship ----------
  let cHTML = `<em>Not set</em>`;
  if(ps.championship){
    const g = ps.championship;
    cHTML = gameRowHTML(g.home, g.away, g.played, g.score, g.name || "NCG", `c:NCG`);
  }
  const st4 = `<div class="ps-stage">
    <h4>National Championship</h4>
    <div class="ps-list">${cHTML}</div>
    <div class="ps-controls">
      <button class="ghost" id="btnBuildNCG">Build Championship</button>
      <button class="ghost" id="btnPlayNCG">Play Championship</button>
    </div>
  </div>`;

  holder.innerHTML = st1 + st2 + st3 + st4;

  // Hook per-game buttons
  holder.querySelectorAll("[data-on]").forEach(btn=>{
    const key = btn.getAttribute("data-on");
    if (key.startsWith("bowl:")){
      const id = parseInt(key.split(":")[1],10);
      btn.addEventListener("click", ()=> window.playBowlById(id));
    } else if (key.startsWith("q:")){
      const qid = key.split(":")[1];
      btn.addEventListener("click", ()=> window.playQuarterById(qid));
    } else if (key.startsWith("s:")){
      const sid = key.split(":")[1];
      btn.addEventListener("click", ()=> window.playSemiById(sid));
    } else if (key === "c:NCG"){
      btn.addEventListener("click", ()=> window.playChampionshipNow());
    }
  });

  // Section controls
  const bq = document.getElementById("btnBuildQF");
  if (bq) bq.addEventListener("click", ()=> window.buildQuarterfinalsNow());
  const pq = document.getElementById("btnPlayAllQF");
  if (pq) pq.addEventListener("click", ()=> window.playAllQuarterfinalsNow());

  const bs = document.getElementById("btnBuildSF");
  if (bs) bs.addEventListener("click", ()=> window.buildSemifinalsNow());
  const psf = document.getElementById("btnPlayAllSF");
  if (psf) psf.addEventListener("click", ()=> window.playAllSemifinalsNow());

  const bc = document.getElementById("btnBuildNCG");
  if (bc) bc.addEventListener("click", ()=> window.buildChampionshipNow());
  const pc = document.getElementById("btnPlayNCG");
  if (pc) pc.addEventListener("click", ()=> window.playChampionshipNow());
}







