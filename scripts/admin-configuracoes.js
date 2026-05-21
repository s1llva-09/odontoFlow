/*
  TELA ADMIN CONFIGURAÇÕES

  Responsabilidades:
  1. Salvar dados da clínica
  2. Salvar horários de funcionamento
  3. Alterar senha do usuário logado
  4. Preparar área de notificações e segurança
*/

const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsContents = document.querySelectorAll(".settings-content");

const clinicSettingsForm = document.querySelector("#clinicSettingsForm");
const clinicSettingsIdInput = document.querySelector("#clinicSettingsId");
const clinicNameInput = document.querySelector("#clinicNameInput");
const clinicPhoneInput = document.querySelector("#clinicPhoneInput");
const clinicEmailInput = document.querySelector("#clinicEmailInput");
const clinicAddressInput = document.querySelector("#clinicAddressInput");
const clinicCnpjInput = document.querySelector("#clinicCnpjInput");
const clinicCroInput = document.querySelector("#clinicCroInput");
const clinicDescriptionInput = document.querySelector("#clinicDescriptionInput");
const saveClinicSettingsButton = document.querySelector("#saveClinicSettingsButton");

const workingHoursForm = document.querySelector("#workingHoursForm");
const workingHoursContainer = document.querySelector("#workingHoursContainer");
const saveWorkingHoursButton = document.querySelector("#saveWorkingHoursButton");

const changePasswordForm = document.querySelector("#changePasswordForm");
const currentPasswordInput = document.querySelector("#currentPasswordInput");
const newPasswordInput = document.querySelector("#newPasswordInput");
const confirmPasswordInput = document.querySelector("#confirmPasswordInput");
const changePasswordButton = document.querySelector("#changePasswordButton");

const clearTestDataButton = document.querySelector("#clearTestDataButton");
const saveNotificationSettingsButton = document.querySelector("#saveNotificationSettingsButton");

let clinicSettings = null;
let workingHours = [];

const DEFAULT_CLINIC_SETTINGS = {
  clinic_name: "Clínica OdontoFlow",
  phone: "(11) 3456-7890",
  email: "contato@odontoflow.com",
  address: "Av. Paulista, 1000 — São Paulo/SP",
  cnpj: "00.000.000/0001-00",
  cro: "CRO-SP 00000",
  description: "Clínica odontológica especializada em saúde bucal e estética dental."
};

const DEFAULT_WORKING_HOURS = [
  {
    week_day: 1,
    day_name: "Segunda",
    is_open: true,
    open_time: "08:00",
    close_time: "18:00"
  },
  {
    week_day: 2,
    day_name: "Terça",
    is_open: true,
    open_time: "08:00",
    close_time: "18:00"
  },
  {
    week_day: 3,
    day_name: "Quarta",
    is_open: true,
    open_time: "08:00",
    close_time: "18:00"
  },
  {
    week_day: 4,
    day_name: "Quinta",
    is_open: true,
    open_time: "08:00",
    close_time: "18:00"
  },
  {
    week_day: 5,
    day_name: "Sexta",
    is_open: true,
    open_time: "08:00",
    close_time: "17:00"
  },
  {
    week_day: 6,
    day_name: "Sábado",
    is_open: true,
    open_time: "08:00",
    close_time: "13:00"
  },
  {
    week_day: 0,
    day_name: "Domingo",
    is_open: false,
    open_time: null,
    close_time: null
  }
];

const DEFAULT_NOTIFICATION_SETTINGS = {
  new_appointment: true,
  cancelled_appointment: true,
  patient_confirmation: true,
  payable_due: true,
  receivable_due: true,
  daily_report: false
};

settingsTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const selectedTab = tab.dataset.tab;

    settingsTabs.forEach((item) => item.classList.remove("active"));
    settingsContents.forEach((item) => item.classList.remove("active"));

    tab.classList.add("active");

    document.querySelector(`#${selectedTab}Tab`).classList.add("active");
  });
});

clinicSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!canManageClinicSettings()) {
    alert("Você não tem permissão para alterar configurações da clínica.");
    return;
  }

  const clinicName = clinicNameInput.value.trim();

  if (!clinicName) {
    alert("Informe o nome da clínica.");
    return;
  }

  saveClinicSettingsButton.textContent = "Salvando...";
  saveClinicSettingsButton.disabled = true;

  const settingsData = {
    clinic_name: clinicName,
    phone: clinicPhoneInput.value.trim() || null,
    email: clinicEmailInput.value.trim() || null,
    address: clinicAddressInput.value.trim() || null,
    cnpj: clinicCnpjInput.value.trim() || null,
    cro: clinicCroInput.value.trim() || null,
    description: clinicDescriptionInput.value.trim() || null,
    updated_at: new Date().toISOString()
  };

  let result;

  if (clinicSettingsIdInput.value) {
    result = await supabaseClient
      .from("clinic_settings")
      .update(settingsData)
      .eq("id", clinicSettingsIdInput.value);
  } else {
    result = await supabaseClient
      .from("clinic_settings")
      .insert(settingsData)
      .select()
      .single();
  }

  if (result.error) {
    console.error("Erro ao salvar dados da clínica:", JSON.stringify(result.error, null, 2));
    alert("Erro ao salvar dados da clínica.");

    saveClinicSettingsButton.textContent = "Salvar informações";
    saveClinicSettingsButton.disabled = false;
    return;
  }

  saveClinicSettingsButton.textContent = "Salvar informações";
  saveClinicSettingsButton.disabled = false;

  await loadClinicSettings();

  /*
    Atualiza visualmente o nome da clínica na tela sem precisar recarregar.
  */
  updateClinicNameOnScreen(clinicName);

  alert("Informações da clínica salvas com sucesso!");
});

workingHoursForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!canManageClinicSettings()) {
    alert("Você não tem permissão para alterar horários.");
    return;
  }

  saveWorkingHoursButton.textContent = "Salvando...";
  saveWorkingHoursButton.disabled = true;

  const rows = document.querySelectorAll(".working-hour-row");

  const hoursToSave = Array.from(rows).map((row) => {
    const weekDay = Number(row.dataset.weekDay);
    const dayName = row.dataset.dayName;

    const isOpenInput = row.querySelector(".working-hour-open");
    const openTimeInput = row.querySelector(".working-hour-start");
    const closeTimeInput = row.querySelector(".working-hour-end");

    return {
      week_day: weekDay,
      day_name: dayName,
      is_open: isOpenInput.checked,
      open_time: isOpenInput.checked ? openTimeInput.value : null,
      close_time: isOpenInput.checked ? closeTimeInput.value : null,
      updated_at: new Date().toISOString()
    };
  });

  const { error: deleteError } = await supabaseClient
    .from("clinic_working_hours")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("Erro ao limpar horários:", JSON.stringify(deleteError, null, 2));
    alert("Erro ao salvar horários.");

    saveWorkingHoursButton.textContent = "Salvar horários";
    saveWorkingHoursButton.disabled = false;
    return;
  }

  const { error } = await supabaseClient
    .from("clinic_working_hours")
    .insert(hoursToSave);

  if (error) {
    console.error("Erro ao salvar horários:", JSON.stringify(error, null, 2));
    alert("Erro ao salvar horários.");

    saveWorkingHoursButton.textContent = "Salvar horários";
    saveWorkingHoursButton.disabled = false;
    return;
  }

  saveWorkingHoursButton.textContent = "Salvar horários";
  saveWorkingHoursButton.disabled = false;

  await loadWorkingHours();

  alert("Horários salvos com sucesso!");
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userId = localStorage.getItem("odontoflow_admin_user_id");

  const currentPassword = currentPasswordInput.value.trim();
  const newPassword = newPasswordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert("Preencha todos os campos.");
    return;
  }

  if (newPassword.length < 6) {
    alert("A nova senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("A confirmação da senha não confere.");
    return;
  }

  changePasswordButton.textContent = "Alterando...";
  changePasswordButton.disabled = true;

  const { data: user, error } = await supabaseClient
    .from("admin_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    console.error("Erro ao buscar usuário:", JSON.stringify(error, null, 2));
    alert("Erro ao buscar usuário.");

    changePasswordButton.textContent = "Alterar senha";
    changePasswordButton.disabled = false;
    return;
  }

  if ((user.password || "123456") !== currentPassword) {
    alert("Senha atual incorreta.");

    changePasswordButton.textContent = "Alterar senha";
    changePasswordButton.disabled = false;
    return;
  }

  const { error: updateError } = await supabaseClient
    .from("admin_users")
    .update({
      password: newPassword,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Erro ao alterar senha:", JSON.stringify(updateError, null, 2));
    alert("Erro ao alterar senha.");

    changePasswordButton.textContent = "Alterar senha";
    changePasswordButton.disabled = false;
    return;
  }

  changePasswordForm.reset();

  changePasswordButton.textContent = "Alterar senha";
  changePasswordButton.disabled = false;

  alert("Senha alterada com sucesso!");
});

