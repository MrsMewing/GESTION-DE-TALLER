const DB_NAME = 'tallerDB';
    const STORE_NAME = 'ordenes';
    const NOTAS_STORE_NAME = 'notas';
    const DB_VERSION = 2;
    const CLEANUP_KEY = 'taller-db-cleanup-done';

    let db = null;
    let ordenesEnMemoria = [];
    let notasEnMemoria = [];
    let recordatoriosActivos = new Map();
    let ordenSeleccionada = null;
    let indiceSeccionActual = 0;
    let indiceSeccionNueva = 0;
    let estadoFiltradoActual = 'pendiente';
    let modoFiltroFecha = 'hoy';
    let filtroFechaActual = obtenerFechaActualLocal();
    let fotosNuevaOrden = [];
    const seccionesModal = ["cliente", "equipo", "falla"];
    const seccionesNuevaModal = ["cliente", "equipo", "falla", "resumen"];

    function abrirBaseDeDatos() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'numeroOrden' });
            store.createIndex('estado', 'estado', { unique: false });
        }

        if (!database.objectStoreNames.contains(NOTAS_STORE_NAME)) {
            database.createObjectStore(NOTAS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        };

        request.onsuccess = () => {
        db = request.result;
        resolve(db);
        };

        request.onerror = () => reject(request.error);
    });
    }

    function cargarOrdenesDesdeDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
        reject(new Error('La base de datos aún no está abierta.'));
        return;
        }

        const transaccion = db.transaction(STORE_NAME, 'readonly');
        const store = transaccion.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
        ordenesEnMemoria = request.result || [];
        resolve(ordenesEnMemoria);
        };

        request.onerror = () => reject(request.error);
    });
    }

    function limpiarBaseDeDatos() {
    return new Promise((resolve, reject) => {
        if (!db) {
        reject(new Error('La base de datos aún no está abierta.'));
        return;
        }

        const transaccion = db.transaction(STORE_NAME, 'readwrite');
        const store = transaccion.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
        ordenesEnMemoria = [];
        resolve();
        };

        request.onerror = () => reject(request.error);
    });
    }

    function guardarOrdenesEnDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
        reject(new Error('La base de datos aún no está abierta.'));
        return;
        }

        const transaccion = db.transaction(STORE_NAME, 'readwrite');
        const store = transaccion.objectStore(STORE_NAME);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);

        store.clear();
        ordenesEnMemoria.forEach(orden => store.put(orden));
    });
    }

    function cargarNotasDesdeDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
        reject(new Error('La base de datos aún no está abierta.'));
        return;
        }

        const transaccion = db.transaction(NOTAS_STORE_NAME, 'readonly');
        const store = transaccion.objectStore(NOTAS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
        notasEnMemoria = request.result || [];
        resolve(notasEnMemoria);
        };

        request.onerror = () => reject(request.error);
    });
    }

    function guardarNotasEnDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
        reject(new Error('La base de datos aún no está abierta.'));
        return;
        }

        const transaccion = db.transaction(NOTAS_STORE_NAME, 'readwrite');
        const store = transaccion.objectStore(NOTAS_STORE_NAME);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);

        store.clear();
        notasEnMemoria.forEach(nota => store.put(nota));
    });
    }

    async function iniciarAplicacion() {
    await abrirBaseDeDatos();

    if (!localStorage.getItem(CLEANUP_KEY)) {
        await limpiarBaseDeDatos();
        localStorage.setItem(CLEANUP_KEY, '1');
    }

    await cargarOrdenesDesdeDB();
    await cargarNotasDesdeDB();
    establecerFiltroHoy();
    renderizarOrdenes(estadoFiltradoActual);
    renderizarNotas();
    mostrarEstadoNotificaciones(obtenerEstadoNotificaciones().mensaje);
    programarRecordatorios();
    }

    function obtenerHoraActualLocal() {
    return new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    }

    function formatearHoraAMPM(hora) {
    if (!hora) return 'Sin horario';

    const textoHora = String(hora).trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ');
    const coincidencia = textoHora.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|A M|P M)?$/);
    if (!coincidencia) return hora;

    let horas = Number(coincidencia[1]);
    const minutos = coincidencia[2];
    const meridiano = coincidencia[3]?.replace(' ', '');

    if (meridiano) {
        horas = horas % 12 + (meridiano === 'PM' ? 12 : 0);
    }

    const meridianoFinal = horas >= 12 ? 'PM' : 'AM';
    const horas12 = horas % 12 || 12;
    return `${String(horas12).padStart(2, '0')}:${minutos} ${meridianoFinal}`;
    }

    function obtenerFechaActualLocal() {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
    }

    function formatearFechaOrden(fecha) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha || 'Sin fecha';

    const [año, mes, dia] = fecha.split('-');
    return `${año}/${dia}/${mes}`;
    }

    function obtenerTiempoRestanteEntrega(orden) {
    const horaEntrega = orden?.fallaInfo?.horaEntrega || orden?.horaEntrega;
    const fechaEntrega = orden?.fallaInfo?.fechaEntrega || orden?.fechaEntrega;

    if (!horaEntrega || !fechaEntrega) {
        return 'Sin hora de entrega';
    }

    const fechaObjetivo = new Date(`${fechaEntrega}T${horaEntrega}:00`);
    const ahora = new Date();
    const diferenciaMs = fechaObjetivo.getTime() - ahora.getTime();

    if (Number.isNaN(fechaObjetivo.getTime())) {
        return 'Hora no válida';
    }

    if (diferenciaMs <= 0) {
        return 'Entrega vencida';
    }

    const totalSegundos = Math.floor(diferenciaMs / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    return `${horas}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
    }

    function actualizarTiempoRestanteEnTarjetas() {
    const tarjetas = document.querySelectorAll('.tarjeta-orden');

    tarjetas.forEach(tarjeta => {
        const numeroOrden = tarjeta.dataset.numeroOrden;
        const orden = ordenesEnMemoria.find(item => item.numeroOrden === numeroOrden);
        const elementoTiempo = tarjeta.querySelector('.tiempo-restante-valor');

        if (!orden || !elementoTiempo) return;

        elementoTiempo.textContent = obtenerTiempoRestanteEntrega(orden);
    });
    }

    function obtenerFechasOrden(orden) {
    return [
        orden?.fechaEntrega,
        orden?.fallaInfo?.fechaEntrega
    ].filter(Boolean);
    }

    function filtrarPorFecha() {
    const inputFecha = document.getElementById('filtro-fecha-ordenes');
    const fechaSeleccionada = inputFecha?.value || '';

    if (!fechaSeleccionada || (modoFiltroFecha === 'fecha' && fechaSeleccionada === filtroFechaActual)
        || (modoFiltroFecha === 'hoy' && fechaSeleccionada === obtenerFechaActualLocal())) {
        establecerFiltroHoy();
        renderizarOrdenes(estadoFiltradoActual);
        return;
    }

    modoFiltroFecha = 'fecha';
    filtroFechaActual = fechaSeleccionada;
    actualizarControlesFiltroFecha();
    renderizarOrdenes(estadoFiltradoActual);
    }

    function limpiarFiltroFecha() {
    if (modoFiltroFecha === 'todas') {
        establecerFiltroHoy();
    } else {
        modoFiltroFecha = 'todas';
        filtroFechaActual = '';
        actualizarControlesFiltroFecha();
    }
    renderizarOrdenes(estadoFiltradoActual);
    }

    function establecerFiltroHoy() {
    modoFiltroFecha = 'hoy';
    filtroFechaActual = obtenerFechaActualLocal();
    actualizarControlesFiltroFecha();
    }

    function actualizarControlesFiltroFecha() {
    const inputFecha = document.getElementById('filtro-fecha-ordenes');
    const botonFiltrar = document.querySelector('.btn-filtrar-fecha');
    const botonTodas = document.querySelector('.btn-limpiar-fecha');
    const titulo = document.getElementById('titulo-filtro-ordenes');

    if (inputFecha && modoFiltroFecha !== 'todas') inputFecha.value = filtroFechaActual;
    botonFiltrar?.classList.toggle('activo', modoFiltroFecha !== 'todas');
    botonTodas?.classList.toggle('activo', modoFiltroFecha === 'todas');

    if (!titulo) return;

    if (modoFiltroFecha === 'hoy') {
        titulo.textContent = 'Órdenes de Hoy';
    } else if (modoFiltroFecha === 'fecha') {
        titulo.textContent = `Órdenes del ${filtroFechaActual}`;
    } else {
        titulo.textContent = 'Todas las Órdenes';
    }
    }

    function renderizarOrdenes(estadoFiltrado) {
    const contenedor = document.getElementById('contenedor-tarjetas');
    contenedor.innerHTML = "";

    const ordenesFiltradas = ordenesEnMemoria.filter(orden => {
        const estadosDeLaSeccion = {
            pendiente: ['pendiente', 'esperando_repuesto', 'esperando_confirmacion'],
            proceso: ['proceso'],
            terminada: ['terminada', 'entregado']
        };
        const coincideEstado = estadosDeLaSeccion[estadoFiltrado]?.includes(orden.estado);
        if (!coincideEstado) return false;

        if (modoFiltroFecha === 'todas') return true;

        return obtenerFechasOrden(orden).includes(filtroFechaActual);
    });

    if (ordenesFiltradas.length === 0) {
        const textoSinResultados = modoFiltroFecha !== 'todas'
        ? `No hay órdenes para el día ${filtroFechaActual}`
        : `No hay órdenes en este estado 👍`;

        contenedor.innerHTML = `<p class="mensaje-vacio">${textoSinResultados}</p>`;
        return;
    }

    ordenesFiltradas.forEach(orden => {
        const tarjeta = document.createElement('div');
        tarjeta.className = `tarjeta-orden ${orden.estado}`;
        tarjeta.dataset.numeroOrden = orden.numeroOrden;
        tarjeta.addEventListener('click', (event) => {
        if (event.target.closest('.btn-eliminar-orden-tarjeta')) return;
        abrirModalOrden(orden);
        });

        let textoEstadoVisual = "";
        if (orden.estado === 'pendiente') textoEstadoVisual = "Pendiente de revisión";
        if (orden.estado === 'proceso') textoEstadoVisual = "En proceso de reparación";
        if (orden.estado === 'terminada') textoEstadoVisual = "Terminada / Lista para entrega";
        if (orden.estado === 'esperando_repuesto') textoEstadoVisual = "Esperando repuesto";
        if (orden.estado === 'esperando_confirmacion') textoEstadoVisual = "Esperando confirmación";
        if (orden.estado === 'entregado') textoEstadoVisual = "Entregado";

        const horaEntrega = orden?.fallaInfo?.horaEntrega || orden?.horaEntrega || 'Sin horario';
        const fechaEntrega = orden?.fallaInfo?.fechaEntrega || orden?.fechaEntrega || 'Sin fecha';
        const tiempoRestante = obtenerTiempoRestanteEntrega(orden);

        tarjeta.innerHTML = `
        <div class="tarjeta-header">
            <span class="orden-numero">${orden.numeroOrden}</span>
            <span class="orden-fecha">📅 ${formatearFechaOrden(orden.fechaIngreso)} 🕒 ${formatearHoraAMPM(orden.horaIngreso)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="flex: 1;">
            <h3>${orden.equipo}</h3>
            <p><strong>Falla principal:</strong> ${orden.falla}</p>
            </div>
            <div style="min-width: 160px; text-align: right; font-size: 12px; color: #dfe9f3;">
            <div class="orden-fecha">📅 ${formatearFechaOrden(fechaEntrega)} 🕒 ${formatearHoraAMPM(horaEntrega)}</div>
            <div class="tiempo-restante-valor" style="margin-top: 6px; font-weight: 700; color: #f6c76e;">${tiempoRestante}</div>
            </div>
        </div>
        <p class="estado-texto"><span class="estado-etiqueta estado-${orden.estado}">● ${textoEstadoVisual}</span></p>
        <button class="btn-eliminar-orden-tarjeta" onclick="event.stopPropagation(); eliminarOrdenDesdeTarjeta('${orden.numeroOrden}')">Eliminar</button>
        `;

        contenedor.appendChild(tarjeta);
    });
    }

    function filtrarEstados(estado, botonPresionado) {
    const botonesSub = document.querySelectorAll('.btn-sub');
    botonesSub.forEach(btn => btn.classList.remove('activo'));
    botonPresionado.classList.add('activo');
    estadoFiltradoActual = estado;
    renderizarOrdenes(estado);
    }

    function cambiarPestaña(seccionId, botonSeleccionado) {
    const secciones = document.querySelectorAll('.seccion');
    secciones.forEach(sec => sec.classList.remove('activa'));

    const botones = document.querySelectorAll('.btn-nav');
    botones.forEach(btn => btn.classList.remove('activo'));

    document.getElementById('seccion-' + seccionId).classList.add('activa');
    botonSeleccionado.classList.add('activo');
    }

    function abrirModalOrden(orden) {
    ordenSeleccionada = orden;
    indiceSeccionActual = 0;
    document.getElementById('titulo-modal').textContent = `${orden.numeroOrden} - ${orden.equipo}`;
    document.getElementById('modal-orden').classList.remove('modal-oculto');
    actualizarModal();
    }

    function generarNumeroOrden() {
    const maximo = ordenesEnMemoria.reduce((valorMaximo, orden) => {
        const numero = Number((orden.numeroOrden.match(/\d+/) || ['0'])[0]);
        return Math.max(valorMaximo, numero);
    }, 0);

    return `ORD-${String(maximo + 1).padStart(3, '0')}`;
    }

    async function eliminarOrdenDesdeTarjeta(numeroOrden) {
    const confirmar = confirm(`¿Seguro que quieres eliminar la orden ${numeroOrden}?`);
    if (!confirmar) return;

    ordenesEnMemoria = ordenesEnMemoria.filter(orden => orden.numeroOrden !== numeroOrden);
    await guardarOrdenesEnDB();

    if (ordenSeleccionada && ordenSeleccionada.numeroOrden === numeroOrden) {
        ordenSeleccionada = null;
        document.getElementById('modal-orden').classList.add('modal-oculto');
    }

    renderizarOrdenes(estadoFiltradoActual);
    }

    function cerrarModalOrden(event) {
    if (event && event.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-orden').classList.add('modal-oculto');
        return;
    }

    if (!event) {
        document.getElementById('modal-orden').classList.add('modal-oculto');
    }
    }

    function mostrarSeccionModal(index) {
    indiceSeccionActual = index;
    actualizarModal();
    }

    function abrirModalNuevaOrden() {
    indiceSeccionNueva = 0;
    fotosNuevaOrden = [];
    document.getElementById('modal-nueva-orden').classList.remove('modal-oculto');

    const fechaEntrega = document.getElementById('falla-fecha-entrega');
    const horaEntrega = document.getElementById('falla-hora-entrega');
    if (fechaEntrega) fechaEntrega.value = obtenerFechaActualLocal();
    if (horaEntrega) horaEntrega.value = obtenerHoraActualLocal();

    actualizarModalNuevo();
    }

    function cerrarModalNuevaOrden(event) {
    if (event && event.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-nueva-orden').classList.add('modal-oculto');
        limpiarFormularioNuevaOrden();
        return;
    }

    if (!event) {
        document.getElementById('modal-nueva-orden').classList.add('modal-oculto');
        limpiarFormularioNuevaOrden();
    }
    }

    function limpiarFormularioNuevaOrden() {
    document.querySelectorAll('#modal-nueva-orden input, #modal-nueva-orden textarea').forEach(campo => {
        if (campo.type === 'file') {
        campo.value = '';
        } else {
        campo.value = '';
        }
    });
    fotosNuevaOrden = [];
    }

    function mostrarSeccionNueva(index) {
    indiceSeccionNueva = index;
    actualizarModalNuevo();
    }

    function cambiarSeccionModal(direccion) {
    indiceSeccionActual += direccion;

    if (indiceSeccionActual < 0) indiceSeccionActual = 0;
    if (indiceSeccionActual > seccionesModal.length - 1) indiceSeccionActual = seccionesModal.length - 1;

    actualizarModal();
    }

    function getOpcionesCambioEstado(estadoActual) {
    const estadosDisponibles = [
        { key: 'pendiente', label: 'Pendiente' },
        { key: 'proceso', label: 'En proceso' },
        { key: 'esperando_repuesto', label: 'Esperando repuesto' },
        { key: 'esperando_confirmacion', label: 'Esperando confirmación' },
        { key: 'terminada', label: 'Terminada' },
        { key: 'entregado', label: 'Entregado' }
    ];

    return estadosDisponibles
        .filter(estado => estado.key !== estadoActual)
        .map(estado => `<button class="opcion-estado" data-estado="${estado.key}" onclick="cambiarEstadoOrden('${estado.key}')">${estado.label}</button>`)
        .join('');
    }

    function toggleCambioEstado() {
    const opciones = document.getElementById('opciones-cambio-estado');
    opciones.classList.toggle('activo');
    }

    async function cambiarEstadoOrden(nuevoEstado) {
    if (!ordenSeleccionada || nuevoEstado === ordenSeleccionada.estado) return;

    const ordenEnBase = ordenesEnMemoria.find(orden => orden.numeroOrden === ordenSeleccionada.numeroOrden);
    if (!ordenEnBase) return;

    ordenEnBase.estado = nuevoEstado;
    ordenSeleccionada.estado = nuevoEstado;

    await guardarOrdenesEnDB();
    const estadoDesdeFiltro = estadoFiltradoActual;
    renderizarOrdenes(estadoDesdeFiltro);
    actualizarModal();
    }

    function obtenerHorasDeEntrega() {
    const horas = [];

    for (let hora = 8; hora <= 18; hora++) {
        const horaBase = `${String(hora).padStart(2, '0')}:00`;
        horas.push(horaBase);

        if (hora < 18) {
        horas.push(`${String(hora).padStart(2, '0')}:30`);
        }
    }

    return horas;
    }

    function obtenerHorasApartadas(fechaSeleccionada) {
    const horasReservadas = new Set();

    if (!fechaSeleccionada) return [];

    ordenesEnMemoria.forEach(orden => {
        const fechaGuardada = orden?.fallaInfo?.fechaEntrega || orden?.fechaEntrega;
        const horaGuardada = orden?.fallaInfo?.horaEntrega || orden?.horaEntrega;

        if (fechaGuardada !== fechaSeleccionada || !horaGuardada) return;

        horasReservadas.add(horaGuardada);
    });

    return [...horasReservadas].sort();
    }

    function renderizarHorasApartadas(fechaSeleccionada) {
    const contenedor = document.getElementById('lista-horas-ocupadas');
    if (!contenedor) return;

    const horasApartadas = obtenerHorasApartadas(fechaSeleccionada);
    contenedor.innerHTML = horasApartadas.length > 0
        ? horasApartadas.map(hora => `<div class="hora-ocupada-item"><span>${formatearHoraAMPM(hora)}</span><strong>Ocupada</strong></div>`).join('')
        : '<p class="sin-horas-ocupadas">No hay órdenes para esta fecha.</p>';
    }

    function actualizarHorasOcupadasNuevaOrden() {
    const fechaSeleccionada = document.getElementById('falla-fecha-entrega')?.value || '';
    renderizarHorasApartadas(fechaSeleccionada);
    }

    function validarEntregaNoDuplicada(fechaEntrega, horaEntrega) {
    if (!fechaEntrega || !horaEntrega) return true;

    const fechaHora = `${fechaEntrega}T${horaEntrega}`;
    const yaExiste = ordenesEnMemoria.some(orden => {
        const fechaGuardada = orden?.fallaInfo?.fechaEntrega || orden?.fechaEntrega;
        const horaGuardada = orden?.fallaInfo?.horaEntrega || orden?.horaEntrega;

        if (!fechaGuardada || !horaGuardada) return false;

        return `${fechaGuardada}T${horaGuardada}` === fechaHora;
    });

    if (yaExiste) {
        alert(`La fecha y hora ${fechaEntrega} ${horaEntrega} ya están apartadas. Elige otra.`);
        return false;
    }

    return true;
    }

    function obtenerDatosFormularioNuevaOrden() {
    const direccion = document.getElementById('cliente-direccion')?.value?.trim() || 'El progreso, Jutiapa';
    const estadoTelefono = document.getElementById('equipo-estado')?.value?.trim() || '';
    const fechaEntrega = document.getElementById('falla-fecha-entrega')?.value?.trim() || '';

    return {
        nombre: document.getElementById('cliente-nombre')?.value?.trim() || '',
        telefono: document.getElementById('cliente-telefono')?.value?.trim() || '',
        direccion,
        modelo: document.getElementById('equipo-modelo')?.value?.trim() || '',
        estadoTelefono,
        accesorios: document.getElementById('equipo-accesorios')?.value?.trim() || '',
        fallaPrincipal: document.getElementById('falla-principal')?.value?.trim() || '',
        descripcion: document.getElementById('falla-descripcion')?.value?.trim() || '',
        horaEntrega: document.getElementById('falla-hora-entrega')?.value?.trim() || '',
        fechaEntrega,
        precioReparacion: document.getElementById('falla-precio')?.value?.trim() || '',
        adelanto: document.getElementById('falla-adelanto')?.value?.trim() || '',
        imagenes: [...fotosNuevaOrden]
    };
    }

    async function actualizarEntregaOrden() {
    if (!ordenSeleccionada) return;

    const fechaEntrega = document.getElementById('orden-fecha-entrega-editar')?.value || '';
    const horaEntrega = document.getElementById('orden-hora-entrega-editar')?.value || '';
    if (!fechaEntrega || !horaEntrega) {
        alert('Completa la fecha y hora de entrega.');
        return;
    }

    const fechaHoraNueva = `${fechaEntrega}T${horaEntrega}`;
    const yaExiste = ordenesEnMemoria.some(orden => {
        if (orden.numeroOrden === ordenSeleccionada.numeroOrden) return false;
        const fechaGuardada = orden?.fallaInfo?.fechaEntrega || orden?.fechaEntrega;
        const horaGuardada = orden?.fallaInfo?.horaEntrega || orden?.horaEntrega;
        return fechaGuardada && horaGuardada && `${fechaGuardada}T${horaGuardada}` === fechaHoraNueva;
    });

    if (yaExiste) {
        alert(`La fecha y hora ${fechaEntrega} ${horaEntrega} ya están apartadas. Elige otra.`);
        return;
    }

    const ordenEnBase = ordenesEnMemoria.find(orden => orden.numeroOrden === ordenSeleccionada.numeroOrden);
    if (!ordenEnBase) return;

    ordenEnBase.fechaEntrega = fechaEntrega;
    ordenEnBase.horaEntrega = horaEntrega;
    ordenEnBase.fallaInfo = ordenEnBase.fallaInfo || {};
    ordenEnBase.fallaInfo.fechaEntrega = fechaEntrega;
    ordenEnBase.fallaInfo.horaEntrega = horaEntrega;
    ordenSeleccionada = ordenEnBase;

    await guardarOrdenesEnDB();
    renderizarOrdenes(estadoFiltradoActual);
    actualizarModal();
    }

    function manejarSeleccionFotos(event) {
    const archivos = Array.from(event.target.files || []);

    archivos.forEach(archivo => {
        if (!archivo.type.startsWith('image/')) return;

        const lector = new FileReader();
        lector.onload = () => {
        fotosNuevaOrden.push(lector.result);
        renderFotosNuevaOrden();
        };
        lector.readAsDataURL(archivo);
    });

    event.target.value = '';
    }

    function eliminarFotoNuevaOrden(index) {
    fotosNuevaOrden.splice(index, 1);
    renderFotosNuevaOrden();
    }

    function renderFotosNuevaOrden() {
    const contenedor = document.getElementById('fotos-preview-nueva-orden');
    if (!contenedor) return;

    if (fotosNuevaOrden.length === 0) {
        contenedor.innerHTML = '<p class="mensaje-vacio">No hay fotos agregadas aún.</p>';
        return;
    }

    contenedor.innerHTML = fotosNuevaOrden.map((src, index) => `
        <div class="foto-preview-item">
        <button class="btn-eliminar-foto" onclick="eliminarFotoNuevaOrden(${index})">×</button>
        <img src="${src}" alt="Foto del equipo ${index + 1}">
        </div>
    `).join('');
    }

    function actualizarModalNuevo() {
    const datos = obtenerDatosFormularioNuevaOrden();
    const horaActual = obtenerHoraActualLocal();
    const horaDefecto = datos.horaEntrega || horaActual;
    const fechaDefecto = datos.fechaEntrega || obtenerFechaActualLocal();

    document.getElementById('panel-nueva-cliente').innerHTML = `
        <h3>Información de cliente</h3>
        <div class="form-grid">
        <div class="campo-form"><label>Nombre</label><input id="cliente-nombre" type="text" value="${datos.nombre}"></div>
        <div class="campo-form"><label>Teléfono</label><input id="cliente-telefono" type="text" value="${datos.telefono}"></div>
        <div class="campo-form"><label>Dirección</label><input id="cliente-direccion" type="text" value="${datos.direccion}"></div>
        </div>
    `;

    document.getElementById('panel-nueva-equipo').innerHTML = `
        <h3>Información del equipo</h3>
        <div class="form-grid">
        <div class="campo-form"><label>Modelo</label><input id="equipo-modelo" type="text" value="${datos.modelo}"></div>
        <div class="campo-form"><label>Estado del teléfono</label><textarea id="equipo-estado">${datos.estadoTelefono}</textarea></div>
        <div class="campo-form"><label>Accesorios</label><input id="equipo-accesorios" type="text" value="${datos.accesorios}"></div>
        </div>

        <div class="foto-selector" style="margin-top: 16px;">
        <div class="foto-selector-actions">
            <button class="btn-cambiar-estado" type="button" onclick="document.getElementById('input-fotos-equipo').click()">Seleccionar foto</button>
            <button class="btn-cambiar-estado" type="button" onclick="document.getElementById('input-camara-equipo').click()">Tomar foto</button>
        </div>
        <input id="input-fotos-equipo" type="file" accept="image/*" multiple hidden onchange="manejarSeleccionFotos(event)">
        <input id="input-camara-equipo" type="file" accept="image/*" capture="environment" multiple hidden onchange="manejarSeleccionFotos(event)">
        <div id="fotos-preview-nueva-orden" class="galeria-imagenes"></div>
        </div>
    `;

    renderFotosNuevaOrden();

    document.getElementById('panel-nueva-falla').innerHTML = `
        <h3>Información de la falla</h3>
        <div class="form-grid">
        <div class="campo-form"><label>Falla principal</label><input id="falla-principal" type="text" value="${datos.fallaPrincipal}"></div>
        <div class="campo-form"><label>Descripción</label><textarea id="falla-descripcion">${datos.descripcion}</textarea></div>
        <div class="campo-form">
            <label>Hora para entregar el trabajo</label>
            <input id="falla-hora-entrega" type="time" min="08:00" max="18:00" step="1800" value="${horaDefecto}">
        </div>
        <div class="campo-form">
            <label>Fecha de entrega</label>
            <input id="falla-fecha-entrega" type="date" value="${fechaDefecto}" onchange="actualizarHorasOcupadasNuevaOrden()">
            <div id="lista-horas-ocupadas" class="lista-horas-ocupadas"></div>
        </div>
        <div class="campo-form"><label>Precio de la reparación</label><input id="falla-precio" type="number" min="0" step="0.01" value="${datos.precioReparacion}"></div>
        <div class="campo-form"><label>Adelanto</label><input id="falla-adelanto" type="number" min="0" step="0.01" value="${datos.adelanto}"></div>
        </div>
    `;

    renderizarHorasApartadas(fechaDefecto);

    document.getElementById('panel-nueva-resumen').innerHTML = `
        <h3>Resumen de la orden</h3>
        <div class="resumen-lista">
        <div class="resumen-item"><span>Nombre</span><span>${datos.nombre || '-'}</span></div>
        <div class="resumen-item"><span>Teléfono</span><span>${datos.telefono || '-'}</span></div>
        <div class="resumen-item"><span>Dirección</span><span>${datos.direccion || 'El progreso, Jutiapa'}</span></div>
        <div class="resumen-item"><span>Modelo</span><span>${datos.modelo || '-'}</span></div>
        <div class="resumen-item"><span>Estado del teléfono</span><span>${datos.estadoTelefono || '-'}</span></div>
        <div class="resumen-item"><span>Accesorios</span><span>${datos.accesorios || '-'}</span></div>
        <div class="resumen-item"><span>Falla principal</span><span>${datos.fallaPrincipal || '-'}</span></div>
        <div class="resumen-item"><span>Descripción</span><span>${datos.descripcion || '-'}</span></div>
        <div class="resumen-item"><span>Hora entrega</span><span>${formatearHoraAMPM(datos.horaEntrega)}</span></div>
        <div class="resumen-item"><span>Fecha de entrega</span><span>${fechaDefecto || '-'}</span></div>
        <div class="resumen-item"><span>Precio de la reparación</span><span>${datos.precioReparacion || '-'}</span></div>
        <div class="resumen-item"><span>Adelanto</span><span>${datos.adelanto || '-'}</span></div>
        </div>
        <div class="wizard-acciones">
        <button class="btn-aceptar" onclick="guardarNuevaOrden()">Aceptar</button>
        <button class="btn-cancelar" onclick="cerrarModalNuevaOrden()">Cancelar</button>
        </div>
    `;

    const tabs = document.querySelectorAll('#modal-nueva-orden .tab-seccion');
    tabs.forEach((tab, index) => {
        tab.classList.toggle('activo', index === indiceSeccionNueva);
    });

    const panels = document.querySelectorAll('#modal-nueva-orden .panel-seccion');
    panels.forEach((panel, index) => {
        panel.classList.toggle('activo', index === indiceSeccionNueva);
    });
    }

    async function guardarNuevaOrden() {
    const datos = obtenerDatosFormularioNuevaOrden();
    if (!datos.nombre || !datos.fallaPrincipal || !datos.modelo) {
        alert('Completa al menos nombre, modelo y falla principal para guardar la orden.');
        return;
    }

    const fechaEntregaSeleccionada = datos.fechaEntrega || obtenerFechaActualLocal();
    const horaEntregaFinal = datos.horaEntrega || obtenerHoraActualLocal();

    if (!validarEntregaNoDuplicada(fechaEntregaSeleccionada, horaEntregaFinal)) {
        return;
    }

    const nuevaOrden = {
        numeroOrden: generarNumeroOrden(),
        equipo: datos.modelo || 'Equipo sin modelo',
        falla: datos.fallaPrincipal,
        fechaIngreso: obtenerFechaActualLocal(),
        horaIngreso: obtenerHoraActualLocal(),
        fechaEntrega: fechaEntregaSeleccionada,
        horaEntrega: horaEntregaFinal,
        estado: 'pendiente',
        cliente: {
        nombre: datos.nombre,
        telefono: datos.telefono,
        correo: '',
        direccion: datos.direccion || 'El progreso, Jutiapa'
        },
        equipoInfo: {
        modelo: datos.modelo || '',
        descripcion: datos.estadoTelefono || '',
        estadoTelefono: datos.estadoTelefono || '',
        accesorios: datos.accesorios || '',
        imagenes: datos.imagenes || []
        },
        fallaInfo: {
        descripcion: datos.descripcion,
        prioridad: 'Sin definir',
        precioReparacion: datos.precioReparacion,
        adelanto: datos.adelanto,
        fechaEntrega: fechaEntregaSeleccionada,
        horaEntrega: horaEntregaFinal
        }
    };

    ordenesEnMemoria.push(nuevaOrden);
    await guardarOrdenesEnDB();
    renderizarOrdenes(estadoFiltradoActual);
    cerrarModalNuevaOrden();
    }

    function formatearFechaRecordatorio(recordatorio) {
    if (!recordatorio) return 'Sin recordatorio';

    const fecha = new Date(recordatorio);
    if (Number.isNaN(fecha.getTime())) return 'Sin recordatorio';

    return `⏰ ${fecha.toLocaleString('es-GT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
    }

    function renderizarNotas() {
    const contenedor = document.getElementById('contenedor-notas');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (notasEnMemoria.length === 0) {
        contenedor.innerHTML = '<p class="mensaje-vacio">No hay notas guardadas.</p>';
        return;
    }

    notasEnMemoria.forEach(nota => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'nota-card';
        tarjeta.innerHTML = `
        <div class="nota-header">
            <h3 class="nota-titulo">${nota.titulo}</h3>
            <button class="btn-eliminar-nota" onclick="eliminarNota(${nota.id})">Eliminar</button>
        </div>
        <p class="nota-descripcion">${nota.descripcion}</p>
        <p class="nota-recordatorio">${formatearFechaRecordatorio(nota.recordatorio)}</p>
        `;
        contenedor.appendChild(tarjeta);
    });
    }

    function obtenerEstadoNotificaciones() {
    const contextoSeguro = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    if (!('Notification' in window)) {
        return {
        soportado: false,
        permiso: 'unsupported',
        mensaje: 'Este navegador no admite notificaciones. La nota se guarda, pero no podrá recordarte nada.'
        };
    }

    if (!contextoSeguro) {
        return {
        soportado: false,
        permiso: 'unsafe-context',
        mensaje: 'La página está abierta en un contexto que no permite permisos permanentes de notificaciones. Para recibir recordatorios en un teléfono, abre esta app desde HTTPS o desde localhost, luego activa las notificaciones en el navegador.'
        };
    }

    if (Notification.permission === 'granted') {
        return {
        soportado: true,
        permiso: 'granted',
        mensaje: 'Las notificaciones están activadas para esta página. El recordatorio puede aparecer en tu dispositivo.'
        };
    }

    if (Notification.permission === 'denied') {
        return {
        soportado: true,
        permiso: 'denied',
        mensaje: 'Las notificaciones están desactivadas en este navegador. La nota se guarda igual, pero el recordatorio no se mostrará hasta que las actives en la configuración del navegador.'
        };
    }

    return {
        soportado: true,
        permiso: 'default',
        mensaje: 'Las notificaciones están disponibles. Presiona “Activar notificaciones” para aceptar el recordatorio y recibir el aviso en tu teléfono.'
    };
    }

    function mostrarEstadoNotificaciones(mensaje = obtenerEstadoNotificaciones().mensaje) {
    const contenedor = document.getElementById('estado-notificaciones');
    if (!contenedor) return;
    contenedor.textContent = mensaje;
    }

    async function activarNotificaciones() {
    const estadoActual = obtenerEstadoNotificaciones();
    mostrarEstadoNotificaciones(estadoActual.mensaje);

    if (!estadoActual.soportado) {
        return;
    }

    if (estadoActual.permiso === 'granted') {
        programarRecordatorios();
        return;
    }

    if (estadoActual.permiso === 'denied') {
        return;
    }

    const permiso = await Notification.requestPermission();
    const estadoNuevo = obtenerEstadoNotificaciones();
    mostrarEstadoNotificaciones(estadoNuevo.mensaje);

    if (permiso === 'granted') {
        programarRecordatorios();
    }
    }

    function solicitarPermisoNotificaciones() {
    const estado = obtenerEstadoNotificaciones();
    mostrarEstadoNotificaciones(estado.mensaje);
    return estado.soportado && estado.permiso === 'granted';
    }

    function mostrarNotificacionNota(nota) {
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') return;

    const titulo = `Recordatorio: ${nota.titulo}`;
    const cuerpo = nota.descripcion || 'Revisa tu nota guardada.';
    new Notification(titulo, {
        body: cuerpo,
        icon: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png'
    });
    }

    function programarRecordatorios() {
    recordatoriosActivos.forEach(timer => clearTimeout(timer));
    recordatoriosActivos.clear();

    notasEnMemoria.forEach(nota => {
        if (!nota.recordatorio) return;

        const fechaRecordatorio = new Date(nota.recordatorio);
        if (Number.isNaN(fechaRecordatorio.getTime())) return;

        const demora = fechaRecordatorio.getTime() - Date.now();

        if (demora <= 0) {
        mostrarNotificacionNota(nota);
        return;
        }

        const timer = setTimeout(() => {
        mostrarNotificacionNota(nota);
        recordatoriosActivos.delete(nota.id);
        }, demora);

        recordatoriosActivos.set(nota.id, timer);
    });
    }

    async function guardarNota() {
    const titulo = document.getElementById('nota-titulo')?.value?.trim();
    const descripcion = document.getElementById('nota-descripcion')?.value?.trim();
    const recordatorio = document.getElementById('nota-recordatorio')?.value || '';

    if (!titulo || !descripcion) {
        alert('Completa el título y la descripción de la nota.');
        return;
    }

    const permisoNotificaciones = solicitarPermisoNotificaciones();

    notasEnMemoria.unshift({ id: Date.now(), titulo, descripcion, recordatorio });
    await guardarNotasEnDB();
    renderizarNotas();

    if (permisoNotificaciones) {
        programarRecordatorios();
    }

    document.getElementById('nota-titulo').value = '';
    document.getElementById('nota-descripcion').value = '';
    document.getElementById('nota-recordatorio').value = '';
    }

    async function eliminarNota(id) {
    const timerActivo = recordatoriosActivos.get(id);
    if (timerActivo) {
        clearTimeout(timerActivo);
        recordatoriosActivos.delete(id);
    }

    notasEnMemoria = notasEnMemoria.filter(nota => nota.id !== id);
    await guardarNotasEnDB();
    renderizarNotas();
    }

    function actualizarModal() {
    if (!ordenSeleccionada) return;

    const panelCliente = document.getElementById('panel-cliente');
    const panelEquipo = document.getElementById('panel-equipo');
    const panelFalla = document.getElementById('panel-falla');

    panelCliente.innerHTML = `
        <h3>Información de cliente</h3>
        <div class="detalle-item"><span>Nombre</span><span>${ordenSeleccionada.cliente.nombre}</span></div>
        <div class="detalle-item"><span>Teléfono</span><span>${ordenSeleccionada.cliente.telefono}</span></div>
        <div class="detalle-item"><span>Correo</span><span>${ordenSeleccionada.cliente.correo}</span></div>
        <div class="detalle-item"><span>Dirección</span><span>${ordenSeleccionada.cliente.direccion}</span></div>
    `;

    panelEquipo.innerHTML = `
        <h3>Información del equipo</h3>
        <div class="detalle-item"><span>Modelo</span><span>${ordenSeleccionada.equipoInfo.modelo}</span></div>
        <div class="detalle-item"><span>Estado del teléfono</span><span>${ordenSeleccionada.equipoInfo.descripcion || ordenSeleccionada.equipoInfo.estadoTelefono || '-'}</span></div>
        <div class="detalle-item"><span>Accesorios</span><span>${ordenSeleccionada.equipoInfo.accesorios}</span></div>

        <h3 style="margin-top: 16px;">Imágenes del equipo</h3>
        <div class="galeria-imagenes">
        ${ordenSeleccionada.equipoInfo.imagenes.map(src => `<img src="${src}" alt="Imagen del equipo">`).join('')}
        </div>
    `;

    panelFalla.innerHTML = `
        <h3>Información de la falla</h3>
        <div class="detalle-item"><span>Falla principal</span><span>${ordenSeleccionada.falla}</span></div>
        <div class="detalle-item"><span>Descripción</span><span>${ordenSeleccionada.fallaInfo.descripcion || '-'}</span></div>
        <div class="edicion-entrega">
            <div class="campo-form"><label for="orden-hora-entrega-editar">Hora de entrega <span>(editable)</span></label><input id="orden-hora-entrega-editar" type="time" value="${ordenSeleccionada.fallaInfo.horaEntrega || ordenSeleccionada.horaEntrega || ''}"></div>
            <div class="campo-form"><label for="orden-fecha-entrega-editar">Fecha de entrega <span>(editable)</span></label><input id="orden-fecha-entrega-editar" type="date" value="${ordenSeleccionada.fallaInfo.fechaEntrega || ordenSeleccionada.fechaEntrega || ''}"></div>
            <button class="btn-guardar-entrega" onclick="actualizarEntregaOrden()">Guardar fecha y hora</button>
        </div>
        <div class="detalle-item"><span>Tiempo restante</span><span id="tiempo-restante-modal">${obtenerTiempoRestanteEntrega(ordenSeleccionada)}</span></div>
        <div class="detalle-item"><span>Precio de la reparación</span><span>${ordenSeleccionada.fallaInfo.precioReparacion || '-'}</span></div>
        <div class="detalle-item"><span>Adelanto</span><span>${ordenSeleccionada.fallaInfo.adelanto || '-'}</span></div>

        <div class="cambio-estado-wrapper">
        <button class="btn-generar-comprobante" onclick="descargarComprobanteOrdenSeleccionada()">Descargar comprobante PDF</button>
        <button class="btn-cambiar-estado" onclick="toggleCambioEstado()">Cambiar estado</button>
        <div id="opciones-cambio-estado" class="opciones-cambio-estado">
            ${getOpcionesCambioEstado(ordenSeleccionada.estado)}
        </div>
        </div>
    `;

    document.querySelectorAll('.tab-seccion').forEach((tab, index) => {
        tab.classList.toggle('activo', index === indiceSeccionActual);
    });

    document.querySelectorAll('.panel-seccion').forEach((panel, index) => {
        panel.classList.toggle('activo', index === indiceSeccionActual);
    });

    }

    window.descargarComprobanteOrdenSeleccionada = function() {
    if (!ordenSeleccionada) {
        alert('Abre una orden antes de descargar el comprobante.');
        return;
    }

    generarPDFComprobante(ordenSeleccionada);
    };

    function actualizarTiempoRestanteModal() {
    const tiempoModal = document.getElementById('tiempo-restante-modal');
    if (!tiempoModal || !ordenSeleccionada) return;

    tiempoModal.textContent = obtenerTiempoRestanteEntrega(ordenSeleccionada);
    }

    window.addEventListener('DOMContentLoaded', () => {
    iniciarAplicacion();
    setInterval(() => {
        actualizarTiempoRestanteEnTarjetas();
        actualizarTiempoRestanteModal();
    }, 1000);
    });