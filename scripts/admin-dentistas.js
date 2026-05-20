const logoutButton = document.querySelector("#logoutButton");
const reloadButton = document.querySelector("#reloadButton");
const dentistForm = document.querySelector("#dentistForm");
const dentistName = document.querySelector("#dentistName");
const dentistCro = document.querySelector("#dentistCro");
const dentistSpecialty = document.querySelector("#dentistSpecialty");
const dentistInitials = document.querySelector("#dentistInitials");
const dentistColor = document.querySelector("#dentistColor");
const dentistSearchInput = document.querySelector("#dentistSearchInput");
const dentistsTable = document.querySelector("#dentistsTable");
const saveDentistButton = document.querySelector("#saveDentistButton");

let dentists = [];

protectAdminPage();
setupLogout();
loadDentists();

reloadButton.addEventListener("click", loadDentists);
dentistSearchInput.addEventListener("input", () => {
  renderDentists(filterDentists(dentistSearchInput.value));
});

dentistInitials.addEventListener("input", () => {
  dentistInitials.value = dentistInitials.value.toUpperCase().slice(0, 3);
});

dentistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveDentist();
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

async function saveDentist() {
  const name = dentistName.value.trim();
  const specialty = dentistSpecialty.value.trim();

  if (!name || !specialty) {
    alert("Informe nome e especialidade do dentista.");
    return;
  }

  saveDentistButton.textContent = "Salvando...";
  saveDentistButton.disabled = true;

  const dentistData = {
    name,
    cro: dentistCro.value.trim() || null,
    specialty,
    initials: dentistInitials.value.trim() || getInitials(name),
    avatar_color: dentistColor.value,
    active: true
  };

  const { error } = await supabaseClient
    .from("dentists")
    .insert(dentistData);

  saveDentistButton.textContent = "Cadastrar dentista";
  saveDentistButton.disabled = false;

  if (error) {
    console.error("Erro ao cadastrar dentista:", error);
    alert("Erro ao cadastrar dentista.");
    return;
  }

  dentistForm.reset();
  dentistColor.value = "blue";
  await loadDentists();
}

async function loadDentists() {
  dentistsTable.innerHTML = `
    <tr>
      <td colspan="7">Carregando dentistas...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar dentistas:", error);
    dentistsTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar dentistas.</td>
      </tr>
    `;
    return;
  }

  dentists = data || [];
  renderDentists(filterDentists(dentistSearchInput.value));
}

function filterDentists(searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);

  if (!normalizedSearch) {
    return dentists;
  }

  return dentists.filter((dentist) => {
    const searchableText = normalizeText([
      dentist.name,
      dentist.cro,
      dentist.specialty
    ].join(" "));

    return searchableText.includes(normalizedSearch);
  });
}

function renderDentists(dentistList) {
  if (dentistList.length === 0) {
    dentistsTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhum dentista encontrado.</td>
      </tr>
    `;
    return;
  }

  dentistsTable.innerHTML = dentistList
    .map((dentist) => {
      return `
        <tr>
          <td>
            <span class="admin-avatar ${dentist.avatar_color || "blue"}">
              ${dentist.initials || getInitials(dentist.name || "DR")}
            </span>
          </td>
          <td>${dentist.name || "-"}</td>
          <td>${dentist.cro || "-"}</td>
          <td>${dentist.specialty || "-"}</td>
          <td>
            <span class="status-badge ${dentist.active ? "status-active" : "status-inactive"}">
              ${dentist.active ? "Ativo" : "Inativo"}
            </span>
          </td>
          <td>${formatDateToBR(dentist.created_at)}</td>
          <td>
            <div class="table-actions">
              <button 
                type="button" 
                class="table-action-btn ${dentist.active ? "deactivate" : "activate"}"
                onclick="toggleDentistStatus('${dentist.id}', ${dentist.active ? "false" : "true"})"
              >
                ${dentist.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function toggleDentistStatus(dentistId, active) {
  const { error } = await supabaseClient
    .from("dentists")
    .update({ active })
    .eq("id", dentistId);

  if (error) {
    console.error("Erro ao atualizar dentista:", error);
    alert("Erro ao atualizar dentista.");
    return;
  }

  await loadDentists();
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "DR";
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
