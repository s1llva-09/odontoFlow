const logoutButton = document.querySelector("#logoutButton");
const reloadButton = document.querySelector("#reloadButton");
const procedureForm = document.querySelector("#procedureForm");
const procedureName = document.querySelector("#procedureName");
const procedureDuration = document.querySelector("#procedureDuration");
const procedurePrice = document.querySelector("#procedurePrice");
const procedureIcon = document.querySelector("#procedureIcon");
const procedureDescription = document.querySelector("#procedureDescription");
const procedureSearchInput = document.querySelector("#procedureSearchInput");
const proceduresTable = document.querySelector("#proceduresTable");
const saveProcedureButton = document.querySelector("#saveProcedureButton");

let procedures = [];

protectAdminPage();
setupLogout();
loadProcedures();

reloadButton.addEventListener("click", loadProcedures);
procedureSearchInput.addEventListener("input", () => {
  renderProcedures(filterProcedures(procedureSearchInput.value));
});

procedureForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveProcedure();
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

async function saveProcedure() {
  const name = procedureName.value.trim();
  const duration = Number(procedureDuration.value);
  const price = Number(procedurePrice.value);

  if (!name || !duration || Number.isNaN(price)) {
    alert("Informe nome, duração e valor do procedimento.");
    return;
  }

  saveProcedureButton.textContent = "Salvando...";
  saveProcedureButton.disabled = true;

  const procedureData = {
    name,
    duration_minutes: duration,
    price,
    icon: procedureIcon.value.trim() || "🦷",
    description: procedureDescription.value.trim() || null,
    active: true
  };

  const { error } = await supabaseClient
    .from("procedures")
    .insert(procedureData);

  saveProcedureButton.textContent = "Cadastrar procedimento";
  saveProcedureButton.disabled = false;

  if (error) {
    console.error("Erro ao cadastrar procedimento:", error);
    alert("Erro ao cadastrar procedimento.");
    return;
  }

  procedureForm.reset();
  await loadProcedures();
}

async function loadProcedures() {
  proceduresTable.innerHTML = `
    <tr>
      <td colspan="8">Carregando procedimentos...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("procedures")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar procedimentos:", error);
    proceduresTable.innerHTML = `
      <tr>
        <td colspan="8">Erro ao carregar procedimentos.</td>
      </tr>
    `;
    return;
  }

  procedures = data || [];
  renderProcedures(filterProcedures(procedureSearchInput.value));
}

function filterProcedures(searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);

  if (!normalizedSearch) {
    return procedures;
  }

  return procedures.filter((procedure) => {
    const searchableText = normalizeText([
      procedure.name,
      procedure.description
    ].join(" "));

    return searchableText.includes(normalizedSearch);
  });
}

function renderProcedures(procedureList) {
  if (procedureList.length === 0) {
    proceduresTable.innerHTML = `
      <tr>
        <td colspan="8">Nenhum procedimento encontrado.</td>
      </tr>
    `;
    return;
  }

  proceduresTable.innerHTML = procedureList
    .map((procedure) => {
      return `
        <tr>
          <td>
            <span class="procedure-table-icon">
              ${procedure.icon || "🦷"}
            </span>
          </td>
          <td>${procedure.name || "-"}</td>
          <td>${procedure.description || "-"}</td>
          <td>${procedure.duration_minutes || "-"} min</td>
          <td>${formatCurrency(procedure.price || 0)}</td>
          <td>
            <span class="status-badge ${procedure.active ? "status-active" : "status-inactive"}">
              ${procedure.active ? "Ativo" : "Inativo"}
            </span>
          </td>
          <td>${formatDateToBR(procedure.created_at)}</td>
          <td>
            <div class="table-actions">
              <button 
                type="button" 
                class="table-action-btn ${procedure.active ? "deactivate" : "activate"}"
                onclick="toggleProcedureStatus('${procedure.id}', ${procedure.active ? "false" : "true"})"
              >
                ${procedure.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function toggleProcedureStatus(procedureId, active) {
  const { error } = await supabaseClient
    .from("procedures")
    .update({ active })
    .eq("id", procedureId);

  if (error) {
    console.error("Erro ao atualizar procedimento:", error);
    alert("Erro ao atualizar procedimento.");
    return;
  }

  await loadProcedures();
}

function formatDateToBR(date) {
  if (!date) {
    return "-";
  }

  const onlyDate = date.split("T")[0];
  const [year, month, day] = onlyDate.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
