// ======================================================================
// MODULE: BASE DE DATOS DEL PUESTO — "EL EXPERTO DEL ÁREA"
// Memoria total del puesto + chat que responde como el experto que sabe todo.
// ======================================================================
let saberes = [];
let puestoFiltro = 'todas';
let puestoChat = [];
const CATEGORIAS_PUESTO = ['Procedimiento', 'Responsable', 'Contacto', 'Criterio de calidad', 'Proveedor', 'Equipo', 'Decisión histórica', 'Tip', 'Ubicación de archivos', 'Otro'];

// Contexto para inyectar en la IA (usado por el experto y por Consultas)
async function getSaberPuestoContext() {
  if (!supabaseClient) return '';
  try {
    const { data } = await supabaseClient.from('saber_puesto').select('tema,area,categoria,contenido').order('creado_en', { ascending: true }).limit(400);
    if (!data || !data.length) return '';
    return '\n\n=== BASE DE DATOS DEL PUESTO (todo lo que se sabe del área) ===\n' +
      data.map(s => '• [' + (s.categoria || 'Otro') + (s.area ? ' · ' + s.area : '') + '] ' + s.tema + ': ' + s.contenido).join('\n') +
      '\n=== FIN BASE DEL PUESTO ===';
  } catch(e) { return ''; }
}

