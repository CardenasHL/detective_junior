/* =========================================
   DETECTIVE JUNIOR - app.js
   SPA sin frameworks, sin ?. ni ??
   ========================================= */

// ---- ESTADO GLOBAL ----
var estado = {
  datos: null,           // JSON cargado
  paqueteActual: null,
  casoActual: null,
  progreso: {}           // { casoId: { pistasReveladas, cuadricula, resuelto } }
};

// Claves localStorage
var LS_KEY = 'detective_junior_progreso';

// ===================================
// CARGA INICIAL
// ===================================
document.addEventListener('DOMContentLoaded', function() {
  cargarProgreso();
  cargarDatos();
});

function cargarDatos() {
  mostrarPantalla('cargando');
  fetch('./data/casos.json')
    .then(function(res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    })
    .then(function(json) {
      var error = validarJSON(json);
      if (error) {
        mostrarError('El archivo de datos tiene un problema: ' + error);
        return;
      }
      estado.datos = json;
      var pantallaCarga = document.getElementById('pantalla-cargando');
      if (pantallaCarga) { pantallaCarga.parentNode.removeChild(pantallaCarga); }
      inicializarUI();
      mostrarPantalla('home');
    })
    .catch(function(err) {
      mostrarError('No se pudo cargar el archivo de casos. Asegúrate de servir el juego desde un servidor (no abriendo el HTML directamente). Detalle: ' + err.message);
    });
}

// ===================================
// VALIDACIÓN (sanity check)
// ===================================
function validarJSON(json) {
  if (!json) { return 'JSON vacío o nulo.'; }
  if (!json.paquetes) { return 'Falta el campo "paquetes".'; }
  if (!Array.isArray(json.paquetes) || json.paquetes.length === 0) {
    return '"paquetes" debe ser un array no vacío.';
  }
  for (var i = 0; i < json.paquetes.length; i++) {
    var paq = json.paquetes[i];
    if (!paq.id || !paq.nombre) { return 'Paquete ' + i + ' falta id o nombre.'; }
    if (!Array.isArray(paq.casos) || paq.casos.length === 0) {
      return 'Paquete "' + paq.nombre + '" sin casos.';
    }
    for (var j = 0; j < paq.casos.length; j++) {
      var c = paq.casos[j];
      var campos = ['id','titulo','historia','quien','donde','que','pistas','solucion'];
      for (var k = 0; k < campos.length; k++) {
        if (!c[campos[k]]) {
          return 'Caso ' + j + ' del paquete "' + paq.nombre + '" falta campo: ' + campos[k];
        }
      }
      if (!Array.isArray(c.quien) || c.quien.length < 2) {
        return 'Caso "' + c.titulo + '": "quien" debe tener al menos 2 elementos.';
      }
      if (!c.solucion.quien || !c.solucion.donde || !c.solucion.que) {
        return 'Caso "' + c.titulo + '": "solucion" incompleta.';
      }
    }
  }
  return null; // sin errores
}

// ===================================
// INICIALIZAR UI (event listeners)
// ===================================
function inicializarUI() {
  // Header logo → home
  document.getElementById('header-logo').addEventListener('click', function() {
    mostrarPantalla('home');
    estado.casoActual = null;
    estado.paqueteActual = null;
  });

  // Botón empezar
  document.getElementById('btn-empezar').addEventListener('click', function() {
    mostrarPantalla('paquetes');
    renderizarPaquetes();
  });

  // Botón volver en paquetes
  document.getElementById('btn-volver-home').addEventListener('click', function() {
    mostrarPantalla('home');
  });

  // Botón volver en casos
  document.getElementById('btn-volver-paquetes').addEventListener('click', function() {
    mostrarPantalla('paquetes');
    renderizarPaquetes();
  });

  // Tutorial: listeners de historia y pruebas acordeón (delegados)
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'btn-minimizar-historia' || e.target.closest('#btn-minimizar-historia'))) {
      toggleHistoria();
    }
    if (e.target && (e.target.id === 'btn-toggle-pruebas' || e.target.closest('#btn-toggle-pruebas'))) {
      togglePruebas();
    }
    if (e.target && (e.target.id === 'btn-a-investigar')) {
      minimizarHistoria();
    }
  });

  // Cerrar modales con overlay
  document.getElementById('modal-resolver').addEventListener('click', function(e) {
    if (e.target === this) { cerrarModal('modal-resolver'); }
  });
  document.getElementById('modal-resultado').addEventListener('click', function(e) {
    if (e.target === this) { cerrarModal('modal-resultado'); }
  });

  // Cerrar modales con botón X
  document.getElementById('modal-resolver-cerrar').addEventListener('click', function() {
    cerrarModal('modal-resolver');
  });
  document.getElementById('modal-resultado-cerrar').addEventListener('click', function() {
    cerrarModal('modal-resultado');
  });

  // Confirmar resolver
  document.getElementById('btn-confirmar-resolucion').addEventListener('click', function() {
    comprobarSolucion();
  });

  // Botón resultado: continuar
  document.getElementById('btn-resultado-continuar').addEventListener('click', function() {
    cerrarModal('modal-resultado');
    mostrarPantalla('casos');
    renderizarCasos(estado.paqueteActual);
  });
}

