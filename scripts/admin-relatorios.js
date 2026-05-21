/*
  TELA ADMIN RELATÓRIOS

  Todos os gráficos usam dados reais do Supabase.
  Fontes:
  - financial_transactions
  - appointments
  - patients
  - accounts_receivable
  - accounts_payable
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const reportIncomeText = document.querySelector("#reportIncomeText");
const reportExpenseText = document.querySelector("#reportExpenseText");
const reportProfitText = document.querySelector("#reportProfitText");
const reportAppointmentsText = document.querySelector("#reportAppointmentsText");
const reportPatientsText = document.querySelector("#reportPatientsText");
const reportAverageTicketText = document.querySelector("#reportAverageTicketText");

const periodButtons = document.querySelectorAll(".finance-period-tabs button");

let selectedPeriod = "month";

let allTransactions = [];
let allAppointments = [];
let allPatients = [];
let allReceivables = [];
let allPayables = [];

let filteredTransactions = [];
let filteredAppointments = [];
let filteredPatients = [];

let reportIncomeExpenseChart = null;
let reportAppointmentStatusChart = null;
let reportProcedureChart = null;
let reportPaymentChart = null;
let reportReceivablePayableChart = null;
let reportPatientsChart = null;

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    periodButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    selectedPeriod = button.dataset.period;

    applyPeriodFilters();
    renderReports();
  });
});

loadReportsPage();

async function loadReportsPage() {
  await Promise.all([
    loadTransactions(),
    loadAppointments(),
    loadPatients(),
    loadReceivables(),
    loadPayables()
  ]);

  applyPeriodFilters();
  renderReports();
}

/*
  Busca movimentações financeiras.
*/
async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from("financial_transactions")
    .select(`
      *,
      patients (*)
    `)
    .order("transaction_date", { ascending: true });

  if (error) {
    console.error("Erro ao buscar movimentações:", JSON.stringify(error, null, 2));
    allTransactions = [];
    return;
  }

  allTransactions = data || [];
}

/*
  Busca agendamentos com procedimentos.
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
    .order("appointment_date", { ascending: true });

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
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pacientes:", JSON.stringify(error, null, 2));
    allPatients = [];
    return;
  }

  allPatients = data || [];
}

/*
  Busca contas a receber.
*/
async function loadReceivables() {
  const { data, error } = await supabaseClient
    .from("accounts_receivable")
    .select("*");

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
    .select("*");

  if (error) {
    console.error("Erro ao buscar A Pagar:", JSON.stringify(error, null, 2));
    allPayables = [];
    return;
  }

  allPayables = data || [];
}

/*
  Aplica período selecionado nos dados.
*/
function applyPeriodFilters() {
  const { startDate, endDate } = getPeriodRange(selectedPeriod);

  filteredTransactions = allTransactions.filter((transaction) => {
    return transaction.transaction_date >= startDate && transaction.transaction_date <= endDate;
  });

  filteredAppointments = allAppointments.filter((appointment) => {
    return appointment.appointment_date >= startDate && appointment.appointment_date <= endDate;
  });

  filteredPatients = allPatients.filter((patient) => {
    const createdDate = patient.created_at ? patient.created_at.split("T")[0] : null;

    if (!createdDate) {
      return false;
    }

    return createdDate >= startDate && createdDate <= endDate;
  });
}

/*
  Renderiza a página inteira.
*/
function renderReports() {
  renderReportCards();
  renderIncomeExpenseChart();
  renderAppointmentStatusChart();
  renderProcedureChart();
  renderPaymentChart();
  renderReceivablePayableChart();
  renderPatientsChart();
}

/*
  Cards principais.
*/
function renderReportCards() {
  const incomeTransactions = filteredTransactions.filter((item) => {
    return ["income", "cash_injection"].includes(item.type);
  });

  const expenseTransactions = filteredTransactions.filter((item) => {
    return ["expense", "withdrawal"].includes(item.type);
  });

  const incomeTotal = sumAmounts(incomeTransactions);
  const expenseTotal = sumAmounts(expenseTransactions);
  const profit = incomeTotal - expenseTotal;

  const averageTicket = incomeTransactions.length
    ? incomeTotal / incomeTransactions.length
    : 0;

  reportIncomeText.textContent = formatCurrency(incomeTotal);
  reportExpenseText.textContent = formatCurrency(expenseTotal);
  reportProfitText.textContent = formatCurrency(profit);
  reportAppointmentsText.textContent = filteredAppointments.length;
  reportPatientsText.textContent = filteredPatients.length;
  reportAverageTicketText.textContent = formatCurrency(averageTicket);

  reportProfitText.classList.remove("success-text", "danger-text", "primary-text");

  if (profit >= 0) {
    reportProfitText.classList.add("success-text");
  } else {
    reportProfitText.classList.add("danger-text");
  }
}

