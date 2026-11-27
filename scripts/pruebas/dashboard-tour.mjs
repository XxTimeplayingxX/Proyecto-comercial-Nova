// Node >=20. DOM/red simulados; no es una inspección visual en navegador.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import vm from 'node:vm';
export async function run(root=fileURLToPath(new URL('../../',import.meta.url))) {
 const source=await readFile(resolve(root,'wwwroot/js/dashboard.js'),'utf8');
 const tour=await readFile(resolve(root,'wwwroot/js/tour.js'),'utf8');
 const passed=[];
 const flush=async()=>{await new Promise(done=>setImmediate(done));await new Promise(done=>setImmediate(done));};
 function dom() {
  const map=new Map(),all=[];let focused;
  class Element {
   constructor(tag='div') { this.tagName=tag;this.children=[];this.events={};this.dataset={};this.style={};this.open=false;this.hidden=false;this.offsetWidth=330;this.offsetHeight=230;this.textContent='';
    const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,v)=>{if(v)classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)};all.push(this); }
   set id(x){this._id=x;map.set(x,this);} get id(){return this._id;}
   append(...x){this.children.push(...x);} replaceChildren(...x){this.children=x;}
   setAttribute(k,v){this[k]=v;} addEventListener(k,cb){this.events[k]=cb;}
   closest(selector){return selector==='[inert]'?null:selector==='[data-period]'&&this.dataset.period?this:null;}
   querySelectorAll(){return this.children;}
   getBoundingClientRect(){return {left:30,right:230,top:60,bottom:100,width:200,height:40};}
   getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()];}
   focus(){focused=this;} scrollIntoView(){}
   showModal(){this.open=true;} close(){this.open=false;this.events.close?.();}
   async fire(name,target=this){await this.events[name]?.({target});await flush();}
  }
  const add=id=>{const el=new Element();el.id=id;return el;};
  const document={getElementById:id=>map.get(id)||null,createElement:tag=>new Element(tag),
   querySelector:selector=>selector==='dialog[open]'?all.find(x=>x.open):null,
   querySelectorAll:selector=>selector.split(',').flatMap(x=>{const key=x.trim();return key.startsWith('#')&&map.has(key.slice(1))?[map.get(key.slice(1))]:[];})};
  return {map,add,Element,document,focused:()=>focused};
 }
 function context(d,extra={}) {
  const window={matchMedia:()=>({matches:true}),addEventListener(){},visualViewport:{height:800,addEventListener(){}}};
  return {document:d.document,window,innerWidth:1200,innerHeight:800,Intl,URLSearchParams,AbortController,
   requestAnimationFrame:()=>1,cancelAnimationFrame(){},MutationObserver:class {constructor(cb){d.observe=cb;}observe(){}},...extra};
 }
 async function dashboard(fail=false) {
  const d=dom(),ids=[...source.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
  for(const id of new Set([...ids,'dashboard-count','dashboard-products','dashboard-low']))d.add(id);
  const buttons=['hoy','semana','mes'].map(period=>{const button=new d.Element('button');button.dataset.period=period;return button;});
  d.map.get('dashboard-periodos').append(...buttons);
  d.fail=fail;d.requests=[];d.hold=null;
  const data=period=>({period,page:1,totalRows:0,generatedAt:'2026-11-27T12:00:00Z',
   summary:{salesTotal:0,salesCount:0,productsCount:period==='hoy'?99:4,lowStockCount:0,outOfStockCount:1},
   daily:Array.from({length:7},(_,i)=>({date:'2026-11-'+String(21+i),amount:0})),topProducts:[],recentSales:[]});
  const fetch=async url=>{
   d.requests.push(url);
   if(url.includes('periodo=hoy')&&d.hold)return await new Promise(done=>d.release=()=>done({ok:true,status:200,json:async()=>data('hoy')}));
   return {ok:!d.fail,status:d.fail?503:200,json:async()=>d.fail?{title:'Sin conexión'}:data(url.includes('mes')?'mes':'semana')};
  };
  vm.runInNewContext(source,context(d,{fetch}),{filename:'dashboard.js'});await flush();d.buttons=buttons;return d;
 }
 const empty=await dashboard();
 assert.equal(empty.map.get('dashboard-count').textContent,'0');
 assert.equal(empty.map.get('dashboard-bars').children.length,7);
 assert.match(empty.map.get('dashboard-top-list').children[0].textContent,/Todavía no/);
 assert.equal(empty.map.get('dashboard-next').disabled,true);
 passed.push('Ceros confirmados, siete días y estados vacíos');
 const failure=await dashboard(true);
 assert.equal(failure.map.get('dashboard-total').textContent,'—');assert.equal(failure.map.get('dashboard-error').hidden,false);
 assert.equal(failure.map.get('dashboard-content')['aria-busy'],'false');
 passed.push('Error de consulta no fabrica ceros y termina la carga');
 failure.fail=false;
 await failure.map.get('dashboard-reintentar').fire('click');
 assert.equal(failure.map.get('dashboard-error').hidden,true);
 assert.equal(failure.map.get('dashboard-count').textContent,'0');
 passed.push('Reintentar recupera los datos después de un error');
 await empty.map.get('dashboard-periodos').fire('click',empty.buttons[2]);
 assert(empty.requests.at(-1).includes('periodo=mes'));assert(empty.requests.at(-1).includes('pagina=1'));
 passed.push('Periodo nuevo reinicia la página y consulta al servidor');

 // Las respuestas viejas no deben pisar la selección actual.
 const stale=await dashboard();
 stale.hold=true;
 await stale.map.get('dashboard-periodos').fire('click',stale.buttons[0]);
 await stale.map.get('dashboard-periodos').fire('click',stale.buttons[2]);
 assert.equal(stale.map.get('dashboard-products').textContent,'4');
 stale.release();await flush();
 assert.equal(stale.map.get('dashboard-products').textContent,'4');
 passed.push('Respuesta anterior ignorada después de cambiar de periodo');
 const d=dom();
 for(const id of ['workspace-tour-start','workspace-tour','workspace-tour-title','workspace-tour-description','workspace-tour-progress','workspace-tour-prev','workspace-tour-next','workspace-tour-close','workspace-tour-dots','workspace-idle','dashboard-periodos','dashboard-kpis'])d.add(id);
 vm.runInNewContext(tour,context(d),{filename:'tour.js'});
 const dialog=d.map.get('workspace-tour'),opener=d.map.get('workspace-tour-start');
 assert.equal(dialog.open,false);assert.equal(d.map.get('workspace-tour-title').textContent,'');
 await opener.fire('click');assert.equal(dialog.open,true);
 assert.match(d.map.get('workspace-tour-progress').textContent,/1 de 3/);
 assert.equal(d.map.get('workspace-tour-prev').disabled,true);
 passed.push('Tour inactivo hasta clic explícito; pasos solo para elementos presentes');
 await d.map.get('workspace-tour-next').fire('click');assert.match(d.map.get('workspace-tour-title').textContent,/Elige un periodo/);
 await d.map.get('workspace-tour-prev').fire('click');assert.match(d.map.get('workspace-tour-title').textContent,/bienvenida/);
 await d.map.get('workspace-tour-next').fire('click');await d.map.get('workspace-tour-next').fire('click');
 assert.match(d.map.get('workspace-tour-next').textContent,/Finalizar/);await d.map.get('workspace-tour-next').fire('click');
 assert.equal(dialog.open,false);assert.equal(d.focused(),opener);assert.equal(d.map.get('dashboard-kpis').classList.contains('nova-tour-target'),false);
 passed.push('Anterior, siguiente, finalizar y restauración del foco');
 const other=d.add('otro-dialogo');other.open=true;await opener.fire('click');assert.equal(dialog.open,false);other.open=false;
 await opener.fire('click');d.map.get('workspace-idle').open=true;d.observe();assert.equal(dialog.open,false);
 passed.push('No superpone otros diálogos y cede al aviso de inactividad');
 return passed;
}
if(typeof process!=='undefined'&&process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))for(const result of await run())console.log('OK: '+result);

