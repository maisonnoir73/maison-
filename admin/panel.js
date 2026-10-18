// MAISON NOIR · Panel del equipo (Vender, Resumen, Inventario)
const UI = MaisonUI, db = UI.cliente();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = { perfumes: [], costos: {}, ventas: [], preguntas: [], ajustes: {}, invF: '', invQ: '', venQ: '', periodo: 'semana' };
const EYE_OPEN = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF = '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
const COLORES = ['#3b6ea8', '#a8822f', '#a8476b', '#3f8a6a', '#7a5aa8', '#b0603a'];
const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };
const secreto = txt => `<span class="secreto">${txt}</span>`;
const vendedores = () => (S.ajustes.vendedores || 'Juan Pablo,Fonegra,Juliana').split(',').map(s => s.trim()).filter(Boolean);
const slugify = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const img = p => UI.imagen(p, '../');
const corto = v => v >= 1e6 ? (Math.round(v / 1e5) / 10).toString().replace('.', ',') + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(v);
const iniciales = n => n.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

UI.botonTema($('#b-tema'));

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600);
}
function fallo(e) { console.error(e); toast('No se pudo guardar. Revisa la conexión e inténtalo de nuevo.', true); }

/* ---------- Ojito (esconde costos y ganancias) ---------- */
function setEye(on) {
  document.body.classList.toggle('oculto', on);
  $('#b-eye').setAttribute('aria-pressed', on);
  $('#eye-ico').innerHTML = on ? EYE_OFF : EYE_OPEN;
  store.set('maison-ojo', on ? '1' : '0');
  const t = $('#eye-txt'); if (t) t.textContent = on ? 'Mostrar ganancia' : 'Ocultar ganancia';
}
$('#b-eye').onclick = () => setEye(!document.body.classList.contains('oculto'));

/* ---------- Sesión ---------- */
async function iniciar() {
  if (!db) { $('#v-config').hidden = false; return; }
  setEye(store.get('maison-ojo') === '1');
  const { data } = await db.auth.getSession();
  if (data.session) entrar(); else $('#v-login').hidden = false;
}
$('#f-login').onsubmit = async e => {
  e.preventDefault();
  $('#l-err').textContent = ''; $('#l-btn').disabled = true;
  const { error } = await db.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
  $('#l-btn').disabled = false;
  if (error) { $('#l-err').textContent = 'Correo o contraseña incorrectos.'; return; }
  entrar();
};
$('#b-out').onclick = async () => { await db.auth.signOut(); location.reload(); };

async function entrar() {
  $('#v-login').hidden = true; $('#v-app').hidden = false;
  await cargarTodo();
}

async function cargarTodo() {
  const [p, c, v, q, a] = await Promise.all([
    db.from('perfumes').select('*').order('orden'),
    db.from('costos').select('*'),
    db.from('ventas').select('*').order('fecha', { ascending: false }).limit(5000),
    db.from('preguntas').select('*').order('fecha', { ascending: false }).limit(10000),
    db.from('ajustes').select('*')
  ]);
  if (p.error) { toast('No se pudo cargar el inventario.', true); console.error(p.error); return; }
  S.perfumes = p.data;
  S.costos = Object.fromEntries((c.data || []).map(x => [x.perfume_id, x]));
  S.ventas = v.data || []; S.preguntas = q.data || [];
  S.ajustes = Object.fromEntries((a.data || []).map(x => [x.clave, x.valor]));
  pintarInv(); pintarVen(); pintarRes();
}

/* ---------- Pestañas ---------- */
$$('.nav button').forEach(b => b.onclick = () => {
  $$('.nav button').forEach(x => x.removeAttribute('aria-current')); b.setAttribute('aria-current', 'page');
  ['t-ven', 't-res', 't-inv'].forEach(id => $('#' + id).hidden = id !== b.dataset.t);
  if (b.dataset.t === 't-res') pintarRes();
  window.scrollTo(0, 0);
});

