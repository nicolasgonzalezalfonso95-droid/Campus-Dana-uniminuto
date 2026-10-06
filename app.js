// Roles y Estados
const ROLES = {
  TECNICO: 'TECNICO',
  SUPERVISOR: 'SUPERVISOR',
  ESTUDIANTE: 'ESTUDIANTE'
};

const ESTADOS = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  RESUELTO: 'Resuelto',
  VERIFICADO: 'Verificado'
};

const SLA_HORAS = {
  CRITICA: 4,
  ALTA: 24,
  MEDIA: 72,
  BAJA: 168
};

let incidencias = JSON.parse(localStorage.getItem('incidencias_campus')) || [];
let historial = JSON.parse(localStorage.getItem('historial_campus')) || [];

function persistirDatos() {
  localStorage.setItem('incidencias_campus', JSON.stringify(incidencias));
  localStorage.setItem('historial_campus', JSON.stringify(historial));
}

// Requisito 2: Fórmula Ponderada
function calcularPrioridad(tipoDano, riesgo, reportesPrevios) {
  const pesoTipo = {
    'ELECTRICO': 100,
    'AGUA': 80,
    'ESTRUCTURAL': 70,
    'MOBILIARIO': 40,
    'OTRO': 20
  }[tipoDano] || 20;

  const puntajeRiesgo = Math.min(Math.max(riesgo, 1), 5) * 20;
  const puntajeFrecuencia = Math.min(reportesPrevios * 25, 100);

  const total = (puntajeRiesgo * 0.40) + (pesoTipo * 0.35) + (puntajeFrecuencia * 0.25);

  let nivel = 'BAJA';
  if (total >= 85) nivel = 'CRITICA';
  else if (total >= 65) nivel = 'ALTA';
  else if (total >= 40) nivel = 'MEDIA';

  return { puntaje: Math.round(total), nivel };
}

