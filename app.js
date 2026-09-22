
const GRADES=["","A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F"];
const ROLES=["","Creature","Removal","Combat Trick","Card Advantage","Interaction","Ramp","Mana/Fixing","Recursion","Build-Around","Payoff","Other"];
const SECONDARY=["Evasion","Burn","Cantrip","Card Selection","Modal","Token Maker","Value","ETB","Death Trigger","Sacrifice Outlet","Graveyard Filler","Finisher","Defensive","Aggressive","Tempo","Protection"];
const SYNERGY=["Artifacts","Enchantments","Rooms","Eerie","Manifest Dread","Face-Down","Delirium","Survival","Graveyard","Reanimator","Tokens","+1/+1 Counters","Sacrifice","Lifegain","Discard","Go-Wide","Go-Tall","Power 2 or Less","Aggro","Control","Tempo"];
const DSK_MECHANICS=["Rooms","Manifest Dread","Survival","Eerie","Impending","Delirium"];
const APP_VERSION="1.5";
const STORAGE_KEY="mtgLimitedGraderV1";
const state=loadState();
let currentSet=null,currentCards=[],currentIndex=0,renderedCard=null;

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const data=raw===null?{sets:{}}:JSON.parse(raw);
    validateBackup(data);return data;
  }catch(error){
    document.getElementById("storageStatus").textContent="Saved data could not be loaded. It has not been replaced. Keep this browser's data and recover from a backup before continuing.";
    document.getElementById("storageStatus").classList.remove("hidden");
    throw error;
  }
}
function migrateState(data=state){
  const toFive=v=>{const n=Number(v);if(!Number.isFinite(n)||n<1)return v;return String(Math.max(1,Math.min(5,Math.ceil(n/2))))};
  Object.values(data.sets||{}).forEach(s=>{
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

function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));document.getElementById("storageStatus").classList.add("hidden");return true}
  catch{document.getElementById("storageStatus").textContent="Changes could not be saved to this browser. Keep this page open and export a JSON backup from Data before closing.";document.getElementById("storageStatus").classList.remove("hidden");return false}
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function cardKey(c){return c.oracle_id||c.id}
function gradeData(code,key){state.sets[code].ratings[key] ||= {}; return state.sets[code].ratings[key]}
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
  if(d.secondary==null)d.secondary=a.secondary;
  if(d.synergy==null)d.synergy=a.synergy;
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

