/*
  TELA ADMIN DE PACIENTES

  Agora o botão do olho abre um modal real
  com detalhes do paciente e histórico de agendamentos.
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const patientsTable = document.querySelector("#patientsTable");
const patientSearchInput = document.querySelector("#patientSearchInput");
const patientStatusFilter = document.querySelector("#patientStatusFilter");
const patientsCount = document.querySelector("#patientsCount");
const logoutButton = document.querySelector("#logoutButton");
const newPatientButton = document.querySelector("#newPatientButton");

const patientModal = document.querySelector("#patientModal");
const closePatientModal = document.querySelector("#closePatientModal");
const closePatientModalFooter = document.querySelector("#closePatientModalFooter");

const modalPatientName = document.querySelector("#modalPatientName");
const modalPatientEmail = document.querySelector("#modalPatientEmail");
const modalPatientPhone = document.querySelector("#modalPatientPhone");
const modalPatientCpf = document.querySelector("#modalPatientCpf");
const modalPatientBirth = document.querySelector("#modalPatientBirth");
const modalPatientSpent = document.querySelector("#modalPatientSpent");
const modalPatientAppointments = document.querySelector("#modalPatientAppointments");
const modalPatientLastAppointment = document.querySelector("#modalPatientLastAppointment");
const modalPatientAppointmentsTable = document.querySelector("#modalPatientAppointmentsTable");

let allPatients = [];
let allAppointments = [];

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

newPatientButton.addEventListener("click", () => {
  alert("Cadastro manual de paciente será feito depois. Por enquanto, pacientes entram pelo agendamento.");
});

patientSearchInput.addEventListener("input", applyFilters);
patientStatusFilter.addEventListener("change", applyFilters);

closePatientModal.addEventListener("click", closeModal);
closePatientModalFooter.addEventListener("click", closeModal);

patientModal.addEventListener("click", (event) => {
  if (event.target === patientModal) {
    closeModal();
  }
});

loadPatients();

async function loadPatients() {
  patientsTable.innerHTML = `
    <tr>
      <td colspan="7">Carregando pacientes...</td>
    </tr>
  `;

  const { data: patients, error: patientsError } = await supabaseClient
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (patientsError) {
    console.error("Erro ao buscar pacientes:", patientsError);

    patientsTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar pacientes.</td>
      </tr>
    `;

    return;
  }

  const { data: appointments, error: appointmentsError } = await supabaseClient
    .from("appointments")
    .select(`
      *,
      procedures (*),
      dentists (*)
    `)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (appointmentsError) {
    console.error("Erro ao buscar agendamentos dos pacientes:", appointmentsError);
  }

  allAppointments = appointments || [];

  allPatients = buildPatientsWithStats(
    patients || [],
    allAppointments
  );

  renderPatients(allPatients);
}

function buildPatientsWithStats(patients, appointments) {
  return patients.map((patient) => {
    const patientAppointments = appointments.filter((appointment) => {
      return appointment.patient_id === patient.id;
    });

    const validAppointments = patientAppointments.filter((appointment) => {
      return ![
        "cancelled_by_patient",
        "cancelled_by_clinic",
        "no_show"
      ].includes(appointment.status);
    });

    const totalSpent = validAppointments.reduce((total, appointment) => {
      return total + Number(appointment.procedures?.price || 0);
    }, 0);

    const lastAppointment = patientAppointments[0];

    const status = patientAppointments.length > 0 ? "active" : "inactive";

    return {
      ...patient,
      appointments: patientAppointments,
      totalSpent,
      totalAppointments: patientAppointments.length,
      lastAppointmentDate: lastAppointment ? lastAppointment.appointment_date : null,
      status
    };
  });
}

function applyFilters() {
  const searchTerm = patientSearchInput.value.trim().toLowerCase();
  const selectedStatus = patientStatusFilter.value;

  let filteredPatients = [...allPatients];

  if (selectedStatus !== "all") {
    filteredPatients = filteredPatients.filter((patient) => {
      return patient.status === selectedStatus;
    });
  }

  if (searchTerm) {
    filteredPatients = filteredPatients.filter((patient) => {
      const name = patient.full_name || "";
      const phone = patient.phone || "";
      const email = patient.email || "";
      const cpf = patient.cpf || "";

      return (
        name.toLowerCase().includes(searchTerm) ||
        phone.toLowerCase().includes(searchTerm) ||
        email.toLowerCase().includes(searchTerm) ||
        cpf.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderPatients(filteredPatients);
}

function renderPatients(patients) {
  patientsCount.textContent = `Mostrando ${patients.length} de ${allPatients.length} pacientes`;

  if (!patients.length) {
    patientsTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhum paciente encontrado.</td>
      </tr>
    `;

    return;
  }

  patientsTable.innerHTML = patients.map((patient) => {
    const initials = getInitials(patient.full_name);
    const statusText = patient.status === "active" ? "Ativo" : "Inativo";
    const statusClass = patient.status === "active" ? "status-active" : "status-inactive";

    return `
      <tr>
        <td>
          <div class="patient-name-cell">
            <span class="admin-avatar">${initials}</span>
            <strong>${patient.full_name || "-"}</strong>
          </div>
        </td>

        <td>${patient.phone || "-"}</td>

        <td>${patient.email || "-"}</td>

        <td>${patient.lastAppointmentDate ? formatDateToBR(patient.lastAppointmentDate) : "-"}</td>

        <td>
          <strong>${formatCurrency(patient.totalSpent || 0)}</strong>
        </td>

        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>

        <td>
          <button 
            class="admin-icon-btn" 
            type="button" 
            title="Visualizar paciente"
            onclick="viewPatient('${patient.id}')"
          >
            👁
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function viewPatient(patientId) {
  const patient = allPatients.find((item) => {
    return item.id === patientId;
  });

  if (!patient) {
    alert("Paciente não encontrado.");
    return;
  }

  modalPatientName.textContent = patient.full_name || "Paciente";
  modalPatientEmail.textContent = patient.email || "Sem e-mail cadastrado";
  modalPatientPhone.textContent = patient.phone || "-";
  modalPatientCpf.textContent = patient.cpf || "-";
  modalPatientBirth.textContent = patient.birth_date
    ? formatDateToBR(patient.birth_date)
    : "-";

  modalPatientSpent.textContent = formatCurrency(patient.totalSpent || 0);
  modalPatientAppointments.textContent = patient.totalAppointments || 0;
  modalPatientLastAppointment.textContent = patient.lastAppointmentDate
    ? formatDateToBR(patient.lastAppointmentDate)
    : "-";

  renderPatientAppointments(patient.appointments || []);

  patientModal.classList.add("active");
}

function renderPatientAppointments(appointments) {
  if (!appointments.length) {
    modalPatientAppointmentsTable.innerHTML = `
      <tr>
        <td colspan="6">Nenhum agendamento encontrado.</td>
      </tr>
    `;

    return;
  }

  modalPatientAppointmentsTable.innerHTML = appointments.map((appointment) => {
    return `
      <tr>
        <td>${appointment.code || "-"}</td>
        <td>${appointment.procedures?.name || "-"}</td>
        <td>${appointment.dentists?.name || "-"}</td>
        <td>${formatDateToBR(appointment.appointment_date)}</td>
        <td>${appointment.appointment_time?.slice(0, 5) || "-"}</td>
        <td>
          <span class="status-badge status-${appointment.status}">
            ${translateStatus(appointment.status)}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

function closeModal() {
  patientModal.classList.remove("active");
}

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

function getInitials(name) {
  if (!name) {
    return "?";
  }

  const words = name.trim().split(" ").filter(Boolean);

  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
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