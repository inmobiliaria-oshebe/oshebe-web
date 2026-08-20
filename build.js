/*
 * build.js — Generador estático de Inmobiliaria Oshebe (sin dependencias).
 * Netlify lo ejecuta con "node build.js" y publica la carpeta dist/.
 * Lee los inmuebles de data/inmuebles/*.json y genera:
 *   dist/index.html               (portada con las tarjetas)
 *   dist/inmueble-<ref>.html      (una página por inmueble, con enlace para WhatsApp)
 * Copia assets/ e img/ a dist/.
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://oshebe.netlify.app'; // cambiar cuando haya dominio propio
const WA_NUMBER = '573023350442';
const EMAIL = 'inmobiliariaoshebe@gmail.com';
const WA_GENERIC = waLink('Hola Oshebe, quiero información de inmuebles en Santa Marta');
const WA_VENDER = waLink('Hola Oshebe, quiero vender o arrendar mi inmueble en Santa Marta. ¿Me pueden asesorar?');
function mailLink(subject){ return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject); }
const ZONAS = ['El Rodadero','Bello Horizonte','Pozos Colorados','Centro Histórico','Gaira','Mamatoco','Bavaria','Ciudad del Sol','Irotama','Taganga','Minca'];
const TIPOS = ['Casa','Apartamento','Apartaestudio','Local','Oficina','Bodega','Lote','Finca'];

const SRC = __dirname;
const OUT = path.join(SRC, 'dist');

// ---------- helpers ----------
function esc(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function waLink(text){ return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }

function fmtPrecio(n, operacion){
  if(n == null || n === '') return 'Consultar precio';
  const s = '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return operacion === 'arriendo' ? s + ' <small>/mes</small>' : s;
}
function fmtPrecioPlano(n){
  if(n == null || n === '') return 'Consultar precio';
  return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// mini-markdown: escapa, **negrita**, párrafos por línea en blanco
function mdToHtml(text){
  if(!text) return '';
  return String(text).split(/\n\s*\n/).map(function(par){
    let p = esc(par.trim()).replace(/\r/g,'');
    p = p.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    p = p.replace(/\n/g, ' ');
    return '<p>' + p + '</p>';
  }).join('\n');
}

function ytId(url){
  if(!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : '';
}

const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>';

// ---------- estilos ----------
const CSS_ROOT = `
  :root{
    --bg:#FBFAF6; --surface:#FFFFFF; --surface-2:#F4F1E9;
    --ink:#16233C; --muted:#5A6579; --line:#E6E1D4;
    --navy:#16294D; --navy-2:#26426F; --gold:#C6982F; --gold-2:#E0BC66;
    --accent:#16294D; --btn-bg:#1E56D6; --btn-text:#FFFFFF;
    --shadow:0 1px 2px rgba(22,41,77,.06), 0 12px 34px rgba(22,41,77,.10);
    --radius:16px; --maxw:1160px;
    --sans:'Figtree',system-ui,-apple-system,Segoe UI,sans-serif;
    --serif:'Fraunces',Georgia,'Times New Roman',serif;
  }
  :root:not([data-theme="light"]){ @media (prefers-color-scheme: dark){
    --bg:#0C1526; --surface:#12203A; --surface-2:#172845;
    --ink:#ECE8DD; --muted:#9AA6BD; --line:#27395C;
    --navy:#335792; --navy-2:#4368A6; --gold:#D8AC43; --gold-2:#EBC978;
    --accent:#E0BC66; --btn-bg:#3B74F0; --btn-text:#FFFFFF;
    --shadow:0 1px 2px rgba(0,0,0,.45), 0 16px 44px rgba(0,0,0,.5);
  }}
  :root[data-theme="dark"]{
    --bg:#0C1526; --surface:#12203A; --surface-2:#172845;
    --ink:#ECE8DD; --muted:#9AA6BD; --line:#27395C;
    --navy:#335792; --navy-2:#4368A6; --gold:#D8AC43; --gold-2:#EBC978;
    --accent:#E0BC66; --btn-bg:#3B74F0; --btn-text:#FFFFFF;
    --shadow:0 1px 2px rgba(0,0,0,.45), 0 16px 44px rgba(0,0,0,.5);
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:17px; line-height:1.6; -webkit-font-smoothing:antialiased}
  .wrap{max-width:var(--maxw); margin-inline:auto; padding-inline:22px}
  h1,h2,h3{font-family:var(--serif); font-weight:600; line-height:1.08; text-wrap:balance; margin:0}
  a{color:inherit; text-decoration:none}
  .eyebrow{font-size:.78rem; letter-spacing:.18em; text-transform:uppercase; color:var(--accent); font-weight:700}
  .mark{width:58px; height:58px; flex:none; object-fit:contain}
  .wordmark-stack{display:flex; flex-direction:column; gap:2px; line-height:1}
  .pre{font-family:var(--sans); font-size:.62rem; font-weight:700; letter-spacing:.32em; color:var(--navy)}
  :root:not([data-theme="light"]) .pre{color:var(--ink)}
  .wordmark{font-family:var(--serif); font-size:1.5rem; font-weight:700; letter-spacing:.04em; line-height:1}
  .wordmark .g{color:var(--gold)} .wordmark .n{color:var(--navy)}
  :root:not([data-theme="light"]) .wordmark .n{color:var(--ink)}
  header.nav{position:sticky; top:0; z-index:50; background:color-mix(in srgb,var(--bg) 88%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line)}
  .nav-in{display:flex; align-items:center; gap:20px; height:80px}
  .brand{display:flex; align-items:center; gap:11px}
  .nav-links{display:flex; gap:26px; margin-left:auto; font-size:.95rem; font-weight:600}
  .nav-links a{color:var(--muted)} .nav-links a:hover{color:var(--ink)}
  .btn{display:inline-flex; align-items:center; justify-content:center; gap:8px; border:0; cursor:pointer; font-family:var(--sans); font-weight:700; font-size:.95rem; padding:11px 19px; border-radius:999px; transition:.18s}
  .btn-wa{background:var(--btn-bg); color:var(--btn-text)}
  .btn-wa:hover{filter:brightness(1.06); transform:translateY(-1px)}
  .btn-ghost{background:transparent; color:var(--navy); border:1.5px solid var(--line)}
  :root:not([data-theme="light"]) .btn-ghost{color:var(--ink)}
  .btn-ghost:hover{border-color:var(--gold)}
  @media(max-width:820px){ .nav-links{display:none} }
`;

const CSS_INDEX = CSS_ROOT + `
  .hero{padding:56px 0 40px}
  .hero-grid{display:grid; grid-template-columns:1.05fr .95fr; gap:44px; align-items:center}
  .hero h1{font-size:clamp(2.4rem,5vw,3.7rem); letter-spacing:-.01em}
  .hero h1 em{font-style:italic; color:var(--gold)}
  .lead{font-size:1.12rem; color:var(--muted); margin:20px 0 26px; max-width:46ch}
  .hero-cta{display:flex; gap:12px; flex-wrap:wrap}
  .stats{display:flex; gap:30px; margin-top:34px; padding-top:26px; border-top:1px solid var(--line)}
  .stat b{font-family:var(--serif); font-size:1.7rem; display:block; line-height:1; color:var(--navy)}
  :root:not([data-theme="light"]) .stat b{color:var(--ink)}
  .stat span{font-size:.82rem; color:var(--muted)}
  .photo{position:relative; border-radius:14px; overflow:hidden; background:#0d2440}
  .photo::after{content:attr(data-loc); position:absolute; left:12px; bottom:10px; font-size:.74rem; font-weight:700; color:#fff; background:rgba(11,21,38,.6); padding:4px 9px; border-radius:999px; backdrop-filter:blur(3px)}
  .sc1{background:linear-gradient(180deg,#9fd0e6 0%,#4f97cf 42%,#153f6f 100%)}
  .sc2{background:linear-gradient(180deg,#ffd9a8 0%,#e0a860 45%,#9c6a2e 100%)}
  .sc6{background:linear-gradient(180deg,#c9d8e4 0%,#8aa0bf 50%,#33456b 100%)}
  .photo .sun{position:absolute; width:60px; height:60px; border-radius:50%; background:radial-gradient(circle,#fff,rgba(255,255,255,.12)); top:20%; right:20%; filter:blur(2px); opacity:.85}
  .photo .ridge{position:absolute; inset:auto 0 0 0; height:40%; background:linear-gradient(180deg,transparent,rgba(11,21,38,.32))}
  .collage{display:grid; grid-template-columns:1fr 1fr; grid-template-rows:200px 150px; gap:14px}
  .collage .photo:nth-child(1){grid-row:1/3; height:100%}
  .collage .photo:nth-child(2){height:200px}
  .collage .photo:nth-child(3){height:150px}
  /* HERO con collage de fondo */
  .hero-bg{position:relative; padding:0; min-height:560px; display:flex; align-items:center; overflow:hidden}
  .hero-collage{position:absolute; inset:0; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; z-index:0}
  .hero-collage>div{background-size:cover; background-position:center}
  .hero-overlay{position:absolute; inset:0; z-index:1; background:linear-gradient(100deg, rgba(9,17,32,.90) 0%, rgba(9,17,32,.70) 42%, rgba(9,17,32,.45) 100%)}
  .hero-content{position:relative; z-index:2; padding-block:66px}
  .hero-content h1{color:#fff}
  .hero-content h1 em{color:var(--gold-2)}
  .hero-content .lead{color:rgba(255,255,255,.92); max-width:50ch}
  .eyebrow.light{color:var(--gold-2)}
  .btn-ghost-light{background:rgba(255,255,255,.12); color:#fff; border:1.5px solid rgba(255,255,255,.55)}
  .btn-ghost-light:hover{border-color:var(--gold-2); background:rgba(255,255,255,.2)}
  .stats-light{border-top-color:rgba(255,255,255,.25)}
  .stats-light .stat b{color:#fff}
  .stats-light .stat span{color:rgba(255,255,255,.82)}
  @media(max-width:820px){ .hero-grid{grid-template-columns:1fr} .collage{grid-template-rows:160px 120px} .hero-bg{min-height:500px} .hero-content{padding-block:48px} }
  section{padding:56px 0}
  .sec-head{display:flex; justify-content:space-between; align-items:end; gap:20px; margin-bottom:30px}
  .sec-head h2{font-size:clamp(1.8rem,3.6vw,2.5rem)}
  .sec-head p{color:var(--muted); margin:8px 0 0; max-width:52ch}
  .grid{display:grid; grid-template-columns:repeat(3,1fr); gap:24px}
  @media(max-width:900px){ .grid{grid-template-columns:1fr 1fr} }
  @media(max-width:600px){ .grid{grid-template-columns:1fr} }
  .card{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow); transition:.2s; display:flex; flex-direction:column}
  .card:hover{transform:translateY(-4px); border-color:var(--gold)}
  .card .photo{height:210px; border-radius:0}
  .card-tags{position:absolute; top:12px; left:12px; display:flex; gap:7px; z-index:2}
  .tag{font-size:.72rem; font-weight:800; letter-spacing:.03em; padding:5px 10px; border-radius:999px}
  .tag-venta{background:var(--navy); color:#fff} .tag-arriendo{background:var(--gold); color:#16294D}
  .tag-video{position:absolute; top:12px; right:12px; background:rgba(11,21,38,.62); color:#fff; font-size:.72rem; font-weight:700; padding:5px 10px; border-radius:999px; display:flex; align-items:center; gap:5px; z-index:2; backdrop-filter:blur(3px)}
  .card-body{padding:16px 18px 18px; display:flex; flex-direction:column; gap:10px; flex:1}
  .price{font-family:var(--serif); font-size:1.4rem; font-weight:700; color:var(--accent)}
  .price small{font-family:var(--sans); font-size:.8rem; font-weight:600; color:var(--muted)}
  .card h3{font-size:1.12rem; font-weight:600}
  .loc{font-size:.9rem; color:var(--muted); display:flex; align-items:center; gap:6px}
  .specs{display:flex; gap:16px; font-size:.88rem; color:var(--muted); font-weight:600}
  .specs span{display:flex; align-items:center; gap:6px}
  .ico{width:16px; height:16px; stroke:var(--gold); fill:none; stroke-width:1.7}
  .card-actions{display:flex; gap:8px; margin-top:auto; padding-top:14px; border-top:1px solid var(--line)}
  .btn-sm{flex:1; padding:9px 12px; font-size:.85rem; border-radius:10px}
  .btn-navy{background:var(--navy); color:#fff} .btn-navy:hover{background:var(--navy-2)}
  :root:not([data-theme="light"]) .btn-navy{color:#fff}
  .btn-share{background:transparent; border:1.5px solid var(--line); color:var(--ink); padding:9px 12px; border-radius:10px; display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:.85rem; cursor:pointer}
  .btn-share:hover{border-color:var(--gold)}
  .band{background:var(--surface-2); border-block:1px solid var(--line)}
  .zones{display:flex; flex-wrap:wrap; gap:12px}
  .chip{background:var(--surface); border:1px solid var(--line); padding:10px 18px; border-radius:999px; font-weight:600; font-size:.95rem; cursor:pointer; transition:.16s}
  .chip:hover{background:var(--navy); color:#fff; border-color:var(--navy)}
  .trust{display:grid; grid-template-columns:repeat(3,1fr); gap:30px}
  @media(max-width:760px){ .trust{grid-template-columns:1fr} }
  .trust .item h3{font-size:1.2rem; margin-bottom:6px}
  .trust .item p{color:var(--muted); margin:0; font-size:.96rem}
  .trust .num{font-family:var(--serif); font-size:1.7rem; color:var(--gold); display:block; margin-bottom:6px; font-weight:700}
  .cta-band{background:linear-gradient(135deg,var(--navy),#0c1c38); color:#fff; border-radius:22px; padding:48px; text-align:center; margin:20px 0; position:relative; overflow:hidden}
  .cta-band::before{content:""; position:absolute; inset:0; background:radial-gradient(circle at 85% 20%, rgba(216,172,67,.22), transparent 45%)}
  .cta-band h2{color:#fff; font-size:clamp(1.7rem,3.5vw,2.4rem); position:relative}
  .cta-band p{color:rgba(255,255,255,.85); max-width:48ch; margin:12px auto 24px; position:relative}
  .cta-band .btn{position:relative}
  footer{border-top:1px solid var(--line); padding:44px 0 30px; color:var(--muted); font-size:.92rem}
  footer .mark{width:50px; height:50px}
  .foot-grid{display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:30px; margin-bottom:28px}
  @media(max-width:700px){ .foot-grid{grid-template-columns:1fr} }
  footer h4{font-family:var(--sans); font-size:.78rem; text-transform:uppercase; letter-spacing:.12em; color:var(--ink); margin:0 0 12px}
  footer a{display:block; margin-bottom:7px}
  footer a:hover{color:var(--accent)}
  .foot-bottom{border-top:1px solid var(--line); padding-top:18px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; font-size:.85rem}
  .card .photo.real{background-size:cover;background-position:center}
  .card-photo-link{display:block}
  .card.soon{display:grid;place-items:center;text-align:center;padding:26px;background:var(--surface-2);border-style:dashed}
  .soon-ic{font-size:2rem;margin-bottom:8px} .card.soon h3{font-size:1.15rem;margin-bottom:8px} .card.soon p{color:var(--muted);font-size:.92rem;margin:0 0 16px}
  .card .tag-tipo{position:absolute; top:12px; right:12px; background:rgba(11,21,38,.62); color:#fff; font-size:.72rem; font-weight:700; padding:5px 10px; border-radius:999px; z-index:2; backdrop-filter:blur(3px)}

  /* FILTER BAR */
  .filterbar{background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:var(--shadow); padding:12px; display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:28px}
  .filterbar .field{padding:6px 12px}
  .filterbar .field+.field{border-left:1px solid var(--line)}
  .filterbar label{display:block; font-size:.66rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-weight:700; margin-bottom:3px}
  .filterbar select{width:100%; border:0; background:transparent; color:var(--ink); font-family:var(--sans); font-size:.98rem; font-weight:600; padding:2px 0}
  .filterbar select:focus{outline:none}
  @media(max-width:820px){ .filterbar{grid-template-columns:1fr 1fr} .filterbar .field+.field{border-left:0} }
  .nores{display:none; text-align:center; color:var(--muted); background:var(--surface-2); border:1px dashed var(--line); border-radius:12px; padding:30px; grid-column:1/-1}
  .nores a{color:var(--accent); font-weight:700}

  /* ABOUT */
  .about-grid{display:grid; grid-template-columns:1fr 1.05fr; gap:44px; align-items:center}
  @media(max-width:820px){ .about-grid{grid-template-columns:1fr} }
  .about-photo{border-radius:var(--radius); box-shadow:var(--shadow); aspect-ratio:4/3; background-size:cover; background-position:center; min-height:260px; position:relative; overflow:hidden}
  .about-photo::after{content:""; position:absolute; inset:0; background:linear-gradient(180deg,transparent 55%,rgba(11,21,38,.35))}
  .about h2{font-size:clamp(1.8rem,3.6vw,2.5rem); margin-bottom:16px}
  .about .lead{margin:0 0 22px}
  .values{display:grid; grid-template-columns:1fr 1fr; gap:14px}
  @media(max-width:520px){ .values{grid-template-columns:1fr} }
  .value{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:16px}
  .value .vic{font-size:1.5rem; line-height:1} .value h4{font-family:var(--serif); font-size:1.02rem; margin:8px 0 4px} .value p{margin:0; font-size:.88rem; color:var(--muted)}

  /* CONTACT */
  .contact-grid{display:grid; grid-template-columns:1fr 1fr; gap:34px; align-items:center}
  @media(max-width:760px){ .contact-grid{grid-template-columns:1fr} }
  .contact-cta{display:flex; gap:12px; flex-wrap:wrap; margin-top:20px}
  .btn-mail{background:transparent; color:var(--ink); border:1.5px solid var(--line)}
  :root:not([data-theme="light"]) .btn-mail{color:var(--ink)}
  .btn-mail:hover{border-color:var(--gold)}
  .contact-info{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:10px 24px; box-shadow:var(--shadow)}
  .contact-info a, .contact-info div{display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid var(--line); font-weight:600; color:var(--ink)}
  .contact-info a:last-child, .contact-info div:last-child{border-bottom:0}
  .contact-info a:hover{color:var(--accent)}
  .contact-info .ci{font-size:1.25rem; width:26px; text-align:center}
`;

const CSS_FICHA = CSS_ROOT + `
  .nav-cta{margin-left:auto}
  .back{display:inline-flex; align-items:center; gap:7px; color:var(--muted); font-weight:600; font-size:.92rem; margin:22px 0 6px}
  .back:hover{color:var(--accent)}
  main.wrap{max-width:1080px}
  .head{display:flex; justify-content:space-between; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:18px}
  .tags{display:flex; gap:8px; margin-bottom:12px}
  .tag{font-size:.74rem; font-weight:800; letter-spacing:.03em; padding:5px 11px; border-radius:999px}
  .tag-venta{background:var(--navy); color:#fff} .tag-arriendo{background:var(--gold); color:#16294D}
  .tag-ref{background:var(--surface-2); color:var(--muted); border:1px solid var(--line)}
  .head h1{font-size:clamp(1.7rem,3.6vw,2.5rem)}
  .head .loc{color:var(--muted); margin-top:8px; display:flex; align-items:center; gap:7px; font-size:1rem}
  .price-box{text-align:right}
  .price{font-family:var(--serif); font-size:clamp(1.6rem,3.4vw,2.2rem); font-weight:700; color:var(--accent); white-space:nowrap}
  .admin{font-size:.86rem; color:var(--muted)}
  .gallery{margin:8px 0 30px}
  .gmain{position:relative; border-radius:var(--radius); overflow:hidden; background:#0d1a30; aspect-ratio:16/10; box-shadow:var(--shadow); cursor:zoom-in}
  .gmain img{width:100%; height:100%; object-fit:cover; display:block}
  .gcap{position:absolute; left:0; bottom:0; right:0; padding:16px 16px 12px; background:linear-gradient(transparent,rgba(9,18,34,.72)); color:#fff; font-weight:600; font-size:.92rem; display:flex; justify-content:space-between; align-items:flex-end; gap:10px}
  .gcount{background:rgba(9,18,34,.6); padding:3px 10px; border-radius:999px; font-size:.8rem; backdrop-filter:blur(3px); white-space:nowrap}
  .garrow{position:absolute; top:50%; transform:translateY(-50%); width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.9); border:0; cursor:pointer; display:grid; place-items:center; box-shadow:0 4px 14px rgba(0,0,0,.25); z-index:2; color:#16294D}
  .garrow:hover{background:#fff} .gprev{left:14px} .gnext{right:14px}
  .thumbs{display:flex; gap:9px; margin-top:12px; overflow-x:auto; padding-bottom:6px; scrollbar-width:thin}
  .thumbs img{width:104px; height:70px; object-fit:cover; border-radius:9px; cursor:pointer; flex:none; border:2px solid transparent; opacity:.72; transition:.15s}
  .thumbs img:hover{opacity:1}
  .thumbs img.active{border-color:var(--gold); opacity:1}
  .lb{position:fixed; inset:0; background:rgba(7,13,24,.94); z-index:100; display:none; align-items:center; justify-content:center}
  .lb.open{display:flex}
  .lb img{max-width:94vw; max-height:86vh; object-fit:contain; border-radius:8px}
  .lb .lbcap{position:absolute; bottom:22px; left:0; right:0; text-align:center; color:#fff; font-weight:600; font-size:.95rem}
  .lb .lbclose{position:absolute; top:18px; right:22px; width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.14); color:#fff; border:0; font-size:1.4rem; cursor:pointer}
  .lb .lbarrow{position:absolute; top:50%; transform:translateY(-50%); width:52px; height:52px; border-radius:50%; background:rgba(255,255,255,.14); color:#fff; border:0; cursor:pointer; font-size:1.5rem}
  .lb .lbprev{left:18px} .lb .lbnext{right:18px}
  .cols{display:grid; grid-template-columns:1fr 320px; gap:34px; align-items:start}
  @media(max-width:860px){ .cols{grid-template-columns:1fr} }
  .specrow{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:6px 0 30px}
  @media(max-width:520px){ .specrow{grid-template-columns:repeat(2,1fr)} }
  .spec{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:14px 16px; display:flex; align-items:center; gap:12px}
  .spec svg{width:22px; height:22px; stroke:var(--gold); fill:none; stroke-width:1.7; flex:none}
  .spec b{font-family:var(--serif); font-size:1.15rem; display:block; line-height:1.1}
  .spec span{font-size:.8rem; color:var(--muted)}
  section.blk{margin-bottom:34px}
  section.blk h2{font-size:1.35rem; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--line)}
  .desc p{margin:0 0 14px; color:var(--ink)}
  .feat{display:grid; grid-template-columns:1fr 1fr; gap:9px 18px}
  @media(max-width:520px){ .feat{grid-template-columns:1fr} }
  .feat div{display:flex; align-items:center; gap:9px; font-size:.95rem; color:var(--ink)}
  .feat svg{width:16px; height:16px; stroke:var(--gold); fill:none; stroke-width:2; flex:none}
  .videowrap{aspect-ratio:16/9; border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow); background:#000}
  .videowrap iframe{width:100%; height:100%; border:0; display:block}
  .side{position:sticky; top:90px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:22px; box-shadow:var(--shadow)}
  .side .price{text-align:left; font-size:1.7rem; margin-bottom:4px}
  .side .admin{margin-bottom:16px}
  .side .btn{width:100%; margin-bottom:10px; padding:13px}
  .side .btn-share{background:transparent; border:1.5px solid var(--line); color:var(--ink)}
  .side .btn-share:hover{border-color:var(--gold)}
  .side .agent{margin-top:16px; padding-top:16px; border-top:1px solid var(--line); font-size:.88rem; color:var(--muted)}
  .side .agent b{color:var(--ink); font-family:var(--serif); font-size:1rem}
  footer{border-top:1px solid var(--line); padding:34px 0; color:var(--muted); font-size:.9rem; text-align:center; margin-top:20px}
  .toast{position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--navy); color:#fff; padding:11px 20px; border-radius:999px; font-weight:600; font-size:.9rem; opacity:0; transition:.25s; pointer-events:none; z-index:120}
  .toast.show{opacity:1}
`;

const WA_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.6.2.4.8 1.3 1.7 2 .6.6 1.2.8 1.5 1 .2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.9c.2.1.4.2.5.3.1.2.1.9-.1 1.4z"/></svg>';

const brandMark = '<img class="mark" src="/assets/emblema.png" alt="Inmobiliaria Oshebe" width="58" height="58">';
const wordmark = '<span class="wordmark-stack"><span class="pre">INMOBILIARIA</span><span class="wordmark"><span class="g">OSH</span><span class="n">EBE</span></span></span>';

function head(opts){
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.desc)}">
<link rel="canonical" href="${esc(opts.url)}">
<meta property="og:type" content="${opts.ogType || 'website'}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.desc)}">
<meta property="og:image" content="${esc(opts.image)}">
<meta property="og:url" content="${esc(opts.url)}">
<meta property="og:locale" content="es_CO">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/emblema.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Figtree:wght@400;500;600;700&display=swap">
<style>${opts.css}</style>
</head>`;
}

// ---------- tarjeta de la portada ----------
function card(p){
  const foto = (p.fotos && p.fotos[0] && p.fotos[0].imagen) || '';
  const href = 'inmueble-' + p.ref + '.html';
  const tagCls = p.operacion === 'arriendo' ? 'tag-arriendo' : 'tag-venta';
  const tagTxt = p.operacion === 'arriendo' ? 'Arriendo' : 'Venta';
  const videoBadge = ytId(p.video_youtube) ? '<div class="tag-video">▶ Video</div>' : '';
  const specs = [];
  if(p.habitaciones != null && p.habitaciones !== '') specs.push('<span><svg class="ico" viewBox="0 0 24 24"><path d="M3 12h18M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M4 18h16M6 18v2M18 18v2"/></svg> ' + esc(p.habitaciones) + ' hab</span>');
  if(p.banos != null && p.banos !== '') specs.push('<span><svg class="ico" viewBox="0 0 24 24"><path d="M5 11V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2M4 11h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/></svg> ' + esc(p.banos) + ' baños</span>');
  if(p.area_m2 != null && p.area_m2 !== '') specs.push('<span><svg class="ico" viewBox="0 0 24 24"><path d="M3 3h18v18H3zM3 9h18M9 3v18"/></svg> ' + esc(p.area_m2) + ' m²</span>');
  const tipo = p.tipo || '';
  const zona = p.zona || '';
  const loc = [p.sector, p.ciudad].filter(Boolean).join(' · ');
  const locLine = [tipo, loc].filter(Boolean).join(' · ');
  const tipoTag = tipo ? '<span class="tag-tipo">' + esc(tipo) + '</span>' : '';
  return `        <article class="card" data-op="${esc(p.operacion || '')}" data-tipo="${esc(tipo)}" data-zona="${esc(zona)}" data-hab="${esc(p.habitaciones != null ? p.habitaciones : '')}">
          <a href="${href}" class="card-photo-link">
            <div class="photo real" data-loc="${esc(p.sector || p.ciudad || '')}" style="background-image:url('${esc(foto)}')">
              <div class="card-tags"><span class="tag ${tagCls}">${tagTxt}</span></div>${tipoTag}${videoBadge}
            </div>
          </a>
          <div class="card-body">
            <div class="price">${fmtPrecio(p.precio, p.operacion)}</div>
            <h3>${esc(p.titulo)}</h3>
            <div class="loc">📍 ${esc(locLine)}</div>
            <div class="specs">${specs.join('\n              ')}</div>
            <div class="card-actions"><a class="btn btn-sm btn-navy" href="${href}">Ver detalles</a><a class="btn-share" href="${href}" style="text-decoration:none">↗ Ver fotos</a></div>
          </div>
        </article>`;
}

// ---------- portada ----------
function renderIndex(props){
  const destacado = props.find(function(p){ return p.destacado; }) || props[0];
  const ogImg = destacado && destacado.fotos && destacado.fotos[0]
    ? SITE_URL + destacado.fotos[0].imagen : SITE_URL + '/assets/emblema.png';
  const cards = props.map(card).join('\n\n');
  // El hero usa un collage de fondo con fotos de Santa Marta (img/portada/sm1..sm4.jpg).
  // Para "Nosotros" se usa una foto nítida del inmueble.
  const aboutPhoto = '/img/inmuebles/990102/p02.jpg';
  const zonaOpts = ZONAS.map(function(z){ return '<option value="' + esc(z) + '">' + esc(z) + '</option>'; }).join('');
  const tipoOpts = TIPOS.map(function(t){ return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
  return head({
    title: 'Inmobiliaria Oshebe · Inmuebles en Santa Marta',
    desc: 'Casas, apartamentos y locales en venta y arriendo en Santa Marta. Fotos reales, recorridos en video y asesoría directa por WhatsApp.',
    url: SITE_URL + '/',
    image: ogImg,
    css: CSS_INDEX
  }) + `
<body>
<header class="nav"><div class="wrap nav-in">
  <a class="brand" href="/">${brandMark}${wordmark}</a>
  <nav class="nav-links">
    <a href="#inmuebles">Inmuebles</a>
    <a href="#nosotros">Nosotros</a>
    <a href="#contacto">Contacto</a>
  </nav>
  <a class="btn btn-wa" href="${WA_GENERIC}">${WA_ICON} WhatsApp</a>
</div></header>

<main>
  <section class="hero hero-bg">
    <div class="hero-collage" aria-hidden="true">
      <div style="background-image:url('/img/portada/sm1.jpg')"></div>
      <div style="background-image:url('/img/portada/sm2.jpg')"></div>
      <div style="background-image:url('/img/portada/sm3.jpg')"></div>
      <div style="background-image:url('/img/portada/sm4.jpg')"></div>
    </div>
    <div class="hero-overlay"></div>
    <div class="wrap hero-content">
      <span class="eyebrow light">Santa Marta · Magdalena</span>
      <h1>Encuentra tu lugar frente al <em>mar y la sierra</em></h1>
      <p class="lead light">Casas, apartamentos y locales en venta y arriendo en las mejores zonas de Santa Marta. Asesoría directa y personalizada por WhatsApp y correo.</p>
      <div class="hero-cta">
        <a class="btn btn-wa" href="#inmuebles">Ver inmuebles</a>
        <a class="btn btn-ghost-light" href="#contacto">Contáctanos</a>
      </div>
      <div class="stats stats-light">
        <div class="stat"><b>+10 años</b><span>de experiencia</span></div>
        <div class="stat"><b>Venta y arriendo</b><span>casas, aptos y locales</span></div>
        <div class="stat"><b>Atención directa</b><span>WhatsApp y correo</span></div>
      </div>
    </div>
  </section>

  <section id="inmuebles">
    <div class="wrap">
      <div class="sec-head">
        <div>
          <span class="eyebrow">Nuestra selección</span>
          <h2>Inmuebles en venta y arriendo en Santa Marta</h2>
          <p>Explora casas, apartamentos y locales. Filtra por operación, tipo o zona y contáctanos por WhatsApp o correo para agendar tu visita.</p>
        </div>
      </div>
      <div class="filterbar">
        <div class="field"><label>Operación</label><select id="fOp"><option value="">Todas</option><option value="venta">En venta</option><option value="arriendo">En arriendo</option></select></div>
        <div class="field"><label>Tipo</label><select id="fTipo"><option value="">Todos</option>${tipoOpts}</select></div>
        <div class="field"><label>Zona</label><select id="fZona"><option value="">Todas las zonas</option>${zonaOpts}</select></div>
        <div class="field"><label>Habitaciones</label><select id="fHab"><option value="">Cualquiera</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></div>
      </div>
      <div class="grid" id="grid">
${cards}
        <div class="nores" id="nores">No encontramos inmuebles con esos filtros. <a href="${WA_GENERIC}">Escríbenos por WhatsApp</a> y te ayudamos a encontrar lo que buscas.</div>
      </div>
    </div>
  </section>

  <section id="nosotros" class="band">
    <div class="wrap about-grid">
      <div class="about-photo" style="background-image:url('${aboutPhoto}')"></div>
      <div class="about">
        <span class="eyebrow">Sobre nosotros</span>
        <h2>Más de 10 años haciendo de Santa Marta tu hogar</h2>
        <p class="lead">En Inmobiliaria Oshebe llevamos más de una década acompañando a familias e inversionistas a encontrar el lugar perfecto frente al mar y la sierra. Conocemos cada rincón de Santa Marta y ponemos esa experiencia a tu servicio para que compres, vendas o arriendes con total confianza y tranquilidad.</p>
        <div class="values">
          <div class="value"><div class="vic">🏆</div><h4>+10 años de experiencia</h4><p>Una trayectoria sólida en el mercado inmobiliario de Santa Marta y el Magdalena.</p></div>
          <div class="value"><div class="vic">📍</div><h4>Conocimiento local</h4><p>Asesoría real sobre cada zona, precios justos y las mejores oportunidades.</p></div>
          <div class="value"><div class="vic">🤝</div><h4>Acompañamiento total</h4><p>Te guiamos en todo el proceso: visitas, negociación, documentos y cierre.</p></div>
          <div class="value"><div class="vic">✅</div><h4>Transparencia</h4><p>Información clara y atención personalizada, sin sorpresas ni letra pequeña.</p></div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="cta-band">
        <h2>¿Quieres vender o arrendar tu inmueble?</h2>
        <p>Publícalo con Oshebe y llega a compradores e inquilinos en toda Santa Marta. Nos encargamos de las fotos, la difusión y la atención. Cuéntanos de tu propiedad.</p>
        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; position:relative">
          <a class="btn btn-wa" href="${WA_VENDER}">${WA_ICON} Escríbenos por WhatsApp</a>
          <a class="btn" href="${mailLink('Quiero vender o arrendar mi inmueble')}" style="background:rgba(255,255,255,.12); color:#fff; border:1.5px solid rgba(255,255,255,.45)">✉️ Enviar correo</a>
        </div>
      </div>
    </div>
  </section>

  <section id="contacto" class="band">
    <div class="wrap contact-grid">
      <div>
        <span class="eyebrow">Contacto</span>
        <h2>Hablemos de tu próximo hogar</h2>
        <p class="lead">Estamos para ayudarte a encontrar, vender o arrendar tu propiedad en Santa Marta. Escríbenos y te respondemos personalmente.</p>
        <div class="contact-cta">
          <a class="btn btn-wa" href="${WA_GENERIC}">${WA_ICON} WhatsApp</a>
          <a class="btn btn-mail" href="${mailLink('Consulta de inmueble')}">✉️ Enviar correo</a>
        </div>
      </div>
      <div class="contact-info">
        <a href="${WA_GENERIC}"><span class="ci">📱</span> +57 302 335 0442</a>
        <a href="${mailLink('Consulta de inmueble')}"><span class="ci">✉️</span> ${EMAIL}</a>
        <a href="https://instagram.com/inmobiliariaoshebe"><span class="ci">📷</span> @inmobiliariaoshebe</a>
        <div><span class="ci">📍</span> Santa Marta, Magdalena — Colombia</div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="/" style="margin-bottom:12px">${brandMark}${wordmark}</a>
        <p style="max-width:34ch">Soluciones inmobiliarias integrales en Santa Marta, Colombia. Venta y arriendo de casas, apartamentos y locales.</p>
      </div>
      <div>
        <h4>Explora</h4>
        <a href="#inmuebles">Inmuebles</a><a href="#nosotros">Nosotros</a><a href="#contacto">Contacto</a>
      </div>
      <div>
        <h4>Contacto</h4>
        <a href="${WA_GENERIC}">WhatsApp +57 302 335 0442</a>
        <a href="mailto:${EMAIL}">${EMAIL}</a>
        <a href="https://instagram.com/inmobiliariaoshebe">@inmobiliariaoshebe · Instagram / Facebook</a>
        <a href="#">Santa Marta, Magdalena</a>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 Inmobiliaria Oshebe · Soluciones Inmobiliarias Integrales</span>
      <span>Santa Marta, Colombia</span>
    </div>
  </div>
</footer>
<script>
(function(){
  var grid = document.getElementById('grid');
  if(!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card[data-op]'));
  var fOp = document.getElementById('fOp'), fTipo = document.getElementById('fTipo'), fZona = document.getElementById('fZona'), fHab = document.getElementById('fHab');
  var nores = document.getElementById('nores');
  function apply(){
    var vis = 0;
    cards.forEach(function(c){
      var ok = (!fOp.value || c.dataset.op === fOp.value)
        && (!fTipo.value || c.dataset.tipo === fTipo.value)
        && (!fZona.value || c.dataset.zona === fZona.value)
        && (!fHab.value || (parseInt(c.dataset.hab || '0', 10) >= parseInt(fHab.value, 10)));
      c.style.display = ok ? '' : 'none';
      if(ok) vis++;
    });
    if(nores) nores.style.display = vis ? 'none' : 'block';
  }
  [fOp, fTipo, fZona, fHab].forEach(function(s){ if(s) s.addEventListener('change', apply); });
})();
</script>
</body>
</html>`;
}

// ---------- ficha de inmueble ----------
function specCell(svg, big, small){
  return '<div class="spec"><svg viewBox="0 0 24 24">' + svg + '</svg><div><b>' + esc(big) + '</b><span>' + esc(small) + '</span></div></div>';
}
function renderFicha(p){
  const fotos = (p.fotos || []).filter(function(f){ return f && f.imagen; });
  const first = fotos[0] ? fotos[0].imagen : '';
  const url = SITE_URL + '/inmueble-' + p.ref + '.html';
  const loc = [p.sector, p.ciudad].filter(Boolean).join(' · ');
  const opTxt = p.operacion === 'arriendo' ? 'En arriendo' : 'En venta';
  const opTagCls = p.operacion === 'arriendo' ? 'tag-arriendo' : 'tag-venta';
  const waText = 'Hola Oshebe, estoy interesado en el ' + p.titulo + ' (Ref. ' + p.ref + ' · ' + fmtPrecioPlano(p.precio) + '). ¿Me pueden dar más información?';
  const WA = waLink(waText);

  const specs = [];
  if(p.area_m2 != null && p.area_m2 !== '') specs.push(specCell('<path d="M3 3h18v18H3zM3 9h18M9 3v18"/>', p.area_m2 + ' m²', 'Área privada'));
  if(p.habitaciones != null && p.habitaciones !== '') specs.push(specCell('<path d="M3 12h18M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M4 18h16M6 18v2M18 18v2"/>', p.habitaciones, 'Habitaciones'));
  if(p.banos != null && p.banos !== '') specs.push(specCell('<path d="M5 11V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2M4 11h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/>', p.banos, 'Baños'));
  if(p.garajes != null && p.garajes !== '') specs.push(specCell('<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v5H5zM7 18v2M17 18v2M7 13h10"/>', p.garajes, 'Garajes'));
  if(p.piso) specs.push(specCell('<path d="M4 21V9l8-6 8 6v12M9 21v-6h6v6"/>', 'Piso ' + p.piso, 'Nivel'));
  if(p.estrato) specs.push(specCell('<path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 17l-5.5 2.5 1-6.3L3 8.9 9 8z"/>', 'Estrato ' + p.estrato, 'Exclusivo'));

  const feats = (p.caracteristicas || []).map(function(f){ return '<div>' + CHECK + ' ' + esc(f) + '</div>'; }).join('\n          ');
  const zonas = (p.zonas_comunes || []).map(function(f){ return '<div>' + CHECK + ' ' + esc(f) + '</div>'; }).join('\n          ');

  const yt = ytId(p.video_youtube);
  const videoSection = yt ? `
      <section class="blk">
        <h2>Recorrido en video</h2>
        <div class="videowrap"><iframe src="https://www.youtube.com/embed/${yt}" title="Recorrido en video" allowfullscreen loading="lazy"></iframe></div>
      </section>` : '';

  const admin = (p.administracion != null && p.administracion !== '')
    ? '<div class="admin">Administración ' + fmtPrecioPlano(p.administracion) + ' / mes</div>' : '';

  return head({
    title: p.titulo + ' · ' + (p.sector || p.ciudad || 'Oshebe'),
    desc: p.titulo + ' en ' + loc + ' — ' + fmtPrecioPlano(p.precio) + '. ' + [p.habitaciones && (p.habitaciones + ' hab'), p.banos && (p.banos + ' baños'), p.area_m2 && (p.area_m2 + ' m²')].filter(Boolean).join(' · ') + '.',
    url: url,
    image: SITE_URL + first,
    ogType: 'article',
    css: CSS_FICHA
  }) + `
<body>
<header class="nav"><div class="wrap nav-in">
  <a class="brand" href="/">${brandMark}${wordmark}</a>
  <a class="btn btn-wa nav-cta" href="${WA}">${WA_ICON} WhatsApp</a>
</div></header>

<main class="wrap">
  <a class="back" href="/#inmuebles">← Volver a inmuebles</a>

  <div class="head">
    <div>
      <div class="tags"><span class="tag ${opTagCls}">${opTxt}</span><span class="tag tag-ref">Ref. ${esc(p.ref)}</span></div>
      <h1>${esc(p.titulo)}</h1>
      <div class="loc">📍 ${esc(loc)}</div>
    </div>
    <div class="price-box">
      <div class="price">${fmtPrecioPlano(p.precio)}</div>
      ${admin}
    </div>
  </div>

  <div class="gallery">
    <div class="gmain" id="gmain" onclick="openLB()">
      <img id="mainImg" src="${esc(first)}" alt="${esc(fotos[0] ? fotos[0].titulo : p.titulo)}">
      <button class="garrow gprev" onclick="event.stopPropagation();step(-1)" aria-label="Anterior">‹</button>
      <button class="garrow gnext" onclick="event.stopPropagation();step(1)" aria-label="Siguiente">›</button>
      <div class="gcap"><span id="mainCap"></span><span class="gcount" id="gcount"></span></div>
    </div>
    <div class="thumbs" id="thumbs"></div>
  </div>

  <div class="specrow">
    ${specs.join('\n    ')}
  </div>

  <div class="cols">
    <div>
      <section class="blk desc">
        <h2>Descripción</h2>
        ${mdToHtml(p.descripcion)}
      </section>
${videoSection}
      <section class="blk">
        <h2>Características</h2>
        <div class="feat">
          ${feats}
        </div>
      </section>

      <section class="blk">
        <h2>Zonas comunes del edificio</h2>
        <div class="feat">
          ${zonas}
        </div>
      </section>
    </div>

    <aside>
      <div class="side">
        <div class="price">${fmtPrecioPlano(p.precio)}</div>
        ${admin}
        <a class="btn btn-wa" href="${WA}">💬 Escribir por WhatsApp</a>
        <button class="btn btn-share" onclick="sharePage()">↗ Compartir inmueble</button>
        <div class="agent">
          <b>Inmobiliaria Oshebe</b><br>
          Soluciones Inmobiliarias Integrales<br>
          📱 +57 302 335 0442<br>
          ✉️ ${EMAIL}
        </div>
      </div>
    </aside>
  </div>
</main>

<footer>© 2026 Inmobiliaria Oshebe · ${esc(loc)} · Ref. ${esc(p.ref)}</footer>
<div class="toast" id="toast">Enlace copiado ✓</div>

<div class="lb" id="lb">
  <button class="lbclose" onclick="closeLB()" aria-label="Cerrar">✕</button>
  <button class="lbarrow lbprev" onclick="step(-1)" aria-label="Anterior">‹</button>
  <img id="lbImg" alt="">
  <button class="lbarrow lbnext" onclick="step(1)" aria-label="Siguiente">›</button>
  <div class="lbcap" id="lbCap"></div>
</div>

<script>
const PHOTOS = ${JSON.stringify(fotos.map(function(f){ return { src: f.imagen, cap: f.titulo || '' }; }))};
let idx = 0;
const mainImg = document.getElementById('mainImg');
const mainCap = document.getElementById('mainCap');
const gcount = document.getElementById('gcount');
const thumbs = document.getElementById('thumbs');
const lb = document.getElementById('lb');
const lbImg = document.getElementById('lbImg');
const lbCap = document.getElementById('lbCap');

PHOTOS.forEach(function(p,i){
  const t = document.createElement('img');
  t.src = p.src; t.alt = p.cap; t.loading = 'lazy';
  t.onclick = function(){ idx=i; render(); };
  thumbs.appendChild(t);
});
function render(){
  const p = PHOTOS[idx];
  if(!p) return;
  mainImg.src = p.src; mainImg.alt = p.cap;
  mainCap.textContent = p.cap;
  gcount.textContent = (idx+1)+' / '+PHOTOS.length;
  Array.prototype.forEach.call(thumbs.children, function(c,i){ c.classList.toggle('active', i===idx); });
  const active = thumbs.children[idx];
  if(active) active.scrollIntoView({inline:'nearest', block:'nearest'});
  if(lb.classList.contains('open')){ lbImg.src=p.src; lbCap.textContent=p.cap; }
}
function step(d){ idx=(idx+d+PHOTOS.length)%PHOTOS.length; render(); }
function openLB(){ lb.classList.add('open'); render(); }
function closeLB(){ lb.classList.remove('open'); }
document.addEventListener('keydown', function(e){
  if(e.key==='ArrowRight') step(1);
  else if(e.key==='ArrowLeft') step(-1);
  else if(e.key==='Escape') closeLB();
});
function sharePage(){
  const data={ title:${JSON.stringify(p.titulo + ' · Oshebe')}, text:${JSON.stringify(p.titulo + ' en ' + loc + ' — ' + fmtPrecioPlano(p.precio))}, url:location.href };
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else { navigator.clipboard.writeText(location.href).then(showToast); }
}
function showToast(){ const t=document.getElementById('toast'); t.classList.add('show'); setTimeout(function(){t.classList.remove('show');},1800); }
render();
</script>
</body>
</html>`;
}

// ---------- build ----------
function copyDir(src, dest){
  if(!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

function main(){
  // limpia y crea dist/
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // lee inmuebles
  const dir = path.join(SRC, 'data', 'inmuebles');
  let props = [];
  if(fs.existsSync(dir)){
    props = fs.readdirSync(dir)
      .filter(function(f){ return f.endsWith('.json'); })
      .map(function(f){
        try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
        catch(e){ console.error('Error leyendo ' + f + ': ' + e.message); return null; }
      })
      .filter(function(p){ return p && p.publicado !== false; });
  }
  // orden: ref descendente (los más nuevos primero)
  props.sort(function(a,b){ return String(b.ref).localeCompare(String(a.ref)); });

  // páginas de inmuebles
  props.forEach(function(p){
    fs.writeFileSync(path.join(OUT, 'inmueble-' + p.ref + '.html'), renderFicha(p));
  });

  // portada
  fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(props));

  // assets estáticos
  copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
  copyDir(path.join(SRC, 'img'), path.join(OUT, 'img'));

  console.log('OK — ' + props.length + ' inmueble(s) generado(s) en dist/');
}

main();
