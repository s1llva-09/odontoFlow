/*
  TELA DE CONSULTA DE AGENDAMENTO

  Essa tela é responsável por:
  1. Receber o código do agendamento
  2. Receber telefone ou CPF do paciente
  3. Buscar o agendamento no Supabase
  4. Conferir se o telefone ou CPF pertence ao agendamento
  5. Mostrar os dados encontrados na tela
  6. Permitir confirmar presença
  7. Permitir cancelar o agendamento
*/

/*
  Seleciona o formulário de consulta.
*/
const consultForm = document.querySelector("#consultForm");

/*
  Seleciona o input do código.
*/
const codeInput = document.querySelector("#codigo");

/*
  Seleciona o input de telefone ou CPF.
*/
const contactInput = document.querySelector("#contato");

/*
  Seleciona o botão de consultar.
*/
const consultButton = document.querySelector("#consultButton");

/*
  Seleciona a área onde o resultado será exibido.
*/
const consultResult = document.querySelector("#consultResult");

/*
  Adiciona validação enquanto o usuário digita.
*/
codeInput.addEventListener("input", () => {
  codeInput.value = formatAppointmentCode(codeInput.value);
  validateConsultForm();
});

contactInput.addEventListener("input", () => {
  contactInput.value = formatContact(contactInput.value);
  validateConsultForm();
});

/*
  Valida se os campos mínimos foram preenchidos.

  O botão só libera quando:
  - código tem pelo menos 5 caracteres
  - contato tem pelo menos 5 caracteres
*/
function validateConsultForm() {
  const codeIsValid = codeInput.value.trim().length >= 5;
  const contactDigits = onlyNumbers(contactInput.value);
  const contactIsValid = contactDigits.length === 10 || contactDigits.length === 11;

  if (codeIsValid && contactIsValid) {
    enableConsultButton();
  } else {
    disableConsultButton();
  }
}

/*
  Libera o botão de consulta.
*/
function enableConsultButton() {
  consultButton.disabled = false;
  consultButton.classList.add("active");
}

/*
  Bloqueia o botão de consulta.
*/
function disableConsultButton() {
  consultButton.disabled = true;
  consultButton.classList.remove("active");
}

/*
  Quando o formulário for enviado, buscamos no Supabase.
*/
consultForm.addEventListener("submit", async (event) => {
  /*
    Evita recarregar a página.
  */
  event.preventDefault();

  /*
    Pega o código e transforma em maiúsculo.
    Assim OF-ABC123 e of-abc123 funcionam.
  */
  const code = codeInput.value.trim().toUpperCase();

  /*
    Pega telefone ou CPF digitado.
  */
  const contact = contactInput.value.trim();

  /*
    Mostra estado de carregamento no botão.
  */
  consultButton.textContent = "Buscando...";
  consultButton.disabled = true;

  /*
    Limpa resultado anterior.
  */
  consultResult.innerHTML = "";

  try {
    /*
      Busca o agendamento pelo código.

      O select também traz:
      - dados do paciente
      - dados do procedimento
      - dados do dentista
    */
    const { data, error } = await supabaseClient
      .from("appointments")
      .select(`
        *,
        patients (*),
        procedures (*),
        dentists (*)
      `)
      .eq("code", code)
      .single();

    /*
      Se der erro ou não encontrar nada, mostra mensagem.
    */
    if (error || !data) {
      showError("Nenhum agendamento encontrado com esse código.");
      return;
    }

    /*
      Verifica se o telefone ou CPF digitado bate com o paciente.
    */
    const isValidOwner = validateAppointmentOwner(data, contact);

    /*
      Se não bater, bloqueia a visualização.
    */
    if (!isValidOwner) {
      showError("O telefone ou CPF não corresponde ao agendamento informado.");
      return;
    }

    /*
      Se tudo estiver certo, mostra o agendamento.
    */
    showAppointment(data);
  } catch (error) {
    /*
      Mostra no console para debug.
    */
    console.error("Erro ao consultar agendamento:", error);

    /*
      Mostra erro na tela.
    */
    showError("Erro ao consultar agendamento. Tente novamente.");
  } finally {
    /*
      Restaura o botão.
    */
    consultButton.textContent = "🔍 Consultar agendamento";
    consultButton.disabled = false;
  }
});

/*
  Valida se o contato digitado pertence ao agendamento.

  Permitimos comparação com:
  - telefone
  - CPF

  Também limpamos caracteres especiais para facilitar.
*/
function validateAppointmentOwner(appointment, contact) {
  /*
    Remove caracteres que não são números.
    Exemplo:
    (11) 99999-9999 vira 11999999999
  */
  const cleanContact = onlyNumbers(contact);

  /*
    Pega telefone do paciente e limpa.
  */
  const patientPhone = onlyNumbers(appointment.patients.phone || "");

  /*
    Pega CPF do paciente e limpa.
  */
  const patientCpf = onlyNumbers(appointment.patients.cpf || "");

  /*
    Se o contato digitado estiver dentro do telefone ou for igual ao CPF,
    permitimos a visualização.
  */
  const phoneMatches = patientPhone.includes(cleanContact);
  const cpfMatches = patientCpf && patientCpf === cleanContact;

  return phoneMatches || cpfMatches;
}

