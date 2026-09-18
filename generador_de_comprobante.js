function escaparHTML(valor) {
    return String(valor ?? '-').replace(/[&<>'"]/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[caracter]));
}

function formatearFechaComprobante(fecha) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha || 'Sin fecha';

    const [año, mes, dia] = fecha.split('-');
    return `${año}/${dia}/${mes}`;
}

function normalizarOrden(datosOrden) {
    const esOrdenDeLaApp = Boolean(datosOrden?.cliente || datosOrden?.equipoInfo || datosOrden?.fallaInfo);
    const cliente = esOrdenDeLaApp ? datosOrden.cliente || {} : datosOrden;
    const equipo = esOrdenDeLaApp ? datosOrden.equipoInfo || {} : datosOrden;
    const falla = esOrdenDeLaApp ? datosOrden.fallaInfo || {} : datosOrden;
    const total = Number(esOrdenDeLaApp ? falla.precioReparacion : datosOrden.costoTotal) || 0;
    const anticipo = Number(esOrdenDeLaApp ? falla.adelanto : datosOrden.costoAnticipo) || 0;

    return {
        tallerNombre: 'DiegoTech',
        tallerDireccion: 'Calle Salida a Jutiapa, 2 avenida, calle 2',
        tallerTelefono: '3300-3333',
        numeroOrden: datosOrden.numeroOrden,
        fechaIngreso: datosOrden.fechaIngreso,
        fechaEntrega: datosOrden.fechaEntrega || falla.fechaEntrega || 'Pendiente de confirmar',
        clienteNombre: esOrdenDeLaApp ? cliente.nombre : datosOrden.clienteNombre,
        clienteTelefono: esOrdenDeLaApp ? cliente.telefono : datosOrden.clienteTelefono,
        clienteDireccion: esOrdenDeLaApp ? cliente.direccion : datosOrden.clienteDireccion,
        equipoModelo: esOrdenDeLaApp ? equipo.modelo : datosOrden.equipoModelo,
        equipoDescripcion: esOrdenDeLaApp ? equipo.descripcion : datosOrden.equipoDescripcion,
        equipoEstetico: esOrdenDeLaApp ? (datosOrden.estado || 'No indicado') : datosOrden.equipoEstetico,
        equipoAccesorios: esOrdenDeLaApp ? equipo.accesorios : datosOrden.equipoAccesorios,
        fallaReportada: esOrdenDeLaApp ? datosOrden.falla : datosOrden.fallaReportada,
        diagnosticoInicial: esOrdenDeLaApp
            ? [falla.descripcion, falla.observacion].filter(Boolean).join(' | ')
            : datosOrden.diagnosticoInicial,
        costoTotal: total.toFixed(2),
        costoAnticipo: anticipo.toFixed(2),
        costoSaldo: Math.max(total - anticipo, 0).toFixed(2)
    };
}

function generarPDFComprobante(datosOrden) {
    if (!datosOrden) return;

    const orden = normalizarOrden(datosOrden);
    const texto = valor => escaparHTML(valor);
    const diseñoHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Orden #${datosOrden.numeroOrden}</title>
        <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #263238; margin: 0; padding: 24px; line-height: 1.45; }
            .comprobante { max-width: 760px; margin: auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 18px; }
            .marca { display: flex; align-items: center; gap: 10px; }
            .logo { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 10px; background: #0f766e; color: #ffffff; font-weight: bold; font-size: 16px; letter-spacing: 1px; }
            .header h1 { margin: 0; font-size: 22px; color: #0f766e; }
            .header h2 { margin: 0; font-size: 15px; color: #115e59; }
            .header p { margin: 2px 0; }
            
            .secciones { display: flex; gap: 20px; margin-bottom: 15px; }
            .caja { flex: 1; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: #fafafa; }
            .caja h3 { margin: 0 0 8px 0; font-size: 13px; color: #115e59; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
            .caja p { margin: 4px 0; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background-color: #dff5f1; border: 1px solid #b8d8d4; padding: 7px; text-align: left; color: #115e59; font-size: 12px; }
            td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
            .tabla-costos th, .tabla-costos td { text-align: center; }
            
            .clausulas { border: 1px solid #ccc; background-color: #fdfdfd; padding: 10px; border-radius: 4px; font-size: 10px; color: #444; margin-bottom: 40px; }
            .clausulas h4 { margin: 0 0 5px 0; color: #115e59; font-size: 11px; }
            .clausulas ol { margin: 0; padding-left: 15px; }
            .clausulas li { margin-bottom: 4px; }
            
            .firmas { display: flex; justify-content: space-around; margin-top: 50px; page-break-inside: avoid; }
            .firma-linea { text-align: center; width: 40%; }
            .firma-linea div { border-top: 1px solid #333; margin-bottom: 5px; }
            
            /* Ajustes optimizados para cuando se imprima o guarde en PDF */
            @media print {
                body { padding: 0; }
                .caja { background: none; }
                th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>
    <main class="comprobante">
        <!-- ENCABEZADO -->
        <div class="header">
            <div class="marca">
                <div class="logo">DT</div>
                <div>
                <h1>${texto(orden.tallerNombre)}</h1>
                <p style="color: #555;">${texto(orden.tallerDireccion)}</p>
                <p style="color: #555;">Tel / WhatsApp: ${texto(orden.tallerTelefono)}</p>
                </div>
            </div>
            <div style="text-align: right;">
                <h2>COMPROBANTE DE ENTREGA</h2>
                <p><strong>No. Orden:</strong> #${texto(orden.numeroOrden)}</p>
                <p><strong>Fecha de ingreso:</strong> ${texto(formatearFechaComprobante(orden.fechaIngreso))}</p>
                <p><strong>Fecha de entrega:</strong> ${texto(formatearFechaComprobante(orden.fechaEntrega))}</p>
            </div>
        </div>

        <!-- SECCIONES: CLIENTE Y DISPOSITIVO -->
        <div class="secciones">
            <div class="caja">
                <h3>Datos del Cliente</h3>
                <p><strong>Nombre:</strong> ${texto(orden.clienteNombre)}</p>
                <p><strong>Teléfono:</strong> ${texto(orden.clienteTelefono)}</p>
                <p><strong>Dirección:</strong> ${texto(orden.clienteDireccion)}</p>
            </div>
            <div class="caja">
                <h3>Datos del Dispositivo</h3>
                <p><strong>Modelo:</strong> ${texto(orden.equipoModelo)}</p>
                <p><strong>Descripción:</strong> ${texto(orden.equipoDescripcion)}</p>
                <p><strong>Estado:</strong> ${texto(orden.equipoEstetico)}</p>
                <p><strong>Accesorios:</strong> ${texto(orden.equipoAccesorios)}</p>
            </div>
        </div>

        <!-- FALLA Y DIAGNÓSTICO -->
        <table>
            <thead>
                <tr>
                    <th>Falla Reportada por Cliente</th>
                    <th>Diagnóstico Inicial</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${texto(orden.fallaReportada)}</td>
                    <td>${texto(orden.diagnosticoInicial)}</td>
                </tr>
            </tbody>
        </table>

        <!-- COSTOS -->
        <table class="tabla-costos">
            <thead>
                <tr>
                    <th>Presupuesto Estimado</th>
                    <th>Anticipo / Garantía</th>
                    <th>Saldo Restante</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Q ${texto(orden.costoTotal)}</td>
                    <td>Q ${texto(orden.costoAnticipo)}</td>
                    <td style="font-weight: bold; color: #b91c1c;">Q ${texto(orden.costoSaldo)}</td>
                </tr>
            </tbody>
        </table>

        <!-- CLÁUSULAS LEGALES -->
        <div class="clausulas">
            <h4>TÉRMINOS Y CONDICIONES DEL SERVICIO</h4>
            <ol>
                <li><strong>Garantía:</strong> Las reparaciones cuentan con una garantía de 30 días calendario a partir de su entrega, válida exclusivamente sobre las piezas sustituidas. Se anula por humedad, golpes o apertura de sellos.</li>
                <li><strong>Cláusula de Abandono (90 días):</strong> Pasados 60 días de la fecha estimada de entrega, se cobrará una tarifa diaria de Q 10.00 por bodegaje. Si el equipo supera los <strong>90 días calendario (2 meses y medio)</strong> sin ser retirado, el taller se reserva el derecho de proceder al desarme de las piezas para mitigar la pérdida de repuestos y mano de obra invertida, perdiendo el cliente todo derecho de reclamo del dispositivo o información.</li>
                <li><strong>Respaldo de Información:</strong> El taller NO responde por pérdidas de información, software, cuentas o archivos. El cliente declara entregar el dispositivo respaldado.</li>
                <li><strong>Dispositivos Apagados:</strong> Al ingresar un equipo apagado o sin dar imagen, el taller no se responsabiliza de daños ocultos preexistentes detectados en la revisión interna.</li>
            </ol>
        </div>

        <!-- FIRMAS -->
        <div class="firmas">
            <div class="firma-linea">
                <div></div>
                <p>Firma del Cliente (Acepto Términos)</p>
            </div>
            <div class="firma-linea">
                <div></div>
                <p>Firma / Sello del Taller</p>
            </div>
        </div>
    </main>
    </body>
    </html>
    `;

    const imprimirComprobante = () => {
        const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
        if (!ventanaImpresion) {
            alert('Permite las ventanas emergentes para generar el comprobante.');
            return;
        }

        ventanaImpresion.document.open();
        ventanaImpresion.document.write(diseñoHTML);
        ventanaImpresion.document.close();
        ventanaImpresion.onload = () => ventanaImpresion.print();
    };

    if (typeof html2pdf !== 'function') {
        imprimirComprobante();
        return;
    }

    const contenedor = document.createElement('div');
    contenedor.innerHTML = diseñoHTML;
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-10000px';
    contenedor.style.width = '794px';
    document.body.appendChild(contenedor);

    const archivo = `comprobante-${String(orden.numeroOrden).replace(/[^a-z0-9-]/gi, '-')}.pdf`;
    html2pdf().set({
        margin: 8,
        filename: archivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(contenedor).save().then(
        () => contenedor.remove(),
        () => {
            contenedor.remove();
            imprimirComprobante();
        }
    );
}

window.generarPDFComprobante = generarPDFComprobante;


// Estructura de ejemplo que tu aplicación le enviará a la función:
const miOrdenEjemplo = {
    tallerNombre: "Phone Clinic El Progreso",
    tallerDireccion: "Calle Principal, Local 4, El Progreso",
    tallerTelefono: "5555-9988",
    numeroOrden: "1024",
    fechaIngreso: "06/09/2026",
    fechaEntrega: "09/09/2026",
    clienteNombre: "Carlos Mendoza",
    clienteTelefono: "4411-2233",
    clienteDireccion: "Barrio El Porvenir, Guastatoya",
    equipoModelo: "Xiaomi Redmi Note 13 Pro",
    equipoDescripcion: "Pantalla quebrada y esquinas raspadas.",
    equipoEstetico: "Pantalla quebrada, esquinas raspadas.",
    equipoAccesorios: "Funda de silicón transparente.",
    fallaReportada: "Pantalla rota tras caída, si vibra pero no da imagen.",
    diagnosticoInicial: "Cambio completo de módulo de pantalla AMOLED y pegado.",
    costoTotal: "550.00",
    costoAnticipo: "200.00",
    costoSaldo: "350.00"
};

