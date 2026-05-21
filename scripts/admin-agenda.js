/*
  TELA ADMIN AGENDA

  Agora a agenda abre um modal real ao clicar no agendamento.
  Pelo modal, a clínica pode:
  - confirmar
  - concluir
  - cancelar
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const previousWeekButton = document.querySelector("#previousWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");
const todayButton = document.querySelector("#todayButton");
const weekRangeTitle = document.querySelector("#weekRangeTitle");

const agendaStatusFilter = document.querySelector("#agendaStatusFilter");
const agendaDentistFilter = document.querySelector("#agendaDentistFilter");
const newAgendaAppointmentButton = document.querySelector("#newAgendaAppointmentButton");

const agendaGrid = document.querySelector("#agendaGrid");

/*
  Elementos do modal.
*/
const agendaAppointmentModal = document.querySelector("#agendaAppointmentModal");
const closeAgendaModal = document.querySelector("#closeAgendaModal");
const closeAgendaModalFooter = document.querySelector("#closeAgendaModalFooter");

const modalAppointmentPatient = document.querySelector("#modalAppointmentPatient");
const modalAppointmentCode = document.querySelector("#modalAppointmentCode");

const modalAgendaPatient = document.querySelector("#modalAgendaPatient");
const modalAgendaPhone = document.querySelector("#modalAgendaPhone");
const modalAgendaEmail = document.querySelector("#modalAgendaEmail");
const modalAgendaProcedure = document.querySelector("#modalAgendaProcedure");
const modalAgendaDentist = document.querySelector("#modalAgendaDentist");
const modalAgendaPrice = document.querySelector("#modalAgendaPrice");
const modalAgendaDate = document.querySelector("#modalAgendaDate");
const modalAgendaTime = document.querySelector("#modalAgendaTime");
const modalAgendaStatus = document.querySelector("#modalAgendaStatus");
const modalAgendaNotes = document.querySelector("#modalAgendaNotes");

const confirmAgendaAppointmentButton = document.querySelector("#confirmAgendaAppointmentButton");
const completeAgendaAppointmentButton = document.querySelector("#completeAgendaAppointmentButton");
const cancelAgendaAppointmentButton = document.querySelector("#cancelAgendaAppointmentButton");

let currentWeekDate = new Date();
let allAppointments = [];
let allDentists = [];
let selectedAppointment = null;

/*
  Horários exibidos na agenda.
  Depois podemos puxar isso da tela de Configurações > Horários.
*/
const agendaHours = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00"
];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

previousWeekButton.addEventListener("click", () => {
  currentWeekDate.setDate(currentWeekDate.getDate() - 7);
  loadAgenda();
});

nextWeekButton.addEventListener("click", () => {
  currentWeekDate.setDate(currentWeekDate.getDate() + 7);
  loadAgenda();
});

todayButton.addEventListener("click", () => {
  currentWeekDate = new Date();
  loadAgenda();
});

agendaStatusFilter.addEventListener("change", () => {
  renderAgenda();
});

agendaDentistFilter.addEventListener("change", () => {
  renderAgenda();
});

newAgendaAppointmentButton.addEventListener("click", () => {
  window.location.href = "./agendamento.html";
});

/*
  Fechamento do modal.
*/
closeAgendaModal.addEventListener("click", closeAppointmentModal);
closeAgendaModalFooter.addEventListener("click", closeAppointmentModal);

agendaAppointmentModal.addEventListener("click", (event) => {
  if (event.target === agendaAppointmentModal) {
    closeAppointmentModal();
  }
});

/*
  Ações do modal.
*/
confirmAgendaAppointmentButton.addEventListener("click", () => {
  if (!selectedAppointment) return;
  confirmAppointment(selectedAppointment.id);
});

completeAgendaAppointmentButton.addEventListener("click", () => {
  if (!selectedAppointment) return;
  completeAppointment(selectedAppointment.id);
});

cancelAgendaAppointmentButton.addEventListener("click", () => {
  if (!selectedAppointment) return;
  cancelAppointmentByClinic(selectedAppointment.id);
});

loadAgenda();

async function loadAgenda() {
  agendaGrid.innerHTML = `
    <div class="agenda-loading">
      Carregando agenda...
    </div>
  `;

  await loadDentists();
  await loadAppointments();

  renderAgenda();
}

async function loadDentists() {
  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar dentistas:", error);
    allDentists = [];
    return;
  }

  allDentists = data || [];

  populateDentistFilter();
}

function populateDentistFilter() {
  const currentValue = agendaDentistFilter.value || "all";

  agendaDentistFilter.innerHTML = `
    <option value="all">Todos os dentistas</option>
  `;

  allDentists.forEach((dentist) => {
    agendaDentistFilter.innerHTML += `
      <option value="${dentist.id}">
        ${dentist.name}
      </option>
    `;
  });

  agendaDentistFilter.value = currentValue;
}

async function loadAppointments() {
  const weekDays = getWeekDays(currentWeekDate);
  const startDate = formatDateToDatabase(weekDays[0]);
  const endDate = formatDateToDatabase(weekDays[6]);

  const { data, error } = await supabaseClient
    .from("appointments")
    .select(`
      *,
      patients (*),
      procedures (*),
      dentists (*)
    `)
    .gte("appointment_date", startDate)
    .lte("appointment_date", endDate)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agendamentos da semana:", error);
    allAppointments = [];
    return;
  }

  allAppointments = data || [];
}

