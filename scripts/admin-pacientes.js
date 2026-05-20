const logoutButton = document.querySelector("#logoutButton");
const reloadButton = document.querySelector("#reloadButton");
const patientSearchInput = document.querySelector("#patientSearchInput");
const patientsTable = document.querySelector("#patientsTable");

let patients = [];

protectAdminPage();
setupLogout();
loadPatients();

reloadButton.addEventListener("click", loadPatients);
patientSearchInput.addEventListener("input", () => {
  renderPatients(filterPatients(patientSearchInput.value));
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

async function loadPatients() {
  patientsTable.innerHTML = `
    <tr>
      <td colspan="7">Carregando pacientes...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("patients")
    .select(`
      *,
      appointments (
        appointment_date,
        appointment_time
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar pacientes:", error);
    patientsTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar pacientes.</td>
      </tr>
    `;
    return;
  }

  patients = data || [];
  renderPatients(filterPatients(patientSearchInput.value));
}

function filterPatients(searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);

  if (!normalizedSearch) {
    return patients;
  }

  return patients.filter((patient) => {
    const searchableText = normalizeText([
      patient.full_name,
      patient.phone,
      patient.email,
      patient.cpf
    ].join(" "));

    return searchableText.includes(normalizedSearch);
  });
}

function renderPatients(patientList) {
  if (patientList.length === 0) {
    patientsTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhum paciente encontrado.</td>
      </tr>
    `;
    return;
  }

  patientsTable.innerHTML = patientList
    .map((patient) => {
      return `
        <tr>
          <td>${patient.full_name || "-"}</td>
          <td>${patient.phone || "-"}</td>
          <td>${patient.email || "-"}</td>
          <td>${patient.cpf || "-"}</td>
          <td>${formatDateToBR(patient.created_at)}</td>
          <td>${patient.appointments?.length || 0}</td>
          <td>${getLastAppointmentDate(patient.appointments || [])}</td>
        </tr>
      `;
    })
    .join("");
}

function getLastAppointmentDate(appointments) {
  if (appointments.length === 0) {
    return "-";
  }

  const sortedAppointments = [...appointments].sort((first, second) => {
    const firstDate = `${first.appointment_date || ""} ${first.appointment_time || ""}`;
    const secondDate = `${second.appointment_date || ""} ${second.appointment_time || ""}`;

    return secondDate.localeCompare(firstDate);
  });

  return formatDateToBR(sortedAppointments[0].appointment_date);
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
