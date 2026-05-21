/*
  TELA ADMIN CAIXA

  Responsabilidades:
  1. Verificar login fake temporário
  2. Abrir caixa do dia
  3. Buscar movimentações do dia
  4. Calcular entradas, saídas, saldo esperado e diferença
  5. Registrar entrada, saída, sangria e reforço
  6. Fechar caixa
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const cashDateText = document.querySelector("#cashDateText");
const cashStatusBadge = document.querySelector("#cashStatusBadge");

const openCashButton = document.querySelector("#openCashButton");
const closeCashButton = document.querySelector("#closeCashButton");

const openingAmountText = document.querySelector("#openingAmountText");
const incomeAmountText = document.querySelector("#incomeAmountText");
const expenseAmountText = document.querySelector("#expenseAmountText");
const expectedAmountText = document.querySelector("#expectedAmountText");
const informedAmountText = document.querySelector("#informedAmountText");
const differenceAmountText = document.querySelector("#differenceAmountText");

const pixTotalText = document.querySelector("#pixTotalText");
const cashTotalText = document.querySelector("#cashTotalText");
const creditTotalText = document.querySelector("#creditTotalText");
const debitTotalText = document.querySelector("#debitTotalText");
const agreementTotalText = document.querySelector("#agreementTotalText");

const cashMovementsTable = document.querySelector("#cashMovementsTable");

const openCashModal = document.querySelector("#openCashModal");
const incomeModal = document.querySelector("#incomeModal");
const expenseModal = document.querySelector("#expenseModal");
const withdrawalModal = document.querySelector("#withdrawalModal");
const injectionModal = document.querySelector("#injectionModal");
const closeCashModal = document.querySelector("#closeCashModal");

const openCashForm = document.querySelector("#openCashForm");
const openingAmountInput = document.querySelector("#openingAmountInput");
const openCashNotesInput = document.querySelector("#openCashNotesInput");

const incomeForm = document.querySelector("#incomeForm");
const incomePatientInput = document.querySelector("#incomePatientInput");
const incomeDescriptionInput = document.querySelector("#incomeDescriptionInput");
const incomeAmountInput = document.querySelector("#incomeAmountInput");
const incomePaymentMethodInput = document.querySelector("#incomePaymentMethodInput");
const incomeNotesInput = document.querySelector("#incomeNotesInput");

const expenseForm = document.querySelector("#expenseForm");
const expenseDescriptionInput = document.querySelector("#expenseDescriptionInput");
const expenseCategoryInput = document.querySelector("#expenseCategoryInput");
const expenseAmountInput = document.querySelector("#expenseAmountInput");
const expensePaymentMethodInput = document.querySelector("#expensePaymentMethodInput");
const expenseNotesInput = document.querySelector("#expenseNotesInput");

const withdrawalForm = document.querySelector("#withdrawalForm");
const withdrawalAmountInput = document.querySelector("#withdrawalAmountInput");
const withdrawalNotesInput = document.querySelector("#withdrawalNotesInput");

const injectionForm = document.querySelector("#injectionForm");
const injectionAmountInput = document.querySelector("#injectionAmountInput");
const injectionNotesInput = document.querySelector("#injectionNotesInput");

const closeCashForm = document.querySelector("#closeCashForm");
const closeOpeningAmountText = document.querySelector("#closeOpeningAmountText");
const closeIncomeAmountText = document.querySelector("#closeIncomeAmountText");
const closeExpenseAmountText = document.querySelector("#closeExpenseAmountText");
const closeExpectedAmountText = document.querySelector("#closeExpectedAmountText");
const closeInformedAmountInput = document.querySelector("#closeInformedAmountInput");
const closeDifferencePreview = document.querySelector("#closeDifferencePreview");
const closeCashNotesInput = document.querySelector("#closeCashNotesInput");

const openIncomeModalButton = document.querySelector("#openIncomeModalButton");
const openExpenseModalButton = document.querySelector("#openExpenseModalButton");
const openWithdrawalModalButton = document.querySelector("#openWithdrawalModalButton");
const openInjectionModalButton = document.querySelector("#openInjectionModalButton");

let todayCashSession = null;
let todayTransactions = [];
let allPatients = [];

let cashSummary = {
  opening: 0,
  income: 0,
  expense: 0,
  expected: 0,
  informed: 0,
  difference: 0
};

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openCashButton.addEventListener("click", () => {
  openModal(openCashModal);
});

closeCashButton.addEventListener("click", () => {
  prepareCloseCashModal();
  openModal(closeCashModal);
});

openIncomeModalButton.addEventListener("click", () => {
  if (!canMoveCash()) return;
  incomeForm.reset();
  openModal(incomeModal);
});

openExpenseModalButton.addEventListener("click", () => {
  if (!canMoveCash()) return;
  expenseForm.reset();
  openModal(expenseModal);
});

openWithdrawalModalButton.addEventListener("click", () => {
  if (!canMoveCash()) return;
  withdrawalForm.reset();
  openModal(withdrawalModal);
});

openInjectionModalButton.addEventListener("click", () => {
  if (!canMoveCash()) return;
  injectionForm.reset();
  openModal(injectionModal);
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeAllModals);
});

document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeAllModals();
    }
  });
});

closeInformedAmountInput.addEventListener("input", updateCloseDifferencePreview);

openCashForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const openingAmount = Number(openingAmountInput.value || 0);

  const { error } = await supabaseClient
    .from("cash_sessions")
    .insert({
      session_date: getTodayDate(),
      opening_amount: openingAmount,
      expected_amount: openingAmount,
      status: "open",
      notes: openCashNotesInput.value.trim() || null
    });

  if (error) {
    console.error("Erro ao abrir caixa:", JSON.stringify(error, null, 2));
    alert("Erro ao abrir caixa. Veja o console.");
    return;
  }

  closeAllModals();
  await loadCashPage();
});

incomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const description = incomeDescriptionInput.value.trim();
  const amount = Number(incomeAmountInput.value || 0);

  if (!description || amount <= 0) {
    alert("Informe descrição e valor válido.");
    return;
  }

  await createTransaction({
    type: "income",
    description,
    category: "Recebimento",
    amount,
    payment_method: incomePaymentMethodInput.value,
    patient_id: incomePatientInput.value || null,
    notes: incomeNotesInput.value.trim() || null
  });

  closeAllModals();
  await loadCashPage();
});

expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const description = expenseDescriptionInput.value.trim();
  const amount = Number(expenseAmountInput.value || 0);

  if (!description || amount <= 0) {
    alert("Informe descrição e valor válido.");
    return;
  }

  await createTransaction({
    type: "expense",
    description,
    category: expenseCategoryInput.value,
    amount,
    payment_method: expensePaymentMethodInput.value,
    patient_id: null,
    notes: expenseNotesInput.value.trim() || null
  });

  closeAllModals();
  await loadCashPage();
});

withdrawalForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amount = Number(withdrawalAmountInput.value || 0);

  if (amount <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  await createTransaction({
    type: "withdrawal",
    description: "Sangria de caixa",
    category: "Sangria",
    amount,
    payment_method: "Dinheiro",
    patient_id: null,
    notes: withdrawalNotesInput.value.trim() || null
  });

  closeAllModals();
  await loadCashPage();
});

injectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amount = Number(injectionAmountInput.value || 0);

  if (amount <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  await createTransaction({
    type: "cash_injection",
    description: "Reforço de caixa",
    category: "Reforço",
    amount,
    payment_method: "Dinheiro",
    patient_id: null,
    notes: injectionNotesInput.value.trim() || null
  });

  closeAllModals();
  await loadCashPage();
});

closeCashForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!todayCashSession) {
    alert("Nenhum caixa aberto encontrado.");
    return;
  }

  const informedAmount = Number(closeInformedAmountInput.value || 0);
  const difference = informedAmount - cashSummary.expected;

  const { error } = await supabaseClient
    .from("cash_sessions")
    .update({
      expected_amount: cashSummary.expected,
      informed_amount: informedAmount,
      difference_amount: difference,
      status: "closed",
      closed_at: new Date().toISOString(),
      notes: closeCashNotesInput.value.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", todayCashSession.id);

  if (error) {
    console.error("Erro ao fechar caixa:", error);
    alert("Erro ao fechar caixa.");
    return;
  }

  closeAllModals();
  await loadCashPage();
});

loadCashPage();

async function loadCashPage() {
  cashDateText.textContent = formatLongDate(getTodayDate());

  await loadPatients();
  await loadCashSession();
  await loadTodayTransactions();

  calculateCashSummary();
  renderCashSummary();
  renderPaymentSummary();
  renderTransactions();
  updateCashStatusUI();
}

async function loadPatients() {
  const { data, error } = await supabaseClient
    .from("patients")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pacientes:", error);
    allPatients = [];
    return;
  }

  allPatients = data || [];

  incomePatientInput.innerHTML = `<option value="">Sem paciente</option>`;

  allPatients.forEach((patient) => {
    incomePatientInput.innerHTML += `
      <option value="${patient.id}">
        ${patient.full_name}
      </option>
    `;
  });
}

async function loadCashSession() {
  const { data, error } = await supabaseClient
    .from("cash_sessions")
    .select("*")
    .eq("session_date", getTodayDate())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar caixa do dia:", JSON.stringify(error, null, 2));
    todayCashSession = null;
    return;
  }

  todayCashSession = data && data.length > 0 ? data[0] : null;
}

async function loadTodayTransactions() {
  const { data, error } = await supabaseClient
    .from("financial_transactions")
    .select(`
      *,
      patients (*)
    `)
    .eq("transaction_date", getTodayDate())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar movimentações:", error);
    todayTransactions = [];
    return;
  }

  todayTransactions = data || [];
}

async function createTransaction(data) {
  const { error } = await supabaseClient
    .from("financial_transactions")
    .insert({
      ...data,
      transaction_date: getTodayDate()
    });

  if (error) {
    console.error("Erro ao registrar movimentação:", error);
    alert("Erro ao registrar movimentação.");
  }
}

function calculateCashSummary() {
  const opening = Number(todayCashSession?.opening_amount || 0);

  const income = todayTransactions
    .filter((item) => ["income", "cash_injection"].includes(item.type))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const expense = todayTransactions
    .filter((item) => ["expense", "withdrawal"].includes(item.type))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const expected = opening + income - expense;

  const informed = todayCashSession?.informed_amount !== null && todayCashSession?.informed_amount !== undefined
    ? Number(todayCashSession.informed_amount)
    : expected;

  const difference = todayCashSession?.difference_amount !== null && todayCashSession?.difference_amount !== undefined
    ? Number(todayCashSession.difference_amount)
    : informed - expected;

  cashSummary = {
    opening,
    income,
    expense,
    expected,
    informed,
    difference
  };
}

function renderCashSummary() {
  openingAmountText.textContent = formatCurrency(cashSummary.opening);
  incomeAmountText.textContent = formatCurrency(cashSummary.income);
  expenseAmountText.textContent = formatCurrency(cashSummary.expense);
  expectedAmountText.textContent = formatCurrency(cashSummary.expected);
  informedAmountText.textContent = todayCashSession?.status === "closed"
    ? formatCurrency(cashSummary.informed)
    : "-";
  differenceAmountText.textContent = todayCashSession?.status === "closed"
    ? formatSignedCurrency(cashSummary.difference)
    : "-";

  differenceAmountText.classList.remove("success-text", "danger-text");

  if (cashSummary.difference >= 0) {
    differenceAmountText.classList.add("success-text");
  } else {
    differenceAmountText.classList.add("danger-text");
  }
}

function renderPaymentSummary() {
  pixTotalText.textContent = formatCurrency(sumByPaymentMethod("Pix"));
  cashTotalText.textContent = formatCurrency(sumByPaymentMethod("Dinheiro"));
  creditTotalText.textContent = formatCurrency(sumByPaymentMethod("Cartão de crédito"));
  debitTotalText.textContent = formatCurrency(sumByPaymentMethod("Cartão de débito"));
  agreementTotalText.textContent = formatCurrency(sumByPaymentMethod("Convênio"));
}

function sumByPaymentMethod(method) {
  return todayTransactions
    .filter((item) => item.payment_method === method)
    .filter((item) => ["income", "cash_injection"].includes(item.type))
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

function renderTransactions() {
  if (!todayTransactions.length) {
    cashMovementsTable.innerHTML = `
      <tr>
        <td colspan="6">Nenhuma movimentação registrada hoje.</td>
      </tr>
    `;
    return;
  }

  cashMovementsTable.innerHTML = todayTransactions.map((item) => {
    const isPositive = ["income", "cash_injection"].includes(item.type);

    return `
      <tr>
        <td>${formatTime(item.created_at)}</td>
        <td>
          <span class="status-badge ${isPositive ? "status-paid" : "status-overdue"}">
            ${translateTransactionType(item.type)}
          </span>
        </td>
        <td>${item.description || "-"}</td>
        <td>${item.patients?.full_name || "-"}</td>
        <td>
          <strong class="${isPositive ? "success-text" : "danger-text"}">
            ${isPositive ? "+" : "-"}${formatCurrency(item.amount || 0)}
          </strong>
        </td>
        <td>${item.payment_method || "-"}</td>
      </tr>
    `;
  }).join("");
}

function updateCashStatusUI() {
  const isOpen = todayCashSession?.status === "open";
  const isClosed = todayCashSession?.status === "closed";
  const hasSession = Boolean(todayCashSession);

  if (!hasSession) {
    cashStatusBadge.textContent = "Caixa não aberto";
    cashStatusBadge.className = "cash-status-badge closed";

    openCashButton.style.display = "inline-flex";
    closeCashButton.style.display = "none";

    setCashActionButtons(false);
    return;
  }

  if (isOpen) {
    cashStatusBadge.textContent = "Caixa Aberto";
    cashStatusBadge.className = "cash-status-badge open";

    openCashButton.style.display = "none";
    closeCashButton.style.display = "inline-flex";

    setCashActionButtons(true);
    return;
  }

  if (isClosed) {
    cashStatusBadge.textContent = "Caixa Fechado";
    cashStatusBadge.className = "cash-status-badge closed";

    openCashButton.style.display = "none";
    closeCashButton.style.display = "none";

    setCashActionButtons(false);
  }
}

function setCashActionButtons(enabled) {
  openIncomeModalButton.disabled = !enabled;
  openExpenseModalButton.disabled = !enabled;
  openWithdrawalModalButton.disabled = !enabled;
  openInjectionModalButton.disabled = !enabled;
}

function canMoveCash() {
  if (!todayCashSession) {
    alert("Abra o caixa antes de registrar movimentações.");
    return false;
  }

  if (todayCashSession.status !== "open") {
    alert("O caixa já está fechado.");
    return false;
  }

  return true;
}

function prepareCloseCashModal() {
  closeOpeningAmountText.textContent = formatCurrency(cashSummary.opening);
  closeIncomeAmountText.textContent = formatCurrency(cashSummary.income);
  closeExpenseAmountText.textContent = formatCurrency(cashSummary.expense);
  closeExpectedAmountText.textContent = formatCurrency(cashSummary.expected);

  closeInformedAmountInput.value = cashSummary.expected.toFixed(2);
  closeCashNotesInput.value = "";

  updateCloseDifferencePreview();
}

function updateCloseDifferencePreview() {
  const informed = Number(closeInformedAmountInput.value || 0);
  const difference = informed - cashSummary.expected;

  closeDifferencePreview.querySelector("strong").textContent = formatSignedCurrency(difference);

  closeDifferencePreview.classList.remove("positive", "negative");

  if (difference >= 0) {
    closeDifferencePreview.classList.add("positive");
  } else {
    closeDifferencePreview.classList.add("negative");
  }
}

function openModal(modal) {
  modal.classList.add("active");
}

function closeAllModals() {
  document.querySelectorAll(".admin-modal-overlay").forEach((modal) => {
    modal.classList.remove("active");
  });
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

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(dateTime) {
  if (!dateTime) return "-";

  return new Date(dateTime).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLongDate(date) {
  const [year, month, day] = date.split("-");

  const formatted = new Date(Number(year), Number(month) - 1, Number(day));

  return formatted.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatSignedCurrency(value) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}
