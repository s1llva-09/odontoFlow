/*
  TELA DE AGENDAMENTOS DA CLÍNICA

  Responsabilidades:
  1. Proteger a tela com login fake temporário
  2. Buscar todos os agendamentos no Supabase
  3. Renderizar a tabela
  4. Confirmar agendamento
  5. Cancelar agendamento pela clínica
  6. Marcar atendimento como concluído
*/

/*
  Verifica se o admin está logado no modo teste.
*/
const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

/*
  Seleciona elementos da tela.
*/
const appointmentsTable = document.querySelector("#appointmentsTable");
const reloadButton = document.querySelector("#reloadButton");
const logoutButton = document.querySelector("#logoutButton");

/*
  Botão sair.
*/
logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

/*
  Botão atualizar.
*/
reloadButton.addEventListener("click", () => {
  loadAppointments();
});

/*
  Carrega agendamentos ao abrir a página.
*/
loadAppointments();

/*
  Busca agendamentos no Supabase.
*/
async function loadAppointments() {
  appointmentsTable.innerHTML = `
    <tr>
      <td colspan="9">Carregando agendamentos...</td>
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
        <td colspan="9">Erro ao carregar agendamentos.</td>
      </tr>
    `;

    return;
  }

  renderAppointments(data || []);
}

/*
  Renderiza a tabela com agendamentos.
*/
function renderAppointments(appointments) {
  if (!appointments.length) {
    appointmentsTable.innerHTML = `
      <tr>
        <td colspan="9">Nenhum agendamento encontrado.</td>
      </tr>
    `;
    return;
  }

  appointmentsTable.innerHTML = appointments.map((appointment) => {
    const canConfirm = appointment.status === "requested";
    const canCancel = ![
      "cancelled_by_patient",
      "cancelled_by_clinic",
      "completed"
    ].includes(appointment.status);

    const canComplete = [
      "clinic_confirmed",
      "patient_confirmed"
    ].includes(appointment.status);

    return `
      <tr>
        <td>${appointment.code}</td>
        <td>${appointment.patients?.full_name || "-"}</td>
        <td>${appointment.patients?.phone || "-"}</td>
        <td>${appointment.procedures?.name || "-"}</td>
        <td>${appointment.dentists?.name || "-"}</td>
        <td>${formatDateToBR(appointment.appointment_date)}</td>
        <td>${appointment.appointment_time.slice(0, 5)}</td>
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
            >
              Confirmar
            </button>

            <button 
              class="table-action-btn complete"
              onclick="completeAppointment('${appointment.id}')"
              ${canComplete ? "" : "disabled"}
            >
              Concluir
            </button>

            <button 
              class="table-action-btn cancel"
              onclick="cancelAppointmentByClinic('${appointment.id}')"
              ${canCancel ? "" : "disabled"}
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/*
  Confirma o agendamento pela clínica.
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

  alert("Agendamento confirmado pela clínica.");
  loadAppointments();
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

  alert("Atendimento concluído.");
  loadAppointments();
}

/*
  Cancela o agendamento pela clínica.
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

  alert("Agendamento cancelado pela clínica.");
  loadAppointments();
}

/*
  Traduz status técnico para texto amigável.
*/
function translateStatus(status) {
  const statusMap = {
    requested: "Solicitado",
    clinic_confirmed: "Confirmado pela clínica",
    patient_confirmed: "Presença confirmada",
    cancelled_by_patient: "Cancelado pelo paciente",
    cancelled_by_clinic: "Cancelado pela clínica",
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