/* ---------- Hoja inferior ---------- */
function abrirHoja(html, onReady) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  $('#scrim').onclick = e => { if (e.target.id === 'scrim') cerrarHoja(); };
  onReady && onReady($('.sheet', root));
}
function cerrarHoja() { $('#sheet-root').innerHTML = ''; document.body.style.overflow = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarHoja(); });

/* ---------- Vender ---------- */
const inicioHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const preguntasHoy = id => S.preguntas.filter(q => q.perfume_id === id && new Date(q.fecha) >= inicioHoy()).length;

function pintarVen() {
  const q = S.venQ.toLowerCase();
  const items = S.perfumes.filter(p => !q || (p.nombre + ' ' + p.casa).toLowerCase().includes(q));
  $('#ven').innerHTML = items.map(p => {
    const n = preguntasHoy(p.id);
    return `<div class="card pcard${p.disponible ? '' : ' out'}" role="button" tabindex="0" data-sell="${p.id}" aria-label="Vender ${UI.esc(p.nombre)}">
      <button class="ask${n ? ' has' : ''}" data-ask="${p.id}" aria-label="Sumar pregunta por ${UI.esc(p.nombre)}"><svg class="i" viewBox="0 0 24 24">${EYE_OPEN}</svg>${n || ''}</button>
      <div class="ph">${img(p)}</div>
      <span class="cs">${UI.esc(p.casa)}</span>
      <span class="nm">${UI.esc(p.nombre)}</span>
      <span class="pr num">${UI.pesos(p.precio)}</span>
    </div>`;
  }).join('') || '<p class="empty" style="grid-column:1/-1">No encontré ese perfume.</p>';
}
$('#ven-q').oninput = e => { S.venQ = e.target.value; pintarVen(); };
$('#ven').onclick = async e => {
  const ask = e.target.closest('[data-ask]');
  if (ask) {
    e.stopPropagation();
    const id = Number(ask.dataset.ask);
    const { data, error } = await db.from('preguntas').insert({ perfume_id: id, origen: 'manual' }).select().single();
    if (error) return fallo(error);
    S.preguntas.unshift(data); pintarVen();
    const p = S.perfumes.find(x => x.id === id);
    toast('Pregunta sumada · ' + p.nombre + ' (' + preguntasHoy(id) + ' hoy)');
    return;
  }
  const card = e.target.closest('[data-sell]');
  if (card) vender(S.perfumes.find(x => x.id == card.dataset.sell));
};
$('#ven').onkeydown = e => { if (e.key === 'Enter' && e.target.dataset.sell) vender(S.perfumes.find(x => x.id == e.target.dataset.sell)); };