function renderPuesto() {
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>🎓 Base de Datos del Puesto</h2><p>Todo lo que hay que saber del puesto. La IA responde como el experto que conoce el área.</p></div>
    <div class="card">
      <div class="card-title">💬 Preguntá al experto del puesto</div>
      <div id="puesto-chat" style="max-height:320px;overflow-y:auto;background:var(--bg);border-radius:8px;padding:12px;margin-bottom:10px;min-height:80px">
        <p style="color:var(--text-light);font-size:14px">Preguntá cómo se hace algo, quién se encarga de qué, dónde está un archivo, criterios de calidad, etc. Uso todo lo cargado del puesto + tus documentos y carpetas.</p>
      </div>
      <div style="display:flex;gap:8px">
        <input type="text" class="form-control" id="puesto-preg" placeholder="Ej: ¿Cómo se controla el sellado de las bolsas?" onkeydown="if(event.key==='Enter')preguntarExperto()">
        <button class="btn btn-primary" onclick="preguntarExperto()" id="puesto-preg-btn">Preguntar</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">➕ Cargar saber del puesto</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tema</label><input type="text" class="form-control" id="sp-tema" placeholder="Ej: Control de sellado"></div>
        <div class="form-group"><label class="form-label">Área</label><input type="text" class="form-control" id="sp-area" placeholder="Ej: Producción"></div>
      </div>
      <div class="form-group"><label class="form-label">Categoría</label>
        <select class="form-control" id="sp-categoria">${CATEGORIAS_PUESTO.map(c => '<option>' + c + '</option>').join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Contenido</label><textarea class="form-control" id="sp-contenido" style="min-height:80px" placeholder="Explicá cómo se hace, quién, con qué criterio, dónde está el archivo, etc."></textarea></div>
      <button class="btn btn-primary" onclick="guardarSaber()">💾 Guardar</button>
      <button class="btn btn-secondary" onclick="alimentarDesdeDocs()" style="margin-left:8px" id="alim-btn">🤖 Alimentar desde documentos</button>
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span>📚 Saber acumulado del puesto</span>
        <select class="form-control" id="sp-filtro" style="width:auto;font-size:13px;padding:6px 10px" onchange="filtrarSaber(this.value)">
          <option value="todas">Todas las categorías</option>${CATEGORIAS_PUESTO.map(c => '<option value="' + c + '">' + c + '</option>').join('')}
        </select>
      </div>
      <div id="saber-lista"><div style="text-align:center;padding:20px;color:var(--text-light)"><span class="spinner spinner-dark"></span></div></div>
    </div>`;
  loadSaberes();
}

async function loadSaberes() {
  const lista = document.getElementById('saber-lista');
  if (!supabaseClient) { if (lista) lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🔑</div><p>Configure Supabase</p></div>'; return; }
  try {
    const { data, error } = await supabaseClient.from('saber_puesto').select('*').order('creado_en', { ascending: false });
    if (error) throw error;
    saberes = data || [];
    renderSaberLista();
  } catch(e) { if (lista) lista.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + escapeHtml(e.message) + '</p></div>'; }
}

function filtrarSaber(v) { puestoFiltro = v; renderSaberLista(); }

function renderSaberLista() {
  const lista = document.getElementById('saber-lista');
  if (!lista) return;
  const items = puestoFiltro === 'todas' ? saberes : saberes.filter(s => s.categoria === puestoFiltro);
  if (!items.length) { lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🎓</div><p>Todavía no hay información del puesto. Cargá lo que sepas o alimentá desde documentos.</p></div>'; return; }
  lista.innerHTML = items.map(s =>
    '<div class="card" style="margin-bottom:8px;border-left:4px solid var(--primary)">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
    '<div style="flex:1"><strong>' + escapeHtml(s.tema) + '</strong> ' +
    '<span class="badge" style="background:var(--primary);color:#fff;font-size:11px">' + escapeHtml(s.categoria || 'Otro') + '</span>' +
    (s.area ? ' <span style="font-size:12px;color:var(--text-light)">· ' + escapeHtml(s.area) + '</span>' : '') +
    '<p style="font-size:13px;margin-top:4px;white-space:pre-wrap">' + escapeHtml(s.contenido) + '</p></div>' +
    '<button class="btn btn-danger btn-sm" onclick="eliminarSaber(\'' + s.id + '\')">🗑️</button></div></div>'
  ).join('');
}

async function guardarSaber() {
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  const tema = document.getElementById('sp-tema').value.trim();
  const area = document.getElementById('sp-area').value.trim();
  const categoria = document.getElementById('sp-categoria').value;
  const contenido = document.getElementById('sp-contenido').value.trim();
  if (!tema || !contenido) { showToast('Complete tema y contenido', 'warning'); return; }
  try {
    const { error } = await supabaseClient.from('saber_puesto').insert({ tema, area: area || null, categoria, contenido, creado_en: new Date().toISOString() });
    if (error) throw error;
    document.getElementById('sp-tema').value = ''; document.getElementById('sp-area').value = ''; document.getElementById('sp-contenido').value = '';
    showToast('Saber guardado', 'success');
    loadSaberes();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function eliminarSaber(id) {
  if (!supabaseClient || !confirm('¿Eliminar este saber?')) return;
  try {
    const { error } = await supabaseClient.from('saber_puesto').delete().eq('id', id);
    if (error) throw error;
    showToast('Eliminado', 'success');
    loadSaberes();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// La IA lee los documentos cargados y agrega saberes del puesto
async function alimentarDesdeDocs() {
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  const btn = document.getElementById('alim-btn');
  btn.innerHTML = '<span class="spinner"></span> Analizando...';
  try {
    const { data } = await supabaseClient.from('documentos').select('nombre,tipo,contenido_texto').not('contenido_texto', 'is', null).limit(30);
    if (!data || !data.length) { showToast('No hay documentos con texto para analizar', 'warning'); return; }
    let total = 0;
    const existentes = new Set(saberes.map(s => (s.tema || '').toLowerCase()));
    for (const d of data) {
      const sys = 'Extraés conocimiento operativo del puesto de calidad a partir de un documento. Devolvés SOLO un array JSON con lo importante y duradero para trabajar en el área.';
      const msg = 'Documento "' + d.nombre + '":\n' + (d.contenido_texto || '').slice(0, 20000) +
        '\n\nDevolvé 1 a 5 items en JSON: [{"tema":"","area":"","categoria":"Procedimiento|Responsable|Contacto|Criterio de calidad|Proveedor|Equipo|Decisión histórica|Tip|Ubicación de archivos|Otro","contenido":""}]. Si no hay nada útil, [].';
      const resp = await callAI([{ role: 'user', content: msg }], sys);
      let arr;
      try { const jm = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || resp.match(/(\[[\s\S]*\])/); arr = JSON.parse((jm ? jm[1] : resp).trim()); } catch(e) { continue; }
      if (!Array.isArray(arr)) continue;
      const filas = arr.filter(x => x && x.tema && x.contenido && !existentes.has(String(x.tema).toLowerCase()))
        .map(x => { existentes.add(String(x.tema).toLowerCase()); return { tema: String(x.tema).slice(0,200), area: x.area || null, categoria: x.categoria || 'Otro', contenido: String(x.contenido).slice(0,3000), creado_en: new Date().toISOString() }; });
      if (filas.length) { const { error } = await supabaseClient.from('saber_puesto').insert(filas); if (!error) total += filas.length; }
    }
    showToast('Se agregaron ' + total + ' saberes del puesto', 'success');
    loadSaberes();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
  finally { btn.innerHTML = '🤖 Alimentar desde documentos'; }
}

// Chat "experto del puesto"
async function preguntarExperto() {
  const inp = document.getElementById('puesto-preg');
  const preg = inp.value.trim();
  if (!preg) return;
  inp.value = '';
  const cont = document.getElementById('puesto-chat');
  if (puestoChat.length === 0) cont.innerHTML = '';
  cont.innerHTML += '<div style="text-align:right;margin:6px 0"><span style="background:var(--primary);color:#fff;padding:8px 12px;border-radius:12px;display:inline-block;max-width:85%">' + escapeHtml(preg) + '</span></div>';
  const tid = 'pt' + Date.now();
  cont.innerHTML += '<div id="' + tid + '" style="margin:6px 0;color:var(--text-light)">El experto está pensando...</div>';
  cont.scrollTop = cont.scrollHeight;
  const btn = document.getElementById('puesto-preg-btn');
  btn.disabled = true;
  try {
    // Contexto: saber del puesto + conocimiento + documentos relevantes
    const puestoCtx = await getSaberPuestoContext();
    const conocimientoCtx = (typeof getConocimientoContext === 'function') ? await getConocimientoContext() : '';
    let docCtx = '';
    try {
      const { data } = await supabaseClient.from('documentos').select('nombre,carpeta,contenido_texto').limit(200);
      if (data && data.length) {
        const q = preg.toLowerCase();
        const palabras = q.split(/\s+/).filter(w => w.length >= 4);
        const rel = data.filter(d => d.contenido_texto).map(d => { const hay = (d.nombre + ' ' + d.contenido_texto).toLowerCase(); return { d, sc: palabras.reduce((s,w) => s + (hay.includes(w)?1:0), 0) }; }).filter(x => x.sc > 0).sort((a,b) => b.sc-a.sc).slice(0,4);
        const nombres = data.map(d => '📄 ' + d.nombre + ' (carpeta: ' + (d.carpeta||'General') + ')').join('\n');
        let cont2 = ''; let pres = 25000;
        for (const {d} of rel) { if (pres<=0) break; const f = d.contenido_texto.slice(0, Math.min(7000,pres)); pres -= f.length; cont2 += '\n\n--- ' + d.nombre + ' ---\n' + f; }
        docCtx = '\n\n=== DOCUMENTOS Y CARPETAS ===\n' + nombres + (cont2 ? '\n\n=== CONTENIDO RELEVANTE ===' + cont2 : '');
      }
    } catch(e) {}
    const sys = 'Sos el experto que sabe TODO del puesto de calidad de esta empresa fabricante de envases (FSSC 22000 v6). Respondés en español, concreto y práctico, como un colega que explica cómo se hacen las cosas en este puesto. Usá en este orden: la Base de Datos del Puesto, el contenido de los documentos y carpetas, y la Base de Conocimiento. Si la respuesta está en un archivo o carpeta, citá cuál. Si no lo sabés, decilo y sugerí qué información conviene cargar para que quede registrada.' + puestoCtx + conocimientoCtx + docCtx;
    puestoChat.push({ role: 'user', content: preg });
    const resp = await callAI([...puestoChat], sys);
    const t = document.getElementById(tid); if (t) t.remove();
    if (resp) {
      puestoChat.push({ role: 'assistant', content: resp });
      cont.innerHTML += '<div style="margin:6px 0"><span style="background:#fff;border:1px solid var(--border);padding:8px 12px;border-radius:12px;display:inline-block;max-width:90%">' + renderMarkdown(resp) + '</span></div>';
      cont.scrollTop = cont.scrollHeight;
    }
  } catch(e) { const t = document.getElementById(tid); if (t) t.remove(); showToast('Error: ' + e.message, 'error'); }
  finally { btn.disabled = false; }
}
