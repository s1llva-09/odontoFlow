/*
  TELA ADMIN FINANCEIRO

  Aqui os gráficos não são fake.
  Eles puxam dados reais da tabela financial_transactions.

  Também busca:
  - accounts_receivable para A Receber
  - accounts_payable para A Pagar
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const incomeTotalText = document.querySelector("#incomeTotalText");
const expenseTotalText = document.querySelector("#expenseTotalText");
const profitTotalText = document.querySelector("#profitTotalText");
const receivableTotalText = document.querySelector("#receivableTotalText");
const payableTotalText = document.querySelector("#payableTotalText");
const averageTicketText = document.querySelector("#averageTicketText");

const financialTable = document.querySelector("#financialTable");

const periodButtons = document.querySelectorAll(".finance-period-tabs button");

let selectedPeriod = "month";

let allTransactions = [];
let filteredTransactions = [];

let incomeExpenseChart = null;
let paymentMethodChart = null;
let expenseCategoryChart = null;
let incomeCategoryChart = null;

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    periodButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    selectedPeriod = button.dataset.period;

    applyPeriodFilter();
    renderFinancePage();
  });
});

loadFinancePage();

async function loadFinancePage() {
  await Promise.all([
    loadTransactions(),
    loadReceivableTotal(),
    loadPayableTotal()
  ]);

  applyPeriodFilter();
  renderFinancePage();
}

async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from("financial_transactions")
    .select(`
      *,
      patients (*)
    `)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar movimentações financeiras:", JSON.stringify(error, null, 2));

    financialTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar movimentações financeiras.</td>
      </tr>
    `;

    allTransactions = [];
    return;
  }

  allTransactions = data || [];
}

async function loadReceivableTotal() {
  const { data, error } = await supabaseClient
    .from("accounts_receivable")
    .select("amount, status");

  if (error) {
    console.error("Erro ao buscar A Receber:", JSON.stringify(error, null, 2));
    receivableTotalText.textContent = formatCurrency(0);
    return;
  }

  const total = (data || [])
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  receivableTotalText.textContent = formatCurrency(total);
}

async function loadPayableTotal() {
  const { data, error } = await supabaseClient
    .from("accounts_payable")
    .select("amount, status");

  if (error) {
    console.error("Erro ao buscar A Pagar:", JSON.stringify(error, null, 2));
    payableTotalText.textContent = formatCurrency(0);
    return;
  }

  const total = (data || [])
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  payableTotalText.textContent = formatCurrency(total);
}

function applyPeriodFilter() {
  const { startDate, endDate } = getPeriodRange(selectedPeriod);

  filteredTransactions = allTransactions.filter((transaction) => {
    const date = transaction.transaction_date;

    return date >= startDate && date <= endDate;
  });
}

function renderFinancePage() {
  renderCards();
  renderFinancialTable();

  renderIncomeExpenseChart();
  renderPaymentMethodChart();
  renderExpenseCategoryChart();
  renderIncomeCategoryChart();
}

function renderCards() {
  const incomeTransactions = filteredTransactions.filter((item) => {
    return ["income", "cash_injection"].includes(item.type);
  });

  const expenseTransactions = filteredTransactions.filter((item) => {
    return ["expense", "withdrawal"].includes(item.type);
  });

  const incomeTotal = incomeTransactions.reduce((sum, item) => {
    return sum + Number(item.amount || 0);
  }, 0);

  const expenseTotal = expenseTransactions.reduce((sum, item) => {
    return sum + Number(item.amount || 0);
  }, 0);

  const profit = incomeTotal - expenseTotal;

  const averageTicket = incomeTransactions.length > 0
    ? incomeTotal / incomeTransactions.length
    : 0;

  incomeTotalText.textContent = formatCurrency(incomeTotal);
  expenseTotalText.textContent = formatCurrency(expenseTotal);
  profitTotalText.textContent = formatCurrency(profit);
  averageTicketText.textContent = formatCurrency(averageTicket);

  profitTotalText.classList.remove("success-text", "danger-text", "primary-text");

  if (profit >= 0) {
    profitTotalText.classList.add("success-text");
  } else {
    profitTotalText.classList.add("danger-text");
  }
}

function renderFinancialTable() {
  if (!filteredTransactions.length) {
    financialTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma movimentação encontrada no período.</td>
      </tr>
    `;

    return;
  }

  const ordered = [...filteredTransactions].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  financialTable.innerHTML = ordered.map((transaction) => {
    const isPositive = ["income", "cash_injection"].includes(transaction.type);

    return `
      <tr>
        <td>${formatDateToBR(transaction.transaction_date)}</td>

        <td>
          <span class="status-badge ${isPositive ? "status-paid" : "status-overdue"}">
            ${translateTransactionType(transaction.type)}
          </span>
        </td>

        <td>${transaction.description || "-"}</td>
        <td>${transaction.category || "-"}</td>
        <td>${transaction.patients?.full_name || "-"}</td>
        <td>${transaction.payment_method || "-"}</td>

        <td>
          <strong class="${isPositive ? "success-text" : "danger-text"}">
            ${isPositive ? "+" : "-"}${formatCurrency(transaction.amount || 0)}
          </strong>
        </td>
      </tr>
    `;
  }).join("");
}

/*
  GRÁFICO 1: ENTRADAS X SAÍDAS

  Agrupa por data no período.
*/
function renderIncomeExpenseChart() {
  const grouped = groupTransactionsByDate(filteredTransactions);

  const labels = Object.keys(grouped);

  const incomeData = labels.map((date) => grouped[date].income);
  const expenseData = labels.map((date) => grouped[date].expense);

  const ctx = document.querySelector("#incomeExpenseChart");

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
  }

  incomeExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map(formatShortDate),
      datasets: [
        {
          label: "Entradas",
          data: incomeData,
          backgroundColor: "#22c55e"
        },
        {
          label: "Saídas",
          data: expenseData,
          backgroundColor: "#ef4444"
        }
      ]
    },
    options: getDefaultChartOptions()
  });
}

