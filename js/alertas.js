// ======================================================================
// MODULE: ALERTAS Y VENCIMIENTOS
// Lee Excel (vencimientos, calibraciones, mantenimientos, etc.), la IA extrae
// los ítems con fecha y genera alertas. Semáforo por proximidad.
// ======================================================================
let alertas = [];
let alertaMesFiltro = null; // 'YYYY-MM' o null (todos)

function renderAlertas() {
  const mesActual = new Date().toISOString().slice(0, 7);
  if (alertaMesFiltro === null) alertaMesFiltro = mesActual;
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>🔔 Alertas y Vencimientos</h2><p>Subí tus planillas Excel y la IA te arma los avisos de lo que vence.</p></div>
    <div class="card">
      <div class="card-title">📥 Cargar planilla Excel</div>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:10px">Subí un Excel con vencimientos, calibraciones, mantenimientos, capacitaciones, auditorías, controles, etc. La IA lee las fechas y crea las alertas automáticamente.</p>
      <input type="file" id="alerta-excel" accept=".xlsx,.xls" onchange="procesarExcelAlertas(event)">
      <div id="alerta-proc" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span>📅 Vencimientos</span>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="month" class="form-control" id="alerta-mes" style="width:auto;font-size:13px;padding:6px 10px" value="${alertaMesFiltro}" onchange="filtrarMesAlerta(this.value)">
          <button class="btn btn-secondary btn-sm" onclick="verTodasAlertas()">Ver todas</button>
        </div>
      </div>
      <div id="alertas-lista"><div style="text-align:center;padding:20px;color:var(--text-light)"><span class="spinner spinner-dark"></span></div></div>
    </div>`;
  loadAlertas();
}

function filtrarMesAlerta(v) { alertaMesFiltro = v; renderAlertasLista(); }
function verTodasAlertas() { alertaMesFiltro = ''; const el = document.getElementById('alerta-mes'); if (el) el.value = ''; renderAlertasLista(); }

async function loadAlertas() {
  const lista = document.getElementById('alertas-lista');
  if (!supabaseClient) { if (lista) lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🔑</div><p>Configure Supabase</p></div>'; return; }
  try {
    const { data, error } = await supabaseClient.from('alertas').select('*').order('fecha_vencimiento', { ascending: true });
    if (error) throw error;
    alertas = data || [];
    renderAlertasLista();
  } catch(e) { if (lista) lista.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + escapeHtml(e.message) + '</p></div>'; }
}

function semaforoAlerta(fechaVenc, estado) {
  if (estado === 'resuelta') return { color: '#8993a4', label: 'Resuelta', icon: '✅' };
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fechaVenc + 'T00:00:00');
  const dias = Math.round((f - hoy) / 86400000);
  if (dias < 0) return { color: '#de350b', label: 'Vencido', icon: '🔴' };
  if (dias <= 7) return { color: '#ff8b00', label: 'Vence en ' + dias + ' día(s)', icon: '🟡' };
  return { color: '#00875a', label: 'En ' + dias + ' día(s)', icon: '🟢' };
}

function renderAlertasLista() {
  const lista = document.getElementById('alertas-lista');
  if (!lista) return;
  let items = alertas.slice();
  if (alertaMesFiltro) items = items.filter(a => (a.fecha_vencimiento || '').slice(0, 7) === alertaMesFiltro);
  if (!items.length) { lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><p>No hay vencimientos' + (alertaMesFiltro ? ' para este mes' : '') + '. Subí una planilla Excel.</p></div>'; return; }
  lista.innerHTML = items.map(a => {
    const s = semaforoAlerta(a.fecha_vencimiento, a.estado);
    const tach = a.estado === 'resuelta' ? 'text-decoration:line-through;color:var(--text-light)' : '';
    return '<div class="card" style="margin-bottom:8px;border-left:4px solid ' + s.color + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:0"><strong style="' + tach + '">' + s.icon + ' ' + escapeHtml(a.titulo) + '</strong>' +
      '<div style="font-size:13px;color:var(--text-light);margin-top:3px">📆 ' + escapeHtml(a.fecha_vencimiento || '') + ' · ' + escapeHtml(a.categoria || 'General') +
      ' · <span style="color:' + s.color + ';font-weight:600">' + s.label + '</span></div>' +
      (a.descripcion ? '<p style="font-size:13px;margin-top:4px">' + escapeHtml(a.descripcion) + '</p>' : '') +
      (a.origen_archivo ? '<p style="font-size:11px;color:var(--text-light);margin-top:2px">📄 ' + escapeHtml(a.origen_archivo) + '</p>' : '') +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      (a.estado === 'resuelta'
        ? '<button class="btn btn-secondary btn-sm" onclick="toggleAlerta(\'' + a.id + '\',\'pendiente\')">↩️ Reabrir</button>'
        : '<button class="btn btn-success btn-sm" onclick="toggleAlerta(\'' + a.id + '\',\'resuelta\')">✔️ Resuelta</button>') +
      '<button class="btn btn-danger btn-sm" onclick="eliminarAlerta(\'' + a.id + '\')">🗑️</button>' +
      '</div></div></div>';
  }).join('');
}

async function toggleAlerta(id, estado) {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.from('alertas').update({ estado }).eq('id', id);
    if (error) throw error;
    await loadAlertas();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function eliminarAlerta(id) {
  if (!supabaseClient || !confirm('¿Eliminar esta alerta?')) return;
  try {
    const { error } = await supabaseClient.from('alertas').delete().eq('id', id);
    if (error) throw error;
    showToast('Alerta eliminada', 'success');
    await loadAlertas();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// Lee el Excel, manda a la IA a extraer vencimientos, e inserta alertas (sin duplicar)
async function procesarExcelAlertas(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  if (!window.XLSX) { showToast('Librería Excel no cargada, recargá la página', 'error'); return; }
  const proc = document.getElementById('alerta-proc');
  proc.innerHTML = '<span class="spinner spinner-dark"></span> Leyendo la planilla...';
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    // Convertir todas las hojas a texto (CSV) para que la IA las entienda
    let texto = '';
    wb.SheetNames.forEach(nombre => {
      const ws = wb.Sheets[nombre];
      texto += '### Hoja: ' + nombre + '\n' + XLSX.utils.sheet_to_csv(ws) + '\n\n';
    });
    texto = texto.slice(0, 30000);
    proc.innerHTML = '<span class="spinner spinner-dark"></span> La IA está extrayendo los vencimientos...';
    const hoy = new Date().toISOString().split('T')[0];
    const sys = 'Extraés vencimientos y tareas con fecha de una planilla de calidad industrial. Devolvés SOLO un array JSON. Interpretá columnas flexibles (equipo/actividad, fecha de vencimiento/próxima fecha/próximo control, responsable, categoría). Las fechas en formato YYYY-MM-DD.';
    const msg = 'Hoy es ' + hoy + '. De esta planilla, extraé cada ítem que tenga una fecha futura o de vencimiento/control:\n\n' + texto +
      '\n\nDevolvé JSON: [{"titulo":"qué vence o hay que hacer","fecha_vencimiento":"YYYY-MM-DD","categoria":"Calibración|Mantenimiento|Capacitación|Auditoría|Control|Vencimiento|Otro","descripcion":"detalle opcional"}]. Ignorá filas sin fecha válida. Si no hay nada, [].';
    const resp = await callAI([{ role: 'user', content: msg }], sys);
    let arr;
    try { const jm = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || resp.match(/(\[[\s\S]*\])/); arr = JSON.parse((jm ? jm[1] : resp).trim()); } catch(e) { throw new Error('La IA no pudo interpretar la planilla'); }
    if (!Array.isArray(arr) || !arr.length) { proc.innerHTML = '<span style="color:var(--text-light)">No se encontraron vencimientos con fecha en la planilla.</span>'; return; }
    // Evitar duplicados (mismo título + fecha)
    const existentes = new Set(alertas.map(a => (a.titulo || '').toLowerCase() + '|' + a.fecha_vencimiento));
    const filas = arr.filter(x => x && x.titulo && x.fecha_vencimiento && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha_vencimiento) && !existentes.has(String(x.titulo).toLowerCase() + '|' + x.fecha_vencimiento))
      .map(x => ({ titulo: String(x.titulo).slice(0,300), fecha_vencimiento: x.fecha_vencimiento, categoria: x.categoria || 'Otro', descripcion: x.descripcion || null, origen_archivo: file.name, estado: 'pendiente', creado_en: new Date().toISOString() }));
    if (!filas.length) { proc.innerHTML = '<span style="color:var(--text-light)">La planilla ya estaba cargada (sin vencimientos nuevos).</span>'; return; }
    const { error } = await supabaseClient.from('alertas').insert(filas);
    if (error) throw error;
    proc.innerHTML = '<span style="color:var(--success)">✅ Se crearon ' + filas.length + ' alerta(s) desde la planilla.</span>';
    showToast(filas.length + ' vencimiento(s) agregados', 'success');
    ev.target.value = '';
    await loadAlertas();
  } catch(e) { proc.innerHTML = '<span style="color:var(--danger)">Error: ' + escapeHtml(e.message) + '</span>'; }
}

// Usado por el cartel diario de la agenda: vencimientos del mes o próximos 7 días
async function getAlertasProximas() {
  if (!supabaseClient) return [];
  try {
    const hoy = new Date();
    const hoyIsoS = hoy.toISOString().slice(0, 10);
    const mes = hoyIsoS.slice(0, 7);
    const en7 = new Date(hoy.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const { data } = await supabaseClient.from('alertas').select('*').eq('estado', 'pendiente').order('fecha_vencimiento', { ascending: true });
    return (data || []).filter(a => {
      const f = a.fecha_vencimiento || '';
      return f.slice(0, 7) === mes || (f >= hoyIsoS && f <= en7) || f < hoyIsoS; // este mes, próximos 7 días, o vencidas
    });
  } catch(e) { return []; }
}
