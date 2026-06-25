// ======================================================================
// MODULE 1: CONSULTAS
// ======================================================================
function renderConsultas() {
  document.getElementById('content').innerHTML = `
    <div id="chat-container">
      <div id="chat-messages">
        <div class="msg ai">
          <div class="msg-avatar">IA</div>
          <div class="msg-bubble">¡Hola! Soy su asistente de Calidad experto en FSSC 22000, BRC, IFS y normas de inocuidad alimentaria. ¿En qué puedo ayudarle hoy?</div>
        </div>
      </div>
      <div id="chat-input-area">
        <textarea id="chat-input" placeholder="Escriba su consulta... (Ctrl+Enter para enviar)" rows="1"></textarea>
        <button class="btn btn-primary" onclick="sendChat()" id="send-btn">➤ Enviar</button>
      </div>
    </div>`;
  const inp = document.getElementById('chat-input');
  inp.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendChat(); } autoResize(inp); });
  inp.addEventListener('input', () => autoResize(inp));
}

function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

async function sendChat() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  autoResize(inp);
  appendMsg('user', text);
  chatHistory.push({ role: 'user', content: text });
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const tid = appendTyping();
  try {
    let docCtx = '';
    if (supabaseClient) {
      try {
        const { data } = await supabaseClient.from('documentos').select('*').limit(200);
        if (data && data.length) {
          uploadedDocs = data; // cache para poder traer los archivos al chat con botones
          // Lista completa de NOMBRES (barato) para que la IA pueda traer cualquier archivo
          const lista = data.map(d => '📄 ' + d.nombre + ' (' + d.tipo + ', carpeta: ' + (d.carpeta || 'General') + ')').join('\n');
          // CONTENIDO solo de los documentos relevantes a la consulta, con presupuesto de caracteres
          const q = text.toLowerCase();
          const palabras = q.split(/\s+/).filter(w => w.length >= 4);
          const relevantes = data
            .filter(d => d.contenido_texto)
            .map(d => {
              const hay = (d.nombre + ' ' + d.contenido_texto).toLowerCase();
              const score = palabras.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
              return { d, score };
            })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5); // máx 5 documentos relevantes
          let contenido = '';
          let presupuesto = 40000; // tope total de caracteres de contenido
          for (const { d } of relevantes) {
            if (presupuesto <= 0) break;
            const frag = d.contenido_texto.slice(0, Math.min(8000, presupuesto));
            presupuesto -= frag.length;
            contenido += '\n\n--- ' + d.nombre + ' ---\n' + frag;
          }
          docCtx = '\n\n=== DOCUMENTOS CARGADOS (lista completa) ===\n' + lista +
            (contenido ? '\n\n=== CONTENIDO DE DOCUMENTOS RELEVANTES A LA CONSULTA ===\nCitá el nombre del archivo cuando uses su contenido.' + contenido : '');
        }
      } catch(e) {}
    }
    const conocimientoCtx = await getConocimientoContext();
    const sys = 'Eres un Ingeniero de Calidad experto en FSSC 22000 v6, BRC, IFS, ISO 22000, HACCP, BPM e inocuidad alimentaria, con foco en fabricación de envases. Respondes en español de forma DIRECTA y CONCISA, sin rodeos ni introducciones largas. Vas al grano: das la respuesta primero y luego, solo si aporta, una breve justificación. Citás la cláusula normativa exacta cuando corresponde. Usás viñetas cortas para enumerar y negritas solo para lo clave. Evitás frases de relleno como "es importante destacar" o "en resumen".\n\n' +
      'CAPACIDADES DE LA APP (muy importante): Esta aplicación SÍ puede convertir documentos Word a PDF exacto, editarlos y descargarlos. Vos no generás el archivo en tu texto, pero al traer un documento al chat aparecen botones automáticos: "📄 PDF exacto", "✏️ Editar y PDF" y "⬇️ Descargar". Por lo tanto NUNCA respondas que no podés generar PDF o que está fuera de tus funciones. En su lugar, traé el documento pedido.\n\n' +
      'CÓMO TRAER ARCHIVOS: Si el usuario pide buscar, traer, mostrar, encontrar, adjuntar, generar el PDF de, convertir a PDF, descargar o editar uno o más documentos, respondé una frase breve (ej: "Acá está, usá el botón 📄 PDF exacto para descargarlo en PDF") y al FINAL agregá una línea EXACTA con este formato:\n[[ARCHIVOS: nombre exacto 1 | nombre exacto 2]]\nUsá los nombres EXACTOS tal como figuran en la lista de documentos cargados. Si el usuario menciona un código o nombre parcial (ej: "DP 10-01"), buscá en la lista el documento que coincida y usá su nombre completo exacto. Si la consulta no es sobre traer/convertir/editar documentos, NO agregues esa línea.' + conocimientoCtx + docCtx;
    const resp = await callAI([...chatHistory], sys);
    removeTyping(tid);
    if (resp) {
      // Detectar archivos que la IA quiere traer al chat
      const m = resp.match(/\[\[ARCHIVOS:\s*([^\]]+)\]\]/i);
      let textoLimpio = resp.replace(/\[\[ARCHIVOS:[^\]]*\]\]/ig, '').trim();
      let docsTraidos = [];
      if (m) {
        const nombres = m[1].split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
        docsTraidos = uploadedDocs.filter(d => nombres.includes(d.nombre.toLowerCase()));
      }
      appendMsg('ai', textoLimpio || 'Aquí están los documentos:');
      if (docsTraidos.length) appendArchivosChat(docsTraidos);
      chatHistory.push({ role: 'assistant', content: resp });
    }
  } catch(e) {
    removeTyping(tid);
    showToast('Error al consultar la IA: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '➤ Enviar';
  }
}

