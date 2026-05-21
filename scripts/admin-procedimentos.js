/*
  TELA ADMIN DE PROCEDIMENTOS

  Responsabilidades:
  1. Verificar login fake temporário
  2. Buscar procedimentos no Supabase
  3. Cadastrar procedimento
  4. Editar procedimento
  5. Ativar/desativar procedimento
  6. Filtrar por busca e categoria
  7. Renderizar no padrão do Figma
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const procedureFormPanel = document.querySelector("#procedureFormPanel");
const openProcedureFormButton = document.querySelector("#openProcedureFormButton");
const cancelProcedureFormButton = document.querySelector("#cancelProcedureFormButton");
const procedureFormTitle = document.querySelector("#procedureFormTitle");

const procedureForm = document.querySelector("#procedureForm");
const editingProcedureIdInput = document.querySelector("#editingProcedureId");

const procedureNameInput = document.querySelector("#procedureName");
const procedureCategoryInput = document.querySelector("#procedureCategory");
const procedureDurationInput = document.querySelector("#procedureDuration");
const procedurePriceInput = document.querySelector("#procedurePrice");
const procedureIconInput = document.querySelector("#procedureIcon");
const procedureDescriptionInput = document.querySelector("#procedureDescription");

const saveProcedureButton = document.querySelector("#saveProcedureButton");
const proceduresTable = document.querySelector("#proceduresTable");
const proceduresCount = document.querySelector("#proceduresCount");

const logoutButton = document.querySelector("#logoutButton");
const procedureSearchInput = document.querySelector("#procedureSearchInput");
const procedureCategoryFilter = document.querySelector("#procedureCategoryFilter");

let allProcedures = [];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openProcedureFormButton.addEventListener("click", () => {
  openCreateProcedureForm();
});

cancelProcedureFormButton.addEventListener("click", () => {
  closeProcedureForm();
});

procedureSearchInput.addEventListener("input", applyFilters);
procedureCategoryFilter.addEventListener("change", applyFilters);

procedureForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingProcedureId = editingProcedureIdInput.value;

  const name = procedureNameInput.value.trim();
  const category = procedureCategoryInput.value.trim();
  const duration = Number(procedureDurationInput.value);
  const price = Number(procedurePriceInput.value);
  const icon = procedureIconInput.value.trim();
  const description = procedureDescriptionInput.value.trim();

  if (!name || !duration || Number.isNaN(duration) || price < 0 || Number.isNaN(price)) {
    alert("Preencha nome, duração e valor corretamente.");
    return;
  }

  if (duration <= 0) {
    alert("A duração precisa ser maior que zero.");
    return;
  }

  saveProcedureButton.textContent = editingProcedureId ? "Salvando alterações..." : "Salvando...";
  saveProcedureButton.disabled = true;

  const procedureData = {
    name,
    category: category || null,
    description: description || null,
    duration_minutes: duration,
    price,
    icon: icon || "🦷"
  };

  let result;

  if (editingProcedureId) {
    result = await supabaseClient
      .from("procedures")
      .update(procedureData)
      .eq("id", editingProcedureId);
  } else {
    result = await supabaseClient
      .from("procedures")
      .insert({
        ...procedureData,
        active: true
      });
  }

  if (result.error) {
    console.error("Erro ao salvar procedimento:", result.error);
    alert("Erro ao salvar procedimento. Verifique o console.");

    saveProcedureButton.textContent = editingProcedureId ? "Salvar alterações" : "Cadastrar procedimento";
    saveProcedureButton.disabled = false;

    return;
  }

  closeProcedureForm();
  await loadProcedures();

  alert(editingProcedureId ? "Procedimento atualizado com sucesso!" : "Procedimento cadastrado com sucesso!");
});

loadProcedures();

async function loadProcedures() {
  proceduresTable.innerHTML = `
    <tr>
      <td colspan="6">Carregando procedimentos...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("procedures")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar procedimentos:", error);

    proceduresTable.innerHTML = `
      <tr>
        <td colspan="6">Erro ao carregar procedimentos.</td>
      </tr>
    `;

    return;
  }

  allProcedures = data || [];

  populateCategoryFilter(allProcedures);
  renderProcedures(allProcedures);
}

function populateCategoryFilter(procedures) {
  const selectedValue = procedureCategoryFilter.value;

  const categories = [...new Set(
    procedures
      .map((procedure) => procedure.category)
      .filter(Boolean)
  )];

  procedureCategoryFilter.innerHTML = `
    <option value="all">Todas as categorias</option>
  `;

  categories.forEach((category) => {
    procedureCategoryFilter.innerHTML += `
      <option value="${category}">${category}</option>
    `;
  });

  procedureCategoryFilter.value = selectedValue || "all";
}

function applyFilters() {
  const searchTerm = procedureSearchInput.value.trim().toLowerCase();
  const selectedCategory = procedureCategoryFilter.value;

  let filteredProcedures = [...allProcedures];

  if (selectedCategory !== "all") {
    filteredProcedures = filteredProcedures.filter((procedure) => {
      return procedure.category === selectedCategory;
    });
  }

  if (searchTerm) {
    filteredProcedures = filteredProcedures.filter((procedure) => {
      const name = procedure.name || "";
      const category = procedure.category || "";
      const description = procedure.description || "";

      return (
        name.toLowerCase().includes(searchTerm) ||
        category.toLowerCase().includes(searchTerm) ||
        description.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderProcedures(filteredProcedures);
}

function renderProcedures(procedures) {
  proceduresCount.textContent = `Mostrando ${procedures.length} de ${allProcedures.length} procedimentos`;

  if (!procedures.length) {
    proceduresTable.innerHTML = `
      <tr>
        <td colspan="6">Nenhum procedimento encontrado.</td>
      </tr>
    `;
    return;
  }

  proceduresTable.innerHTML = procedures.map((procedure) => {
    const statusText = procedure.active ? "Ativo" : "Inativo";
    const statusClass = procedure.active ? "status-active" : "status-inactive";

    const durationText = formatDuration(procedure.duration_minutes);
    const nextStatus = !procedure.active;
    const statusActionText = procedure.active ? "Desativar" : "Ativar";

    return `
      <tr>
        <td>
          <div class="procedure-name-cell">
            <span class="procedure-table-icon">
              ${procedure.icon || "🦷"}
            </span>

            <div>
              <strong>${procedure.name || "-"}</strong>
              <small>${procedure.description || "Sem descrição"}</small>
            </div>
          </div>
        </td>

        <td>
          <span class="status-badge status-confirmed">
            ${procedure.category || "Geral"}
          </span>
        </td>

        <td>${durationText}</td>

        <td>
          <strong>${formatCurrency(procedure.price || 0)}</strong>
        </td>

        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>

        <td>
          <div class="table-actions">
            <button 
              class="admin-icon-btn" 
              type="button"
              title="Editar procedimento"
              onclick="editProcedure('${procedure.id}')"
            >
              ✎
            </button>

            <button 
              class="admin-status-action ${procedure.active ? "danger" : "success"}" 
              type="button"
              title="${statusActionText}"
              onclick="toggleProcedureStatus('${procedure.id}', ${nextStatus})"
            >
              ${procedure.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCreateProcedureForm() {
  procedureForm.reset();
  editingProcedureIdInput.value = "";

  procedureFormTitle.textContent = "Novo procedimento";
  saveProcedureButton.textContent = "Cadastrar procedimento";

  procedureFormPanel.style.display = "block";
  openProcedureFormButton.style.display = "none";

  procedureNameInput.focus();
}

function editProcedure(procedureId) {
  const procedure = allProcedures.find((item) => item.id === procedureId);

  if (!procedure) {
    alert("Procedimento não encontrado.");
    return;
  }

  editingProcedureIdInput.value = procedure.id;

  procedureNameInput.value = procedure.name || "";
  procedureCategoryInput.value = procedure.category || "";
  procedureDurationInput.value = procedure.duration_minutes || "";
  procedurePriceInput.value = procedure.price || "";
  procedureIconInput.value = procedure.icon || "";
  procedureDescriptionInput.value = procedure.description || "";

  procedureFormTitle.textContent = "Editar procedimento";
  saveProcedureButton.textContent = "Salvar alterações";

  procedureFormPanel.style.display = "block";
  openProcedureFormButton.style.display = "none";

  procedureFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeProcedureForm() {
  procedureForm.reset();
  editingProcedureIdInput.value = "";

  procedureFormTitle.textContent = "Novo procedimento";
  saveProcedureButton.textContent = "Cadastrar procedimento";
  saveProcedureButton.disabled = false;

  procedureFormPanel.style.display = "none";
  openProcedureFormButton.style.display = "inline-flex";
}

async function toggleProcedureStatus(procedureId, newStatus) {
  const message = newStatus
    ? "Deseja ativar este procedimento?"
    : "Deseja desativar este procedimento?";

  const confirmAction = confirm(message);

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("procedures")
    .update({
      active: newStatus
    })
    .eq("id", procedureId);

  if (error) {
    console.error("Erro ao alterar status do procedimento:", error);
    alert("Erro ao alterar status do procedimento.");
    return;
  }

  await loadProcedures();
}

function formatDuration(minutes) {
  const value = Number(minutes || 0);

  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
}