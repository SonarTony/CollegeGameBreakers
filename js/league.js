import { OFF_SLOTS, DEF_SLOTS, EXP_OPTIONS, LS_LEAGUE } from "./constants.js";
import { randOf, pickWeighted } from "./rng.js";

const FIRST = ["Jalen","Cade","DeShawn","Evan","Noah","Grant","Miles","Ty","Luca","Andre","Owen","Blake","Darius","Cole","Julian","Nate","Kendrick","Logan","Mason","Dillon","Ari","Trey","Roman","Xavier"];
const LAST  = ["Hart","Lewis","Carter","Bishop","Reeves","Nguyen","Douglas","Price","Summers","Owens","Cruz","Wallace","Green","Higgins","Pierce","Foster","Sampson","Wolfe","King","Morrison","Sullivan","Brooks","Hayes"];
export function randName(){ return `${randOf(FIRST)} ${randOf(LAST)}`; }
export function unitName(kind){ const map = {OL:"Off Line", DL:"D-Line", LB:"Linebackers", DB:"Secondary"}; return map[kind] || kind; }

export const CONFERENCES = [
  { name: "Atlantic Premier",  tier: 1, teams: [
    "Coastal State Mariners","Bayview Tech Hawks","New Harbor University","Carolina Metro College",
    "Old Dominion Ridge","Tri-County Institute","Rivergate University","Greenwood State",
    "Capital City College","Lowland A&M","Summit Shoreline","Seaboard University"
  ]},
  { name: "Pacific Elite",     tier: 1, teams: [
    "Pacific Northern","Golden Bay University","Redwood State","Inland Empire Tech",
    "Sierra Vista College","Harborline Institute","Cascade Metropolitan","Silver Coast",
    "Sunset Valley","Westcrest University","Canyon Ridge","Monterey Plains"
  ]},
  { name: "Heartland",         tier: 2, teams: [
    "Prairie State","Great Plains Tech","Mid-River University","Twin Forks College",
    "Frontier A&M","Bluegrass Institute","Cedar Valley","Northern Prairie",
    "Iron Range College","Crossroads University","Wabash River","Gateway State"
  ]},
  { name: "Southern",          tier: 2, teams: [
    "Gulfshore University","Magnolia State","Pinebelt College","Lowcountry Tech",
    "Bayou Plains","Blue Delta","Savannah Ridge","Oakcrest University",
    "Peachtree State","Sunrise Coast","Riverbend College","Crescent City"
  ]},
  { name: "Mountain Valley",   tier: 3, teams: [
    "High Mesa College","Timberline State","Basin & Range","Great Divide Tech",
    "Arrowhead University","Dry Creek A&M","Painted Desert","Silver Basin",
    "Bighorn College","Sagebrush State","Clearwater Institute","Yellow Rock"
  ]},
  { name: "Northeastern",      tier: 3, teams: [
    "Commonwealth Tech","Hudson Valley","Maritime & Mechanical","Patriot State",
    "Granite Ridge","Seacoast University","Maplewood College","Pioneer Institute",
    "Harbor City State","Blackstone College","Mohawk River","Pine Grove University"
  ]}
];

const TIER_PROFILES = {
  1: {
    o2_present_p: 0.55, d2_present_p: 0.55,
    ratingWeights: [{v:0,w:5},{v:1,w:15},{v:2,w:40},{v:3,w:28},{v:4,w:12}],
    coachTypeWeights: [{v:"OFF",w:40},{v:"DEF",w:40},{v:"-",w:20}],
    coachRatingWeights: [{v:0,w:6},{v:1,w:18},{v:2,w:40},{v:3,w:26},{v:4,w:10}],
    expWeights: [{v:"FR",w:20},{v:"SO",w:26},{v:"JR",w:30},{v:"SR",w:24}],
    coachExpWeights: [{v:"SO",w:8},{v:"JR",w:40},{v:"SR",w:52}]
  },
  2: {
    o2_present_p: 0.40, d2_present_p: 0.40,
    ratingWeights: [{v:0,w:10},{v:1,w:25},{v:2,w:40},{v:3,w:20},{v:4,w:5}],
    coachTypeWeights: [{v:"OFF",w:35},{v:"DEF",w:35},{v:"-",w:30}],
    coachRatingWeights: [{v:0,w:12},{v:1,w:28},{v:2,w:38},{v:3,w:18},{v:4,w:4}],
    expWeights: [{v:"FR",w:26},{v:"SO",w:28},{v:"JR",w:28},{v:"SR",w:18}],
    coachExpWeights: [{v:"SO",w:24},{v:"JR",w:44},{v:"SR",w:32}]
  },
  3: {
    o2_present_p: 0.20, d2_present_p: 0.20,
    ratingWeights: [{v:0,w:20},{v:1,w:35},{v:2,w:35},{v:3,w:9},{v:4,w:1}],
    coachTypeWeights: [{v:"OFF",w:28},{v:"DEF",w:28},{v:"-",w:44}],
    coachRatingWeights: [{v:0,w:22},{v:1,w:40},{v:2,w:28},{v:3,w:8},{v:4,w:2}],
    expWeights: [{v:"FR",w:34},{v:"SO",w:32},{v:"JR",w:22},{v:"SR",w:12}],
    coachExpWeights: [{v:"SO",w:36},{v:"JR",w:44},{v:"SR",w:20}]
  }
};