// ===================================
// NAVEGACIÓN DE PANTALLAS
// ===================================
function mostrarPantalla(nombre) {
  var ids = ['pantalla-home','pantalla-paquetes','pantalla-casos','pantalla-caso','pantalla-error','pantalla-cargando'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) {
      el.classList.remove('activa');
    }
  }
  var target = document.getElementById('pantalla-' + nombre);
  if (target) { target.classList.add('activa'); }
}

function mostrarError(msg) {
  var el = document.getElementById('error-mensaje');
  if (el) { el.textContent = msg; }
  mostrarPantalla('error');
}

// ===================================
// PANTALLA: PAQUETES
// ===================================
function renderizarPaquetes() {
  var contenedor = document.getElementById('paquetes-grid');
  contenedor.innerHTML = '';
  var paquetes = estado.datos.paquetes;

  for (var i = 0; i < paquetes.length; i++) {
    (function(paq) {
      var div = document.createElement('div');
      div.className = 'tarjeta-paquete';
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');

      // Calcular casos resueltos del paquete
      var resueltos = 0;
      for (var j = 0; j < paq.casos.length; j++) {
        var prog = estado.progreso[paq.casos[j].id];
        if (prog && prog.resuelto) { resueltos++; }
      }

      div.innerHTML =
        '<span class="paquete-icono">' + paq.icono + '</span>' +
        '<h3>' + escapeHTML(paq.nombre) + '</h3>' +
        '<p>' + escapeHTML(paq.descripcion) + '</p>' +
        '<p style="margin-top:10px; font-size:0.82rem; color:var(--color-texto-suave);">' +
        '📁 ' + paq.casos.length + ' casos · ' + resueltos + ' resueltos</p>';

      div.addEventListener('click', function() {
        estado.paqueteActual = paq;
        mostrarPantalla('casos');
        renderizarCasos(paq);
      });
      div.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { div.click(); }
      });

      contenedor.appendChild(div);
    })(paquetes[i]);
  }
}

// ===================================
// PANTALLA: CASOS
// ===================================
function renderizarCasos(paquete) {
  document.getElementById('casos-titulo').textContent = paquete.nombre;
  var contenedor = document.getElementById('casos-grid');
  contenedor.innerHTML = '';

  for (var i = 0; i < paquete.casos.length; i++) {
    (function(caso) {
      var prog = estado.progreso[caso.id] || {};
      var resuelto = prog.resuelto || false;

      var div = document.createElement('div');
      div.className = 'tarjeta-caso' + (resuelto ? ' resuelto' : '');
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');

      var estrellasHTML = '';
      for (var s = 1; s <= 3; s++) {
        estrellasHTML += '<span class="dificultad-star' + (s <= caso.dificultad ? ' activo' : '') + '">★</span>';
      }

      div.innerHTML =
        '<h3>' + escapeHTML(caso.titulo) + '</h3>' +
        '<p>' + escapeHTML(caso.meta) + '</p>' +
        '<div class="tarjeta-caso-footer">' +
          '<div class="dificultad">' + estrellasHTML + '</div>' +
          (resuelto ? '<span class="badge-resuelto">✔ Resuelto</span>' : '') +
        '</div>';

      div.addEventListener('click', function() {
        abrirCaso(caso);
      });
      div.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { div.click(); }
      });

      contenedor.appendChild(div);
    })(paquete.casos[i]);
  }
}

// ===================================
// CASO: ABRIR
// ===================================
function abrirCaso(caso) {
  estado.casoActual = caso;

  // Inicializar progreso si no existe
  if (!estado.progreso[caso.id]) {
    estado.progreso[caso.id] = {
      pistasReveladas: 0,
      cuadricula: {},
      resuelto: false
    };
    guardarProgreso();
  }

  renderizarCaso(caso);
  mostrarPantalla('caso');
}

