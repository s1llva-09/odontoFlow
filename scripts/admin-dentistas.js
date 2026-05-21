/*
  TELA ADMIN DE DENTISTAS

  Agora o botão de lápis edita o dentista.
  A ação de ativar/desativar fica em botão separado.
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const dentistFormPanel = document.querySelector("#dentistFormPanel");
const openDentistFormButton = document.querySelector("#openDentistFormButton");
const cancelDentistFormButton = document.querySelector("#cancelDentistFormButton");

const dentistForm = document.querySelector("#dentistForm");
const editingDentistIdInput = document.querySelector("#editingDentistId");

const dentistNameInput = document.querySelector("#dentistName");
const dentistCroInput = document.querySelector("#dentistCro");
const dentistSpecialtyInput = document.querySelector("#dentistSpecialty");
const dentistPhoneInput = document.querySelector("#dentistPhone");
const dentistDaysInput = document.querySelector("#dentistDays");
const dentistCommissionInput = document.querySelector("#dentistCommission");
const dentistInitialsInput = document.querySelector("#dentistInitials");
const dentistColorSelect = document.querySelector("#dentistColor");
const saveDentistButton = document.querySelector("#saveDentistButton");

const dentistsTable = document.querySelector("#dentistsTable");
const dentistsCount = document.querySelector("#dentistsCount");
const logoutButton = document.querySelector("#logoutButton");
const dentistSearchInput = document.querySelector("#dentistSearchInput");

let allDentists = [];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openDentistFormButton.addEventListener("click", () => {
  openCreateDentistForm();
});

cancelDentistFormButton.addEventListener("click", () => {
  closeDentistForm();
});

dentistSearchInput.addEventListener("input", applyFilters);

dentistForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingDentistId = editingDentistIdInput.value;

  const name = dentistNameInput.value.trim();
  const cro = dentistCroInput.value.trim();
  const specialty = dentistSpecialtyInput.value.trim();
  const phone = dentistPhoneInput.value.trim();
  const days = dentistDaysInput.value.trim();
  const commission = Number(dentistCommissionInput.value || 0);
  const initials = dentistInitialsInput.value.trim().toUpperCase();
  const avatarColor = dentistColorSelect.value;

  if (!name || !specialty) {
    alert("Preencha nome e especialidade do dentista.");
    return;
  }

  if (commission < 0 || commission > 100) {
    alert("A comissão precisa estar entre 0 e 100.");
    return;
  }

  saveDentistButton.textContent = editingDentistId ? "Salvando alterações..." : "Salvando...";
  saveDentistButton.disabled = true;

  const dentistData = {
    name,
    cro: cro || null,
    specialty,
    phone: phone || null,
    working_days: days || null,
    commission_percentage: commission || 0,
    initials: initials || generateInitials(name),
    avatar_color: avatarColor
  };

  let result;

  if (editingDentistId) {
    result = await supabaseClient
      .from("dentists")
      .update(dentistData)
      .eq("id", editingDentistId);
  } else {
    result = await supabaseClient
      .from("dentists")
      .insert({
        ...dentistData,
        active: true
      });
  }

  if (result.error) {
    console.error("Erro ao salvar dentista:", result.error);
    alert("Erro ao salvar dentista. Verifique o console.");

    saveDentistButton.textContent = editingDentistId ? "Salvar alterações" : "Cadastrar dentista";
    saveDentistButton.disabled = false;

    return;
  }

  closeDentistForm();
  await loadDentists();

  alert(editingDentistId ? "Dentista atualizado com sucesso!" : "Dentista cadastrado com sucesso!");
});

loadDentists();

async function loadDentists() {
  dentistsTable.innerHTML = `
    <tr>
      <td colspan="8">Carregando dentistas...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar dentistas:", error);

    dentistsTable.innerHTML = `
      <tr>
        <td colspan="8">Erro ao carregar dentistas.</td>
      </tr>
    `;

    return;
  }

  allDentists = data || [];
  renderDentists(allDentists);
}

function applyFilters() {
  const searchTerm = dentistSearchInput.value.trim().toLowerCase();

  const filteredDentists = allDentists.filter((dentist) => {
    const name = dentist.name || "";
    const cro = dentist.cro || "";
    const specialty = dentist.specialty || "";
    const phone = dentist.phone || "";

    return (
      name.toLowerCase().includes(searchTerm) ||
      cro.toLowerCase().includes(searchTerm) ||
      specialty.toLowerCase().includes(searchTerm) ||
      phone.toLowerCase().includes(searchTerm)
    );
  });

  renderDentists(filteredDentists);
}

function renderDentists(dentists) {
  dentistsCount.textContent = `Mostrando ${dentists.length} de ${allDentists.length} dentistas`;

  if (!dentists.length) {
    dentistsTable.innerHTML = `
      <tr>
        <td colspan="8">Nenhum dentista encontrado.</td>
      </tr>
    `;
    return;
  }

  dentistsTable.innerHTML = dentists.map((dentist) => {
    const statusText = dentist.active ? "Ativo" : "Inativo";
    const statusClass = dentist.active ? "status-active" : "status-inactive";
    const initials = dentist.initials || generateInitials(dentist.name || "DR");

    const nextStatus = !dentist.active;
    const statusActionText = dentist.active ? "Desativar" : "Ativar";

    return `
      <tr>
        <td>
          <div class="patient-name-cell">
            <span class="admin-avatar ${dentist.avatar_color || "blue"}">
              ${initials}
            </span>
            <strong>${dentist.name || "-"}</strong>
          </div>
        </td>

        <td>${dentist.cro || "-"}</td>
        <td>${dentist.specialty || "-"}</td>
        <td>${dentist.phone || "-"}</td>
        <td>${dentist.working_days || "-"}</td>

        <td>
          <strong>${Number(dentist.commission_percentage || 0)}%</strong>
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
              title="Editar dentista"
              onclick="editDentist('${dentist.id}')"
            >
              ✎
            </button>

            <button 
              class="admin-status-action ${dentist.active ? "danger" : "success"}" 
              type="button"
              title="${statusActionText}"
              onclick="toggleDentistStatus('${dentist.id}', ${nextStatus})"
            >
              ${dentist.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCreateDentistForm() {
  dentistForm.reset();
  editingDentistIdInput.value = "";

  saveDentistButton.textContent = "Cadastrar dentista";

  dentistFormPanel.style.display = "block";
  openDentistFormButton.style.display = "none";

  dentistNameInput.focus();
}

function editDentist(dentistId) {
  const dentist = allDentists.find((item) => item.id === dentistId);

  if (!dentist) {
    alert("Dentista não encontrado.");
    return;
  }

  editingDentistIdInput.value = dentist.id;

  dentistNameInput.value = dentist.name || "";
  dentistCroInput.value = dentist.cro || "";
  dentistSpecialtyInput.value = dentist.specialty || "";
  dentistPhoneInput.value = dentist.phone || "";
  dentistDaysInput.value = dentist.working_days || "";
  dentistCommissionInput.value = dentist.commission_percentage || 0;
  dentistInitialsInput.value = dentist.initials || "";
  dentistColorSelect.value = dentist.avatar_color || "blue";

  saveDentistButton.textContent = "Salvar alterações";

  dentistFormPanel.style.display = "block";
  openDentistFormButton.style.display = "none";

  dentistFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeDentistForm() {
  dentistForm.reset();
  editingDentistIdInput.value = "";

  saveDentistButton.textContent = "Cadastrar dentista";
  saveDentistButton.disabled = false;

  dentistFormPanel.style.display = "none";
  openDentistFormButton.style.display = "inline-flex";
}

async function toggleDentistStatus(dentistId, newStatus) {
  const message = newStatus
    ? "Deseja ativar este dentista?"
    : "Deseja desativar este dentista?";

  const confirmAction = confirm(message);

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("dentists")
    .update({
      active: newStatus
    })
    .eq("id", dentistId);

  if (error) {
    console.error("Erro ao alterar status do dentista:", error);
    alert("Erro ao alterar status do dentista.");
    return;
  }

  await loadDentists();
}

function generateInitials(name) {
  const ignoredWords = ["dr", "dra", "sr", "sra"];

  const words = String(name)
    .replaceAll(".", "")
    .split(" ")
    .filter((word) => word.trim().length > 0)
    .filter((word) => !ignoredWords.includes(word.toLowerCase()));

  if (words.length === 0) {
    return "DR";
  }

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}