/**
 * Ferricar Dashboard - Canvas Background Map
 * Self-contained equirectangular world map with animated routes, particle effects, and glows.
 */

const canvas = document.getElementById('bg-canvas');
const ctx    = canvas.getContext('2d');

// ── Proyección equirectangular ──────────────────────────────
// [lon, lat] → [x, y] en canvas
let W, H;
function proj(lon, lat){
  return [
    (lon + 180) / 360 * W,
    (90  - lat) / 180 * H
  ];
}

// ── Contornos continentales en [lon, lat] ──────────────────
const LAND = [
  // América del Norte
  [[-168,60],[-165,63],[-162,65],[-158,68],[-152,70],[-145,70],[-138,60],
   [-132,55],[-125,50],[-124,48],[-124,40],[-120,35],[-117,33],[-112,29],
   [-106,24],[-97,20],[-90,16],[-83,10],[-78,8],[-75,10],[-77,20],
   [-80,25],[-82,30],[-80,35],[-75,38],[-70,42],[-66,45],[-60,47],
   [-64,50],[-66,55],[-70,58],[-72,63],[-78,66],[-84,70],[-92,72],
   [-100,72],[-110,72],[-120,70],[-132,68],[-142,65],[-152,62],[-160,60],[-168,60]],
  // Groenlandia
  [[-45,60],[-42,65],[-38,70],[-22,75],[-18,78],[-25,82],[-42,84],
   [-55,82],[-63,78],[-66,74],[-60,68],[-52,62],[-45,60]],
  // América del Sur
  [[-80,10],[-77,8],[-76,2],[-70,-2],[-50,-2],[-44,-4],
   [-35,-8],[-38,-12],[-40,-18],[-42,-22],[-45,-24],[-48,-28],
   [-52,-33],[-58,-38],[-62,-42],[-66,-48],[-68,-54],[-70,-58],
   [-75,-55],[-72,-50],[-72,-45],[-70,-38],[-72,-33],[-72,-28],
   [-70,-22],[-72,-15],[-76,-10],[-78,-4],[-80,2],[-80,10]],
  // Europa occidental
  [[-10,36],[-6,37],[-2,36],[2,43],[5,48],[8,48],[12,45],[14,40],
   [16,38],[20,38],[24,38],[28,41],[32,41],[36,42],[28,46],[24,50],
   [20,54],[18,58],[20,62],[24,66],[28,68],[25,70],[18,68],[12,64],
   [6,58],[0,54],[-5,52],[-10,44],[-10,36]],
  // Escandinavia
  [[5,58],[8,58],[10,62],[14,66],[18,70],[22,70],[26,68],[28,66],
   [24,63],[20,58],[14,57],[8,57],[5,58]],
  // África
  [[-18,16],[-16,12],[-12,8],[-8,5],[-5,5],[0,5],[5,5],[10,4],
   [15,2],[22,2],[26,0],[32,-2],[36,-5],[40,-10],[42,-14],[40,-18],
   [36,-22],[32,-26],[28,-30],[26,-34],[20,-36],[18,-34],[16,-30],
   [14,-24],[12,-18],[10,-12],[8,-5],[4,0],[0,5],[-2,12],
   [-5,16],[-8,16],[-12,18],[-16,18],[-18,16]],
  // Peninsula Arabica
  [[35,30],[38,32],[42,30],[48,28],[55,24],[58,20],[55,16],[50,12],
   [45,12],[42,14],[38,16],[35,20],[34,26],[35,30]],
  // Asia continental
  [[28,40],[34,44],[38,46],[44,48],[50,52],[56,56],[62,60],[68,62],
   [76,66],[88,70],[100,72],[112,70],[122,68],[132,66],[138,62],
   [142,58],[142,52],[140,46],[136,40],[130,35],[126,30],[120,24],
   [116,20],[112,18],[106,14],[102,10],[98,8],[96,10],[90,12],
   [85,16],[80,18],[76,22],[72,22],[68,24],[62,24],[58,20],[55,24],
   [52,28],[48,32],[44,36],[40,36],[34,36],[28,40]],
  // India
  [[68,24],[72,22],[76,18],[80,14],[80,10],[78,8],[76,10],
   [74,14],[72,18],[68,22],[68,24]],
  // Indochina / SE Asia
  [[100,20],[102,18],[104,14],[106,10],[104,4],[100,2],[102,0],
   [106,2],[108,6],[112,10],[114,14],[110,18],[106,20],[102,22],[100,20]],
  // Japón (Honshu)
  [[130,31],[132,33],[134,35],[136,36],[138,38],[140,40],[142,42],[140,44],
   [138,42],[136,38],[134,35],[132,33],[130,31]],
  // Australia
  [[114,-22],[118,-20],[122,-16],[126,-14],[130,-12],[136,-12],
   [140,-14],[144,-18],[148,-22],[152,-24],[152,-28],[150,-32],
   [148,-38],[144,-38],[140,-36],[136,-34],[130,-32],[126,-34],
   [122,-34],[116,-30],[114,-26],[114,-22]],
  // Nueva Zelanda (Isla Sur)
  [[166,-46],[168,-44],[170,-42],[172,-40],[174,-36],[172,-36],
   [170,-38],[168,-40],[166,-44],[166,-46]],
  // Islandia
  [[-24,64],[-20,66],[-14,66],[-12,64],[-14,62],[-20,62],[-24,64]],
];