function renderAgenda() {
  const weekDays = getWeekDays(currentWeekDate);

  updateWeekTitle(weekDays);

  const filteredAppointments = getFilteredAppointments();

  let html = "";

  html += `<div class="agenda-corner"></div>`;

  weekDays.forEach((day) => {
    const isToday = isSameDate(day, new Date());

    html += `
      <div class="agenda-day-header ${isToday ? "today" : ""}">
        <span>${getWeekDayName(day)}</span>
        <strong>${day.getDate()}</strong>
      </div>
    `;
  });

  agendaHours.forEach((hour) => {
    html += `
      <div class="agenda-hour-cell">
        ${hour}
      </div>
    `;

    weekDays.forEach((day) => {
      const dateString = formatDateToDatabase(day);

      const hourAppointments = filteredAppointments.filter((appointment) => {
        const appointmentHour = appointment.appointment_time?.slice(0, 5);

        return (
          appointment.appointment_date === dateString &&
          appointmentHour === hour
        );
      });

      html += `
        <div class="agenda-slot">
          ${renderAppointmentsInSlot(hourAppointments)}
        </div>
      `;
    });
  });

  agendaGrid.innerHTML = html;
}

function renderAppointmentsInSlot(appointments) {
  if (!appointments.length) {
    return "";
  }

  return appointments.map((appointment) => {
    const statusClass = getAgendaStatusClass(appointment.status);

    return `
      <button 
        class="agenda-appointment ${statusClass}"
        type="button"
        title="${appointment.code || ""}"
        onclick="openAppointmentFromAgenda('${appointment.id}')"
      >
        <strong>${appointment.patients?.full_name || "Paciente"}</strong>
        <span>${appointment.procedures?.name || "Procedimento"}</span>
      </button>
    `;
  }).join("");
}

function getFilteredAppointments() {
  const selectedStatus = agendaStatusFilter.value;
  const selectedDentist = agendaDentistFilter.value;

  let filtered = [...allAppointments];

  if (selectedStatus !== "all") {
    filtered = filtered.filter((appointment) => {
      return appointment.status === selectedStatus;
    });
  }

  if (selectedDentist !== "all") {
    filtered = filtered.filter((appointment) => {
      return appointment.dentist_id === selectedDentist;
    });
  }

  return filtered;
}

function openAppointmentFromAgenda(appointmentId) {
  const appointment = allAppointments.find((item) => {
    return item.id === appointmentId;
  });

  if (!appointment) {
    alert("Agendamento não encontrado.");
    return;
  }

  selectedAppointment = appointment;

  modalAppointmentPatient.textContent = appointment.patients?.full_name || "Agendamento";
  modalAppointmentCode.textContent = appointment.code || "Sem código";

  modalAgendaPatient.textContent = appointment.patients?.full_name || "-";
  modalAgendaPhone.textContent = appointment.patients?.phone || "-";
  modalAgendaEmail.textContent = appointment.patients?.email || "-";
  modalAgendaProcedure.textContent = appointment.procedures?.name || "-";
  modalAgendaDentist.textContent = appointment.dentists?.name || "-";
  modalAgendaPrice.textContent = formatCurrency(appointment.procedures?.price || 0);
  modalAgendaDate.textContent = formatDateToBR(appointment.appointment_date);
  modalAgendaTime.textContent = appointment.appointment_time?.slice(0, 5) || "-";
  modalAgendaStatus.textContent = translateStatus(appointment.status);
  modalAgendaNotes.textContent = appointment.notes || "Nenhuma observação informada.";

  updateModalActionButtons(appointment.status);

  agendaAppointmentModal.classList.add("active");
}

function updateModalActionButtons(status) {
  const canConfirm = status === "requested";

  const canComplete = [
    "clinic_confirmed",
    "patient_confirmed"
  ].includes(status);

  const canCancel = ![
    "cancelled_by_patient",
    "cancelled_by_clinic",
    "completed"
  ].includes(status);

  confirmAgendaAppointmentButton.disabled = !canConfirm;
  completeAgendaAppointmentButton.disabled = !canComplete;
  cancelAgendaAppointmentButton.disabled = !canCancel;
}

function closeAppointmentModal() {
  selectedAppointment = null;
  agendaAppointmentModal.classList.remove("active");
}

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

  closeAppointmentModal();
  await loadAgenda();
}

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

  closeAppointmentModal();
  await loadAgenda();
}

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

  closeAppointmentModal();
  await loadAgenda();
}

function getWeekDays(referenceDate) {
  const date = new Date(referenceDate);
  const dayOfWeek = date.getDay();
  const mondayDistance = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayDistance);

  const days = [];

  for (let index = 0; index < 7; index++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    days.push(day);
  }

  return days;
}

function updateWeekTitle(weekDays) {
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];

  const firstDayText = firstDay.getDate();
  const lastDayText = lastDay.getDate();

  const monthText = lastDay.toLocaleDateString("pt-BR", {
    month: "long"
  });

  const yearText = lastDay.getFullYear();

  weekRangeTitle.textContent = `${firstDayText}–${lastDayText} de ${capitalize(monthText)}, ${yearText}`;
}

function getWeekDayName(date) {
  const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return names[date.getDay()];
}

function isSameDate(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function formatDateToDatabase(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getAgendaStatusClass(status) {
  const statusMap = {
    requested: "requested",
    clinic_confirmed: "clinic_confirmed",
    patient_confirmed: "patient_confirmed",
    completed: "completed",
    cancelled_by_patient: "cancelled",
    cancelled_by_clinic: "cancelled"
  };

  return statusMap[status] || "requested";
}

function translateStatus(status) {
  const statusMap = {
    requested: "Solicitado",
    clinic_confirmed: "Confirmado",
    patient_confirmed: "Presença confirmada",
    cancelled_by_patient: "Cancelado pelo paciente",
    cancelled_by_clinic: "Cancelado pela clínica",
    completed: "Concluído",
    no_show: "Faltou"
  };

  return statusMap[status] || status;
}

function capitalize(text) {
  if (!text) {
    return "";
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}