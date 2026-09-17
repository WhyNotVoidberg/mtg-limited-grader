
const GRADES=["","A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F"];
const ROLES=["","Creature","Removal","Combat Trick","Card Advantage","Interaction","Ramp","Mana/Fixing","Recursion","Build-Around","Payoff","Other"];
const SECONDARY=["Evasion","Burn","Cantrip","Card Selection","Modal","Token Maker","Value","ETB","Death Trigger","Sacrifice Outlet","Graveyard Filler","Finisher","Defensive","Aggressive","Tempo","Protection"];
const SYNERGY=["Artifacts","Enchantments","Rooms","Eerie","Manifest Dread","Face-Down","Delirium","Survival","Graveyard","Reanimator","Tokens","+1/+1 Counters","Sacrifice","Lifegain","Discard","Go-Wide","Go-Tall","Power 2 or Less","Aggro","Control","Tempo"];
const DSK_MECHANICS=["Rooms","Manifest Dread","Survival","Eerie","Impending","Delirium"];
const APP_VERSION="1.3";
const state=loadState();
let currentSet=null,currentCards=[],currentIndex=0;

function loadState(){try{return JSON.parse(localStorage.getItem("mtgLimitedGraderV1"))||{sets:{}}}catch{return {sets:{}}}}
function migrateState(){
  const toFive=v=>{const n=Number(v);if(!Number.isFinite(n)||n<1)return v;return String(Math.max(1,Math.min(5,Math.ceil(n/2))))};
  Object.values(state.sets||{}).forEach(s=>{
    Object.values(s.ratings||{}).forEach(d=>{
      if(d.grade==="F+"||d.grade==="F-")d.grade="F";
      if(Number(d.power)>5)d.power=toFive(d.power);
      if(Number(d.consistency)>5)d.consistency=toFive(d.consistency);
      if(/^\d+$/.test(String(d.synergyReliance||""))){
        const n=Number(d.synergyReliance);d.synergyReliance=n>=8?"Dependent":n>=4?"Assisted":"Independent";
      }
    });
    const mech=Object.values(s.mechanics||{});
    const keys=["Power","Fun to play","Fun to play against","Synergy reliance","Desire to return","Likelihood to return"];
    const legacy=mech.some(d=>keys.some(k=>Number(d[k])>5));
    if(legacy)mech.forEach(d=>keys.forEach(k=>{if(d[k]!==undefined&&d[k]!=="")d[k]=toFive(d[k])}));
  });
}