// ===================================
// CASO: RENDERIZAR COMPLETO
// ===================================
function renderizarCaso(caso) {
  var prog = estado.progreso[caso.id];
  var resuelto = prog.resuelto || false;

  // ---- ENCABEZADO ----
  var estrellasHTML = '';
  for (var s = 1; s <= 3; s++) {
    estrellasHTML += '<span class="dificultad-star' + (s <= caso.dificultad ? ' activo' : '') + '">★</span>';
  }
  document.getElementById('caso-dificultad-badge').innerHTML = estrellasHTML;
  document.getElementById('caso-titulo').textContent = caso.titulo;
  document.getElementById('caso-meta').textContent = caso.meta;

  // Sello resuelto
  var sello = document.getElementById('caso-sello-resuelto');
  if (resuelto) {
    sello.classList.remove('oculto');
  } else {
    sello.classList.add('oculto');
  }

  // ---- HISTORIA ----
  var historiaContenedor = document.getElementById('caso-historia');
  historiaContenedor.innerHTML = '';
  for (var i = 0; i < caso.historia.length; i++) {
    var texto = caso.historia[i];
    var p = document.createElement('p');
    // Detectar si es un dialogo (empieza con guion largo o comilla)
    var esDialogo = texto.charAt(0) === '—' || texto.charAt(0) === '-' || texto.charAt(0) === '«';
    p.className = esDialogo ? 'historia-parrafo historia-dialogo' : 'historia-parrafo';
    p.textContent = texto;
    historiaContenedor.appendChild(p);
  }

  // ---- PRUEBAS EN ACORDEÓN ----
  renderizarPruebasAcordeon(caso);

  // ---- FICHAS PERSONAJES ----
  renderizarFichas(caso);

  // ---- PISTAS ----
  renderizarPistas(caso);

  // ---- CUADRÍCULA ----
  renderizarCuadricula(caso);

  // ---- BOTÓN REINICIAR ----
  var btnReiniciar = document.getElementById('btn-reiniciar-caso');
  btnReiniciar.onclick = function() {
    if (confirm('¿Reiniciar este caso? Se borrará todo el progreso, pistas y marcas.')) {
      estado.progreso[caso.id] = {
        pistasReveladas: 0,
        cuadricula: {},
        resuelto: false
      };
      guardarProgreso();
      renderizarCaso(caso);
    }
  };

  // ---- BOTÓN RESOLVER ----
  var btnResolver = document.getElementById('btn-resolver');
  btnResolver.onclick = function() {
    abrirModalResolver(caso);
  };

  // ---- BOTÓN REVELAR PISTA ----
  var btnPista = document.getElementById('btn-revelar-pista');
  btnPista.onclick = function() {
    revelarSiguientePista(caso);
  };

  // ---- HISTORIA: mostrar completa al abrir, con botón minimizar ----
  expandirHistoria();

  // ---- PRUEBAS: expandidas por defecto ----
  expandirPruebas();

  // ---- TUTORIAL: mostrar si es paquete tutorial y no se ha visto ya ----
  if (estado.paqueteActual && estado.paqueteActual.id === 'tutorial') {
    var yaVioTutorial = localStorage.getItem('dj_tutorial_visto');
    if (!yaVioTutorial) {
      setTimeout(function() { abrirTutorial(); }, 400);
    }
  }
}

// ===================================
// FICHAS DE PERSONAJES / LUGARES / QUÉS
// ===================================
function renderizarFichas(caso) {
  var c = document.getElementById('fichas-quien');
  c.innerHTML = '';
  var iconosQuien = ['🕵️','👩','👦','👧','🧔','👩‍🦱'];
  for (var i = 0; i < caso.quien.length; i++) {
    var p = caso.quien[i];
    var card = document.createElement('div');
    card.className = 'ficha-card tipo-quien';
    card.innerHTML =
      '<span class="ficha-icono">' + (iconosQuien[i] || '👤') + '</span>' +
      '<div class="ficha-nombre">' + escapeHTML(p.nombre) + '</div>';
    if (p.atributos) {
      var iconosAtributo = { altura: '📏', manualidad: '✋', ojos: '👁️', pelo: '💇', edad: '🎂' };
      var attrs = Object.keys(p.atributos);
      var attrTexto = '<div style="margin-top:8px;border-top:1px dashed #c8dff5;padding-top:6px;">';
      for (var k = 0; k < attrs.length; k++) {
        var icono = iconosAtributo[attrs[k]] || '•';
        attrTexto += '<div style="font-size:0.75rem;color:#4a6a8a;margin-top:3px;text-align:left;">' +
          icono + ' <strong>' + escapeHTML(attrs[k]) + ':</strong> ' +
          escapeHTML(String(p.atributos[attrs[k]])) + '</div>';
      }
      attrTexto += '</div>';
      card.innerHTML += attrTexto;
    }
    c.appendChild(card);
  }

  var d = document.getElementById('fichas-donde');
  d.innerHTML = '';
  var iconosDonde = ['🏛️','🌳','🏠','🏭','🔬','📚'];
  for (var i = 0; i < caso.donde.length; i++) {
    var lug = caso.donde[i];
    var card = document.createElement('div');
    card.className = 'ficha-card tipo-donde';
    card.innerHTML =
      '<span class="ficha-icono">' + (iconosDonde[i] || '📍') + '</span>' +
      '<div class="ficha-nombre">' + escapeHTML(lug.nombre) + '</div>';
    d.appendChild(card);
  }

  var q = document.getElementById('fichas-que');
  q.innerHTML = '';
  var iconosQue = ['💡','🎭','🎯','📖','💰','🎪'];
  for (var i = 0; i < caso.que.length; i++) {
    var inten = caso.que[i];
    var card = document.createElement('div');
    card.className = 'ficha-card tipo-que';
    card.innerHTML =
      '<span class="ficha-icono">' + (iconosQue[i] || '❓') + '</span>' +
      '<div class="ficha-nombre">' + escapeHTML(inten.nombre) + '</div>';
    q.appendChild(card);
  }
}