// Requisito 3: Similitud y Agrupación
function extraerTokens(texto) {
  return new Set(
    texto.toLowerCase()
      .replace(/[^a-záéíóúñ0-9 ]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
}

function buscarIncidenciaRelacionada(nuevaDescripcion, espacio) {
  const tokensNuevo = extraerTokens(nuevaDescripcion);

  return incidencias.find(inc => {
    const mismoEspacio = inc.espacio.trim().toLowerCase() === espacio.trim().toLowerCase();
    const activa = inc.estado !== ESTADOS.VERIFICADO;
    if (!mismoEspacio || !activa) return false;

    const tokensExistente = extraerTokens(inc.descripcion);
    const interseccion = [...tokensNuevo].filter(x => tokensExistente.has(x));
    const union = new Set([...tokensNuevo, ...tokensExistente]);

    if (union.size === 0) return false;
    return (interseccion.length / union.size) >= 0.30;
  });
}

// Requisito 4: Escalamiento SLA
function verificarEscalamientoSLA() {
  const ahora = Date.now();
  let cambios = false;

  incidencias.forEach(inc => {
    if (inc.estado === ESTADOS.RESUELTO || inc.estado === ESTADOS.VERIFICADO) return;

    const horas = (ahora - new Date(inc.fechaCreacion).getTime()) / (1000 * 3600);
    const limite = SLA_HORAS[inc.prioridad.nivel];

    if (horas > limite && !inc.vencida) {
      inc.vencida = true;
      cambios = true;
      const previo = inc.prioridad.nivel;

      if (inc.prioridad.nivel === 'BAJA') inc.prioridad.nivel = 'MEDIA';
      else if (inc.prioridad.nivel === 'MEDIA') inc.prioridad.nivel = 'ALTA';
      else if (inc.prioridad.nivel === 'ALTA') inc.prioridad.nivel = 'CRITICA';

      historial.unshift({
        incidenciaId: inc.id,
        transicion: `${inc.estado} → ${inc.estado}`,
        usuario: 'SISTEMA_SLA',
        tiempo: `${horas.toFixed(1)} hrs`,
        hora: new Date().toLocaleTimeString(),
        detalle: `Escalado automático de ${previo} a ${inc.prioridad.nivel} por superar SLA.`
      });
    }
  });

  if (cambios) {
    persistirDatos();
    renderizarVistas();
  }
}

// Requisito 5 y 6: Roles y Estados
function cambiarEstadoIncidencia(id, nuevoEstado) {
  const rolSelector = document.getElementById('currentRole');
  const rolActual = rolSelector ? rolSelector.value : ROLES.SUPERVISOR;
  const inc = incidencias.find(i => i.id === id);
  if (!inc) return;

  if (nuevoEstado === ESTADOS.VERIFICADO && rolActual === ROLES.TECNICO) {
    alert('Acción denegada: El técnico no puede verificar su propio trabajo (requiere Supervisor).');
    renderizarVistas();
    return;
  }

  const minutos = Math.round((Date.now() - new Date(inc.ultimaActualizacion).getTime()) / (1000 * 60));

  historial.unshift({
    incidenciaId: inc.id,
    transicion: `${inc.estado} → ${nuevoEstado}`,
    usuario: rolActual,
    tiempo: `${minutos} min`,
    hora: new Date().toLocaleTimeString(),
    detalle: 'Actualización manual de estado'
  });

  inc.estado = nuevoEstado;
  inc.ultimaActualizacion = new Date().toISOString();
  persistirDatos();
  renderizarVistas();
}
window.cambiarEstadoIncidencia = cambiarEstadoIncidencia;

// Eliminar un ticket individual
function eliminarIncidencia(id) {
  if (confirm(`¿Deseas eliminar el ticket #${id}?`)) {
    incidencias = incidencias.filter(i => i.id !== id);
    historial = historial.filter(h => h.incidenciaId !== id);
    persistirDatos();
    renderizarVistas();
  }
}
window.eliminarIncidencia = eliminarIncidencia;

// Requisito 7: Indicadores
function calcularMetricas() {
  const totalVencidas = incidencias.filter(i => i.vencida && i.estado !== ESTADOS.VERIFICADO).length;
  const totalActivas = incidencias.filter(i => i.estado !== ESTADOS.VERIFICADO).length;

  const espaciosMap = {};
  incidencias.forEach(i => {
    espaciosMap[i.espacio] = (espaciosMap[i.espacio] || 0) + (1 + (i.duplicados || 0));
  });

  const espacioTop = Object.entries(espaciosMap).sort((a, b) => b[1] - a[1])[0];
  const espacioTexto = espacioTop ? `${espacioTop[0]} (${espacioTop[1]} rep)` : 'Sin reportes';

  return { totalVencidas, totalActivas, espacioTexto };
}

// Enviar Reporte desde la página principal
const form = document.getElementById('formIncidencia');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const espacio = document.getElementById('espacio').value;
    const tipoDano = document.getElementById('tipoDano').value;
    const riesgo = parseInt(document.getElementById('riesgo').value, 10);
    const descripcion = document.getElementById('descripcion').value;
    const fotoInput = document.getElementById('fotoEvidencia');

    const guardar = (fotoData = null) => {
      const encontrada = buscarIncidenciaRelacionada(descripcion, espacio);

      if (encontrada) {
        encontrada.duplicados = (encontrada.duplicados || 0) + 1;
        encontrada.prioridad = calcularPrioridad(encontrada.tipoDano, encontrada.riesgo, encontrada.duplicados);
        alert(`¡Problema coincidente detectado! Se acumuló en el caso #${encontrada.id} incrementando su prioridad.`);
      } else {
        const idGenerado = Math.floor(1000 + Math.random() * 9000).toString();
        const nueva = {
          id: idGenerado,
          espacio,
          tipoDano,
          riesgo,
          descripcion,
          foto: fotoData,
          estado: ESTADOS.PENDIENTE,
          vencida: false,
          duplicados: 0,
          prioridad: calcularPrioridad(tipoDano, riesgo, 0),
          fechaCreacion: new Date().toISOString(),
          ultimaActualizacion: new Date().toISOString()
        };
        incidencias.push(nueva);
        historial.unshift({
          incidenciaId: nueva.id,
          transicion: 'CREACIÓN → Pendiente',
          usuario: 'ESTUDIANTE',
          tiempo: '0 min',
          hora: new Date().toLocaleTimeString(),
          detalle: 'Reporte registrado en la plataforma.'
        });
      }

      persistirDatos();
      form.reset();
      alert('Reporte enviado correctamente a Infraestructura.');
    };

    if (fotoInput.files && fotoInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => guardar(ev.target.result);
      reader.readAsDataURL(fotoInput.files[0]);
    } else {
      guardar(null);
    }
  });
}

