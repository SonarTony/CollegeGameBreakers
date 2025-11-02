// js/ui_league.js
// League sidebar, team editor, and **footer controls** (Export / Import / Reset / Randomize All)

import { OFF_SLOTS, DEF_SLOTS } from "./constants.js";
import { fromRating, toRating } from "./rng.js";
import {
  randomTeamByTier,
  loadLeague,
  saveLeague,
  defaultLeague,     // ⟵ for Reset League
  CONFERENCES
} from "./league.js";
import { fillRatingSelect, fillCoachTypeSelect, fillExpSelect } from "./ui_play.js";

export let LEAGUE = loadLeague();
let selectedCI = null, selectedTI = null;

export function getTeam(ci, ti){ return LEAGUE[ci].teams[ti]; }
export function setTeam(ci, ti, team){ LEAGUE[ci].teams[ti] = team; saveLeague(LEAGUE); }
export function getTeamByIndexStr(indexStr){
  const [ci, ti] = indexStr.split(":").map(x=>parseInt(x,10));
  return getTeam(ci, ti);
}
export function setTeamByIndexStr(indexStr, team){
  const [ci, ti] = indexStr.split(":").map(x=>parseInt(x,10));
  setTeam(ci, ti, team);
}

export function refreshTeamPickers(){
  const lists = [document.getElementById("pickHomeTeam"), document.getElementById("pickAwayTeam")];
  lists.forEach(sel=>{
    if(!sel) return;
    sel.innerHTML = "";
    LEAGUE.forEach((conf, ci)=>{
      const optg = document.createElement("optgroup");
      optg.label = conf.name;
      conf.teams.forEach((t, ti)=>{
        const opt = document.createElement("option");
        opt.value = `${ci}:${ti}`;
        opt.textContent = t.name;
        optg.appendChild(opt);
      });
      sel.appendChild(optg);
    });
  });
}

export function renderLeagueSidebar(){
  const box = document.getElementById("leagueSidebar");
  if(!box) return;
  box.innerHTML = "";
  LEAGUE.forEach((conf, ci)=>{
    const block = document.createElement("div");
    block.className = "conf-block";
    const title = document.createElement("div");
    title.className = "conf-title";
    title.innerHTML = `<span>${conf.name} <small>(Tier ${conf.tier})</small></span>`;
    const mini = document.createElement("div");
    mini.className = "mini";
    const btnRnd = document.createElement("button");
    btnRnd.className = "ghost";
    btnRnd.textContent = "🎲 Randomize Conference";
    btnRnd.addEventListener("click", ()=>{
      LEAGUE[ci].teams = LEAGUE[ci].teams.map(t => randomTeamByTier(t.name, conf.tier));
      saveLeague(LEAGUE);
      renderLeagueSidebar(); refreshTeamPickers();
      if(selectedCI===ci && selectedTI!=null){ loadTeamIntoEditor(LEAGUE[ci].teams[selectedTI]); }
    });
    mini.appendChild(btnRnd);
    title.appendChild(mini);
    block.appendChild(title);

    conf.teams.forEach((t, ti)=>{
      const item = document.createElement("div");
      item.className = "team-item";
      item.dataset.ci = ci; item.dataset.ti = ti;
      item.innerHTML = `<span>${t.name}</span><small>#${ti+1}</small>`;
      if (ci===selectedCI && ti===selectedTI) item.classList.add("active");
      item.addEventListener("click", ()=>{
        selectedCI = ci; selectedTI = ti;
        renderLeagueSidebar();
        loadTeamIntoEditor(LEAGUE[ci].teams[ti]);
      });
      block.appendChild(item);
    });
    box.appendChild(block);
  });
}

export function setupEditorSelects(){
  const ids = [];
  OFF_SLOTS.forEach(s=>{ ids.push(`edit_${s}_o1`,`edit_${s}_o2`); });
  DEF_SLOTS.forEach(s=>{ ids.push(`edit_${s}_d1`,`edit_${s}_d2`); });
  ids.push("edit_COACH_t1","edit_COACH_r1","edit_COACH_t2","edit_COACH_r2");
  ids.forEach(id=>{ const el=document.getElementById(id); if(!el) return; if(id.includes("_t")) fillCoachTypeSelect(el); else fillRatingSelect(el); });
  const expIds=[]; [...OFF_SLOTS, ...DEF_SLOTS].forEach(s=> expIds.push(`edit_${s}_exp`)); expIds.push("edit_COACH_exp");
  expIds.forEach(id=>{ const el=document.getElementById(id); if(el) fillExpSelect(el); });
}

