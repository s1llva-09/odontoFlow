/*
  TELA ADMIN DE ORÇAMENTOS

  Responsabilidades:
  1. Buscar pacientes, dentistas, procedimentos e orçamentos
  2. Criar orçamento com vários itens
  3. Editar orçamento
  4. Calcular subtotal, desconto e total
  5. Visualizar orçamento em modal
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const openBudgetFormButton = document.querySelector("#openBudgetFormButton");
const budgetFormPanel = document.querySelector("#budgetFormPanel");
const cancelBudgetFormButton = document.querySelector("#cancelBudgetFormButton");
const budgetFormTitle = document.querySelector("#budgetFormTitle");

const budgetForm = document.querySelector("#budgetForm");
const editingBudgetIdInput = document.querySelector("#editingBudgetId");

const budgetPatientInput = document.querySelector("#budgetPatient");
const budgetDentistInput = document.querySelector("#budgetDentist");
const budgetStatusInput = document.querySelector("#budgetStatus");
const budgetPaymentConditionInput = document.querySelector("#budgetPaymentCondition");
const budgetDiscountInput = document.querySelector("#budgetDiscount");
const budgetNotesInput = document.querySelector("#budgetNotes");

const addBudgetItemButton = document.querySelector("#addBudgetItemButton");
const budgetItemsContainer = document.querySelector("#budgetItemsContainer");

const budgetSubtotalText = document.querySelector("#budgetSubtotalText");
const budgetDiscountText = document.querySelector("#budgetDiscountText");
const budgetTotalText = document.querySelector("#budgetTotalText");

const saveBudgetButton = document.querySelector("#saveBudgetButton");

const budgetSearchInput = document.querySelector("#budgetSearchInput");
const budgetStatusFilter = document.querySelector("#budgetStatusFilter");
const budgetsTable = document.querySelector("#budgetsTable");
const budgetsCount = document.querySelector("#budgetsCount");

const budgetModal = document.querySelector("#budgetModal");
const closeBudgetModal = document.querySelector("#closeBudgetModal");
const closeBudgetModalFooter = document.querySelector("#closeBudgetModalFooter");

const modalBudgetTitle = document.querySelector("#modalBudgetTitle");
const modalBudgetSubtitle = document.querySelector("#modalBudgetSubtitle");
const modalBudgetPatient = document.querySelector("#modalBudgetPatient");
const modalBudgetDentist = document.querySelector("#modalBudgetDentist");
const modalBudgetStatus = document.querySelector("#modalBudgetStatus");
const modalBudgetPayment = document.querySelector("#modalBudgetPayment");
const modalBudgetItemsTable = document.querySelector("#modalBudgetItemsTable");
const modalBudgetSubtotal = document.querySelector("#modalBudgetSubtotal");
const modalBudgetDiscount = document.querySelector("#modalBudgetDiscount");
const modalBudgetTotal = document.querySelector("#modalBudgetTotal");
const modalBudgetNotes = document.querySelector("#modalBudgetNotes");

let allPatients = [];
let allDentists = [];
let allProcedures = [];
let allBudgets = [];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openBudgetFormButton.addEventListener("click", openCreateBudgetForm);
cancelBudgetFormButton.addEventListener("click", closeBudgetForm);

addBudgetItemButton.addEventListener("click", () => {
  addBudgetItemRow();
});

budgetDiscountInput.addEventListener("input", updateBudgetTotals);
budgetSearchInput.addEventListener("input", applyFilters);
budgetStatusFilter.addEventListener("change", applyFilters);

closeBudgetModal.addEventListener("click", closeModal);
closeBudgetModalFooter.addEventListener("click", closeModal);

budgetModal.addEventListener("click", (event) => {
  if (event.target === budgetModal) {
    closeModal();
  }
});

budgetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingBudgetId = editingBudgetIdInput.value;

  const patientId = budgetPatientInput.value;
  const dentistId = budgetDentistInput.value || null;
  const status = budgetStatusInput.value;
  const paymentCondition = budgetPaymentConditionInput.value.trim();
  const discount = Number(budgetDiscountInput.value || 0);
  const notes = budgetNotesInput.value.trim();

  if (!patientId) {
    alert("Selecione o paciente.");
    return;
  }

  const items = getBudgetItemsFromForm();

  if (!items.length) {
    alert("Adicione pelo menos um procedimento ao orçamento.");
    return;
  }

  const subtotal = items.reduce((total, item) => {
    return total + item.total_price;
  }, 0);

  const total = Math.max(subtotal - discount, 0);

  saveBudgetButton.textContent = editingBudgetId ? "Salvando alterações..." : "Salvando...";
  saveBudgetButton.disabled = true;

  const budgetData = {
    patient_id: patientId,
    dentist_id: dentistId,
    subtotal,
    discount,
    total,
    payment_condition: paymentCondition || null,
    notes: notes || null,
    status,
    updated_at: new Date().toISOString()
  };

  let budgetId = editingBudgetId;

  if (editingBudgetId) {
    const { error } = await supabaseClient
      .from("budgets")
      .update(budgetData)
      .eq("id", editingBudgetId);

    if (error) {
      handleSaveError(error);
      return;
    }

    const { error: deleteItemsError } = await supabaseClient
      .from("budget_items")
      .delete()
      .eq("budget_id", editingBudgetId);

    if (deleteItemsError) {
      handleSaveError(deleteItemsError);
      return;
    }
  } else {
    const { data, error } = await supabaseClient
      .from("budgets")
      .insert({
        ...budgetData,
        budget_code: generateBudgetCode()
      })
      .select()
      .single();

    if (error) {
      handleSaveError(error);
      return;
    }

    budgetId = data.id;
  }

  const itemsToInsert = items.map((item) => {
    return {
      ...item,
      budget_id: budgetId
    };
  });

  const { error: itemsError } = await supabaseClient
    .from("budget_items")
    .insert(itemsToInsert);

  if (itemsError) {
    handleSaveError(itemsError);
    return;
  }

  /*
    Se o orçamento estiver aprovado, criamos/atualizamos uma conta a receber.
  */
  if (status === "approved") {
    await createOrUpdateReceivableFromBudget({
      budgetId,
      patientId,
      total,
      paymentCondition
    });
  }

  closeBudgetForm();
  await loadPageData();

  alert(editingBudgetId ? "Orçamento atualizado com sucesso!" : "Orçamento criado com sucesso!");
});