// Renderizado en la tabla administrativa
function renderizarVistas() {
  const ordenadas = [...incidencias].sort((a, b) => b.prioridad.puntaje - a.prioridad.puntaje);
  const tablaAdm = document.querySelector('#tablaAdmin tbody');
  const metricasBox = document.getElementById('metricas');

  if (tablaAdm && metricasBox) {
    const { totalVencidas, totalActivas, espacioTexto } = calcularMetricas();

    metricasBox.innerHTML = `
      <div class="metric-card">
        <div class="metric-title">Casos Activos</div>
        <div class="metric-value">${totalActivas}</div>
      </div>
      <div class="metric-card danger">
        <div class="metric-title">Vencidos por SLA</div>
        <div class="metric-value">${totalVencidas}</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-title">Espacio con Más Daños</div>
        <div class="metric-value" style="font-size:1.15rem;">${espacioTexto}</div>
      </div>
    `;

    tablaAdm.innerHTML = ordenadas.map(inc => `
      <tr>
        <td><strong>#${inc.id}</strong></td>
        <td>${inc.foto ? `<img src="${inc.foto}" class="thumb-img" onclick="abrirVisor('${inc.foto}')" title="Clic para ampliar">` : '<span style="color:#94a3b8;">Sin foto</span>'}</td>
        <td><strong>${inc.espacio}</strong></td>
        <td>${inc.descripcion} ${inc.duplicados > 0 ? `<br><small style="color:#002663; font-weight:700;">(+${inc.duplicados} agrupados)</small>` : ''}</td>
        <td><span class="badge ${inc.prioridad.nivel}">${inc.prioridad.nivel}</span></td>
        <td><strong>${inc.prioridad.puntaje}</strong> pts</td>
        <td><strong>${inc.estado}</strong></td>
        <td>${inc.vencida ? '<span class="badge CRITICA">VENCIDA</span>' : '<span class="badge BAJA">A TIEMPO</span>'}</td>
        <td>
          <select class="status-select" onchange="cambiarEstadoIncidencia('${inc.id}', this.value)">
            <option value="" disabled selected>Mover a...</option>
            <option value="${ESTADOS.PENDIENTE}">Pendiente</option>
            <option value="${ESTADOS.EN_PROCESO}">En proceso</option>
            <option value="${ESTADOS.RESUELTO}">Resuelto</option>
            <option value="${ESTADOS.VERIFICADO}">Verificado</option>
          </select>
        </td>
        <td>
          <button class="btn-delete-row" onclick="eliminarIncidencia('${inc.id}')">✕</button>
        </td>
      </tr>
    `).join('');

    const tablaHist = document.querySelector('#tablaHistorial tbody');
    if (tablaHist) {
      tablaHist.innerHTML = historial.slice(0, 10).map(h => `
        <tr>
          <td>#${h.incidenciaId}</td>
          <td><strong>${h.transicion}</strong></td>
          <td>${h.usuario}</td>
          <td>${h.tiempo}</td>
          <td>${h.hora}</td>
          <td style="color:#64748b; font-size:0.85rem;">${h.detalle}</td>
        </tr>
      `).join('');
    }
  }
}

const roleSelector = document.getElementById('currentRole');
if (roleSelector) {
  roleSelector.addEventListener('change', renderizarVistas);
}

renderizarVistas();
setInterval(verificarEscalamientoSLA, 10000);