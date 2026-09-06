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
    renderizarOrdenes(estadoFiltradoActual);
    renderizarNotas();
    mostrarEstadoNotificaciones(obtenerEstadoNotificaciones().mensaje);
    programarRecordatorios();
    }

    function renderizarOrdenes(estadoFiltrado) {
    const contenedor = document.getElementById('contenedor-tarjetas');
    contenedor.innerHTML = "";

    const ordenesFiltradas = ordenesEnMemoria.filter(orden => orden.estado === estadoFiltrado);

    if (ordenesFiltradas.length === 0) {
        contenedor.innerHTML = `<p class="mensaje-vacio">No hay órdenes en este estado 👍</p>`;
        return;
    }

    ordenesFiltradas.forEach(orden => {
        const tarjeta = document.createElement('div');
        tarjeta.className = `tarjeta-orden ${orden.estado}`;
        tarjeta.addEventListener('click', (event) => {
        if (event.target.closest('.btn-eliminar-orden-tarjeta')) return;
        abrirModalOrden(orden);
        });

        let textoEstadoVisual = "";
        if (orden.estado === 'pendiente') textoEstadoVisual = "Pendiente de revisión";
        if (orden.estado === 'proceso') textoEstadoVisual = "En proceso de reparación";
        if (orden.estado === 'terminada') textoEstadoVisual = "Terminada / Lista para entrega";

        tarjeta.innerHTML = `
        <div class="tarjeta-header">
            <span class="orden-numero">${orden.numeroOrden}</span>
            <span class="orden-fecha">📅 ${orden.fechaIngreso} 🕒 ${orden.horaIngreso || '-'}</span>
        </div>
        <h3>${orden.equipo}</h3>
        <p><strong>Falla principal:</strong> ${orden.falla}</p>
        <p class="estado-texto txt-${orden.estado}">● ${textoEstadoVisual}</p>
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
    actualizarModalNuevo();
    }

    function cerrarModalNuevaOrden(event) {
    if (event && event.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-nueva-orden').classList.add('modal-oculto');
        return;
    }

    if (!event) {
        document.getElementById('modal-nueva-orden').classList.add('modal-oculto');
    }
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
        { key: 'terminada', label: 'Terminada' }
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

    function obtenerDatosFormularioNuevaOrden() {
    const direccion = document.getElementById('cliente-direccion')?.value?.trim() || 'El progreso, Jutiapa';
    const imei = document.getElementById('equipo-imei')?.value?.trim() || 'Sin IMEI';

    return {
        nombre: document.getElementById('cliente-nombre')?.value?.trim() || '',
        telefono: document.getElementById('cliente-telefono')?.value?.trim() || '',
        direccion,
        modelo: document.getElementById('equipo-modelo')?.value?.trim() || '',
        imei,
        accesorios: document.getElementById('equipo-accesorios')?.value?.trim() || '',
        fallaPrincipal: document.getElementById('falla-principal')?.value?.trim() || '',
        descripcion: document.getElementById('falla-descripcion')?.value?.trim() || '',
        fallasExtras: document.getElementById('falla-extras')?.value?.trim() || '',
        precioReparacion: document.getElementById('falla-precio')?.value?.trim() || '',
        adelanto: document.getElementById('falla-adelanto')?.value?.trim() || '',
        imagenes: [...fotosNuevaOrden]
    };
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

    document.getElementById('panel-nueva-cliente').innerHTML = `
        <h3>Información de cliente</h3>
        <div class="form-grid">
        <div class="campo-form"><label>Nombre</label><input id="cliente-nombre" type="text" value="${datos.nombre}"></div>
        <div class="campo-form"><label>Teléfono</label><input id="cliente-telefono" type="text" value="${datos.telefono}"></div>
        <div class="campo-form"><label>Dirección</label><input id="cliente-direccion" type="text" value="${datos.direccion}"></div>
        <div class="campo-form"><label>Precio de la reparación</label><input id="falla-precio" type="number" min="0" step="0.01" value="${datos.precioReparacion}"></div>
        <div class="campo-form"><label>Adelanto</label><input id="falla-adelanto" type="number" min="0" step="0.01" value="${datos.adelanto}"></div>
        </div>
    `;

    document.getElementById('panel-nueva-equipo').innerHTML = `
        <h3>Información del equipo</h3>
        <div class="form-grid">
        <div class="campo-form"><label>Modelo</label><input id="equipo-modelo" type="text" value="${datos.modelo}"></div>
        <div class="campo-form"><label>IMEI</label><input id="equipo-imei" type="text" value="${datos.imei}"></div>
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
        <div class="campo-form"><label>Fallas extras</label><textarea id="falla-extras">${datos.fallasExtras}</textarea></div>
        </div>
    `;

    document.getElementById('panel-nueva-resumen').innerHTML = `
        <h3>Resumen de la orden</h3>
        <div class="resumen-lista">
        <div class="resumen-item"><span>Nombre</span><span>${datos.nombre || '-'}</span></div>
        <div class="resumen-item"><span>Teléfono</span><span>${datos.telefono || '-'}</span></div>
        <div class="resumen-item"><span>Dirección</span><span>${datos.direccion || 'El progreso, Jutiapa'}</span></div>
        <div class="resumen-item"><span>Modelo</span><span>${datos.modelo || '-'}</span></div>
        <div class="resumen-item"><span>IMEI</span><span>${datos.imei || 'Sin IMEI'}</span></div>
        <div class="resumen-item"><span>Accesorios</span><span>${datos.accesorios || '-'}</span></div>
        <div class="resumen-item"><span>Falla principal</span><span>${datos.fallaPrincipal || '-'}</span></div>
        <div class="resumen-item"><span>Descripción</span><span>${datos.descripcion || '-'}</span></div>
        <div class="resumen-item"><span>Fallas extras</span><span>${datos.fallasExtras || '-'}</span></div>
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

    const nuevaOrden = {
        numeroOrden: generarNumeroOrden(),
        equipo: datos.modelo || 'Equipo sin modelo',
        falla: datos.fallaPrincipal,
        fechaIngreso: new Date().toISOString().slice(0, 10),
        horaIngreso: new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
        estado: 'pendiente',
        cliente: {
        nombre: datos.nombre,
        telefono: datos.telefono,
        correo: '',
        direccion: datos.direccion || 'El progreso, Jutiapa'
        },
        equipoInfo: {
        modelo: datos.modelo || '',
        imei: datos.imei || 'Sin IMEI',
        accesorios: datos.accesorios || '',
        imagenes: datos.imagenes || []
        },
        fallaInfo: {
        descripcion: datos.descripcion,
        observacion: datos.fallasExtras,
        prioridad: 'Sin definir',
        precioReparacion: datos.precioReparacion,
        adelanto: datos.adelanto
        }
    };

    ordenesEnMemoria.unshift(nuevaOrden);
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
        <div class="detalle-item"><span>IMEI</span><span>${ordenSeleccionada.equipoInfo.imei}</span></div>
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
        <div class="detalle-item"><span>Fallas extras</span><span>${ordenSeleccionada.fallaInfo.observacion || '-'}</span></div>
        <div class="detalle-item"><span>Precio de la reparación</span><span>${ordenSeleccionada.fallaInfo.precioReparacion || '-'}</span></div>
        <div class="detalle-item"><span>Adelanto</span><span>${ordenSeleccionada.fallaInfo.adelanto || '-'}</span></div>

        <div class="cambio-estado-wrapper">
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

    window.addEventListener('DOMContentLoaded', iniciarAplicacion);