export function clearEditorSelection(){
  document.getElementById("editTeamTitle").textContent = "Select a team";
  document.getElementById("editTeamName").value = "";
  ["QB","RB","WR","OL","DL","LB","DB"].forEach(s=>{
    const f = document.getElementById(`edit_${s}_name`); if (f) f.value = "";
    const e = document.getElementById(`edit_${s}_exp`); if (e) e.value = "FR";
  });
  const cn = document.getElementById("edit_COACH_name"); if (cn) cn.value = "";
  const ce = document.getElementById("edit_COACH_exp"); if (ce) ce.value = "JR";
  [...["QB","RB","WR","OL"].flatMap(s=>[`edit_${s}_o1`,`edit_${s}_o2`]),
     ...["DL","LB","DB"].flatMap(s=>[`edit_${s}_d1`,`edit_${s}_d2`]),
     "edit_COACH_t1","edit_COACH_r1","edit_COACH_t2","edit_COACH_r2"
  ].forEach(id=>{ const el=document.getElementById(id); if(el) el.value = id.includes("_t") ? "-" : "-"; });
}

export function loadTeamIntoEditor(team){
  document.getElementById("editTeamTitle").textContent = team.name;
  document.getElementById("editTeamName").value = team.name;
  ["QB","RB","WR","OL"].forEach(s=>{
    document.getElementById(`edit_${s}_name`).value = team.offense[s].name || "";
    document.getElementById(`edit_${s}_exp`).value = team.offense[s].exp || "FR";
    document.getElementById(`edit_${s}_o1`).value = fromRating(team.offense[s].o1);
    document.getElementById(`edit_${s}_o2`).value = fromRating(team.offense[s].o2);
  });
  ["DL","LB","DB"].forEach(s=>{
    document.getElementById(`edit_${s}_name`).value = team.defense[s].name || "";
    document.getElementById(`edit_${s}_exp`).value = team.defense[s].exp || "FR";
    document.getElementById(`edit_${s}_d1`).value = fromRating(team.defense[s].d1);
    document.getElementById(`edit_${s}_d2`).value = fromRating(team.defense[s].d2);
  });
  document.getElementById("edit_COACH_name").value = team.coach.name || "";
  document.getElementById("edit_COACH_exp").value = team.coach.exp || "JR";
  document.getElementById("edit_COACH_t1").value = team.coach.t1 || "-";
  document.getElementById("edit_COACH_t2").value = team.coach.t2 || "-";
  document.getElementById("edit_COACH_r1").value = fromRating(team.coach.r1);
  document.getElementById("edit_COACH_r2").value = fromRating(team.coach.r2);
}

export function collectEditorToTeam(baseTeam){
  const name = document.getElementById("editTeamName").value.trim() || baseTeam.name;
  const team = JSON.parse(JSON.stringify(baseTeam));
  team.name = name;
  ["QB","RB","WR","OL"].forEach(s=>{
    team.offense[s].name = document.getElementById(`edit_${s}_name`).value.trim();
    team.offense[s].exp  = document.getElementById(`edit_${s}_exp`).value;
    team.offense[s].o1   = toRating(document.getElementById(`edit_${s}_o1`).value);
    team.offense[s].o2   = toRating(document.getElementById(`edit_${s}_o2`).value);
  });
  ["DL","LB","DB"].forEach(s=>{
    team.defense[s].name = document.getElementById(`edit_${s}_name`).value.trim();
    team.defense[s].exp  = document.getElementById(`edit_${s}_exp`).value;
    team.defense[s].d1   = toRating(document.getElementById(`edit_${s}_d1`).value);
    team.defense[s].d2   = toRating(document.getElementById(`edit_${s}_d2`).value);
  });
  team.coach.name = document.getElementById("edit_COACH_name").value.trim();
  team.coach.exp  = document.getElementById("edit_COACH_exp").value;
  team.coach.t1   = document.getElementById("edit_COACH_t1").value;
  team.coach.t2   = document.getElementById("edit_COACH_t2").value;
  team.coach.r1   = toRating(document.getElementById("edit_COACH_r1").value);
  team.coach.r2   = toRating(document.getElementById("edit_COACH_r2").value);
  return team;
}

