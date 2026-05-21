/*
  ADMIN AUTH / PERMISSÕES

  Esse arquivo:
  1. Verifica se o usuário está logado
  2. Lê o perfil salvo no localStorage
  3. Bloqueia menus que o perfil não pode acessar
  4. Preenche nome/e-mail do usuário no sidebar
*/

const ADMIN_ROUTES_BY_ROLE = {
  admin: [
    "admin-dashboard.html",
    "admin-agenda.html",
    "admin-agendamentos.html",
    "admin-pacientes.html",
    "admin-dentistas.html",
    "admin-procedimentos.html",
    "admin-prontuarios.html",
    "admin-orcamentos.html",
    "admin-financeiro.html",
    "admin-caixa.html",
    "admin-receber.html",
    "admin-pagar.html",
    "admin-relatorios.html",
    "admin-usuarios.html",
    "admin-configuracoes.html"
  ],

  receptionist: [
    "admin-dashboard.html",
    "admin-agenda.html",
    "admin-agendamentos.html",
    "admin-pacientes.html",
    "admin-prontuarios.html",
    "admin-orcamentos.html",
    "admin-caixa.html",
    "admin-receber.html"
  ],

  dentist: [
    "admin-dashboard.html",
    "admin-agenda.html",
    "admin-agendamentos.html",
    "admin-pacientes.html",
    "admin-prontuarios.html"
  ],

  financial: [
    "admin-dashboard.html",
    "admin-financeiro.html",
    "admin-caixa.html",
    "admin-receber.html",
    "admin-pagar.html",
    "admin-relatorios.html"
  ]
};

function checkAdminAuth() {
  const isLogged = localStorage.getItem("odontoflow_admin_logged");
  const role = localStorage.getItem("odontoflow_admin_role") || "receptionist";

  if (isLogged !== "true") {
    window.location.href = "./admin-login.html";
    return;
  }

  const currentPage = window.location.pathname.split("/").pop();

  const allowedPages = ADMIN_ROUTES_BY_ROLE[role] || ADMIN_ROUTES_BY_ROLE.receptionist;

  if (!allowedPages.includes(currentPage)) {
    alert("Você não tem permissão para acessar esta página.");
    window.location.href = "./admin-dashboard.html";
    return;
  }

  applyMenuPermissions(role);
  fillLoggedUserInfo();
}

function applyMenuPermissions(role) {
  const allowedPages = ADMIN_ROUTES_BY_ROLE[role] || [];

  document.querySelectorAll(".admin-menu-item").forEach((link) => {
    const href = link.getAttribute("href");

    if (!href) {
      return;
    }

    const page = href.replace("./", "");

    if (!allowedPages.includes(page)) {
      link.style.display = "none";
    }
  });
}

function fillLoggedUserInfo() {
  const name = localStorage.getItem("odontoflow_admin_name") || "Usuário";
  const email = localStorage.getItem("odontoflow_admin_email") || "";
  const initial = name.charAt(0).toUpperCase();

  document.querySelectorAll(".admin-user-avatar, .admin-top-avatar").forEach((avatar) => {
    avatar.textContent = initial;
  });

  const sidebarUserName = document.querySelector(".admin-sidebar-user strong");
  const sidebarUserEmail = document.querySelector(".admin-sidebar-user small");

  if (sidebarUserName) {
    sidebarUserName.textContent = name;
  }

  if (sidebarUserEmail) {
    sidebarUserEmail.textContent = email;
  }
}

function logoutAdmin() {
  localStorage.removeItem("odontoflow_admin_logged");
  localStorage.removeItem("odontoflow_admin_user_id");
  localStorage.removeItem("odontoflow_admin_name");
  localStorage.removeItem("odontoflow_admin_email");
  localStorage.removeItem("odontoflow_admin_role");
  localStorage.removeItem("odontoflow_admin_dentist_id");

  window.location.href = "./admin-login.html";
}