/*
  GRÁFICO 2: FORMAS DE PAGAMENTO

  Considera apenas entradas.
*/
function renderPaymentMethodChart() {
  const incomeTransactions = filteredTransactions.filter((item) => {
    return ["income", "cash_injection"].includes(item.type);
  });

  const grouped = groupByField(incomeTransactions, "payment_method", "Não informado");

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#paymentMethodChart");

  if (paymentMethodChart) {
    paymentMethodChart.destroy();
  }

  paymentMethodChart = new Chart(ctx, {
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right"
        }
      }
    }
  });
}

/*
  GRÁFICO 3: DESPESAS POR CATEGORIA

  Considera apenas saídas.
*/
function renderExpenseCategoryChart() {
  const expenseTransactions = filteredTransactions.filter((item) => {
    return ["expense", "withdrawal"].includes(item.type);
  });

  const grouped = groupByField(expenseTransactions, "category", "Sem categoria");

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#expenseCategoryChart");

  if (expenseCategoryChart) {
    expenseCategoryChart.destroy();
  }

  expenseCategoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Despesas",
          data,
          backgroundColor: "#ef4444"
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
  GRÁFICO 4: RECEITAS POR CATEGORIA

  Considera apenas entradas.
*/
function renderIncomeCategoryChart() {
  const incomeTransactions = filteredTransactions.filter((item) => {
    return ["income", "cash_injection"].includes(item.type);
  });

  const grouped = groupByField(incomeTransactions, "category", "Sem categoria");

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const ctx = document.querySelector("#incomeCategoryChart");

  if (incomeCategoryChart) {
    incomeCategoryChart.destroy();
  }

  incomeCategoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Receitas",
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

function groupTransactionsByDate(transactions) {
  const grouped = {};

  transactions.forEach((transaction) => {
    const date = transaction.transaction_date;

    if (!grouped[date]) {
      grouped[date] = {
        income: 0,
        expense: 0
      };
    }

    if (["income", "cash_injection"].includes(transaction.type)) {
      grouped[date].income += Number(transaction.amount || 0);
    }

    if (["expense", "withdrawal"].includes(transaction.type)) {
      grouped[date].expense += Number(transaction.amount || 0);
    }
  });

  return grouped;
}

function groupByField(transactions, field, fallbackLabel) {
  const grouped = {};

  transactions.forEach((transaction) => {
    const label = transaction[field] || fallbackLabel;

    if (!grouped[label]) {
      grouped[label] = 0;
    }

    grouped[label] += Number(transaction.amount || 0);
  });

  return grouped;
}

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
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    }
  };
}

function translateTransactionType(type) {
  const map = {
    income: "Entrada",
    expense: "Saída",
    withdrawal: "Sangria",
    cash_injection: "Reforço"
  };

  return map[type] || type;
}

function formatDateToDatabase(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateToBR(date) {
  if (!date) return "-";

  const parts = date.split("-");

  if (parts.length !== 3) return date;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatShortDate(date) {
  if (!date) return "-";

  const parts = date.split("-");

  if (parts.length !== 3) return date;

  return `${parts[2]}/${parts[1]}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}