if (clearTestDataButton) {
  clearTestDataButton.addEventListener("click", async () => {
  /*
    Apenas administrador pode apagar dados de teste.
  */
  if (!canManageClinicSettings()) {
    alert("Você não tem permissão para resetar dados de teste.");
    return;
  }

  /*
    Primeira confirmação.
    Aqui explicamos claramente que é uma ação perigosa.
  */
  const firstConfirm = confirm(
    "ATENÇÃO!\n\nEssa ação irá apagar dados de teste como pacientes, agendamentos, caixa, financeiro, orçamentos e prontuários.\n\nAs configurações da clínica, horários e notificações voltarão ao padrão do sistema.\n\nUsuários, dentistas e procedimentos serão mantidos.\n\nDeseja continuar?"
  );

  if (!firstConfirm) {
    return;
  }

  /*
    Segunda confirmação.
    O usuário precisa digitar exatamente RESETAR.
  */
  const typedConfirmation = prompt(
    "Para confirmar, digite exatamente: RESETAR"
  );

  if (typedConfirmation !== "RESETAR") {
    alert("Confirmação inválida. Nenhum dado foi alterado.");
    return;
  }

  /*
    Terceira proteção.
    Confirma de novo antes de executar.
  */
  const finalConfirm = confirm(
    "Última confirmação: deseja realmente resetar os dados de teste e restaurar as configurações padrão?"
  );

  if (!finalConfirm) {
    return;
  }

  await resetTestDataAndSettings();
  });
}

loadSettingsPage();

async function loadSettingsPage() {
  blockSettingsIfNeeded();

  await Promise.all([
    loadClinicSettings(),
    loadWorkingHours()
  ]);
}

function blockSettingsIfNeeded() {
  if (canManageClinicSettings()) {
    return;
  }

  saveClinicSettingsButton.disabled = true;
  saveWorkingHoursButton.disabled = true;

  /*
    Mantemos o botão clicável para mostrar o alerta de permissão.
    Se ele ficar disabled, o clique não dispara e parece que o botão não funciona.
  */
  if (clearTestDataButton) {
    clearTestDataButton.disabled = false;
    clearTestDataButton.title = "Apenas administradores podem resetar dados de teste.";
  }

  if (saveNotificationSettingsButton) {
    saveNotificationSettingsButton.disabled = true;
  }
}

