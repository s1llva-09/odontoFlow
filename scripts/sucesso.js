/*
  TELA DE SUCESSO

  Essa tela é responsável por:
  1. Buscar o último agendamento criado
  2. Mostrar código, paciente, procedimento, dentista, data e horário
  3. Permitir copiar o código do agendamento
*/

/*
  Busca o último agendamento salvo pelo confirmacao.js.
*/
const lastAppointmentData = localStorage.getItem("odontoflow_last_appointment");

/*
  Se não existir último agendamento, o usuário provavelmente abriu essa página direto.
  Nesse caso, voltamos para a página inicial.
*/
if (!lastAppointmentData) {
  window.location.href = "./index.html";
}

/*
  Converte o texto JSON de volta para objeto JavaScript.
*/
const appointment = JSON.parse(lastAppointmentData);

/*
  Seleciona os elementos da tela.
*/
const successCode = document.querySelector("#successCode");
const successPatient = document.querySelector("#successPatient");
const successProcedure = document.querySelector("#successProcedure");
const successDentist = document.querySelector("#successDentist");
const successDate = document.querySelector("#successDate");
const successTime = document.querySelector("#successTime");
const copyCodeButton = document.querySelector("#copyCodeButton");

/*
  Preenche a tela com os dados vindos do Supabase.
*/
successCode.textContent = appointment.code;
successPatient.textContent = appointment.patients.full_name;
successProcedure.textContent = appointment.procedures.name;
successDentist.textContent = appointment.dentists.name;
successDate.textContent = formatDateToBR(appointment.appointment_date);
successTime.textContent = appointment.appointment_time.slice(0, 5);

/*
  Evento para copiar o código do agendamento.
*/
copyCodeButton.addEventListener("click", async () => {
  try {
    /*
      Copia o código para a área de transferência.
    */
    await navigator.clipboard.writeText(appointment.code);

    /*
      Dá feedback visual para o usuário.
    */
    copyCodeButton.textContent = "✓";

    /*
      Depois de 1.5s volta para o ícone original.
    */
    setTimeout(() => {
      copyCodeButton.textContent = "⧉";
    }, 1500);
  } catch (error) {
    /*
      Caso o navegador bloqueie a cópia.
    */
    alert("Não foi possível copiar o código.");
  }
});

/*
  Formata data do banco para o padrão brasileiro.

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