// ===================================
// PISTAS
// ===================================
function renderizarPistas(caso) {
  var prog = estado.progreso[caso.id];
  var reveladas = prog.pistasReveladas || 0;
  var total = caso.pistas.length;

  // Contador
  document.getElementById('pistas-contador').textContent =
    'Pistas reveladas: ' + reveladas + ' / ' + total;

  // Lista de pistas
  var lista = document.getElementById('pistas-lista');
  lista.innerHTML = '';
  for (var i = 0; i < reveladas; i++) {
    var li = document.createElement('div');
    li.className = 'pista-item';
    li.innerHTML =
      '<span class="pista-numero">Pista ' + (i + 1) + '</span>' +
      escapeHTML(caso.pistas[i]);
    lista.appendChild(li);
  }

  // Botón revelar
  var btn = document.getElementById('btn-revelar-pista');
  if (reveladas >= total) {
    btn.disabled = true;
    btn.textContent = '🔍 Sin más pistas';
    var agotadas = document.getElementById('pistas-agotadas');
    if (agotadas) { agotadas.classList.remove('oculto'); }
  } else {
    btn.disabled = false;
    btn.innerHTML = '🔍 Revelar pista (' + (total - reveladas) + ' restantes)';
    var agotadas = document.getElementById('pistas-agotadas');
    if (agotadas) { agotadas.classList.add('oculto'); }
  }

  // Resumen en panel cuaderno
  var resumenLista = document.getElementById('cuaderno-pistas-lista');
  resumenLista.innerHTML = '';
  for (var i = 0; i < reveladas; i++) {
    var li = document.createElement('li');
    var textoCorto = caso.pistas[i].substring(0, 60) + (caso.pistas[i].length > 60 ? '...' : '');
    li.textContent = textoCorto;
    resumenLista.appendChild(li);
  }
}

function revelarSiguientePista(caso) {
  var prog = estado.progreso[caso.id];
  var reveladas = prog.pistasReveladas || 0;
  if (reveladas < caso.pistas.length) {
    prog.pistasReveladas = reveladas + 1;
    guardarProgreso();
    renderizarPistas(caso);
  }
}

// ===================================
// CUADRÍCULA LÓGICA (tabla unificada estilo Murdle)
// ===================================
function renderizarCuadricula(caso) {
  var contenedor = document.getElementById('tabla-unificada');
  if (!contenedor) { return; }
  contenedor.innerHTML = '';

  var quien = caso.quien;
  var donde = caso.donde;
  var que   = caso.que;

  var tabla = document.createElement('table');
  tabla.className = 'tabla-grid tabla-murdle';

  // Fila 1 cabecera: grupos DONDE y QUE
  var thead = document.createElement('thead');
  var trGrupo = document.createElement('tr');

  var thVacio = document.createElement('th');
  thVacio.className = 'th-esquina';
  thVacio.setAttribute('rowspan', '2');
  trGrupo.appendChild(thVacio);

  var thDonde = document.createElement('th');
  thDonde.colSpan = donde.length;
  thDonde.className = 'th-grupo th-grupo-donde';
  thDonde.textContent = '📍 DÓNDE';
  trGrupo.appendChild(thDonde);

  var thSep = document.createElement('th');
  thSep.className = 'th-separador';
  thSep.setAttribute('rowspan', '2');
  trGrupo.appendChild(thSep);

  var thQue = document.createElement('th');
  thQue.colSpan = que.length;
  thQue.className = 'th-grupo th-grupo-que';
  thQue.textContent = '💡POR QUÉ';
  trGrupo.appendChild(thQue);

  thead.appendChild(trGrupo);

  // Fila 2 cabecera: nombres de columnas
  var trCols = document.createElement('tr');
  for (var j = 0; j < donde.length; j++) {
    var th = document.createElement('th');
    th.textContent = donde[j].nombre;
    th.className = 'th-col-donde';
    trCols.appendChild(th);
  }
  for (var j = 0; j < que.length; j++) {
    var th = document.createElement('th');
    th.textContent = que[j].nombre;
    th.className = 'th-col-que';
    trCols.appendChild(th);
  }
  thead.appendChild(trCols);
  tabla.appendChild(thead);

  // Cuerpo: una fila por sospechoso
  var tbody = document.createElement('tbody');
  for (var i = 0; i < quien.length; i++) {
    var tr = document.createElement('tr');

    var tdLabel = document.createElement('td');
    tdLabel.className = 'td-label td-label-quien';
    tdLabel.textContent = quien[i].nombre;
    tr.appendChild(tdLabel);

    for (var j = 0; j < donde.length; j++) {
      tr.appendChild(crearCelda(caso, 'quien-donde', quien[i].id, donde[j].id));
    }

    var tdSep = document.createElement('td');
    tdSep.className = 'td-separador';
    tr.appendChild(tdSep);

    for (var j = 0; j < que.length; j++) {
      tr.appendChild(crearCelda(caso, 'quien-que', quien[i].id, que[j].id));
    }

    tbody.appendChild(tr);
  }
  tabla.appendChild(tbody);
  contenedor.appendChild(tabla);
}

