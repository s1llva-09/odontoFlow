/*
  TELA ADMIN USUÁRIOS

  Responsabilidades:
  1. Buscar usuários internos
  2. Buscar dentistas para vincular usuário dentista
  3. Cadastrar usuário
  4. Editar usuário
  5. Ativar/Inativar usuário
  6. Filtrar por nome, e-mail e perfil
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const openUserFormButton = document.querySelector("#openUserFormButton");
const userFormPanel = document.querySelector("#userFormPanel");
const userFormTitle = document.querySelector("#userFormTitle");
const cancelUserFormButton = document.querySelector("#cancelUserFormButton");

const userForm = document.querySelector("#userForm");
const editingUserIdInput = document.querySelector("#editingUserId");

const userFullNameInput = document.querySelector("#userFullName");
const userEmailInput = document.querySelector("#userEmail");
const userPhoneInput = document.querySelector("#userPhone");
const userRoleInput = document.querySelector("#userRole");
const userDentistInput = document.querySelector("#userDentist");
const dentistRelationGroup = document.querySelector("#dentistRelationGroup");
const userStatusInput = document.querySelector("#userStatus");
const saveUserButton = document.querySelector("#saveUserButton");

const userSearchInput = document.querySelector("#userSearchInput");
const userRoleFilter = document.querySelector("#userRoleFilter");
const usersTable = document.querySelector("#usersTable");
const usersCount = document.querySelector("#usersCount");

let allUsers = [];
let allDentists = [];

if (!canManageUsers()) {
  openUserFormButton.style.display = "none";
}

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openUserFormButton.addEventListener("click", openCreateUserForm);
cancelUserFormButton.addEventListener("click", closeUserForm);

userSearchInput.addEventListener("input", applyFilters);
userRoleFilter.addEventListener("change", applyFilters);

userRoleInput.addEventListener("change", () => {
  updateDentistRelationVisibility();
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingUserId = editingUserIdInput.value;

  const fullName = userFullNameInput.value.trim();
  const email = userEmailInput.value.trim();
  const phone = userPhoneInput.value.trim();
  const role = userRoleInput.value;
  const dentistId = role === "dentist" ? userDentistInput.value || null : null;
  const status = userStatusInput.value;

  if (!fullName || !email || !role) {
    alert("Preencha nome, e-mail e perfil.");
    return;
  }

  saveUserButton.textContent = editingUserId ? "Salvando alterações..." : "Salvando...";
  saveUserButton.disabled = true;

  const userData = {
    full_name: fullName,
    email,
    phone: phone || null,
    role,
    dentist_id: dentistId,
    status,
    updated_at: new Date().toISOString()
  };

  let result;

  if (editingUserId) {
    result = await supabaseClient
      .from("admin_users")
      .update(userData)
      .eq("id", editingUserId);
  } else {
    result = await supabaseClient
      .from("admin_users")
      .insert(userData);
  }

  if (result.error) {
    console.error("Erro ao salvar usuário:", JSON.stringify(result.error, null, 2));
    alert("Erro ao salvar usuário. Verifique se o e-mail já não está cadastrado.");

    saveUserButton.textContent = editingUserId ? "Salvar alterações" : "Salvar usuário";
    saveUserButton.disabled = false;

    return;
  }

  closeUserForm();
  await loadPageData();

  alert(editingUserId ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");
});

loadPageData();

async function loadPageData() {
  await loadDentists();
  await loadUsers();
}

async function loadDentists() {
  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar dentistas:", JSON.stringify(error, null, 2));
    allDentists = [];
    return;
  }

  allDentists = data || [];

  populateDentistSelect();
}

async function loadUsers() {
  usersTable.innerHTML = `
    <tr>
      <td colspan="7">Carregando usuários...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select(`
      *,
      dentists (*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar usuários:", JSON.stringify(error, null, 2));

    usersTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar usuários.</td>
      </tr>
    `;

    return;
  }

  allUsers = data || [];

  /*
    Se ainda não tiver nenhum usuário, cria um admin padrão.
    Isso ajuda no ambiente de teste.
  */
  if (!allUsers.length) {
    await createDefaultAdminUser();
    await loadUsers();
    return;
  }

  renderUsers(allUsers);
}

async function createDefaultAdminUser() {
  const { error } = await supabaseClient
    .from("admin_users")
    .insert({
      full_name: "Admin Geral",
      email: "admin@clinica.com",
      role: "admin",
      status: "active"
    });

  if (error) {
    console.error("Erro ao criar admin padrão:", JSON.stringify(error, null, 2));
  }
}

function populateDentistSelect() {
  userDentistInput.innerHTML = `<option value="">Nenhum</option>`;

  allDentists.forEach((dentist) => {
    userDentistInput.innerHTML += `
      <option value="${dentist.id}">
        ${dentist.name}
      </option>
    `;
  });
}

