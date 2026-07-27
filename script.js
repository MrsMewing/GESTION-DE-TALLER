const storageKey = "app-taller-notas-ordenes";

const initialState = {
  notes: [
    {
      id: crypto.randomUUID(),
      title: "Revisión de equipo 1",
      description: "Verificar el sistema de control antes de la próxima jornada.",
    },
    {
      id: crypto.randomUUID(),
      title: "Recordatorio de mantenimiento",
      description: "Actualizar el registro de mantenimiento del turno de la tarde.",
    },
  ],
  orders: {
    pending: [
      {
        id: crypto.randomUUID(),
        title: "Instalación de sensor",
        description: "Pendiente de asignación de personal.",
        equipment: "Equipo A-14",
        date: "2026-07-19",
        owner: "Carlos Vega",
        phone: "300 123 4567",
        address: "Calle 10 #20-30",
        accessories: "Cable, cargador, manual",
        price: "$120.000",
        problem: "No enciende",
        faultDescription: "El equipo no responde al encenderlo y muestra error de batería.",
        extraFaults: "Puertos con desgaste leve",
        status: "Pendiente",
      },
    ],
    inProgress: [
      {
        id: crypto.randomUUID(),
        title: "Calibración de tablero",
        description: "En proceso con revisión del supervisor.",
        equipment: "Tablero X-02",
        date: "2026-07-21",
        owner: "Ana López",
        phone: "311 555 8899",
        address: "Avenida Central 45",
        accessories: "Fuente de poder",
        price: "$80.000",
        problem: "Lectura errónea",
        faultDescription: "Presenta mediciones inconsistentes durante la prueba inicial.",
        extraFaults: "Botón de arranque flojo",
        status: "En proceso",
      },
    ],
    completed: [
      {
        id: crypto.randomUUID(),
        title: "Cambio de batería",
        description: "Finalizada y validada por el equipo.",
        equipment: "Equipo B-08",
        date: "2026-07-17",
        owner: "Sofía Ariza",
        phone: "315 444 7722",
        address: "Carrera 7 #15-40",
        accessories: "Batería nueva, tapa",
        price: "$60.000",
        problem: "Batería dañada",
        faultDescription: "La batería ya no retenía carga y generaba cortes frecuentes.",
        extraFaults: "Ninguna",
        status: "Terminado",
      },
    ],
  },
};

