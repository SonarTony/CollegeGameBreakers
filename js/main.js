// js/main.js
// Tabs, Play/League/Season wiring, Postseason controls, and a working History tab.
// Adds robust team-name resolution for history (fallback to current league when teamNames missing).

import { OFF_SLOTS, DEF_SLOTS, LS_HISTORY } from "./constants.js";
import { loadLeague } from "./league.js";
import {
  loadSeason,
  saveSeason,
  createSeasonFromLeague,
  simulateMatchByTeams
} from "./season.js";
import { advanceSeasonAndSummarize } from "./offseason.js";

import {
  fillAllPlaySelects,
  neutralDefaultsPlay,
  wirePlayTab,
  tieLogToPanel,
  applyTeamToSide,
  collectSide,
  buildBreakdownHTML
} from "./ui_play.js";

import {
  refreshTeamPickers,
  renderLeagueSidebar,
  setupEditorSelects,
  clearEditorSelection,
  getTeamByIndexStr,
  setTeamByIndexStr,
  LEAGUE as LEAGUE_STATE,
  refreshLeagueAll,
  getTeam
} from "./ui_league.js";

import {
  renderWeekPicker,
  renderGames,
  standingsTableHTML,
  renderPostseason
} from "./ui_season.js";

import {
  generatePostseason,
  playUnplayedBowls,
  buildQuarterfinals,
  playQuarterfinals,
  buildSemifinals,
  playSemifinals,
  buildChampionship,
  playChampionship,
  resetPostseason
} from "./postseason.js";

let LEAGUE = LEAGUE_STATE;
let SEASON = null;

/* -------------------------
   HISTORY (storage + helpers)
--------------------------*/
function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return { seasons: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { seasons: parsed }; // legacy
    if (!parsed || !Array.isArray(parsed.seasons)) return { seasons: [] };
    return parsed;
  }catch{ return { seasons: [] }; }
}
function saveHistory(obj){ localStorage.setItem(LS_HISTORY, JSON.stringify(obj)); }
function clearHistory(){ saveHistory({ seasons: [] }); }
function nextSeasonNumber(){ return loadHistory().seasons.length + 1; }

/** Build mapping { "ci:ti" : teamName } at time of save */
function snapshotTeamNames(){
  const map = {};
  LEAGUE.forEach((conf, ci)=>{
    conf.teams.forEach((t, ti)=>{
      map[`${ci}:${ti}`] = t.name;
    });
  });
  return map;
}

/** Robust name resolver:
 *  1) use snapshot teamNames if present
 *  2) else if key looks like "ci:ti", fall back to *current league* name
 *  3) else return key as-is
 */
function resolveTeamName(key, teamNames){
  if (teamNames && teamNames[key]) return teamNames[key];
  if (/^\d+:\d+$/.test(key)){
    const [ci, ti] = key.split(":").map(n=>parseInt(n,10));
    if (LEAGUE[ci] && LEAGUE[ci].teams && LEAGUE[ci].teams[ti]){
      return LEAGUE[ci].teams[ti].name || key;
    }
  }
  return key;
}

/** Count all bowl/playoff appearances for a season */
function countAppearancesForSeason(postseason, teamNameByKey){
  const counts = {};
  const inc = (ref)=>{
    if (!ref) return;
    const key = `${ref.ci}:${ref.ti}`;
    const name = resolveTeamName(key, teamNameByKey);
    counts[name] = (counts[name]||0) + 1;
  };
  if (!postseason) return counts;

  (postseason.bowlsInitial||[]).forEach(b=>{ inc(b.home); inc(b.away); });
  (postseason.quarters||[]).forEach(m=>{ inc(m.home); inc(m.away); });
  (postseason.semis||[]).forEach(m=>{ inc(m.home); inc(m.away); });
  if (postseason.championship){ inc(postseason.championship.home); inc(postseason.championship.away); }
  return counts;
}

function winnerNameIfAny(postseason, teamNameByKey){
  const g = postseason && postseason.championship;
  if (!g || !g.winner) return null;
  const key = `${g.winner.ci}:${g.winner.ti}`;
  return resolveTeamName(key, teamNameByKey);
}

