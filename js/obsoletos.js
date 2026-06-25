// ======================================================================
// MODULE 5: OBSOLETOS
// ======================================================================
let obsoletos = [];

function renderObsoletos() {
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>🗄️ Documentos Obsoletos</h2><p>Gestione documentos archivados y pasados a obsolescencia</p></div>
    <div class="card" style="padding:0;overflow:hidden">
      <div id="obsoletos-content">
        <div style="text-align:center;padding:40px;color:var(--text-light)"><span class="spinner spinner-dark"></span><p style="margin-top:12px">Cargando...</p></div>
      </div>
    </div>`;
  loadObsoletos();
}

async function loadObsoletos() {
  if (!supabaseClient) {
    const c = document.getElementById('obsoletos-content');
    if (c) c.innerHTML = '<div class="empty-state"><div class="empty-icon">🔑</div><p>Configure Supabase para ver documentos obsoletos</p></div>';
    return;
  }
  try {
    const { data, error } = await supabaseClient.from('documentos_obsoletos').select('*').order('obsoleto_en', { ascending: false });
    if (error) throw error;
    obsoletos = data || [];
    renderObsoletosTable();
  } catch(e) {
    const c = document.getElementById('obsoletos-content');
    if (c) c.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + escapeHtml(e.message) + '</p></div>';
  }
}

function renderObsoletosTable() {
  const c = document.getElementById('obsoletos-content');
  if (!c) return;
  if (!obsoletos.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">🗄️</div><p>No hay documentos obsoletos</p></div>'; return; }
  c.innerHTML = '<table class="data-table"><thead><tr><th>Nombre</th><th>Carpeta</th><th>Tipo</th><th>Fecha Obsolescencia</th><th>Acciones</th></tr></thead><tbody>' +
    obsoletos.map(doc => '<tr><td><strong>' + escapeHtml(doc.nombre) + '</strong></td><td>📁 ' + escapeHtml(doc.carpeta || 'General') + '</td><td><span class="badge badge-' + (doc.tipo || '').toLowerCase() + '">' + escapeHtml(doc.tipo || '—') + '</span></td><td>' + formatDate(doc.obsoleto_en) + '</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-success btn-sm" onclick="restaurarDoc(\'' + doc.id + '\')">↩️ Restaurar</button><button class="btn btn-danger btn-sm" onclick="eliminarDefinitivo(\'' + doc.id + '\')">🗑️ Eliminar definitivamente</button></div></td></tr>').join('') +
    '</tbody></table>';
}

async function restaurarDoc(id) {
  const doc = obsoletos.find(d => d.id === id);
  if (!doc || !supabaseClient) return;
  if (!confirm('¿Restaurar "' + doc.nombre + '"?')) return;
  try {
    const { error: ie } = await supabaseClient.from('documentos').insert({ nombre: doc.nombre, tipo: doc.tipo, storage_url: doc.storage_url, storage_path: doc.storage_path, carpeta: doc.carpeta || 'General', creado_en: new Date().toISOString() });
    if (ie) throw ie;
    const { error: de } = await supabaseClient.from('documentos_obsoletos').delete().eq('id', id);
    if (de) throw de;
    showToast('Documento restaurado', 'success');
    loadObsoletos();
    loadDocumentCount();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function eliminarDefinitivo(id) {
  const doc = obsoletos.find(d => d.id === id);
  if (!doc || !supabaseClient) return;
  if (!confirm('¿Eliminar DEFINITIVAMENTE "' + doc.nombre + '"? Esta acción no se puede deshacer.')) return;
  try {
    if (doc.storage_path) { try { await supabaseClient.storage.from('documentos').remove([doc.storage_path]); } catch(e) {} }
    const { error } = await supabaseClient.from('documentos_obsoletos').delete().eq('id', id);
    if (error) throw error;
    showToast('Documento eliminado definitivamente', 'success');
    loadObsoletos();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