function applyFilters() {
  const searchTerm = userSearchInput.value.trim().toLowerCase();
  const selectedRole = userRoleFilter.value;

  let filtered = [...allUsers];

  if (selectedRole !== "all") {
    filtered = filtered.filter((user) => {
      return user.role === selectedRole;
    });
  }

  if (searchTerm) {
    filtered = filtered.filter((user) => {
      const name = user.full_name || "";
      const email = user.email || "";
      const phone = user.phone || "";

      return (
        name.toLowerCase().includes(searchTerm) ||
        email.toLowerCase().includes(searchTerm) ||
        phone.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderUsers(filtered);
}

function renderUsers(users) {
  usersCount.textContent = `Mostrando ${users.length} de ${allUsers.length} usuários`;

  if (!users.length) {
    usersTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhum usuário encontrado.</td>
      </tr>
    `;
    return;
  }

  usersTable.innerHTML = users.map((user) => {
    const initials = getInitials(user.full_name);
    const statusClass = user.status === "active" ? "status-paid" : "status-neutral";

    return `
      <tr>
        <td>
          <div class="user-table-cell">
            <span class="user-avatar-mini ${user.role}">
              ${initials}
            </span>

            <strong>${user.full_name}</strong>
          </div>
        </td>

        <td>${user.email || "-"}</td>

        <td>
          <span class="status-badge ${getRoleClass(user.role)}">
            ${translateRole(user.role)}
          </span>
        </td>

        <td>${user.dentists?.name || "-"}</td>

        <td>
          <span class="status-badge ${statusClass}">
            ${user.status === "active" ? "Ativo" : "Inativo"}
          </span>
        </td>

        <td>${formatLastAccess(user.last_access_at)}</td>

        <td>
          <div class="table-actions">
            <button 
              class="admin-icon-btn" 
              type="button"
              title="Editar usuário"
              onclick="editUser('${user.id}')"
            >
              ✎
            </button>

            <button 
              class="admin-status-action ${user.status === "active" ? "danger" : "success"}"
              type="button"
              onclick="toggleUserStatus('${user.id}', '${user.status === "active" ? "inactive" : "active"}')"
            >
              ${user.status === "active" ? "Inativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCreateUserForm() {
  if (!canManageUsers()) {
    alert("Você não tem permissão para cadastrar usuários.");
    return;
  }

  userForm.reset();
  editingUserIdInput.value = "";

  userFormTitle.textContent = "Novo usuário";
  saveUserButton.textContent = "Salvar usuário";

  userRoleInput.value = "receptionist";
  userStatusInput.value = "active";

  updateDentistRelationVisibility();

  userFormPanel.style.display = "block";
  openUserFormButton.style.display = "none";

  userFullNameInput.focus();
}

function editUser(userId) {
  const user = allUsers.find((item) => item.id === userId);

  if (!user) {
    alert("Usuário não encontrado.");
    return;
  }

  editingUserIdInput.value = user.id;

  userFullNameInput.value = user.full_name || "";
  userEmailInput.value = user.email || "";
  userPhoneInput.value = user.phone || "";
  userRoleInput.value = user.role || "receptionist";
  userDentistInput.value = user.dentist_id || "";
  userStatusInput.value = user.status || "active";

  userFormTitle.textContent = "Editar usuário";
  saveUserButton.textContent = "Salvar alterações";

  updateDentistRelationVisibility();

  userFormPanel.style.display = "block";
  openUserFormButton.style.display = "none";

  userFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeUserForm() {
  userForm.reset();
  editingUserIdInput.value = "";

  userFormTitle.textContent = "Novo usuário";
  saveUserButton.textContent = "Salvar usuário";
  saveUserButton.disabled = false;

  userFormPanel.style.display = "none";
  openUserFormButton.style.display = "inline-flex";
}

async function toggleUserStatus(userId, newStatus) {
  const message = newStatus === "active"
    ? "Deseja ativar este usuário?"
    : "Deseja inativar este usuário?";

  const confirmAction = confirm(message);

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("admin_users")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (error) {
    console.error("Erro ao alterar status:", JSON.stringify(error, null, 2));
    alert("Erro ao alterar status do usuário.");
    return;
  }

  await loadUsers();
}

function updateDentistRelationVisibility() {
  if (userRoleInput.value === "dentist") {
    dentistRelationGroup.style.display = "block";
  } else {
    dentistRelationGroup.style.display = "none";
    userDentistInput.value = "";
  }
}

function translateRole(role) {
  const map = {
    admin: "Administrador",
    receptionist: "Recepcionista",
    dentist: "Dentista",
    financial: "Financeiro"
  };

  return map[role] || role;
}

function getRoleClass(role) {
  const map = {
    admin: "status-draft",
    receptionist: "status-confirmed",
    dentist: "status-paid",
    financial: "status-pending"
  };

  return map[role] || "status-neutral";
}

function getInitials(name) {
  if (!name) {
    return "?";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatLastAccess(date) {
  if (!date) {
    return "Nunca";
  }

  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
