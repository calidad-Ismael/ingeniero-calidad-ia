// ======================================================================
// BASE DE CONOCIMIENTO (memoria de la empresa)
// ======================================================================
let conocimientos = [];

// Devuelve el contexto de conocimiento para inyectar en los prompts de la IA
async function getConocimientoContext() {
  if (!supabaseClient) return '';
  try {
    const { data } = await supabaseClient.from('conocimiento').select('titulo,categoria,contenido').order('creado_en', { ascending: true }).limit(300);
    if (!data || !data.length) return '';
    return '\n\n=== BASE DE CONOCIMIENTO DE LA EMPRESA (INSUTER) ===\nUsá esta información sobre la empresa como contexto para todas tus respuestas:\n\n' +
      data.map(c => '• [' + (c.categoria || 'General') + '] ' + c.titulo + ': ' + c.contenido).join('\n') +
      '\n=== FIN BASE DE CONOCIMIENTO ===';
  } catch(e) { return ''; }
}

function renderConocimiento() {
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>🧠 Base de Conocimiento</h2><p>Memoria de la empresa. Todo lo que guardes acá la IA lo usa como contexto en consultas, mails y generación.</p></div>
    <div class="card">
      <div class="card-title">➕ Agregar conocimiento manualmente</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Título / Dato</label>
          <input type="text" class="form-control" id="con-titulo" placeholder="Ej: Productos que fabrica INSUTER">
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-control" id="con-categoria">
            <option>Productos</option><option>Procesos</option><option>Clientes</option>
            <option>Parámetros de Control</option><option>Normas Aplicables</option>
            <option>Proveedores</option><option>General</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Contenido</label>
        <textarea class="form-control" id="con-contenido" style="min-height:80px" placeholder="Describí el dato clave de la empresa..."></textarea>
      </div>
      <button class="btn btn-primary" onclick="agregarConocimiento()">💾 Guardar conocimiento</button>
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span>📚 Conocimiento acumulado</span>
        <button class="btn btn-secondary btn-sm" onclick="destilarTodos()">🔍 Destilar de todos los documentos</button>
      </div>
      <div id="conocimiento-lista"><div style="text-align:center;padding:20px;color:var(--text-light)"><span class="spinner spinner-dark"></span></div></div>
    </div>`;
  loadConocimiento();
}

async function loadConocimiento() {
  const lista = document.getElementById('conocimiento-lista');
  if (!supabaseClient) { if (lista) lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🔑</div><p>Configure Supabase</p></div>'; return; }
  try {
    const { data, error } = await supabaseClient.from('conocimiento').select('*').order('creado_en', { ascending: false });
    if (error) throw error;
    conocimientos = data || [];
    renderConocimientoLista();
  } catch(e) {
    if (lista) lista.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + escapeHtml(e.message) + '</p></div>';
  }
}

function renderConocimientoLista() {
  const lista = document.getElementById('conocimiento-lista');
  if (!lista) return;
  if (!conocimientos.length) { lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🧠</div><p>Todavía no hay conocimiento. Agregá datos o subí documentos.</p></div>'; return; }
  const colores = { Productos: '#0052CC', Procesos: '#00875A', Clientes: '#6554C0', 'Parámetros de Control': '#FF8B00', 'Normas Aplicables': '#003399', Proveedores: '#974F0C', General: '#5E6C84' };
  lista.innerHTML = conocimientos.map(c =>
    '<div class="card" style="margin-bottom:8px;border-left:4px solid ' + (colores[c.categoria] || '#5E6C84') + '">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
    '<div style="flex:1"><strong>' + escapeHtml(c.titulo) + '</strong> ' +
    '<span class="badge" style="background:' + (colores[c.categoria] || '#5E6C84') + ';color:#fff;font-size:11px">' + escapeHtml(c.categoria || 'General') + '</span>' +
    (c.origen === 'auto' ? ' <span style="font-size:11px;color:var(--text-light)">🤖 auto</span>' : '') +
    '<p style="font-size:13px;color:var(--text);margin-top:4px">' + escapeHtml(c.contenido) + '</p>' +
    (c.documento_nombre ? '<p style="font-size:11px;color:var(--text-light);margin-top:2px">📄 de: ' + escapeHtml(c.documento_nombre) + '</p>' : '') +
    '</div>' +
    '<button class="btn btn-danger btn-sm" onclick="eliminarConocimiento(\'' + c.id + '\')">🗑️</button></div></div>'
  ).join('');
}

async function agregarConocimiento() {
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  const titulo = document.getElementById('con-titulo').value.trim();
  const categoria = document.getElementById('con-categoria').value;
  const contenido = document.getElementById('con-contenido').value.trim();
  if (!titulo || !contenido) { showToast('Complete título y contenido', 'warning'); return; }
  try {
    const { error } = await supabaseClient.from('conocimiento').insert({ titulo, categoria, contenido, origen: 'manual', creado_en: new Date().toISOString() });
    if (error) throw error;
    document.getElementById('con-titulo').value = '';
    document.getElementById('con-contenido').value = '';
    showToast('Conocimiento guardado', 'success');
    loadConocimiento();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function eliminarConocimiento(id) {
  if (!supabaseClient || !confirm('¿Eliminar este conocimiento?')) return;
  try {
    const { error } = await supabaseClient.from('conocimiento').delete().eq('id', id);
    if (error) throw error;
    showToast('Eliminado', 'success');
    loadConocimiento();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// Extrae conocimiento clave de un documento con IA y lo guarda
async function destilarConocimiento(nombre, tipo, texto) {
  if (!supabaseClient || !texto) return 0;
  try {
    const sys = 'Eres un analista que extrae conocimiento clave de documentos de una empresa fabricante de envases con sistema de calidad FSSC 22000. Tu tarea: leer el documento y extraer SOLO los datos importantes y duraderos sobre la empresa (productos, procesos, clientes, parámetros de control, normas aplicables, proveedores). Ignorá lo irrelevante o circunstancial. Responde ÚNICAMENTE con un array JSON.';
    const msg = 'Documento: "' + nombre + '" (' + tipo + ')\n\nContenido:\n' + texto.slice(0, 25000) + '\n\nExtraé entre 1 y 6 datos clave. Devolvé exactamente este formato JSON (sin texto adicional):\n[{"titulo":"dato breve","categoria":"Productos|Procesos|Clientes|Parámetros de Control|Normas Aplicables|Proveedores|General","contenido":"explicación concreta del dato"}]\nSi no hay nada relevante, devolvé [].';
    const resp = await callAI([{ role: 'user', content: msg }], sys);
    if (!resp) return 0;
    let arr;
    try {
      const jm = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || resp.match(/(\[[\s\S]*\])/);
      arr = JSON.parse((jm ? jm[1] : resp).trim());
    } catch(e) { return 0; }
    if (!Array.isArray(arr) || !arr.length) return 0;
    const filas = arr.filter(x => x && x.titulo && x.contenido).map(x => ({
      titulo: String(x.titulo).slice(0, 200), categoria: x.categoria || 'General',
      contenido: String(x.contenido).slice(0, 2000), origen: 'auto',
      documento_nombre: nombre, creado_en: new Date().toISOString()
    }));
    if (!filas.length) return 0;
    const { error } = await supabaseClient.from('conocimiento').insert(filas);
    if (error) return 0;
    return filas.length;
  } catch(e) { return 0; }
}

async function destilarTodos() {
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  showToast('Analizando documentos...', 'info');
  try {
    const { data } = await supabaseClient.from('documentos').select('nombre,tipo,contenido_texto').not('contenido_texto', 'is', null).limit(50);
    if (!data || !data.length) { showToast('No hay documentos con texto para analizar', 'warning'); return; }
    let total = 0;
    for (const d of data) { total += await destilarConocimiento(d.nombre, d.tipo, d.contenido_texto); }
    showToast('Se agregaron ' + total + ' datos a la base de conocimiento', 'success');
    loadConocimiento();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function processDocWithAI() {
  if (!selectedDocId) return;
  const doc = uploadedDocs.find(d => d.id === selectedDocId);
  const instr = (document.getElementById('ai-instruction').value.trim()) || 'Resume este documento y extrae los puntos más importantes relacionados con calidad e inocuidad alimentaria.';
  const btn = document.getElementById('proc-btn-text');
  btn.innerHTML = '<span class="spinner"></span> Procesando...';
  try {
    const sys = 'Eres un experto en gestión de calidad e inocuidad alimentaria (FSSC 22000, BRC, IFS, ISO 22000). Analiza documentos técnicos y brinda respuestas claras, directas y estructuradas en español, sin rodeos.' + (await getConocimientoContext());
    const contenido = doc.contenido_texto ? '\n\nCONTENIDO DEL DOCUMENTO:\n' + doc.contenido_texto.slice(0, 30000) : '\n\n(No hay texto extraído de este documento; analizá según el nombre y tu conocimiento.)';
    const msgs = [{ role: 'user', content: 'Documento: "' + doc.nombre + '" (tipo: ' + doc.tipo + ')\n\nInstrucción: ' + instr + contenido }];
    const result = await callAI(msgs, sys);
    if (result) {
      const panel = document.getElementById('ai-result-panel');
      panel.style.display = 'block';
      panel.innerHTML = '<div style="font-weight:700;color:var(--primary);margin-bottom:10px">🤖 Resultado del análisis IA:</div>' + renderMarkdown(result);
      panel.scrollIntoView({ behavior: 'smooth' });
    }
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
  finally { btn.innerHTML = '🤖 Procesar con IA'; }
}

async function markObsolete() {
  if (!selectedDocId || !supabaseClient) return;
  const doc = uploadedDocs.find(d => d.id === selectedDocId);
  if (!confirm('¿Pasar "' + doc.nombre + '" a obsoletos?')) return;
  try {
    const { error: ie } = await supabaseClient.from('documentos_obsoletos').insert({ nombre: doc.nombre, tipo: doc.tipo, storage_url: doc.storage_url, storage_path: doc.storage_path, carpeta: doc.carpeta || 'General', obsoleto_en: new Date().toISOString() });
    if (ie) throw ie;
    const { error: de } = await supabaseClient.from('documentos').delete().eq('id', doc.id);
    if (de) throw de;
    showToast('Documento pasado a obsoletos', 'success');
    selectedDocId = null;
    const sp = document.getElementById('selected-doc-panel');
    if (sp) sp.style.display = 'none';
    const rp = document.getElementById('ai-result-panel');
    if (rp) rp.style.display = 'none';
    loadDocuments();
    loadDocumentCount();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

