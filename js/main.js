// js/main.js
// Entry point for tabs, Play/League/Season wiring, and Postseason controls.

import { OFF_SLOTS, DEF_SLOTS } from "./constants.js";
import { loadLeague } from "./league.js";
import {
  loadSeason,
  saveSeason,
  createSeasonFromLeague,
  simulateMatchByTeams
} from "./season.js";

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
      document.getElementById(`tab-${name}`).classList.add("active");

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
  // Jump to Play tab
  document.querySelector('[data-tab="play"]').click();

  // Ensure pickers exist/are populated
  refreshTeamPickers();

  // Show the two teams and the saved breakdown
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

/**
 * Play or Rewatch a scheduled season game.
 * - replay=false: simulate if not played, save standings, store full details.
 * - replay=true : do not simulate; render saved score/details into Play tab.
 */
function playScheduledGame(g, {replay=false}={}){
  const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
  const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));

  if (replay && g.played && g.details){
    renderGameResultsToPlayTab(homeTeam, awayTeam, g.details, g.score);
    return;
  }

  // Fresh simulation
  const sim = simulateMatchByTeams(homeTeam, awayTeam);
  const { score, details } = sim;

  // First-time play: persist into season + standings
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

  // Show result in Play tab
  renderGameResultsToPlayTab(homeTeam, awayTeam, details, score);

  // Return to Season view and refresh UI
  document.querySelector('[data-tab="season"]').click();
  renderGames(SEASON);
  renderStandingsAll();
}
window.playScheduledGame = playScheduledGame;

/* -------------------------
   Season tab buttons
--------------------------*/
function wireSeasonButtons(){
  const weekSel = document.getElementById("seasonWeek");

  document.getElementById("btnSimWeek").addEventListener("click", ()=>{
    const w = SEASON.weeks.find(x=>x.week===parseInt(weekSel.value,10));
    w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
  });

  document.getElementById("btnSimSeason").addEventListener("click", ()=>{
    SEASON.weeks.forEach(w=>{
      w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
    });
  });

  document.getElementById("btnResetSeason").addEventListener("click", ()=>{
    if(!confirm("Reset season schedule and standings?")) return;
    SEASON = createSeasonFromLeague(LEAGUE);
    saveSeason(SEASON);
    renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
    renderGames(SEASON);
    renderStandingsAll();
    renderPostseason(SEASON);
  });
}

/* -------------------------
   Play tab: load/save pickers for teams
--------------------------*/
function wirePlayPickers(){
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
    renderLeagueSidebar();
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
}

/* -------------------------
   Postseason wiring
--------------------------*/
function wirePostseasonButtons(){
  const g = id => document.getElementById(id);

  g("btnGenPostseason").addEventListener("click", ()=>{
    SEASON.postseason = null;
    generatePostseason(LEAGUE, SEASON);
    renderPostseason(SEASON);
  });

  g("btnPlayAllBowls").addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    playUnplayedBowls(SEASON, LEAGUE);
    renderPostseason(SEASON);
  });

  g("btnPlayQuarterfinals").addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    if((SEASON.postseason.quarters||[]).length===0) buildQuarterfinals(SEASON);
    playQuarterfinals(SEASON, LEAGUE);
    renderPostseason(SEASON);
  });

  g("btnPlaySemifinals").addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    if((SEASON.postseason.semis||[]).length===0) buildSemifinals(SEASON);
    playSemifinals(SEASON, LEAGUE);
    renderPostseason(SEASON);
  });

  g("btnPlayChampionship").addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    if(!SEASON.postseason.championship) buildChampionship(SEASON);
    playChampionship(SEASON, LEAGUE);
    renderPostseason(SEASON);
  });

  g("btnResetPostseason").addEventListener("click", ()=>{
    if(confirm("Reset postseason?")){
      resetPostseason(SEASON);
      renderPostseason(SEASON);
    }
  });

  // Allow clicking individual initial bowls (Play/Rewatch)
  window.playBowlById = (id)=>{
    const ps = SEASON.postseason; if(!ps) return;
    const b = ps.bowlsInitial.find(x=>x.id===id); if(!b) return;

    // If not yet played, simulate + persist
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
    }

    // Rewatch: render stored details to Play tab
    document.querySelector('[data-tab="play"]').click();
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
  wirePlayPickers(); // ← important so you can load two arbitrary teams

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
  wireSeasonButtons();

  // Postseason setup
  renderPostseason(SEASON);
  wirePostseasonButtons();

  // Dev tip: clear storage while iterating if needed
  // localStorage.removeItem('GBCF_LEAGUE_V5');
  // localStorage.removeItem('GBCF_SEASON_V2');
});