/* Footer buttons + editor buttons */
export function wireLeagueEditor(){
  // Editor buttons
  document.getElementById("editRandom")?.addEventListener("click", ()=>{
    if(selectedCI==null) return;
    ["QB","RB","WR","OL","DL","LB","DB"].forEach(s=>{
      document.getElementById(`edit_${s}_name`).value = "";
      document.getElementById(`edit_${s}_exp`).value = "FR";
    });
    ["QB","RB","WR","OL"].forEach(s=>{
      document.getElementById(`edit_${s}_o1`).value = "2";
      document.getElementById(`edit_${s}_o2`).value = "-";
    });
    ["DL","LB","DB"].forEach(s=>{
      document.getElementById(`edit_${s}_d1`).value = "2";
      document.getElementById(`edit_${s}_d2`).value = "-";
    });
    document.getElementById("edit_COACH_name").value = "";
    document.getElementById("edit_COACH_exp").value = "JR";
    document.getElementById("edit_COACH_t1").value = "-";
    document.getElementById("edit_COACH_t2").value = "-";
    document.getElementById("edit_COACH_r1").value = "-";
    document.getElementById("edit_COACH_r2").value = "-";
  });

  document.getElementById("editClear")?.addEventListener("click", ()=>{
    if(selectedCI==null) return;
    ["QB","RB","WR","OL","DL","LB","DB"].forEach(s=>{
      document.getElementById(`edit_${s}_name`).value = "";
      document.getElementById(`edit_${s}_exp`).value = "FR";
      ["o1","o2","d1","d2"].forEach(k=>{
        const id=`edit_${s}_${k}`; const el=document.getElementById(id); if(el) el.value="-";
      });
    });
    document.getElementById("edit_COACH_name").value = "";
    document.getElementById("edit_COACH_exp").value = "JR";
    document.getElementById("edit_COACH_t1").value = "-";
    document.getElementById("edit_COACH_t2").value = "-";
    document.getElementById("edit_COACH_r1").value = "-";
    document.getElementById("edit_COACH_r2").value = "-";
  });

  document.getElementById("editSave")?.addEventListener("click", ()=>{
    if(selectedCI==null) return;
    const base = LEAGUE[selectedCI].teams[selectedTI];
    const updated = collectEditorToTeam(base);
    LEAGUE[selectedCI].teams[selectedTI] = updated;
    saveLeague(LEAGUE);
    renderLeagueSidebar();
    refreshTeamPickers();
  });

  // Footer: Export League JSON
  document.getElementById("exportLeague")?.addEventListener("click", ()=>{
    try{
      const blob = new Blob([JSON.stringify(LEAGUE, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "gbcf_league.json";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch(e){
      alert("Failed to export league JSON.");
    }
  });

  // Footer: Import League JSON
  document.getElementById("importLeagueFile")?.addEventListener("change", async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Expected array of conferences");
      if (!parsed.every(c => c && Array.isArray(c.teams))) throw new Error("Malformed conferences/teams");
      LEAGUE = parsed;
      saveLeague(LEAGUE);
      renderLeagueSidebar();
      refreshTeamPickers();
      clearEditorSelection();
      alert("League imported.");
    }catch(err){
      alert("Import failed: invalid league JSON.");
    }finally{
      e.target.value = "";
    }
  });

  // Footer: Reset League (seed a new default league)
  document.getElementById("resetLeague")?.addEventListener("click", ()=>{
    if (!confirm("Reset league to a fresh default?")) return;
    LEAGUE = defaultLeague();
    saveLeague(LEAGUE);
    renderLeagueSidebar();
    refreshTeamPickers();
    clearEditorSelection();
  });

  // Footer: Randomize All Conferences (keep names/tiers)
  document.getElementById("randomizeAll")?.addEventListener("click", ()=>{
    if (!confirm("Randomize every conference (keep team names)?")) return;
    LEAGUE = LEAGUE.map(conf=>{
      const teams = conf.teams.map(t => randomTeamByTier(t.name, conf.tier));
      return { ...conf, teams };
    });
    saveLeague(LEAGUE);
    renderLeagueSidebar();
    refreshTeamPickers();
    clearEditorSelection();
  });
}

export function refreshLeagueAll(){
  LEAGUE = loadLeague();
  renderLeagueSidebar();
}

export function getSelected(){ return { selectedCI, selectedTI }; }
export function setSelected(ci, ti){ selectedCI = ci; selectedTI = ti; }

export { CONFERENCES };
