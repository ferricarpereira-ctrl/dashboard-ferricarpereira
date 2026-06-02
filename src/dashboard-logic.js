/**
 * Ferricar Dashboard - Core Operational and Analysis Logic
 * Contains spreadsheet parsing, data enrichment, cached filters, aggregations,
 * layout renderers, and PDF generation utilities.
 */

const CSV_OP  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRtrIv7zs5jZBiYE5zetW6xDxXOdSNO63jjq9YoYXCpjSNwVyBmnymtmOisSrjk7Vp8CeJAJHgvfCT-/pub?output=csv';
const CSV_CUB = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJ6-rJMMdDHeBDZVkpg4iD6Ydl6vpF3Lhv1t1XkZ4ninZDAmbbJRQkOZ1LQk6rLWbGC-oeK-MbjAWY/pub?output=csv';

let dInicio, dFin, anInicio, anFin;
let _cacheEnriquecido=null, _cacheHashOp='', _cacheHashCub='';
let rawOp=[], rawCub=[];
let auxInicio, auxFin;

let _rankToggleTipo = 'aux';
let _rankToggleModo = 'sal';

// ── Utils ─────────────────────────────────────────────────────
function hoy(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})); }
function p2(n){ return String(n).padStart(2,'0'); }
function fmtI(d){ return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
function parseFecha(s){
  if(!s) return null;
  const p=s.toString().trim().split('/');
  if(p.length!==3||p[2].length!==4) return null;
  const d=new Date(+p[2],+p[1]-1,+p[0]);
  return isNaN(d.getTime())?null:d;
}
const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function pct(a,b){ return b>0?Math.min(100,Math.round(a/b*100)):0; }
function pctBadge(p){
  const cls=p>=80?'pct-green':p>=55?'pct-yellow':'pct-red';
  return `<span class="pct-badge ${cls}">${p}%</span>`;
}
function barColor(p){ return p>=80?'#22c55e':p>=55?'#f59e0b':'#ef4444'; }

// ── Animación contador ────────────────────────────────────────
function animCount(el, target, duration=700){
  if(!el) return;
  const start=performance.now();
  function step(now){
    const p=Math.min((now-start)/duration,1);
    const ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(target*ease);
    if(p<1) requestAnimationFrame(step);
    else el.textContent=target;
  }
  el.textContent='0';
  requestAnimationFrame(step);
}

function animCountSuffix(el, target, suffix='', duration=700){
  if(!el) return;
  const start=performance.now();
  function step(now){
    const p=Math.min((now-start)/duration,1);
    const ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(target*ease) + suffix;
    if(p<1) requestAnimationFrame(step);
    else el.textContent=target + suffix;
  }
  el.textContent='0' + suffix;
  requestAnimationFrame(step);
}

// ── Navegación pestañas ───────────────────────────────────────
function switchPage(page, btn){
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  if(page==='an')   renderAnalisis();
  if(page==='auxp') renderAuxiliares();
}

// ── CSV ───────────────────────────────────────────────────────
function parseCSV(text){
  const lines=text.trim().split('\n');
  const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line=>{
    const vals=[]; let cur='', inQ=false;
    for(const c of line){
      if(c==='"') inQ=!inQ;
      else if(c===','&&!inQ){ vals.push(cur.trim()); cur=''; }
      else cur+=c;
    }
    vals.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>obj[h]=(vals[i]||'').replace(/^"|"$/g,''));
    return obj;
  });
}

// ── Periodo ───────────────────────────────────────────────────
function calcPeriodo(p){
  const h=hoy();
  let ini, fin;
  if(p==='hoy')        { ini=fin=new Date(h); }
  else if(p==='ayer')  { const a=new Date(h); a.setDate(h.getDate()-1); ini=fin=a; }
  else if(p==='semana'){ const l=new Date(h); l.setDate(h.getDate()-(h.getDay()||7)+1); ini=l; fin=new Date(h); }
  else if(p==='semana-ant'){ const l=new Date(h); l.setDate(h.getDate()-(h.getDay()||7)-6); const v=new Date(h); v.setDate(h.getDate()-(h.getDay()||7)); ini=l; fin=v; }
  else if(p==='todo')  { ini=new Date(2020,0,1); fin=new Date(h); }
  else { ini=new Date(h.getFullYear(),h.getMonth(),1); fin=new Date(h); }
  return {ini,fin};
}

function setPeriodo(p,btn){
  document.querySelectorAll('#page-op .btn-periodo').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const {ini,fin}=calcPeriodo(p);
  dInicio=ini; dFin=fin;
  document.getElementById('fi').value=fmtI(dInicio);
  document.getElementById('ff').value=fmtI(dFin);
  cargarDatos();
}
function aplicar(){
  document.querySelectorAll('#page-op .btn-periodo').forEach(b=>b.classList.remove('active'));
  const fi=document.getElementById('fi').value, ff=document.getElementById('ff').value;
  if(!fi||!ff) return;
  const p1=fi.split('-'), p2x=ff.split('-');
  dInicio=new Date(+p1[0],+p1[1]-1,+p1[2]);
  dFin   =new Date(+p2x[0],+p2x[1]-1,+p2x[2]);
  cargarDatos();
}

function setAnPeriodo(p,btn){
  document.querySelectorAll('#page-an .btn-periodo').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const {ini,fin}=calcPeriodo(p);
  anInicio=ini; anFin=fin;
  document.getElementById('an-fi').value=fmtI(anInicio);
  document.getElementById('an-ff').value=fmtI(anFin);
  renderAnalisis();
}
function aplicarAn(){
  document.querySelectorAll('#page-an .btn-periodo').forEach(b=>b.classList.remove('active'));
  const fi=document.getElementById('an-fi').value, ff=document.getElementById('an-ff').value;
  if(!fi||!ff) return;
  const p1=fi.split('-'), p2x=ff.split('-');
  anInicio=new Date(+p1[0],+p1[1]-1,+p1[2]);
  anFin   =new Date(+p2x[0],+p2x[1]-1,+p2x[2]);
  renderAnalisis();
}
function limpiarFiltrosAn(){
  document.getElementById('an-aux').value='';
  document.getElementById('an-ruta').value='';
  document.getElementById('an-placa').value='';
  document.getElementById('an-tipo').value='';
  document.getElementById('an-estado').value='';
  const ab=document.getElementById('an-buscar'); if(ab) ab.value='';
  renderAnalisis();
}

// ── Normalizar keys ───────────────────────────────────────────
function normKey(obj){
  const out={};
  Object.keys(obj).forEach(k=>{ out[k.replace(/\s+/g,' ').trim().toUpperCase()]=obj[k]; });
  return out;
}

// ── Carga de datos ────────────────────────────────────────────
async function cargarDatos(silencioso=false){
  const dot=document.getElementById('live-dot');
  if(dot) dot.classList.add('syncing');
  if(!silencioso){
    document.getElementById('contenido').innerHTML='<div class="loader"></div><div class="loader-txt">Cargando datos...</div>';
  }
  document.getElementById('badge').textContent='Actualizando...';
  try {
    const [rOp,rCub]=await Promise.all([
      fetch(CSV_OP +'&t='+Date.now()).then(r=>r.text()),
      fetch(CSV_CUB+'&t='+Date.now()).then(r=>r.text())
    ]);
    rawOp =parseCSV(rOp).map(normKey);
    rawCub=parseCSV(rCub).map(normKey);
    _cacheEnriquecido=null;

    poblarSelects();
    const paginaActiva=document.querySelector('.page.active')?.id;
    if(paginaActiva==='page-an') renderAnalisis();
    else if(paginaActiva==='page-auxp') renderAuxiliares();
    else renderizarOp();

    document.getElementById('badge').textContent='Act. '+new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    if(dot){ dot.classList.remove('syncing'); }
  } catch(e){
    if(!silencioso){
      document.getElementById('contenido').innerHTML=`<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Error cargando datos</div><div class="empty-sub">${e.message}</div></div>`;
    }
    document.getElementById('badge').textContent='Error';
    if(dot){ dot.classList.remove('syncing'); }
  }
}

function poblarSelects(){
  const auxSet=new Set(), rutaSet=new Set(), placaSet=new Set();
  rawOp.forEach(r=>{
    const a=(r['AUXILIAR']||'').trim(); if(a) auxSet.add(a);
    const ru=(r['RUTA']||'').trim(); if(ru) rutaSet.add(ru);
    const pl=(r['PLACA']||'').trim().toUpperCase(); if(pl) placaSet.add(pl);
  });

  // ── Análisis dropdowns ──
  const selAux=document.getElementById('an-aux');
  const selRut=document.getElementById('an-ruta');
  const selPla=document.getElementById('an-placa');
  if(selAux && selRut && selPla){
    const curAux=selAux.value, curRut=selRut.value, curPla=selPla.value;
    selAux.innerHTML='<option value="">Todos los auxiliares</option>';
    selRut.innerHTML='<option value="">Todas las rutas</option>';
    selPla.innerHTML='<option value="">Todas las placas</option>';
    [...auxSet].sort().forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; if(a===curAux)o.selected=true; selAux.appendChild(o); });
    [...rutaSet].sort().forEach(r=>{ const o=document.createElement('option'); o.value=r; o.textContent=r; if(r===curRut)o.selected=true; selRut.appendChild(o); });
    [...placaSet].sort().forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; if(p===curPla)o.selected=true; selPla.appendChild(o); });
  }

  // ── Auxiliares page dropdowns ──
  const sA=document.getElementById('aux-sel-aux');
  const sR=document.getElementById('aux-sel-ruta');
  if(sA && sR){
    const cA=sA.value, cR=sR.value;
    sA.innerHTML='<option value="">Todos los auxiliares</option>';
    sR.innerHTML='<option value="">Todas las rutas</option>';
    [...auxSet].sort().forEach(a=>{const o=document.createElement('option');o.value=a;o.textContent=a;if(a===cA)o.selected=true;sA.appendChild(o);});
    [...rutaSet].sort().forEach(r=>{const o=document.createElement('option');o.value=r;o.textContent=r;if(r===cR)o.selected=true;sR.appendChild(o);});
  }
}

// ── Enriquecer filas ──────────────────────────────────────────
function _hashRows(rows){ return rows.length+'|'+(rows[0]?JSON.stringify(rows[0]):''); }

function enriquecer(opRows, cubRows){
  const hOp=_hashRows(opRows), hCub=_hashRows(cubRows);
  if(_cacheEnriquecido && hOp===_cacheHashOp && hCub===_cacheHashCub) return _cacheEnriquecido;
  _cacheHashOp=hOp; _cacheHashCub=hCub;
  _cacheEnriquecido = _enriquecerReal(opRows, cubRows);
  return _cacheEnriquecido;
}