function defaultTeam(name){
  const blankO = ()=>({ name:"", exp:"FR", o1:2, o2:null });
  const blankD = ()=>({ name:"", exp:"FR", d1:2, d2:null });
  return {
    name,
    offense:{ QB:blankO(), RB:blankO(), WR:blankO(), OL:blankO() },
    defense:{ DL:blankD(), LB:blankD(), DB:blankD() },
    coach:{ name:"", exp:"JR", t1:"-", r1:null, t2:"-", r2:null }
  };
}

function randomDieByProfile(profile, present_p){ if (Math.random() > present_p) return null; return pickWeighted(profile.ratingWeights); }
function randomCoachByProfile(profile){
  const t1 = pickWeighted(profile.coachTypeWeights);
  const t2 = pickWeighted(profile.coachTypeWeights);
  const r1 = (t1 === "-") ? null : pickWeighted(profile.coachRatingWeights);
  const r2 = (t2 === "-") ? null : pickWeighted(profile.coachRatingWeights);
  const exp = pickWeighted(profile.coachExpWeights);
  return { t1, r1, t2, r2, exp };
}

export function randomTeamByTier(name, tier){
  const p = TIER_PROFILES[tier];
  const team = defaultTeam(name);

  // names + exp
  team.offense.QB.name = randName(); team.offense.QB.exp = pickWeighted(p.expWeights);
  team.offense.RB.name = randName(); team.offense.RB.exp = pickWeighted(p.expWeights);
  team.offense.WR.name = randName(); team.offense.WR.exp = pickWeighted(p.expWeights);
  team.offense.OL.name = unitName("OL"); team.offense.OL.exp = pickWeighted(p.expWeights);

  team.defense.DL.name = unitName("DL"); team.defense.DL.exp = pickWeighted(p.expWeights);
  team.defense.LB.name = unitName("LB"); team.defense.LB.exp = pickWeighted(p.expWeights);
  team.defense.DB.name = unitName("DB"); team.defense.DB.exp = pickWeighted(p.expWeights);

  // ratings
  const coachRoll = randomCoachByProfile(p);
  team.coach.name = randName();
  team.coach.exp = coachRoll.exp;

  OFF_SLOTS.forEach(s=>{
    team.offense[s].o1 = pickWeighted(p.ratingWeights);
    team.offense[s].o2 = randomDieByProfile(p, p.o2_present_p);
  });
  DEF_SLOTS.forEach(s=>{
    team.defense[s].d1 = pickWeighted(p.ratingWeights);
    team.defense[s].d2 = randomDieByProfile(p, p.d2_present_p);
  });
  Object.assign(team.coach, coachRoll);

  return team;
}

export function defaultLeague(){
  return CONFERENCES.map(conf=>{
    const teams = conf.teams.map(name => randomTeamByTier(name, conf.tier));
    return { name: conf.name, tier: conf.tier, teams };
  });
}

export function loadLeague(){
  try{
    const raw = localStorage.getItem(LS_LEAGUE);
    if(!raw){
      const seeded = defaultLeague();
      localStorage.setItem(LS_LEAGUE, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  }catch(e){
    const seeded = defaultLeague();
    localStorage.setItem(LS_LEAGUE, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveLeague(league){ localStorage.setItem(LS_LEAGUE, JSON.stringify(league)); }
