/*
  ADMIN DASHBOARD

  Essa tela resume os dados principais da clínica:
  - agendamentos
  - pacientes
  - financeiro
  - contas a receber/pagar
  - gráficos reais com Chart.js
*/

const refreshDashboardButton = document.querySelector("#refreshDashboardButton");

const todayAppointmentsText = document.querySelector("#todayAppointmentsText");
const todayAppointmentsSmall = document.querySelector("#todayAppointmentsSmall");
const pendingAppointmentsText = document.querySelector("#pendingAppointmentsText");
const patientsTotalText = document.querySelector("#patientsTotalText");
const monthIncomeText = document.querySelector("#monthIncomeText");
const receivableDashboardText = document.querySelector("#receivableDashboardText");
const payableDashboardText = document.querySelector("#payableDashboardText");
const cancelledAppointmentsText = document.querySelector("#cancelledAppointmentsText");
const confirmedPresenceText = document.querySelector("#confirmedPresenceText");

const nextAppointmentsTable = document.querySelector("#nextAppointmentsTable");
const financialAlertsList = document.querySelector("#financialAlertsList");

let allAppointments = [];
let allPatients = [];
let allTransactions = [];
let allReceivables = [];
let allPayables = [];

let dashboardIncomeChart = null;
let dashboardStatusChart = null;

refreshDashboardButton.addEventListener("click", async () => {
  refreshDashboardButton.textContent = "Atualizando...";
  refreshDashboardButton.disabled = true;

  await loadDashboardPage();

  refreshDashboardButton.textContent = "Atualizar dados";
  refreshDashboardButton.disabled = false;
});

loadDashboardPage();

async function loadDashboardPage() {
  await Promise.all([
    loadAppointments(),
    loadPatients(),
    loadTransactions(),
    loadReceivables(),
    loadPayables()
  ]);

  renderDashboardCards();
  renderIncomeChart();
  renderStatusChart();
  renderNextAppointments();
  renderFinancialAlerts();
}

/*
  Busca agendamentos com dados relacionados.
*/
async function loadAppointments() {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select(`
      *,
      patients (*),
      procedures (*),
      dentists (*)
    `)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agendamentos:", JSON.stringify(error, null, 2));
    allAppointments = [];
    return;
  }

  allAppointments = data || [];
}

/*
  Busca pacientes.
*/
async function loadPatients() {
  const { data, error } = await supabaseClient
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pacientes:", JSON.stringify(error, null, 2));
    allPatients = [];
    return;
  }

  allPatients = data || [];
}

/*
  Busca movimentações financeiras.
*/
async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from("financial_transactions")
    .select("*")
    .order("transaction_date", { ascending: true });

  if (error) {
    console.error("Erro ao buscar financeiro:", JSON.stringify(error, null, 2));
    allTransactions = [];
    return;
  }

  allTransactions = data || [];
}

/*
  Busca contas a receber.
*/
async function loadReceivables() {
  const { data, error } = await supabaseClient
    .from("accounts_receivable")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Erro ao buscar A Receber:", JSON.stringify(error, null, 2));
    allReceivables = [];
    return;
  }

  allReceivables = data || [];
}

/*
  Busca contas a pagar.
*/
async function loadPayables() {
  const { data, error } = await supabaseClient
    .from("accounts_payable")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Erro ao buscar A Pagar:", JSON.stringify(error, null, 2));
    allPayables = [];
    return;
  }

  allPayables = data || [];
}