function _enriquecerReal(opRows, cubRows){
  const mapaRet={};
  cubRows.forEach(r=>{
    const pl=(r['PLANILLA']||r['PLANILLAS']||'').toString().toLowerCase().trim();
    if(!pl) return;
    if(!mapaRet[pl]) mapaRet[pl]={nev:0,cub:0};
    mapaRet[pl].nev+=parseInt(r['NEVERAS']||0)||0;
    mapaRet[pl].cub+=parseInt(r['CANTIDAD CUBETAS']||r['CUBETAS']||0)||0;
  });

  return opRows.filter(row=>{
    const pl=(row['PLANILLA']||'').toString().trim();
    return !!pl;
  }).map(row=>{
    const fecha   =(row['FECHA']||'').toString().trim();
    const planilla=(row['PLANILLA']||'').toString().trim();
    const auxiliar=(row['AUXILIAR']||'').toString().trim();
    const ruta    =(row['RUTA']||'').toString().trim();
    const placa   =(row['PLACA']||'').toString().trim().toUpperCase();
    const tipo    =(row['TIPO SERVICIO']||'').toString().trim().toUpperCase();
    const nevSal  =parseInt(row['NEVERAS']||0)||0;
    const cubSal  =parseInt(row['CUBETAS']||row['CANTIDAD CUBETAS']||0)||0;

    function readCol(r,...keys){
      for(const k of keys){
        const v=r[k];
        if(v!==undefined&&v!=='') {
          const s=String(v).trim().toUpperCase();
          if(s==='1'||s==='SI'||s==='S'||s==='X'||s==='OK'||s==='VERDADERO'||s==='TRUE'||parseFloat(s)>0) return 1;
        }
      }
      return 0;
    }
    const enDevol =readCol(row,'PLANILLAS EN DEVOLUCIONES','PLANILLAS EN DEVOLUCION','PLANILLAS EN DEVOLUCIÓN');
    const porRadic=readCol(row,'PLANILLAS POR RADICAR');
    const radicada=readCol(row,'PLANILLAS RADICADAS','PLANILLAS RADICADA');
    let gestion='';
    if(radicada)      gestion='Radicada';
    else if(enDevol)  gestion='Devolucion';
    else if(porRadic) gestion='Por radicar';

    const ret   =mapaRet[planilla.toLowerCase().trim()];
    const retOk =!!ret;
    const nevIng=ret?ret.nev:0;
    const cubIng=ret?ret.cub:0;
    const sinCarga=(nevSal===0&&cubSal===0);
    const nevFalt =sinCarga?0:Math.max(0,nevSal-nevIng);
    const nevExtra=sinCarga?0:Math.max(0,nevIng-nevSal);
    let estado;
    if(sinCarga)        estado='OK';
    else if(!retOk)     estado='Sin retorno';
    else if(nevExtra>0) estado='Excedente';
    else if(nevFalt>0)  estado='Faltantes';
    else                estado='OK';

    const fechaDate=parseFecha(fecha);
    const ahora24=hoy();
    const vencido=!retOk && !sinCarga && fechaDate && (ahora24-fechaDate)>86400000;
    return {fecha,fechaDate,planilla,auxiliar,ruta,placa,tipo,
      nevSal,nevIng,nevFalt,nevExtra,cubSal,cubIng,
      retOk,sinCarga,estado,gestion,vencido,
      enDevol,porRadic,radicada};
  }).filter(r=>r.fechaDate!==null);
}