// ── Ciudades con lat/lon reales ────────────────────────────
const CITIES = [
  {lon:-74.1, lat:4.7,   l:'BOG'},
  {lon:-73.9, lat:40.7,  l:'NYC'},
  {lon:-99.1, lat:19.4,  l:'MEX'},
  {lon:-46.6, lat:-23.5, l:'SAO'},
  {lon:-0.1,  lat:51.5,  l:'LON'},
  {lon:2.3,   lat:48.9,  l:'PAR'},
  {lon:13.4,  lat:52.5,  l:'BER'},
  {lon:28.9,  lat:41.0,  l:'IST'},
  {lon:37.6,  lat:55.8,  l:'MOS'},
  {lon:31.2,  lat:30.0,  l:'CAI'},
  {lon:36.8,  lat:-1.3,  l:'NAI'},
  {lon:18.4,  lat:-33.9, l:'CPT'},
  {lon:55.3,  lat:25.2,  l:'DXB'},
  {lon:72.8,  lat:19.1,  l:'MUM'},
  {lon:77.2,  lat:28.6,  l:'DEL'},
  {lon:116.4, lat:39.9,  l:'BEI'},
  {lon:121.5, lat:31.2,  l:'SHA'},
  {lon:139.7, lat:35.7,  l:'TOK'},
  {lon:151.2, lat:-33.9, l:'SYD'},
  {lon:-122.4,lat:37.8,  l:'SFO'},
  {lon:-87.6, lat:41.9,  l:'CHI'},
  {lon:106.8, lat:10.8,  l:'SGN'},
  {lon:103.8, lat:1.3,   l:'SIN'},
  {lon:88.4,  lat:22.6,  l:'KOL'},
  {lon:-75.56,lat:6.25,  l:'MED'} // Medellín, Colombia, added!
];

// Rutas aéreas principales
const ROUTES = [
  [0,4],[4,5],[5,6],[6,1],[1,2],[0,3],[4,8],[8,7],[7,9],[9,10],
  [10,11],[4,14],[14,13],[13,15],[15,16],[16,17],[17,18],[18,22],
  [22,23],[5,12],[12,14],[8,14],[0,20],[20,19],[17,15],[4,7],
  [3,4],[1,5],[15,17],[9,13],[0,24] // Bogotá to Medellín airway route!
];

// ── Partículas ─────────────────────────────────────────────
let particles = [];
let animFrame, pulse = 0;

function buildParticles(){
  particles = [];
  for(let i=0;i<60;i++){
    particles.push({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.2+0.3,
      vx:(Math.random()-.5)*0.15,
      vy:(Math.random()-.5)*0.15,
      a:Math.random()*0.35+0.08
    });
  }
}

function resize(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildParticles();
}