/** Build all-time totals: { name: {w,l,bowls,champs} } */
function computeAllTimeTotals(history){
  const totals = {};
  const addTeam = (name)=>{
    if (!totals[name]) totals[name] = { w:0, l:0, bowls:0, champs:0 };
  };
  history.seasons.forEach(sea=>{
    const names = sea.teamNames || {};
    // standings
    Object.entries(sea.standings||{}).forEach(([key, rec])=>{
      const name = resolveTeamName(key, names);
      addTeam(name);
      totals[name].w += (rec.w||0);
      totals[name].l += (rec.l||0);
    });
    // bowls appearances
    const apps = countAppearancesForSeason(sea.postseason, names);
    Object.entries(apps).forEach(([name, c])=>{
      addTeam(name);
      totals[name].bowls += c;
    });
    // championship
    const champ = winnerNameIfAny(sea.postseason, names);
    if (champ){
      addTeam(champ);
      totals[champ].champs += 1;
    }
  });
  return totals;
}

function tableTotalsHTML(totals){
  const rows = Object.entries(totals).sort((a,b)=>{
    const A=a[1], B=b[1];
    return (B.champs - A.champs) || (B.bowls - A.bowls) || (B.w - A.w) || a[0].localeCompare(b[0]);
  }).map(([name,v])=>(
    `<tr><td>${name}</td><td>${v.w}</td><td>${v.l}</td><td>${v.bowls}</td><td>${v.champs}</td></tr>`
  )).join("");
  return `<table class="standings-table">
    <thead><tr><th>Team</th><th>W</th><th>L</th><th>Bowl Apps</th><th>Titles</th></tr></thead>
    <tbody>${rows||""}</tbody>
  </table>`;
}

