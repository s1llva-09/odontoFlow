/*
  TELA ADMIN A PAGAR

  Responsabilidades:
  1. Buscar contas a pagar
  2. Criar despesa manual
  3. Editar despesa
  4. Marcar como paga
  5. Ao marcar como paga, registrar saída no financeiro
  6. Calcular cards: pendente, pago e vencido
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const openPayableFormButton = document.querySelector("#openPayableFormButton");
const payableFormPanel = document.querySelector("#payableFormPanel");
const cancelPayableFormButton = document.querySelector("#cancelPayableFormButton");

const payableForm = document.querySelector("#payableForm");
const editingPayableIdInput = document.querySelector("#editingPayableId");

const payableDescriptionInput = document.querySelector("#payableDescription");
const payableSupplierInput = document.querySelector("#payableSupplier");
const payableCategoryInput = document.querySelector("#payableCategory");
const payableAmountInput = document.querySelector("#payableAmount");
const payableDueDateInput = document.querySelector("#payableDueDate");
const payablePaymentMethodInput = document.querySelector("#payablePaymentMethod");
const payableStatusInput = document.querySelector("#payableStatus");
const payableNotesInput = document.querySelector("#payableNotes");

const savePayableButton = document.querySelector("#savePayableButton");

const payableSearchInput = document.querySelector("#payableSearchInput");
const payableStatusFilter = document.querySelector("#payableStatusFilter");
const payablesTable = document.querySelector("#payablesTable");
const payablesCount = document.querySelector("#payablesCount");

const pendingPayableTotal = document.querySelector("#pendingPayableTotal");
const paidPayableTotal = document.querySelector("#paidPayableTotal");
const overduePayableTotal = document.querySelector("#overduePayableTotal");

let allPayables = [];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openPayableFormButton.addEventListener("click", openCreatePayableForm);
cancelPayableFormButton.addEventListener("click", closePayableForm);

payableSearchInput.addEventListener("input", applyFilters);
payableStatusFilter.addEventListener("change", applyFilters);

payableForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingPayableId = editingPayableIdInput.value;

  const description = payableDescriptionInput.value.trim();
  const supplier = payableSupplierInput.value.trim();
  const category = payableCategoryInput.value;
  const amount = Number(payableAmountInput.value);
  const dueDate = payableDueDateInput.value;
  const paymentMethod = payablePaymentMethodInput.value || null;
  const status = payableStatusInput.value;
  const notes = payableNotesInput.value.trim();

  if (!description || !amount || !dueDate) {
    alert("Preencha descrição, valor e vencimento.");
    return;
  }

  if (amount <= 0) {
    alert("O valor precisa ser maior que zero.");
    return;
  }

  savePayableButton.textContent = editingPayableId ? "Salvando alterações..." : "Salvando...";
  savePayableButton.disabled = true;

  const payableData = {
    description,
    supplier: supplier || null,
    category: category || null,
    amount,
    due_date: dueDate,
    payment_method: paymentMethod,
    status,
    notes: notes || null,
    updated_at: new Date().toISOString()
  };

  if (status === "paid") {
    payableData.paid_at = new Date().toISOString();
  }

  let result;

  if (editingPayableId) {
    result = await supabaseClient
      .from("accounts_payable")
      .update(payableData)
      .eq("id", editingPayableId);
  } else {
    result = await supabaseClient
      .from("accounts_payable")
      .insert(payableData);
  }

  if (result.error) {
    console.error("Erro ao salvar despesa:", result.error);
    alert("Erro ao salvar despesa.");

    savePayableButton.textContent = editingPayableId ? "Salvar alterações" : "Salvar despesa";
    savePayableButton.disabled = false;

    return;
  }

  closePayableForm();
  await loadPayables();

  alert(editingPayableId ? "Despesa atualizada com sucesso!" : "Despesa cadastrada com sucesso!");
});

loadPayables();

async function loadPayables() {
  payablesTable.innerHTML = `
    <tr>
      <td colspan="8">Carregando contas a pagar...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("accounts_payable")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Erro ao buscar contas a pagar:", error);

    payablesTable.innerHTML = `
      <tr>
        <td colspan="8">Erro ao carregar contas a pagar.</td>
      </tr>
    `;

    return;
  }

  allPayables = data || [];

  updateCards(allPayables);
  renderPayables(allPayables);
}

function updateCards(payables) {
  const today = getTodayDate();

  const pendingTotal = payables
    .filter((item) => item.status === "pending")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const paidTotal = payables
    .filter((item) => item.status === "paid")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const overdueTotal = payables
    .filter((item) => item.status === "pending" && item.due_date < today)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  pendingPayableTotal.textContent = formatCurrency(pendingTotal);
  paidPayableTotal.textContent = formatCurrency(paidTotal);
  overduePayableTotal.textContent = formatCurrency(overdueTotal);
}

function applyFilters() {
  const searchTerm = payableSearchInput.value.trim().toLowerCase();
  const selectedStatus = payableStatusFilter.value;
  const today = getTodayDate();

  let filtered = [...allPayables];

  if (selectedStatus !== "all") {
    if (selectedStatus === "overdue") {
      filtered = filtered.filter((item) => {
        return item.status === "pending" && item.due_date < today;
      });
    } else {
      filtered = filtered.filter((item) => {
        return item.status === selectedStatus;
      });
    }
  }

  if (searchTerm) {
    filtered = filtered.filter((item) => {
      const description = item.description || "";
      const supplier = item.supplier || "";
      const category = item.category || "";

      return (
        description.toLowerCase().includes(searchTerm) ||
        supplier.toLowerCase().includes(searchTerm) ||
        category.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderPayables(filtered);
}

function renderPayables(payables) {
  payablesCount.textContent = `Mostrando ${payables.length} de ${allPayables.length} despesas`;

  if (!payables.length) {
    payablesTable.innerHTML = `
      <tr>
        <td colspan="8">Nenhuma despesa encontrada.</td>
      </tr>
    `;
    return;
  }

  payablesTable.innerHTML = payables.map((item) => {
    const displayStatus = getPayableDisplayStatus(item);
    const statusClass = getPayableStatusClass(displayStatus);
    const canMarkPaid = item.status !== "paid" && item.status !== "cancelled";

    return `
      <tr>
        <td>${item.description || "-"}</td>
        <td>${item.supplier || "-"}</td>
        <td>${item.category || "-"}</td>
        <td><strong>${formatCurrency(item.amount || 0)}</strong></td>
        <td>${formatDateToBR(item.due_date)}</td>
        <td>${item.payment_method || "-"}</td>
        <td>
          <span class="status-badge ${statusClass}">
            ${translatePayableStatus(displayStatus)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button 
              class="admin-icon-btn" 
              type="button"
              title="Editar despesa"
              onclick="editPayable('${item.id}')"
            >
              ✎
            </button>

            <button 
              class="admin-status-action success"
              type="button"
              title="Marcar como pago"
              onclick="markPayableAsPaid('${item.id}')"
              ${canMarkPaid ? "" : "disabled"}
            >
              Pago
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCreatePayableForm() {
  payableForm.reset();
  editingPayableIdInput.value = "";
  payableDueDateInput.value = getTodayDate();
  payableStatusInput.value = "pending";

  savePayableButton.textContent = "Salvar despesa";

  payableFormPanel.style.display = "block";
  openPayableFormButton.style.display = "none";
}

function editPayable(payableId) {
  const payable = allPayables.find((item) => item.id === payableId);

  if (!payable) {
    alert("Despesa não encontrada.");
    return;
  }

  editingPayableIdInput.value = payable.id;
  payableDescriptionInput.value = payable.description || "";
  payableSupplierInput.value = payable.supplier || "";
  payableCategoryInput.value = payable.category || "Outros";
  payableAmountInput.value = payable.amount || "";
  payableDueDateInput.value = payable.due_date || getTodayDate();
  payablePaymentMethodInput.value = payable.payment_method || "";
  payableStatusInput.value = payable.status || "pending";
  payableNotesInput.value = payable.notes || "";

  savePayableButton.textContent = "Salvar alterações";

  payableFormPanel.style.display = "block";
  openPayableFormButton.style.display = "none";

  payableFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closePayableForm() {
  payableForm.reset();
  editingPayableIdInput.value = "";

  savePayableButton.textContent = "Salvar despesa";
  savePayableButton.disabled = false;

  payableFormPanel.style.display = "none";
  openPayableFormButton.style.display = "inline-flex";
}

async function markPayableAsPaid(payableId) {
  const payable = allPayables.find((item) => item.id === payableId);

  if (!payable) {
    alert("Despesa não encontrada.");
    return;
  }

  const confirmAction = confirm("Deseja marcar esta despesa como paga?");

  if (!confirmAction) {
    return;
  }

  const paidAt = new Date().toISOString();

  const { error } = await supabaseClient
    .from("accounts_payable")
    .update({
      status: "paid",
      paid_at: paidAt,
      updated_at: paidAt
    })
    .eq("id", payableId);

  if (error) {
    console.error("Erro ao marcar como pago:", error);
    alert("Erro ao marcar despesa como paga.");
    return;
  }

  await createFinancialExpense(payable);

  await loadPayables();

  alert("Despesa marcada como paga e saída registrada no financeiro.");
}

async function createFinancialExpense(payable) {
  const { error } = await supabaseClient
    .from("financial_transactions")
    .insert({
      type: "expense",
      description: payable.description,
      category: payable.category || "Despesa",
      amount: payable.amount,
      payment_method: payable.payment_method || "Não informado",
      transaction_date: getTodayDate(),
      notes: "Saída gerada automaticamente por conta a pagar paga."
    });

  if (error) {
    console.error("Erro ao registrar saída financeira:", error);
  }
}

function getPayableDisplayStatus(item) {
  const today = getTodayDate();

  if (item.status === "pending" && item.due_date < today) {
    return "overdue";
  }

  return item.status;
}

function getPayableStatusClass(status) {
  const statusMap = {
    pending: "status-pending",
    paid: "status-paid",
    overdue: "status-overdue",
    cancelled: "status-neutral"
  };

  return statusMap[status] || "status-neutral";
}

function translatePayableStatus(status) {
  const statusMap = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Vencido",
    cancelled: "Cancelado"
  };

  return statusMap[status] || status;
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function formatDateToBR(date) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}