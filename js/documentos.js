// ======================================================================
// MODULE 2: DOCUMENTOS
// ======================================================================
function renderDocumentos() {
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>📁 Gestión de Documentos</h2><p>Suba, gestione y procese sus documentos técnicos con IA</p></div>
    <div style="display:flex;gap:16px;align-items:flex-start">
      <!-- Panel de carpetas -->
      <div style="min-width:200px;max-width:220px">
        <div class="card" style="padding:12px">
          <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">📂 Carpetas</div>
          <div id="carpetas-lista"></div>
          <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
            <input type="text" id="nueva-carpeta-input" class="form-control" style="font-size:12px;padding:6px 8px;margin-bottom:6px" placeholder="Nueva carpeta...">
            <button class="btn btn-primary" style="width:100%;font-size:12px;padding:6px" onclick="crearCarpeta()">+ Crear carpeta</button>
          </div>
        </div>
      </div>
      <!-- Contenido principal -->
      <div style="flex:1;min-width:0">
        <div class="card">
          <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
            <div class="drop-zone-icon">📂</div>
            <p><strong>Haga clic o arrastre archivos aquí</strong></p>
            <p style="font-size:13px;margin-top:4px">Se subirán a: <strong id="carpeta-destino-label">Todas</strong></p>
            <p style="font-size:12px;color:var(--text-light)">PDF, DOCX, XLSX — máx. 50 MB</p>
          </div>
          <input type="file" id="file-input" style="display:none" accept=".pdf,.docx,.xlsx" multiple onchange="handleFileSelect(event)">
        </div>
        <div id="upload-progress" style="display:none" class="card">
          <p id="upload-status" style="font-size:14px;margin-bottom:8px">Subiendo...</p>
          <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
        </div>
        <div id="file-cards-area">
          <div style="text-align:center;padding:30px;color:var(--text-light)"><span class="spinner spinner-dark"></span><p style="margin-top:12px">Cargando documentos...</p></div>
        </div>
        <div id="selected-doc-panel" style="display:none" class="card">
          <div class="card-title" id="selected-doc-title"></div>
          <div class="form-group">
            <label class="form-label">Nombre del documento</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="text" class="form-control" id="edit-nombre" style="flex:1;min-width:200px">
              <button class="btn btn-secondary btn-sm" onclick="renombrarDoc()">✏️ Renombrar</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Mover a carpeta</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <select class="form-control" id="mover-carpeta-select" style="flex:1;min-width:200px"></select>
              <button class="btn btn-secondary btn-sm" onclick="moverDocACarpeta()">📁 Mover</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Instrucción para la IA</label>
            <textarea class="form-control" id="ai-instruction" style="min-height:80px" placeholder="Ej: Resume este documento, extrae los puntos clave, identifica los requisitos normativos..."></textarea>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="processDocWithAI()"><span id="proc-btn-text">🤖 Procesar con IA</span></button>
            <button class="btn btn-secondary btn-sm" onclick="markObsolete()">🗄️ Pasar a Obsoleto</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarDoc()">🗑️ Eliminar</button>
          </div>
          <div id="word-tools" style="display:none;margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
            <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:10px">🔧 Herramientas Word (servidor de conversión)</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
              <button class="btn btn-accent btn-sm" onclick="convertirAPdfExacto()"><span id="conv-btn-text">📄 Convertir a PDF exacto</span></button>
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label class="form-label">✏️ Editar con IA (cambia el contenido y sube la revisión)</label>
              <textarea class="form-control" id="edit-ia-instruccion" style="min-height:70px" placeholder="Ej: Cambiá el tamaño de 50 mm a 60 mm. Cambiá la temperatura de sellado a 180°C..."></textarea>
            </div>
            <button class="btn btn-primary btn-sm" onclick="editarWordConIA()"><span id="edit-ia-btn-text">✏️ Aplicar cambios y subir revisión</span></button>
            <p style="font-size:12px;color:var(--text-light);margin-top:6px">El documento viejo pasa a Obsoletos (misma carpeta) y se sube la nueva versión con la revisión incrementada.</p>
          </div>
        </div>
        <div id="ai-result-panel"></div>
      </div>
    </div>`;
  setupDropZone();
  loadDocuments();
}

function getCarpetas() {
  const raw = localStorage.getItem('iq_carpetas');
  return raw ? JSON.parse(raw) : ['General', 'Especificaciones', 'Certificados', 'Procedimientos', 'Auditorías'];
}

function saveCarpetas(list) {
  localStorage.setItem('iq_carpetas', JSON.stringify(list));
}

function renderCarpetas() {
  const lista = document.getElementById('carpetas-lista');
  if (!lista) return;
  const carpetas = getCarpetas();
  const todos = [{ id: 'todas', label: '📋 Todos los documentos' }, ...carpetas.map(c => ({ id: c, label: '📁 ' + c }))];
  lista.innerHTML = todos.map(c =>
    `<div onclick="filtrarCarpeta('${c.id}')" style="padding:7px 10px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:2px;background:${carpetaActual===c.id?'var(--primary)':'transparent'};color:${carpetaActual===c.id?'#fff':'var(--text)'};transition:.15s">${c.label}</div>`
  ).join('');
  // Actualizar label destino
  const lbl = document.getElementById('carpeta-destino-label');
  if (lbl) lbl.textContent = carpetaActual === 'todas' ? 'General' : carpetaActual;
  // Actualizar select de mover
  const sel = document.getElementById('mover-carpeta-select');
  if (sel) sel.innerHTML = carpetas.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filtrarCarpeta(id) {
  carpetaActual = id;
  renderCarpetas();
  renderFileCards();
}

function crearCarpeta() {
  const inp = document.getElementById('nueva-carpeta-input');
  const nombre = inp.value.trim();
  if (!nombre) return;
  const carpetas = getCarpetas();
  if (carpetas.includes(nombre)) { showToast('Esa carpeta ya existe', 'warning'); return; }
  carpetas.push(nombre);
  saveCarpetas(carpetas);
  inp.value = '';
  carpetaActual = nombre;
  renderCarpetas();
  showToast('Carpeta "' + nombre + '" creada', 'success');
}

async function moverDocACarpeta() {
  if (!selectedDocId || !supabaseClient) return;
  const sel = document.getElementById('mover-carpeta-select');
  const carpeta = sel ? sel.value : '';
  if (!carpeta) return;
  try {
    const { error } = await supabaseClient.from('documentos').update({ carpeta }).eq('id', selectedDocId);
    if (error) throw error;
    showToast('Documento movido a "' + carpeta + '"', 'success');
    await loadDocuments();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function setupDropZone() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|docx|xlsx)$/i.test(f.name));
    if (files.length) uploadFiles(files);
    else showToast('Solo se aceptan archivos PDF, DOCX o XLSX', 'warning');
  });
}

function handleFileSelect(e) { if (e.target.files.length) uploadFiles(Array.from(e.target.files)); }

// Extrae el texto interno de un archivo PDF o Word (.docx) en el navegador
async function extraerTexto(file, ext) {
  try {
    if (ext === 'pdf' && window.pdfjsLib) {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let texto = '';
      const maxPag = Math.min(pdf.numPages, 40); // límite para no excederse
      for (let p = 1; p <= maxPag; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        texto += content.items.map(it => it.str).join(' ') + '\n';
      }
      return texto.trim();
    }
    if ((ext === 'docx' || ext === 'doc') && window.mammoth) {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      return (result.value || '').trim();
    }
  } catch(e) { console.warn('No se pudo extraer texto de ' + file.name + ':', e); }
  return '';
}

async function uploadFiles(files) {
  if (!supabaseClient) { showToast('Configure Supabase primero', 'error'); return; }
  // Aviso de duplicados: nombres que ya existen en el sistema
  const existentes = (uploadedDocs || []).map(d => d.nombre.toLowerCase());
  const duplicados = files.filter(f => existentes.includes(f.name.toLowerCase()));
  if (duplicados.length) {
    const lista = duplicados.map(f => '• ' + f.name).join('\n');
    if (!confirm('⚠️ Ya existe' + (duplicados.length > 1 ? 'n estos documentos' : ' este documento') + ' en el sistema:\n\n' + lista + '\n\n¿Subir de todos modos (quedará duplicado)?')) {
      showToast('Subida cancelada', 'info');
      return;
    }
  }
  document.getElementById('upload-progress').style.display = 'block';
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    document.getElementById('upload-status').textContent = 'Subiendo ' + file.name + '...';
    document.getElementById('progress-fill').style.width = Math.round(((i + 0.5) / files.length) * 100) + '%';
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const carpetaDest = (carpetaActual === 'todas') ? 'General' : carpetaActual;
      const path = carpetaDest + '/' + Date.now() + '_' + file.name;
      // Extraer texto interno (PDF / Word) para que la IA pueda leer el contenido
      document.getElementById('upload-status').textContent = 'Leyendo contenido de ' + file.name + '...';
      const contenidoTexto = await extraerTexto(file, ext);
      document.getElementById('upload-status').textContent = 'Subiendo ' + file.name + '...';
      const { error: se } = await supabaseClient.storage.from('documentos').upload(path, file);
      if (se) throw se;
      const { data: ud } = supabaseClient.storage.from('documentos').getPublicUrl(path);
      const publicUrl = ud.publicUrl.includes('/object/public/')
        ? ud.publicUrl
        : ud.publicUrl.replace('/object/', '/object/public/');
      const { error: de } = await supabaseClient.from('documentos').insert({
        nombre: file.name, tipo: ext.toUpperCase(),
        storage_url: publicUrl, storage_path: path,
        tamano: file.size, carpeta: carpetaDest,
        contenido_texto: contenidoTexto ? contenidoTexto.slice(0, 50000) : null,
        creado_en: new Date().toISOString()
      });
      if (de) throw de;
      showToast(file.name + (contenidoTexto ? ' subido (contenido leído ✓)' : ' subido') , 'success');
      // Extracción automática de conocimiento de la empresa
      if (contenidoTexto) {
        document.getElementById('upload-status').textContent = 'Aprendiendo de ' + file.name + '...';
        const n = await destilarConocimiento(file.name, ext.toUpperCase(), contenidoTexto);
        if (n > 0) showToast('🧠 ' + n + ' dato(s) agregados a la base de conocimiento', 'info');
      }
    } catch(e) { showToast('Error subiendo ' + file.name + ': ' + e.message, 'error'); }
  }
  document.getElementById('progress-fill').style.width = '100%';
  document.getElementById('upload-status').textContent = 'Carga completa';
  setTimeout(() => { const el = document.getElementById('upload-progress'); if (el) el.style.display = 'none'; }, 2000);
  loadDocuments();
  loadDocumentCount();
}

async function loadDocuments() {
  if (!supabaseClient) {
    const a = document.getElementById('file-cards-area');
    if (a) a.innerHTML = '<div class="empty-state"><div class="empty-icon">🔑</div><p>Configure Supabase para ver documentos</p></div>';
    return;
  }
  try {
    const { data, error } = await supabaseClient.from('documentos').select('*').order('creado_en', { ascending: false });
    if (error) throw error;
    uploadedDocs = data || [];
    renderFileCards();
  } catch(e) {
    const a = document.getElementById('file-cards-area');
    if (a) a.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error cargando documentos: ' + escapeHtml(e.message) + '</p></div>';
  }
}

function renderFileCards() {
  const area = document.getElementById('file-cards-area');
  if (!area) return;
  renderCarpetas();
  const filtered = carpetaActual === 'todas'
    ? uploadedDocs
    : uploadedDocs.filter(d => (d.carpeta || 'General') === carpetaActual);
  if (!uploadedDocs.length) { area.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>No hay documentos. Suba su primer archivo.</p></div>'; return; }
  if (!filtered.length) { area.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>No hay documentos en esta carpeta.</p></div>'; return; }
  const icons = { PDF: '📄', DOCX: '📝', XLSX: '📊' };
  const bc = { PDF: 'badge-pdf', DOCX: 'badge-docx', XLSX: 'badge-xlsx' };
  const titulo = carpetaActual === 'todas' ? 'Todos los documentos' : '📁 ' + carpetaActual;
  // Detectar nombres duplicados (en todo el sistema, no solo la carpeta)
  const conteo = {};
  uploadedDocs.forEach(d => { const k = d.nombre.toLowerCase(); conteo[k] = (conteo[k] || 0) + 1; });
  const totalDup = Object.values(conteo).filter(n => n > 1).length;
  const avisoDup = totalDup ? '<div style="background:#fff3cd;border:1px solid #ffe08a;color:#7a5b00;padding:8px 12px;border-radius:8px;font-size:13px;margin-bottom:12px">⚠️ Hay ' + totalDup + ' nombre(s) de documento duplicado(s). Revisá y eliminá los que sobren.</div>' : '';
  area.innerHTML = avisoDup + '<h3 style="margin-bottom:14px;color:var(--primary);font-size:15px">' + titulo + ' (' + filtered.length + ')</h3><div class="file-cards">' +
    filtered.map(doc => { const esDup = conteo[doc.nombre.toLowerCase()] > 1;
      return '<div class="file-card ' + (selectedDocId === doc.id ? 'selected' : '') + '" onclick="selectDoc(\'' + doc.id + '\')">' +
      '<div class="file-card-icon">' + (icons[doc.tipo] || '📄') + '</div>' +
      '<div class="file-card-name">' + (esDup ? '⚠️ ' : '') + escapeHtml(doc.nombre) + '</div>' +
      '<div class="file-card-meta"><span class="badge ' + (bc[doc.tipo] || '') + '">' + escapeHtml(doc.tipo || '') + '</span>' +
      (doc.tamano ? ' · ' + Math.round(doc.tamano / 1024) + ' KB' : '') + '</div>' +
      '<div class="file-card-meta" style="margin-top:4px;color:var(--text-light)">' + (doc.carpeta || 'General') + ' · ' + formatDate(doc.creado_en) + '</div></div>'; }).join('') + '</div>';
}

function selectDoc(id) {
  selectedDocId = id === selectedDocId ? null : id;
  renderFileCards();
  const panel = document.getElementById('selected-doc-panel');
  if (!panel) return;
  if (selectedDocId) {
    const doc = uploadedDocs.find(d => d.id === id);
    document.getElementById('selected-doc-title').textContent = '📄 ' + doc.nombre;
    const inp = document.getElementById('edit-nombre');
    if (inp) inp.value = doc.nombre;
    // Herramientas Word solo para .docx y si hay servidor de conversión configurado
    const wt = document.getElementById('word-tools');
    const esWord = (doc.tipo || '').toUpperCase() === 'DOCX' || /\.docx?$/i.test(doc.nombre);
    if (wt) wt.style.display = (esWord && getConvertApi()) ? 'block' : 'none';
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
    const r = document.getElementById('ai-result-panel');
    if (r) r.style.display = 'none';
  }
}

async function renombrarDoc() {
  if (!selectedDocId || !supabaseClient) return;
  const nuevo = document.getElementById('edit-nombre').value.trim();
  if (!nuevo) { showToast('El nombre no puede estar vacío', 'warning'); return; }
  // Avisar si ya existe otro documento con ese nombre
  const dup = uploadedDocs.find(d => d.id !== selectedDocId && d.nombre.toLowerCase() === nuevo.toLowerCase());
  if (dup && !confirm('Ya existe otro documento llamado "' + nuevo + '". ¿Renombrar de todos modos?')) return;
  try {
    const { error } = await supabaseClient.from('documentos').update({ nombre: nuevo }).eq('id', selectedDocId);
    if (error) throw error;
    showToast('Documento renombrado', 'success');
    await loadDocuments();
    renderFileCards(); // mantiene la selección actual resaltada
    const t = document.getElementById('selected-doc-title');
    if (t) t.textContent = '📄 ' + nuevo;
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function eliminarDoc() {
  if (!selectedDocId || !supabaseClient) return;
  const doc = uploadedDocs.find(d => d.id === selectedDocId);
  if (!doc) return;
  if (!confirm('¿Eliminar DEFINITIVAMENTE "' + doc.nombre + '"? Se borra el archivo y no se puede deshacer.')) return;
  try {
    if (doc.storage_path) { try { await supabaseClient.storage.from('documentos').remove([doc.storage_path]); } catch(e) {} }
    const { error } = await supabaseClient.from('documentos').delete().eq('id', doc.id);
    if (error) throw error;
    selectedDocId = null;
    document.getElementById('selected-doc-panel').style.display = 'none';
    showToast('Documento eliminado', 'success');
    await loadDocuments();
    loadDocumentCount();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ======================================================================
// HERRAMIENTAS WORD (servidor de conversión LibreOffice en Railway)
// ======================================================================

// Descarga el .docx desde Supabase Storage como File
async function fetchDocxComoFile(doc) {
  const resp = await fetch(doc.storage_url);
  if (!resp.ok) throw new Error('No se pudo descargar el archivo (' + resp.status + ')');
  const blob = await resp.blob();
  return new File([blob], doc.nombre, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

// Convierte el Word seleccionado a PDF EXACTO usando el servidor
async function convertirAPdfExacto() {
  const api = getConvertApi();
  if (!api) { showToast('Configure la URL del servidor de conversión (⚙)', 'error'); return; }
  const doc = uploadedDocs.find(d => d.id === selectedDocId);
  if (!doc) return;
  const btn = document.getElementById('conv-btn-text');
  btn.innerHTML = '<span class="spinner"></span> Convirtiendo...';
  try {
    const file = await fetchDocxComoFile(doc);
    const fd = new FormData();
    fd.append('archivo', file);
    const resp = await fetch(api + '/convertir-pdf', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error(await resp.text());
    const pdfBlob = await resp.blob();
    descargarBlob(pdfBlob, doc.nombre.replace(/\.docx?$/i, '') + '.pdf');
    showToast('PDF exacto generado', 'success');
  } catch(e) { showToast('Error al convertir: ' + e.message, 'error'); }
  finally { btn.innerHTML = '📄 Convertir a PDF exacto'; }
}

// Edita el Word con IA: pide cambios, sube revisión, manda viejo a obsoletos, ofrece PDF
async function editarWordConIA() {
  const api = getConvertApi();
  if (!api) { showToast('Configure la URL del servidor de conversión (⚙)', 'error'); return; }
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  const doc = uploadedDocs.find(d => d.id === selectedDocId);
  if (!doc) return;
  const instruccion = document.getElementById('edit-ia-instruccion').value.trim();
  if (!instruccion) { showToast('Escribí qué querés cambiar', 'warning'); return; }
  const btn = document.getElementById('edit-ia-btn-text');
  btn.innerHTML = '<span class="spinner"></span> Procesando...';
  try {
    // 1) Pedirle a la IA los pares buscar/reemplazar concretos según el contenido real
    const sys = 'Sos un asistente que traduce instrucciones de edición a reemplazos de texto EXACTOS sobre un documento Word. Solo podés reemplazar texto que exista textualmente en el documento. Responde ÚNICAMENTE con un array JSON.';
    const contexto = doc.contenido_texto ? '\n\nTEXTO ACTUAL DEL DOCUMENTO:\n' + doc.contenido_texto.slice(0, 30000) : '';
    const msg = 'Documento: "' + doc.nombre + '"' + contexto + '\n\nInstrucción del usuario: ' + instruccion +
      '\n\nDevolvé los reemplazos exactos a realizar. El texto en "buscar" DEBE aparecer tal cual en el documento. Formato JSON estricto (sin texto adicional):\n[{"buscar":"texto exacto actual","reemplazar":"texto nuevo"}]\nNo incluyas el número de revisión (se actualiza automáticamente). Si no podés identificar texto exacto, devolvé [].';
    const resp = await callAI([{ role: 'user', content: msg }], sys);
    let pares;
    try {
      const jm = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || resp.match(/(\[[\s\S]*\])/);
      pares = JSON.parse((jm ? jm[1] : resp).trim());
    } catch(e) { throw new Error('La IA no devolvió reemplazos válidos'); }
    if (!Array.isArray(pares) || !pares.length) {
      throw new Error('No se identificó texto exacto para cambiar. Probá ser más específico (copiá el texto tal cual está en el documento).');
    }
    // Confirmar cambios al usuario
    const resumen = pares.map(p => '• "' + p.buscar + '" → "' + p.reemplazar + '"').join('\n');
    if (!confirm('Se aplicarán estos cambios:\n\n' + resumen + '\n\n¿Continuar?')) { btn.innerHTML = '✏️ Aplicar cambios y subir revisión'; return; }

    // 2) Enviar al servidor para editar el .docx preservando formato + subir revisión
    const file = await fetchDocxComoFile(doc);
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('reemplazos', JSON.stringify(pares));
    fd.append('subir_revision', 'true');
    const r2 = await fetch(api + '/editar-word', { method: 'POST', body: fd });
    if (!r2.ok) throw new Error(await r2.text());
    const nuevaRev = r2.headers.get('X-Nueva-Revision') || '';
    const nuevoBlob = await r2.blob();

    // 3) Mandar el documento VIEJO a obsoletos (misma carpeta)
    const carpeta = doc.carpeta || 'General';
    await supabaseClient.from('documentos_obsoletos').insert({
      nombre: doc.nombre, tipo: doc.tipo, storage_url: doc.storage_url,
      storage_path: doc.storage_path, carpeta: carpeta, obsoleto_en: new Date().toISOString()
    });
    await supabaseClient.from('documentos').delete().eq('id', doc.id);

    // 4) Subir la NUEVA versión a Storage (misma carpeta)
    const nuevoFile = new File([nuevoBlob], doc.nombre, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const nuevoPath = carpeta + '/' + Date.now() + '_' + doc.nombre;
    const { error: se } = await supabaseClient.storage.from('documentos').upload(nuevoPath, nuevoFile);
    if (se) throw se;
    const { data: ud } = supabaseClient.storage.from('documentos').getPublicUrl(nuevoPath);
    const nuevoUrl = ud.publicUrl.includes('/object/public/') ? ud.publicUrl : ud.publicUrl.replace('/object/', '/object/public/');
    // Re-extraer texto de la nueva versión
    let nuevoTexto = '';
    try { nuevoTexto = await extraerTexto(nuevoFile, 'docx'); } catch(e) {}
    await supabaseClient.from('documentos').insert({
      nombre: doc.nombre, tipo: doc.tipo, storage_url: nuevoUrl, storage_path: nuevoPath,
      tamano: nuevoFile.size, carpeta: carpeta,
      contenido_texto: nuevoTexto ? nuevoTexto.slice(0, 50000) : null,
      creado_en: new Date().toISOString()
    });

    showToast('✅ Cambios aplicados' + (nuevaRev ? ' · Revisión → ' + nuevaRev : '') + '. El anterior pasó a Obsoletos.', 'success');
    document.getElementById('edit-ia-instruccion').value = '';
    await loadDocuments();
    loadDocumentCount();

    // 5) Ofrecer PDF de la nueva versión
    if (confirm('¿Querés el PDF de la nueva versión?')) {
      const fd2 = new FormData();
      fd2.append('archivo', nuevoFile);
      const r3 = await fetch(api + '/convertir-pdf', { method: 'POST', body: fd2 });
      if (r3.ok) {
        const pdfBlob = await r3.blob();
        descargarBlob(pdfBlob, doc.nombre.replace(/\.docx?$/i, '') + '.pdf');
        showToast('PDF de la nueva versión descargado', 'success');
      } else {
        showToast('No se pudo generar el PDF', 'error');
      }
    }
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
  finally { btn.innerHTML = '✏️ Aplicar cambios y subir revisión'; }
}