/*
  Renderiza cards do topo.
*/
function renderDashboardCards() {
  const today = getTodayDate();
  const { startDate, endDate } = getCurrentMonthRange();

  const todayAppointments = allAppointments.filter((appointment) => {
    return appointment.appointment_date === today;
  });

  const pendingAppointments = allAppointments.filter((appointment) => {
    return appointment.status === "requested";
  });

  const monthAppointments = allAppointments.filter((appointment) => {
    return appointment.appointment_date >= startDate && appointment.appointment_date <= endDate;
  });

  const cancelledAppointments = monthAppointments.filter((appointment) => {
    return [
      "cancelled",
      "cancelled_by_patient",
      "cancelled_by_clinic",
      "no_show"
    ].includes(appointment.status);
  });

  const confirmedPresence = todayAppointments.filter((appointment) => {
    return appointment.status === "patient_confirmed";
  });

  const monthIncome = allTransactions
    .filter((transaction) => {
      return transaction.transaction_date >= startDate && transaction.transaction_date <= endDate;
    })
    .filter((transaction) => {
      return ["income", "cash_injection"].includes(transaction.type);
    })
    .reduce((sum, transaction) => {
      return sum + Number(transaction.amount || 0);
    }, 0);

  const receivablePending = allReceivables
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const payablePending = allPayables
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  todayAppointmentsText.textContent = todayAppointments.length;
  todayAppointmentsSmall.textContent = todayAppointments.length === 1
    ? "1 consulta para hoje"
    : `${todayAppointments.length} consultas para hoje`;

  pendingAppointmentsText.textContent = pendingAppointments.length;
  patientsTotalText.textContent = allPatients.length;
  monthIncomeText.textContent = formatCurrency(monthIncome);
  receivableDashboardText.textContent = formatCurrency(receivablePending);
  payableDashboardText.textContent = formatCurrency(payablePending);
  cancelledAppointmentsText.textContent = cancelledAppointments.length;
  confirmedPresenceText.textContent = confirmedPresence.length;
}

/*
  Gráfico de faturamento dos últimos 6 meses.
*/
function renderIncomeChart() {
  const months = getLastMonths(6);

  const incomeByMonth = {};

  months.forEach((month) => {
    incomeByMonth[month.key] = 0;
  });

  allTransactions
    .filter((transaction) => ["income", "cash_injection"].includes(transaction.type))
    .forEach((transaction) => {
      const monthKey = transaction.transaction_date?.slice(0, 7);

      if (incomeByMonth[monthKey] !== undefined) {
        incomeByMonth[monthKey] += Number(transaction.amount || 0);
      }
    });

  const ctx = document.querySelector("#dashboardIncomeChart");

  if (dashboardIncomeChart) {
    dashboardIncomeChart.destroy();
  }

  dashboardIncomeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: months.map((month) => month.label),
      datasets: [
        {
          label: "Faturamento",
          data: months.map((month) => incomeByMonth[month.key]),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }
      ]
    },
    options: getMoneyChartOptions()
  });
}

/*
  Gráfico de status dos agendamentos do mês.
*/
function renderStatusChart() {
  const { startDate, endDate } = getCurrentMonthRange();

  const monthAppointments = allAppointments.filter((appointment) => {
    return appointment.appointment_date >= startDate && appointment.appointment_date <= endDate;
  });

  const grouped = {};

  monthAppointments.forEach((appointment) => {
    const status = translateAppointmentStatus(appointment.status);

    if (!grouped[status]) {
      grouped[status] = 0;
    }

    grouped[status] += 1;
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#dashboardStatusChart");

  if (dashboardStatusChart) {
    dashboardStatusChart.destroy();
  }

  dashboardStatusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#2563eb",
            "#facc15",
            "#22c55e",
            "#ef4444",
            "#8b5cf6",
            "#94a3b8"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#94a3b8"
          }
        }
      }
    }
  });
}