function getLoggedAdminRole() {
  return localStorage.getItem("odontoflow_admin_role") || "receptionist";
}

function getLoggedDentistId() {
  return localStorage.getItem("odontoflow_admin_dentist_id") || "";
}

function canAccessFinance() {
  const role = getLoggedAdminRole();
  return ["admin", "financial"].includes(role);
}

function canManageUsers() {
  return getLoggedAdminRole() === "admin";
}

function canManageClinicSettings() {
  return getLoggedAdminRole() === "admin";
}

function canEditClinicalRecords() {
  const role = getLoggedAdminRole();
  return ["admin", "dentist"].includes(role);
}

checkAdminAuth();
initAdminNotifications();

const globalLogoutButton = document.querySelector("#logoutButton");

if (globalLogoutButton) {
  globalLogoutButton.addEventListener("click", logoutAdmin);
}

/*
  Inicializa o sininho do topo.
  Antes ele era apenas visual no HTML; agora o clique abre um painel real.
*/
function initAdminNotifications() {
  const notificationButton = document.querySelector(".admin-notification");
  const topbarActions = document.querySelector(".admin-topbar-actions");

  if (!notificationButton || !topbarActions) {
    return;
  }

  notificationButton.setAttribute("type", "button");

  const badge = notificationButton.querySelector("span");
  const panel = document.createElement("div");

  panel.className = "admin-notification-panel";
  panel.innerHTML = `
    <div class="admin-notification-header">
      <strong>Notificações</strong>
      <small>Carregando...</small>
    </div>

    <div class="admin-notification-list">
      <p class="admin-notification-empty">Carregando notificações...</p>
    </div>
  `;

  topbarActions.appendChild(panel);

  notificationButton.addEventListener("click", async (event) => {
    event.stopPropagation();

    const isOpen = panel.classList.toggle("active");

    if (isOpen) {
      await loadAdminNotifications(panel, badge);
    }
  });

  panel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    panel.classList.remove("active");
  });

  loadAdminNotifications(panel, badge);
}

/*
  Busca notificações simples usando os dados que já existem no sistema:
  - agendamentos solicitados/cancelados/confirmados pelo paciente;
  - contas a pagar vencidas ou vencendo hoje;
  - contas a receber vencidas ou vencendo hoje;
  - relatório diário, caso esteja ativado nas configurações.
*/
async function loadAdminNotifications(panel, badge) {
  const list = panel.querySelector(".admin-notification-list");
  const counter = panel.querySelector(".admin-notification-header small");

  list.innerHTML = `<p class="admin-notification-empty">Carregando notificações...</p>`;
  counter.textContent = "Carregando...";

  const settings = await getAdminNotificationSettings();
  const notifications = await buildAdminNotifications(settings);

  updateNotificationBadge(badge, notifications.length);
  counter.textContent = `${notifications.length} aviso${notifications.length === 1 ? "" : "s"}`;

  if (!notifications.length) {
    list.innerHTML = `
      <p class="admin-notification-empty">
        Nenhuma notificação nova por enquanto.
      </p>
    `;
    return;
  }

  list.innerHTML = notifications.map((notification) => {
    return `
      <a href="${notification.href}" class="admin-notification-item ${notification.type}">
        <strong>${escapeHtml(notification.title)}</strong>
        <span>${escapeHtml(notification.description)}</span>
      </a>
    `;
  }).join("");
}

async function getAdminNotificationSettings() {
  const defaultSettings = {
    new_appointment: true,
    cancelled_appointment: true,
    patient_confirmation: true,
    payable_due: true,
    receivable_due: true,
    daily_report: false
  };

  const { data, error } = await supabaseClient
    .from("notification_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !data || !data.length) {
    return defaultSettings;
  }

  return {
    ...defaultSettings,
    ...data[0]
  };
}