async function loadClinicSettings() {
  const { data, error } = await supabaseClient
    .from("clinic_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar configurações:", JSON.stringify(error, null, 2));
    return;
  }

  if (!data || !data.length) {
    await createDefaultClinicSettings();
    await loadClinicSettings();
    return;
  }

  clinicSettings = data[0];

  clinicSettingsIdInput.value = clinicSettings.id;
  clinicNameInput.value = clinicSettings.clinic_name || "";
  clinicPhoneInput.value = clinicSettings.phone || "";
  clinicEmailInput.value = clinicSettings.email || "";
  clinicAddressInput.value = clinicSettings.address || "";
  clinicCnpjInput.value = clinicSettings.cnpj || "";
  clinicCroInput.value = clinicSettings.cro || "";
  clinicDescriptionInput.value = clinicSettings.description || "";
}

async function createDefaultClinicSettings() {
  const { error } = await supabaseClient
    .from("clinic_settings")
    .insert(DEFAULT_CLINIC_SETTINGS);

  if (error) {
    console.error("Erro ao criar configurações padrão:", JSON.stringify(error, null, 2));
  }
}

async function loadWorkingHours() {
  const { data, error } = await supabaseClient
    .from("clinic_working_hours")
    .select("*")
    .order("week_day", { ascending: true });

  if (error) {
    console.error("Erro ao buscar horários:", JSON.stringify(error, null, 2));
    workingHours = [];
    renderWorkingHours(DEFAULT_WORKING_HOURS);
    return;
  }

  if (!data || !data.length) {
    await createDefaultWorkingHours();
    await loadWorkingHours();
    return;
  }

  workingHours = sortWorkingHours(data);

  renderWorkingHours(workingHours);
}

async function createDefaultWorkingHours() {
  const { error } = await supabaseClient
    .from("clinic_working_hours")
    .insert(DEFAULT_WORKING_HOURS);

  if (error) {
    console.error("Erro ao criar horários padrão:", JSON.stringify(error, null, 2));
  }
}

function sortWorkingHours(hours) {
  const order = [1, 2, 3, 4, 5, 6, 0];

  return [...hours].sort((a, b) => {
    return order.indexOf(a.week_day) - order.indexOf(b.week_day);
  });
}

