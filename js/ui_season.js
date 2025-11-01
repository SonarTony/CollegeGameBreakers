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
    // display visitor–home
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

function gameRowHTML(refHome, refAway, played, score, label){
  const names = `${teamNameOf(refAway)} @ ${teamNameOf(refHome)}`;
  // display visitor–home in postseason lists
  const scr = played ? `${score.away}–${score.home}` : "—";
  const klass = "ps-item" + (played ? " played":"");
  return `<div class="${klass}">
    <div>${names}${label?` <span class="badge round">${label}</span>`:""}</div>
    <div class="ps-score">${scr}</div>
    <div class="ps-actions"></div>
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

  // Bowls section (with section-level Play All button here)
  const initHTML = (ps.bowlsInitial || []).map(b=>{
    const chip = b.playoff ? `<span class="chip pl">Playoff</span>` : `<span class="chip nb">Non-Playoff</span>`;
    const scr = b.played ? `${b.score.away}–${b.score.home}` : "—";
    const btnTxt = b.played ? "Rewatch" : "Play";
    return `<div class="ps-item${b.played?" played":""}">
      <div>${b.name} — ${teamNameOf(b.away)} @ ${teamNameOf(b.home)} ${chip}</div>
      <div class="ps-score">${scr}</div>
      <div class="ps-actions"><button data-bowl="${b.id}">${btnTxt}</button></div>
    </div>`;
  }).join("");
  const st1 = `
    <div class="ps-stage">
      <h4>Bowls (Play-in + Non-Playoff)</h4>
      <div class="ps-controls"><button class="ghost" id="btnSecPlayBowlsAll">Play All Bowls</button></div>
      <div class="ps-list">${initHTML}</div>
    </div>`;

  // Quarters section (with section-level Play)
  const qHTML = (ps.quarters||[]).map(m=>{
    const row = gameRowHTML(m.home, m.away, m.played, m.score, m.id);
    const btnTxt = m.played ? "Rewatch" : "Play";
    return row.replace('<div class="ps-actions"></div>',
      `<div class="ps-actions"><button data-quarter="${m.id}">${btnTxt}</button></div>`);
  }).join("") || `<em>Not set</em>`;
  const st2 = `
    <div class="ps-stage">
      <h4>Quarterfinals</h4>
      <div class="ps-controls"><button class="ghost" id="btnSecPlayQF">Play Quarterfinals</button></div>
      <div class="ps-list">${qHTML}</div>
    </div>`;

  // Semis
  const sHTML = (ps.semis||[]).map(m=>{
    const row = gameRowHTML(m.home, m.away, m.played, m.score, m.id);
    const btnTxt = m.played ? "Rewatch" : "Play";
    return row.replace('<div class="ps-actions"></div>',
      `<div class="ps-actions"><button data-semi="${m.id}">${btnTxt}</button></div>`);
  }).join("") || `<em>Not set</em>`;
  const st3 = `
    <div class="ps-stage">
      <h4>Semifinals</h4>
      <div class="ps-controls"><button class="ghost" id="btnSecPlaySF">Play Semifinals</button></div>
      <div class="ps-list">${sHTML}</div>
    </div>`;

  // Championship
  let cHTML = `<em>Not set</em>`;
  if(ps.championship){
    const g = ps.championship;
    const row = gameRowHTML(g.home, g.away, g.played, g.score, g.name || "NCG");
    const btnTxt = g.played ? "Rewatch" : "Play";
    cHTML = row.replace('<div class="ps-actions"></div>',
      `<div class="ps-actions"><button data-champ="1">${btnTxt}</button></div>`);
  }
  const st4 = `
    <div class="ps-stage">
      <h4>National Championship</h4>
      <div class="ps-controls"><button class="ghost" id="btnSecPlayNCG">Play Championship</button></div>
      <div class="ps-list">${cHTML}</div>
    </div>`;

  holder.innerHTML = st1 + st2 + st3 + st4;

  // Wire per-game buttons
  holder.querySelectorAll("[data-bowl]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = parseInt(btn.getAttribute("data-bowl"),10);
      window.playBowlById(id);
    });
  });
  holder.querySelectorAll("[data-quarter]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-quarter");
      window.playQuarterById(id);
    });
  });
  holder.querySelectorAll("[data-semi]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-semi");
      window.playSemiById(id);
    });
  });
  holder.querySelectorAll("[data-champ]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      window.playChampionshipSingle();
    });
  });
}