function crearCelda(caso, tipo, filaId, colId) {
  var td = document.createElement('td');
  var clave = tipo + '_' + filaId + '_' + colId;
  var prog = estado.progreso[caso.id];
  var valorActual = (prog.cuadricula && prog.cuadricula[clave]) || 'vacio';

  td.className = 'celda-grid estado-' + valorActual;
  td.setAttribute('tabindex', '0');
  td.setAttribute('role', 'button');
  td.setAttribute('aria-label', filaId + ' / ' + colId);
  actualizarTextoCelda(td, valorActual);

  (function(tdEl, casoRef, tipoRef, fId, cId) {
    tdEl.addEventListener('click', function() {
      clickCelda(tdEl, casoRef, tipoRef, fId, cId);
    });
    tdEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickCelda(tdEl, casoRef, tipoRef, fId, cId);
      }
    });
  })(td, caso, tipo, filaId, colId);

  return td;
}

function renderizarTabla(caso, tipo, filas, columnas, etiqueta) {
  var contenedor = document.getElementById('tabla-' + tipo);
  if (!contenedor) { return; }
  contenedor.innerHTML = '';

  var tituloDiv = document.getElementById('titulo-tabla-' + tipo);
  if (tituloDiv) { tituloDiv.textContent = etiqueta; }

  var tabla = document.createElement('table');
  tabla.className = 'tabla-grid';

  // Cabecera
  var thead = document.createElement('thead');
  var trHead = document.createElement('tr');
  var thEsquina = document.createElement('th');
  thEsquina.className = 'th-esquina';
  trHead.appendChild(thEsquina);
  for (var j = 0; j < columnas.length; j++) {
    var th = document.createElement('th');
    th.textContent = columnas[j].nombre;
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  tabla.appendChild(thead);

  // Cuerpo
  var tbody = document.createElement('tbody');
  for (var i = 0; i < filas.length; i++) {
    var tr = document.createElement('tr');
    var tdLabel = document.createElement('td');
    tdLabel.className = 'td-label';
    tdLabel.textContent = filas[i].nombre;
    tr.appendChild(tdLabel);

    for (var j = 0; j < columnas.length; j++) {
      var td = document.createElement('td');
      var claveCelda = tipo + '_' + filas[i].id + '_' + columnas[j].id;
      var prog = estado.progreso[caso.id];
      var valorActual = (prog.cuadricula && prog.cuadricula[claveCelda]) || 'vacio';

      td.className = 'celda-grid estado-' + valorActual;
      td.setAttribute('data-clave', claveCelda);
      td.setAttribute('data-tipo', tipo);
      td.setAttribute('data-fila', filas[i].id);
      td.setAttribute('data-col', columnas[j].id);
      td.setAttribute('tabindex', '0');
      td.setAttribute('role', 'button');
      td.setAttribute('aria-label', filas[i].nombre + ' / ' + columnas[j].nombre);

      actualizarTextoCelda(td, valorActual);

      (function(tdEl, casoRef, tipoRef, filaId, colId) {
        tdEl.addEventListener('click', function() {
          clickCelda(tdEl, casoRef, tipoRef, filaId, colId);
        });
        tdEl.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clickCelda(tdEl, casoRef, tipoRef, filaId, colId);
          }
        });
      })(td, caso, tipo, filas[i].id, columnas[j].id);

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabla.appendChild(tbody);
  contenedor.appendChild(tabla);
}

function actualizarTextoCelda(td, estado) {
  if (estado === 'check') { td.textContent = '✔'; }
  else if (estado === 'cruz') { td.textContent = '✖'; }
  else { td.textContent = ''; }
}

function clickCelda(td, caso, tipo, filaId, colId) {
  var prog = estado.progreso[caso.id];
  var clave = tipo + '_' + filaId + '_' + colId;
  var actual = (prog.cuadricula && prog.cuadricula[clave]) || 'vacio';
  var siguiente = actual === 'vacio' ? 'check' : (actual === 'check' ? 'cruz' : 'vacio');

  prog.cuadricula[clave] = siguiente;
  td.className = 'celda-grid estado-' + siguiente;
  actualizarTextoCelda(td, siguiente);

  // Modo ayuda automática
  var toggleAyuda = document.getElementById('toggle-ayuda-auto');
  if (toggleAyuda && toggleAyuda.checked && siguiente === 'check') {
    aplicarAyudaAutomatica(caso, tipo, filaId, colId);
  }

  guardarProgreso();
}