// ── Dibujo ─────────────────────────────────────────────────
function drawFrame(){
  pulse += 0.018;
  ctx.clearRect(0,0,W,H);

  // Fondo degradado
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#040c1e');
  bg.addColorStop(0.5,'#060f26');
  bg.addColorStop(1,'#050c1c');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Glow radial superior (azul)
  const gTop = ctx.createRadialGradient(W*.5,0,0,W*.5,0,W*.55);
  gTop.addColorStop(0,'rgba(80,159,255,0.12)');
  gTop.addColorStop(1,'transparent');
  ctx.fillStyle = gTop; ctx.fillRect(0,0,W,H);

  // Glow inferior derecho (muy sutil y azulado, ya no morado)
  const gBot = ctx.createRadialGradient(W*.85,H*.85,0,W*.85,H*.85,W*.35);
  gBot.addColorStop(0,'rgba(80,159,255,0.03)');
  gBot.addColorStop(1,'transparent');
  ctx.fillStyle = gBot; ctx.fillRect(0,0,W,H);

  // ── Continentes ──────────────────────────────────────────
  ctx.save();
  LAND.forEach(pts => {
    ctx.beginPath();
    pts.forEach(([lon,lat],i)=>{
      const [x,y] = proj(lon,lat);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    // Relleno sutil
    const fill = ctx.createLinearGradient(0,0,W,H);
    fill.addColorStop(0,'rgba(30,80,200,0.09)');
    fill.addColorStop(1,'rgba(20,60,160,0.05)');
    ctx.fillStyle = fill;
    ctx.fill();
    // Borde brillante
    ctx.strokeStyle = 'rgba(60,140,255,0.30)';
    ctx.lineWidth   = 0.9;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  });
  ctx.restore();

  // ── Rutas aéreas animadas ────────────────────────────────
  ctx.save();
  ROUTES.forEach(([a,b])=>{
    const ca=CITIES[a], cb=CITIES[b];
    if(!ca||!cb) return;
    const [x1,y1]=proj(ca.lon,ca.lat);
    const [x2,y2]=proj(cb.lon,cb.lat);
    // Curva bezier que arquea sobre el mapa
    const mx=(x1+x2)/2, my=(y1+y2)/2 - Math.abs(x2-x1)*0.14;
    const g=ctx.createLinearGradient(x1,y1,x2,y2);
    g.addColorStop(0,'rgba(80,160,255,0.04)');
    g.addColorStop(0.5,'rgba(120,200,255,0.18)');
    g.addColorStop(1,'rgba(80,160,255,0.04)');
    ctx.strokeStyle=g;
    ctx.lineWidth=0.8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.quadraticCurveTo(mx,my,x2,y2);
    ctx.stroke();

    // Punto viajero animado a lo largo de la curva
    const t=((pulse*0.3+a*0.37+b*0.17) % 1);
    const ex=Math.pow(1-t,2)*x1+2*(1-t)*t*mx+t*t*x2;
    const ey=Math.pow(1-t,2)*y1+2*(1-t)*t*my+t*t*y2;
    ctx.fillStyle='rgba(150,210,255,0.75)';
    ctx.beginPath();
    ctx.arc(ex,ey,1.4,0,Math.PI*2);
    ctx.fill();
  });
  ctx.setLineDash([]);
  ctx.restore();

  // ── Ciudades ─────────────────────────────────────────────
  ctx.save();
  const pulseFactor = 0.6+Math.sin(pulse)*0.4;
  CITIES.forEach((c,i)=>{
    const [px,py]=proj(c.lon,c.lat);
    const phase=Math.sin(pulse+i*0.9)*0.5+0.5;

    // Halo exterior pulsante
    const halo=ctx.createRadialGradient(px,py,0,px,py,10+phase*4);
    halo.addColorStop(0,`rgba(80,170,255,${0.18*phase})`);
    halo.addColorStop(1,'transparent');
    ctx.fillStyle=halo;
    ctx.beginPath(); ctx.arc(px,py,14,0,Math.PI*2); ctx.fill();

    // Anillo exterior
    ctx.strokeStyle=`rgba(80,160,255,${0.25+phase*0.15})`;
    ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.arc(px,py,5+phase*1.5,0,Math.PI*2); ctx.stroke();

    // Anillo interior
    ctx.strokeStyle=`rgba(140,210,255,${0.4+phase*0.2})`;
    ctx.lineWidth=0.7;
    ctx.beginPath(); ctx.arc(px,py,2.8,0,Math.PI*2); ctx.stroke();

    // Punto central
    ctx.fillStyle=`rgba(200,235,255,${0.7+phase*0.3})`;
    ctx.beginPath(); ctx.arc(px,py,1.4,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();

  // ── Cuadrícula de latitud/longitud ───────────────────────
  ctx.save();
  ctx.strokeStyle='rgba(40,100,200,0.06)';
  ctx.lineWidth=0.5;
  for(let lat=-60;lat<=80;lat+=30){
    const [,y]=proj(0,lat);
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  for(let lon=-150;lon<=180;lon+=30){
    const [x,]=proj(lon,0);
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  ctx.restore();

  // ── Partículas flotantes ──────────────────────────────────
  particles.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy;
    if(p.x<0)p.x=W; if(p.x>W)p.x=0;
    if(p.y<0)p.y=H; if(p.y>H)p.y=0;
    ctx.fillStyle=`rgba(100,175,255,${p.a})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  });

  animFrame=requestAnimationFrame(drawFrame);
}

window.addEventListener('resize',()=>{cancelAnimationFrame(animFrame);resize();drawFrame();});
resize();
drawFrame();