function tableSeasonStandingsHTML(season){
  const names = season.teamNames || {};
  const rows = Object.entries(season.standings||{}).map(([key,rec])=>{
    const name = resolveTeamName(key, names);
    const diff = (rec.pf||0) - (rec.pa||0);
    return { name, ...rec, diff };
  }).sort((a,b)=> (b.w - a.w) || (b.diff - a.diff) || (b.pf - a.pf) || a.name.localeCompare(b.name))
    .map(r=> `<tr><td>${r.name}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff>=0?'+':''}${r.diff}</td></tr>`).join("");

  return `<table class="standings-table">
    <thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function seasonSummaryHTML(season){
  const names = season.teamNames || {};
  const champ = winnerNameIfAny(season.postseason, names);
  const apps = countAppearancesForSeason(season.postseason, names);
  const topApps = Object.entries(apps).sort((a,b)=> b[1]-a[1]).slice(0,10)
    .map(([n,c])=> `<div class="game-row"><div class="game-names">${n}</div><div class="game-score">${c}</div><div class="game-actions"></div></div>`)
    .join("") || `<div class="small-muted">No bowls played</div>`;

  return `
    ${champ ? `<p><strong>Champion:</strong> ${champ}</p>` : `<p><em>No champion recorded</em></p>`}
    <h4>Top Bowl Appearances</h4>
    <div class="games-list">${topApps}</div>
  `;
}

function exportHistoryJSON(){
  const h = loadHistory();
  const blob = new Blob([JSON.stringify(h,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gbcf_history.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Renders the History tab UI */
function renderHistoryUI(){
  const sel = document.getElementById("historySeasonSelect");
  const totalsBox = document.getElementById("historyTotals");
  const detailsBox = document.getElementById("historyDetails");
  const title = document.getElementById("historyTitle");
  if (!sel || !totalsBox || !detailsBox || !title) return;

  const history = loadHistory();

  // Populate dropdown
  sel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "Totals (All-Time)";
  sel.appendChild(optAll);

  history.seasons.forEach((s, idx)=>{
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = s.label || `Season ${idx+1}`;
    sel.appendChild(opt);
  });

  // Default to ALL if nothing selected
  sel.value = sel.value || "ALL";

  function draw(){
    const v = sel.value;
    if (v === "ALL"){
      title.textContent = "Totals (All-Time)";
      const totals = computeAllTimeTotals(history);
      totalsBox.innerHTML = tableTotalsHTML(totals);
      detailsBox.innerHTML = `<div class="small-muted">Select a specific season to see its standings and champion.</div>`;
    } else {
      const idx = parseInt(v,10);
      const season = history.seasons[idx];
      title.textContent = season.label || `Season ${idx+1}`;
      totalsBox.innerHTML = tableSeasonStandingsHTML(season);
      detailsBox.innerHTML = seasonSummaryHTML(season);
    }
  }
  sel.onchange = draw;
  draw();
}

function deleteSelectedSeasonFromHistory(){
  const sel = document.getElementById("historySeasonSelect");
  if (!sel || sel.value === "ALL") return;
  const idx = parseInt(sel.value,10);
  const h = loadHistory();
  if (idx<0 || idx>=h.seasons.length) return;
  if (!confirm(`Delete ${h.seasons[idx].label || `Season ${idx+1}`} from history?`)) return;
  h.seasons.splice(idx,1);
  saveHistory(h);
  renderHistoryUI();
}

function wireHistoryTab(){
  const btnDel = document.getElementById("btnDeleteSeasonFromHistory");
  if (btnDel){ btnDel.addEventListener("click", deleteSelectedSeasonFromHistory); }

  const btnClr = document.getElementById("btnClearHistory");
  if (btnClr){
    btnClr.addEventListener("click", ()=>{
      if (!confirm("Delete ALL saved seasons from history?")) return;
      clearHistory();
      renderHistoryUI();
    });
  }

  const btnExp = document.getElementById("btnExportHistory");
  if (btnExp){ btnExp.addEventListener("click", exportHistoryJSON); }

  const inpImp = document.getElementById("importHistoryFile");
  if (inpImp){
    inpImp.addEventListener("change", async (e)=>{
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try{
        const text = await file.text();
        const parsed = JSON.parse(text);
        // Accept either {seasons:[...]} or bare [...]
        const obj = Array.isArray(parsed) ? {seasons: parsed} : parsed;
        if (!obj || !Array.isArray(obj.seasons)) throw new Error("Invalid history format");
        saveHistory(obj);
        renderHistoryUI();
        alert("History imported.");
      }catch(err){
        alert("Failed to import history JSON.");
      }finally{
        e.target.value = "";
      }
    });
  }
}

/* -------------------------
   Tabs
--------------------------*/
function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.dataset.tab;
      document.querySelectorAll(".tabpanel").forEach(p=>p.classList.remove("active"));
      const panel = document.getElementById(`tab-${name}`);
      if (panel) panel.classList.add("active");

      if(name==="league"){
        renderLeagueSidebar();
      }
      if(name==="play"){
        refreshTeamPickers();
      }
      if(name==="season"){
        ensureSeason();
        renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
        renderGames(SEASON);
        renderStandingsAll();
        renderPostseason(SEASON);
        wireSeasonButtons();        // idempotent
        wirePostseasonButtons();    // idempotent
        updateSaveSeasonButton();
      }
      if(name==="history"){
        renderHistoryUI();
        wireHistoryTab();
      }
    });
  });
}

/* -------------------------
   Season helpers
--------------------------*/
function ensureSeason(){
  if (SEASON) return;
  const raw = loadSeason();
  if (raw){ SEASON = raw; return; }
  SEASON = createSeasonFromLeague(LEAGUE);
  saveSeason(SEASON);
}

function renderStandingsAll(){
  const box = document.getElementById("standingsAll");
  if (!box) return;
  box.innerHTML = "";
  LEAGUE.forEach((conf, ci)=>{
    const blk = document.createElement("div");
    blk.className = "standings-block";
    const h = document.createElement("h4");
    h.textContent = conf.name;
    blk.appendChild(h);
    const html = standingsTableHTML(SEASON, LEAGUE, ci);
    const holder = document.createElement("div");
    holder.innerHTML = html;
    blk.appendChild(holder.firstChild);
    box.appendChild(blk);
  });
}

/* -------------------------
   Play tab rendering (results & rewatch)
--------------------------*/
function renderGameResultsToPlayTab(homeTeam, awayTeam, details, score){
  const t = document.querySelector('[data-tab="play"]');
  if (t) t.click();

  refreshTeamPickers();

  applyTeamToSide(homeTeam, "home");
  applyTeamToSide(awayTeam, "away");

  const { h, a, hf, af } = details;
  const hRender = buildBreakdownHTML(h, a, hf);
  const aRender = buildBreakdownHTML(a, h, af);

  document.getElementById("homeScore").textContent = score.home;
  document.getElementById("awayScore").textContent = score.away;
  document.getElementById("homeSummary").textContent = hRender.summary;
  document.getElementById("awaySummary").textContent = aRender.summary;
  document.getElementById("homeDetail").innerHTML = hRender.body;
  document.getElementById("awayDetail").innerHTML = aRender.body;
}

function playScheduledGame(g, {replay=false}={}){
  const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
  const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));

  if (replay && g.played && g.details){
    renderGameResultsToPlayTab(homeTeam, awayTeam, g.details, g.score);
    return;
  }

  const sim = simulateMatchByTeams(homeTeam, awayTeam);
  const { score, details } = sim;

  if (!g.played){
    g.played = true;
    g.score = score;
    g.details = details;

    const hk = `${g.home.ci}:${g.home.ti}`;
    const ak = `${g.away.ci}:${g.away.ti}`;
    SEASON.standings[hk].pf += score.home;
    SEASON.standings[hk].pa += score.away;
    SEASON.standings[ak].pf += score.away;
    SEASON.standings[ak].pa += score.home;
    if (score.home > score.away){
      SEASON.standings[hk].w++; SEASON.standings[ak].l++;
    } else {
      SEASON.standings[ak].w++; SEASON.standings[hk].l++;
    }
    saveSeason(SEASON);
  }

  renderGameResultsToPlayTab(homeTeam, awayTeam, details, score);

  const s = document.querySelector('[data-tab="season"]');
  if (s) s.click();
  renderGames(SEASON);
  renderStandingsAll();
}
window.playScheduledGame = playScheduledGame;

/* -------------------------
   Season tab buttons
--------------------------*/
let seasonButtonsWired = false;
function wireSeasonButtons(){
  if (seasonButtonsWired) return;
  seasonButtonsWired = true;

  const weekSel = document.getElementById("seasonWeek");

  const btnWeek = document.getElementById("btnSimWeek");
  if (btnWeek){
    btnWeek.addEventListener("click", ()=>{
      const w = SEASON.weeks.find(x=>x.week===parseInt(weekSel.value,10));
      w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
    });
  }

  const btnSeason = document.getElementById("btnSimSeason");
  if (btnSeason){
    btnSeason.addEventListener("click", ()=>{
      SEASON.weeks.forEach(w=>{
        w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
      });
    });
  }

  const btnReset = document.getElementById("btnResetSeason");
  if (btnReset){
    btnReset.addEventListener("click", ()=>{
      if(!confirm("Reset season schedule and standings?")) return;
      SEASON = createSeasonFromLeague(LEAGUE);
      saveSeason(SEASON);
      renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
      renderGames(SEASON);
      renderStandingsAll();
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  // Save Season (disabled until championship is played)
  const btnSave = document.getElementById("btnSaveSeason");
  if (btnSave){
    btnSave.addEventListener("click", ()=>{
      if (!isSeasonComplete()) return;

      const teamNames = snapshotTeamNames();
      const history = loadHistory();
      const sn = nextSeasonNumber();

      const snapshot = {
        id: `S${sn}`,
        label: `Season ${sn}`,
        ts: Date.now(),
        teamNames,                 // map "ci:ti" -> team name at save-time
        standings: SEASON.standings,
        postseason: SEASON.postseason
      };
      history.seasons.push(snapshot);
      saveHistory(history);
      updateSaveSeasonButton();
      alert(`Saved ${snapshot.label} to history.`);

      // Refresh History tab if open
      if (document.getElementById("tab-history")?.classList.contains("active")){
        renderHistoryUI();
      }
    });
  }

  // Advance Season (uses your offseason.js)
  const btnAdv = document.getElementById("btnAdvanceSeason");
  if (btnAdv){
    btnAdv.addEventListener("click", ()=>{
      const recapHTML = advanceSeasonAndSummarize(LEAGUE); // mutates league
      SEASON = createSeasonFromLeague(LEAGUE);
      saveSeason(SEASON);

      renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
      renderGames(SEASON);
      renderStandingsAll();
      renderPostseason(SEASON);
      updateSaveSeasonButton();

      const w = window.open("", "_blank");
      if (w && w.document){
        w.document.write("<!doctype html><title>Year-End Recap</title>");
        w.document.write('<meta charset="utf-8"/>');
        w.document.write('<div style="font-family:system-ui,Arial,sans-serif; padding:12px; color:#111;">');
        w.document.write("<h2>Year-End Recap</h2>");
        w.document.write(recapHTML || "<em>No changes</em>");
        w.document.write("</div>");
        w.document.close();
      } else {
        alert("Season advanced. A recap window was blocked by the browser — enable popups to see the detailed summary.");
      }
    });
  }
}

/* -------------------------
   Save Season enablement
--------------------------*/
function isSeasonComplete(){
  const ps = SEASON?.postseason;
  return !!(ps && ps.championship && ps.championship.played);
}
function updateSaveSeasonButton(){
  const btn = document.getElementById("btnSaveSeason");
  if (btn) btn.disabled = !isSeasonComplete();
}

/* -------------------------
   Play tab pickers
--------------------------*/
function wirePlayPickers(){
  const b1 = document.getElementById("btnLoadHome");
  if (b1){
    b1.addEventListener("click", ()=>{
      const id = document.getElementById("pickHomeTeam").value;
      if(!id) return;
      const team = getTeamByIndexStr(id);
      applyTeamToSide(team, "home");
    });
  }

  const b2 = document.getElementById("btnLoadAway");
  if (b2){
    b2.addEventListener("click", ()=>{
      const id = document.getElementById("pickAwayTeam").value;
      if(!id) return;
      const team = getTeamByIndexStr(id);
      applyTeamToSide(team, "away");
    });
  }

  const b3 = document.getElementById("btnSaveHomeBack");
  if (b3){
    b3.addEventListener("click", ()=>{
      const sel = document.getElementById("pickHomeTeam").value;
      if(!sel) return;
      const team = collectSide("home");
      setTeamByIndexStr(sel, team);
      renderLeagueSidebar();
      refreshTeamPickers();
    });
  }

  const b4 = document.getElementById("btnSaveAwayBack");
  if (b4){
    b4.addEventListener("click", ()=>{
      const sel = document.getElementById("pickAwayTeam").value;
      if(!sel) return;
      const team = collectSide("away");
      setTeamByIndexStr(sel, team);
      renderLeagueSidebar();
      refreshTeamPickers();
    });
  }
}

/* -------------------------
   Postseason wiring (unchanged)
--------------------------*/
let psButtonsWired = false;
function wirePostseasonButtons(){
  if (psButtonsWired) return;
  psButtonsWired = true;

  const g = id => document.getElementById(id);

  const gen = g("btnGenPostseason");
  if (gen){
    gen.addEventListener("click", ()=>{
      SEASON.postseason = null;
      generatePostseason(LEAGUE, SEASON);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pal = g("btnPlayAllBowls");
  if (pal){
    pal.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      playUnplayedBowls(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pq = g("btnPlayQuarterfinals");
  if (pq){
    pq.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      if((SEASON.postseason.quarters||[]).length===0) buildQuarterfinals(SEASON);
      playQuarterfinals(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const psf = g("btnPlaySemifinals");
  if (psf){
    psf.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      if((SEASON.postseason.semis||[]).length===0) buildSemifinals(SEASON);
      playSemifinals(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pc = g("btnPlayChampionship");
  if (pc){
    pc.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      if(!SEASON.postseason.championship) buildChampionship(SEASON);
      playChampionship(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pr = g("btnResetPostseason");
  if (pr){
    pr.addEventListener("click", ()=>{
      if(confirm("Reset postseason?")){
        resetPostseason(SEASON);
        renderPostseason(SEASON);
        updateSaveSeasonButton();
      }
    });
  }

  // Allow clicking individual initial bowls (Play/Rewatch)
  window.playBowlById = (id)=>{
    const ps = SEASON.postseason; if(!ps) return;
    const b = ps.bowlsInitial.find(x=>x.id===id); if(!b) return;

    if(!b.played){
      const home = JSON.parse(JSON.stringify(getTeam(b.home.ci, b.home.ti)));
      const away = JSON.parse(JSON.stringify(getTeam(b.away.ci, b.away.ti)));
      const sim = simulateMatchByTeams(home, away);
      b.played = true;
      b.score = sim.score;
      b.details = sim.details;
      b.winner = (sim.score.home>sim.score.away ? b.home : b.away);
      saveSeason(SEASON);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    }

    const t = document.querySelector('[data-tab="play"]');
    if (t) t.click();
    refreshTeamPickers();

    const homeTeam = JSON.parse(JSON.stringify(getTeam(b.home.ci, b.home.ti)));
    const awayTeam = JSON.parse(JSON.stringify(getTeam(b.away.ci, b.away.ti)));

    applyTeamToSide(homeTeam, "home");
    applyTeamToSide(awayTeam, "away");

    const { h, a, hf, af } = b.details;
    const hRender = buildBreakdownHTML(h, a, hf);
    const aRender = buildBreakdownHTML(a, h, af);

    document.getElementById("homeScore").textContent = b.score.home;
    document.getElementById("awayScore").textContent = b.score.away;
    document.getElementById("homeSummary").textContent = hRender.summary;
    document.getElementById("awaySummary").textContent = aRender.summary;
    document.getElementById("homeDetail").innerHTML = hRender.body;
    document.getElementById("awayDetail").innerHTML = aRender.body;
  };
}

/* -------------------------
   Boot
--------------------------*/
window.addEventListener("DOMContentLoaded", ()=>{
  // Tabs
  initTabs();

  // Play tab setup
  fillAllPlaySelects();
  neutralDefaultsPlay();
  wirePlayTab(tieLogToPanel);
  wirePlayPickers();

  // League tab setup
  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();
  refreshTeamPickers();

  // Season tab setup
  ensureSeason();
  renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
  renderGames(SEASON);
  renderStandingsAll();
  renderPostseason(SEASON);
  wireSeasonButtons();
  wirePostseasonButtons();
  updateSaveSeasonButton();

  // Prepare History tab (safe to render on load)
  renderHistoryUI();
  wireHistoryTab();
});






