const logoutButton = document.querySelector("#logoutButton");
const reloadButton = document.querySelector("#reloadButton");
const openCashPanel = document.querySelector("#openCashPanel");
const cashActionsPanel = document.querySelector("#cashActionsPanel");
const closeCashPanel = document.querySelector("#closeCashPanel");
const openCashForm = document.querySelector("#openCashForm");
const cashMovementForm = document.querySelector("#cashMovementForm");
const closeCashForm = document.querySelector("#closeCashForm");
const openingAmountInput = document.querySelector("#openingAmountInput");
const openingNotesInput = document.querySelector("#openingNotesInput");
const movementType = document.querySelector("#movementType");
const movementAmount = document.querySelector("#movementAmount");
const movementDescription = document.querySelector("#movementDescription");
const closingAmountInput = document.querySelector("#closingAmountInput");
const closingNotesInput = document.querySelector("#closingNotesInput");
const cashStatus = document.querySelector("#cashStatus");
const openingAmount = document.querySelector("#openingAmount");
const dayIncome = document.querySelector("#dayIncome");
const dayExpense = document.querySelector("#dayExpense");
const expectedAmount = document.querySelector("#expectedAmount");
const cashTransactionsTable = document.querySelector("#cashTransactionsTable");

let todayTransactions = [];

protectAdminPage();
setupLogout();
loadCash();

reloadButton.addEventListener("click", loadCash);

openCashForm.addEventListener("submit", (event) => {
  event.preventDefault();
  openCash();
});

cashMovementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveCashMovement();
});

closeCashForm.addEventListener("submit", (event) => {
  event.preventDefault();
  closeCash();
});

function protectAdminPage() {
  const isLogged = localStorage.getItem("odontoflow_admin_logged") === "true";

  if (!isLogged) {
    window.location.href = "./admin-login.html";
  }
}

function setupLogout() {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("odontoflow_admin_logged");
    window.location.href = "./admin-login.html";
  });
}

async function loadCash() {
  await loadTodayTransactions();
  updateCashView();
}

function openCash() {
  const amount = Number(openingAmountInput.value);

  if (Number.isNaN(amount) || amount < 0) {
    alert("Informe um saldo inicial válido.");
    return;
  }

  const session = {
    status: "open",
    openingAmount: amount,
    openingNotes: openingNotesInput.value.trim(),
    openedAt: new Date().toISOString(),
    closedAt: null,
    closingAmount: null,
    closingNotes: ""
  };

  saveCashSession(session);
  openCashForm.reset();
  updateCashView();
}

async function saveCashMovement() {
  const amount = Number(movementAmount.value);
  const description = movementDescription.value.trim();

  if (Number.isNaN(amount) || amount <= 0 || !description) {
    alert("Informe valor e descrição da movimentação.");
    return;
  }

  const type = movementType.value;
  const isIncome = type === "income";
  const transactionData = {
    type,
    description,
    category: isIncome ? "Reforço de caixa" : "Sangria",
    amount,
    payment_method: "Dinheiro",
    transaction_date: getTodayDate(),
    notes: "Movimentação registrada no caixa do dia"
  };

  const { error } = await supabaseClient
    .from("financial_transactions")
    .insert(transactionData);

  if (error) {
    console.error("Erro ao registrar movimentação:", error);
    alert("Erro ao registrar movimentação.");
    return;
  }

  cashMovementForm.reset();
  await loadCash();
}

function closeCash() {
  const session = getCashSession();
  const closingAmount = Number(closingAmountInput.value);

  if (!session || session.status !== "open") {
    alert("Abra o caixa antes de fechar.");
    return;
  }

  if (Number.isNaN(closingAmount) || closingAmount < 0) {
    alert("Informe um saldo real válido.");
    return;
  }

  const updatedSession = {
    ...session,
    status: "closed",
    closingAmount,
    closingNotes: closingNotesInput.value.trim(),
    closedAt: new Date().toISOString()
  };

  saveCashSession(updatedSession);
  closeCashForm.reset();
  updateCashView();
}

async function loadTodayTransactions() {
  cashTransactionsTable.innerHTML = `
    <tr>
      <td colspan="6">Carregando movimentações...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("financial_transactions")
    .select("*")
    .eq("transaction_date", getTodayDate())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar movimentações do caixa:", error);
    cashTransactionsTable.innerHTML = `
      <tr>
        <td colspan="6">Erro ao carregar movimentações.</td>
      </tr>
    `;
    return;
  }

  todayTransactions = data || [];
  renderTransactions();
}

function updateCashView() {
  const session = getCashSession();
  const isOpen = session?.status === "open";
  const isClosed = session?.status === "closed";
  const opening = Number(session?.openingAmount || 0);
  const income = getTotalByType("income");
  const expense = getTotalByType("expense");
  const expected = opening + income - expense;

  cashStatus.textContent = isOpen ? "Aberto" : "Fechado";
  cashStatus.classList.toggle("cash-status-open", isOpen);
  cashStatus.classList.toggle("cash-status-closed", !isOpen);

  openingAmount.textContent = formatCurrency(opening);
  dayIncome.textContent = formatCurrency(income);
  dayExpense.textContent = formatCurrency(expense);
  expectedAmount.textContent = formatCurrency(expected);

  openCashPanel.classList.toggle("hidden-panel", isOpen || isClosed);
  cashActionsPanel.classList.toggle("hidden-panel", !isOpen);
  closeCashPanel.classList.toggle("hidden-panel", !isOpen);
}

function renderTransactions() {
  if (todayTransactions.length === 0) {
    cashTransactionsTable.innerHTML = `
      <tr>
        <td colspan="6">Nenhuma movimentação encontrada hoje.</td>
      </tr>
    `;
    return;
  }

  cashTransactionsTable.innerHTML = todayTransactions
    .map((transaction) => {
      const isIncome = transaction.type === "income";
      const typeLabel = isIncome ? "Entrada" : "Saída";
      const typeClass = isIncome ? "finance-type-income" : "finance-type-expense";
      const valueClass = isIncome ? "finance-value-income" : "finance-value-expense";
      const valuePrefix = isIncome ? "+" : "-";

      return `
        <tr>
          <td>
            <span class="status-badge ${typeClass}">
              ${typeLabel}
            </span>
          </td>
          <td>${transaction.description || "-"}</td>
          <td>${transaction.category || "-"}</td>
          <td class="${valueClass}">
            ${valuePrefix} ${formatCurrency(transaction.amount || 0)}
          </td>
          <td>${transaction.payment_method || "-"}</td>
          <td>${transaction.notes || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function getTotalByType(type) {
  return todayTransactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
}

function getCashSession() {
  const data = localStorage.getItem(getCashSessionKey());

  return data ? JSON.parse(data) : null;
}

function saveCashSession(session) {
  localStorage.setItem(getCashSessionKey(), JSON.stringify(session));
}

function getCashSessionKey() {
  return `odontoflow_cash_session_${getTodayDate()}`;
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
