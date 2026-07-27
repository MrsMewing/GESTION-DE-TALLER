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
      },
    ],
    inProgress: [
      {
        id: crypto.randomUUID(),
        title: "Calibración de tablero",
        description: "En proceso con revisión del supervisor.",
      },
    ],
    completed: [
      {
        id: crypto.randomUUID(),
        title: "Cambio de batería",
        description: "Finalizada y validada por el equipo.",
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
        (order) => `
          <article class="order-card">
            <h4>${order.title}</h4>
            <p>${order.description}</p>
            <div class="order-actions">
              ${selectedOrderStatus !== "pending" ? `<button class="move-btn" data-action="back" data-order-id="${order.id}" data-from="${selectedOrderStatus}">← Volver</button>` : ""}
              ${selectedOrderStatus !== "completed" ? `<button class="move-btn" data-action="next" data-order-id="${order.id}" data-from="${selectedOrderStatus}">Siguiente →</button>` : ""}
            </div>
          </article>
        `
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

ordersBoard.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

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
});

render();