function renderWorkingHours(hours) {
  workingHoursContainer.innerHTML = hours.map((day) => {
    const openTime = day.open_time ? day.open_time.slice(0, 5) : "08:00";
    const closeTime = day.close_time ? day.close_time.slice(0, 5) : "18:00";

    return `
      <div 
        class="working-hour-row" 
        data-week-day="${day.week_day}" 
        data-day-name="${day.day_name}"
      >
        <label class="switch-control">
          <input 
            type="checkbox" 
            class="working-hour-open"
            ${day.is_open ? "checked" : ""}
          />

          <span></span>
        </label>

        <strong>${day.day_name}</strong>

        <input 
          type="time" 
          class="working-hour-start" 
          value="${openTime}"
          ${day.is_open ? "" : "disabled"}
        />

        <span>às</span>

        <input 
          type="time" 
          class="working-hour-end" 
          value="${closeTime}"
          ${day.is_open ? "" : "disabled"}
        />

        <small class="working-hour-closed">
          ${day.is_open ? "" : "Fechado"}
        </small>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".working-hour-open").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest(".working-hour-row");
      const startInput = row.querySelector(".working-hour-start");
      const endInput = row.querySelector(".working-hour-end");
      const closedText = row.querySelector(".working-hour-closed");

      startInput.disabled = !checkbox.checked;
      endInput.disabled = !checkbox.checked;
      closedText.textContent = checkbox.checked ? "" : "Fechado";
    });
  });
}

/*
  Atualiza os textos visuais da clínica na tela atual.
  Isso evita salvar no banco e continuar vendo "Clínica OdontoFlow" fixo no topo.
*/
function updateClinicNameOnScreen(clinicName) {
  const breadcrumbClinicName = document.querySelector(".admin-breadcrumb span");

  if (breadcrumbClinicName) {
    breadcrumbClinicName.textContent = clinicName;
  }
}

async function loadNotificationSettings() {
  const { data, error } = await supabaseClient
    .from("notification_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar notificações:", JSON.stringify(error, null, 2));
    return;
  }

  if (!data || !data.length) {
    await createDefaultNotificationSettings();
    await loadNotificationSettings();
    return;
  }

  notificationSettings = data[0];

  notificationSettingsIdInput.value = notificationSettings.id;

  notifyNewAppointmentInput.checked = Boolean(notificationSettings.new_appointment);
  notifyCancelledAppointmentInput.checked = Boolean(notificationSettings.cancelled_appointment);
  notifyPatientConfirmationInput.checked = Boolean(notificationSettings.patient_confirmation);
  notifyPayableDueInput.checked = Boolean(notificationSettings.payable_due);
  notifyReceivableDueInput.checked = Boolean(notificationSettings.receivable_due);
  notifyDailyReportInput.checked = Boolean(notificationSettings.daily_report);
}

async function createDefaultNotificationSettings() {
  const { error } = await supabaseClient
    .from("notification_settings")
    .insert(DEFAULT_NOTIFICATION_SETTINGS);

  if (error) {
    console.error("Erro ao criar notificações padrão:", JSON.stringify(error, null, 2));
  }
}

/*
  RESETA DADOS DE TESTE E CONFIGURAÇÕES

  Importante:
  A ordem importa.

  Primeiro apagamos tabelas que dependem de outras.
  Exemplo:
  - accounts_receivable pode depender de budget
  - appointments pode depender de patients
  - prontuários dependem de patients

  Depois apagamos pacientes e recriamos as configurações padrão.
*/
async function resetTestDataAndSettings() {
  clearTestDataButton.textContent = "Resetando...";
  clearTestDataButton.disabled = true;

  const tablesToClear = [
    "accounts_receivable",
    "accounts_payable",
    "budget_items",
    "budgets",
    "medical_records",
    "appointments",
    "financial_transactions",
    "cash_sessions",
    "patients"
  ];

  const failedSteps = [];

  for (const tableName of tablesToClear) {
    const error = await deleteAllRowsFromTable(tableName);

    if (error) {
      /*
        PGRST205 geralmente indica problema de tabela não encontrada no schema cache.
        Nesse caso, só registramos e seguimos.
      */
      console.warn(`Não foi possível limpar ${tableName}:`, JSON.stringify(error, null, 2));

      failedSteps.push(`limpar ${tableName}`);
    }
  }

  await resetDefaultTable("clinic_settings", DEFAULT_CLINIC_SETTINGS, failedSteps);
  await resetDefaultTable("clinic_working_hours", DEFAULT_WORKING_HOURS, failedSteps);
  await resetDefaultTable("notification_settings", DEFAULT_NOTIFICATION_SETTINGS, failedSteps);

  localStorage.removeItem("odontoflow_current_appointment");

  clearTestDataButton.textContent = "Resetar dados de teste";
  clearTestDataButton.disabled = false;

  if (failedSteps.length) {
    alert(
      `Reset concluído parcialmente.\n\nAlgumas etapas falharam:\n${failedSteps.join("\n")}`
    );
  } else {
    alert("Dados de teste resetados e configurações padrão restauradas com sucesso!");
  }

  window.location.reload();
}

async function resetDefaultTable(tableName, defaultData, failedSteps) {
  const deleteError = await deleteAllRowsFromTable(tableName);

  if (deleteError) {
    console.warn(`Não foi possível limpar ${tableName}:`, JSON.stringify(deleteError, null, 2));
    failedSteps.push(`limpar ${tableName}`);
    return;
  }

  const rows = Array.isArray(defaultData) ? defaultData : [defaultData];

  const { error } = await supabaseClient
    .from(tableName)
    .insert(rows);

  if (error) {
    console.warn(`Não foi possível restaurar ${tableName}:`, JSON.stringify(error, null, 2));
    failedSteps.push(`restaurar ${tableName}`);
  }
}

async function deleteAllRowsFromTable(tableName) {
  const { error } = await supabaseClient
    .from(tableName)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  return error;
}