// ── RENDER CONTROL OPERATIVO ──────────────────────────────────
function renderizarOp(){
  const fi=new Date(dInicio); fi.setHours(0,0,0,0);
  const ff=new Date(dFin);    ff.setHours(23,59,59,999);
  const buscar=(document.getElementById('op-buscar')?.value||'').toLowerCase().trim();
  const opEstado=(document.getElementById('op-estado')?.value||'');
  const todosEnriquecidos=enriquecer(rawOp,rawCub);
  const datos=todosEnriquecidos.filter(r=>{
    if(buscar){
      if(!r.planilla.toLowerCase().includes(buscar) &&
         !r.auxiliar.toLowerCase().includes(buscar) &&
         !r.ruta.toLowerCase().includes(buscar)     &&
         !r.placa.toLowerCase().includes(buscar)) return false;
    } else {
      if(r.fechaDate<fi||r.fechaDate>ff) return false;
    }
    if(opEstado && r.estado!==opEstado) return false;
    return true;
  });

  const buscarBadgeEl=document.getElementById('op-buscar-badge');
  if(buscarBadgeEl){
    if(buscar){
      buscarBadgeEl.textContent='🔍 Buscando en todo el historial · '+datos.length+' resultado'+(datos.length!==1?'s':'');
      buscarBadgeEl.style.display='inline-block';
    } else { buscarBadgeEl.style.display='none'; }
  }

  if(!datos.length){
    document.getElementById('contenido').innerHTML='<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Sin planillas para este periodo</div><div class="empty-sub">Probá con otro rango de fechas</div></div>';
    return;
  }

  let totPlan=0,totOk=0,totNovedad=0,totSin=0;
  let totNevFaltUnid=0,totNevExtraUnid=0;
  let totNevSal=0,totNevIng=0,totCubSal=0,totCubIng=0;
  let totCubUrbSal=0,totCubUrbIng=0,totCubProvSal=0,totCubProvIng=0;
  let totNevUrbSal=0,totNevUrbIng=0,totNevProvSal=0,totNevProvIng=0;
  let totPlanUrb=0,totPlanProv=0;
  let totEnDevoluciones=0,totPorRadicar=0,totRadicadas=0;
  const dias={};

  datos.forEach(r=>{
    if(!dias[r.fecha]) dias[r.fecha]={fecha:r.fecha,planillas:[],cubSal:0,cubIng:0,nevSal:0,nevIng:0,planUrb:0,planProv:0};
    totPlan++; totNevSal+=r.nevSal; totNevIng+=r.nevIng; totCubSal+=r.cubSal; totCubIng+=r.cubIng;
    if(!r.sinCarga){ totNevFaltUnid+=r.nevFalt; totNevExtraUnid+=r.nevExtra; }
    if(r.estado==='OK') totOk++;
    else if(r.estado==='Sin retorno') totSin++;
    else totNovedad++;
    if(r.enDevol)  totEnDevoluciones++;
    if(r.porRadic) totPorRadicar++;
    if(r.radicada) totRadicadas++;
    const esUrb=r.tipo==='URBANA';
    if(esUrb){ totCubUrbSal+=r.cubSal;totCubUrbIng+=r.cubIng;totNevUrbSal+=r.nevSal;totNevUrbIng+=r.nevIng;totPlanUrb++; }
    else     { totCubProvSal+=r.cubSal;totCubProvIng+=r.cubIng;totNevProvSal+=r.nevSal;totNevProvIng+=r.nevIng;totPlanProv++; }
    dias[r.fecha].cubSal+=r.cubSal; dias[r.fecha].cubIng+=r.cubIng;
    dias[r.fecha].nevSal+=r.nevSal; dias[r.fecha].nevIng+=r.nevIng;
    if(esUrb) dias[r.fecha].planUrb++; else dias[r.fecha].planProv++;
    dias[r.fecha].planillas.push(r);
  });

  const pctOk  =pct(totOk,totPlan);
  const pctNev =totNevSal>0?Math.min(100,Math.round(totNevIng/totNevSal*100)):100;
  const pctCub =pct(totCubIng,totCubSal);
  const pctCubU=pct(totCubUrbIng,totCubUrbSal);
  const pctCubP=pct(totCubProvIng,totCubProvSal);
  const cNev   =barColor(pctNev);
  const cCubU  =barColor(pctCubU);
  const cCubP  =barColor(pctCubP);

  const diasOrden=Object.values(dias).sort((a,b)=>parseFecha(a.fecha)-parseFecha(b.fecha));
  let htmlDias='';
  diasOrden.forEach(dia=>{
    const fd=parseFecha(dia.fecha);
    const dNevF=Math.max(0,dia.nevSal-dia.nevIng);
    const dNevE=Math.max(0,dia.nevIng-dia.nevSal);
    let filas='';
    dia.planillas.forEach(p=>{
      let bCls,eTxt;
      if(p.sinCarga||p.estado==='OK'){ bCls='badge-ok';   eTxt='✅ OK'; }
      else if(p.estado==='Sin retorno'){ bCls='badge-sin'; eTxt='⏳ Sin retorno'; }
      else if(p.estado==='Excedente'){ bCls='badge-exc';   eTxt='📦 Exc +'+p.nevExtra; }
      else                           { bCls='badge-falta'; eTxt='❌ Faltan '+p.nevFalt; }
      const tCls=p.tipo==='URBANA'?'badge-urb':'badge-prov';
      const tTxt=p.tipo==='URBANA'?'🏙 URB':'🚛 PROV';
      let gBadge='';
      if(p.gestion==='Radicada')     gBadge='<span class="badge badge-grac">✅ Radicada</span>';
      else if(p.gestion==='Devolucion')  gBadge='<span class="badge badge-gdev">↩ Devol</span>';
      else if(p.gestion==='Por radicar') gBadge='<span class="badge badge-grad">📋 Por rad</span>';
      filas+=`<tr>
        <td class="mono">${p.planilla}</td>
        <td class="bold">${p.auxiliar}</td>
        <td style="font-size:11px;color:var(--muted)">${p.ruta}</td>
        <td class="mono" style="font-size:10px;color:var(--accent)">${p.placa||'—'}</td>
        <td class="center"><span class="badge ${tCls}">${tTxt}</span></td>
        <td class="center">${p.cubSal}</td>
        <td class="center">${p.cubIng}</td>
        <td class="center">${p.nevSal}</td>
        <td class="center">${p.nevIng}</td>
        <td class="center"><span class="badge ${bCls}">${eTxt}</span></td>
        <td class="center">${gBadge}</td>
      </tr>`;
    });
    htmlDias+=`
    <div class="dia-card">
      <div class="dia-header">
        <div>
          <div class="dia-titulo">${DIAS[fd.getDay()]} ${dia.fecha}</div>
          <div class="dia-fecha-tag">${dia.planillas.length} planillas · ${dia.planUrb} urb / ${dia.planProv} prov</div>
        </div>
        <div class="dia-count">
          ${dia.cubSal} cub sal · ${dia.nevSal} nev sal
          ${dNevF>0?`<br><span style="color:var(--red)">❌ ${dNevF} nev faltan</span>`:''}
          ${dNevE>0?`<br><span style="color:var(--purple)">📦 ${dNevE} nev de más</span>`:''}
        </div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th>Planilla</th><th>Auxiliar</th><th>Ruta</th><th>Placa</th>
          <th class="center">Tipo</th>
          <th class="center">Cub.Sal</th><th class="center">Cub.Ing</th>
          <th class="center">Nev.Sal</th><th class="center">Nev.Ing</th>
          <th class="center">Estado</th><th class="center">Gestión</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
    </div>`;
  });

  document.getElementById('contenido').innerHTML=`
  <div class="kpis">
    <div class="kpi compact"><div class="kpi-label">📋 Total planillas</div><div class="kpi-val blue" id="kv1">0</div><div class="kpi-sub">${totPlanUrb} urb · ${totPlanProv} prov</div></div>
    <div class="kpi compact"><div class="kpi-label">✅ Total planillas OK</div><div class="kpi-val green" id="kv2">0</div><div class="kpi-sub">${pctOk}% del total</div></div>
    <div class="kpi compact"><div class="kpi-label">⚠️ Total con novedad</div><div class="kpi-val ${totNovedad>0?'orange':'green'}" id="kv3">0</div><div class="kpi-sub">Diferencia en neveras</div></div>
    <div class="kpi compact"><div class="kpi-label">⏳ Total sin retorno</div><div class="kpi-val yellow" id="kv4">0</div><div class="kpi-sub">Sin registro de ingreso</div></div>
    <div class="kpi compact"><div class="kpi-label">❌ Neveras faltantes</div><div class="kpi-val ${totNevFaltUnid>0?'red':'green'}" id="kv5">0</div><div class="kpi-sub">Unidades</div></div>
    <div class="kpi compact"><div class="kpi-label">➕ Neveras de más</div><div class="kpi-val ${totNevExtraUnid>0?'purple':'green'}" id="kv6">0</div><div class="kpi-sub">Unidades en exceso</div></div>
    <div class="kpi compact"><div class="kpi-label">📤 Cubetas salieron</div><div class="kpi-val teal" id="kv7">0</div><div class="kpi-sub">${totCubUrbSal} urb (${pct(totCubUrbSal,totCubSal)}%) · ${totCubProvSal} prov (${pct(totCubProvSal,totCubSal)}%)</div></div>
    <div class="kpi compact"><div class="kpi-label">📥 Cubetas ingresaron</div><div class="kpi-val ${totCubIng<totCubSal?'yellow':'green'}" id="kv8">0</div><div class="kpi-sub">${pctCub}% retorno · Dif: ${totCubSal-totCubIng>=0?'+':''}${totCubSal-totCubIng}</div></div>
  </div>

  <div class="gest-row" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
    <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.18);border-radius:10px;padding:6px 12px;display:flex;align-items:center;gap:10px;">
      <div style="width:28px;height:28px;border-radius:8px;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">↩️</div>
      <div>
        <div style="font-family:var(--mono);font-size:17px;font-weight:700;color:#f59e0b;line-height:1" id="kv-dev">0</div>
        <div style="font-size:9px;letter-spacing:0.5px;text-transform:uppercase;color:rgba(245,158,11,0.8);margin-top:2px">En devolución</div>
      </div>
    </div>
    <div style="background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.18);border-radius:10px;padding:6px 12px;display:flex;align-items:center;gap:10px;">
      <div style="width:28px;height:28px;border-radius:8px;background:rgba(168,85,247,0.12);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">📋</div>
      <div>
        <div style="font-family:var(--mono);font-size:17px;font-weight:700;color:#a855f7;line-height:1" id="kv-rad">0</div>
        <div style="font-size:9px;letter-spacing:0.5px;text-transform:uppercase;color:rgba(168,85,247,0.8);margin-top:2px">Por radicar</div>
      </div>
    </div>
    <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.18);border-radius:10px;padding:6px 12px;display:flex;align-items:center;gap:10px;">
      <div style="width:28px;height:28px;border-radius:8px;background:rgba(34,197,94,0.12);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">✅</div>
      <div>
        <div style="font-family:var(--mono);font-size:17px;font-weight:700;color:#22c55e;line-height:1" id="kv-rac">0</div>
        <div style="font-size:9px;letter-spacing:0.5px;text-transform:uppercase;color:rgba(34,197,94,0.8);margin-top:2px">Radicadas</div>
      </div>
    </div>
  </div>

  <div class="kpis-indicadores" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
    <div class="kpi compact" style="background:rgba(77,159,255,0.04); border:1px solid rgba(77,159,255,0.14);">
      <div class="kpi-label">🧊 Nev. en calle</div>
      <div class="kpi-val" style="color:var(--accent);" id="ind-nev-calle">0</div>
      <div class="kpi-sub">${totNevSal} salidas · ${totNevIng} retornos</div>
    </div>
    <div class="kpi compact" style="background:rgba(20,184,166,0.04); border:1px solid rgba(20,184,166,0.14);">
      <div class="kpi-label">📦 Cub. pendientes</div>
      <div class="kpi-val" style="color:var(--teal);" id="ind-cub-pend">0</div>
      <div class="kpi-sub">${totCubSal} salidas · ${totCubIng} retornos</div>
    </div>
    <div class="kpi compact" style="background:rgba(168,85,247,0.04); border:1px solid rgba(168,85,247,0.14);">
      <div class="kpi-label">📋 Gestión</div>
      <div class="kpi-val" style="color:var(--purple);" id="ind-gest-pct">0%</div>
      <div class="kpi-sub">${totEnDevoluciones+totPorRadicar+totRadicadas} de ${totPlan} planillas</div>
    </div>
    <div class="kpi compact" style="background:rgba(34,197,94,0.04); border:1px solid rgba(34,197,94,0.14);">
      <div class="kpi-label">⚡ Eficiencia</div>
      <div class="kpi-val" style="color:var(--green);" id="ind-efic-pct">0%</div>
      <div class="kpi-sub">${pctOk}% planillas sin novedad</div>
    </div>
  </div>

  ${(()=>{
    const durMsVal = ff - fi;
    const durDiasVal = Math.round(durMsVal/86400000)+1;

    function agruparSemanas(diasOrden) {
      const semanasMap = {};
      diasOrden.forEach(dia => {
        const fd = parseFecha(dia.fecha);
        if (!fd) return;
        const day = fd.getDay();
        const diff = fd.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(fd);
        monday.setDate(diff);
        const key = fmtI(monday);
        if (!semanasMap[key]) {
          semanasMap[key] = {
            label: 'Sem. ' + p2(monday.getDate()) + '/' + p2(monday.getMonth()+1),
            cubSal: 0,
            cubIng: 0,
            fechaOrden: monday,
            fechaFull: 'Semana del ' + monday.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})
          };
        }
        semanasMap[key].cubSal += dia.cubSal;
        semanasMap[key].cubIng += dia.cubIng;
      });
      return Object.values(semanasMap).sort((a,b) => a.fechaOrden - b.fechaOrden);
    }

    let chartData = [];
    if (durDiasVal > 45) {
      chartData = agruparSemanas(diasOrden);
    } else {
      chartData = diasOrden.map(d => ({
        label: d.fecha.slice(0, 5),
        cubSal: d.cubSal,
        cubIng: d.cubIng,
        fechaFull: d.fecha
      }));
    }

    if (chartData.length === 0) return '';

    const maxValChart = Math.max(1, ...chartData.map(d => Math.max(d.cubSal, d.cubIng)));
    const gridLines = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      gridLines.push(Math.round((maxValChart / steps) * i));
    }

    const wSVG = 1000;
    const hSVG = 200;
    const padL = 60;
    const padR = 25;
    const padT = 20;
    const padB = 30;
    const plotW = wSVG - padL - padR;
    const plotH = hSVG - padT - padB;

    const points = chartData.map((d, i) => {
      const x = padL + (chartData.length > 1 ? (i / (chartData.length - 1)) * plotW : plotW / 2);
      const ySal = padT + plotH - (d.cubSal / maxValChart) * plotH;
      const yIng = padT + plotH - (d.cubIng / maxValChart) * plotH;
      return { x, ySal, yIng, data: d };
    });

    // Make paths
    let pathSal = '';
    let pathIng = '';
    points.forEach((p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      pathSal += `${cmd} ${p.x.toFixed(1)} ${p.ySal.toFixed(1)} `;
      pathIng += `${cmd} ${p.x.toFixed(1)} ${p.yIng.toFixed(1)} `;
    });

    let gapAreaPath = '';
    if (points.length > 0) {
      const forwardPoints = points.map(p => `${p.x.toFixed(1)},${p.ySal.toFixed(1)}`).join(' ');
      const backwardPoints = [...points].reverse().map(p => `${p.x.toFixed(1)},${p.yIng.toFixed(1)}`).join(' ');
      gapAreaPath = `M ${forwardPoints} L ${backwardPoints} Z`;
    }

    let gridLinesHtml = '';
    gridLines.forEach(val => {
      const y = padT + plotH - (val / maxValChart) * plotH;
      gridLinesHtml += `
        <line x1="${padL}" y1="${y}" x2="${wSVG - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4,4" />
        <text x="${padL - 10}" y="${y + 4}" fill="rgba(255,255,255,0.4)" font-size="9" text-anchor="end" font-family="var(--mono)">${val.toLocaleString()}</text>
      `;
    });

    let labelsHtml = '';
    const labelStep = Math.max(1, Math.ceil(chartData.length / 15));
    points.forEach((p, i) => {
      if (i % labelStep === 0 || i === points.length - 1) {
        labelsHtml += `
          <text x="${p.x}" y="${hSVG - 8}" fill="rgba(255,255,255,0.4)" font-size="9" text-anchor="middle" font-family="var(--sans)">${p.data.label}</text>
          <line x1="${p.x}" y1="${padT + plotH}" x2="${p.x}" y2="${padT + plotH + 4}" stroke="rgba(255,255,255,0.15)" />
        `;
      }
    });

    // Save globally or trigger attachment in next ticks
    window._chartPointsTemp = points;
    window._chartDataTemp = chartData;

    return `
    <div class="an-card" style="margin-bottom: 12px; position: relative;">
      <div class="an-card-head" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px;">
        <div>
          <div class="an-card-title" style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
            📈 Trading de Cubetas (Balances y Retornos)
          </div>
          <div class="an-card-sub" style="font-size: 10px; color: var(--muted);">
            Flujo diario de despacho vs retorno ${durDiasVal > 45 ? '<b>(agrupado por semana)</b>' : ''}
          </div>
        </div>
        <div style="display: flex; gap: 14px; font-size: 10px; font-weight: 500; align-items:center;">
          <span style="color: #14b8a6; display: flex; align-items: center; gap: 4px;">● Salieron</span>
          <span style="color: #4d9fff; display: flex; align-items: center; gap: 4px;">● Retornaron</span>
          <span style="color: rgba(239, 68, 68, 0.5); display: flex; align-items: center; gap: 4px;">■ Brecha</span>
        </div>
      </div>
      <div style="padding: 12px 16px; position: relative;" id="trading-chart-wrapper">
        <svg id="trading-chart-svg" style="width: 100%; height: auto; display: block; overflow: visible; cursor: crosshair;" viewBox="0 0 ${wSVG} ${hSVG}">
          ${gridLinesHtml}
          <path d="${gapAreaPath}" fill="rgba(239, 68, 68, 0.15)" />
          <path d="${pathSal}" fill="none" stroke="#14b8a6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="${pathIng}" fill="none" stroke="#4d9fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          <line id="chart-hover-line" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="rgba(255,255,255,0.22)" stroke-dasharray="3,3" style="display: none;" />
          <circle id="chart-hover-dot-sal" cx="0" cy="0" r="4" fill="#14b8a6" stroke="#fff" stroke-width="1.2" style="display: none;" />
          <circle id="chart-hover-dot-ing" cx="0" cy="0" r="4" fill="#4d9fff" stroke="#fff" stroke-width="1.2" style="display: none;" />
          ${labelsHtml}
        </svg>
        <div id="chart-tooltip" style="position: absolute; pointer-events: none; display: none; background: rgba(15,23,42,0.96); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 10px; font-family: var(--sans); font-size: 11px; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.6); backdrop-filter: blur(8px); min-width: 180px;"></div>
      </div>
    </div>`;
  })()}

  <div class="indicadores">
    <div class="ind">
      <div class="ind-label">🧊 Neveras retornadas</div>
      <div class="ind-nums"><span class="ind-main" style="color:${cNev}">${totNevIng}</span><span class="ind-total">/ ${totNevSal}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pctNev}%;background:${cNev}"></div></div>
      <div class="ind-sub">${pctNev}% · Faltan ${totNevFaltUnid} · De más ${totNevExtraUnid}</div>
    </div>
    <div class="ind">
      <div class="ind-label">🧺 Cubetas · retorno por tipo</div>
      <div class="ind-rows">
        <div>
          <div class="ind-row-label"><span class="ind-row-name" style="color:var(--accent)">🏙 Urbana</span><span class="ind-row-nums">${totCubUrbIng} / ${totCubUrbSal}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pctCubU}%;background:${cCubU}"></div></div>
          <div class="ind-row-sub"><span>${pctCubU}% retorno</span><span>Dif: ${totCubUrbSal-totCubUrbIng}</span></div>
        </div>
        <div>
          <div class="ind-row-label"><span class="ind-row-name" style="color:var(--orange)">🚛 Provincia</span><span class="ind-row-nums">${totCubProvIng} / ${totCubProvSal}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pctCubP}%;background:${cCubP}"></div></div>
          <div class="ind-row-sub"><span>${pctCubP}% retorno</span><span>Dif: ${totCubProvSal-totCubProvIng}</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="tipo-grid">
    <div class="tipo-card">
      <div class="tipo-title"><span class="tipo-dot" style="background:var(--accent)"></span><span class="tipo-name">🏙 Urbana · ${totPlanUrb} planillas</span></div>
      <div class="tipo-stats">
        <div><div class="tipo-sl">Cubetas salieron</div><div class="tipo-sv">${totCubUrbSal}</div></div>
        <div><div class="tipo-sl">Cubetas ingresaron</div><div class="tipo-sv">${totCubUrbIng}</div><div class="tipo-ss">Dif: ${totCubUrbSal-totCubUrbIng} · ${pctCubU}%</div></div>
        <div><div class="tipo-sl">Neveras salieron</div><div class="tipo-sv">${totNevUrbSal}</div></div>
        <div><div class="tipo-sl">Neveras ingresaron</div><div class="tipo-sv">${totNevUrbIng}</div><div class="tipo-ss">Faltan: ${Math.max(0,totNevUrbSal-totNevUrbIng)} · De más: ${Math.max(0,totNevUrbIng-totNevUrbSal)}</div></div>
      </div>
    </div>
    <div class="tipo-card">
      <div class="tipo-title"><span class="tipo-dot" style="background:var(--orange)"></span><span class="tipo-name">🚛 Provincia · ${totPlanProv} planillas</span></div>
      <div class="tipo-stats">
        <div><div class="tipo-sl">Cubetas salieron</div><div class="tipo-sv">${totCubProvSal}</div></div>
        <div><div class="tipo-sl">Cubetas ingresaron</div><div class="tipo-sv">${totCubProvIng}</div><div class="tipo-ss">Dif: ${totCubProvSal-totCubProvIng} · ${pctCubP}%</div></div>
        <div><div class="tipo-sl">Neveras salieron</div><div class="tipo-sv">${totNevProvSal}</div></div>
        <div><div class="tipo-sl">Neveras ingresaron</div><div class="tipo-sv">${totNevProvIng}</div><div class="tipo-ss">Faltan: ${Math.max(0,totNevProvSal-totNevProvIng)} · De más: ${Math.max(0,totNevProvIng-totNevProvSal)}</div></div>
      </div>
    </div>
  </div>
  ${htmlDias}`;

  [[document.getElementById('kv1'),totPlan],[document.getElementById('kv2'),totOk],
   [document.getElementById('kv3'),totNovedad],[document.getElementById('kv4'),totSin],
   [document.getElementById('kv5'),totNevFaltUnid],[document.getElementById('kv6'),totNevExtraUnid],
   [document.getElementById('kv7'),totCubSal],[document.getElementById('kv8'),totCubIng]]
  .forEach(([el,val],i)=>{
    if(el) setTimeout(()=>animCount(el,val), i*50);
  });

  setTimeout(()=>animCount(document.getElementById('kv-dev'),totEnDevoluciones),500);
  setTimeout(()=>animCount(document.getElementById('kv-rad'),totPorRadicar),550);
  setTimeout(()=>animCount(document.getElementById('kv-rac'),totRadicadas),600);

  setTimeout(()=>animCount(document.getElementById('ind-nev-calle'), Math.max(0, totNevSal - totNevIng)), 650);
  setTimeout(()=>animCount(document.getElementById('ind-cub-pend'), Math.max(0, totCubSal - totCubIng)), 700);
  setTimeout(()=>animCountSuffix(document.getElementById('ind-gest-pct'), pct(totEnDevoluciones + totPorRadicar + totRadicadas, totPlan), '%'), 750);
  setTimeout(()=>animCountSuffix(document.getElementById('ind-efic-pct'), pctOk, '%'), 800);

  // SVG Hover logic instantiation
  setTimeout(() => {
    const svg = document.getElementById('trading-chart-svg');
    const chartPoints = window._chartPointsTemp;
    const chartData = window._chartDataTemp;
    if (svg && chartPoints && chartData) {
      const hoverLine = document.getElementById('chart-hover-line');
      const dotSal = document.getElementById('chart-hover-dot-sal');
      const dotIng = document.getElementById('chart-hover-dot-ing');
      const tooltip = document.getElementById('chart-tooltip');
      const wrapper = document.getElementById('trading-chart-wrapper');

      svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const xMouse = e.clientX - rect.left;
        const yMouse = e.clientY - rect.top;

        const viewBoxWidth = 1000;
        const viewBoxHeight = 200;
        const svgX = (xMouse / rect.width) * viewBoxWidth;

        // Find closest index
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < chartPoints.length; i++) {
          const diff = Math.abs(chartPoints[i].x - svgX);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        const p = chartPoints[closestIdx];
        const d = chartData[closestIdx];

        if (hoverLine) {
          hoverLine.setAttribute('x1', p.x);
          hoverLine.setAttribute('x2', p.x);
          hoverLine.style.display = 'block';
        }
        if (dotSal) {
          dotSal.setAttribute('cx', p.x);
          dotSal.setAttribute('cy', p.ySal);
          dotSal.style.display = 'block';
        }
        if (dotIng) {
          dotIng.setAttribute('cx', p.x);
          dotIng.setAttribute('cy', p.yIng);
          dotIng.style.display = 'block';
        }

        if (tooltip && wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const pPercentX = p.x / viewBoxWidth;
          const leftPx = pPercentX * wrapperRect.width;
          const avgY = (p.ySal + p.yIng) / 2;
          const topPx = (avgY / viewBoxHeight) * wrapperRect.height - 85;

          tooltip.style.left = Math.max(10, Math.min(wrapperRect.width - 190, leftPx - 90)) + 'px';
          tooltip.style.top = Math.max(10, topPx) + 'px';
          tooltip.style.display = 'block';

          const diffVal = d.cubSal - d.cubIng;
          const pctRet = d.cubSal > 0 ? Math.round((d.cubIng / d.cubSal) * 100) : 0;

          tooltip.innerHTML = `
            <div style="font-weight:600; font-size:11px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px; color:#fff;">
              📅 ${d.fechaFull || d.label}
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; gap: 8px;">
              <span style="color:#14b8a6; font-weight:500;">📤 Salida: <b>${d.cubSal.toLocaleString()}</b></span>
              <span style="color:#00b4ff; font-weight:500;">📥 Retorno: <b>${d.cubIng.toLocaleString()}</b></span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed rgba(255,255,255,0.06); padding-top:4px; margin-top:4px; font-size:10px;">
              <span style="color:var(--muted)">Brecha: <b style="color:${diffVal > 0 ? 'var(--red)' : 'var(--green)'}">${diffVal >= 0 ? '+' : ''}${diffVal.toLocaleString()}</b></span>
              <span style="color:var(--muted)">Retorno: <b style="color:#00b4ff">${pctRet}%</b></span>
            </div>
          `;
        }
      });

      svg.addEventListener('mouseleave', () => {
        if (hoverLine) hoverLine.style.display = 'none';
        if (dotSal) dotSal.style.display = 'none';
        if (dotIng) dotIng.style.display = 'none';
        if (tooltip) tooltip.style.display = 'none';
      });
    }
  }, 1000);
}

