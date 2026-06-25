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
        const { data } = await supabaseClient.from('documentos').select('nombre,tipo,carpeta,contenido_texto').limit(30);
        if (data && data.length) {
          docCtx = '\n\n=== DOCUMENTOS CARGADOS EN EL SISTEMA ===\nPodés usar el contenido de estos documentos para responder. Si la respuesta está en un documento, citá el nombre del archivo.\n\n' +
            data.map(d => {
              let bloque = '📄 ' + d.nombre + ' (' + d.tipo + ', carpeta: ' + (d.carpeta || 'General') + ')';
              if (d.contenido_texto) bloque += '\nContenido:\n' + d.contenido_texto.slice(0, 6000);
              return bloque;
            }).join('\n\n---\n\n');
        }
      } catch(e) {}
    }
    const conocimientoCtx = await getConocimientoContext();
    const sys = 'Eres un Ingeniero de Calidad experto en FSSC 22000 v6, BRC, IFS, ISO 22000, HACCP, BPM e inocuidad alimentaria, con foco en fabricación de envases. Respondes en español de forma DIRECTA y CONCISA, sin rodeos ni introducciones largas. Vas al grano: das la respuesta primero y luego, solo si aporta, una breve justificación. Citás la cláusula normativa exacta cuando corresponde. Usás viñetas cortas para enumerar y negritas solo para lo clave. Evitás frases de relleno como "es importante destacar" o "en resumen".' + conocimientoCtx + docCtx;
    const resp = await callAI([...chatHistory], sys);
    removeTyping(tid);
    if (resp) { appendMsg('ai', resp); chatHistory.push({ role: 'assistant', content: resp }); }
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

