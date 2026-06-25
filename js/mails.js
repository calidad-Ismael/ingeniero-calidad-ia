// ======================================================================
// MODULE 4: GESTOR DE MAILS
// ======================================================================
function renderMails() {
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>📧 Gestor de Mails</h2><p>Procese correos electrónicos y genere documentos automáticamente con IA</p></div>
    <div class="card">
      <div class="form-group">
        <label class="form-label">Texto del correo recibido</label>
        <textarea class="form-control" id="mail-text" style="min-height:200px" placeholder="Pegue aquí el correo electrónico completo que desea procesar..."></textarea>
      </div>
      <button class="btn btn-primary" id="mail-btn" onclick="procesarMail()" style="width:100%;justify-content:center;padding:14px;font-size:16px">
        📧 Procesar Mail con IA
      </button>
    </div>
    <div class="mail-result" id="mail-result">
      <div class="card">
        <div class="card-title">✉️ Información extraída</div>
        <div id="mail-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"></div>
      </div>
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>📝 Respuesta sugerida</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="copyReply()">📋 Copiar</button>
            <a id="gmail-link" href="#" target="_blank" class="btn btn-accent btn-sm">📤 Abrir en Gmail</a>
          </div>
        </div>
        <textarea id="mail-reply" placeholder="La respuesta generada aparecerá aquí..."></textarea>
      </div>
      <div class="card" id="mail-existentes-card" style="display:none">
        <div class="card-title">📎 Documentos encontrados en el sistema</div>
        <div id="mail-existentes-list"></div>
      </div>
      <div class="card" id="mail-docs-card" style="display:none">
        <div class="card-title">📄 Documentos a generar</div>
        <div id="mail-docs-list"></div>
      </div>
    </div>`;
}

async function procesarMail() {
  const text = document.getElementById('mail-text').value.trim();
  if (!text) { showToast('Ingrese el texto del correo', 'warning'); return; }
  const btn = document.getElementById('mail-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analizando con IA...';
  try {
    // Buscar documentos existentes para que la IA pueda identificar cuáles adjuntar
    let docsExistentes = [];
    if (supabaseClient) {
      try {
        const { data } = await supabaseClient.from('documentos').select('id,nombre,tipo,carpeta,storage_url,contenido_texto').limit(200);
        docsExistentes = data || [];
      } catch(e) {}
    }
    window._docsExistentes = docsExistentes;
    const listaDocs = docsExistentes.length
      ? docsExistentes.map((d, i) => i + ': "' + d.nombre + '" (' + (d.tipo || '') + ', carpeta: ' + (d.carpeta || 'General') + ')' +
          (d.contenido_texto ? '\n   Contenido: ' + d.contenido_texto.slice(0, 2000).replace(/\n+/g, ' ') : '')).join('\n')
      : '(no hay documentos cargados en el sistema)';
    const sys = 'Eres un Ingeniero de Calidad experto en FSSC 22000 v6, BRC e ISO 22000, especializado en fabricación de envases. Analizas correos de clientes que piden documentación (certificados, especificaciones, fichas técnicas, etc). Tu trabajo: (1) entender qué piden, (2) buscar en la lista de documentos cargados cuáles ya existen y sirven para responder, (3) decidir cuáles hay que generar de cero, (4) redactar una respuesta profesional, cordial y CONCISA en español. Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.' + (await getConocimientoContext());
    const msg = 'DOCUMENTOS CARGADOS EN EL SISTEMA (índice: nombre):\n' + listaDocs + '\n\n' +
      'Analiza el correo y devuelve exactamente este JSON:\n' +
      '{"remitente":"nombre y email si aparece","asunto":"asunto sugerido para responder","respuesta_email":"respuesta profesional completa y concisa en español, mencionando los documentos que se adjuntan","documentos_existentes":[indices numericos de los documentos cargados que responden al pedido],"documentos_a_generar":[{"tipo":"Word|Excel|PDF","subtipo":"Especificación Técnica|Certificado de Calidad|Informe de Análisis|Procedimiento|Acta|Registro de Control|Planilla de Auditoría|Matriz de Riesgos|Reporte de Hallazgos|Certificado Formal","cliente":"nombre","producto":"producto","descripcion":"qué debe contener"}]}\n\n' +
      'IMPORTANTE: si un documento pedido YA EXISTE en la lista, ponelo en "documentos_existentes" (no lo generes de nuevo). Solo poné en "documentos_a_generar" lo que realmente falta.\n\nCorreo recibido:\n' + text;
    const response = await callAI([{ role: 'user', content: msg }], sys);
    if (!response) throw new Error('Sin respuesta de la IA');
    let parsed;
    try {
      const jm = response.match(/```(?:json)?\s*([\s\S]*?)```/) || response.match(/(\{[\s\S]*\})/);
      parsed = JSON.parse((jm ? jm[1] : response).trim());
    } catch(e) { throw new Error('Error parseando respuesta JSON'); }
    document.getElementById('mail-result').style.display = 'block';
    document.getElementById('mail-info-grid').innerHTML =
      '<div><span class="form-label">Remitente</span><p style="font-size:14px">' + escapeHtml(parsed.remitente || '—') + '</p></div>' +
      '<div><span class="form-label">Asunto</span><p style="font-size:14px">' + escapeHtml(parsed.asunto || '—') + '</p></div>';
    // Documentos existentes que la IA identificó para adjuntar
    const existentesIdx = Array.isArray(parsed.documentos_existentes) ? parsed.documentos_existentes : [];
    const existentes = existentesIdx.map(i => docsExistentes[i]).filter(Boolean);
    renderMailExistentes(existentes);
    const reply = parsed.respuesta_email || '';
    document.getElementById('mail-reply').value = reply;
    const su = encodeURIComponent(parsed.asunto ? 'RE: ' + parsed.asunto : 'Respuesta');
    const bo = encodeURIComponent(reply);
    document.getElementById('gmail-link').href = 'https://mail.google.com/mail/?view=cm&su=' + su + '&body=' + bo;
    const docs = parsed.documentos_a_generar || [];
    if (docs.length) {
      document.getElementById('mail-docs-card').style.display = 'block';
      document.getElementById('mail-docs-list').innerHTML = docs.map((d, i) =>
        '<div class="card" style="margin-bottom:10px;border-left:4px solid var(--primary)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div><strong>' + escapeHtml(d.subtipo) + '</strong> <span style="font-size:12px;color:var(--text-light)">' + escapeHtml(d.tipo) + '</span><br>' +
        '<span style="font-size:13px;color:var(--text-light)">' + escapeHtml(d.cliente || '') + (d.producto ? ' · ' + d.producto : '') + '</span></div>' +
        '<button class="btn btn-secondary btn-sm" onclick="generateMailDoc(' + i + ')">⬇️ Generar y Descargar</button></div>' +
        '<p style="font-size:13px;color:var(--text-light);margin-top:8px">' + escapeHtml(d.descripcion || '') + '</p></div>'
      ).join('');
      window._mailDocs = docs;
    }
    if (supabaseClient) {
      try { await supabaseClient.from('mails_procesados').insert({ texto_recibido: text, respuesta_generada: reply, documentos_generados: docs, procesado_en: new Date().toISOString() }); } catch(e) {}
    }
    document.getElementById('mail-result').scrollIntoView({ behavior: 'smooth' });
    showToast('Mail procesado correctamente', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '📧 Procesar Mail con IA'; }
}

function renderMailExistentes(existentes) {
  const card = document.getElementById('mail-existentes-card');
  const list = document.getElementById('mail-existentes-list');
  if (!card || !list) return;
  if (!existentes || !existentes.length) { card.style.display = 'none'; list.innerHTML = ''; return; }
  const icons = { PDF: '📄', DOCX: '📝', XLSX: '📊' };
  card.style.display = 'block';
  list.innerHTML = existentes.map(d =>
    '<div class="card" style="margin-bottom:10px;border-left:4px solid var(--success)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
    '<div><strong>' + (icons[d.tipo] || '📄') + ' ' + escapeHtml(d.nombre) + '</strong><br>' +
    '<span style="font-size:13px;color:var(--text-light)">' + escapeHtml(d.tipo || '') + ' · carpeta: ' + escapeHtml(d.carpeta || 'General') + '</span></div>' +
    '<a class="btn btn-success btn-sm" href="' + escapeHtml(d.storage_url) + '" target="_blank" download>⬇️ Descargar</a></div></div>'
  ).join('');
}

function copyReply() {
  const t = document.getElementById('mail-reply').value;
  navigator.clipboard.writeText(t).then(() => showToast('Respuesta copiada', 'success')).catch(() => showToast('Error copiando', 'error'));
}

async function generateMailDoc(idx) {
  const d = (window._mailDocs || [])[idx];
  if (!d) return;
  const today = new Date().toISOString().split('T')[0];
  showToast('Generando documento con IA...', 'info');
  try {
    const sys = 'Eres un experto en documentación técnica de calidad e inocuidad alimentaria. Genera documentos completos y profesionales en español.';
    const resp = await callAI([{ role: 'user', content: 'Genera contenido completo para: "' + d.subtipo + '"\nCliente: ' + (d.cliente || 'N/A') + '\nProducto: ' + (d.producto || 'N/A') + '\nDescripción: ' + d.descripcion }], sys);
    if (!resp) throw new Error('Sin respuesta');
    const meta = { tipo: d.tipo, subtipo: d.subtipo, cliente: d.cliente || '', producto: d.producto || '', codigo: 'DOC-' + String(idx + 1).padStart(3, '0'), version: 'v1.0', fecha: today, descripcion: d.descripcion };
    if (d.tipo === 'Word') await generateDocx(meta, resp);
    else if (d.tipo === 'Excel') generateXlsx(meta, resp);
    else generatePdf(meta, resp);
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