loadPageData();

async function loadPageData() {
  await Promise.all([
    loadPatients(),
    loadDentists(),
    loadProcedures()
  ]);

  await loadBudgets();
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

async function loadDentists() {
  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar dentistas:", error);
    allDentists = [];
    return;
  }

  allDentists = data || [];
  populateDentistSelect();
}

async function loadProcedures() {
  const { data, error } = await supabaseClient
    .from("procedures")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar procedimentos:", error);
    allProcedures = [];
    return;
  }

  allProcedures = data || [];
}

async function loadBudgets() {
  budgetsTable.innerHTML = `
    <tr>
      <td colspan="8">Carregando orçamentos...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("budgets")
    .select(`
      *,
      patients (*),
      dentists (*),
      budget_items (*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar orçamentos:", error);

    budgetsTable.innerHTML = `
      <tr>
        <td colspan="8">Erro ao carregar orçamentos.</td>
      </tr>
    `;

    return;
  }

  allBudgets = data || [];
  renderBudgets(allBudgets);
}

function populatePatientSelect() {
  budgetPatientInput.innerHTML = `<option value="">Selecione o paciente</option>`;

  allPatients.forEach((patient) => {
    budgetPatientInput.innerHTML += `
      <option value="${patient.id}">
        ${patient.full_name}
      </option>
    `;
  });
}