// ── RENDER ANÁLISIS ───────────────────────────────────────────
function renderAnalisis(){
  if(!rawOp.length){
    document.getElementById('an-contenido').innerHTML='<div class="empty"><div class="empty-icon">⏳</div><div class="empty-title">Cargando datos...</div><div class="empty-sub">Espera un momento</div></div>';
    return;
  }
  const fi=new Date(anInicio||dInicio||hoy()); fi.setHours(0,0,0,0);
  const ff=new Date(anFin||dFin||hoy());       ff.setHours(23,59,59,999);

  const fAux   =document.getElementById('an-aux').value;
  const fRuta  =document.getElementById('an-ruta').value;
  const fPlaca =document.getElementById('an-placa').value;
  const fTipo  =document.getElementById('an-tipo').value;
  const fEstado=document.getElementById('an-estado').value;
  const fBuscar=(document.getElementById('an-buscar')?.value||'').toLowerCase().trim();

  let datos=enriquecer(rawOp,rawCub).filter(r=>{
    if(!r.fechaDate||r.fechaDate<fi||r.fechaDate>ff) return false;
    if(fAux    && r.auxiliar!==fAux)    return false;
    if(fRuta   && r.ruta!==fRuta)       return false;
    if(fPlaca  && r.placa!==fPlaca)     return false;
    if(fTipo   && r.tipo!==fTipo)       return false;
    if(fEstado && r.estado!==fEstado)   return false;
    if(fBuscar && !r.planilla.toLowerCase().includes(fBuscar) &&
                  !r.auxiliar.toLowerCase().includes(fBuscar) &&
                  !r.ruta.toLowerCase().includes(fBuscar)     &&
                  !r.placa.toLowerCase().includes(fBuscar))   return false;
    return true;
  });

  if(!datos.length){
    document.getElementById('an-contenido').innerHTML='<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Sin datos para este filtro</div><div class="empty-sub">Ajustá el periodo o los filtros</div></div>';
    return;
  }

  // ── Métricas globales ──
  const totPlan=datos.length;
  const totCubSal=datos.reduce((a,r)=>a+r.cubSal,0);
  const totCubIng=datos.reduce((a,r)=>a+r.cubIng,0);
  const totNevSal=datos.reduce((a,r)=>a+r.nevSal,0);
  const totNevIng=datos.reduce((a,r)=>a+r.nevIng,0);
  const totOk   =datos.filter(r=>r.estado==='OK').length;
  const totNevFaltUnid=datos.reduce((a,r)=>a+r.nevFalt,0);
  const pctCub  =pct(totCubIng,totCubSal);
  const pctOkG  =pct(totOk,totPlan);

  // ── Ranking auxiliares ──
  const mapAux={};
  datos.forEach(r=>{
    if(!mapAux[r.auxiliar]) mapAux[r.auxiliar]={nombre:r.auxiliar,plan:0,cubSal:0,cubIng:0,nevSal:0,nevIng:0,ok:0,nov:0,sin:0,rutas:new Set()};
    const a=mapAux[r.auxiliar];
    a.plan++; a.cubSal+=r.cubSal; a.cubIng+=r.cubIng;
    a.nevSal+=r.nevSal; a.nevIng+=r.nevIng;
    a.rutas.add(r.ruta);
    if(r.estado==='OK') a.ok++;
    else if(r.estado==='Sin retorno') a.sin++;
    else a.nov++;
  });
  let rankAux=Object.values(mapAux).map(a=>({
    ...a,
    pctCub:pct(a.cubIng,a.cubSal),
    pctOk:pct(a.ok,a.plan),
    rutas:a.rutas.size
  }));

  // ── Ranking rutas ──
  const mapRuta={};
  datos.forEach(r=>{
    if(!mapRuta[r.ruta]) mapRuta[r.ruta]={nombre:r.ruta,plan:0,cubSal:0,cubIng:0,nevSal:0,nevIng:0,ok:0,nov:0,sin:0,tipo:r.tipo,auxes:new Set()};
    const ru=mapRuta[r.ruta];
    ru.plan++; ru.cubSal+=r.cubSal; ru.cubIng+=r.cubIng;
    ru.nevSal+=r.nevSal; ru.nevIng+=r.nevIng;
    ru.auxes.add(r.auxiliar);
    if(r.estado==='OK') ru.ok++;
    else if(r.estado==='Sin retorno') ru.sin++;
    else ru.nov++;
  });
  let rankRuta=Object.values(mapRuta).map(ru=>({
    ...ru,
    pctCub:pct(ru.cubIng,ru.cubSal),
    pctOk:pct(ru.ok,ru.plan),
    auxes:ru.auxes.size
  }));

  const rankAuxSal=[...rankAux].sort((a,b)=>b.cubSal-a.cubSal);
  const rankAuxIng=[...rankAux].sort((a,b)=>b.cubIng-a.cubIng);
  const rankRutaSal=[...rankRuta].sort((a,b)=>b.cubSal-a.cubSal);
  const rankRutaIng=[...rankRuta].sort((a,b)=>b.cubIng-a.cubIng);

  const maxCubAuxSal =rankAuxSal[0]?.cubSal||1;
  const maxCubAuxIng =rankAuxIng[0]?.cubIng||1;
  const maxCubRutaSal=rankRutaSal[0]?.cubSal||1;
  const maxCubRutaIng=rankRutaIng[0]?.cubIng||1;

  function mkRankRow(i, nombre, meta, cubSal, cubIng, pctCub, pctOk, maxVal, modo, extraBadge){
    const rankCls=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'';
    const barBase=modo==='sal'?cubSal:cubIng;
    const barW=Math.round((barBase||0)/Math.max(1,maxVal)*100);
    const dif=cubIng-cubSal;
    const difTxt=dif===0?'—':(dif>0?'+':'')+dif.toLocaleString();
    const difClr=dif>=0?'var(--green)':'var(--red)';
    const clrBar=barColor(pctCub);
    const clrPct=pctCub>=80?'var(--green)':pctCub>=50?'var(--yellow)':'var(--red)';
    const clrOk=pctOk>=80?'var(--green)':pctOk>=50?'var(--yellow)':'var(--red)';
    return '<div class="rank-row rank-row-2col" style="animation-delay:'+i*35+'ms">'
      +'<div style="min-width:0">'
        +'<div class="rank-name"><span class="rank-num '+rankCls+'">#'+(i+1)+'</span>'+nombre+(extraBadge?' '+extraBadge:'')+'</div>'
        +'<div class="rank-meta">'+meta+'</div>'
        +'<div class="rank-bar-wrap"><div class="rank-bar-track">'
          +'<div class="rank-bar-fill" style="width:'+barW+'%;background:'+clrBar+'"></div>'
        +'</div></div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:54px 54px 48px 44px 44px;gap:0;align-items:center;text-align:right;padding-right:4px">'
        +'<div style="padding:0 4px">'
          +'<div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--teal)">'+cubSal.toLocaleString()+'</div>'
          +'<div style="font-size:9px;color:var(--muted)">salen</div>'
        +'</div>'
        +'<div style="padding:0 4px">'
          +'<div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--accent)">'+cubIng.toLocaleString()+'</div>'
          +'<div style="font-size:9px;color:var(--muted)">entran</div>'
        +'</div>'
        +'<div style="padding:0 4px">'
          +'<div style="font-family:var(--mono);font-size:12px;font-weight:600;color:'+difClr+'">'+difTxt+'</div>'
          +'<div style="font-size:9px;color:var(--muted)">dif</div>'
        +'</div>'
        +'<div style="padding:0 4px">'
          +'<div style="font-size:12px;font-weight:600;color:'+clrPct+'">'+pctCub+'%</div>'
          +'<div style="font-size:9px;color:var(--muted)">ret</div>'
        +'</div>'
        +'<div style="padding:0 4px">'
          +'<div style="font-size:12px;font-weight:600;color:'+clrOk+'">'+pctOk+'%</div>'
          +'<div style="font-size:9px;color:var(--muted)">ok</div>'
        +'</div>'
      +'</div>'
      +'</div>';
  }

  function mkRankHeader(tipo){
    return '<div style="display:grid;grid-template-columns:1fr auto;padding:6px 14px 4px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02)">'
      +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">'+tipo+'</div>'
      +'<div style="display:grid;grid-template-columns:54px 54px 48px 44px 44px;gap:0;text-align:right;padding-right:4px">'
        +'<div style="font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--teal);padding:0 4px">Salen</div>'
        +'<div style="font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--accent);padding:0 4px">Entran</div>'
        +'<div style="font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);padding:0 4px">Dif</div>'
        +'<div style="font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);padding:0 4px">Ret%</div>'
        +'<div style="font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);padding:0 4px">OK%</div>'
      +'</div>'
      +'</div>';
  }

  function renderRankAux(lista, modo, verTodos){
    const maxVal=modo==='sal'?maxCubAuxSal:maxCubAuxIng;
    if(!lista.length) return '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Sin datos</div>';
    const LIMIT=8;
    const mostrar=verTodos?lista:lista.slice(0,LIMIT);
    const rows=mostrar.map((a,i)=>mkRankRow(i,a.nombre,a.plan+' plan · '+a.rutas+' rutas',a.cubSal,a.cubIng,a.pctCub,a.pctOk,maxVal,modo,'')).join('');
    const verMasBtn=(!verTodos&&lista.length>LIMIT)
      ?'<div style="text-align:center;padding:12px 0;border-top:1px solid var(--border)">'
        +'<button onclick="window._rankVerTodos=true;window._refreshRankToggle()" style="background:rgba(77,159,255,0.1);border:1px solid rgba(77,159,255,0.25);color:var(--accent);border-radius:8px;padding:7px 20px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans)">Ver todos ('+(lista.length-LIMIT)+' más) ▼</button>'
        +'</div>'
      :'';
    return mkRankHeader('Auxiliar') + rows + verMasBtn;
  }

  function renderRankRuta(lista, modo){
    const maxVal=modo==='sal'?maxCubRutaSal:maxCubRutaIng;
    if(!lista.length) return '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Sin datos</div>';
    return mkRankHeader('Ruta') + lista.slice(0,15).map((ru,i)=>{
      const tipoBadge=ru.tipo==='URBANA'?'<span class="badge badge-urb">URB</span>':'<span class="badge badge-prov">PRO</span>';
      return mkRankRow(i,ru.nombre,ru.plan+' plan · '+ru.auxes+' aux',ru.cubSal,ru.cubIng,ru.pctCub,ru.pctOk,maxVal,modo,tipoBadge);
    }).join('');
  }

  // ── Heatmap días de semana ──
  const diasNom=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const heatDia=Array(7).fill(null).map(()=>({plan:0,cubSal:0,cubIng:0,nevFalt:0,sin:0}));
  datos.forEach(r=>{
    const d=r.fechaDate.getDay();
    heatDia[d].plan++; heatDia[d].cubSal+=r.cubSal; heatDia[d].cubIng+=r.cubIng;
    heatDia[d].nevFalt+=r.nevFalt;
    if(r.estado==='Sin retorno') heatDia[d].sin++;
  });
  const maxHeatPlan=Math.max(1,...heatDia.map(d=>d.plan));

  // ── Tendencia mensual ──
  const mesMap={};
  datos.forEach(r=>{
    if(!r.fechaDate) return;
    const k=`${r.fechaDate.getFullYear()}-${String(r.fechaDate.getMonth()+1).padStart(2,'0')}`;
    if(!mesMap[k]) mesMap[k]={key:k,lbl:'',plan:0,cubSal:0,cubIng:0,nevFalt:0,ok:0};
    const mes=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    mesMap[k].lbl=mes[r.fechaDate.getMonth()]+' '+String(r.fechaDate.getFullYear()).slice(2);
    mesMap[k].plan++; mesMap[k].cubSal+=r.cubSal; mesMap[k].cubIng+=r.cubIng;
    mesMap[k].nevFalt+=r.nevFalt;
    if(r.estado==='OK') mesMap[k].ok++;
  });
  const meses=Object.values(mesMap).sort((a,b)=>a.key.localeCompare(b.key));
  const maxMesCub=Math.max(1,...meses.map(m=>m.cubSal));

  // ── Tabla detalle ──
  let filasDetalle='';
  datos.forEach(r=>{
    let bCls,eTxt;
    if(r.sinCarga||r.estado==='OK'){ bCls='badge-ok';   eTxt='✅ OK'; }
    else if(r.estado==='Sin retorno'){ bCls='badge-sin'; eTxt='⏳ Sin retorno'; }
    else if(r.estado==='Excedente'){ bCls='badge-exc';   eTxt='📦 Exc +'+r.nevExtra; }
    else                           { bCls='badge-falta'; eTxt='❌ Faltan '+r.nevFalt; }
    const tCls=r.tipo==='URBANA'?'badge-urb':'badge-prov';
    filasDetalle+=`<tr>
      <td class="mono">${r.planilla}</td>
      <td class="bold">${r.auxiliar}</td>
      <td style="font-size:11px;color:var(--muted)">${r.ruta}</td>
      <td class="mono" style="font-size:10px;color:var(--accent)">${r.placa||'—'}</td>
      <td class="center"><span class="badge ${tCls}">${r.tipo==='URBANA'?'🏙 URB':'🚛 PROV'}</span></td>
      <td class="center">${r.fecha}</td>
      <td class="center">${r.cubSal}</td>
      <td class="center">${r.cubIng}</td>
      <td class="center">${pctBadge(pct(r.cubIng,r.cubSal))}</td>
      <td class="center">${r.nevSal}</td>
      <td class="center">${r.nevIng}</td>
      <td class="center"><span class="badge ${bCls}">${eTxt}</span></td>
    </tr>`;
  });

  // ── Tendencias vs período anterior ──
  const durMs = ff - fi;
  const fiAnt = new Date(fi.getTime() - durMs - 86400000);
  const ffAnt = new Date(fi.getTime() - 86400000);
  fiAnt.setHours(0,0,0,0); ffAnt.setHours(23,59,59,999);

  function aplicarFiltrosAn(rows){
    return rows.filter(r=>{
      if(fAux    && r.auxiliar!==fAux)  return false;
      if(fRuta   && r.ruta!==fRuta)     return false;
      if(fPlaca  && r.placa!==fPlaca)   return false;
      if(fTipo   && r.tipo!==fTipo)     return false;
      if(fEstado && r.estado!==fEstado) return false;
      if(fBuscar && !r.planilla.toLowerCase().includes(fBuscar) &&
                    !r.auxiliar.toLowerCase().includes(fBuscar) &&
                    !r.ruta.toLowerCase().includes(fBuscar)     &&
                    !r.placa.toLowerCase().includes(fBuscar))   return false;
      return true;
    });
  }

  const todosAnt  = enriquecer(rawOp,rawCub).filter(r=>r.fechaDate>=fiAnt&&r.fechaDate<=ffAnt);
  const datosAnt  = aplicarFiltrosAn(todosAnt);
  const antPlan   = datosAnt.length;
  const antOk     = datosAnt.filter(r=>r.estado==='OK').length;
  const antCubSal = datosAnt.reduce((a,r)=>a+r.cubSal,0)||1;
  const antCubIng = datosAnt.reduce((a,r)=>a+r.cubIng,0);
  const antPctCub = pct(antCubIng,antCubSal);
  const antNevFalt= datosAnt.reduce((a,r)=>a+r.nevFalt,0);
  const antPctOk  = pct(antOk, antPlan||1);
  const durDias   = Math.round(durMs/86400000)+1;
  const labelPer  = durDias===1 ? 'vs ayer' : 'vs '+durDias+'d ant.';

  // Datos extra KPI
  const totNovedad2 = datos.filter(r=>r.estado==='Faltantes'||r.estado==='Excedente').length;
  const totSinRet2  = datos.filter(r=>r.estado==='Sin retorno').length;
  const totUrbPlan  = datos.filter(r=>r.tipo==='URBANA').length;
  const totProvPlan = datos.filter(r=>r.tipo==='PROVINCIA').length;

  function mkDeltaBadge(cur, ant, positiveGood){
    const d = cur - ant;
    if(d===0) return '<span style="font-size:11px;color:rgba(255,255,255,0.4)">= igual</span>';
    const up = d > 0;
    const good = positiveGood ? up : !up;
    const clrBg  = good ? 'rgba(34,197,94,0.15)'  : 'rgba(239,68,68,0.15)';
    const clrTxt = good ? '#22c55e' : '#ef4444';
    const arrow  = up ? '↑' : '↓';
    return '<span style="background:'+clrBg+';color:'+clrTxt+';border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600">'
          +arrow+' '+(d>0?'+':'')+d+'</span>';
  }

  const clrCub = barColor(pctCub);
  const clrOk  = barColor(pctOkG);
  const clrNev = totNevFaltUnid>0?'#ef4444':'#22c55e';
  const clrPln = '#3b82f6';

  const filtrosActivos=[fAux,fRuta,fPlaca,fTipo&&fTipo!=='',fEstado].filter(Boolean);
  const filtroLabel = filtrosActivos.length
    ? '<div style="font-size:10px;color:rgba(77,159,255,0.8);background:rgba(77,159,255,0.1);border:1px solid rgba(77,159,255,0.2);border-radius:6px;padding:3px 10px;margin-bottom:8px;display:inline-block">🔍 Filtrado: '+filtrosActivos.join(' · ')+'</div>'
    : '';

  function mkKpiCard(ico, valId, valColor, titulo, cur, ant, deltaBadge, linea3){
    return '<div class="an-kpi">'
      +'<div class="an-kpi-icon">'+ico+'</div>'
      +'<div class="an-kpi-val" style="color:'+valColor+'" id="'+valId+'">0</div>'
      +'<div class="an-kpi-label">'+titulo+'</div>'
      +'<div style="height:0.5px;background:rgba(255,255,255,0.08);margin:8px 0"></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
        +'<span style="font-size:10px;color:rgba(255,255,255,0.4)">'+labelPer+'</span>'
        +'<span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.5)">'+ant+'</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<span style="font-size:10px;color:rgba(255,255,255,0.4)">diferencia</span>'
        +deltaBadge
      +'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,0.35);padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">'+linea3+'</div>'
      +'</div>';
  }

  const _tendKpis = filtroLabel + '<div class="an-kpis">'
    + mkKpiCard('📋','an-kv1',clrPln,'Total planillas',
        totPlan, antPlan,
        mkDeltaBadge(totPlan, antPlan, true),
        'Urb: '+totUrbPlan+' · Prov: '+totProvPlan)
    + mkKpiCard('📦','an-kv2',clrCub,'% Retorno cubetas',
        pctCub, antPctCub+'%',
        mkDeltaBadge(pctCub, antPctCub, true),
        'Sal: '+totCubSal.toLocaleString()+' · Ing: '+totCubIng.toLocaleString())
    + mkKpiCard('✅','an-kv3',clrOk,'% Planillas OK',
        pctOkG, antPctOk+'%',
        mkDeltaBadge(pctOkG, antPctOk, true),
        'Con novedad: '+totNovedad2+' · Sin ret: '+totSinRet2)
    + mkKpiCard('🧊','an-kv4',clrNev,'Nev. faltantes',
        totNevFaltUnid, antNevFalt,
        mkDeltaBadge(totNevFaltUnid, antNevFalt, false),
        'Período ant.: '+antNevFalt+' unidades')
    +'</div>';

  window._rankAuxSal=rankAuxSal; window._rankAuxIng=rankAuxIng;
  window._rankRutaSal=rankRutaSal; window._rankRutaIng=rankRutaIng;
  window._renderRankAux=renderRankAux; window._renderRankRuta=renderRankRuta;
  _rankToggleTipo='aux'; _rankToggleModo='sal';
  window._rankVerTodos=false;
  setTimeout(_refreshRankToggle, 0);

  document.getElementById('an-contenido').innerHTML=`
  ${_tendKpis}

  <div class="an-card" style="margin-bottom:10px">
    <div class="an-card-head" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div class="an-card-title" id="rank-toggle-title">👷 Ranking Auxiliares</div>
        <div class="an-card-sub" id="rank-toggle-sub">${rankAux.length} auxiliares · ordenado por cubetas que salen</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
        <button class="rank-tab active" id="toggle-aux" onclick="window.switchRankToggle('aux')">👷 Auxiliares</button>
        <button class="rank-tab"        id="toggle-ruta" onclick="window.switchRankToggle('ruta')">🗺 Rutas</button>
        <span style="width:1px;height:20px;background:var(--border);margin:0 4px;display:inline-block"></span>
        <button class="rank-tab active" id="tab-sal" onclick="window.switchRankTabToggle('sal')">📤 Salen</button>
        <button class="rank-tab ing"    id="tab-ing" onclick="window.switchRankTabToggle('ing')">📥 Entran</button>
      </div>
    </div>
    <div id="rank-toggle-body"></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="an-card">
      <div class="an-card-head">
        <div>
          <div class="an-card-title">📅 Picos por día de semana</div>
          <div class="an-card-sub">Volumen y retorno real de cubetas por día</div>
        </div>
      </div>
      <div class="an-card-body" style="padding:0">
        <div style="display:grid;grid-template-columns:40px 36px 1fr 52px 46px 46px;gap:0;padding:7px 14px 5px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02)">
          <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Día</div>
          <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:center">Plan</div>
          <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Volumen cubetas</div>
          <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--teal);text-align:right">Salen</div>
          <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--accent);text-align:right">Entran</div>
          <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right">Ret%</div>
        </div>
        ${(()=>{
          const maxCub=Math.max(1,...heatDia.map(d=>d.cubSal));
          return heatDia.map((d,i)=>{
            const pctBar=Math.round(d.cubSal/maxCub*100);
            const pctRet=d.cubSal>0?Math.round(d.cubIng/d.cubSal*100):0;
            const esWeekend=i===0||i===6;
            const clrDia=esWeekend?'var(--orange)':'var(--text)';
            const clrRet=pctRet>=80?'var(--green)':pctRet>=50?'var(--yellow)':'var(--red)';
            const retTxt=d.cubSal===0?'—':pctRet+'%';
            const barSal=pctBar;
            const barIng=d.cubSal>0?Math.round(d.cubIng/maxCub*100):0;
            const planBg=d.plan===0?'rgba(255,255,255,0.06)'
              :d.plan===maxHeatPlan?'rgba(249,115,22,0.25)'
              :d.plan>=maxHeatPlan*0.7?'rgba(59,130,246,0.15)'
              :'rgba(255,255,255,0.04)';
            return '<div style="display:grid;grid-template-columns:40px 36px 1fr 52px 46px 46px;align-items:center;gap:0;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.04);background:'+planBg+'">'
              +'<div style="font-size:12px;font-weight:600;color:'+clrDia+'">'+diasNom[i]+'</div>'
              +'<div style="text-align:center;font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text)">'+d.plan+'</div>'
              +'<div style="padding:0 12px 0 4px">'
                +'<div style="position:relative;height:10px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden">'
                  +'<div style="position:absolute;left:0;top:0;height:10px;width:'+barSal+'%;background:rgba(59,130,246,0.7);border-radius:5px"></div>'
                  +'<div style="position:absolute;left:0;top:0;height:10px;width:'+barIng+'%;background:rgba(20,184,166,0.9);border-radius:5px"></div>'
                +'</div>'
              +'</div>'
              +'<div style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--accent)">'+d.cubSal.toLocaleString()+'</div>'
              +'<div style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--teal)">'+d.cubIng.toLocaleString()+'</div>'
              +'<div style="text-align:right;font-size:12px;font-weight:600;color:'+clrRet+'">'+retTxt+'</div>'
              +'</div>';
          }).join('');
        })()}
        <div style="padding:7px 14px;display:flex;gap:14px;font-size:9px;color:var(--muted);border-top:1px solid var(--border);flex-wrap:wrap">
          <span>Plan = planillas del día</span>
          <span style="color:rgba(59,130,246,0.9)">▬ Salen</span>
          <span style="color:var(--teal)">▬ Entran (retorno)</span>
          <span>Ret% = % retorno</span>
          <span style="color:var(--orange)">Naranja = día pico</span>
        </div>
      </div>
    </div>

    <div class="an-card">
      <div class="an-card-head">
        <div>
          <div class="an-card-title">📈 Tendencia mensual</div>
          <div class="an-card-sub">Cubetas salidas · % retorno · neveras faltantes</div>
        </div>
      </div>
      <div class="an-card-body" style="padding:0">
        ${meses.length<2
          ?((()=>{
            const semMap={};
            datos.forEach(r=>{
              if(!r.fechaDate) return;
              const dow=r.fechaDate.getDay();
              const mdy=new Date(r.fechaDate);
              mdy.setDate(r.fechaDate.getDate()-(dow===0?6:dow-1));
              const k=fmtI(mdy);
              if(!semMap[k]) semMap[k]={key:k,lbl:'S/'+p2(mdy.getDate())+'/'+p2(mdy.getMonth()+1),plan:0,cubSal:0,cubIng:0,nevFalt:0,ok:0};
              semMap[k].plan++; semMap[k].cubSal+=r.cubSal; semMap[k].cubIng+=r.cubIng;
              semMap[k].nevFalt+=r.nevFalt; if(r.estado==='OK') semMap[k].ok++;
            });
            const sems=Object.values(semMap).sort((a,b)=>a.key.localeCompare(b.key));
            if(sems.length<2) return '<div style="padding:30px 16px;text-align:center;color:var(--muted);font-size:12px">Seleccioná al menos 2 semanas o más de 1 mes para ver tendencia</div>';
            const maxSemCub=Math.max(1,...sems.map(s=>s.cubSal));
            return '<div style="display:grid;grid-template-columns:52px 1fr 64px 48px 52px;gap:0;padding:8px 16px 6px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02)">'
              +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Semana</div>'
              +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Volumen</div>'
              +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--teal);text-align:right">Cubetas</div>'
              +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right">Ret%</div>'
              +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--red);text-align:right">Nev.F</div>'
              +'</div>'
              +sems.map(s=>{
                const pctC=pct(s.cubIng,s.cubSal);
                const bW=Math.round(s.cubSal/maxSemCub*100);
                const clrP=barColor(pctC);
                return '<div style="display:grid;grid-template-columns:52px 1fr 64px 48px 52px;align-items:center;gap:0;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,0.04)">'
                  +'<div style="font-size:11px;font-weight:600;color:var(--accent)">'+s.lbl+'</div>'
                  +'<div style="padding-right:12px"><div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">'
                    +'<div style="height:8px;width:'+bW+'%;background:var(--teal);border-radius:4px"></div></div></div>'
                  +'<div style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--teal)">'+s.cubSal.toLocaleString()+'</div>'
                  +'<div style="text-align:right;font-size:12px;font-weight:600;color:'+clrP+'">'+pctC+'%</div>'
                  +'<div style="text-align:right;font-size:12px;font-weight:600;color:'+(s.nevFalt>0?'var(--red)':'var(--green)')+'">'+s.nevFalt+'</div>'
                  +'</div>';
              }).join('')
              +'<div style="padding:8px 16px;display:flex;gap:16px;font-size:9px;color:var(--muted);border-top:1px solid var(--border)">'
                +'<span>Vista semanal — lunes a domingo</span>'
              +'</div>';
          })())
          :('<div style="display:grid;grid-template-columns:48px 1fr 64px 48px 52px;gap:0;padding:8px 16px 6px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02)">'
            +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Mes</div>'
            +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Volumen</div>'
            +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--teal);text-align:right">Cubetas</div>'
            +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right">Ret%</div>'
            +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--red);text-align:right">Nev.F</div>'
            +'</div>'
            +meses.map((m,i)=>{
              const pctCub=pct(m.cubIng,m.cubSal);
              const barW=Math.round(m.cubSal/maxMesCub*100);
              const clrBar=barColor(pctCub);
              const clrPct=pctCub>=80?'var(--green)':pctCub>=50?'var(--yellow)':'var(--red)';

              // Comparativa mes anterior
              const prev = meses[i - 1];
              let colVolSub = '';
              let colRetSub = '';
              let colNevSub = '';
              if(prev){
                const diffVol = m.cubSal - prev.cubSal;
                const diffVolPct = prev.cubSal > 0 ? Math.round((diffVol / prev.cubSal) * 100) : 0;
                const volSign = diffVolPct > 0 ? '+' : '';
                const volColor = diffVol >= 0 ? 'var(--green)' : 'var(--red)';
                const volArrow = diffVol > 0 ? '↑' : '↓';
                colVolSub = `<div style="font-size:9px;color:${volColor}">${volArrow}${volSign}${diffVolPct}%</div>`;

                const prevPct = pct(prev.cubIng, prev.cubSal);
                const diffPct = pctCub - prevPct;
                const retSign = diffPct > 0 ? '+' : '';
                const retColor = diffPct >= 0 ? 'var(--green)' : 'var(--red)';
                colRetSub = `<div style="font-size:9px;color:${retColor}">${retSign}${diffPct}%</div>`;

                const diffNev = m.nevFalt - prev.nevFalt;
                const nevSign = diffNev > 0 ? '+' : '';
                const nevColor = diffNev <= 0 ? 'var(--green)' : 'var(--red)';
                colNevSub = `<div style="font-size:9px;color:${nevColor}">${nevSign}${diffNev}</div>`;
              } else {
                colVolSub = '<div style="font-size:9px;color:var(--muted)">—</div>';
                colRetSub = '<div style="font-size:9px;color:var(--muted)">—</div>';
                colNevSub = '<div style="font-size:9px;color:var(--muted)">—</div>';
              }

              return '<div style="display:grid;grid-template-columns:48px 1fr 64px 48px 52px;align-items:center;gap:0;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.04)">'
                +'<div style="font-size:12px;font-weight:600">'+m.lbl+'</div>'
                +'<div style="padding-right:12px">'
                  +'<div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">'
                    +'<div style="height:8px;width:'+barW+'%;background:var(--teal);border-radius:4px;transition:width .6s"></div>'
                  +'</div>'
                +'</div>'
                +'<div style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--teal);line-height:1.2">'+m.cubSal.toLocaleString()+colVolSub+'</div>'
                +'<div style="text-align:right;font-size:12px;font-weight:600;color:'+clrPct+';line-height:1.2">'+pctCub+'%'+colRetSub+'</div>'
                +'<div style="text-align:right;font-size:12px;font-weight:600;color:'+(m.nevFalt>0?'var(--red)':'var(--green)')+';line-height:1.2">'+m.nevFalt+colNevSub+'</div>'
                +'</div>';
            }).join('')
            +'<div style="padding:8px 16px;display:flex;gap:16px;font-size:9px;color:var(--muted);border-top:1px solid var(--border)">'
              +'<span style="color:var(--teal)">▬ Cubetas salidas</span>'
              +'<span>Ret% = % que ingresaron</span>'
              +'<span style="color:var(--red)">Nev.F = neveras faltantes</span>'
            +'</div>'
          )
        }
      </div>
    </div>
  </div>

  <div class="an-card" style="margin-bottom:10px">
    <div class="an-card-head" style="cursor:pointer;user-select:none" onclick="window.toggleTablaDetalle()">
      <div>
        <div class="an-card-title">📄 Detalle planillas filtradas</div>
        <div class="an-card-sub">${datos.length} planillas · clic para ver</div>
      </div>
      <div id="tabla-detalle-arrow" style="font-size:18px;color:var(--muted);transition:transform .2s">▼</div>
    </div>
    <div id="tabla-detalle-body" style="display:none">
      <div class="tbl-wrap">
        <table class="tbl-an">
          <thead><tr>
            <th>Planilla</th><th>Auxiliar</th><th>Ruta</th><th>Placa</th>
            <th class="center">Tipo</th><th class="center">Fecha</th>
            <th class="center">Cub.Sal</th><th class="center">Cub.Ing</th><th class="center">% Cub</th>
            <th class="center">Nev.Sal</th><th class="center">Nev.Ing</th>
            <th class="center">Estado</th>
          </tr></thead>
          <tbody>${filasDetalle}</tbody>
        </table>
      </div>
    </div>
  </div>`;

  [['an-kv1',totPlan],['an-kv2',pctCub],['an-kv3',pctOkG],['an-kv4',totNevFaltUnid]]
    .forEach(([id,val],i)=>{
      const el = document.getElementById(id);
      if(el) setTimeout(()=>animCount(el,val),i*80);
    });
}

