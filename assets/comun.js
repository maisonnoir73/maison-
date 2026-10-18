// MAISON NOIR · piezas compartidas por el catálogo y el panel
(function () {
  const ICON = {
    noche: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    dia: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    frio: '<path d="M12 2v20M4 6l16 12M20 6 4 18M9 3l3 3 3-3M9 21l3-3 3 3"/>',
    calor: '<path d="M12 22c4 0 7-3 7-7 0-4-4-6-4-11-3 2-4 5-4 7-1-1-2-2-2-4-2 2-4 5-4 8 0 4 3 7 7 7z"/>',
    todo: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z"/>',
    dulce: '<path d="M7 12a5 5 0 0 1 10 0 5 5 0 0 1-10 0zM7 12 3 9v6zM17 12l4-3v6z"/>',
    especia: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><circle cx="12" cy="12" r="3"/>',
    floral: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5c0-4 4-5 4-2s-4 4.5-4 2zM12 9.5c0-4-4-5-4-2s4 4.5 4 2zM12 14.5c0 4 4 5 4 2s-4-4.5-4-2zM12 14.5c0 4-4 5-4 2s4-4.5 4-2z"/>',
    frutal: '<path d="M12 8c-5-2-8 2-7 7s4 7 7 5c3 2 6 0 7-5s-2-9-7-7zM12 8c0-3 2-5 4-5"/>',
    madera: '<path d="M12 22V10M7 22h10M12 10 6 4M12 10l6-6M12 14l-4-3M12 14l4-3"/>',
    fresco: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
    ambar: '<path d="M12 3 20 8v8l-8 5-8-5V8z"/>'
  };
  const MOMENTO = { noche: 'Noche', dia: 'Día', frio: 'Clima frío', calor: 'Clima cálido', todo: 'Todo clima' };
  const FAMILIAS = { dulce: 'Dulce', especia: 'Especiado', floral: 'Floral', frutal: 'Frutal', madera: 'Amaderado', fresco: 'Fresco', ambar: 'Ámbar / almizcle' };

  const icono = (k) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[k] || ICON.ambar) + '</svg>';
  const pesos = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Frasco dibujado: se usa mientras un perfume no tenga foto
  let uid = 0;
  function frasco(n) {
    const forma = Math.abs(n | 0) % 3, i = 'f' + (++uid);
    const g = '<defs><linearGradient id="gl' + i + '" x1="0" x2="1"><stop offset="0" stop-color="#3a3122"/><stop offset=".45" stop-color="#8a7140"/><stop offset=".55" stop-color="#c9a95f"/><stop offset="1" stop-color="#2c251a"/></linearGradient><linearGradient id="cp' + i + '" x1="0" x2="1"><stop offset="0" stop-color="#1b1813"/><stop offset=".5" stop-color="#4a4031"/><stop offset="1" stop-color="#14120e"/></linearGradient></defs>';
    const s = [
      '<rect x="30" y="8" width="40" height="30" rx="3" fill="url(#cp' + i + ')"/><rect x="40" y="36" width="20" height="10" fill="#6b5a38"/><rect x="12" y="46" width="76" height="104" rx="8" fill="url(#gl' + i + ')"/><rect x="26" y="88" width="48" height="22" rx="2" fill="#0b0a08" opacity=".55"/>',
      '<circle cx="50" cy="22" r="16" fill="url(#cp' + i + ')"/><rect x="42" y="36" width="16" height="12" fill="#6b5a38"/><path d="M20 48h60l8 102H12z" fill="url(#gl' + i + ')"/><rect x="30" y="92" width="40" height="18" rx="2" fill="#0b0a08" opacity=".55"/>',
      '<path d="M38 4h24v36H38z" fill="url(#cp' + i + ')"/><rect x="43" y="38" width="14" height="10" fill="#6b5a38"/><ellipse cx="50" cy="104" rx="38" ry="46" fill="url(#gl' + i + ')"/><rect x="32" y="96" width="36" height="16" rx="2" fill="#0b0a08" opacity=".55"/>'
    ][forma];
    return '<svg class="frasco" viewBox="0 0 100 152" aria-hidden="true">' + g + s + '</svg>';
  }

  // Foto si existe; si no carga, cae al frasco dibujado
  function imagen(p, base) {
    if (!p.foto) return frasco(p.id);
    const src = /^https?:/.test(p.foto) ? p.foto : (base || '') + p.foto;
    return '<img class="foto" src="' + esc(src) + '" alt="' + esc(p.casa + ' ' + p.nombre) + '" loading="lazy" onerror="this.outerHTML=MaisonUI.frasco(' + (p.id | 0) + ')">';
  }

  function cliente() {
    const c = window.MAISON || {};
    if (!window.supabase || !c.url || c.url.indexOf('PEGA_AQUI') === 0) return null;
    return window.supabase.createClient(c.url, c.key);
  }

  // Tema claro / oscuro (se recuerda en el celular)
  const SOL = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  const LUNA = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';
  function temaActual() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function botonTema(btn) {
    const pintar = () => {
      const oscuro = temaActual() === 'dark';
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (oscuro ? SOL : LUNA) + '</svg><span>' + (oscuro ? 'Claro' : 'Oscuro') + '</span>';
      btn.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.content = oscuro ? '#0d0c0a' : '#f4f2ee';
    };
    btn.onclick = () => {
      const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nuevo;
      try { localStorage.setItem('maison-tema', nuevo); } catch (_) {}
      pintar();
    };
    pintar();
  }

  window.MaisonUI = { ICON, MOMENTO, FAMILIAS, icono, pesos, esc, frasco, imagen, cliente, botonTema };
})();
