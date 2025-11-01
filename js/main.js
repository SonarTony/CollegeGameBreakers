import { OFF_SLOTS, DEF_SLOTS } from "./constants.js";
import { loadLeague } from "./league.js";
import { loadSeason, saveSeason, createSeasonFromLeague, simulateMatchByTeams } from "./season.js";
import { fillAllPlaySelects, neutralDefaultsPlay, wirePlayTab, tieLogToPanel, applyTeamToSide, collectSide, buildBreakdownHTML } from "./ui_play.js";
import { refreshTeamPickers, renderLeagueSidebar, setupEditorSelects, clearEditorSelection,
         getTeamByIndexStr, setTeamByIndexStr, LEAGUE as LEAGUE_STATE, refreshLeagueAll, getTeam, CONFERENCES } from "./ui_league.js";
import { renderWeekPicker, renderGames, standingsTableHTML } from "./ui_season.js";

let LEAGUE = LEAGUE_STATE;
let SEASON = null;

// Tabs
function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.dataset.tab;
      document.querySelectorAll(".tabpanel").forEach(p=>p.classList.remove("active"));
      document.getElementById(`tab-${name}`).classList.add("active");
      if(name==="league"){ renderLeagueSidebar(); }
      if(name==="play"){ refreshTeamPickers(); }
      if(name==="season"){
        ensureSeason();
        renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); }); // re-render games when week changes
        renderGames(SEASON);
        renderStandingsAll();
      }
    });
  });
}

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
    const h = document.createElement("h4"); h.textContent = conf.name;
    blk.appendChild(h);
    const html = standingsTableHTML(SEASON, LEAGUE, ci);
    const holder = document.createElement("div");
    holder.innerHTML = html;
    blk.appendChild(holder.firstChild);
    box.appendChild(blk);
  });
}

/**
 * Render a finished game (either just played or rewatch) into the Play tab
 * using stored dice breakdowns/details.
 */
function renderGameResultsToPlayTab(homeTeam, awayTeam, details, score){
  document.querySelector('[data-tab="play"]').click();
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
 * Play or rewatch a scheduled game.
 * - When replay=true, we DO NOT re-simulate. We render the saved results/details.
 * - When replay=false and game not played, we simulate once, save scores + full details.
 */
function playScheduledGame(g, {replay=false}={}){
  const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
  const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));

  if (replay && g.played && g.details){
    // Rewatch: just render stored outcome
    renderGameResultsToPlayTab(homeTeam, awayTeam, g.details, g.score);
    return;
  }

  // Simulate fresh
  const sim = simulateMatchByTeams(homeTeam, awayTeam);
  const { score, details } = sim;

  // Save into season game
  if (!g.played){
    g.played = true;
    g.score = score;
    g.details = details; // <-- store full dice breakdowns for Rewatch

    const hk = `${g.home.ci}:${g.home.ti}`;
    const ak = `${g.away.ci}:${g.away.ti}`;
    SEASON.standings[hk].pf += score.home;
    SEASON.standings[hk].pa += score.away;
    SEASON.standings[ak].pf += score.away;
    SEASON.standings[ak].pa += score.home;
    if (score.home > score.away){ SEASON.standings[hk].w++; SEASON.standings[ak].l++; }
    else { SEASON.standings[ak].w++; SEASON.standings[hk].l++; }
    saveSeason(SEASON);
  }

  // Show results in Play tab
  renderGameResultsToPlayTab(homeTeam, awayTeam, details, score);

  // Return to Season tab view refreshed
  document.querySelector('[data-tab="season"]').click();
  renderGames(SEASON);
  renderStandingsAll();
}
window.playScheduledGame = playScheduledGame;

// Season buttons
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
  });
}

// Play pickers save/load
function wirePlayPickers(){
  document.getElementById("btnLoadHome").addEventListener("click", ()=>{
    const id = document.getElementById("pickHomeTeam").value; if(!id) return;
    const team = getTeamByIndexStr(id); applyTeamToSide(team, "home");
  });
  document.getElementById("btnLoadAway").addEventListener("click", ()=>{
    const id = document.getElementById("pickAwayTeam").value; if(!id) return;
    const team = getTeamByIndexStr(id); applyTeamToSide(team, "away");
  });
  document.getElementById("btnSaveHomeBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickHomeTeam").value; if(!sel) return;
    const team = collectSide("home"); setTeamByIndexStr(sel, team);
    renderLeagueSidebar(); // reflect name change
    refreshTeamPickers();
  });
  document.getElementById("btnSaveAwayBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickAwayTeam").value; if(!sel) return;
    const team = collectSide("away"); setTeamByIndexStr(sel, team);
    renderLeagueSidebar(); refreshTeamPickers();
  });
}

// Init
window.addEventListener("DOMContentLoaded", ()=>{
  // Tabs
  initTabs();

  // Play
  fillAllPlaySelects();
  neutralDefaultsPlay();
  wirePlayTab(tieLogToPanel);

  // League
  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();
  refreshTeamPickers();

  // Season
  ensureSeason();
  renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
  renderGames(SEASON);
  renderStandingsAll();
  wireSeasonButtons();

  // Tip: clear storage if needed during dev:
  // localStorage.removeItem('GBCF_LEAGUE_V5'); localStorage.removeItem('GBCF_SEASON_V2');
});