// ── AUXILIARES ────────────────────────────────────────────────
function renderAuxiliares(){
  if(!rawOp.length){document.getElementById('auxp-contenido').innerHTML='<div class="empty"><div class="empty-icon">⏳</div><div class="empty-title">Cargando...</div></div>';return;}
  const fi=new Date(auxInicio||hoy()); fi.setHours(0,0,0,0);
  const ff=new Date(auxFin||hoy()); ff.setHours(23,59,59,999);
  const fAux=(document.getElementById('aux-sel-aux')?.value||'');
  const fRuta=(document.getElementById('aux-sel-ruta')?.value||'');
  const fEst=(document.getElementById('aux-sel-estado')?.value||'');

  const todos=enriquecer(rawOp,rawCub);
  const datos=todos.filter(r=>{
    if(!r.fechaDate||r.fechaDate<fi||r.fechaDate>ff) return false;
    if(fAux && r.auxiliar!==fAux) return false;
    if(fRuta && r.ruta!==fRuta) return false;
    if(fEst && r.estado!==fEst) return false;
    return true;
  });

  const mapa={};
  datos.forEach(r=>{
    if(!r.auxiliar) return;
    if(!mapa[r.auxiliar]) mapa[r.auxiliar]={nombre:r.auxiliar,plan:0,cubSal:0,cubIng:0,nevSal:0,nevIng:0,ok:0,falt:0,sin:0,excedente:0,nevFalt:0,rutas:new Set(),placas:new Set(),novedades:[]};
    const a=mapa[r.auxiliar];
    a.plan++; a.cubSal+=r.cubSal; a.cubIng+=r.cubIng;
    a.nevSal+=r.nevSal; a.nevIng+=r.nevIng; a.nevFalt+=r.nevFalt;
    a.rutas.add(r.ruta); if(r.placa) a.placas.add(r.placa);
    if(r.estado==='OK') a.ok++;
    else if(r.estado==='Faltantes'){a.falt++; a.novedades.push({planilla:r.planilla,fecha:r.fecha,ruta:r.ruta,nevFalt:r.nevFalt,estado:r.estado});}
    else if(r.estado==='Sin retorno'){a.sin++; a.novedades.push({planilla:r.planilla,fecha:r.fecha,ruta:r.ruta,nevFalt:0,estado:r.estado});}
    else if(r.estado==='Excedente') a.excedente++;
  });

  let lista=Object.values(mapa).map(a=>({...a,pctOk:pct(a.ok,a.plan),pctCub:pct(a.cubIng,a.cubSal),rutas:a.rutas.size,placas:[...a.placas]}));
  lista.sort((a,b)=>b.cubSal-a.cubSal);
  if(!lista.length){
    document.getElementById('auxp-contenido').innerHTML='<div class="empty"><div class="empty-icon">👷</div><div class="empty-title">Sin datos</div><div class="empty-sub">Ajusta el periodo o filtros</div></div>';
    return;
  }

  const totPlan=datos.length, totOk=datos.filter(r=>r.estado==='OK').length;
  const totCubSal=datos.reduce((a,r)=>a+r.cubSal,0);
  const totCubIng=datos.reduce((a,r)=>a+r.cubIng,0);
  const totNevFalt=datos.reduce((a,r)=>a+r.nevFalt,0);

  const cards=lista.map((a,i)=>{
    const ini=a.nombre.split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    const barClr=barColor(a.pctCub);
    const novHTML=a.novedades.length?`
      <div style="padding:0 16px 12px">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Novedades</div>
        ${a.novedades.slice(0,5).map(n=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">
            <span class="mono">${n.planilla}</span>
            <span style="color:var(--muted);font-size:10px">${n.fecha} · ${n.ruta.substring(0,12)}</span>
            <span class="badge ${n.estado==='Faltantes'?'badge-falt':'badge-sin'}">${n.estado==='Faltantes'?'❌ '+n.nevFalt+' falt':'⏳ Sin ret'}</span>
          </div>`).join('')}
        ${a.novedades.length>5?`<div style="font-size:10px;color:var(--muted);margin-top:6px">+${a.novedades.length-5} novedades más</div>`:''}
      </div>`:'';
    return `<div class="aux-card" style="animation:slideInLeft .35s cubic-bezier(.4,0,.2,1) ${i*35}ms both">
      <div class="aux-card-head">
        <div class="aux-avatar">${ini}</div>
        <div style="flex:1">
          <div class="aux-name">${a.nombre}</div>
          <div class="aux-meta">${a.plan} planillas · ${a.rutas} rutas · ${a.placas.slice(0,2).join(', ')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${a.pctOk>=80?'var(--green)':a.pctOk>=50?'var(--yellow)':'var(--red)'}">${a.pctOk}%</div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">ok</div>
        </div>
      </div>
      <div class="aux-kpis">
        <div class="aux-kpi"><div class="aux-kpi-val" style="color:var(--teal)">${a.cubSal}</div><div class="aux-kpi-lbl">Cub. sal</div></div>
        <div class="aux-kpi"><div class="aux-kpi-val">${a.cubIng}</div><div class="aux-kpi-lbl">Cub. ing</div></div>
        <div class="aux-kpi"><div class="aux-kpi-val" style="color:var(--red)">${a.nevFalt}</div><div class="aux-kpi-lbl">Nev. falt</div></div>
        <div class="aux-kpi"><div class="aux-kpi-val" style="color:var(--yellow)">${a.sin}</div><div class="aux-kpi-lbl">Sin ret</div></div>
        <div class="aux-kpi"><div class="aux-kpi-val">${a.falt}</div><div class="aux-kpi-lbl">Con falt</div></div>
        <div class="aux-kpi"><div class="aux-kpi-val" style="color:var(--purple)">${a.excedente}</div><div class="aux-kpi-lbl">Excedente</div></div>
      </div>
      <div class="aux-bar-wrap">
        <div class="aux-bar-label"><span>Retorno cubetas</span><span style="color:${barClr}">${a.pctCub}%</span></div>
        <div class="aux-bar-track"><div class="aux-bar-fill" style="width:${a.pctCub}%;background:${barClr}"></div></div>
      </div>
      ${novHTML}
    </div>`;
  }).join('');

  const resumenHtml=`<div style="display:flex;gap:16px;flex-wrap:wrap;padding:10px 0 14px;border-bottom:1px solid var(--border);margin-bottom:14px;font-size:12px;color:var(--muted)">
    <span>📋 <b style="color:var(--text)">${totPlan}</b> planillas</span>
    <span>✅ <b style="color:var(--green)">${pct(totOk,totPlan)}%</b> OK</span>
    <span>📤 <b style="color:var(--teal)">${totCubSal.toLocaleString()}</b> cub. sal · 📥 <b>${totCubIng.toLocaleString()}</b> ing · <b style="color:${barColor(pct(totCubIng,totCubSal))}">${pct(totCubIng,totCubSal)}%</b> ret</span>
    <span>🧊 <b style="color:${totNevFalt>0?'var(--red)':'var(--green)'}">${totNevFalt}</b> nev. falt.</span>
    <span style="color:var(--muted)">${lista.length} auxiliares</span>
  </div>`;

  document.getElementById('auxp-contenido').innerHTML=resumenHtml+`<div class="aux-grid">${cards}</div>`;
}

// ── AUXILIARES FILTROS FECHAS ──────────────────────────────
function setAuxPeriodo(p, btn){
  document.querySelectorAll('#page-auxp .btn-periodo').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const h=hoy();
  if(p==='hoy'){auxInicio=auxFin=new Date(h);}
  else if(p==='ayer'){const a=new Date(h);a.setDate(a.getDate()-1);auxInicio=auxFin=a;}
  else if(p==='semana'){const ini=new Date(h);ini.setDate(ini.getDate()-ini.getDay()+1);auxInicio=ini;auxFin=new Date(h);}
  else if(p==='semana-ant'){const ini=new Date(h);ini.setDate(ini.getDate()-ini.getDay()-6);const fin=new Date(ini);fin.setDate(fin.getDate()+6);auxInicio=ini;auxFin=fin;}
  else if(p==='mes'){auxInicio=new Date(h.getFullYear(),h.getMonth(),1);auxFin=new Date(h);}
  else if(p==='todo'){auxInicio=new Date(2020,0,1);auxFin=new Date(h);}
  document.getElementById('aux-fi').value=fmtI(auxInicio);
  document.getElementById('aux-ff').value=fmtI(auxFin);
  renderAuxiliares();
}
function aplicarAux(){
  const v1=document.getElementById('aux-fi').value, v2=document.getElementById('aux-ff').value;
  if(v1){const p=v1.split('-');auxInicio=new Date(+p[0],+p[1]-1,+p[2]);}
  if(v2){const p=v2.split('-');auxFin=new Date(+p[0],+p[1]-1,+p[2]);}
  renderAuxiliares();
}
function limpiarAux(){
  document.getElementById('aux-sel-aux').value='';
  document.getElementById('aux-sel-ruta').value='';
  document.getElementById('aux-sel-estado').value='';
  renderAuxiliares();
}

// ── RANKING TOGGLE ──
function switchRankToggle(tipo){
  _rankToggleTipo = tipo;
  window._rankVerTodos = false;
  document.getElementById('toggle-aux').classList.toggle('active', tipo==='aux');
  document.getElementById('toggle-ruta').classList.toggle('active', tipo==='ruta');
  _refreshRankToggle();
}

function switchRankTabToggle(modo){
  _rankToggleModo = modo;
  window._rankVerTodos = false;
  document.getElementById('tab-sal').classList.toggle('active', modo==='sal');
  document.getElementById('tab-ing').classList.toggle('active', modo==='ing');
  _refreshRankToggle();
}

function _refreshRankToggle(){
  const tipo = _rankToggleTipo;
  const modo = _rankToggleModo;
  const verTodos = !!window._rankVerTodos;
  const body = document.getElementById('rank-toggle-body');
  if(!body) return;
  const isSal = modo==='sal';
  if(tipo==='aux'){
    const lista = isSal ? window._rankAuxSal : window._rankAuxIng;
    body.innerHTML = window._renderRankAux(lista, modo, verTodos);
    document.getElementById('rank-toggle-title').textContent = 'Auxiliares';
    document.getElementById('rank-toggle-sub').textContent = lista.length+' auxiliares · ordenado por cubetas que '+(isSal?'salen':'entran');
  } else {
    const lista = isSal ? window._rankRutaSal : window._rankRutaIng;
    body.innerHTML = window._renderRankRuta(lista, modo, verTodos);
    document.getElementById('rank-toggle-title').textContent = 'Rutas';
    document.getElementById('rank-toggle-sub').textContent = lista.length+' rutas · ordenado por cubetas que '+(isSal?'salen':'entran');
  }
}

// ── GENERAR PDF ──
function generarPDF(origen){
  let datos, fi, ff;
  if(origen==='op'){
    fi=new Date(dInicio); ff=new Date(dFin);
    fi.setHours(0,0,0,0); ff.setHours(23,59,59,999);
    datos=enriquecer(rawOp,rawCub).filter(r=>r.fechaDate>=fi&&r.fechaDate<=ff);
  } else {
    fi=new Date(anInicio||dInicio||hoy()); ff=new Date(anFin||dFin||hoy());
    fi.setHours(0,0,0,0); ff.setHours(23,59,59,999);
    datos=enriquecer(rawOp,rawCub).filter(r=>r.fechaDate>=fi&&r.fechaDate<=ff);
  }
  const totPlan=datos.length;
  const totOk=datos.filter(r=>r.estado==='OK').length;
  const totFalt=datos.reduce((a,r)=>a+r.nevFalt,0);
  const totSin=datos.filter(r=>r.estado==='Sin retorno').length;
  const totCubSal=datos.reduce((a,r)=>a+r.cubSal,0);
  const totCubIng=datos.reduce((a,r)=>a+r.cubIng,0);
  const totNevSal=datos.reduce((a,r)=>a+r.nevSal,0);
  const totNevIng=datos.reduce((a,r)=>a+r.nevIng,0);
  const pctCubG=pct(totCubIng,totCubSal);
  const pctOkG=pct(totOk,totPlan);
  const fmtFecha=d=>`${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`;
  const periodo=`${fmtFecha(fi)} \u2014 ${fmtFecha(ff)}`;
  const ahora=new Date().toLocaleString('es-CO',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});

  let sedeStr = 'Medellín';
  if (datos && datos.length > 0) {
    const rNames = datos.map(r => (r.ruta || '').toUpperCase());
    const hasIbague = rNames.some(n => n.includes('IBAGUE'));
    const hasMedellin = rNames.some(n => n.includes('BELLO') || n.includes('CARMEN') || n.includes('UNION') || n.includes('SABANETA') || n.includes('ENVIGADO') || n.includes('RIONEGRO') || n.includes('SANTUARIO'));
    if (hasIbague && !hasMedellin) {
      sedeStr = 'Ibagué';
    } else if (hasIbague && hasMedellin) {
      sedeStr = 'Ibagué / Medellín';
    }
  }

  const mapAux={};
  datos.forEach(r=>{
    if(!r.auxiliar) return;
    if(!mapAux[r.auxiliar]) mapAux[r.auxiliar]={nombre:r.auxiliar,cubSal:0,cubIng:0,plan:0,ok:0,nevFalt:0};
    mapAux[r.auxiliar].cubSal+=r.cubSal; mapAux[r.auxiliar].cubIng+=r.cubIng;
    mapAux[r.auxiliar].plan++; mapAux[r.auxiliar].nevFalt+=r.nevFalt;
    if(r.estado==='OK') mapAux[r.auxiliar].ok++;
  });
  const topAux=Object.values(mapAux).sort((a,b)=>b.cubSal-a.cubSal).slice(0,5);
  const auxRows=topAux.map((a,i)=>`<tr><td>${i+1}. ${a.nombre}</td><td style="text-align:center">${a.plan}</td><td style="text-align:center;color:#0d9488">${a.cubSal}</td><td style="text-align:center">${a.cubIng}</td><td style="text-align:center;color:${pct(a.ok,a.plan)>=70?'#16a34a':'#dc2626'}">${pct(a.ok,a.plan)}%</td><td style="text-align:center;color:#dc2626">${a.nevFalt}</td></tr>`).join('');

  const filtrosArr=[];
  if(origen==='op'){
    const est=document.getElementById('op-estado')?.value;
    const bus=document.getElementById('op-buscar')?.value?.trim();
    if(est) filtrosArr.push('Estado: '+est);
    if(bus) filtrosArr.push('Búsqueda: "'+bus+'"');
  } else {
    const fAux=document.getElementById('an-aux')?.value;
    const fRuta=document.getElementById('an-ruta')?.value;
    const fPlaca=document.getElementById('an-placa')?.value;
    const fTipo=document.getElementById('an-tipo')?.value;
    const fEst=document.getElementById('an-estado')?.value;
    if(fAux) filtrosArr.push('Auxiliar: '+fAux);
    if(fRuta) filtrosArr.push('Ruta: '+fRuta);
    if(fPlaca) filtrosArr.push('Placa: '+fPlaca);
    if(fTipo) filtrosArr.push('Tipo: '+fTipo);
    if(fEst) filtrosArr.push('Estado: '+fEst);
  }
  const filtrosPDF=filtrosArr.length?filtrosArr.join(' · '):'';
  const filtrosHtml = filtrosPDF ? `<div style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:7px 28px;font-size:10px;color:#92400e"><b>Filtros aplicados:</b> ${filtrosPDF}</div>` : '';

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ferricar - Informe ${periodo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:13px;}
  .header{background:#060d1f;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;}
  .logo-box{width:34px;height:34px;background:#3b82f6;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;letter-spacing:1px;margin-right:10px;}
  .logo-wrap{display:flex;align-items:center;}
  .logo-name{color:#fff;font-size:16px;font-weight:600;}
  .logo-sub{color:rgba(255,255,255,0.45);font-size:10px;margin-top:1px;}
  .hright{text-align:right;}
  .hright-type{color:rgba(255,255,255,0.55);font-size:9px;letter-spacing:2px;text-transform:uppercase;}
  .hright-per{color:#fff;font-size:12px;margin-top:3px;}
  .meta{background:#f8f9fa;border-bottom:1px solid #e5e7eb;padding:9px 28px;display:flex;justify-content:space-between;}
  .meta span{color:#6b7280;font-size:10px;} .meta b{color:#111;}
  .body{padding:20px 28px;}
  .section-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;margin-top:18px;}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
  .kpi{background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;}
  .kpi-val{font-size:22px;font-weight:700;font-family:monospace;}
  .kpi-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-top:3px;}
  .kpi-sub{font-size:10px;color:#9ca3af;margin-top:2px;}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;}
  thead th{background:#f8f9fa;padding:7px 8px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;}
  tbody td{padding:7px 8px;border-bottom:1px solid #f3f4f6;}
  tbody tr:last-child td{border-bottom:none;}
  .footer{margin-top:24px;padding:10px 28px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;}
  .footer span{font-size:9px;color:#9ca3af;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>
<div class="header">
  <div class="logo-wrap">
    <div class="logo-box">FC</div>
    <div><div class="logo-name">Ferricar</div><div class="logo-sub">Logística y Transporte \xb7 ${sedeStr}</div></div>
  </div>
  <div class="hright"><div class="hright-type">Informe operativo</div><div class="hright-per">${periodo}</div></div>
</div>
<div class="meta">
  <span>Cliente: <b>Coopidrogas</b></span>
  <span>${totPlan} planillas · ${pctOkG}% OK</span>
  <span>Generado: <b>${ahora}</b></span>
</div>
${filtrosHtml}
<div class="body">
  <div class="section-title">Resumen operativo</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${totPlan}</div><div class="kpi-lbl">Total planillas</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#16a34a">${totOk}</div><div class="kpi-lbl">Retornaron OK</div><div class="kpi-sub">${pctOkG}% del total</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#dc2626">${totFalt}</div><div class="kpi-lbl">Nev. faltantes</div><div class="kpi-sub">unidades perdidas</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#d97706">${totSin}</div><div class="kpi-lbl">Sin retorno</div><div class="kpi-sub">pendientes</div></div>
  </div>
  <div class="section-title">Cubetas y neveras</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val" style="color:#0d9488">${totCubSal.toLocaleString()}</div><div class="kpi-lbl">Cub. salieron</div></div>
    <div class="kpi"><div class="kpi-val">${totCubIng.toLocaleString()}</div><div class="kpi-lbl">Cub. ingresaron</div><div class="kpi-sub">${pctCubG}% retorno</div></div>
    <div class="kpi"><div class="kpi-val">${totNevSal}</div><div class="kpi-lbl">Nev. salieron</div></div>
    <div class="kpi"><div class="kpi-val">${totNevIng}</div><div class="kpi-lbl">Nev. ingresaron</div></div>
  </div>
  <div class="section-title">Top 5 auxiliares por cubetas</div>
  <table>
    <thead><tr><th>Auxiliar</th><th>Planillas</th><th>Cub. Sal</th><th>Cub. Ing</th><th>% OK</th><th>Nev. Falt</th></tr></thead>
    <tbody>${auxRows}</tbody>
  </table>
</div>
<div class="footer">
  <span>Ferricar \xb7 Sistema de control de retorno \xb7 ferricar-dashboard.vercel.app</span>
  <span>Pág. 1 de 1</span>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
  win.document.close();
}

function toggleTablaDetalle(){
  const body  = document.getElementById('tabla-detalle-body');
  const arrow = document.getElementById('tabla-detalle-arrow');
  if(!body) return;
  const abierto = body.style.display !== 'none';
  body.style.display  = abierto ? 'none' : 'block';
  if(arrow) arrow.style.transform = abierto ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ── INIT ──
window.onload=()=>{
  const h=hoy();
  const per=calcPeriodo('mes');
  dInicio=per.ini; dFin=per.fin;
  anInicio=per.ini; anFin=per.fin;
  auxInicio=per.ini; auxFin=per.fin;

  document.getElementById('fi').value=fmtI(dInicio);
  document.getElementById('ff').value=fmtI(dFin);
  document.getElementById('an-fi').value=fmtI(anInicio);
  document.getElementById('an-ff').value=fmtI(anFin);
  document.getElementById('aux-fi').value=fmtI(auxInicio);
  document.getElementById('aux-ff').value=fmtI(auxFin);
  cargarDatos();
};

// listeners registros
['an-aux','an-ruta','an-placa','an-tipo','an-estado'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('change',renderAnalisis);
});
['aux-sel-aux', 'aux-sel-ruta', 'aux-sel-estado'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('change',renderAuxiliares);
});

const anBus = document.getElementById('an-buscar');
if(anBus) anBus.addEventListener('input',renderAnalisis);

setInterval(()=>cargarDatos(true), 5*60*1000);

// Exponer triggers globales al DOM
window.switchPage = switchPage;
window.cargarDatos = cargarDatos;
window.setPeriodo = setPeriodo;
window.aplicar = aplicar;
window.renderizarOp = renderizarOp;
window.generarPDF = generarPDF;
window.setAnPeriodo = setAnPeriodo;
window.aplicarAn = aplicarAn;
window.limpiarFiltrosAn = limpiarFiltrosAn;
window.setAuxPeriodo = setAuxPeriodo;
window.aplicarAux = aplicarAux;
window.limpiarAux = limpiarAux;
window.toggleTablaDetalle = toggleTablaDetalle;
window.switchRankToggle = switchRankToggle;
window.switchRankTabToggle = switchRankTabToggle;
window._refreshRankToggle = _refreshRankToggle;