let state = loadState();
let selectedOrderStatus = "pending";

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const addNoteBtn = document.getElementById("add-note-btn");
const noteForm = document.getElementById("note-form");
const cancelNoteBtn = document.getElementById("cancel-note-btn");
const noteTitleInput = document.getElementById("note-title");
const noteDescriptionInput = document.getElementById("note-description");
const notesList = document.getElementById("notes-list");
const ordersBoard = document.getElementById("orders-board");
const newOrderBtn = document.getElementById("new-order-btn");
const subTabs = document.querySelectorAll(".subtab");
const orderModal = document.getElementById("order-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const changeStatusBtn = document.getElementById("change-status-btn");
const nextSectionBtn = document.getElementById("next-section-btn");
const prevSectionBtn = document.getElementById("prev-section-btn");
const modalTitle = document.getElementById("modal-title");
const modalDate = document.getElementById("modal-date");
const modalEquipment = document.getElementById("modal-equipment");
const modalAccessories = document.getElementById("modal-accessories");
const modalPrice = document.getElementById("modal-price");
const modalOwner = document.getElementById("modal-owner");
const modalPhone = document.getElementById("modal-phone");
const modalAddress = document.getElementById("modal-address");
const modalProblem = document.getElementById("modal-problem");
const modalDescription = document.getElementById("modal-description");
const modalExtra = document.getElementById("modal-extra");
let selectedOrder = null;
let activeModalSection = 0;

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : initialState;
  } catch (error) {
    console.warn("No se pudo cargar el estado guardado", error);
    return initialState;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function renderNotes() {
  if (!state.notes.length) {
    notesList.innerHTML = '<p class="note-card">No hay notas todavía. Agrega una para comenzar.</p>';
    return;
  }

  notesList.innerHTML = state.notes
    .map(
      (note) => `
        <article class="note-card">
          <h3>${note.title}</h3>
          <p>${note.description}</p>
        </article>
      `
    )
    .join("");
}

function getStatusConfig(statusKey) {
  const map = {
    pending: { label: "Pendiente", className: "status-pending" },
    inProgress: { label: "En proceso", className: "status-inprogress" },
    completed: { label: "Terminado", className: "status-completed" },
  };
  return map[statusKey] || map.pending;
}

function renderOrders() {
  const labels = {
    pending: "Pendientes",
    inProgress: "En proceso",
    completed: "Terminadas",
  };

  const items = state.orders[selectedOrderStatus] || [];
  subTabs.forEach((tab) => {
    const isActive = tab.dataset.orderStatus === selectedOrderStatus;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  if (!items.length) {
    ordersBoard.innerHTML = `
      <div class="orders-status-header">
        <h3>${labels[selectedOrderStatus]}</h3>
        <p>No hay órdenes en esta sección.</p>
      </div>
    `;
    return;
  }

  ordersBoard.innerHTML = `
    <div class="orders-status-header">
      <h3>${labels[selectedOrderStatus]}</h3>
      <p>${items.length} orden${items.length > 1 ? "es" : ""}</p>
    </div>
    ${items
      .map(
        (order) => {
          const statusInfo = getStatusConfig(selectedOrderStatus);
          return `
            <article class="order-card" data-order-id="${order.id}">
              <div class="order-meta">
                <h4>${order.title}</h4>
                <span class="status-pill ${statusInfo.className}"><span class="status-dot"></span>${statusInfo.label}</span>
              </div>
              <p>${order.description}</p>
              <div class="order-details">
                <span><strong>Equipo:</strong> ${order.equipment}</span>
                <span><strong>Falla principal:</strong> ${order.problem}</span>
                <span><strong>Fecha ingreso:</strong> ${order.date}</span>
              </div>
              <div class="order-actions">
                ${selectedOrderStatus !== "pending" ? `<button class="move-btn" data-action="back" data-order-id="${order.id}" data-from="${selectedOrderStatus}">← Volver</button>` : ""}
                ${selectedOrderStatus !== "completed" ? `<button class="move-btn" data-action="next" data-order-id="${order.id}" data-from="${selectedOrderStatus}">Siguiente →</button>` : ""}
              </div>
            </article>
          `;
        }
      )
      .join("")}
  `;
}

function render() {
  renderNotes();
  renderOrders();
}

function switchView(target) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.view === target;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${target}-panel`);
  });
}

addNoteBtn.addEventListener("click", () => {
  noteForm.classList.remove("hidden");
  noteTitleInput.focus();
});

cancelNoteBtn.addEventListener("click", () => {
  noteForm.classList.add("hidden");
  noteForm.reset();
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = noteTitleInput.value.trim();
  const description = noteDescriptionInput.value.trim();

  if (!title || !description) {
    return;
  }

  state.notes.unshift({
    id: crypto.randomUUID(),
    title,
    description,
  });

  saveState();
  render();
  noteForm.reset();
  noteForm.classList.add("hidden");
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

subTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    selectedOrderStatus = tab.dataset.orderStatus;
    renderOrders();
  });
});

newOrderBtn.addEventListener("click", (event) => {
  event.preventDefault();
});

closeModalBtn.addEventListener("click", closeOrderModal);
orderModal.addEventListener("click", (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});

const modalTabs = document.querySelectorAll(".modal-tab");
modalTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const sectionIndex = parseInt(tab.dataset.section, 10);
    showModalSection(sectionIndex);
  });
});

nextSectionBtn.addEventListener("click", () => {
  showModalSection(activeModalSection + 1);
});

prevSectionBtn.addEventListener("click", () => {
  showModalSection(activeModalSection - 1);
});

changeStatusBtn.addEventListener("click", () => {
  if (!selectedOrder) return;
  const currentStatus = Object.entries(state.orders).find(([, orders]) => orders.some((item) => item.id === selectedOrder.id));
  if (!currentStatus) return;

  const [currentKey, orders] = currentStatus;
  state.orders[currentKey] = orders.filter((item) => item.id !== selectedOrder.id);

  const nextKey = currentKey === "pending" ? "inProgress" : currentKey === "inProgress" ? "completed" : "pending";
  state.orders[nextKey].push({ ...selectedOrder, status: nextKey === "pending" ? "Pendiente" : nextKey === "inProgress" ? "En proceso" : "Terminado" });
  saveState();
  render();
  closeOrderModal();
});

function showModalSection(index) {
  const sections = Array.from(document.querySelectorAll(".modal-section"));
  const tabs = Array.from(document.querySelectorAll(".modal-tab"));
  if (!sections.length) return;

  activeModalSection = (index + sections.length) % sections.length;
  
  sections.forEach((section, sectionIndex) => {
    section.classList.toggle("active", sectionIndex === activeModalSection);
  });
  
  tabs.forEach((tab, tabIndex) => {
    tab.classList.toggle("active-section", tabIndex === activeModalSection);
  });
}

function openOrderModal(orderId) {
  const allOrders = Object.values(state.orders).flat();
  const order = allOrders.find((item) => item.id === orderId);
  if (!order) return;

  selectedOrder = order;
  modalTitle.textContent = order.title;
  modalDate.textContent = order.date;
  modalEquipment.textContent = order.equipment;
  modalAccessories.textContent = order.accessories;
  modalPrice.textContent = order.price;
  modalOwner.textContent = order.owner;
  modalPhone.textContent = order.phone;
  modalAddress.textContent = order.address;
  modalProblem.textContent = order.problem;
  modalDescription.textContent = order.faultDescription;
  modalExtra.textContent = order.extraFaults;
  showModalSection(0);
  orderModal.classList.remove("hidden");
  orderModal.setAttribute("aria-hidden", "false");
}

function closeOrderModal() {
  orderModal.classList.add("hidden");
  orderModal.setAttribute("aria-hidden", "true");
  selectedOrder = null;
}

ordersBoard.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) {
    const { action, orderId, from } = button.dataset;
    const order = Object.values(state.orders)
      .flat()
      .find((item) => item.id === orderId);

    if (!order) return;

    const currentList = state.orders[from];
    const nextStatusMap = {
      pending: "inProgress",
      inProgress: "completed",
    };
    const previousStatusMap = {
      inProgress: "pending",
      completed: "inProgress",
    };

    if (action === "next") {
      const nextKey = nextStatusMap[from];
      if (!nextKey) return;
      state.orders[from] = currentList.filter((item) => item.id !== orderId);
      state.orders[nextKey].push(order);
    }

    if (action === "back") {
      const prevKey = previousStatusMap[from];
      if (!prevKey) return;
      state.orders[from] = currentList.filter((item) => item.id !== orderId);
      state.orders[prevKey].push(order);
    }

    saveState();
    render();
    return;
  }

  const card = event.target.closest("article[data-order-id]");
  if (card) {
    openOrderModal(card.dataset.orderId);
    return;
  }
});

render();