async function scryfallSearch(query){
  let url=`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=set`;
  let cards=[];
  while(url){
    const r=await fetch(url,{headers:{Accept:"application/json"}});
    const j=await r.json().catch(()=>null);
    if(!r.ok){
      const detail=j?.details||`Scryfall returned HTTP ${r.status}.`;
      const err=new Error(detail);err.status=r.status;throw err;
    }
    cards.push(...(j.data||[]));
    url=j.has_more?j.next_page:null;
  }
  return cards;
}
async function fetchSet(code){
  // Prefer Scryfall's booster flag. Newly previewed/unreleased sets can lag behind
  // on that flag, so fall back to the full paper set rather than rejecting it.
  let cards=[];
  let boosterError=null;
  try{cards=await scryfallSearch(`set:${code} is:booster`)}catch(e){boosterError=e}
  if(!cards.length){
    try{cards=await scryfallSearch(`set:${code} game:paper`)}catch(e){
      if(e.status===404)throw new Error(`No Scryfall cards found for set code ${code.toUpperCase()}.`);
      throw new Error(`Scryfall could not load ${code.toUpperCase()}: ${e.message}`);
    }
  }
  const seen=new Set();
  cards=cards.filter(c=>{
    if(c.object!=="card"||c.digital)return false;
    let k=c.oracle_id||c.name;if(seen.has(k))return false;seen.add(k);return true;
  }).sort(compareCards);
  if(!cards.length){
    const why=boosterError?.message?` (${boosterError.message})`:"";
    throw new Error(`No paper cards found for ${code.toUpperCase()}${why}`);
  }
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
  saveCurrent();renderedCard=null;
  currentSet=code;currentCards=state.sets[code].cards||[];currentIndex=0;
  document.getElementById("setsView").classList.add("hidden");document.getElementById("setView").classList.remove("hidden");document.getElementById("homeBtn").classList.remove("hidden");
  document.getElementById("subtitle").textContent=state.sets[code].name; showTab("gallery");renderGallery();renderMechanics();renderData();
}
function showSets(){saveCurrent();renderedCard=null;currentSet=null;currentCards=[];document.getElementById("setView").classList.add("hidden");document.getElementById("setsView").classList.remove("hidden");document.getElementById("homeBtn").classList.add("hidden");document.getElementById("subtitle").textContent="Sets";renderSets()}
function showTab(name){
  saveCurrent();renderedCard=null;
  document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));document.getElementById(name+"Tab").classList.remove("hidden");
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  if(name==="grader")renderCard(); if(name==="data")renderData();if(name==="gallery")renderGallery();
}
function renderGallery(){
  let cf=document.getElementById("colorFilter").value,rf=document.getElementById("rarityFilter").value,sf=document.getElementById("statusFilter").value;
  const g=document.getElementById("gallery");g.innerHTML="";
  currentCards.forEach((c,i)=>{
    let d=state.sets[currentSet].ratings[cardKey(c)]||{}, graded=!!d.grade;
    if(cf&&cardColor(c)!==cf)return;if(rf&&c.rarity!==rf)return;if(sf==="graded"&&!graded)return;if(sf==="ungraded"&&graded)return;
    let div=document.createElement("div");div.className="gallery-card";div.innerHTML=`<img loading="lazy" src="${esc(imageUrl(c))}" alt="${esc(c.name)}">${graded?`<span class=grade-pill>${esc(d.grade)}</span>`:""}`;
    div.onclick=()=>{saveCurrent();renderedCard=null;currentIndex=i;showTab("grader")};g.appendChild(div)
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
  renderedCard=null;
  if(!currentCards.length)return; let c=currentCards[currentIndex],d=ensureDefaults(c,gradeData(currentSet,cardKey(c)));
  let img=document.getElementById("cardImage"),fb=document.getElementById("cardFallback"),u=imageUrl(c);
  if(u){img.src=u;img.classList.remove("hidden");fb.classList.add("hidden")}else{img.classList.add("hidden");fb.classList.remove("hidden");fb.innerHTML=`<h2>${esc(c.name)}</h2><p>${esc(c.oracle_text||"")}</p>`}
  document.getElementById("cardName").textContent=c.name;document.getElementById("cardMeta").textContent=`${c.mana_cost||""} • ${c.type_line||""} • ${c.rarity}`;
  document.getElementById("progressBadge").textContent=`${currentIndex+1} / ${currentCards.length}`;
  ["grade","confidence","primaryRole","notes"].forEach(id=>{
    const el=document.getElementById(id),value=d[id]??"";
    if(el.tagName==="SELECT"&&![...el.options].some(o=>o.value===value))el.add(new Option(value,value));
    el.value=value;
  });
  renderFiveScale("power",d.power);renderFiveScale("consistency",d.consistency);renderSynergyScale(d.synergyReliance);
  document.querySelectorAll("#secondaryTags .chip").forEach(b=>b.classList.toggle("on",(d.secondary||[]).includes(b.textContent)));
  document.querySelectorAll("#synergyTags .chip").forEach(b=>b.classList.toggle("on",(d.synergy||[]).includes(b.textContent)));
  document.querySelector("#graderTab .card-pane")?.classList.remove("compact");
  renderedCard={set:currentSet,key:cardKey(c)};
  window.scrollTo({top:0,behavior:"instant"});
}
function saveCurrent(){
  if(!renderedCard||renderedCard.set!==currentSet||renderedCard.key!==cardKey(currentCards[currentIndex]||{}))return;
  let d=gradeData(renderedCard.set,renderedCard.key);
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
  box.querySelectorAll("textarea[data-mech]").forEach(el=>el.oninput=()=>{s.mechanics[el.dataset.mech][el.dataset.key]=el.value;persist()});persist()
}
function renderData(){
  if(!currentSet)return;let s=state.sets[currentSet],total=s.cards?.length||0,graded=Object.values(s.ratings||{}).filter(x=>x.grade).length;
  document.getElementById("dataSummary").textContent=`${graded} of ${total} cards graded. Data is stored locally on this device.`;
}
function download(name,text,type){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportJSON(){saveCurrent();download(`mtg-limited-grader-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),"application/json")}
function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}
function exportCSV(){
  saveCurrent();
  let s=state.sets[currentSet],rows=[["Set","Card","Color","Rarity","Mana Cost","Type","Grade","Confidence","Primary Role","Secondary Tags","Synergy Tags","Power","Consistency","Synergy Reliance","Notes"]];
  s.cards.forEach(c=>{let d=s.ratings[cardKey(c)]||{};rows.push([currentSet.toUpperCase(),c.name,cardColor(c),c.rarity,c.mana_cost,c.type_line,d.grade,d.confidence,d.primaryRole,(d.secondary||[]).join("; "),(d.synergy||[]).join("; "),d.power,d.consistency,d.synergyReliance,d.notes])});
  download(`${currentSet}-ratings.csv`,rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv")
}
function validateBackup(data){
  const record=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
  const require=(ok,message)=>{if(!ok)throw new Error(message)};
  function safeKeys(value){
    if(!value||typeof value!=="object")return;
    for(const key of Object.keys(value)){
      require(!["__proto__","prototype","constructor"].includes(key),"Unsupported key in backup.");safeKeys(value[key]);
    }
  }
  safeKeys(data);require(record(data)&&record(data.sets),"Backup must contain a sets object.");
  for(const [code,s] of Object.entries(data.sets)){
    require(/^[a-z0-9]{1,8}$/.test(code)&&record(s),"Invalid set in backup.");
    require(typeof s.name==="string"&&Array.isArray(s.cards)&&record(s.ratings)&&record(s.mechanics),`Invalid data for ${code.toUpperCase()}.`);
    const ids=new Set();
    for(const c of s.cards){
      require(record(c)&&typeof c.name==="string"&&typeof cardKey(c)==="string"&&cardKey(c).length>0,"Card is missing a name or ID.");
      require(!ids.has(cardKey(c)),"Duplicate card ID in backup.");ids.add(cardKey(c));
      for(const key of ["colors","color_identity"])if(c[key]!=null)require(Array.isArray(c[key])&&c[key].every(x=>typeof x==="string"),"Invalid card colors.");
      for(const key of ["type_line","oracle_text","rarity"])if(c[key]!=null)require(typeof c[key]==="string","Invalid card metadata.");
      if(c.card_faces!=null)require(Array.isArray(c.card_faces)&&c.card_faces.every(record),"Invalid card faces.");
    }
    for(const d of Object.values(s.ratings)){
      require(record(d),"Invalid card assessment.");
      for(const key of ["grade","confidence","primaryRole","notes"])if(d[key]!=null)require(typeof d[key]==="string",`Invalid ${key}.`);
      for(const key of ["secondary","synergy"])if(d[key]!=null)require(Array.isArray(d[key])&&d[key].every(t=>typeof t==="string"),`Invalid ${key} tags.`);
      for(const key of ["power","consistency","synergyReliance"])if(d[key]!=null)require(["string","number"].includes(typeof d[key]),`Invalid ${key}.`);
    }
    for(const d of Object.values(s.mechanics))require(record(d)&&Object.values(d).every(v=>v===null||["string","number"].includes(typeof v)),"Invalid mechanic assessment.");
  }
  return data;
}
// Add missing metadata without dropping current fields or unknown extension data.
function mergeMissing(current,incoming){
  const result=structuredClone(current);
  for(const [key,value] of Object.entries(incoming)){
    if(!Object.hasOwn(result,key))result[key]=structuredClone(value);
    else if(value&&result[key]&&typeof value==="object"&&typeof result[key]==="object"&&!Array.isArray(value)&&!Array.isArray(result[key]))result[key]=mergeMissing(result[key],value);
  }
  return result;
}
function sameRecord(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameRecord(a[k],b[k]));
}
function mergeBackup(current,incoming,useBackup=false){
  validateBackup(incoming);
  const imported=structuredClone(incoming);migrateState(imported);
  const result=mergeMissing(current,imported);let conflicts=0;
  for(const [code,s] of Object.entries(imported.sets)){
    const existing=current.sets[code];if(!existing)continue;
    const merged=result.sets[code];
    const byId=new Map(existing.cards.map(c=>[cardKey(c),structuredClone(c)]));
    for(const c of s.cards)byId.set(cardKey(c),byId.has(cardKey(c))?mergeMissing(byId.get(cardKey(c)),c):structuredClone(c));
    merged.cards=[...byId.values()];
    for(const group of ["ratings","mechanics"]){
      merged[group]=structuredClone(existing[group]);
      for(const [key,value] of Object.entries(s[group])){
        if(!Object.hasOwn(existing[group],key)){merged[group][key]=structuredClone(value);continue}
        if(!sameRecord(existing[group][key],value))conflicts++;
        merged[group][key]=useBackup?mergeMissing(value,existing[group][key]):structuredClone(existing[group][key]);
      }
    }
  }
  return {data:result,conflicts};
}
async function importJSON(file){
  const input=document.getElementById("importJson");input.disabled=true;
  document.querySelector("main").inert=true;
  try{
    const incoming=validateBackup(JSON.parse(await file.text()));
    saveCurrent();
    const useBackup=document.getElementById("importPolicy").value==="backup";
    const {data,conflicts}=mergeBackup(state,incoming,useBackup);
    if(!confirm(`Import ${Object.keys(incoming.sets).length} set(s)? ${conflicts} differing card/mechanic assessment(s): ${useBackup?"use backup assessments":"keep existing assessments"}. Other sets and cards will remain. A recovery copy will be saved first.`))return;
    // Do not replace in-memory state until durable writes have succeeded.
    await writeRecovery(JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    renderedCard=null;
    for(const key of Object.keys(state))delete state[key];
    Object.assign(state,data);showSets();
    document.getElementById("storageStatus").classList.add("hidden");
    alert("Backup imported. Your other sets and cards were kept.");
  }catch(error){alert(`Import failed; existing assessments were not replaced. ${error.message}`)}
  finally{input.value="";input.disabled=false;document.querySelector("main").inert=false}
}
function recoveryStore(mode,value){
  return new Promise((resolve,reject)=>{
    let blocked=false;
    const open=indexedDB.open("mtgLimitedGraderRecovery",1);
    open.onupgradeneeded=()=>open.result.createObjectStore("backups");
    open.onerror=()=>reject(open.error);
    open.onblocked=()=>{blocked=true;reject(new Error("Close other app tabs and retry the import."))};
    open.onsuccess=()=>{
      const db=open.result;if(blocked){db.close();return}
      try{
      const transaction=db.transaction("backups",mode),store=transaction.objectStore("backups");
      const request=mode==="readwrite"?store.put(value,"beforeImport"):store.get("beforeImport");
      transaction.oncomplete=()=>{db.close();resolve(request.result)};
      transaction.onabort=()=>{db.close();reject(transaction.error||new Error("Recovery copy could not be saved."))};
      transaction.onerror=()=>{}; // onabort owns rejection and connection cleanup.
      }catch(error){db.close();reject(error)}
    };
  });
}
function writeRecovery(raw){return recoveryStore("readwrite",raw)}
async function exportRecovery(){
  try{const raw=await recoveryStore("readonly");if(!raw){alert("No pre-import recovery copy is available yet.");return}download("mtg-limited-grader-before-import.json",raw,"application/json")}
  catch{alert("The recovery copy could not be read from browser storage.")}
}

migrateState();persist();
buildSelect("grade",GRADES);buildSelect("primaryRole",ROLES);buildChips("secondaryTags",SECONDARY,"secondary");buildChips("synergyTags",SYNERGY,"synergy");
document.getElementById("addSetBtn").onclick=()=>addSet(document.getElementById("setCodeInput").value);
document.getElementById("homeBtn").onclick=showSets;
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
["grade","confidence","primaryRole","notes"].forEach(id=>document.getElementById(id).addEventListener("input",saveCurrent));
["colorFilter","rarityFilter","statusFilter"].forEach(id=>document.getElementById(id).onchange=renderGallery);
document.getElementById("prevBtn").onclick=()=>move(-1);document.getElementById("saveNextBtn").onclick=()=>move(1);
document.getElementById("exportJson").onclick=exportJSON;document.getElementById("exportCsv").onclick=exportCSV;
document.getElementById("exportRecovery").onclick=exportRecovery;
document.getElementById("importJson").onchange=e=>e.target.files[0]&&importJSON(e.target.files[0]);
window.addEventListener("beforeunload",saveCurrent);
window.addEventListener("pagehide",saveCurrent);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveCurrent()});
window.addEventListener("scroll",updateCardImageCompact,{passive:true});
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js?v=1.5").then(reg=>{
    reg.update();
    setInterval(()=>reg.update(),60*60*1000);
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(!sessionStorage.getItem("swReloaded15")){sessionStorage.setItem("swReloaded15","1");location.reload()}
  });
}
renderSets();
if(!state.sets.dsk) addSet("dsk");

document.getElementById("cardImage").addEventListener("click",()=>{const u=document.getElementById("cardImage").src;if(!u)return;document.getElementById("modalCardImage").src=u;document.getElementById("imageModal").classList.remove("hidden")});
document.getElementById("closeImage").addEventListener("click",()=>document.getElementById("imageModal").classList.add("hidden"));
document.getElementById("imageModal").addEventListener("click",e=>{if(e.target.id==="imageModal")e.currentTarget.classList.add("hidden")});
