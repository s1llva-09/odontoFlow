
/*
  TELA DE CONFIRMAÇÃO DO AGENDAMENTO

  Essa tela é responsável por:
  1. Buscar no localStorage tudo que o paciente escolheu
  2. Mostrar o resumo do agendamento na tela
  3. Criar o paciente no Supabase
  4. Criar o agendamento no Supabase
  5. Salvar o último agendamento criado para mostrar na tela de sucesso
  6. Redirecionar para sucesso.html
*/

/*
  Busca o agendamento temporário salvo durante o fluxo.
*/
const appointment = getCurrentAppointment()

/*
  Seleciona os campos do resumo no HTML.
*/

const summaryProcedure = document.querySelector("#summaryProcedure")
const summaryDentist = document.querySelector("#summaryDentist")
const summaryDate = document.querySelector("#summaryDate")
const summaryTime = document.querySelector("#summaryTime")
const summaryPatient = document.querySelector("#summaryPatient")
const summaryPrice = document.querySelector("#summaryPrice")

/*
  Seleciona o botão final de confirmação.
*/
const confirmButton = document.querySelector("#confirmButton")

/*
  Antes de preencher a tela, verificamos se existem todos os dados necessários.

  Se o usuário tentar abrir confirmacao.html direto,
  sem passar pelas etapas anteriores, mandamos ele de volta para agendamento.html.
*/
if (
  !appointment.procedure ||
  !appointment.dentist ||
  !appointment.date ||
  !appointment.time ||
  !appointment.patient
) {
  window.location.href = "./agendamento.html";
}

/*
  Preenche o resumo com os dados reais do agendamento.
*/
summaryProcedure.textContent = appointment.procedure.name
summaryDentist.textContent = appointment.dentist.name
summaryDate.textContent = formatDateToBR(appointment.date)
summaryTime.textContent = appointment.time
summaryPatient.textContent = appointment.patient.name
summaryPrice.textContent = formatCurrency(appointment.procedure.price)

/*
  Quando o usuário clicar em confirmar, salvamos tudo no Supabase.
*/
confirmButton.addEventListener("click", async (event) => {
      /*
    Impede o link de ir direto para sucesso.html antes de salvar no banco.
  */
    event.preventDefault()

  /*
    Muda o texto do botão para indicar carregamento.
  */
    confirmButton.textContent = "Salvando agendamento..."

  /*
    Bloqueia novos cliques enquanto salva.
  */
    confirmButton.classList.add("disabled-link")

try {
    const dentistId = getAppointmentDentistId();

    /*
      Confere de novo se o horario continua livre.
      Isso evita conflito caso duas pessoas tentem agendar ao mesmo tempo.
    */
    const isStillAvailable = await checkTimeStillAvailable({
      date: appointment.date,
      time: appointment.time,
      dentistId
    });

    if (!isStillAvailable) {
      alert("Esse horário acabou de ser ocupado. Escolha outro horário.");

      confirmButton.textContent = "Confirmar agendamento";
      confirmButton.classList.remove("disabled-link");
      return;
    }

    /*
      Primeiro criamos o paciente no banco.
    */
    const patient = await createPatient();

    /*
      Depois criamos o agendamento vinculado ao paciente.
    */
    const createdAppointment = await createAppointment(patient.id);

    /*
      Salva o último agendamento criado no localStorage.
      Isso será usado na tela sucesso.html.
    */
    localStorage.setItem(
      "odontoflow_last_appointment",
      JSON.stringify(createdAppointment)
    );

    /*
      Limpa o agendamento temporário, porque agora ele já foi salvo no banco.
    */
    clearCurrentAppointment();

    /*
      Redireciona para a tela de sucesso.
    */
    window.location.href = "./sucesso.html";
  } catch (error) {
    /*
      Se algo der errado, mostramos no console para facilitar o debug.
    */
    console.error("Erro ao confirmar agendamento:", error);

    /*
      Mostra mensagem para o usuário.
    */
    alert("Erro ao confirmar agendamento. Verifique o console e tente novamente.");

    /*
      Libera o botão novamente.
    */
    confirmButton.textContent = "Confirmar agendamento";
    confirmButton.classList.remove("disabled-link");
  }
})

/*
  Cria o paciente na tabela patients.
*/
async function createPatient() {
  /*
    Monta o objeto no formato esperado pela tabela patients.
  */
  const patientData = {
    full_name: appointment.patient.name,
    phone: appointment.patient.phone,
    email: appointment.patient.email || null,
    cpf: appointment.patient.cpf || null,
    birth_date: formatBirthDateToDatabase(appointment.patient.birth)
  };

  /*
    Insere o paciente no Supabase.

    .select()
    pede para o Supabase devolver o registro criado.

    .single()
    indica que queremos apenas um objeto, não uma lista.
  */
  const { data, error } = await supabaseClient
    .from("patients")
    .insert(patientData)
    .select()
    .single();

  /*
    Se houver erro, lançamos para o catch principal.
  */
  if (error) {
    throw error;
  }

  /*
    Retorna o paciente criado.
  */
  return data;
}

/*
  Confere no banco se o horario ainda esta livre antes de salvar.
*/
async function checkTimeStillAvailable({ date, time, dentistId }) {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("id")
    .eq("appointment_date", date)
    .eq("appointment_time", time)
    .eq("dentist_id", dentistId)
    .not("status", "in", "(cancelled_by_patient,cancelled_by_clinic,cancelled)")
    .limit(1);

  if (error) {
    console.error("Erro ao validar disponibilidade:", JSON.stringify(error, null, 2));
    return false;
  }

  return !data || data.length === 0;
}

/*
  Cria o agendamento na tabela appointments.
*/
async function createAppointment(patientId) {
  /*
    Monta o objeto no formato esperado pela tabela appointments.
  */
  const appointmentData = {
    code: generateAppointmentCode(),
    patient_id: patientId,
    procedure_id: appointment.procedure.id,
    dentist_id: getAppointmentDentistId(),
    appointment_date: appointment.date,
    appointment_time: appointment.time,
    status: "requested",
    notes: appointment.patient.notes || null
  };

  /*
    Insere o agendamento no banco.

    O select com patients, procedures e dentists já retorna
    os dados relacionados para usarmos na tela de sucesso.
  */
  const { data, error } = await supabaseClient
    .from("appointments")
    .insert(appointmentData)
    .select(`
      *,
      patients (*),
      procedures (*),
      dentists (*)
    `)
    .single();

  /*
    Se houver erro, lançamos para o catch principal.
  */
  if (error) {
    throw error;
  }

  /*
    Retorna o agendamento criado.
  */
  return data;
}

function getAppointmentDentistId() {
  return appointment.dentist?.id || appointment.dentist_id;
}

/*
  Converte data digitada no formato brasileiro para o formato do banco.

  Entrada:
  20/05/2000

  Saída:
  2000-05-20

  Se o campo estiver vazio ou inválido, retorna null.
*/
function formatBirthDateToDatabase(date) {
  if (!date) {
    return null;
  }

  const parts = date.split("/");

  if (parts.length !== 3) {
    return null;
  }

  const day = parts[0];
  const month = parts[1];
  const year = parts[2];

  if (!day || !month || !year) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

/*
  Formata a data do agendamento para mostrar em português.

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

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  return `${day}/${month}/${year}`;
}