function populateDentistSelect() {
  budgetDentistInput.innerHTML = `<option value="">Selecione o dentista</option>`;

  allDentists.forEach((dentist) => {
    budgetDentistInput.innerHTML += `
      <option value="${dentist.id}">
        ${dentist.name}
      </option>
    `;
  });
}

function addBudgetItemRow(item = null) {
  const rowId = crypto.randomUUID();

  const selectedProcedureId = item?.procedure_id || "";
  const quantity = item?.quantity || 1;
  const unitPrice = item?.unit_price || 0;

  const options = allProcedures.map((procedure) => {
    const selected = procedure.id === selectedProcedureId ? "selected" : "";

    return `
      <option 
        value="${procedure.id}" 
        data-name="${procedure.name}" 
        data-price="${procedure.price}"
        ${selected}
      >
        ${procedure.name} - ${formatCurrency(procedure.price)}
      </option>
    `;
  }).join("");

  const row = document.createElement("div");
  row.className = "budget-item-row";
  row.dataset.rowId = rowId;

  row.innerHTML = `
    <select class="budget-item-procedure">
      <option value="">Selecione o procedimento</option>
      ${options}
    </select>

    <input 
      type="number" 
      class="budget-item-quantity" 
      min="1" 
      value="${quantity}"
    />

    <input 
      type="number" 
      class="budget-item-price" 
      min="0" 
      step="0.01" 
      value="${unitPrice}"
    />

    <strong class="budget-item-total">
      ${formatCurrency(quantity * unitPrice)}
    </strong>

    <button type="button" class="admin-danger-btn budget-item-remove">
      ×
    </button>
  `;

  const procedureSelect = row.querySelector(".budget-item-procedure");
  const quantityInput = row.querySelector(".budget-item-quantity");
  const priceInput = row.querySelector(".budget-item-price");
  const removeButton = row.querySelector(".budget-item-remove");

  procedureSelect.addEventListener("change", () => {
    const selectedOption = procedureSelect.options[procedureSelect.selectedIndex];
    const price = Number(selectedOption.dataset.price || 0);

    priceInput.value = price;

    updateBudgetTotals();
  });

  quantityInput.addEventListener("input", updateBudgetTotals);
  priceInput.addEventListener("input", updateBudgetTotals);

  removeButton.addEventListener("click", () => {
    row.remove();
    updateBudgetTotals();
  });

  budgetItemsContainer.appendChild(row);

  updateBudgetTotals();
}

function getBudgetItemsFromForm() {
  const rows = document.querySelectorAll(".budget-item-row");
  const items = [];

  rows.forEach((row) => {
    const procedureSelect = row.querySelector(".budget-item-procedure");
    const quantityInput = row.querySelector(".budget-item-quantity");
    const priceInput = row.querySelector(".budget-item-price");

    const selectedOption = procedureSelect.options[procedureSelect.selectedIndex];

    const procedureId = procedureSelect.value;
    const procedureName = selectedOption?.dataset.name || selectedOption?.textContent || "";
    const quantity = Number(quantityInput.value || 1);
    const unitPrice = Number(priceInput.value || 0);
    const totalPrice = quantity * unitPrice;

    if (procedureId && quantity > 0) {
      items.push({
        procedure_id: procedureId,
        procedure_name: procedureName.trim(),
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      });
    }
  });

  return items;
}

function updateBudgetTotals() {
  const rows = document.querySelectorAll(".budget-item-row");

  let subtotal = 0;

  rows.forEach((row) => {
    const quantity = Number(row.querySelector(".budget-item-quantity").value || 1);
    const price = Number(row.querySelector(".budget-item-price").value || 0);
    const total = quantity * price;

    row.querySelector(".budget-item-total").textContent = formatCurrency(total);

    subtotal += total;
  });

  const discount = Number(budgetDiscountInput.value || 0);
  const total = Math.max(subtotal - discount, 0);

  budgetSubtotalText.textContent = formatCurrency(subtotal);
  budgetDiscountText.textContent = formatCurrency(discount);
  budgetTotalText.textContent = formatCurrency(total);
}

