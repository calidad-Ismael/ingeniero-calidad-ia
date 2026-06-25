// ===== GLOBALS =====
let supabaseClient = null;
let carpetaActual = 'todas';
let currentModule = '';
let selectedDocId = null;
let hallazgos = [];
let chatHistory = [];
let uploadedDocs = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Configurar el worker de pdf.js (las librerías cargan con defer, ya están disponibles acá)
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  checkConfig();
  initSupabase();
  switchModule('consultas');
  loadDocumentCount();
  // Cartel de agenda al abrir (tareas de hoy, próximas, repaso de viernes)
  setTimeout(() => { if (typeof mostrarCartelDiario === 'function') mostrarCartelDiario(); }, 1000);
});

// ===== CONFIG =====
function checkConfig() {
  const key = localStorage.getItem('iq_anthropic_key');
  const url = localStorage.getItem('iq_supabase_url');
  const sk = localStorage.getItem('iq_supabase_key');
  if (!key || !url || !sk) openConfig();
}

function openConfig() {
  document.getElementById('cfg-anthropic').value = localStorage.getItem('iq_anthropic_key') || '';
  document.getElementById('cfg-supabase-url').value = localStorage.getItem('iq_supabase_url') || '';
  document.getElementById('cfg-supabase-key').value = localStorage.getItem('iq_supabase_key') || '';
  document.getElementById('cfg-convert-api').value = localStorage.getItem('iq_convert_api') || '';
  document.getElementById('config-modal').style.display = 'flex';
}

function getConvertApi() {
  return (localStorage.getItem('iq_convert_api') || '').replace(/\/+$/, '');
}

function closeConfig() {
  document.getElementById('config-modal').style.display = 'none';
}

function saveConfig() {
  const key = document.getElementById('cfg-anthropic').value.trim();
  const url = document.getElementById('cfg-supabase-url').value.trim();
  const sk = document.getElementById('cfg-supabase-key').value.trim();
  if (!key || !url || !sk) { showToast('Complete todos los campos', 'error'); return; }
  const convertApi = document.getElementById('cfg-convert-api').value.trim();
  localStorage.setItem('iq_anthropic_key', key);
  localStorage.setItem('iq_supabase_url', url);
  localStorage.setItem('iq_supabase_key', sk);
  localStorage.setItem('iq_convert_api', convertApi);
  closeConfig();
  initSupabase();
  loadDocumentCount();
  showToast('Configuración guardada correctamente', 'success');
}

// ===== SUPABASE =====
function initSupabase() {
  const url = localStorage.getItem('iq_supabase_url');
  const key = localStorage.getItem('iq_supabase_key');
  if (url && key && window.supabase) {
    try { supabaseClient = window.supabase.createClient(url, key); } catch(e) { console.error('Supabase init:', e); }
  }
}

// ===== AI =====
async function callAI(messages, systemPrompt) {
  const key = localStorage.getItem('iq_anthropic_key');
  if (!key) { showToast('Configure su API key de Anthropic', 'error'); return null; }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, system: systemPrompt, messages })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content[0].text;
}

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s,transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== SIDEBAR =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ===== MODULE SWITCH =====
const moduleInfo = {
  consultas:  { title: 'Consultas IA', desc: 'Asistente experto en FSSC 22000' },
  documentos: { title: 'Gestión de Documentos', desc: 'Administre y procese documentos con IA' },
  conocimiento: { title: 'Base de Conocimiento', desc: 'Memoria de la empresa que la IA usa como contexto' },
  agenda:     { title: 'Agenda', desc: 'Calendario y seguimiento de tareas' },
  generador:  { title: 'Generador de Documentos', desc: 'Cree documentos profesionales con IA' },
  mails:      { title: 'Gestor de Mails', desc: 'Procese correos electrónicos con IA' },
  obsoletos:  { title: 'Documentos Obsoletos', desc: 'Gestione documentos archivados' },
  auditoria:  { title: 'Auditoría Interna', desc: 'Gestión de hallazgos FSSC 22000' }
};

function switchModule(mod) {
  currentModule = mod;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.module === mod));
  const info = moduleInfo[mod];
  document.getElementById('topbar-title').textContent = info.title;
  document.getElementById('topbar-desc').textContent = info.desc;
  document.getElementById('content').innerHTML = '';
  const renders = { consultas: renderConsultas, documentos: renderDocumentos, conocimiento: renderConocimiento, agenda: renderAgenda, generador: renderGenerador, mails: renderMails, obsoletos: renderObsoletos, auditoria: renderAuditoria };
  renders[mod]();
  closeSidebar();
}

async function loadDocumentCount() {
  if (!supabaseClient) { document.getElementById('doc-count').textContent = '—'; return; }
  try {
    const { count } = await supabaseClient.from('documentos').select('*', { count: 'exact', head: true });
    document.getElementById('doc-count').textContent = count ?? '0';
  } catch(e) { document.getElementById('doc-count').textContent = '—'; }
}


// ===== UTILS =====
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Convierte markdown a HTML limpio (encabezados, negritas, listas, tablas simples)
function renderMarkdown(text) {
  if (!text) return '';
  const esc = s => escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+?)`/g, '<code style="background:#eef1f6;padding:1px 5px;border-radius:4px;font-size:13px">$1</code>');
  const lines = text.split('\n');
  let html = '', listType = null;
  const closeList = () => { if (listType) { html += '</' + listType + '>'; listType = null; } };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (/^###\s+/.test(line)) { closeList(); html += '<h4 style="color:var(--primary);margin:12px 0 4px;font-size:14px">' + esc(line.replace(/^###\s+/, '')) + '</h4>'; }
    else if (/^##\s+/.test(line)) { closeList(); html += '<h3 style="color:var(--primary);margin:14px 0 6px;font-size:15px">' + esc(line.replace(/^##\s+/, '')) + '</h3>'; }
    else if (/^#\s+/.test(line)) { closeList(); html += '<h2 style="color:var(--primary);margin:14px 0 6px;font-size:16px">' + esc(line.replace(/^#\s+/, '')) + '</h2>'; }
    else if ((m = line.match(/^\s*[-•*]\s+(.*)/))) { if (listType !== 'ul') { closeList(); html += '<ul style="margin:4px 0 8px 18px">'; listType = 'ul'; } html += '<li style="margin:2px 0">' + esc(m[1]) + '</li>'; }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (listType !== 'ol') { closeList(); html += '<ol style="margin:4px 0 8px 18px">'; listType = 'ol'; } html += '<li style="margin:2px 0">' + esc(m[1]) + '</li>'; }
    else if (line.trim() === '') { closeList(); html += '<div style="height:6px"></div>'; }
    else { closeList(); html += '<p style="margin:4px 0">' + esc(line) + '</p>'; }
  }
  closeList();
  return html;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch(e) { return dateStr; }
}