function aplicarAyudaAutomatica(caso, tipo, filaId, colId) {
  var prog = estado.progreso[caso.id];
  var filas, columnas;

  if (tipo === 'quien-donde') {
    filas = caso.quien;
    columnas = caso.donde;
  } else {
    filas = caso.quien;
    columnas = caso.que;
  }

  // Marcar ✖ en el resto de la misma fila
  for (var j = 0; j < columnas.length; j++) {
    if (columnas[j].id !== colId) {
      var clave = tipo + '_' + filaId + '_' + columnas[j].id;
      if (!prog.cuadricula[clave] || prog.cuadricula[clave] === 'vacio') {
        prog.cuadricula[clave] = 'cruz';
      }
    }
  }

  // Marcar ✖ en el resto de la misma columna
  for (var i = 0; i < filas.length; i++) {
    if (filas[i].id !== filaId) {
      var clave = tipo + '_' + filas[i].id + '_' + colId;
      if (!prog.cuadricula[clave] || prog.cuadricula[clave] === 'vacio') {
        prog.cuadricula[clave] = 'cruz';
      }
    }
  }

  // Re-renderizar la cuadricula unificada
  renderizarCuadricula(caso);
}

// ===================================
// MODAL: PRUEBAS
// ===================================
// ===================================
// PRUEBAS EN ACORDEÓN (en panel izquierdo)
// ===================================
function renderizarPruebasAcordeon(caso) {
  var contenedor = document.getElementById('pruebas-acordeon');
  if (!contenedor) { return; }
  contenedor.innerHTML = '';

  if (!caso.pruebas || caso.pruebas.length === 0) {
    contenedor.innerHTML = '<p style="color:var(--color-texto-suave);font-style:italic;padding:8px 0;">Este caso no tiene pruebas físicas registradas.</p>';
    return;
  }

  for (var i = 0; i < caso.pruebas.length; i++) {
    var pr = caso.pruebas[i];
    var item = document.createElement('div');
    item.className = 'prueba-acordeon-item';

    var contenidoImg = '';
    if (pr.tipo === 'image' && pr.imagen) {
      contenidoImg = '<img src="' + escapeHTML(pr.imagen) + '" alt="' + escapeHTML(pr.titulo) + '" class="prueba-imagen">';
    } else if (pr.tipo === 'image') {
      contenidoImg = '<div class="prueba-placeholder-img">🖼️</div>';
    }

    var idCuerpo = 'prueba-cuerpo-' + i;
    item.innerHTML =
      '<button class="prueba-acordeon-cabecera" aria-expanded="true" aria-controls="' + idCuerpo + '">' +
        '<span>📌 ' + escapeHTML(pr.titulo) + '</span>' +
        '<span class="prueba-acordeon-flecha">▲</span>' +
      '</button>' +
      '<div class="prueba-acordeon-cuerpo" id="' + idCuerpo + '" aria-hidden="false" style="max-height:1000px;opacity:1;padding:12px 14px;">' +
        '<p>' + escapeHTML(pr.descripcion).replace(/\n/g, '<br>') + '</p>' +
        contenidoImg +
      '</div>';

    item.querySelector('.prueba-acordeon-cabecera').addEventListener('click', function() {
      var cabecera = this;
      var cuerpo = cabecera.nextElementSibling;
      var abierto = cabecera.getAttribute('aria-expanded') === 'true';
      cabecera.setAttribute('aria-expanded', abierto ? 'false' : 'true');
      cuerpo.setAttribute('aria-hidden', abierto ? 'true' : 'false');
      cuerpo.style.maxHeight = abierto ? '0' : cuerpo.scrollHeight + 'px';
      cuerpo.style.opacity = abierto ? '0' : '1';
      cabecera.querySelector('.prueba-acordeon-flecha').textContent = abierto ? '▼' : '▲';
    });

    contenedor.appendChild(item);
  }
}

// ===================================
// HISTORIA: EXPANDIR / MINIMIZAR
// ===================================
function expandirHistoria() {
  var wrap = document.getElementById('caso-historia-wrap');
  var btn = document.getElementById('btn-minimizar-historia');
  if (!wrap || !btn) { return; }
  wrap.style.display = 'block';
  btn.setAttribute('aria-expanded', 'true');
  btn.innerHTML = '<span class="minimizar-texto">Minimizar</span> ▲';
}

