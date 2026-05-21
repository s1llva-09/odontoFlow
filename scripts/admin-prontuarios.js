/*
  TELA ADMIN DE PRONTUÁRIOS

  Responsabilidades:
  1. Verificar login fake temporário
  2. Buscar pacientes e dentistas
  3. Buscar prontuários
  4. Criar prontuário
  5. Editar prontuário
  6. Visualizar detalhes em modal
  7. Filtrar por busca e status
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const logoutButton = document.querySelector("#logoutButton");

const openRecordFormButton = document.querySelector("#openRecordFormButton");
const recordFormPanel = document.querySelector("#recordFormPanel");
const cancelRecordFormButton = document.querySelector("#cancelRecordFormButton");
const recordFormTitle = document.querySelector("#recordFormTitle");

const recordForm = document.querySelector("#recordForm");
const editingRecordIdInput = document.querySelector("#editingRecordId");

const recordPatientInput = document.querySelector("#recordPatient");
const recordDentistInput = document.querySelector("#recordDentist");
const recordDateInput = document.querySelector("#recordDate");
const chiefComplaintInput = document.querySelector("#chiefComplaint");
const clinicalHistoryInput = document.querySelector("#clinicalHistory");
const diagnosisInput = document.querySelector("#diagnosis");
const performedProcedureInput = document.querySelector("#performedProcedure");
const dentistNotesInput = document.querySelector("#dentistNotes");
const recommendedReturnDaysInput = document.querySelector("#recommendedReturnDays");
const recordStatusInput = document.querySelector("#recordStatus");
const saveRecordButton = document.querySelector("#saveRecordButton");

const recordSearchInput = document.querySelector("#recordSearchInput");
const recordStatusFilter = document.querySelector("#recordStatusFilter");
const recordsTable = document.querySelector("#recordsTable");
const recordsCount = document.querySelector("#recordsCount");

const recordModal = document.querySelector("#recordModal");
const closeRecordModal = document.querySelector("#closeRecordModal");
const closeRecordModalFooter = document.querySelector("#closeRecordModalFooter");

const modalRecordTitle = document.querySelector("#modalRecordTitle");
const modalRecordSubtitle = document.querySelector("#modalRecordSubtitle");
const modalRecordPatient = document.querySelector("#modalRecordPatient");
const modalRecordDentist = document.querySelector("#modalRecordDentist");
const modalRecordDate = document.querySelector("#modalRecordDate");
const modalRecordStatus = document.querySelector("#modalRecordStatus");
const modalRecordReturn = document.querySelector("#modalRecordReturn");

const modalChiefComplaint = document.querySelector("#modalChiefComplaint");
const modalClinicalHistory = document.querySelector("#modalClinicalHistory");
const modalDiagnosis = document.querySelector("#modalDiagnosis");
const modalPerformedProcedure = document.querySelector("#modalPerformedProcedure");
const modalDentistNotes = document.querySelector("#modalDentistNotes");

let allPatients = [];
let allDentists = [];
let allRecords = [];

recordDateInput.value = getTodayDate();

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

openRecordFormButton.addEventListener("click", () => {
  openCreateRecordForm();
});

cancelRecordFormButton.addEventListener("click", () => {
  closeRecordForm();
});

recordSearchInput.addEventListener("input", applyFilters);
recordStatusFilter.addEventListener("change", applyFilters);

closeRecordModal.addEventListener("click", closeModal);
closeRecordModalFooter.addEventListener("click", closeModal);

recordModal.addEventListener("click", (event) => {
  if (event.target === recordModal) {
    closeModal();
  }
});

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editingRecordId = editingRecordIdInput.value;

  const patientId = recordPatientInput.value;
  const dentistId = recordDentistInput.value;
  const recordDate = recordDateInput.value;

  if (!patientId || !dentistId || !recordDate) {
    alert("Selecione paciente, dentista e data.");
    return;
  }

  const recordData = {
    patient_id: patientId,
    dentist_id: dentistId,
    record_date: recordDate,
    chief_complaint: chiefComplaintInput.value.trim() || null,
    clinical_history: clinicalHistoryInput.value.trim() || null,
    diagnosis: diagnosisInput.value.trim() || null,
    performed_procedure: performedProcedureInput.value.trim() || null,
    dentist_notes: dentistNotesInput.value.trim() || null,
    recommended_return_days: recommendedReturnDaysInput.value
      ? Number(recommendedReturnDaysInput.value)
      : null,
    status: recordStatusInput.value,
    updated_at: new Date().toISOString()
  };

  saveRecordButton.textContent = editingRecordId ? "Salvando alterações..." : "Salvando...";
  saveRecordButton.disabled = true;

  let result;

  if (editingRecordId) {
    result = await supabaseClient
      .from("medical_records")
      .update(recordData)
      .eq("id", editingRecordId);
  } else {
    result = await supabaseClient
      .from("medical_records")
      .insert(recordData);
  }

  if (result.error) {
    console.error("Erro ao salvar prontuário:", result.error);
    alert("Erro ao salvar prontuário.");

    saveRecordButton.textContent = editingRecordId ? "Salvar alterações" : "Salvar prontuário";
    saveRecordButton.disabled = false;

    return;
  }

  closeRecordForm();
  await loadPageData();

  alert(editingRecordId ? "Prontuário atualizado com sucesso!" : "Prontuário cadastrado com sucesso!");
});

loadPageData();

async function loadPageData() {
  await Promise.all([
    loadPatients(),
    loadDentists()
  ]);

  await loadRecords();
}

async function loadPatients() {
  const { data, error } = await supabaseClient
    .from("patients")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pacientes:", error);
    allPatients = [];
    return;
  }

  allPatients = data || [];
  populatePatientsSelect();
}

async function loadDentists() {
  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar dentistas:", error);
    allDentists = [];
    return;
  }

  allDentists = data || [];
  populateDentistsSelect();
}

async function loadRecords() {
  recordsTable.innerHTML = `
    <tr>
      <td colspan="7">Carregando prontuários...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("medical_records")
    .select(`
      *,
      patients (*),
      dentists (*)
    `)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar prontuários:", error);

    recordsTable.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar prontuários.</td>
      </tr>
    `;

    return;
  }

  allRecords = data || [];
  renderRecords(allRecords);
}

function populatePatientsSelect() {
  recordPatientInput.innerHTML = `
    <option value="">Selecione o paciente</option>
  `;

  allPatients.forEach((patient) => {
    recordPatientInput.innerHTML += `
      <option value="${patient.id}">
        ${patient.full_name}
      </option>
    `;
  });
}

function populateDentistsSelect() {
  recordDentistInput.innerHTML = `
    <option value="">Selecione o dentista</option>
  `;

  allDentists.forEach((dentist) => {
    recordDentistInput.innerHTML += `
      <option value="${dentist.id}">
        ${dentist.name}
      </option>
    `;
  });
}

function applyFilters() {
  const searchTerm = recordSearchInput.value.trim().toLowerCase();
  const selectedStatus = recordStatusFilter.value;

  let filteredRecords = [...allRecords];

  if (selectedStatus !== "all") {
    filteredRecords = filteredRecords.filter((record) => {
      return record.status === selectedStatus;
    });
  }

  if (searchTerm) {
    filteredRecords = filteredRecords.filter((record) => {
      const patient = record.patients?.full_name || "";
      const dentist = record.dentists?.name || "";
      const procedure = record.performed_procedure || "";
      const diagnosis = record.diagnosis || "";

      return (
        patient.toLowerCase().includes(searchTerm) ||
        dentist.toLowerCase().includes(searchTerm) ||
        procedure.toLowerCase().includes(searchTerm) ||
        diagnosis.toLowerCase().includes(searchTerm)
      );
    });
  }

  renderRecords(filteredRecords);
}

function renderRecords(records) {
  recordsCount.textContent = `Mostrando ${records.length} de ${allRecords.length} prontuários`;

  if (!records.length) {
    recordsTable.innerHTML = `
      <tr>
        <td colspan="7">Nenhum prontuário encontrado.</td>
      </tr>
    `;
    return;
  }

  recordsTable.innerHTML = records.map((record) => {
    return `
      <tr>
        <td>${record.patients?.full_name || "-"}</td>
        <td>${record.dentists?.name || "-"}</td>
        <td>${formatDateToBR(record.record_date)}</td>
        <td>${record.performed_procedure || "-"}</td>
        <td>${record.diagnosis || "-"}</td>
        <td>
          <span class="status-badge ${getRecordStatusClass(record.status)}">
            ${translateRecordStatus(record.status)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button 
              class="admin-icon-btn" 
              type="button" 
              title="Visualizar prontuário"
              onclick="viewRecord('${record.id}')"
            >
              👁
            </button>

            <button 
              class="admin-icon-btn" 
              type="button" 
              title="Editar prontuário"
              onclick="editRecord('${record.id}')"
            >
              ✎
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCreateRecordForm() {
  recordForm.reset();
  editingRecordIdInput.value = "";
  recordDateInput.value = getTodayDate();

  recordFormTitle.textContent = "Novo prontuário";
  saveRecordButton.textContent = "Salvar prontuário";

  recordFormPanel.style.display = "block";
  openRecordFormButton.style.display = "none";

  recordPatientInput.focus();
}

function editRecord(recordId) {
  const record = allRecords.find((item) => item.id === recordId);

  if (!record) {
    alert("Prontuário não encontrado.");
    return;
  }

  editingRecordIdInput.value = record.id;

  recordPatientInput.value = record.patient_id || "";
  recordDentistInput.value = record.dentist_id || "";
  recordDateInput.value = record.record_date || getTodayDate();
  chiefComplaintInput.value = record.chief_complaint || "";
  clinicalHistoryInput.value = record.clinical_history || "";
  diagnosisInput.value = record.diagnosis || "";
  performedProcedureInput.value = record.performed_procedure || "";
  dentistNotesInput.value = record.dentist_notes || "";
  recommendedReturnDaysInput.value = record.recommended_return_days || "";
  recordStatusInput.value = record.status || "completed";

  recordFormTitle.textContent = "Editar prontuário";
  saveRecordButton.textContent = "Salvar alterações";

  recordFormPanel.style.display = "block";
  openRecordFormButton.style.display = "none";

  recordFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeRecordForm() {
  recordForm.reset();
  editingRecordIdInput.value = "";
  recordDateInput.value = getTodayDate();

  recordFormTitle.textContent = "Novo prontuário";
  saveRecordButton.textContent = "Salvar prontuário";
  saveRecordButton.disabled = false;

  recordFormPanel.style.display = "none";
  openRecordFormButton.style.display = "inline-flex";
}

function viewRecord(recordId) {
  const record = allRecords.find((item) => item.id === recordId);

  if (!record) {
    alert("Prontuário não encontrado.");
    return;
  }

  modalRecordTitle.textContent = `Prontuário — ${record.patients?.full_name || "Paciente"}`;
  modalRecordSubtitle.textContent = `${record.dentists?.name || "Dentista"} • ${formatDateToBR(record.record_date)}`;

  modalRecordPatient.textContent = record.patients?.full_name || "-";
  modalRecordDentist.textContent = record.dentists?.name || "-";
  modalRecordDate.textContent = formatDateToBR(record.record_date);
  modalRecordStatus.textContent = translateRecordStatus(record.status);
  modalRecordReturn.textContent = record.recommended_return_days
    ? `${record.recommended_return_days} dias`
    : "-";

  modalChiefComplaint.textContent = record.chief_complaint || "-";
  modalClinicalHistory.textContent = record.clinical_history || "-";
  modalDiagnosis.textContent = record.diagnosis || "-";
  modalPerformedProcedure.textContent = record.performed_procedure || "-";
  modalDentistNotes.textContent = record.dentist_notes || "-";

  recordModal.classList.add("active");
}

function closeModal() {
  recordModal.classList.remove("active");
}

function getRecordStatusClass(status) {
  const statusMap = {
    completed: "status-completed",
    in_treatment: "status-confirmed",
    follow_up: "status-warning"
  };

  return statusMap[status] || "status-neutral";
}

function translateRecordStatus(status) {
  const statusMap = {
    completed: "Concluído",
    in_treatment: "Em tratamento",
    follow_up: "Retorno"
  };

  return statusMap[status] || status;
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
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