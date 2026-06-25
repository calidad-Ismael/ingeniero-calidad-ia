// ======================================================================
// MODULE 6: AUDITORÍA INTERNA
// ======================================================================
function renderAuditoria() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>🔍 Auditoría Interna FSSC 22000</h2><p>Registre hallazgos y obtenga recomendaciones de acciones correctivas con IA</p></div>
    <div class="card">
      <div class="card-title">➕ Nuevo Hallazgo</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cláusula FSSC 22000</label>
          <input type="text" class="form-control" id="aud-clausula" placeholder="Ej: 8.5.2, 8.9.4, 7.2">
        </div>
        <div class="form-group">
          <label class="form-label">Área Auditada</label>
          <input type="text" class="form-control" id="aud-area" placeholder="Ej: Producción, Almacén, RRHH">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Hallazgo</label>
          <select class="form-control" id="aud-tipo">
            <option value="NC Mayor">NC Mayor</option>
            <option value="NC Menor">NC Menor</option>
            <option value="Observación">Observación</option>
            <option value="Conforme">Conforme</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" class="form-control" id="aud-fecha" value="${today}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción del Hallazgo</label>
        <textarea class="form-control" id="aud-desc" style="min-height:100px" placeholder="Describa detalladamente el hallazgo encontrado durante la auditoría..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Evidencia Objetiva</label>
        <textarea class="form-control" id="aud-evidencia" placeholder="Registros revisados, observaciones, fotos, entrevistas..."></textarea>
      </div>
      <button class="btn btn-primary" id="aud-btn" onclick="crearHallazgo()" style="width:100%;justify-content:center;padding:12px">
        ✅ Crear Hallazgo y Obtener Acciones Correctivas
      </button>
    </div>
    <div id="aud-suggestion" style="display:none" class="card">
      <div class="card-title">🤖 Sugerencias de Acciones Correctivas (IA)</div>
      <div id="aud-suggestion-content" style="font-size:14px;line-height:1.7;white-space:pre-wrap;background:var(--bg);padding:16px;border-radius:8px"></div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div class="card-title" style="margin:0">📋 Hallazgos Registrados</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="exportarHallazgosExcel()">📊 Exportar Excel</button>
          <button class="btn btn-secondary btn-sm" onclick="exportarHallazgosWord()">📝 Exportar Word</button>
        </div>
      </div>
      <div id="hallazgos-list"><div style="text-align:center;padding:30px;color:var(--text-light)"><span class="spinner spinner-dark"></span></div></div>
    </div>`;
  loadHallazgos();
}

async function crearHallazgo() {
  const clausula = document.getElementById('aud-clausula').value.trim();
  const area = document.getElementById('aud-area').value.trim();
  const tipo = document.getElementById('aud-tipo').value;
  const fecha = document.getElementById('aud-fecha').value;
  const descripcion = document.getElementById('aud-desc').value.trim();
  const evidencia = document.getElementById('aud-evidencia').value.trim();
  if (!clausula || !area || !descripcion) { showToast('Complete los campos obligatorios (cláusula, área, descripción)', 'warning'); return; }
  const btn = document.getElementById('aud-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Procesando con IA...';
  try {
    const sys = 'Eres un auditor experto en FSSC 22000 e ISO 22000. Brindas recomendaciones de acciones correctivas detalladas, prácticas y alineadas con los requisitos normativos. Respondes en español de manera estructurada y profesional.';
    const msg = 'Hallazgo de auditoría FSSC 22000:\n- Cláusula: ' + clausula + '\n- Área: ' + area + '\n- Tipo: ' + tipo + '\n- Descripción: ' + descripcion + '\n- Evidencia: ' + (evidencia || 'No especificada') + '\n\nProporciona:\n1. Análisis de la no conformidad e impacto en el sistema de gestión\n2. Causa raíz posible (análisis 5 ¿Por qué?)\n3. Acciones correctivas inmediatas (corrección)\n4. Acciones correctivas sistémicas (acción correctiva)\n5. Indicadores de seguimiento y verificación de eficacia\n6. Plazo recomendado para implementación';
    const aiResp = await callAI([{ role: 'user', content: msg }], sys);
    const h = { clausula_fssc: clausula, area, tipo, fecha, descripcion, evidencia, estado: 'Abierto', accion_correctiva: aiResp ? { sugerencia: aiResp } : null, creado_en: new Date().toISOString() };
    if (supabaseClient) {
      try { await supabaseClient.from('hallazgos').insert(h); } catch(e) { showToast('Error guardando en BD: ' + e.message, 'warning'); }
    }
    hallazgos.unshift({ ...h, id: 'local_' + Date.now() });
    if (aiResp) {
      document.getElementById('aud-suggestion').style.display = 'block';
      document.getElementById('aud-suggestion-content').textContent = aiResp;
      document.getElementById('aud-suggestion').scrollIntoView({ behavior: 'smooth' });
    }
    renderHallazgosList();
    showToast('Hallazgo creado correctamente', 'success');
    ['aud-clausula', 'aud-area', 'aud-desc', 'aud-evidencia'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '✅ Crear Hallazgo y Obtener Acciones Correctivas'; }
}

async function loadHallazgos() {
  if (!supabaseClient) { renderHallazgosList(); return; }
  try {
    const { data, error } = await supabaseClient.from('hallazgos').select('*').order('creado_en', { ascending: false });
    if (error) throw error;
    hallazgos = data || [];
  } catch(e) { hallazgos = []; }
  renderHallazgosList();
}

const tipoColorMap = { 'NC Mayor': '#ef4444', 'NC Menor': '#f59e0b', 'Observación': '#3b82f6', 'Conforme': '#10b981' };
const tipoBadgeMap = { 'NC Mayor': 'tipo-nc-mayor', 'NC Menor': 'tipo-nc-menor', 'Observación': 'tipo-observacion', 'Conforme': 'tipo-conforme' };

function renderHallazgosList() {
  const c = document.getElementById('hallazgos-list');
  if (!c) return;
  if (!hallazgos.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No hay hallazgos registrados</p></div>'; return; }
  c.innerHTML = hallazgos.map((h, i) => {
    const col = tipoColorMap[h.tipo] || '#6b7280';
    const hasAI = h.accion_correctiva && h.accion_correctiva.sugerencia;
    return '<div class="hallazgo-card" style="border-left:4px solid ' + col + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
      '<div><span class="hallazgo-tipo ' + (tipoBadgeMap[h.tipo] || '') + '">' + escapeHtml(h.tipo) + '</span>' +
      '<span style="font-size:12px;color:var(--text-light);margin-left:8px">Cláusula: ' + escapeHtml(h.clausula_fssc || '—') + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:12px;color:var(--text-light)">' + formatDate(h.fecha || h.creado_en) + '</span>' +
      (hasAI ? '<button class="btn btn-secondary btn-sm" onclick="toggleDetails(\'det' + i + '\')">🤖 Ver IA</button>' : '') + '</div></div>' +
      '<p style="margin-top:8px;font-size:14px;font-weight:600">' + escapeHtml(h.area || '—') + '</p>' +
      '<p style="margin-top:4px;font-size:14px;color:var(--text-light)">' + escapeHtml(h.descripcion || '') + '</p>' +
      (h.evidencia ? '<p style="margin-top:4px;font-size:12px;color:var(--text-light)">Evidencia: ' + escapeHtml(h.evidencia) + '</p>' : '') +
      (hasAI ? '<div id="det' + i + '" class="hallazgo-details"><div class="ai-suggestion"><div class="ai-suggestion-title">🤖 Sugerencias de la IA</div><p>' + escapeHtml(h.accion_correctiva.sugerencia) + '</p></div></div>' : '') +
      '</div>';
  }).join('');
}

function toggleDetails(id) { const el = document.getElementById(id); if (el) el.classList.toggle('open'); }

function exportarHallazgosExcel() {
  if (!hallazgos.length) { showToast('No hay hallazgos para exportar', 'warning'); return; }
  const wb = XLSX.utils.book_new();
  const rows = [['Cláusula FSSC', 'Área', 'Tipo', 'Fecha', 'Descripción', 'Evidencia', 'Estado', 'Acción Correctiva IA']];
  hallazgos.forEach(h => rows.push([h.clausula_fssc || '', h.area || '', h.tipo || '', h.fecha || formatDate(h.creado_en), h.descripcion || '', h.evidencia || '', h.estado || '', h.accion_correctiva?.sugerencia || '']));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = rows[0].map(() => ({ wch: 30 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Hallazgos');
  XLSX.writeFile(wb, 'Hallazgos_Auditoria_' + new Date().toISOString().split('T')[0] + '.xlsx');
  showToast('Excel exportado', 'success');
}

async function exportarHallazgosWord() {
  if (!hallazgos.length) { showToast('No hay hallazgos para exportar', 'warning'); return; }
  try {
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = window.docx;
    const children = [
      new Paragraph({ children: [new TextRun({ text: 'Informe de Auditoría Interna FSSC 22000', bold: true, size: 32, color: '003399' })], heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Fecha: ' + new Date().toLocaleDateString('es-AR') + ' | Total hallazgos: ' + hallazgos.length, size: 20, color: '666666' })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: '' })] })
    ];
    const colorMap = { 'NC Mayor': 'ef4444', 'NC Menor': 'f59e0b', 'Observación': '3b82f6', 'Conforme': '10b981' };
    hallazgos.forEach((h, i) => {
      children.push(new Paragraph({ children: [new TextRun({ text: (i + 1) + '. ' + h.tipo + ' — Cláusula ' + (h.clausula_fssc || '—'), bold: true, size: 24, color: colorMap[h.tipo] || '003399' })], heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ children: [new TextRun({ text: 'Área: ' + (h.area || '—') + ' | Fecha: ' + (h.fecha || formatDate(h.creado_en)), size: 18, color: '666666' })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: 'Descripción: ', bold: true, size: 20 }), new TextRun({ text: h.descripcion || '', size: 20 })] }));
      if (h.evidencia) children.push(new Paragraph({ children: [new TextRun({ text: 'Evidencia: ', bold: true, size: 20 }), new TextRun({ text: h.evidencia, size: 20 })] }));
      if (h.accion_correctiva?.sugerencia) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Acciones Correctivas (IA):', bold: true, size: 20, color: '003399' })] }));
        h.accion_correctiva.sugerencia.split('\n').filter(l => l.trim()).forEach(l => children.push(new Paragraph({ children: [new TextRun({ text: l.replace(/\*\*/g, ''), size: 18 })] })));
      }
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    });
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Informe_Auditoria_' + new Date().toISOString().split('T')[0] + '.docx';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Word exportado', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