function appendMsg(role, text) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const body = role === 'ai' ? renderMarkdown(text) : escapeHtml(text);
  div.innerHTML = '<div class="msg-avatar">' + (role === 'ai' ? 'IA' : 'Ud') + '</div><div class="msg-bubble">' + body + '</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendTyping() {
  const msgs = document.getElementById('chat-messages');
  const id = 'typ' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = id;
  div.innerHTML = '<div class="msg-avatar">IA</div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }

// Renderiza en el chat las tarjetas de los documentos traídos, con botones de acción
function appendArchivosChat(docs) {
  const msgs = document.getElementById('chat-messages');
  const icons = { PDF: '📄', DOCX: '📝', XLSX: '📊' };
  const hayConv = !!getConvertApi();
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = '<div class="msg-avatar">📎</div><div class="msg-bubble" style="width:100%">' +
    docs.map(d => {
      const esWord = (d.tipo || '').toUpperCase() === 'DOCX' || /\.docx?$/i.test(d.nombre);
      let botones = '<a class="btn btn-secondary btn-sm" href="' + escapeHtml(d.storage_url) + '" target="_blank" download>⬇️ Descargar</a>';
      if (esWord && hayConv) {
        botones += ' <button class="btn btn-accent btn-sm" onclick="chatConvertirPdf(\'' + d.id + '\')">📄 PDF exacto</button>';
        botones += ' <button class="btn btn-primary btn-sm" onclick="chatEditarWord(\'' + d.id + '\')">✏️ Editar y PDF</button>';
      }
      return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fff">' +
        '<div style="font-weight:600;margin-bottom:6px">' + (icons[d.tipo] || '📄') + ' ' + escapeHtml(d.nombre) +
        ' <span style="font-size:12px;color:var(--text-light);font-weight:400">· ' + escapeHtml(d.carpeta || 'General') + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + botones + '</div></div>';
    }).join('') + '</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

// Botón "PDF exacto" sobre un documento traído al chat
async function chatConvertirPdf(id) {
  const doc = uploadedDocs.find(d => d.id === id);
  if (!doc) return;
  showToast('Convirtiendo a PDF exacto...', 'info');
  try {
    if (await convertirDocAPdf(doc)) showToast('PDF exacto descargado', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// Botón "Editar y PDF" sobre un documento traído al chat
async function chatEditarWord(id) {
  const doc = uploadedDocs.find(d => d.id === id);
  if (!doc) return;
  const instr = prompt('¿Qué querés cambiar en "' + doc.nombre + '"?\n(Ej: cambiá el tamaño de 50 mm a 60 mm)');
  if (!instr || !instr.trim()) return;
  showToast('Aplicando cambios...', 'info');
  try {
    const nuevoFile = await editarWordFlow(doc, instr.trim());
    if (nuevoFile && confirm('¿Querés el PDF de la nueva versión?')) {
      const api = getConvertApi();
      const fd = new FormData();
      fd.append('archivo', nuevoFile);
      const r = await fetch(api + '/convertir-pdf', { method: 'POST', body: fd });
      if (r.ok) { descargarBlob(await r.blob(), doc.nombre.replace(/\.docx?$/i, '') + '.pdf'); showToast('PDF descargado', 'success'); }
    }
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