/*
  Gráfico receita x despesa.
*/
function renderIncomeExpenseChart() {
  const { startDate, endDate } = getPeriodRange(selectedPeriod);

  /*
    Criamos todos os dias/meses do período.
    Assim o gráfico não fica só com uma bolinha no canto quando só existe 1 movimentação.
  */
  const labels = getChartLabelsByPeriod(startDate, endDate, selectedPeriod);

  const grouped = {};

  /*
    Prepara todos os labels com valor zerado.
  */
  labels.forEach((label) => {
    grouped[label.key] = {
      income: 0,
      expense: 0
    };
  });

  /*
    Soma entradas e saídas dentro do label correto.
  */
  filteredTransactions.forEach((item) => {
    const key = getChartKeyByPeriod(item.transaction_date, selectedPeriod);

    if (!grouped[key]) {
      grouped[key] = {
        income: 0,
        expense: 0
      };
    }

    if (["income", "cash_injection"].includes(item.type)) {
      grouped[key].income += Number(item.amount || 0);
    }

    if (["expense", "withdrawal"].includes(item.type)) {
      grouped[key].expense += Number(item.amount || 0);
    }
  });

  const chartLabels = labels.map((item) => item.label);

  const incomeData = labels.map((item) => grouped[item.key]?.income || 0);
  const expenseData = labels.map((item) => grouped[item.key]?.expense || 0);

  const ctx = document.querySelector("#reportIncomeExpenseChart");

  if (reportIncomeExpenseChart) {
    reportIncomeExpenseChart.destroy();
  }

  reportIncomeExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "Receita",
          data: incomeData,
          backgroundColor: "#22c55e",
          borderColor: "#22c55e",
          borderWidth: 1
        },
        {
          label: "Despesa",
          data: expenseData,
          backgroundColor: "#ef4444",
          borderColor: "#ef4444",
          borderWidth: 1
        }
      ]
    },
    options: getMoneyChartOptions()
  });
}

/*
  Gráfico de status dos agendamentos.
*/
function renderAppointmentStatusChart() {
  const grouped = {};

  filteredAppointments.forEach((appointment) => {
    const status = translateAppointmentStatus(appointment.status);

    if (!grouped[status]) {
      grouped[status] = 0;
    }

    grouped[status] += 1;
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#reportAppointmentStatusChart");

  if (reportAppointmentStatusChart) {
    reportAppointmentStatusChart.destroy();
  }

  reportAppointmentStatusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#facc15",
            "#2563eb",
            "#22c55e",
            "#ef4444",
            "#94a3b8",
            "#8b5cf6"
          ]
        }
      ]
    },
    options: getDoughnutOptions()
  });
}

/*
  Gráfico de procedimentos mais realizados.
*/
function renderProcedureChart() {
  const grouped = {};

  filteredAppointments.forEach((appointment) => {
    const procedureName = appointment.procedures?.name || "Sem procedimento";

    if (!grouped[procedureName]) {
      grouped[procedureName] = 0;
    }

    grouped[procedureName] += 1;
  });

  const sortedEntries = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const labels = sortedEntries.map((item) => item[0]);
  const data = sortedEntries.map((item) => item[1]);

  const ctx = document.querySelector("#reportProcedureChart");

  if (reportProcedureChart) {
    reportProcedureChart.destroy();
  }

  reportProcedureChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Quantidade",
          data,
          backgroundColor: "#2563eb"
        }
      ]
    },
    options: {
      ...getDefaultChartOptions(),
      indexAxis: "y"
    }
  });
}

/*
  Gráfico por forma de pagamento.
*/
function renderPaymentChart() {
  const incomeTransactions = filteredTransactions.filter((item) => {
    return ["income", "cash_injection"].includes(item.type);
  });

  const grouped = {};

  incomeTransactions.forEach((item) => {
    const payment = item.payment_method || "Não informado";

    if (!grouped[payment]) {
      grouped[payment] = 0;
    }

    grouped[payment] += Number(item.amount || 0);
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#reportPaymentChart");

  if (reportPaymentChart) {
    reportPaymentChart.destroy();
  }

  reportPaymentChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#22c55e",
            "#2563eb",
            "#6366f1",
            "#facc15",
            "#f97316",
            "#94a3b8"
          ]
        }
      ]
    },
    options: getDoughnutOptions()
  });
}