async function buildAdminNotifications(settings) {
  const notifications = [];

  await Promise.all([
    addAppointmentNotifications(notifications, settings),
    addPayableNotifications(notifications, settings),
    addReceivableNotifications(notifications, settings)
  ]);

  if (settings.daily_report) {
    notifications.push({
      type: "info",
      title: "Relatório diário disponível",
      description: "Confira o resumo operacional e financeiro de hoje.",
      href: "./admin-relatorios.html"
    });
  }

  return notifications.slice(0, 12);
}

async function addAppointmentNotifications(notifications, settings) {
  const activeStatuses = [];

  if (settings.new_appointment) {
    activeStatuses.push("requested");
  }

  if (settings.cancelled_appointment) {
    activeStatuses.push("cancelled_by_patient", "cancelled_by_clinic");
  }

  if (settings.patient_confirmation) {
    activeStatuses.push("patient_confirmed");
  }

  if (!activeStatuses.length) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("appointments")
    .select(`
      *,
      patients (*),
      procedures (*)
    `)
    .in("status", activeStatuses)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(8);

  if (error) {
    console.warn("Erro ao carregar notificações de agendamento:", JSON.stringify(error, null, 2));
    return;
  }

  (data || []).forEach((appointment) => {
    const patientName = appointment.patients?.full_name || "Paciente";
    const procedureName = appointment.procedures?.name || "Procedimento";
    const date = formatAdminNotificationDate(appointment.appointment_date);
    const time = appointment.appointment_time?.slice(0, 5) || "--:--";

    if (appointment.status === "requested") {
      notifications.push({
        type: "info",
        title: "Novo agendamento",
        description: `${patientName} solicitou ${procedureName} em ${date} às ${time}.`,
        href: "./admin-agendamentos.html"
      });
    }

    if (["cancelled_by_patient", "cancelled_by_clinic"].includes(appointment.status)) {
      notifications.push({
        type: "danger",
        title: "Agendamento cancelado",
        description: `${patientName} tinha ${procedureName} em ${date} às ${time}.`,
        href: "./admin-agendamentos.html"
      });
    }

    if (appointment.status === "patient_confirmed") {
      notifications.push({
        type: "success",
        title: "Presença confirmada",
        description: `${patientName} confirmou presença em ${date} às ${time}.`,
        href: "./admin-agendamentos.html"
      });
    }
  });
}

async function addPayableNotifications(notifications, settings) {
  if (!settings.payable_due) {
    return;
  }

  const today = getAdminNotificationToday();

  const { data, error } = await supabaseClient
    .from("accounts_payable")
    .select("*")
    .eq("status", "pending")
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(4);

  if (error) {
    console.warn("Erro ao carregar notificações de contas a pagar:", JSON.stringify(error, null, 2));
    return;
  }

  (data || []).forEach((payable) => {
    notifications.push({
      type: "warning",
      title: "Conta a pagar vencendo",
      description: `${payable.description || "Despesa"} vence em ${formatAdminNotificationDate(payable.due_date)}.`,
      href: "./admin-pagar.html"
    });
  });
}

async function addReceivableNotifications(notifications, settings) {
  if (!settings.receivable_due) {
    return;
  }

  const today = getAdminNotificationToday();

  const { data, error } = await supabaseClient
    .from("accounts_receivable")
    .select("*")
    .eq("status", "pending")
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(4);

  if (error) {
    console.warn("Erro ao carregar notificações de contas a receber:", JSON.stringify(error, null, 2));
    return;
  }

  (data || []).forEach((receivable) => {
    notifications.push({
      type: "success",
      title: "Conta a receber pendente",
      description: `${receivable.description || "Cobrança"} vence em ${formatAdminNotificationDate(receivable.due_date)}.`,
      href: "./admin-receber.html"
    });
  });
}

function updateNotificationBadge(badge, total) {
  if (!badge) {
    return;
  }

  badge.style.display = total > 0 ? "block" : "none";
}

function getAdminNotificationToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatAdminNotificationDate(date) {
  if (!date) {
    return "-";
  }

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
