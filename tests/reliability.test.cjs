const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8').split('\nmigrateState();persist();')[0];
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){return {sets:{dsk:{name:'Example',cards:[{id:'one',name:'One',type_line:'Creature',oracle_text:'Flying',colors:['W']},{id:'two',name:'Two'}],ratings:{one:{grade:'A',notes:'Keep me',secondary:[],synergy:[],power:'4',consistency:'3',synergyReliance:'Independent',autoVersion:1}},mechanics:{}}}}}
function setup(data=fixture(),raw){
  const storage=new Map([['mtgLimitedGraderV1',raw??JSON.stringify(data)]]),elements=new Map(),messages=[];
  function el(){return {value:'',dataset:{},textContent:'',innerHTML:'',children:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(x){this.children.push(x)},querySelectorAll(){return []}}}
  const document={createElement:el,getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},querySelectorAll(){return []},querySelector(){return el()}};
  const ctx=vm.createContext({structuredClone,document,window:{scrollTo(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){storage.set(k,v)}},alert:x=>messages.push(x),confirm:()=>true,console});
  vm.runInContext(source,ctx);
  ctx.saveTestRecovery=async raw=>storage.set('testRecovery',raw);
  vm.runInContext('writeRecovery=raw=>saveTestRecovery(raw)',ctx);
  const run=s=>vm.runInContext(s,ctx);
  return {ctx,run,storage,elements,messages,getState:()=>clone(run('state'))};
}
test('unopened forms, tabs and set navigation cannot erase the first grade',()=>{
  const x=setup(),before=x.getState();
  x.run('openSet("dsk");showTab("data");showSets();openSet("dsk");saveCurrent()');
  assert.deepEqual(x.getState(),before);
});
test('rendered form saves all controls; stale form cannot write to another card',()=>{
  const x=setup();x.run('openSet("dsk");showTab("grader")');
  for(const [id,value] of Object.entries({grade:'B-',confidence:'High',primaryRole:'Removal',notes:'New opinion'}))x.elements.get(id).value=value;
  for(const [id,value] of Object.entries({power:'5',consistency:'2',synergyReliance:'Assisted'}))x.elements.get(id).dataset.value=value;
  x.run('saveCurrent();currentIndex=1;saveCurrent()');
  assert.equal(x.getState().sets.dsk.ratings.one.grade,'B-');assert.equal(x.getState().sets.dsk.ratings.one.notes,'New opinion');
  assert.equal(x.getState().sets.dsk.ratings.one.consistency,'2');assert.equal(x.getState().sets.dsk.ratings.two,undefined);
});
test('new cards get inferred tags; older explicit arrays stay intact',()=>{
  const x=setup();x.run('ensureDefaults(state.sets.dsk.cards[0],{secondary:[],synergy:[]})');
  assert.deepEqual(clone(x.run('ensureDefaults(state.sets.dsk.cards[0],{}).secondary')),['Evasion']);
  assert.deepEqual(clone(x.run('ensureDefaults(state.sets.dsk.cards[0],{secondary:[],synergy:[]}).secondary')),[]);
});
test('merge retains sets, cards, deliberate blanks and complete current assessments by default',()=>{
  const x=setup(),incoming=fixture();incoming.sets.dsk.ratings.one.grade='F';incoming.sets.dsk.ratings.two={grade:'B'};
  incoming.sets.dsk.cards=incoming.sets.dsk.cards.slice(1);incoming.sets.fra=clone(incoming.sets.dsk);
  x.ctx.incoming=incoming;const result=clone(x.run('mergeBackup(state,incoming)'));
  assert.equal(result.conflicts,1);assert.equal(result.data.sets.dsk.ratings.one.grade,'A');assert.equal(result.data.sets.dsk.ratings.two.grade,'B');
  assert.equal(result.data.sets.dsk.cards.length,2);assert.ok(result.data.sets.fra);
});
test('explicit backup conflict policy retains unknown extensions without mutating inputs',()=>{
  const x=setup(),incoming=fixture();incoming.sets.dsk.ratings.one.grade='F';
  x.run('state.sets.dsk.ratings.one.future={history:[1,2]}');x.ctx.incoming=incoming;
  const result=clone(x.run('mergeBackup(state,incoming,true)'));
  assert.equal(result.data.sets.dsk.ratings.one.grade,'F');assert.deepEqual(result.data.sets.dsk.ratings.one.future,{history:[1,2]});
  assert.equal(x.getState().sets.dsk.ratings.one.grade,'A');assert.equal(incoming.sets.dsk.ratings.one.future,undefined);
});
test('malformed imports do not change memory or storage',async()=>{
  const x=setup(),before=x.storage.get('mtgLimitedGraderV1');
  for(const value of [{sets:[]},{sets:{dsk:{}}},JSON.parse('{"sets":{},"__proto__":{}}')]){
    x.ctx.file={text:async()=>JSON.stringify(value)};await x.run('importJSON(file)');assert.equal(x.storage.get('mtgLimitedGraderV1'),before);
  }
  assert.deepEqual(x.getState(),JSON.parse(before));assert.equal(x.messages.length,3);
});
test('cancelled import is a no-op',async()=>{
  const x=setup(),before=x.getState();x.ctx.confirm=()=>false;x.ctx.file={text:async()=>JSON.stringify(fixture())};
  await x.run('importJSON(file)');assert.deepEqual(x.getState(),before);assert.equal(x.storage.has('testRecovery'),false);
});
test('storage failure at either import write preserves original state',async()=>{
  for(const failKey of ['testRecovery','mtgLimitedGraderV1']){
    const x=setup(),before=x.getState(),incoming=fixture();incoming.sets.dsk.ratings.one.grade='F';x.ctx.file={text:async()=>JSON.stringify(incoming)};
    x.run('document.getElementById("importPolicy").value="backup"');
    x.ctx.localStorage.setItem=(k,v)=>{if(k===failKey)throw Error('Storage full');x.storage.set(k,v)};
    x.ctx.saveTestRecovery=async raw=>{if(failKey==='testRecovery')throw Error('Storage full');x.storage.set('testRecovery',raw)};
    await x.run('importJSON(file)');assert.deepEqual(x.getState(),before);assert.deepEqual(JSON.parse(x.storage.get('mtgLimitedGraderV1')),before);
  }
});
test('successful import clears stale form and provides pre-import recovery',async()=>{
  const x=setup(),incoming=fixture();incoming.sets.dsk.ratings.one.grade='F';x.ctx.file={text:async()=>JSON.stringify(incoming)};
  x.run('openSet("dsk");showTab("grader");showTab("data");document.getElementById("importPolicy").value="backup"');
  const before=x.getState();
  await x.run('importJSON(file)');x.run('saveCurrent()');
  assert.equal(x.getState().sets.dsk.ratings.one.grade,'F');assert.equal(x.run('renderedCard'),null);assert.equal(x.run('currentSet'),null);
  assert.deepEqual(JSON.parse(x.storage.get('testRecovery')),before);
});
test('invalid startup data is not replaced by an empty state',()=>assert.throws(()=>setup(undefined,'{broken')));
test('legacy import migrates on a copy and migrations are idempotent',()=>{
  const x=setup(),incoming=fixture();incoming.sets.dsk.ratings.one={grade:'F+',power:'8',consistency:'4',synergyReliance:'9'};x.ctx.incoming=incoming;
  const result=clone(x.run('mergeBackup({sets:{}},incoming).data'));
  assert.equal(result.sets.dsk.ratings.one.grade,'F');assert.equal(result.sets.dsk.ratings.one.power,'4');assert.equal(result.sets.dsk.ratings.one.consistency,'4');
  x.ctx.result=result;x.run('migrateState(result)');assert.deepEqual(clone(x.ctx.result),result);assert.equal(incoming.sets.dsk.ratings.one.grade,'F+');
});
test('private real backup: import/export preserves every set, assessment and metadata field',{skip:!process.env.MTG_TEST_BACKUP},async()=>{
  const data=JSON.parse(fs.readFileSync(process.env.MTG_TEST_BACKUP,'utf8'));
  const x=setup({sets:{}});x.ctx.file={text:async()=>JSON.stringify(data)};await x.run('importJSON(file)');
  assert.deepEqual(x.getState(),data);assert.deepEqual(JSON.parse(x.storage.get('mtgLimitedGraderV1')),data);
  x.ctx.capture=null;x.run('download=(name,text)=>{capture=text};exportJSON()');assert.deepEqual(JSON.parse(x.ctx.capture),data);
  x.run('openSet("fra");showTab("data");showSets();openSet("dsk");showSets()');
  assert.deepEqual(x.getState().sets.fra,data.sets.fra);
});