function vender(p) {
  const c = S.costos[p.id] || { costo: 0, minimo: 0 };
  const vs = vendedores();
  let cant = 1, precio = p.precio, otro = false, quien = store.get('maison-vendedor');
  if (!vs.includes(quien)) quien = vs[0];

  abrirHoja(`
    <div class="sheet-head"><div class="ph">${img(p)}</div><div><div class="inv-casa">${UI.esc(p.casa)}</div><div class="sheet-title">${UI.esc(p.nombre)}</div></div></div>
    <div><div class="lbl" style="margin-bottom:8px">¿Cuántos vendiste?</div>
      <div class="qty" id="s-qty">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="opt" data-q="${n}" aria-pressed="${n === 1}">${n}</button>`).join('')}<button type="button" class="opt txt" data-q="mas" aria-pressed="false">Más</button></div>
      <input class="input num" id="s-qmas" type="number" min="6" inputmode="numeric" placeholder="¿Cuántos?" style="margin-top:8px" hidden>
    </div>
    <div><div class="lbl" style="margin-bottom:8px">¿En qué valor?</div>
      <div class="two" id="s-pr">
        <button type="button" class="opt wide" data-p="cat" aria-pressed="true">Catálogo<small class="num">${UI.pesos(p.precio)}</small></button>
        <button type="button" class="opt wide" data-p="otro" aria-pressed="false">Otro valor<small>escribirlo</small></button>
      </div>
      <input class="input num" id="s-otro" inputmode="numeric" placeholder="Valor por unidad" style="margin-top:8px" hidden>
      <p class="warn" id="s-warn" hidden></p>
    </div>
    <div><div class="lbl" style="margin-bottom:8px">¿Quién vendió?</div><div class="three" id="s-who">${vs.map(v => `<button type="button" class="opt txt" data-w="${UI.esc(v)}" aria-pressed="${v === quien}">${UI.esc(v)}</button>`).join('')}</div></div>
    <div class="total"><div><div class="muted small">Total</div><strong class="num" id="s-tot"></strong></div><div class="g"><div class="muted small" style="font-weight:400">Ganancia</div><span class="num secreto" id="s-gan"></span></div></div>
    <button class="btn gold block" id="s-save">Listo, guardar</button>
  `, sh => {
    const calc = () => {
      precio = otro ? (Number(($('#s-otro', sh).value || '').replace(/\D/g, '')) || 0) : p.precio;
      $('#s-tot', sh).textContent = UI.pesos(precio * cant);
      $('#s-gan', sh).textContent = UI.pesos((precio - (c.costo || 0)) * cant);
      const w = $('#s-warn', sh);
      w.hidden = !(otro && precio > 0 && c.minimo && precio < c.minimo);
      if (!w.hidden) w.innerHTML = 'Ojo: está por debajo del mínimo (' + secreto(UI.pesos(c.minimo)) + ').';
    };
    $$('#s-qty .opt', sh).forEach(b => b.onclick = () => {
      $$('#s-qty .opt', sh).forEach(x => x.setAttribute('aria-pressed', x === b));
      const mas = b.dataset.q === 'mas'; $('#s-qmas', sh).hidden = !mas;
      if (mas) { $('#s-qmas', sh).focus(); cant = Number($('#s-qmas', sh).value) || 6; } else cant = Number(b.dataset.q);
      calc();
    });
    $('#s-qmas', sh).oninput = e => { cant = Math.max(1, Number(e.target.value) || 1); calc(); };
    $$('#s-pr .opt', sh).forEach(b => b.onclick = () => {
      $$('#s-pr .opt', sh).forEach(x => x.setAttribute('aria-pressed', x === b));
      otro = b.dataset.p === 'otro'; $('#s-otro', sh).hidden = !otro; if (otro) $('#s-otro', sh).focus(); calc();
    });
    $('#s-otro', sh).oninput = calc;
    $$('#s-who .opt', sh).forEach(b => b.onclick = () => { quien = b.dataset.w; $$('#s-who .opt', sh).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    calc();
    $('#s-save', sh).onclick = async () => {
      if (!precio) return toast('Escribe el valor de venta.', true);
      if (!quien) return toast('Escoge quién vendió.', true);
      const btn = $('#s-save', sh); btn.disabled = true; btn.textContent = 'Guardando…';
      const fila = { perfume_id: p.id, perfume_nombre: p.casa + ' ' + p.nombre, cantidad: cant, precio_unit: precio, costo_unit: c.costo || 0, vendedor: quien };
      const { data, error } = await db.from('ventas').insert(fila).select().single();
      if (error) { btn.disabled = false; btn.textContent = 'Listo, guardar'; return fallo(error); }
      store.set('maison-vendedor', quien);
      S.ventas.unshift(data); cerrarHoja(); pintarRes();
      toast('Venta guardada · ' + cant + ' × ' + p.nombre + ' · ' + quien);
    };
  });
}

/* ---------- Resumen ---------- */
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
function desdeDe(periodo) {
  const d = inicioHoy();
  if (periodo === 'semana') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  if (periodo === 'mes') d.setDate(1);
  return d;
}
const claveDia = d => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();

// Hoy: últimos 7 días con hoy resaltado. Semana: lunes a domingo. Mes: cada día del mes.
function barras(periodo) {
  const hoy = inicioHoy(), dias = [];
  if (periodo === 'mes') {
    const ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= ult; i++) dias.push(new Date(hoy.getFullYear(), hoy.getMonth(), i));
  } else if (periodo === 'semana') {
    const lunes = desdeDe('semana');
    for (let i = 0; i < 7; i++) { const d = new Date(lunes); d.setDate(lunes.getDate() + i); dias.push(d); }
  } else {
    for (let i = 6; i >= 0; i--) { const d = new Date(hoy); d.setDate(hoy.getDate() - i); dias.push(d); }
  }
  const suma = {};
  S.ventas.forEach(v => { const k = claveDia(new Date(v.fecha)); suma[k] = (suma[k] || 0) + v.precio_unit * v.cantidad; });
  const vals = dias.map(d => suma[claveDia(d)] || 0), max = Math.max(...vals, 1);
  const many = dias.length > 10, kHoy = claveDia(hoy);
  const cols = dias.map((d, i) => {
    const v = vals[i], esHoy = claveDia(d) === kHoy;
    const etiqueta = many ? (d.getDate() === 1 || d.getDate() % 5 === 0 || esHoy ? d.getDate() : '') : (periodo === 'hoy' && esHoy ? 'Hoy' : DIAS[(d.getDay() + 6) % 7]);
    return `<div class="bar-col${esHoy ? ' hoy' : ''}" title="${d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' })}: ${UI.pesos(v)}"><span class="bar-v num">${v ? corto(v) : ''}</span><div class="bar-b" style="height:${v ? Math.max(6, v / max * 78) : 2}%"></div><span class="bar-l">${etiqueta}</span></div>`;
  }).join('');
  const titulo = periodo === 'mes' ? 'Cada día del mes' : periodo === 'semana' ? 'Lunes a domingo' : 'Últimos 7 días';
  return `<div class="card chart"><div class="chart-head"><b>Plata por día</b><span class="muted small">${titulo}</span></div><div class="bars${many ? ' many' : ''}">${cols}</div></div>`;
}

function ranking(mapa, fmt) {
  const arr = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!arr.length) return '<p class="muted small" style="padding:10px 0;margin:0">Todavía no hay datos en este periodo.</p>';
  const max = arr[0][1];
  return arr.map(([k, v], i) => `<div class="rk"><span class="pos num">${i + 1}</span><div class="nm"><span>${UI.esc(k)}</span><div class="barra"><i style="width:${Math.max(6, v / max * 100)}%"></i></div></div><span class="v num">${fmt(v)}</span></div>`).join('');
}

function pintarRes() {
  const desde = desdeDe(S.periodo);
  const vs = S.ventas.filter(v => new Date(v.fecha) >= desde);
  const qs = S.preguntas.filter(q => new Date(q.fecha) >= desde);
  const nombre = id => { const p = S.perfumes.find(x => x.id === id); return p ? p.casa + ' ' + p.nombre : 'Perfume eliminado'; };
  let total = 0, unidades = 0, ganancia = 0;
  const porPerfume = {}, porPregunta = {}, porVendedor = {};
  const listaV = vendedores();
  listaV.forEach(n => porVendedor[n] = { u: 0, t: 0, g: 0 });
  vs.forEach(v => {
    const t = v.precio_unit * v.cantidad, g = (v.precio_unit - v.costo_unit) * v.cantidad;
    total += t; unidades += v.cantidad; ganancia += g;
    porPerfume[v.perfume_nombre] = (porPerfume[v.perfume_nombre] || 0) + v.cantidad;
    const pv = porVendedor[v.vendedor] || (porVendedor[v.vendedor] = { u: 0, t: 0, g: 0 });
    pv.u += v.cantidad; pv.t += t; pv.g += g;
  });
  qs.forEach(q => { const k = nombre(q.perfume_id); porPregunta[k] = (porPregunta[k] || 0) + 1; });
  const oculto = document.body.classList.contains('oculto');

  $('#res').innerHTML = `
    <section class="card resumen">
      <div class="big"><span>Plata que entró</span><b class="num">${UI.pesos(total)}</b></div>
      <div class="duo">
        <div class="mini und"><span>Perfumes vendidos</span><b class="num">${unidades}</b></div>
        <div class="mini gan"><span>Ganancia real</span><b class="num secreto">${UI.pesos(ganancia)}</b></div>
      </div>
      <button class="eye" id="r-eye"><svg class="i" style="width:17px;height:17px" viewBox="0 0 24 24">${EYE_OPEN}</svg><span id="eye-txt">${oculto ? 'Mostrar ganancia' : 'Ocultar ganancia'}</span></button>
    </section>
    <h2>Quién ha vendido</h2>
    <div class="sellers">${Object.entries(porVendedor).sort((a, b) => b[1].t - a[1].t).map(([n, v]) => {
      const idx = listaV.indexOf(n);
      return `<div class="card seller"><div class="av" style="background:${COLORES[(idx < 0 ? listaV.length : idx) % COLORES.length]}">${UI.esc(iniciales(n))}</div><div><div class="nm">${UI.esc(n)}</div><div class="sub">${v.u} perfume${v.u === 1 ? '' : 's'}</div></div><div class="money num"><b>${UI.pesos(v.t)}</b><small class="secreto">gana ${UI.pesos(v.g)}</small></div></div>`;
    }).join('')}</div>
    <h2>Cómo nos fue</h2>
    ${barras(S.periodo)}
    <h2>Los más vendidos</h2>
    <div class="card rank">${ranking(porPerfume, v => v + ' und')}</div>
    <h2>Los más preguntados</h2>
    <div class="card rank">${ranking(porPregunta, v => v)}</div>
    <p class="muted small" style="margin:8px 2px 0">${qs.length} preguntas · ${qs.filter(q => q.origen === 'whatsapp').length} llegaron por el botón Pedir del catálogo</p>
    <button class="link" id="r-fix">¿Te equivocaste en una venta? Corregir</button>
  `;
  $('#r-eye').onclick = () => setEye(!document.body.classList.contains('oculto'));
  $('#r-fix').onclick = corregir;
}
$$('#res-p button').forEach(b => b.onclick = () => { S.periodo = b.dataset.p; $$('#res-p button').forEach(x => x.setAttribute('aria-pressed', x === b)); pintarRes(); });

function corregir() {
  const lista = () => S.ventas.slice(0, 30).map(v => `<div class="sale"><div class="grow">${v.cantidad} × ${UI.esc(v.perfume_nombre)}<small>${new Date(v.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${UI.esc(v.vendedor)} · ${UI.pesos(v.precio_unit * v.cantidad)}</small></div><button class="del" data-del="${v.id}">Borrar</button></div>`).join('') || '<p class="muted">No hay ventas guardadas.</p>';
  abrirHoja(`<div class="sheet-title">Corregir una venta</div><p class="muted small" style="margin:-8px 0 0">Borra la venta equivocada y vuelve a hacerla bien desde Vender.</p><div id="fix-list">${lista()}</div>`, sh => {
    $('#fix-list', sh).onclick = async e => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = '¿Seguro?'; return; }
      const { error } = await db.from('ventas').delete().eq('id', b.dataset.del);
      if (error) return fallo(error);
      S.ventas = S.ventas.filter(v => v.id != b.dataset.del);
      $('#fix-list', sh).innerHTML = lista(); pintarRes(); toast('Venta borrada');
    };
  });
}

/* ---------- Inventario ---------- */
function pintarInv() {
  const q = S.invQ.toLowerCase();
  const items = S.perfumes.filter(p =>
    (!S.invF || (S.invF === 'out' ? !p.disponible : p.genero === S.invF)) &&
    (!q || (p.nombre + ' ' + p.casa).toLowerCase().includes(q)));
  $('#inv').innerHTML = items.map(p => {
    const c = S.costos[p.id] || {};
    return `<div class="card inv-item${p.disponible ? '' : ' out'}">
      <div class="ph">${img(p)}</div>
      <button class="inv-main" data-edit="${p.id}">
        <span class="inv-casa">${UI.esc(p.casa)}</span>
        <span class="inv-name">${UI.esc(p.nombre)}</span>
        <span class="inv-prices num"><span>Venta <b>${UI.pesos(p.precio)}</b></span><span>Entra <b class="secreto">${UI.pesos(c.costo || 0)}</b></span>${p.disponible ? '' : '<span class="tag-out">Agotado</span>'}</span>
      </button>
      <button class="switch" role="switch" aria-checked="${p.disponible}" aria-label="Disponible ${UI.esc(p.nombre)}" data-av="${p.id}"></button>
    </div>`;
  }).join('') || '<p class="empty">No hay perfumes con ese filtro.</p>';
}
$('#inv-q').oninput = e => { S.invQ = e.target.value; pintarInv(); };
$$('#inv-f .chip').forEach(b => b.onclick = () => { S.invF = b.dataset.f; $$('#inv-f .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); pintarInv(); });
$('#inv').onclick = async e => {
  const sw = e.target.closest('[data-av]');
  if (sw) {
    const p = S.perfumes.find(x => x.id == sw.dataset.av); const nuevo = !p.disponible;
    const { error } = await db.from('perfumes').update({ disponible: nuevo }).eq('id', p.id);
    if (error) return fallo(error);
    p.disponible = nuevo; pintarInv(); pintarVen();
    toast(nuevo ? p.nombre + ' disponible otra vez' : p.nombre + ' quedó agotado');
    return;
  }
  const ed = e.target.closest('[data-edit]');
  if (ed) editar(S.perfumes.find(x => x.id == ed.dataset.edit));
};
$('#b-new').onclick = () => editar(null);

function editar(p) {
  const nuevo = !p;
  p = p || { nombre: '', casa: '', genero: 'masculino', tipo: 'Árabe', precio: 0, disponible: true, momento: [], notas: [], descripcion: '', foto: null };
  const c = (p.id && S.costos[p.id]) || { costo: 0, minimo: 0 };
  const sel = (arr, val) => arr.map(([v, t]) => `<button type="button" class="opt txt" data-v="${v}" aria-pressed="${val === v}">${t}</button>`).join('');
  const famOpts = k => Object.entries(UI.FAMILIAS).map(([v, t]) => `<option value="${v}"${v === k ? ' selected' : ''}>${t}</option>`).join('');
  const notaRow = n => `<div class="nrow"><input class="input" placeholder="Ej: Vainilla" value="${UI.esc(n.t || '')}"><select aria-label="Tipo de aroma">${famOpts(n.i || 'dulce')}</select><button type="button" class="x" aria-label="Quitar nota">✕</button></div>`;
  let fotoNueva = null;

  abrirHoja(`
    <div class="sheet-title">${nuevo ? 'Nuevo perfume' : 'Editar perfume'}</div>
    <div class="photo-edit">
      <div class="ph" id="e-ph">${img(p.id ? p : { ...p, id: 1 })}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label class="btn file"><svg class="i" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Cambiar foto<input type="file" accept="image/*" id="e-file"></label>
        <span class="muted small">Mejor sin fondo (PNG)</span>
      </div>
    </div>
    <div class="fgrid">
      <div class="field full"><span class="lbl">Nombre</span><input class="input" id="e-nombre" value="${UI.esc(p.nombre)}"></div>
      <div class="field full"><span class="lbl">Casa</span><input class="input" id="e-casa" value="${UI.esc(p.casa)}" list="casas"></div>
    </div>
    <datalist id="casas">${[...new Set(S.perfumes.map(x => x.casa))].map(x => `<option value="${UI.esc(x)}">`).join('')}</datalist>
    <div><div class="lbl" style="margin-bottom:8px">Género</div><div class="three" id="e-gen">${sel([['masculino', 'Hombre'], ['unisex', 'Unisex'], ['femenino', 'Mujer']], p.genero)}</div></div>
    <div><div class="lbl" style="margin-bottom:8px">Tipo</div><div class="three" id="e-tipo">${sel([['Árabe', 'Árabe'], ['Diseñador', 'Diseñador'], ['Nicho', 'Nicho']], p.tipo)}</div></div>
    <div class="fgrid">
      <div class="field"><span class="lbl">Precio de venta</span><input class="input num" id="e-precio" inputmode="numeric" value="${p.precio || ''}"></div>
      <div class="field"><span class="lbl">Cómo nos entra</span><input class="input num" id="e-costo" inputmode="numeric" value="${c.costo || ''}"></div>
      <div class="field"><span class="lbl">Mínimo</span><input class="input num" id="e-min" inputmode="numeric" value="${c.minimo || ''}"></div>
      <div class="field"><span class="lbl">Ganancia</span><div class="input num secreto" id="e-gan" style="background:var(--ok-bg);color:var(--ok);border-color:transparent;font-weight:600"></div></div>
    </div>
    <div class="row"><span class="grow">Disponible</span><button type="button" class="switch" role="switch" id="e-disp" aria-checked="${p.disponible}" aria-label="Disponible"></button></div>
    <div><div class="lbl" style="margin-bottom:8px">Cuándo usarlo</div><div class="chips" id="e-mom" style="flex-wrap:wrap;padding:0">${Object.entries(UI.MOMENTO).map(([v, t]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${(p.momento || []).includes(v)}">${t}</button>`).join('')}</div></div>
    <div><div class="lbl" style="margin-bottom:8px">Notas (aroma)</div><div id="e-notas">${(p.notas || []).map(notaRow).join('')}</div><button type="button" class="btn" id="e-addn">+ Agregar nota</button></div>
    <div class="field"><span class="lbl">Recomendación corta</span><textarea class="input" id="e-desc" maxlength="90" placeholder="Ej: Dulce y elegante. Para la noche.">${UI.esc(p.descripcion)}</textarea></div>
    <button class="btn gold block" id="e-save">${nuevo ? 'Agregar al catálogo' : 'Guardar cambios'}</button>
    ${nuevo ? '' : '<button class="btn danger block" id="e-del">Eliminar del catálogo</button>'}
  `, sh => {
    const pick = id => $$('#' + id + ' .opt', sh).forEach(b => b.onclick = () => $$('#' + id + ' .opt', sh).forEach(x => x.setAttribute('aria-pressed', x === b)));
    pick('e-gen'); pick('e-tipo');
    $$('#e-mom .chip', sh).forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
    $('#e-disp', sh).onclick = e => e.currentTarget.setAttribute('aria-checked', e.currentTarget.getAttribute('aria-checked') !== 'true');
    const n = id => Number(($('#' + id, sh).value || '').replace(/\D/g, '')) || 0;
    const gan = () => { $('#e-gan', sh).textContent = UI.pesos(n('e-precio') - n('e-costo')); };
    ['e-precio', 'e-costo'].forEach(id => $('#' + id, sh).oninput = gan); gan();
    if (document.body.classList.contains('oculto')) ['e-costo', 'e-min'].forEach(id => $('#' + id, sh).type = 'password');
    $('#e-addn', sh).onclick = () => $('#e-notas', sh).insertAdjacentHTML('beforeend', notaRow({}));
    $('#e-notas', sh).onclick = e => { if (e.target.closest('.x')) e.target.closest('.nrow').remove(); };
    $('#e-file', sh).onchange = e => {
      fotoNueva = e.target.files[0];
      if (fotoNueva) $('#e-ph', sh).innerHTML = `<img class="foto" src="${URL.createObjectURL(fotoNueva)}" alt="">`;
    };
    $('#e-save', sh).onclick = async () => {
      const nombre = $('#e-nombre', sh).value.trim(), casa = $('#e-casa', sh).value.trim();
      if (!nombre || !casa) return toast('Falta el nombre o la casa.', true);
      const btn = $('#e-save', sh); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const datos = {
          nombre, casa,
          genero: $('#e-gen .opt[aria-pressed="true"]', sh).dataset.v,
          tipo: $('#e-tipo .opt[aria-pressed="true"]', sh).dataset.v,
          precio: n('e-precio'),
          disponible: $('#e-disp', sh).getAttribute('aria-checked') === 'true',
          momento: $$('#e-mom .chip[aria-pressed="true"]', sh).map(b => b.dataset.v),
          notas: $$('#e-notas .nrow', sh).map(r => ({ t: $('input', r).value.trim(), i: $('select', r).value })).filter(x => x.t),
          descripcion: $('#e-desc', sh).value.trim()
        };
        let slug = p.slug;
        if (nuevo) {
          slug = slugify(casa + '-' + nombre);
          if (S.perfumes.some(x => x.slug === slug)) slug += '-' + Date.now().toString(36);
          datos.slug = slug; datos.orden = S.perfumes.length;
        }
        if (fotoNueva) datos.foto = await subirFoto(fotoNueva, slug);
        let id = p.id;
        if (nuevo) {
          const r = await db.from('perfumes').insert(datos).select().single(); if (r.error) throw r.error; id = r.data.id;
        } else {
          const r = await db.from('perfumes').update(datos).eq('id', id); if (r.error) throw r.error;
        }
        const rc = await db.from('costos').upsert({ perfume_id: id, costo: n('e-costo'), minimo: n('e-min') }); if (rc.error) throw rc.error;
        cerrarHoja(); await cargarTodo(); toast(nuevo ? 'Perfume agregado' : 'Cambios guardados');
      } catch (e) { btn.disabled = false; btn.textContent = 'Guardar cambios'; fallo(e); }
    };
    const del = $('#e-del', sh);
    if (del) del.onclick = async () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Toca otra vez para eliminar'; return; }
      const { error } = await db.from('perfumes').delete().eq('id', p.id);
      if (error) return fallo(error);
      cerrarHoja(); await cargarTodo(); toast('Perfume eliminado');
    };
  });
}

async function subirFoto(file, nombre) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const ruta = nombre + '-' + Date.now() + '.' + ext;
  const { error } = await db.storage.from('fotos').upload(ruta, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return db.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
}

/* ---------- Ajustes ---------- */
$('#b-set').onclick = () => {
  let logoNuevo = null;
  abrirHoja(`
    <div class="sheet-title">Logo, WhatsApp y vendedores</div>
    <div><div class="lbl" style="margin-bottom:8px">Logo del catálogo</div>
      <img id="a-logo" src="${UI.esc(S.ajustes.logo_url || '../assets/logo.jpg')}" alt="" style="width:100%;border-radius:14px">
      <div class="row" style="margin-top:8px"><label class="btn file grow">Cambiar logo<input type="file" accept="image/*" id="a-file"></label>${S.ajustes.logo_url ? '<button class="btn" id="a-reset">Usar el original</button>' : ''}</div>
    </div>
    <div class="field"><span class="lbl">WhatsApp de pedidos</span><input class="input num" id="a-wa" inputmode="tel" value="${UI.esc(S.ajustes.whatsapp || '')}"><span class="muted small">Con 57 adelante, sin espacios. Ej: 573117026638</span></div>
    <div class="field"><span class="lbl">Vendedores</span><input class="input" id="a-ven" value="${UI.esc(vendedores().join(', '))}"><span class="muted small">Separados por coma</span></div>
    <button class="btn gold block" id="a-save">Guardar</button>
  `, sh => {
    $('#a-file', sh).onchange = e => { logoNuevo = e.target.files[0]; if (logoNuevo) $('#a-logo', sh).src = URL.createObjectURL(logoNuevo); };
    const reset = $('#a-reset', sh);
    if (reset) reset.onclick = async () => {
      const { error } = await db.from('ajustes').upsert({ clave: 'logo_url', valor: '' }); if (error) return fallo(error);
      S.ajustes.logo_url = ''; cerrarHoja(); toast('Volvió el logo original');
    };
    $('#a-save', sh).onclick = async () => {
      const btn = $('#a-save', sh); btn.disabled = true;
      try {
        const filas = [
          { clave: 'whatsapp', valor: $('#a-wa', sh).value.replace(/\D/g, '') },
          { clave: 'vendedores', valor: $('#a-ven', sh).value.split(',').map(s => s.trim()).filter(Boolean).join(',') }
        ];
        if (logoNuevo) filas.push({ clave: 'logo_url', valor: await subirFoto(logoNuevo, 'logo') });
        const { error } = await db.from('ajustes').upsert(filas); if (error) throw error;
        filas.forEach(f => S.ajustes[f.clave] = f.valor);
        cerrarHoja(); pintarRes(); toast('Guardado');
      } catch (e) { btn.disabled = false; fallo(e); }
    };
  });
};

iniciar();