/*
  Lista próximos agendamentos.
*/
function renderNextAppointments() {
  const today = getTodayDate();

  const nextAppointments = allAppointments
    .filter((appointment) => {
      return appointment.appointment_date >= today;
    })
    .filter((appointment) => {
      return ![
        "cancelled",
        "cancelled_by_patient",
        "cancelled_by_clinic"
      ].includes(appointment.status);
    })
    .slice(0, 6);

  if (!nextAppointments.length) {
    nextAppointmentsTable.innerHTML = `
      <tr>
        <td colspan="6">Nenhum agendamento futuro encontrado.</td>
      </tr>
    `;
    return;
  }

  nextAppointmentsTable.innerHTML = nextAppointments.map((appointment) => {
    return `
      <tr>
        <td>${appointment.patients?.full_name || appointment.patient_name || "-"}</td>
        <td>${appointment.procedures?.name || "-"}</td>
        <td>${appointment.dentists?.name || "-"}</td>
        <td>${formatDateToBR(appointment.appointment_date)}</td>
        <td>${formatTime(appointment.appointment_time)}</td>
        <td>
          <span class="status-badge ${getAppointmentStatusClass(appointment.status)}">
            ${translateAppointmentStatus(appointment.status)}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

/*
  Alertas financeiros.
*/
function renderFinancialAlerts() {
  const today = getTodayDate();
  const limitDate = addDaysToDate(today, 3);

  const overdueReceivables = allReceivables.filter((item) => {
    return item.status === "pending" && item.due_date < today;
  });

  const dueSoonReceivables = allReceivables.filter((item) => {
    return item.status === "pending" && item.due_date >= today && item.due_date <= limitDate;
  });

  const overduePayables = allPayables.filter((item) => {
    return item.status === "pending" && item.due_date < today;
  });

  const dueSoonPayables = allPayables.filter((item) => {
    return item.status === "pending" && item.due_date >= today && item.due_date <= limitDate;
  });

  const alerts = [
    ...overdueReceivables.map((item) => ({
      type: "danger",
      title: "Conta a receber vencida",
      description: `${item.description || "Cobrança"} — ${formatCurrency(item.amount)}`
    })),

    ...dueSoonReceivables.map((item) => ({
      type: "warning",
      title: "Conta a receber próxima",
      description: `${item.description || "Cobrança"} — vence em ${formatDateToBR(item.due_date)}`
    })),

    ...overduePayables.map((item) => ({
      type: "danger",
      title: "Conta a pagar vencida",
      description: `${item.description || "Despesa"} — ${formatCurrency(item.amount)}`
    })),

    ...dueSoonPayables.map((item) => ({
      type: "warning",
      title: "Conta a pagar próxima",
      description: `${item.description || "Despesa"} — vence em ${formatDateToBR(item.due_date)}`
    }))
  ].slice(0, 8);

  if (!alerts.length) {
    financialAlertsList.innerHTML = `
      <div class="dashboard-alert empty">
        <strong>Nenhum alerta financeiro</strong>
        <span>Não há contas vencidas ou próximas do vencimento.</span>
      </div>
    `;
    return;
  }

  financialAlertsList.innerHTML = alerts.map((alert) => {
    return `
      <div class="dashboard-alert ${alert.type}">
        <strong>${alert.title}</strong>
        <span>${alert.description}</span>
      </div>
    `;
  }).join("");
}

/*
  Utilidades.
*/
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getCurrentMonthRange() {
  const today = new Date();

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: formatDateToDatabase(start),
    endDate: formatDateToDatabase(end)
  };
}

function getLastMonths(totalMonths) {
  const months = [];
  const today = new Date();

  for (let index = totalMonths - 1; index >= 0; index--) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);

    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("pt-BR", {
        month: "short"
      })
    });
  }

  return months;
}

function addDaysToDate(dateString, days) {
  const [year, month, day] = dateString.split("-");

  const date = new Date(Number(year), Number(month) - 1, Number(day));
  date.setDate(date.getDate() + days);

  return formatDateToDatabase(date);
}

function formatDateToDatabase(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateToBR(date) {
  if (!date) return "-";

  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year}`;
}

function formatTime(time) {
  if (!time) return "-";

  return String(time).slice(0, 5);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function translateAppointmentStatus(status) {
  const map = {
    requested: "Solicitado",
    clinic_confirmed: "Confirmado",
    patient_confirmed: "Presença conf.",
    completed: "Concluído",
    cancelled: "Cancelado",
    cancelled_by_patient: "Cancelado paciente",
    cancelled_by_clinic: "Cancelado clínica",
    no_show: "Faltou",
    rescheduled: "Reagendamento"
  };

  return map[status] || status || "Sem status";
}

function getAppointmentStatusClass(status) {
  const map = {
    requested: "status-pending",
    clinic_confirmed: "status-confirmed",
    patient_confirmed: "status-paid",
    completed: "status-neutral",
    cancelled: "status-overdue",
    cancelled_by_patient: "status-overdue",
    cancelled_by_clinic: "status-overdue",
    no_show: "status-overdue",
    rescheduled: "status-draft"
  };

  return map[status] || "status-neutral";
}

function getMoneyChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#94a3b8"
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${formatCurrency(context.raw || 0)}`;
          }
        }
      }
    },

    scales: {
      x: {
        ticks: {
          color: "#94a3b8"
        },
        grid: {
          color: "rgba(148, 163, 184, 0.12)"
        }
      },

      y: {
        beginAtZero: true,
        ticks: {
          color: "#94a3b8",
          callback: (value) => formatCurrency(value)
        },
        grid: {
          color: "rgba(148, 163, 184, 0.12)"
        }
      }
    }
  };
}