/*
  Gráfico a receber x a pagar.
*/
function renderReceivablePayableChart() {
  const receivablePending = allReceivables
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const payablePending = allPayables
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const ctx = document.querySelector("#reportReceivablePayableChart");

  if (reportReceivablePayableChart) {
    reportReceivablePayableChart.destroy();
  }

  reportReceivablePayableChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["A receber", "A pagar"],
      datasets: [
        {
          label: "Valor pendente",
          data: [receivablePending, payablePending],
          backgroundColor: ["#22c55e", "#ef4444"]
        }
      ]
    },
    options: getDefaultChartOptions()
  });
}

/*
  Gráfico de novos pacientes.
*/
function renderPatientsChart() {
  const grouped = {};

  filteredPatients.forEach((patient) => {
    const date = patient.created_at?.split("T")[0];

    if (!date) {
      return;
    }

    if (!grouped[date]) {
      grouped[date] = 0;
    }

    grouped[date] += 1;
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#reportPatientsChart");

  if (reportPatientsChart) {
    reportPatientsChart.destroy();
  }

  reportPatientsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map(formatShortDate),
      datasets: [
        {
          label: "Novos pacientes",
          data,
          backgroundColor: "#8b5cf6"
        }
      ]
    },
    options: getDefaultChartOptions()
  });
}

/*
  Utilitários de cálculo.
*/
function sumAmounts(items) {
  return items.reduce((sum, item) => {
    return sum + Number(item.amount || 0);
  }, 0);
}

/*
  Período.
*/
function getPeriodRange(period) {
  const today = new Date();

  const start = new Date(today);
  const end = new Date(today);

  if (period === "today") {
    return {
      startDate: formatDateToDatabase(today),
      endDate: formatDateToDatabase(today)
    };
  }

  if (period === "week") {
    const dayOfWeek = today.getDay();
    const mondayDistance = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    start.setDate(today.getDate() + mondayDistance);
    end.setDate(start.getDate() + 6);

    return {
      startDate: formatDateToDatabase(start),
      endDate: formatDateToDatabase(end)
    };
  }

  if (period === "month") {
    start.setDate(1);

    end.setMonth(today.getMonth() + 1);
    end.setDate(0);

    return {
      startDate: formatDateToDatabase(start),
      endDate: formatDateToDatabase(end)
    };
  }

  if (period === "year") {
    start.setMonth(0);
    start.setDate(1);

    end.setMonth(11);
    end.setDate(31);

    return {
      startDate: formatDateToDatabase(start),
      endDate: formatDateToDatabase(end)
    };
  }

  return {
    startDate: formatDateToDatabase(today),
    endDate: formatDateToDatabase(today)
  };
}

/*
  Configuração padrão dos gráficos.
*/
function getDefaultChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom"
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw || 0;

            if (typeof value === "number") {
              return `${context.dataset.label}: ${formatCurrency(value)}`;
            }

            return `${context.dataset.label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };
}

/*
  Configuração para gráficos de rosca.
*/
function getDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom"
      }
    }
  };
}

/*
  Traduções.
*/
function translateAppointmentStatus(status) {
  const map = {
    requested: "Solicitado",
    clinic_confirmed: "Confirmado",
    patient_confirmed: "Presença confirmada",
    completed: "Concluído",
    cancelled_by_patient: "Cancelado pelo paciente",
    cancelled_by_clinic: "Cancelado pela clínica",
    no_show: "Faltou"
  };

  return map[status] || status || "Sem status";
}

/*
  Datas.
*/
function formatDateToDatabase(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}`;
}

/*
  Moeda.
*/
function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function getChartLabelsByPeriod(startDate, endDate, period) {
  const labels = [];

  const start = createDateFromDatabase(startDate);
  const end = createDateFromDatabase(endDate);

  /*
    Para o período "ano", agrupamos por mês.
  */
  if (period === "year") {
    for (let month = 0; month < 12; month++) {
      const date = new Date(start.getFullYear(), month, 1);

      labels.push({
        key: `${date.getFullYear()}-${String(month + 1).padStart(2, "0")}`,
        label: date.toLocaleDateString("pt-BR", {
          month: "short"
        })
      });
    }

    return labels;
  }

  /*
    Para hoje, semana e mês, agrupamos por dia.
  */
  const current = new Date(start);

  while (current <= end) {
    const key = formatDateToDatabase(current);

    labels.push({
      key,
      label: formatShortDate(key)
    });

    current.setDate(current.getDate() + 1);
  }

  return labels;
}

function getChartKeyByPeriod(date, period) {
  if (!date) {
    return "";
  }

  /*
    Se for relatório anual, a chave vira YYYY-MM.
  */
  if (period === "year") {
    return date.slice(0, 7);
  }

  /*
    Se for hoje, semana ou mês, a chave fica YYYY-MM-DD.
  */
  return date;
}

function createDateFromDatabase(date) {
  const [year, month, day] = date.split("-");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );
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
