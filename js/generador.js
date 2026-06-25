// ======================================================================
// MODULE 3: GENERADOR
// ======================================================================
function renderGenerador() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>✨ Generador de Documentos</h2><p>Cree documentos profesionales de calidad con IA</p></div>
    <div class="card">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Archivo</label>
          <select class="form-control" id="gen-tipo">
            <option value="Word">Word (.docx)</option>
            <option value="Excel">Excel (.xlsx)</option>
            <option value="PDF">PDF (.pdf)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subtipo / Plantilla</label>
          <select class="form-control" id="gen-subtipo">
            <option>Especificación Técnica</option>
            <option>Certificado de Calidad</option>
            <option>Informe de Análisis</option>
            <option>Procedimiento</option>
            <option>Acta</option>
            <option>Registro de Control</option>
            <option>Planilla de Auditoría</option>
            <option>Matriz de Riesgos</option>
            <option>Reporte de Hallazgos</option>
            <option>Certificado Formal</option>
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <input type="text" class="form-control" id="gen-cliente" placeholder="Nombre del cliente">
        </div>
        <div class="form-group">
          <label class="form-label">Producto</label>
          <input type="text" class="form-control" id="gen-producto" placeholder="Nombre del producto">
        </div>
        <div class="form-group">
          <label class="form-label">Código de Documento</label>
          <input type="text" class="form-control" id="gen-codigo" placeholder="Ej: DOC-001">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Versión</label>
          <input type="text" class="form-control" id="gen-version" placeholder="v1.0">
        </div>
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" class="form-control" id="gen-fecha" value="${today}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">📎 Basar en un documento cargado (opcional)</label>
        <select class="form-control" id="gen-fuente">
          <option value="">— Generar desde cero (sin documento base) —</option>
        </select>
        <p style="font-size:12px;color:var(--text-light);margin-top:4px">Si elegís un documento, la IA usará su contenido. Ej: subiste un Word y querés su PDF, o generar una nueva versión a partir de uno existente.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción / Instrucciones</label>
        <textarea class="form-control" id="gen-descripcion" style="min-height:120px" placeholder="Describa el contenido o las instrucciones. Ej: 'Convertí este Word a PDF formal', 'Generá la versión 2 actualizando los parámetros de control'..."></textarea>
      </div>
      <button class="btn btn-primary" id="gen-btn" onclick="generarDocumento()" style="width:100%;justify-content:center;padding:14px">
        ✨ Generar Documento
      </button>
    </div>
    <div id="generator-result">
      <div id="gen-result-content"></div>
    </div>`;
  cargarFuentesGenerador();
}

async function cargarFuentesGenerador() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.from('documentos').select('id,nombre,tipo,contenido_texto').order('creado_en', { ascending: false }).limit(200);
    const sel = document.getElementById('gen-fuente');
    if (!sel || !data) return;
    window._fuentesGen = {};
    data.forEach(d => {
      window._fuentesGen[d.id] = d;
      const tieneTexto = d.contenido_texto ? ' ✓' : ' (sin texto)';
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.nombre + ' [' + d.tipo + ']' + tieneTexto;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

async function generarDocumento() {
  const tipo = document.getElementById('gen-tipo').value;
  const subtipo = document.getElementById('gen-subtipo').value;
  const cliente = document.getElementById('gen-cliente').value.trim();
  const producto = document.getElementById('gen-producto').value.trim();
  const codigo = document.getElementById('gen-codigo').value.trim();
  const version = document.getElementById('gen-version').value.trim();
  const fecha = document.getElementById('gen-fecha').value;
  const descripcion = document.getElementById('gen-descripcion').value.trim();
  const fuenteId = document.getElementById('gen-fuente') ? document.getElementById('gen-fuente').value : '';
  if (!descripcion && !fuenteId) { showToast('Ingrese una descripción o elija un documento base', 'warning'); return; }
  const btn = document.getElementById('gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generando con IA...';
  const metadata = { tipo, subtipo, cliente, producto, codigo, version, fecha, descripcion };
  try {
    // Si hay documento base, incluir su contenido
    let baseTexto = '';
    if (fuenteId && window._fuentesGen && window._fuentesGen[fuenteId]) {
      const f = window._fuentesGen[fuenteId];
      if (f.contenido_texto) baseTexto = '\n\n=== CONTENIDO DEL DOCUMENTO BASE "' + f.nombre + '" ===\n' + f.contenido_texto.slice(0, 35000) + '\n=== FIN DOCUMENTO BASE ===\n\nUsá este contenido como base. Respetá la información real que contiene; reorganizala y completala según las instrucciones, sin inventar datos que contradigan el original.';
      else baseTexto = '\n\n(Se seleccionó el documento "' + f.nombre + '" como base pero no tiene texto extraído.)';
    }
    const sys = 'Eres un experto en documentación técnica de calidad e inocuidad alimentaria (FSSC 22000, ISO 22000, HACCP, BRC, IFS). Genera documentos completos, profesionales y bien estructurados en español. Usa el formato apropiado para cada tipo de documento.' + (await getConocimientoContext());
    const msg = 'Genera un documento de tipo "' + subtipo + '" con los siguientes datos:\n- Tipo de archivo: ' + tipo + '\n- Cliente: ' + (cliente || 'N/A') + '\n- Producto: ' + (producto || 'N/A') + '\n- Código: ' + (codigo || 'DOC-001') + '\n- Versión: ' + (version || 'v1.0') + '\n- Fecha: ' + fecha + '\n- Descripción/Instrucciones: ' + (descripcion || 'Reproducí y formateá profesionalmente el documento base.') + baseTexto + '\n\nGenera el contenido completo. Para tablas usa: TABLA|Col1|Col2\nFILA|val1|val2. Incluye todos los apartados necesarios para un documento técnico profesional de calidad alimentaria.';
    const aiContent = await callAI([{ role: 'user', content: msg }], sys);
    if (!aiContent) throw new Error('Sin respuesta de la IA');
    const panel = document.getElementById('generator-result');
    panel.style.display = 'block';
    document.getElementById('gen-result-content').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">' +
      '<h3 style="color:var(--primary)">✅ Documento generado: ' + escapeHtml(subtipo) + '</h3>' +
      '<button class="btn btn-accent" onclick="downloadDocument()">⬇️ Descargar ' + escapeHtml(tipo) + '</button></div>' +
      '<div style="background:var(--bg);border-radius:8px;padding:16px;font-size:13px;line-height:1.7;max-height:400px;overflow-y:auto">' + renderMarkdown(aiContent) + '</div>';
    panel.scrollIntoView({ behavior: 'smooth' });
    window._lastAIContent = aiContent;
    window._lastMeta = metadata;
  } catch(e) { showToast('Error generando: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '✨ Generar Documento'; }
}

function downloadDocument() {
  const meta = window._lastMeta;
  const content = window._lastAIContent;
  if (!meta || !content) return;
  if (meta.tipo === 'Word') generateDocx(meta, content);
  else if (meta.tipo === 'Excel') generateXlsx(meta, content);
  else generatePdf(meta, content);
}

async function generateDocx(metadata, aiContent) {
  try {
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, Packer } = window.docx;
    const children = [
      new Paragraph({ children: [new TextRun({ text: metadata.subtipo, bold: true, size: 32, color: '003399' })], heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: (metadata.codigo || 'DOC-001') + ' | Versión ' + (metadata.version || '1.0') + ' | ' + metadata.fecha, size: 20, color: '666666' })], alignment: AlignmentType.CENTER })
    ];
    if (metadata.cliente) children.push(new Paragraph({ children: [new TextRun({ text: 'Cliente: ' + metadata.cliente + (metadata.producto ? '  |  Producto: ' + metadata.producto : ''), size: 20, color: '444444' })], alignment: AlignmentType.CENTER }));
    children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    const lines = aiContent.split('\n');
    let tableRows = [];
    let inTable = false;
    for (const line of lines) {
      if (line.startsWith('TABLA|')) {
        inTable = true;
        tableRows = [line.split('|').slice(1)];
      } else if (line.startsWith('FILA|') && inTable) {
        tableRows.push(line.split('|').slice(1));
      } else {
        if (inTable && tableRows.length > 0) {
          try {
            children.push(new Table({ rows: tableRows.map((cells, ri) => new TableRow({ children: cells.map(cell => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell.trim(), bold: ri === 0, color: ri === 0 ? 'FFFFFF' : '000000' })] })], shading: ri === 0 ? { fill: '003399' } : undefined })) })), width: { size: 100, type: WidthType.PERCENTAGE } }));
          } catch(e) {}
          tableRows = [];
          inTable = false;
        }
        if (line.startsWith('# ')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line.slice(2), bold: true, size: 28, color: '003399' })], heading: HeadingLevel.HEADING_1 }));
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line.slice(3), bold: true, size: 24, color: '0052CC' })], heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith('### ')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line.slice(4), bold: true, size: 22, color: '003399' })], heading: HeadingLevel.HEADING_3 }));
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^[-•]\s/, ''), size: 20 })], bullet: { level: 0 } }));
        } else if (line.trim() === '') {
          children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
        } else {
          const runs = [];
          let last = 0;
          const re = /\*\*(.+?)\*\*/g;
          let m;
          while ((m = re.exec(line)) !== null) {
            if (m.index > last) runs.push(new TextRun({ text: line.slice(last, m.index), size: 20 }));
            runs.push(new TextRun({ text: m[1], bold: true, size: 20 }));
            last = m.index + m[0].length;
          }
          if (last < line.length) runs.push(new TextRun({ text: line.slice(last), size: 20 }));
          children.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text: line, size: 20 })] }));
        }
      }
    }
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (metadata.subtipo.replace(/\s+/g, '_')) + '_' + (metadata.codigo || 'DOC') + '_' + metadata.fecha + '.docx';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Documento Word descargado', 'success');
  } catch(e) { showToast('Error generando Word: ' + e.message, 'error'); }
}

function generateXlsx(metadata, aiContent) {
  try {
    const wb = XLSX.utils.book_new();
    const rows = [[metadata.subtipo], ['Código: ' + (metadata.codigo || 'DOC-001'), 'Versión: ' + (metadata.version || '1.0'), 'Fecha: ' + metadata.fecha]];
    if (metadata.cliente) rows.push(['Cliente: ' + metadata.cliente, 'Producto: ' + (metadata.producto || '')]);
    rows.push([]);
    aiContent.split('\n').forEach(line => {
      if (line.startsWith('TABLA|')) rows.push(line.split('|').slice(1));
      else if (line.startsWith('FILA|')) rows.push(line.split('|').slice(1));
      else if (line.trim()) rows.push([line.replace(/^#+\s/, '').replace(/\*\*/g, '')]);
      else rows.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, (metadata.subtipo.replace(/\s+/g, '_')) + '_' + (metadata.codigo || 'DOC') + '_' + metadata.fecha + '.xlsx');
    showToast('Documento Excel descargado', 'success');
  } catch(e) { showToast('Error generando Excel: ' + e.message, 'error'); }
}

function generatePdf(metadata, aiContent) {
  try {
    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(0, 51, 153);
    doc.rect(0, 0, pw, 30, 'F');
    doc.setTextColor(255, 184, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(metadata.subtipo, pw / 2, 12, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text((metadata.codigo || 'DOC-001') + ' | v' + (metadata.version || '1.0') + ' | ' + metadata.fecha, pw / 2, 20, { align: 'center' });
    if (metadata.cliente) doc.text('Cliente: ' + metadata.cliente + (metadata.producto ? '  |  Producto: ' + metadata.producto : ''), pw / 2, 27, { align: 'center' });
    const metaRows = [];
    if (metadata.cliente) metaRows.push(['Cliente', metadata.cliente]);
    if (metadata.producto) metaRows.push(['Producto', metadata.producto]);
    if (metadata.codigo) metaRows.push(['Código', metadata.codigo]);
    metaRows.push(['Versión', metadata.version || '1.0']);
    metaRows.push(['Fecha', metadata.fecha]);
    if (metaRows.length) {
      doc.autoTable({ startY: 36, head: [['Campo', 'Valor']], body: metaRows, theme: 'grid', headStyles: { fillColor: [0, 51, 153], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } } });
    }
    let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 50;
    const margin = 14;
    const maxW = pw - margin * 2;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = aiContent.split('\n');
    let tabla = [];
    const flushTabla = () => {
      if (!tabla.length) return;
      doc.autoTable({ startY: y, head: [tabla[0]], body: tabla.slice(1), theme: 'grid', headStyles: { fillColor: [0, 51, 153], textColor: 255, fontStyle: 'bold', fontSize: 9 }, styles: { fontSize: 9, cellPadding: 2 }, margin: { left: margin, right: margin } });
      y = doc.lastAutoTable.finalY + 6;
      tabla = [];
    };
    lines.forEach(line => {
      if (line.startsWith('TABLA|')) { flushTabla(); tabla = [line.split('|').slice(1).map(c => c.trim())]; return; }
      if (line.startsWith('FILA|')) { if (tabla.length) tabla.push(line.split('|').slice(1).map(c => c.trim())); return; }
      flushTabla();
      if (y > 270) { doc.addPage(); y = 20; }
      const clean = s => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*/g, '');
      if (/^#{1,3}\s/.test(line)) {
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(line.startsWith('# ') ? 13 : line.startsWith('## ') ? 11 : 10);
        doc.setTextColor(0, 51, 153);
        const wrapped = doc.splitTextToSize(clean(line.replace(/^#+\s/, '')), maxW);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
      } else if (/^\s*[-•*]\s/.test(line)) {
        const wrapped = doc.splitTextToSize(clean(line.replace(/^\s*[-•*]\s/, '')), maxW - 6);
        doc.text('•', margin, y);
        doc.text(wrapped, margin + 5, y);
        y += wrapped.length * 5;
      } else if (line.trim() === '') {
        y += 3;
      } else {
        const wrapped = doc.splitTextToSize(clean(line), maxW);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5;
      }
    });
    flushTabla();
    doc.save((metadata.subtipo.replace(/\s+/g, '_')) + '_' + (metadata.codigo || 'DOC') + '_' + metadata.fecha + '.pdf');
    showToast('Documento PDF descargado', 'success');
  } catch(e) { showToast('Error generando PDF: ' + e.message, 'error'); }
}

