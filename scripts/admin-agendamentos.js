/*
  TELA ADMIN DE AGENDAMENTOS

  Responsabilidades:
  1. Proteger a tela com login fake temporário
  2. Buscar agendamentos reais no Supabase
  3. Renderizar tabela no padrão do Figma
  4. Filtrar por texto e status
  5. Confirmar, cancelar e concluir agendamentos
*/

/*
  Verifica se o admin está logado.
*/
const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

/*
  Elementos da tela.
*/
const appointmentsTable = document.querySelector("#appointmentsTable");
const appointmentSearchInput = document.querySelector("#appointmentSearchInput");
const statusFilter = document.querySelector("#statusFilter");
const appointmentsCount = document.querySelector("#appointmentsCount");
const logoutButton = document.querySelector("#logoutButton");
const newAppointmentButton = document.querySelector("#newAppointmentButton");

/*
  Lista completa carregada do Supabase.
*/
let allAppointments = [];

/*
  Logout.
*/
logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

/*
  Botão novo agendamento.
  Por enquanto redireciona para o fluxo público de agendamento.
  Depois podemos criar modal interno do admin.
*/
newAppointmentButton.addEventListener("click", () => {
  window.location.href = "./agendamento.html";
});

/*
  Filtros.
*/
appointmentSearchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);

/*
  Carrega ao abrir.
*/
loadAppointments();

/*
  Busca agendamentos no Supabase.
*/
async function loadAppointments() {
  appointmentsTable.innerHTML = `
    <tr>
      <td colspan="8">Carregando agendamentos...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("appointments")
    .select(`
      *,
      patients (*),
      procedures (*),
      dentists (*)
    `)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agendamentos:", error);

    appointmentsTable.innerHTML = `
      <tr>
        <td colspan="8">Erro ao carregar agendamentos.</td>
      </tr>
    `;

    return;
  }

  allAppointments = data || [];

  renderAppointments(allAppointments);
}

/*
  Aplica busca e filtro de status.
*/
function applyFilters() {
  const searchTerm = appointmentSearchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  let filteredAppointments = [...allAppointments];

  /*
    Filtro por status.
  */
  if (selectedStatus !== "all") {
    filteredAppointments = filteredAppointments.filter((appointment) => {
      return appointment.status === selectedStatus;
    });
  }

  /*
    Filtro por texto.
  */
  if (searchTerm) {
    filteredAppointments = filteredAppointments.filter((appointment) => {
      const code = appointment.code || "";
      const patient = appointment.patients?.full_name || "";
      const procedure = appointment.procedures?.name || "";
      const dentist = appointment.dentists?.name || "";

      return (
        code.toLowerCase().includes(searchTerm) ||
        patient.toLowerCase().includes(searchTerm) ||
        procedure.toLowerCase().includes(searchTerm) ||
        dentist.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderAppointments(filteredAppointments);
}

/*
  Renderiza tabela.
*/
function renderAppointments(appointments) {
  appointmentsCount.textContent = `Mostrando ${appointments.length} de ${allAppointments.length} agendamentos`;

  if (!appointments.length) {
    appointmentsTable.innerHTML = `
      <tr>
        <td colspan="8">Nenhum agendamento encontrado.</td>
      </tr>
    `;
    return;
  }

  appointmentsTable.innerHTML = appointments.map((appointment) => {
    const canConfirm = appointment.status === "requested";

    const canComplete = [
      "clinic_confirmed",
      "patient_confirmed"
    ].includes(appointment.status);

    const canCancel = ![
      "cancelled_by_patient",
      "cancelled_by_clinic",
      "completed"
    ].includes(appointment.status);

    return `
      <tr>
        <td>${appointment.code || "-"}</td>

        <td>${appointment.patients?.full_name || "-"}</td>

        <td>${appointment.procedures?.name || "-"}</td>

        <td>${appointment.dentists?.name || "-"}</td>

        <td>${formatDateToBR(appointment.appointment_date)}</td>

        <td>
          <strong>${appointment.appointment_time?.slice(0, 5) || "-"}</strong>
        </td>

        <td>
          <span class="status-badge status-${appointment.status}">
            ${translateStatus(appointment.status)}
          </span>
        </td>

        <td>
          <div class="table-actions">
            <button
              class="table-action-btn confirm"
              onclick="confirmAppointment('${appointment.id}')"
              ${canConfirm ? "" : "disabled"}
              title="Confirmar"
            >
              ✓
            </button>

            <button
              class="table-action-btn complete"
              onclick="completeAppointment('${appointment.id}')"
              ${canComplete ? "" : "disabled"}
              title="Concluir"
            >
              ✔
            </button>

            <button
              class="table-action-btn cancel"
              onclick="cancelAppointmentByClinic('${appointment.id}')"
              ${canCancel ? "" : "disabled"}
              title="Cancelar"
            >
              ×
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/*
  Confirma agendamento pela clínica.
*/
async function confirmAppointment(appointmentId) {
  const confirmAction = confirm("Deseja confirmar este agendamento?");

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .update({
      status: "clinic_confirmed",
      clinic_confirmed_at: new Date().toISOString()
    })
    .eq("id", appointmentId);

  if (error) {
    console.error("Erro ao confirmar agendamento:", error);
    alert("Erro ao confirmar agendamento.");
    return;
  }

  await loadAppointments();
}

/*
  Marca atendimento como concluído.
*/
async function completeAppointment(appointmentId) {
  const confirmAction = confirm("Deseja marcar este atendimento como concluído?");

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .update({
      status: "completed"
    })
    .eq("id", appointmentId);

  if (error) {
    console.error("Erro ao concluir atendimento:", error);
    alert("Erro ao concluir atendimento.");
    return;
  }

  await loadAppointments();
}

/*
  Cancela agendamento pela clínica.
*/
async function cancelAppointmentByClinic(appointmentId) {
  const confirmAction = confirm("Tem certeza que deseja cancelar este agendamento pela clínica?");

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .update({
      status: "cancelled_by_clinic",
      cancelled_at: new Date().toISOString()
    })
    .eq("id", appointmentId);

  if (error) {
    console.error("Erro ao cancelar agendamento:", error);
    alert("Erro ao cancelar agendamento.");
    return;
  }

  await loadAppointments();
}

/*
  Traduz status para o texto do admin.
*/
function translateStatus(status) {
  const statusMap = {
    requested: "Solicitado",
    clinic_confirmed: "Confirmado",
    patient_confirmed: "Presença conf.",
    cancelled_by_patient: "Cancelado",
    cancelled_by_clinic: "Cancelado",
    completed: "Concluído",
    no_show: "Faltou"
  };

  return statusMap[status] || status;
}

/*
  Formata data YYYY-MM-DD para DD/MM/YYYY.
*/
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