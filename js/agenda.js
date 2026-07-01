// ======================================================================
// MODULE: AGENDA / CALENDARIO
// Vistas: Día, Semana, Mes, Año · Repetición: diaria, semanal, mensual, anual
// Avisos al abrir la app: tareas de hoy, fechas próximas, repaso semanal (viernes)
// ======================================================================
let agendaVista = 'mes';            // 'dia' | 'semana' | 'mes' | 'anio'
let agendaRef = new Date();         // fecha de referencia para navegar
let tareas = [];                    // tareas definidas
let tareasCompletadas = new Set();  // claves "tareaId|YYYY-MM-DD"
const RECURRENCIAS = { ninguna: 'Una vez', diaria: 'Diaria', semanal: 'Semanal', mensual: 'Mensual', anual: 'Anual' };
const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ---- Helpers de fecha (en horario local, sin problemas de zona horaria) ----
function isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dateFromIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function hoyIso() { return isoLocal(new Date()); }
function addDias(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function inicioSemana(d) { const r = new Date(d); const dow = (r.getDay() + 6) % 7; r.setDate(r.getDate() - dow); r.setHours(0,0,0,0); return r; } // lunes
function mismoDia(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fechaCorta(iso) { const d = dateFromIso(iso); return DIAS_SEM[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); }

// ¿La tarea ocurre en la fecha d (Date)?
function ocurreEn(tarea, d) {
  const ancla = dateFromIso(tarea.fecha);
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const aa = new Date(ancla.getFullYear(), ancla.getMonth(), ancla.getDate());
  if (dd < aa) return false;
  switch (tarea.recurrencia) {
    case 'diaria': return true;
    case 'semanal': return dd.getDay() === aa.getDay();
    case 'mensual': return dd.getDate() === aa.getDate();
    case 'anual': return dd.getDate() === aa.getDate() && dd.getMonth() === aa.getMonth();
    default: return mismoDia(dd, aa); // 'ninguna'
  }
}

// Ocurrencias (tarea + fecha) dentro de un rango [ini, fin] inclusive
function ocurrenciasEnRango(ini, fin) {
  const res = [];
  let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
  const last = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
  while (d <= last) {
    for (const t of tareas) if (ocurreEn(t, d)) res.push({ tarea: t, fecha: isoLocal(d) });
    d = addDias(d, 1);
  }
  return res;
}

function estaCompletada(tareaId, fechaIso) { return tareasCompletadas.has(tareaId + '|' + fechaIso); }

// ---- Datos ----
async function loadTareas() {
  if (!supabaseClient) { tareas = []; tareasCompletadas = new Set(); return; }
  try {
    const { data: t } = await supabaseClient.from('tareas').select('*').eq('activa', true);
    tareas = t || [];
    const { data: c } = await supabaseClient.from('tareas_completadas').select('tarea_id,fecha');
    tareasCompletadas = new Set((c || []).map(x => x.tarea_id + '|' + x.fecha));
  } catch(e) { tareas = []; tareasCompletadas = new Set(); }
}

async function toggleCompletada(tareaId, fechaIso) {
  if (!supabaseClient) return;
  const clave = tareaId + '|' + fechaIso;
  try {
    if (tareasCompletadas.has(clave)) {
      await supabaseClient.from('tareas_completadas').delete().eq('tarea_id', tareaId).eq('fecha', fechaIso);
      tareasCompletadas.delete(clave);
    } else {
      await supabaseClient.from('tareas_completadas').insert({ tarea_id: tareaId, fecha: fechaIso, creado_en: new Date().toISOString() });
      tareasCompletadas.add(clave);
    }
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ---- Render principal ----
function renderAgenda() {
  document.getElementById('content').innerHTML = `
    <div class="module-header"><h2>📅 Agenda</h2><p>Planificá tus tareas y seguimiento. Vistas día, semana, mes y año.</p></div>
    <div class="card">
      <div class="card-title">➕ Nueva tarea</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Título</label><input type="text" class="form-control" id="tar-titulo" placeholder="Ej: Revisar registros de control"></div>
        <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-control" id="tar-fecha" value="${hoyIso()}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Hora (opcional)</label><input type="time" class="form-control" id="tar-hora"></div>
        <div class="form-group"><label class="form-label">Repetición</label>
          <select class="form-control" id="tar-recurrencia">
            <option value="ninguna">Una vez</option><option value="diaria">Diaria</option>
            <option value="semanal">Semanal</option><option value="mensual">Mensual</option><option value="anual">Anual</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Descripción (opcional)</label><textarea class="form-control" id="tar-desc" style="min-height:60px"></textarea></div>
      <button class="btn btn-primary" onclick="crearTarea()">💾 Guardar tarea</button>
    </div>
    <div class="card">
      <div class="card-title">📋 Cargar un cronograma (lista de tareas de una vez)</div>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:10px">Escribí una tarea por línea. Se crearán todas con la repetición y fecha de inicio que elijas. Ideal para tu rutina diaria/semanal/mensual.</p>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Repetición de la lista</label>
          <select class="form-control" id="lista-recurrencia">
            <option value="diaria">Diaria (todos los días)</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="ninguna">Una vez</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">A partir de</label><input type="date" class="form-control" id="lista-fecha" value="${hoyIso()}"></div>
      </div>
      <div class="form-group"><label class="form-label">Tareas (una por línea)</label>
        <textarea class="form-control" id="lista-tareas" style="min-height:120px" placeholder="Ej:
Revisar registros de temperatura
Controlar limpieza de líneas
Verificar stock de insumos
Firmar planillas de producción"></textarea>
      </div>
      <button class="btn btn-primary" onclick="crearListaTareas()">📋 Crear lista</button>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <div style="display:flex;gap:4px;background:var(--bg);border-radius:8px;padding:4px">
          ${['dia','semana','mes','anio'].map(v => `<button class="btn btn-sm ${agendaVista===v?'btn-primary':'btn-secondary'}" onclick="cambiarVista('${v}')">${({dia:'Día',semana:'Semana',mes:'Mes',anio:'Año'})[v]}</button>`).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-left:auto;align-items:center">
          <button class="btn btn-secondary btn-sm" onclick="navegarAgenda(-1)">‹</button>
          <button class="btn btn-secondary btn-sm" onclick="irHoy()">Hoy</button>
          <button class="btn btn-secondary btn-sm" onclick="navegarAgenda(1)">›</button>
        </div>
      </div>
      <div id="agenda-titulo" style="font-weight:700;color:var(--primary);font-size:16px;margin-bottom:12px"></div>
      <div id="agenda-vista"><div style="text-align:center;padding:30px;color:var(--text-light)"><span class="spinner spinner-dark"></span></div></div>
    </div>`;
  loadTareas().then(renderVista);
}

function cambiarVista(v) { agendaVista = v; renderVista(); }
function irHoy() { agendaRef = new Date(); renderVista(); }
function navegarAgenda(dir) {
  if (agendaVista === 'dia') agendaRef = addDias(agendaRef, dir);
  else if (agendaVista === 'semana') agendaRef = addDias(agendaRef, dir * 7);
  else if (agendaVista === 'mes') agendaRef = new Date(agendaRef.getFullYear(), agendaRef.getMonth() + dir, 1);
  else agendaRef = new Date(agendaRef.getFullYear() + dir, agendaRef.getMonth(), 1);
  renderVista();
}

async function renderVista() {
  if (!tareas.length && supabaseClient) await loadTareas();
  const cont = document.getElementById('agenda-vista');
  const tit = document.getElementById('agenda-titulo');
  if (!cont) return;
  if (agendaVista === 'dia') { tit.textContent = textoFechaLarga(agendaRef); cont.innerHTML = vistaDia(agendaRef); }
  else if (agendaVista === 'semana') renderSemana(cont, tit);
  else if (agendaVista === 'mes') renderMes(cont, tit);
  else renderAnio(cont, tit);
}

function textoFechaLarga(d) { return DIAS_SEM[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear(); }

function chipTarea(o) {
  const done = estaCompletada(o.tarea.id, o.fecha);
  const rec = o.tarea.recurrencia !== 'ninguna' ? ' 🔁' : '';
  return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:' + (done?'#e7f6ec':'var(--bg)') + ';margin-bottom:4px">' +
    '<span style="cursor:pointer;font-size:18px" onclick="onToggleTarea(\'' + o.tarea.id + '\',\'' + o.fecha + '\')">' + (done?'✅':'⬜') + '</span>' +
    '<div style="flex:1;min-width:0"><span style="' + (done?'text-decoration:line-through;color:var(--text-light)':'') + '">' + (o.tarea.hora?('<strong>'+escapeHtml(o.tarea.hora)+'</strong> '):'') + escapeHtml(o.tarea.titulo) + rec + '</span></div>' +
    '<span style="cursor:pointer;color:var(--danger);font-size:13px" onclick="eliminarTarea(\'' + o.tarea.id + '\')" title="Eliminar">🗑️</span></div>';
}

function vistaDia(d) {
  const occ = ocurrenciasEnRango(d, d).sort((a,b) => (a.tarea.hora||'').localeCompare(b.tarea.hora||''));
  if (!occ.length) return '<div class="empty-state"><div class="empty-icon">📭</div><p>Sin tareas para este día</p></div>';
  return occ.map(chipTarea).join('');
}

function renderSemana(cont, tit) {
  const ini = inicioSemana(agendaRef);
  const fin = addDias(ini, 6);
  tit.textContent = 'Semana del ' + ini.getDate() + '/' + (ini.getMonth()+1) + ' al ' + fin.getDate() + '/' + (fin.getMonth()+1);
  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">';
  for (let i = 0; i < 7; i++) {
    const d = addDias(ini, i);
    const hoy = mismoDia(d, new Date());
    const occ = ocurrenciasEnRango(d, d);
    html += '<div style="border:1px solid ' + (hoy?'var(--primary)':'var(--border)') + ';border-radius:8px;padding:8px;min-height:120px">' +
      '<div style="font-size:12px;font-weight:700;color:' + (hoy?'var(--primary)':'var(--text-light)') + ';margin-bottom:6px">' + DIAS_SEM[d.getDay()] + ' ' + d.getDate() + '</div>' +
      occ.map(o => { const done = estaCompletada(o.tarea.id,o.fecha); return '<div onclick="onToggleTarea(\'' + o.tarea.id + '\',\'' + o.fecha + '\')" style="cursor:pointer;font-size:12px;padding:3px 5px;border-radius:4px;margin-bottom:3px;background:' + (done?'#e7f6ec':'#e8eefc') + ';' + (done?'text-decoration:line-through;color:var(--text-light)':'') + '">' + (done?'✅ ':'') + escapeHtml(o.tarea.titulo) + '</div>'; }).join('') +
      '</div>';
  }
  html += '</div>';
  cont.innerHTML = html;
}

function renderMes(cont, tit) {
  const y = agendaRef.getFullYear(), m = agendaRef.getMonth();
  tit.textContent = MESES[m] + ' ' + y;
  const primero = new Date(y, m, 1);
  const ini = inicioSemana(primero);
  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">';
  html += ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => '<div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-light);padding:4px">' + d + '</div>').join('');
  for (let i = 0; i < 42; i++) {
    const d = addDias(ini, i);
    const esMes = d.getMonth() === m;
    const hoy = mismoDia(d, new Date());
    const occ = ocurrenciasEnRango(d, d);
    const pend = occ.filter(o => !estaCompletada(o.tarea.id, o.fecha)).length;
    html += '<div onclick="abrirDia(\'' + isoLocal(d) + '\')" style="cursor:pointer;border:1px solid ' + (hoy?'var(--primary)':'var(--border)') + ';border-radius:6px;padding:5px;min-height:64px;background:' + (esMes?'#fff':'#fafafa') + ';opacity:' + (esMes?1:0.5) + '">' +
      '<div style="font-size:12px;font-weight:' + (hoy?700:400) + ';color:' + (hoy?'var(--primary)':'var(--text)') + '">' + d.getDate() + '</div>' +
      occ.slice(0,3).map(o => { const done = estaCompletada(o.tarea.id,o.fecha); return '<div style="font-size:10px;padding:1px 3px;border-radius:3px;margin-top:2px;background:' + (done?'#e7f6ec':'#e8eefc') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (done?'✅':'•') + ' ' + escapeHtml(o.tarea.titulo) + '</div>'; }).join('') +
      (occ.length>3?'<div style="font-size:10px;color:var(--text-light);margin-top:2px">+' + (occ.length-3) + ' más</div>':'') +
      '</div>';
  }
  html += '</div>';
  cont.innerHTML = html;
}

function renderAnio(cont, tit) {
  const y = agendaRef.getFullYear();
  tit.textContent = 'Año ' + y;
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">';
  for (let m = 0; m < 12; m++) {
    const ini = new Date(y, m, 1), fin = new Date(y, m + 1, 0);
    const occ = ocurrenciasEnRango(ini, fin);
    const pend = occ.filter(o => !estaCompletada(o.tarea.id, o.fecha)).length;
    html += '<div onclick="abrirMes(' + m + ')" style="cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">' +
      '<div style="font-weight:700;color:var(--primary)">' + MESES[m] + '</div>' +
      '<div style="font-size:13px;color:var(--text-light);margin-top:6px">' + occ.length + ' tarea(s)' + (pend?' · <span style="color:var(--danger)">' + pend + ' pend.</span>':'') + '</div></div>';
  }
  html += '</div>';
  cont.innerHTML = html;
}

function abrirDia(iso) { agendaRef = dateFromIso(iso); agendaVista = 'dia'; renderVista(); }
function abrirMes(m) { agendaRef = new Date(agendaRef.getFullYear(), m, 1); agendaVista = 'mes'; renderVista(); }

async function onToggleTarea(id, fecha) { await toggleCompletada(id, fecha); renderVista(); }

async function crearTarea() {
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  const titulo = document.getElementById('tar-titulo').value.trim();
  const fecha = document.getElementById('tar-fecha').value;
  const hora = document.getElementById('tar-hora').value;
  const recurrencia = document.getElementById('tar-recurrencia').value;
  const descripcion = document.getElementById('tar-desc').value.trim();
  if (!titulo || !fecha) { showToast('Complete título y fecha', 'warning'); return; }
  try {
    const { error } = await supabaseClient.from('tareas').insert({ titulo, fecha, hora: hora || null, recurrencia, descripcion: descripcion || null, activa: true, creado_en: new Date().toISOString() });
    if (error) throw error;
    document.getElementById('tar-titulo').value = '';
    document.getElementById('tar-desc').value = '';
    document.getElementById('tar-hora').value = '';
    showToast('Tarea guardada', 'success');
    await loadTareas();
    renderVista();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function crearListaTareas() {
  if (!supabaseClient) { showToast('Configure Supabase', 'error'); return; }
  const fecha = document.getElementById('lista-fecha').value;
  const recurrencia = document.getElementById('lista-recurrencia').value;
  const lineas = document.getElementById('lista-tareas').value.split('\n').map(l => l.trim()).filter(Boolean);
  if (!fecha || !lineas.length) { showToast('Escribí al menos una tarea y la fecha', 'warning'); return; }
  try {
    const filas = lineas.map(titulo => ({ titulo, fecha, recurrencia, activa: true, creado_en: new Date().toISOString() }));
    const { error } = await supabaseClient.from('tareas').insert(filas);
    if (error) throw error;
    document.getElementById('lista-tareas').value = '';
    showToast(filas.length + ' tarea(s) creada(s)', 'success');
    await loadTareas();
    renderVista();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function eliminarTarea(id) {
  if (!supabaseClient || !confirm('¿Eliminar esta tarea? (se borra también de fechas futuras)')) return;
  try {
    await supabaseClient.from('tareas_completadas').delete().eq('tarea_id', id);
    const { error } = await supabaseClient.from('tareas').delete().eq('id', id);
    if (error) throw error;
    showToast('Tarea eliminada', 'success');
    await loadTareas();
    renderVista();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ======================================================================
// CARTELES AL ABRIR LA APP (tareas de hoy, próximas, repaso de viernes)
// ======================================================================
async function mostrarCartelDiario() {
  if (!supabaseClient) return;
  // Evitar repetir el cartel más de una vez por día
  if (localStorage.getItem('iq_cartel_dia') === hoyIso()) return;
  await loadTareas();
  if (!tareas.length) return;
  const hoy = new Date();
  const hoyOcc = ocurrenciasEnRango(hoy, hoy);
  const prox = ocurrenciasEnRango(addDias(hoy, 1), addDias(hoy, 3)).filter(o => !estaCompletada(o.tarea.id, o.fecha));
  const esViernes = hoy.getDay() === 5;
  let repasoOcc = [];
  if (esViernes) {
    const ini = inicioSemana(hoy);
    repasoOcc = ocurrenciasEnRango(ini, hoy);
  }
  // Vencimientos (alertas) del mes / próximos días
  let vencimientos = [];
  if (typeof getAlertasProximas === 'function') { try { vencimientos = await getAlertasProximas(); } catch(e) {} }
  if (!hoyOcc.length && !prox.length && !repasoOcc.length && !vencimientos.length) return;

  let html = '<div class="modal" style="max-width:560px;max-height:85vh;overflow-y:auto">' +
    '<h2>📅 ' + textoFechaLarga(hoy) + '</h2>';

  if (esViernes && repasoOcc.length) {
    html += '<div style="background:#fff3cd;border:1px solid #ffe08a;border-radius:8px;padding:10px 12px;margin:10px 0">' +
      '<strong>📋 Repaso de la semana</strong><p style="font-size:13px;margin-top:4px">¿Hiciste lo que tenías planificado? Tildá lo que cumpliste:</p></div>' +
      '<div id="cartel-repaso">' + repasoOcc.map(cartelItem).join('') + '</div><hr style="border:none;border-top:1px solid var(--border);margin:14px 0">';
  }

  if (hoyOcc.length) {
    html += '<div style="font-weight:700;color:var(--primary);margin-bottom:8px">✅ Tareas de hoy</div>' +
      '<div id="cartel-hoy">' + hoyOcc.map(cartelItem).join('') + '</div>';
  } else {
    html += '<p style="color:var(--text-light)">No tenés tareas para hoy. 🎉</p>';
  }

  if (prox.length) {
    html += '<div style="font-weight:700;color:var(--primary);margin:14px 0 8px">⏰ Se aproximan</div>' +
      prox.map(o => '<div style="font-size:13px;padding:4px 0">📌 <strong>' + fechaCorta(o.fecha) + '</strong> — ' + escapeHtml(o.tarea.titulo) + '</div>').join('');
  }

  if (vencimientos.length) {
    html += '<div style="font-weight:700;color:var(--primary);margin:14px 0 8px">🔔 Vencimientos del mes</div>' +
      vencimientos.slice(0, 15).map(a => {
        const f = new Date(a.fecha_vencimiento + 'T00:00:00'); const hh = new Date(); hh.setHours(0,0,0,0);
        const dias = Math.round((f - hh) / 86400000);
        const ic = dias < 0 ? '🔴' : (dias <= 7 ? '🟡' : '🟢');
        return '<div style="font-size:13px;padding:4px 0">' + ic + ' <strong>' + escapeHtml(a.fecha_vencimiento) + '</strong> — ' + escapeHtml(a.titulo) + '</div>';
      }).join('');
  }

  html += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">' +
    '<button class="btn btn-secondary" onclick="cerrarCartel(false)">Recordar más tarde</button>' +
    '<button class="btn btn-primary" onclick="cerrarCartel(true)">Listo por hoy</button></div></div>';

  let overlay = document.getElementById('cartel-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'cartel-overlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

function cartelItem(o) {
  const done = estaCompletada(o.tarea.id, o.fecha);
  return '<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:6px;background:' + (done?'#e7f6ec':'var(--bg)') + ';margin-bottom:5px">' +
    '<span style="cursor:pointer;font-size:20px" onclick="cartelToggle(this,\'' + o.tarea.id + '\',\'' + o.fecha + '\')">' + (done?'✅':'⬜') + '</span>' +
    '<span style="flex:1;' + (done?'text-decoration:line-through;color:var(--text-light)':'') + '">' + (o.tarea.hora?('<strong>'+escapeHtml(o.tarea.hora)+'</strong> '):'') + escapeHtml(o.tarea.titulo) + '</span></div>';
}

async function cartelToggle(el, id, fecha) {
  await toggleCompletada(id, fecha);
  const done = estaCompletada(id, fecha);
  el.textContent = done ? '✅' : '⬜';
  el.parentElement.style.background = done ? '#e7f6ec' : 'var(--bg)';
  const span = el.parentElement.querySelector('span:last-child');
  if (span) span.style.cssText = done ? 'flex:1;text-decoration:line-through;color:var(--text-light)' : 'flex:1;';
}

function cerrarCartel(marcarVisto) {
  const o = document.getElementById('cartel-overlay');
  if (o) o.style.display = 'none';
  if (marcarVisto) localStorage.setItem('iq_cartel_dia', hoyIso());
}