function persist(){localStorage.setItem("mtgLimitedGraderV1",JSON.stringify(state))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function cardKey(c){return c.oracle_id||c.id}
function gradeData(code,key){state.sets[code].ratings[key] ||= {secondary:[],synergy:[]}; return state.sets[code].ratings[key]}
function imageUrl(c){return c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || ""}
function cardColor(c){if((c.type_line||"").startsWith("Land"))return"L"; let a=c.colors||[]; if(a.length>1)return"M"; if(a.length===0)return"C"; return a[0]}
function inferDefaults(c){
  const type=(c.type_line||"").toLowerCase(), text=(c.oracle_text||"").toLowerCase();
  const secondary=[], synergy=[];
  let primary="Other";
  const add=(a,x)=>{if(x&&!a.includes(x))a.push(x)};
  if(type.includes("creature")) primary="Creature";
  else if(/destroy target|exile target|damage to target creature|damage to any target|gets -\d+\/-\d+|gets -x\/-x/.test(text)) primary="Removal";
  else if(/draw (two|three|four|five|\d+) cards/.test(text)) primary="Card Advantage";
  else if(/counter target spell|return target .* to (its|their) owner's hand|tap target/.test(text)) primary="Interaction";
  else if(/gets \+\d+\/\+\d+|gets \+x\/\+x|target creature gets/.test(text) && type.includes("instant")) primary="Combat Trick";
  else if(/add [\{]|add (one|two|three)|search your library for .* land/.test(text)) primary="Ramp";
  else if(type.includes("land") || /add one mana of any color|mana of any color/.test(text)) primary="Mana/Fixing";
  else if(/return target .* card from your graveyard|return .* from your graveyard to/.test(text)) primary="Recursion";
  else if(/whenever|for each|if you control|cards in your graveyard/.test(text)) primary="Payoff";

  if(/\bflying\b|\bmenace\b|\btrample\b|can't be blocked|unblockable|\bfear\b|\bintimidate\b/.test(text)) add(secondary,"Evasion");
  if(/draw a card/.test(text)) add(secondary,"Cantrip");
  if(/draw (two|three|four|five|\d+) cards/.test(text)) add(secondary,"Value");
  if(/create .* token/.test(text)) add(secondary,"Token Maker");
  if(/enters the battlefield|when .* enters/.test(text)) add(secondary,"ETB");
  if(/when .* dies|whenever .* dies/.test(text)) add(secondary,"Death Trigger");
  if(/sacrifice (a|another|one|target)/.test(text)) add(secondary,"Sacrifice Outlet");
  if(/choose one|choose two|choose one or more/.test(text)) add(secondary,"Modal");
  if(/hexproof|indestructible|protection from/.test(text)) add(secondary,"Protection");
  // Functional Limited definition: direct noncombat opponent life reduction, including life loss.
  if(/damage to (target player|each opponent|any target)|opponent loses? \d+ life|each opponent loses? \d+ life/.test(text)) add(secondary,"Burn");

  if(type.includes("artifact")||text.includes("artifact")) add(synergy,"Artifacts");
  if(type.includes("enchantment")||text.includes("enchantment")) add(synergy,"Enchantments");
  if(type.includes("room")||text.includes("room")) add(synergy,"Rooms");
  if(text.includes("eerie")) add(synergy,"Eerie");
  if(text.includes("manifest dread")) add(synergy,"Manifest Dread");
  if(text.includes("face down")||text.includes("face-down")) add(synergy,"Face-Down");
  if(text.includes("delirium")) add(synergy,"Delirium");
  if(text.includes("survival")) add(synergy,"Survival");
  if(text.includes("graveyard")||text.includes("mill")) add(synergy,"Graveyard");
  if(/return .* from your graveyard to the battlefield/.test(text)) add(synergy,"Reanimator");
  if(text.includes("token")) add(synergy,"Tokens");
  if(text.includes("+1/+1 counter")) add(synergy,"+1/+1 Counters");
  if(text.includes("sacrifice")) add(synergy,"Sacrifice");
  if(/gain \d+ life|gain life/.test(text)) add(synergy,"Lifegain");
  if(text.includes("discard")) add(synergy,"Discard");
  return {primary,secondary,synergy,power:"3",consistency:"3",synergyReliance:"Independent",autoVersion:1};
}
function ensureDefaults(c,d){
  if(d.autoVersion)return d;
  const a=inferDefaults(c);
  if(!d.primaryRole)d.primaryRole=a.primary;
  if(d.power==null||d.power==="")d.power=a.power;
  if(d.consistency==null||d.consistency==="")d.consistency=a.consistency;
  if(d.synergyReliance==null||d.synergyReliance==="")d.synergyReliance=a.synergyReliance;
  d.secondary=[...new Set([...(d.secondary||[]),...a.secondary])];
  d.synergy=[...new Set([...(d.synergy||[]),...a.synergy])];
  d.autoVersion=1; persist(); return d;
}
function sortRank(c){
  const col=cardColor(c), rarity={common:1,uncommon:2,rare:3,mythic:4}[c.rarity]||9;
  const signpost=(c.rarity==="uncommon" && (c.colors||[]).length===2)?0:1;
  if(signpost===0)return [0,0,rarity,c.name];
  const cr={W:1,U:2,B:3,R:4,G:5,M:6,C:7,L:8}[col]||9;
  return [1,cr,rarity,c.name];
}
function compareCards(a,b){let A=sortRank(a),B=sortRank(b);for(let i=0;i<A.length;i++){if(A[i]<B[i])return-1;if(A[i]>B[i])return 1}return 0}

async function fetchSet(code){
  let url=`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:${code} is:booster`)}&unique=cards&order=set`;
  let cards=[];
  while(url){let r=await fetch(url); if(!r.ok)throw new Error("Set not found or Scryfall unavailable."); let j=await r.json(); cards.push(...j.data); url=j.has_more?j.next_page:null}
  const seen=new Set();
  cards=cards.filter(c=>{let k=c.oracle_id||c.name;if(seen.has(k))return false;seen.add(k);return true}).sort(compareCards);
  if(!cards.length)throw new Error("No booster cards found.");
  return cards;
}
async function addSet(code){
  code=code.trim().toLowerCase(); if(!code)return;
  document.getElementById("addSetBtn").textContent="Loading…";
  try{
    const cards=await fetchSet(code);
    state.sets[code] ||= {name:cards[0].set_name||code.toUpperCase(),ratings:{},mechanics:{},created:new Date().toISOString()};
    state.sets[code].cards=cards.map(c=>({id:c.id,oracle_id:c.oracle_id,name:c.name,set:c.set,set_name:c.set_name,collector_number:c.collector_number,rarity:c.rarity,mana_cost:c.mana_cost,type_line:c.type_line,oracle_text:c.oracle_text,power:c.power,toughness:c.toughness,colors:c.colors,color_identity:c.color_identity,image_uris:c.image_uris,card_faces:c.card_faces?.map(f=>({name:f.name,mana_cost:f.mana_cost,type_line:f.type_line,oracle_text:f.oracle_text,image_uris:f.image_uris}))}));
    if(code==="dsk")DSK_MECHANICS.forEach(m=>state.sets[code].mechanics[m] ||= {});
    persist(); renderSets(); openSet(code);
  }catch(e){alert(e.message)}
  finally{document.getElementById("addSetBtn").textContent="Add set"}
}
function renderSets(){
  const box=document.getElementById("setCards");box.innerHTML="";
  Object.entries(state.sets).forEach(([code,s])=>{
    const total=s.cards?.length||0, graded=Object.values(s.ratings||{}).filter(x=>x.grade).length, pct=total?graded/total*100:0;
    const b=document.createElement("button");b.className="set-card";b.innerHTML=`<h3>${esc(s.name)}</h3><div class=muted>${code.toUpperCase()} • ${graded} / ${total} graded</div><div class=progress><div class=progressbar><span style="width:${pct}%"></span></div></div>`;
    b.onclick=()=>openSet(code);box.appendChild(b)
  })
}
function openSet(code){
  currentSet=code;currentCards=state.sets[code].cards||[];currentIndex=0;
  document.getElementById("setsView").classList.add("hidden");document.getElementById("setView").classList.remove("hidden");document.getElementById("homeBtn").classList.remove("hidden");
  document.getElementById("subtitle").textContent=state.sets[code].name; showTab("gallery");renderGallery();renderMechanics();renderData();
}
function showSets(){saveCurrent();currentSet=null;document.getElementById("setView").classList.add("hidden");document.getElementById("setsView").classList.remove("hidden");document.getElementById("homeBtn").classList.add("hidden");document.getElementById("subtitle").textContent="Sets";renderSets()}
function showTab(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));document.getElementById(name+"Tab").classList.remove("hidden");
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  if(name==="grader")renderCard(); if(name==="data")renderData();
}
function renderGallery(){
  let cf=document.getElementById("colorFilter").value,rf=document.getElementById("rarityFilter").value,sf=document.getElementById("statusFilter").value;
  const g=document.getElementById("gallery");g.innerHTML="";
  currentCards.forEach((c,i)=>{
    let d=state.sets[currentSet].ratings[cardKey(c)]||{}, graded=!!d.grade;
    if(cf&&cardColor(c)!==cf)return;if(rf&&c.rarity!==rf)return;if(sf==="graded"&&!graded)return;if(sf==="ungraded"&&graded)return;
    let div=document.createElement("div");div.className="gallery-card";div.innerHTML=`<img loading="lazy" src="${esc(imageUrl(c))}" alt="${esc(c.name)}">${graded?`<span class=grade-pill>${esc(d.grade)}</span>`:""}`;
    div.onclick=()=>{currentIndex=i;showTab("grader")};g.appendChild(div)
  })
}
function buildSelect(id,arr){document.getElementById(id).innerHTML=arr.map(x=>`<option>${esc(x)}</option>`).join("")}
function buildChips(id,arr,kind){
  let box=document.getElementById(id);box.innerHTML="";
  arr.forEach(t=>{let b=document.createElement("button");b.type="button";b.className="chip";b.textContent=t;b.onclick=(e)=>{e.preventDefault();saveCurrent();let d=gradeData(currentSet,cardKey(currentCards[currentIndex]));let a=d[kind]||[];d[kind]=a.includes(t)?a.filter(x=>x!==t):[...a,t];b.classList.toggle("on",d[kind].includes(t));persist()};box.appendChild(b)})
}
function renderFiveScale(id,value){
  const box=document.getElementById(id);box.innerHTML="";
  ["Very Low","Low","Average","High","Very High"].forEach((label,i)=>{
    const v=String(i+1),b=document.createElement("button");b.type="button";b.className="scale-btn";b.innerHTML=`<strong>${v}</strong><span>${label}</span>`;
    b.classList.toggle("on",String(value||"3")===v);
    b.onclick=()=>{box.dataset.value=v;box.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));saveCurrent()};
    box.appendChild(b)
  });box.dataset.value=String(value||"3");
}
function renderSynergyScale(value){
  const box=document.getElementById("synergyReliance");box.innerHTML="";
  [["Liability","Synergy Liability"],["Independent","Independent"],["Assisted","Synergy-Assisted"],["Dependent","Synergy-Dependent"]].forEach(([v,label])=>{
    const b=document.createElement("button");b.type="button";b.className="scale-btn";b.innerHTML=`<span>${label}</span>`;
    b.classList.toggle("on",(value||"Independent")===v);
    b.onclick=()=>{box.dataset.value=v;box.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));saveCurrent()};
    box.appendChild(b)
  });box.dataset.value=value||"Independent";
}
function renderCard(){
  if(!currentCards.length)return; let c=currentCards[currentIndex],d=ensureDefaults(c,gradeData(currentSet,cardKey(c)));
  let img=document.getElementById("cardImage"),fb=document.getElementById("cardFallback"),u=imageUrl(c);
  if(u){img.src=u;img.classList.remove("hidden");fb.classList.add("hidden")}else{img.classList.add("hidden");fb.classList.remove("hidden");fb.innerHTML=`<h2>${esc(c.name)}</h2><p>${esc(c.oracle_text||"")}</p>`}
  document.getElementById("cardName").textContent=c.name;document.getElementById("cardMeta").textContent=`${c.mana_cost||""} • ${c.type_line||""} • ${c.rarity}`;
  document.getElementById("progressBadge").textContent=`${currentIndex+1} / ${currentCards.length}`;
  ["grade","confidence","primaryRole","notes"].forEach(id=>document.getElementById(id).value=d[id]??"");
  renderFiveScale("power",d.power);renderFiveScale("consistency",d.consistency);renderSynergyScale(d.synergyReliance);
  document.querySelectorAll("#secondaryTags .chip").forEach(b=>b.classList.toggle("on",(d.secondary||[]).includes(b.textContent)));
  document.querySelectorAll("#synergyTags .chip").forEach(b=>b.classList.toggle("on",(d.synergy||[]).includes(b.textContent)));
  document.querySelector("#graderTab .card-pane")?.classList.remove("compact");
  window.scrollTo({top:0,behavior:"instant"});
}
function saveCurrent(){
  if(!currentSet||!currentCards.length)return;let d=gradeData(currentSet,cardKey(currentCards[currentIndex]));
  ["grade","confidence","primaryRole","notes"].forEach(id=>d[id]=document.getElementById(id)?.value??d[id]);
  d.power=document.getElementById("power")?.dataset.value||d.power||"3";
  d.consistency=document.getElementById("consistency")?.dataset.value||d.consistency||"3";
  d.synergyReliance=document.getElementById("synergyReliance")?.dataset.value||d.synergyReliance||"Independent";
  persist()
}
function updateCardImageCompact(){
  const pane=document.querySelector("#graderTab .card-pane");
  const tab=document.getElementById("graderTab");
  if(!pane||!tab||tab.classList.contains("hidden"))return;
  const compact=window.scrollY>150;
  pane.classList.toggle("compact",compact);
}
function move(n){saveCurrent();currentIndex=Math.max(0,Math.min(currentCards.length-1,currentIndex+n));renderCard();renderGallery()}
function renderMechanics(){
  const s=state.sets[currentSet],box=document.getElementById("mechanicsList");box.innerHTML="";
  Object.keys(s.mechanics||{}).forEach(name=>{
    let d=s.mechanics[name];let div=document.createElement("div");div.className="mechanic";
    div.innerHTML=`<h3>${esc(name)}</h3>${["Power","Fun to play","Fun to play against","Synergy reliance","Desire to return","Likelihood to return"].map(k=>`<div class="mech-row"><div class="field-title">${k}</div><div class="mechanic-scale" data-mech="${esc(name)}" data-key="${esc(k)}"></div></div>`).join("")}<label>Notes<textarea rows=3 data-mech="${esc(name)}" data-key="Notes">${esc(d.Notes||"")}</textarea></label>`;
    box.appendChild(div);
    div.querySelectorAll(".mechanic-scale").forEach(scale=>{
      const k=scale.dataset.key,cur=String(d[k]||"3"); if(!d[k])d[k]="3";
      ["1","2","3","4","5"].forEach(v=>{let b=document.createElement("button");b.type="button";b.className="mini-scale";b.textContent=v;b.title=["Very Low","Low","Average","High","Very High"][Number(v)-1];b.classList.toggle("on",cur===v);b.onclick=()=>{d[k]=v;scale.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));persist()};scale.appendChild(b)})
    });
  });
  box.querySelectorAll("textarea[data-mech]").forEach(el=>el.onchange=()=>{s.mechanics[el.dataset.mech][el.dataset.key]=el.value;persist()});persist()
}
function renderData(){
  if(!currentSet)return;let s=state.sets[currentSet],total=s.cards?.length||0,graded=Object.values(s.ratings||{}).filter(x=>x.grade).length;
  document.getElementById("dataSummary").textContent=`${graded} of ${total} cards graded. Data is stored locally on this device.`;
}
function download(name,text,type){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportJSON(){download(`mtg-limited-grader-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),"application/json")}
function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}
function exportCSV(){
  let s=state.sets[currentSet],rows=[["Set","Card","Color","Rarity","Mana Cost","Type","Grade","Confidence","Primary Role","Secondary Tags","Synergy Tags","Power","Consistency","Synergy Reliance","Notes"]];
  s.cards.forEach(c=>{let d=s.ratings[cardKey(c)]||{};rows.push([currentSet.toUpperCase(),c.name,cardColor(c),c.rarity,c.mana_cost,c.type_line,d.grade,d.confidence,d.primaryRole,(d.secondary||[]).join("; "),(d.synergy||[]).join("; "),d.power,d.consistency,d.synergyReliance,d.notes])});
  download(`${currentSet}-ratings.csv`,rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv")
}
async function importJSON(file){try{let j=JSON.parse(await file.text());if(!j.sets)throw Error();Object.assign(state,j);persist();renderSets();alert("Backup imported.")}catch{alert("That backup file could not be read.")}}

migrateState();persist();
buildSelect("grade",GRADES);buildSelect("primaryRole",ROLES);buildChips("secondaryTags",SECONDARY,"secondary");buildChips("synergyTags",SYNERGY,"synergy");
document.getElementById("addSetBtn").onclick=()=>addSet(document.getElementById("setCodeInput").value);
document.getElementById("homeBtn").onclick=showSets;
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{saveCurrent();showTab(b.dataset.tab)});
["colorFilter","rarityFilter","statusFilter"].forEach(id=>document.getElementById(id).onchange=renderGallery);
document.getElementById("prevBtn").onclick=()=>move(-1);document.getElementById("saveNextBtn").onclick=()=>move(1);
document.getElementById("exportJson").onclick=exportJSON;document.getElementById("exportCsv").onclick=exportCSV;
document.getElementById("importJson").onchange=e=>e.target.files[0]&&importJSON(e.target.files[0]);
window.addEventListener("beforeunload",saveCurrent);
window.addEventListener("scroll",updateCardImageCompact,{passive:true});
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js?v=1.3").then(reg=>{
    reg.update();
    setInterval(()=>reg.update(),60*60*1000);
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(!sessionStorage.getItem("swReloaded13")){sessionStorage.setItem("swReloaded13","1");location.reload()}
  });
}
renderSets();
if(!state.sets.dsk) addSet("dsk");

document.getElementById("cardImage").addEventListener("click",()=>{const u=document.getElementById("cardImage").src;if(!u)return;document.getElementById("modalCardImage").src=u;document.getElementById("imageModal").classList.remove("hidden")});
document.getElementById("closeImage").addEventListener("click",()=>document.getElementById("imageModal").classList.add("hidden"));
document.getElementById("imageModal").addEventListener("click",e=>{if(e.target.id==="imageModal")e.currentTarget.classList.add("hidden")});
