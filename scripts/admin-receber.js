/*
  TELA ADMIN A RECEBER

  Responsabilidades:
  1. Buscar contas a receber
  2. Criar cobrança manual
  3. Editar cobrança
  4. Marcar como pago
  5. Ao marcar como pago, registrar entrada no financeiro
  6. Calcular cards: pendente, pago e vencido
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const openReceivableFormButton = document.querySelector("#openReceivableFormButton");
const receivableFormPanel = document.querySelector("#receivableFormPanel");
const cancelReceivableFormButton = document.querySelector("#cancelReceivableFormButton");

const receivableForm = document.querySelector("#receivableForm");
const editingReceivableIdInput = document.querySelector("#editingReceivableId");

const receivablePatientInput = document.querySelector("#receivablePatient");
const receivableDescriptionInput = document.querySelector("#receivableDescription");
const receivableAmountInput = document.querySelector("#receivableAmount");
const receivableDueDateInput = document.querySelector("#receivableDueDate");
const receivablePaymentMethodInput = document.querySelector("#receivablePaymentMethod");
const receivableStatusInput = document.querySelector("#receivableStatus");
const receivableNotesInput = document.querySelector("#receivableNotes");

const saveReceivableButton = document.querySelector("#saveReceivableButton");

const receivableSearchInput = document.querySelector("#receivableSearchInput");
const receivableStatusFilter = document.querySelector("#receivableStatusFilter");
const receivablesTable = document.querySelector("#receivablesTable");
const receivablesCount = document.querySelector("#receivablesCount");

const pendingReceivableTotal = document.querySelector("#pendingReceivableTotal");
const paidReceivableTotal = document.querySelector("#paidReceivableTotal");
const overdueReceivableTotal = document.querySelector("#overdueReceivableTotal");

let allPatients = [];
let allReceivables = [];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openReceivableFormButton.addEventListener("click", openCreateReceivableForm);
cancelReceivableFormButton.addEventListener("click", closeReceivableForm);

receivableSearchInput.addEventListener("input", applyFilters);
receivableStatusFilter.addEventListener("change", applyFilters);

receivableForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingReceivableId = editingReceivableIdInput.value;

  const patientId = receivablePatientInput.value || null;
  const description = receivableDescriptionInput.value.trim();
  const amount = Number(receivableAmountInput.value);
  const dueDate = receivableDueDateInput.value;
  const paymentMethod = receivablePaymentMethodInput.value || null;
  const status = receivableStatusInput.value;
  const notes = receivableNotesInput.value.trim();

  if (!description || !amount || !dueDate) {
    alert("Preencha descrição, valor e vencimento.");
    return;
  }

  if (amount <= 0) {
    alert("O valor precisa ser maior que zero.");
    return;
  }

  saveReceivableButton.textContent = editingReceivableId ? "Salvando alterações..." : "Salvando...";
  saveReceivableButton.disabled = true;

  const receivableData = {
    patient_id: patientId,
    description,
    amount,
    due_date: dueDate,
    payment_method: paymentMethod,
    status,
    notes: notes || null,
    updated_at: new Date().toISOString()
  };

  if (status === "paid") {
    receivableData.paid_at = new Date().toISOString();
  }

  let result;

  if (editingReceivableId) {
    result = await supabaseClient
      .from("accounts_receivable")
      .update(receivableData)
      .eq("id", editingReceivableId);
  } else {
    result = await supabaseClient
      .from("accounts_receivable")
      .insert(receivableData);
  }

  if (result.error) {
    console.error("Erro ao salvar cobrança:", result.error);
    alert("Erro ao salvar cobrança.");

    saveReceivableButton.textContent = editingReceivableId ? "Salvar alterações" : "Salvar cobrança";
    saveReceivableButton.disabled = false;

    return;
  }

  closeReceivableForm();
  await loadPageData();

  alert(editingReceivableId ? "Cobrança atualizada com sucesso!" : "Cobrança cadastrada com sucesso!");
});

loadPageData();

async function loadPageData() {
  await loadPatients();
  await loadReceivables();
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
  populatePatientSelect();
}

async function loadReceivables() {
  receivablesTable.innerHTML = `
    <tr>
      <td colspan="7">Carregando contas a receber...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("accounts_receivable")
    .select(`
      *,
      patients (*)
    `)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Erro ao buscar contas a receber:", error);

    receivablesTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar contas a receber.</td>
      </tr>
    `;

    return;
  }

  allReceivables = data || [];

  updateCards(allReceivables);
  renderReceivables(allReceivables);
}

function populatePatientSelect() {
  receivablePatientInput.innerHTML = `
    <option value="">Selecione o paciente</option>
  `;

  allPatients.forEach((patient) => {
    receivablePatientInput.innerHTML += `
      <option value="${patient.id}">
        ${patient.full_name}
      </option>
    `;
  });
}

function updateCards(receivables) {
  const today = getTodayDate();

  const pendingTotal = receivables
    .filter((item) => item.status === "pending")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const paidTotal = receivables
    .filter((item) => item.status === "paid")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const overdueTotal = receivables
    .filter((item) => item.status === "pending" && item.due_date < today)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  pendingReceivableTotal.textContent = formatCurrency(pendingTotal);
  paidReceivableTotal.textContent = formatCurrency(paidTotal);
  overdueReceivableTotal.textContent = formatCurrency(overdueTotal);
}

function applyFilters() {
  const searchTerm = receivableSearchInput.value.trim().toLowerCase();
  const selectedStatus = receivableStatusFilter.value;
  const today = getTodayDate();

  let filtered = [...allReceivables];

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
      const patient = item.patients?.full_name || "";
      const description = item.description || "";

      return (
        patient.toLowerCase().includes(searchTerm) ||
        description.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderReceivables(filtered);
}

function renderReceivables(receivables) {
  receivablesCount.textContent = `Mostrando ${receivables.length} de ${allReceivables.length} cobranças`;

  if (!receivables.length) {
    receivablesTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma cobrança encontrada.</td>
      </tr>
    `;
    return;
  }

  receivablesTable.innerHTML = receivables.map((item) => {
    const displayStatus = getReceivableDisplayStatus(item);
    const statusClass = getReceivableStatusClass(displayStatus);

    const canMarkPaid = item.status !== "paid" && item.status !== "cancelled";

    return `
      <tr>
        <td>${item.description || "-"}</td>
        <td>${item.patients?.full_name || "-"}</td>
        <td><strong>${formatCurrency(item.amount || 0)}</strong></td>
        <td>${formatDateToBR(item.due_date)}</td>
        <td>${item.payment_method || "-"}</td>
        <td>
          <span class="status-badge ${statusClass}">
            ${translateReceivableStatus(displayStatus)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button 
              class="admin-icon-btn" 
              type="button"
              title="Editar cobrança"
              onclick="editReceivable('${item.id}')"
            >
              ✎
            </button>

            <button 
              class="admin-status-action success"
              type="button"
              title="Marcar como pago"
              onclick="markReceivableAsPaid('${item.id}')"
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

function openCreateReceivableForm() {
  receivableForm.reset();
  editingReceivableIdInput.value = "";
  receivableDueDateInput.value = getTodayDate();
  receivableStatusInput.value = "pending";

  saveReceivableButton.textContent = "Salvar cobrança";

  receivableFormPanel.style.display = "block";
  openReceivableFormButton.style.display = "none";
}

function editReceivable(receivableId) {
  const receivable = allReceivables.find((item) => item.id === receivableId);

  if (!receivable) {
    alert("Cobrança não encontrada.");
    return;
  }

  editingReceivableIdInput.value = receivable.id;
  receivablePatientInput.value = receivable.patient_id || "";
  receivableDescriptionInput.value = receivable.description || "";
  receivableAmountInput.value = receivable.amount || "";
  receivableDueDateInput.value = receivable.due_date || getTodayDate();
  receivablePaymentMethodInput.value = receivable.payment_method || "";
  receivableStatusInput.value = receivable.status || "pending";
  receivableNotesInput.value = receivable.notes || "";

  saveReceivableButton.textContent = "Salvar alterações";

  receivableFormPanel.style.display = "block";
  openReceivableFormButton.style.display = "none";

  receivableFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeReceivableForm() {
  receivableForm.reset();
  editingReceivableIdInput.value = "";

  saveReceivableButton.textContent = "Salvar cobrança";
  saveReceivableButton.disabled = false;

  receivableFormPanel.style.display = "none";
  openReceivableFormButton.style.display = "inline-flex";
}

async function markReceivableAsPaid(receivableId) {
  const receivable = allReceivables.find((item) => item.id === receivableId);

  if (!receivable) {
    alert("Cobrança não encontrada.");
    return;
  }

  const confirmAction = confirm("Deseja marcar esta cobrança como paga?");

  if (!confirmAction) {
    return;
  }

  const paidAt = new Date().toISOString();

  const { error } = await supabaseClient
    .from("accounts_receivable")
    .update({
      status: "paid",
      paid_at: paidAt,
      updated_at: paidAt
    })
    .eq("id", receivableId);

  if (error) {
    console.error("Erro ao marcar como pago:", error);
    alert("Erro ao marcar cobrança como paga.");
    return;
  }

  await createFinancialIncome(receivable);

  await loadReceivables();

  alert("Cobrança marcada como paga e entrada registrada no financeiro.");
}

async function createFinancialIncome(receivable) {
  const { error } = await supabaseClient
    .from("financial_transactions")
    .insert({
      type: "income",
      description: receivable.description,
      category: "Recebimento",
      amount: receivable.amount,
      payment_method: receivable.payment_method || "Não informado",
      patient_id: receivable.patient_id || null,
      transaction_date: getTodayDate(),
      notes: "Entrada gerada automaticamente por conta a receber paga."
    });

  if (error) {
    console.error("Erro ao registrar entrada financeira:", error);
  }
}

function getReceivableDisplayStatus(item) {
  const today = getTodayDate();

  if (item.status === "pending" && item.due_date < today) {
    return "overdue";
  }

  return item.status;
}

function getReceivableStatusClass(status) {
  const statusMap = {
    pending: "status-pending",
    paid: "status-paid",
    overdue: "status-overdue",
    cancelled: "status-neutral"
  };

  return statusMap[status] || "status-neutral";
}

function translateReceivableStatus(status) {
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