/*
  Remove tudo que não for número.
*/
function onlyNumbers(value) {
  return String(value).replace(/\D/g, "");
}

/*
  Formata o código do agendamento.

  Mantém tudo em maiúsculo e limita o tamanho.
*/
function formatAppointmentCode(value) {
  return value
    .trim()
    .toUpperCase()
    .slice(0, 12);
}

/*
  Formata telefone ou CPF no mesmo campo.

  Regra usada:
  - se tiver 11 dígitos e começar com 0, tratamos como CPF
  - nos outros casos, tratamos como telefone
*/
function formatContact(value) {
  const digits = onlyNumbers(value).slice(0, 11);

  if (digits.length === 11 && digits.startsWith("0")) {
    return formatCpf(digits);
  }

  return formatPhone(digits);
}

/*
  Formata telefone brasileiro.
*/
function formatPhone(value) {
  const digits = onlyNumbers(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/*
  Formata CPF.
*/
function formatCpf(value) {
  const digits = onlyNumbers(value).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/*
  Mostra mensagem de erro na tela.
*/
function showError(message) {
  consultResult.innerHTML = `
    <div class="result-error">
      ${message}
    </div>
  `;
}

/*
  Mostra o agendamento encontrado.
*/
function showAppointment(appointment) {
  consultResult.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div>
          <span>Código</span>
          <strong>${appointment.code}</strong>
        </div>

        <span class="result-status">
          ${translateStatus(appointment.status)}
        </span>
      </div>

      <div class="result-row">
        <span>Paciente</span>
        <strong>${appointment.patients.full_name}</strong>
      </div>

      <div class="result-row">
        <span>Procedimento</span>
        <strong>${appointment.procedures.name}</strong>
      </div>

      <div class="result-row">
        <span>Dentista</span>
        <strong>${appointment.dentists.name}</strong>
      </div>

      <div class="result-row">
        <span>Data</span>
        <strong>${formatDateToBR(appointment.appointment_date)}</strong>
      </div>

      <div class="result-row">
        <span>Horário</span>
        <strong>${appointment.appointment_time.slice(0, 5)}</strong>
      </div>

      <div class="result-row">
        <span>Status</span>
        <strong>${translateStatus(appointment.status)}</strong>
      </div>

      <div class="result-actions">
        <button 
          type="button" 
          onclick="confirmPresence('${appointment.id}')"
          ${appointment.status === "patient_confirmed" ? "disabled" : ""}
        >
          Confirmar presença
        </button>

        <button type="button">
          Solicitar reagendamento
        </button>

        <button 
          type="button" 
          class="danger" 
          onclick="cancelAppointment('${appointment.id}')"
          ${appointment.status === "cancelled_by_patient" ? "disabled" : ""}
        >
          Cancelar
        </button>
      </div>
    </div>
  `;
}

/*
  Traduz status interno do banco para texto amigável.
*/
function translateStatus(status) {
  const statusMap = {
    requested: "Aguardando confirmação da clínica",
    clinic_confirmed: "Confirmado pela clínica",
    patient_confirmed: "Presença confirmada pelo paciente",
    cancelled_by_patient: "Cancelado pelo paciente",
    cancelled_by_clinic: "Cancelado pela clínica",
    completed: "Concluído",
    no_show: "Paciente faltou"
  };

  return statusMap[status] || status;
}

/*
  Formata data do banco para padrão brasileiro.

  Entrada:
  2026-05-22

  Saída:
  22/05/2026
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

/*
  Confirma presença do paciente.

  Atualiza:
  - status para patient_confirmed
  - patient_confirmed_at para a data/hora atual
*/
async function confirmPresence(appointmentId) {
  const confirmAction = confirm("Deseja confirmar sua presença nesta consulta?");

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .update({
      status: "patient_confirmed",
      patient_confirmed_at: new Date().toISOString()
    })
    .eq("id", appointmentId);

  if (error) {
    console.error("Erro ao confirmar presença:", error);
    alert("Erro ao confirmar presença.");
    return;
  }

  alert("Presença confirmada com sucesso!");

  /*
    Reenvia o formulário para atualizar o card na tela.
  */
  consultForm.dispatchEvent(new Event("submit"));
}

/*
  Cancela o agendamento pelo paciente.

  Atualiza:
  - status para cancelled_by_patient
  - cancelled_at para a data/hora atual
*/
async function cancelAppointment(appointmentId) {
  const confirmCancel = confirm("Tem certeza que deseja cancelar este agendamento?");

  if (!confirmCancel) {
    return;
  }

  const { error } = await supabaseClient
    .from("appointments")
    .update({
      status: "cancelled_by_patient",
      cancelled_at: new Date().toISOString()
    })
    .eq("id", appointmentId);

  if (error) {
    console.error("Erro ao cancelar agendamento:", error);
    alert("Erro ao cancelar agendamento.");
    return;
  }

  alert("Agendamento cancelado com sucesso!");

  /*
    Reenvia o formulário para atualizar o card na tela.
  */
  consultForm.dispatchEvent(new Event("submit"));
}