function minimizarHistoria() {
  var wrap = document.getElementById('caso-historia-wrap');
  var btn = document.getElementById('btn-minimizar-historia');
  if (!wrap || !btn) { return; }
  wrap.style.display = 'none';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="minimizar-texto">Ver historia</span> ▼';
  // Hacer scroll suave hacia las pruebas
  var seccionPruebas = document.getElementById('seccion-pruebas');
  if (seccionPruebas) {
    setTimeout(function() {
      seccionPruebas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

function toggleHistoria() {
  var wrap = document.getElementById('caso-historia-wrap');
  if (!wrap) { return; }
  if (wrap.style.display === 'none') {
    expandirHistoria();
  } else {
    minimizarHistoria();
  }
}

// ===================================
// PRUEBAS ACORDEÓN: COLAPSAR / EXPANDIR SECCIÓN
// ===================================
function colapsarPruebas() {
  var acordeon = document.getElementById('pruebas-acordeon');
  var btn = document.getElementById('btn-toggle-pruebas');
  if (!acordeon || !btn) { return; }
  acordeon.setAttribute('aria-hidden', 'true');
  acordeon.style.display = 'none';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="minimizar-texto">Ver todas</span> ▼';
}

function togglePruebas() {
  var acordeon = document.getElementById('pruebas-acordeon');
  var btn = document.getElementById('btn-toggle-pruebas');
  if (!acordeon || !btn) { return; }
  var oculto = acordeon.style.display === 'none' || acordeon.getAttribute('aria-hidden') === 'true';
  if (oculto) {
    acordeon.style.display = 'block';
    acordeon.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = '<span class="minimizar-texto">Ocultar</span> ▲';
  } else {
    colapsarPruebas();
  }
}

// ===================================
// TUTORIAL: TOOLTIPS ONBOARDING
// ===================================
var tooltipsPasos = [
  {
    ancla: 'caso-historia-wrap',
    posicion: 'abajo',
    texto: '📖 Empieza leyendo la historia. La Happy Pandi te presenta el misterio y los sospechosos.',
    boton: 'Entendido →'
  },
  {
    ancla: 'seccion-pruebas',
    posicion: 'abajo',
    texto: '🗂️ Aquí están las pruebas físicas del caso. ¡Son tu mejor herramienta! Léelas con atención.',
    boton: 'Siguiente →'
  },
  {
    ancla: 'seccion-fichas',
    posicion: 'abajo',
    texto: '🃏 Las fichas te muestran los datos de cada sospechoso. Fíjate en la altura, el pelo... ¡pueden ser clave!',
    boton: 'Siguiente →'
  },
  {
    ancla: 'tabla-unificada',
    posicion: 'arriba',
    texto: '📓 Usa esta cuadrícula para apuntar tus deducciones. Toca una celda: ✔ si coincide, ✖ si no. ¡Toca otra vez para borrar!',
    boton: 'Siguiente →'
  },
  {
    ancla: 'btn-revelar-pista',
    posicion: 'arriba',
    texto: '🗝️ Si te atascas, usa "Revelar pista". La Happy Pandi te ayudará paso a paso.',
    boton: 'Siguiente →'
  },
  {
    ancla: 'btn-resolver',
    posicion: 'arriba',
    texto: '✅ Cuando tengas la solución, pulsa aquí. ¡Indica quién fue, dónde y por qué!',
    boton: '¡A resolver! 🔍'
  }
];

var tooltipPasoActual = 0;
var tooltipEl = null;
var tooltipOverlayEl = null;

function abrirTutorial() {
  var yaVioTutorial = localStorage.getItem('dj_tutorial_visto');
  if (yaVioTutorial) { return; }
  tooltipPasoActual = 0;
  mostrarTooltip(0);
}

function cerrarTutorial() {
  quitarTooltip();
  localStorage.setItem('dj_tutorial_visto', '1');
}

function cerrarTutorialBtn() {
  cerrarTutorial();
}

function tooltipSiguiente() {
  tooltipPasoActual++;
  if (tooltipPasoActual >= tooltipsPasos.length) {
    cerrarTutorial();
  } else {
    mostrarTooltip(tooltipPasoActual);
  }
}

function quitarTooltip() {
  if (tooltipEl && tooltipEl.parentNode) { tooltipEl.parentNode.removeChild(tooltipEl); }
  if (tooltipOverlayEl && tooltipOverlayEl.parentNode) { tooltipOverlayEl.parentNode.removeChild(tooltipOverlayEl); }
  tooltipEl = null;
  tooltipOverlayEl = null;
  // Quitar highlight de todos
  var highlighted = document.querySelectorAll('.tutorial-highlight');
  for (var i = 0; i < highlighted.length; i++) {
    highlighted[i].classList.remove('tutorial-highlight');
  }
}

function mostrarTooltip(pasoIdx) {
  quitarTooltip();
  var paso = tooltipsPasos[pasoIdx];
  var ancla = document.getElementById(paso.ancla);
  if (!ancla) { tooltipSiguiente(); return; }

  // Scroll al elemento ancla
  ancla.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ancla.classList.add('tutorial-highlight');

  // Overlay semitransparente
  tooltipOverlayEl = document.createElement('div');
  tooltipOverlayEl.className = 'tooltip-overlay';
  document.body.appendChild(tooltipOverlayEl);

  // Crear tooltip
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip-onboarding tooltip-' + paso.posicion;

  var progreso = (pasoIdx + 1) + ' / ' + tooltipsPasos.length;

  tooltipEl.innerHTML =
    '<div class="tooltip-progreso">' + progreso + '</div>' +
    '<p class="tooltip-texto">' + paso.texto + '</p>' +
    '<div class="tooltip-acciones">' +
      '<button class="tooltip-btn-saltar" onclick="cerrarTutorialBtn()">Saltar tutorial</button>' +
      '<button class="tooltip-btn-siguiente btn-primario" onclick="tooltipSiguiente()">' + paso.boton + '</button>' +
    '</div>';

  document.body.appendChild(tooltipEl);

  // Posicionar después de render
  setTimeout(function() {
    var rect = ancla.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var scrollX = window.scrollX || window.pageXOffset;
    var ttW = tooltipEl.offsetWidth || 300;
    var ttH = tooltipEl.offsetHeight || 120;
    var margen = 12;

    var left = rect.left + scrollX + (rect.width / 2) - (ttW / 2);
    left = Math.max(12, Math.min(left, window.innerWidth - ttW - 12));

    var top;
    if (paso.posicion === 'abajo') {
      top = rect.bottom + scrollY + margen;
    } else {
      top = rect.top + scrollY - ttH - margen;
      if (top < scrollY + 12) { top = rect.bottom + scrollY + margen; }
    }

    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  }, 120);
}

// expand pruebas helper
function expandirPruebas() {
  var acordeon = document.getElementById('pruebas-acordeon');
  var btn = document.getElementById('btn-toggle-pruebas');
  if (!acordeon) { return; }
  acordeon.style.display = 'block';
  acordeon.setAttribute('aria-hidden', 'false');
  if (btn) {
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = '<span class="minimizar-texto">Ocultar</span> ▲';
  }
}

// ===================================
// MODAL: RESOLVER
// ===================================
function abrirModalResolver(caso) {
  // Rellenar selects
  rellenarSelect('select-quien', caso.quien);
  rellenarSelect('select-donde', caso.donde);
  rellenarSelect('select-que', caso.que);

  // Limpiar feedback previo
  document.getElementById('resolver-feedback').textContent = '';
  document.getElementById('resolver-feedback').style.display = 'none';

  abrirModal('modal-resolver');
}

function rellenarSelect(selectId, opciones) {
  var sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">-- Elige --</option>';
  for (var i = 0; i < opciones.length; i++) {
    var opt = document.createElement('option');
    opt.value = opciones[i].id;
    opt.textContent = opciones[i].nombre;
    sel.appendChild(opt);
  }
}

function comprobarSolucion() {
  var caso = estado.casoActual;
  var quien = document.getElementById('select-quien').value;
  var donde = document.getElementById('select-donde').value;
  var que = document.getElementById('select-que').value;

  if (!quien || !donde || !que) {
    var fb = document.getElementById('resolver-feedback');
    fb.textContent = '⚠️ Elige una opción para cada campo antes de resolver.';
    fb.style.display = 'block';
    fb.style.color = 'var(--color-acento)';
    return;
  }

  var sol = caso.solucion;
  var correcto = (quien === sol.quien && donde === sol.donde && que === sol.que);

  cerrarModal('modal-resolver');
  mostrarResultado(caso, correcto, quien, donde, que);

  if (correcto) {
    estado.progreso[caso.id].resuelto = true;
    guardarProgreso();
    // Actualizar sello
    document.getElementById('caso-sello-resuelto').classList.remove('oculto');
  }
}

// ===================================
// MODAL: RESULTADO
// ===================================
function mostrarResultado(caso, correcto, quienId, dondeId, queId) {
  var icono = document.getElementById('resultado-icono');
  var titulo = document.getElementById('resultado-titulo');
  var texto = document.getElementById('resultado-texto');
  var detalle = document.getElementById('resultado-detalle');

  if (correcto) {
    icono.textContent = '🏆';
    titulo.textContent = '¡CASO RESUELTO!';
    titulo.className = 'resultado-titulo ok';
    texto.textContent = caso.feedback_ok;

    var quienNombre = encontrarNombre(caso.quien, caso.solucion.quien);
    var dondeNombre = encontrarNombre(caso.donde, caso.solucion.donde);
    var queNombre = encontrarNombre(caso.que, caso.solucion.que);

    detalle.innerHTML =
      '<p>🕵️ <strong>Culpable:</strong> ' + escapeHTML(quienNombre) + '</p>' +
      '<p>📍 <strong>Lugar:</strong> ' + escapeHTML(dondeNombre) + '</p>' +
      '<p>💡 <strong>Motivo:</strong> ' + escapeHTML(queNombre) + '</p>';
    detalle.style.display = 'block';
  } else {
    icono.textContent = '🔎';
    titulo.textContent = 'Hmm, no es correcto...';
    titulo.className = 'resultado-titulo ko';
    texto.textContent = caso.feedback_ko;
    detalle.style.display = 'none';
  }

  abrirModal('modal-resultado');
}

function encontrarNombre(lista, id) {
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].id === id) { return lista[i].nombre; }
  }
  return id;
}

// ===================================
// GESTIÓN DE MODALES
// ===================================
function abrirModal(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.add('abierto'); }
}

function cerrarModal(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('abierto'); }
}

// ===================================
// PERSISTENCIA (localStorage)
// ===================================
function guardarProgreso() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(estado.progreso));
  } catch(e) {
    console.warn('No se pudo guardar progreso:', e);
  }
}

function cargarProgreso() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        estado.progreso = parsed;
      }
    }
  } catch(e) {
    estado.progreso = {};
  }
}

// ===================================
// UTILIDADES
// ===================================
function escapeHTML(str) {
  if (str === null || str === undefined) { return ''; }
  var s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