function applyFilters() {
  const searchTerm = budgetSearchInput.value.trim().toLowerCase();
  const selectedStatus = budgetStatusFilter.value;

  let filteredBudgets = [...allBudgets];

  if (selectedStatus !== "all") {
    filteredBudgets = filteredBudgets.filter((budget) => {
      return budget.status === selectedStatus;
    });
  }

  if (searchTerm) {
    filteredBudgets = filteredBudgets.filter((budget) => {
      const code = budget.budget_code || "";
      const patient = budget.patients?.full_name || "";
      const dentist = budget.dentists?.name || "";

      return (
        code.toLowerCase().includes(searchTerm) ||
        patient.toLowerCase().includes(searchTerm) ||
        dentist.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderBudgets(filteredBudgets);
}

function renderBudgets(budgets) {
  budgetsCount.textContent = `Mostrando ${budgets.length} de ${allBudgets.length} orçamentos`;

  if (!budgets.length) {
    budgetsTable.innerHTML = `
      <tr>
        <td colspan="8">Nenhum orçamento encontrado.</td>
      </tr>
    `;
    return;
  }

  budgetsTable.innerHTML = budgets.map((budget) => {
    return `
      <tr>
        <td>${budget.budget_code}</td>
        <td>${budget.patients?.full_name || "-"}</td>
        <td>${budget.dentists?.name || "-"}</td>
        <td>${formatCurrency(budget.subtotal || 0)}</td>
        <td>${formatCurrency(budget.discount || 0)}</td>
        <td><strong>${formatCurrency(budget.total || 0)}</strong></td>
        <td>
          <span class="status-badge ${getBudgetStatusClass(budget.status)}">
            ${translateBudgetStatus(budget.status)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="admin-icon-btn" type="button" onclick="viewBudget('${budget.id}')">👁</button>
            <button class="admin-icon-btn" type="button" onclick="editBudget('${budget.id}')">✎</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCreateBudgetForm() {
  budgetForm.reset();
  editingBudgetIdInput.value = "";
  budgetDiscountInput.value = 0;
  budgetItemsContainer.innerHTML = "";

  budgetFormTitle.textContent = "Novo orçamento";
  saveBudgetButton.textContent = "Salvar orçamento";

  addBudgetItemRow();

  budgetFormPanel.style.display = "block";
  openBudgetFormButton.style.display = "none";
}

function editBudget(budgetId) {
  const budget = allBudgets.find((item) => item.id === budgetId);

  if (!budget) {
    alert("Orçamento não encontrado.");
    return;
  }

  budgetForm.reset();
  budgetItemsContainer.innerHTML = "";

  editingBudgetIdInput.value = budget.id;
  budgetPatientInput.value = budget.patient_id || "";
  budgetDentistInput.value = budget.dentist_id || "";
  budgetStatusInput.value = budget.status || "draft";
  budgetPaymentConditionInput.value = budget.payment_condition || "";
  budgetDiscountInput.value = budget.discount || 0;
  budgetNotesInput.value = budget.notes || "";

  budget.budget_items.forEach((item) => {
    addBudgetItemRow(item);
  });

  budgetFormTitle.textContent = "Editar orçamento";
  saveBudgetButton.textContent = "Salvar alterações";

  budgetFormPanel.style.display = "block";
  openBudgetFormButton.style.display = "none";

  updateBudgetTotals();

  budgetFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeBudgetForm() {
  budgetForm.reset();
  editingBudgetIdInput.value = "";
  budgetItemsContainer.innerHTML = "";

  budgetFormTitle.textContent = "Novo orçamento";
  saveBudgetButton.textContent = "Salvar orçamento";
  saveBudgetButton.disabled = false;

  budgetFormPanel.style.display = "none";
  openBudgetFormButton.style.display = "inline-flex";
}

function viewBudget(budgetId) {
  const budget = allBudgets.find((item) => item.id === budgetId);

  if (!budget) {
    alert("Orçamento não encontrado.");
    return;
  }

  modalBudgetTitle.textContent = `Orçamento ${budget.budget_code}`;
  modalBudgetSubtitle.textContent = `${budget.patients?.full_name || "Paciente"} • ${translateBudgetStatus(budget.status)}`;

  modalBudgetPatient.textContent = budget.patients?.full_name || "-";
  modalBudgetDentist.textContent = budget.dentists?.name || "-";
  modalBudgetStatus.textContent = translateBudgetStatus(budget.status);
  modalBudgetPayment.textContent = budget.payment_condition || "-";

  modalBudgetItemsTable.innerHTML = budget.budget_items.map((item) => {
    return `
      <tr>
        <td>${item.procedure_name}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td><strong>${formatCurrency(item.total_price)}</strong></td>
      </tr>
    `;
  }).join("");

  modalBudgetSubtotal.textContent = formatCurrency(budget.subtotal || 0);
  modalBudgetDiscount.textContent = formatCurrency(budget.discount || 0);
  modalBudgetTotal.textContent = formatCurrency(budget.total || 0);
  modalBudgetNotes.textContent = budget.notes || "Nenhuma observação informada.";

  budgetModal.classList.add("active");
}

function closeModal() {
  budgetModal.classList.remove("active");
}

function handleSaveError(error) {
  console.error("Erro ao salvar orçamento:", error);
  alert("Erro ao salvar orçamento. Verifique o console.");

  saveBudgetButton.textContent = editingBudgetIdInput.value ? "Salvar alterações" : "Salvar orçamento";
  saveBudgetButton.disabled = false;
}

function generateBudgetCode() {
  const randomCode = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `ORC-${randomCode}`;
}

function getBudgetStatusClass(status) {
  const statusMap = {
    draft: "status-draft",
    sent: "status-sent",
    approved: "status-success",
    refused: "status-danger"
  };

  return statusMap[status] || "status-neutral";
}

function translateBudgetStatus(status) {
  const statusMap = {
    draft: "Rascunho",
    sent: "Enviado",
    approved: "Aprovado",
    refused: "Recusado"
  };

  return statusMap[status] || status;
}

/*
  CRIA OU ATUALIZA CONTA A RECEBER A PARTIR DO ORÇAMENTO

  Quando um orçamento é aprovado, ele vira uma cobrança.
  Exemplo:
  Orçamento ORC-ABC123 de R$ 1.200,00
  vira uma conta a receber pendente.
*/
async function createOrUpdateReceivableFromBudget({ budgetId, patientId, total, paymentCondition }) {
  /*
    Primeiro verifica se esse orçamento já tem conta a receber.
    Isso evita duplicar cobrança quando editar o orçamento aprovado.
  */
  const { data: existingReceivable, error: findError } = await supabaseClient
    .from("accounts_receivable")
    .select("*")
    .eq("budget_id", budgetId)
    .maybeSingle();

  if (findError) {
    console.error("Erro ao verificar conta a receber:", findError);
    return;
  }

  const receivableData = {
    patient_id: patientId,
    budget_id: budgetId,
    description: "Orçamento odontológico aprovado",
    amount: total,
    due_date: getTodayDate(),
    payment_method: paymentCondition || null,
    status: "pending",
    notes: "Gerado automaticamente a partir de orçamento aprovado.",
    updated_at: new Date().toISOString()
  };

  /*
    Se já existe, atualiza valor e informações.
  */
  if (existingReceivable) {
    const { error } = await supabaseClient
      .from("accounts_receivable")
      .update(receivableData)
      .eq("id", existingReceivable.id);

    if (error) {
      console.error("Erro ao atualizar conta a receber:", error);
    }

    return;
  }

  /*
    Se não existe, cria uma nova.
  */
  const { error } = await supabaseClient
    .from("accounts_receivable")
    .insert(receivableData);

  if (error) {
    console.error("Erro ao criar conta a receber:", error);
  }
}

/*
  Retorna a data atual no formato YYYY-MM-DD.
*/
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}
