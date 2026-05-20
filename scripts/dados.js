/*
  TELA DE DADOS DO PACIENTE

  Essa tela é responsável por:
  1. Capturar os dados digitados pelo paciente
  2. Validar os campos obrigatórios
  3. Salvar os dados temporariamente no localStorage
  4. Liberar o botão "Continuar" quando os dados mínimos estiverem corretos

  Campos obrigatórios:
  - Nome
  - Telefone
  - E-mail

  Campos opcionais:
  - CPF
  - Data de nascimento
  - Observações
*/

/*
  Seleciona o formulário.
*/
const patientForm = document.querySelector("#patientForm");

/*
  Seleciona os inputs pelo ID.
*/
const nameInput = document.querySelector("#nome");
const phoneInput = document.querySelector("#telefone");
const emailInput = document.querySelector("#email");
const cpfInput = document.querySelector("#cpf");
const birthInput = document.querySelector("#nascimento");
const notesInput = document.querySelector("#observacoes");

/*
  Seleciona o botão continuar.
*/
const continueButton = document.querySelector(".continue-button");

/*
  Busca os dados já salvos no localStorage, se existirem.
*/
const currentAppointment = getCurrentAppointment();

/*
  Se já existir paciente salvo, preenche os campos novamente.

  Isso ajuda quando o usuário volta da tela de confirmação
  para corrigir algum dado.
*/
if (currentAppointment.patient) {
  nameInput.value = limitText(currentAppointment.patient.name || "", 80);
  phoneInput.value = formatPhone(currentAppointment.patient.phone || "");
  emailInput.value = limitText(currentAppointment.patient.email || "", 120);
  cpfInput.value = formatCpf(currentAppointment.patient.cpf || "");
  birthInput.value = formatBirthDate(currentAppointment.patient.birth || "");
  notesInput.value = limitText(currentAppointment.patient.notes || "", 300);

  validateForm();
}

/*
  Lista de campos que serão monitorados.
*/
const inputs = [
  nameInput,
  phoneInput,
  emailInput,
  cpfInput,
  birthInput,
  notesInput
];

/*
  Para cada campo, adiciona um evento de input.

  Toda vez que o usuário digitar:
  - salvamos os dados
  - validamos o formulário
*/
inputs.forEach((input) => {
  input.addEventListener("input", () => {
    applyFieldMasks();
    savePatientData();
    validateForm();
  });
});

/*
  Aplica máscaras uma vez ao carregar.

  Isso garante que dados restaurados do localStorage também fiquem
  com pontos, traços, parênteses e barras no lugar certo.
*/
applyFieldMasks();

/*
  Salva os dados do paciente no localStorage.
*/
function savePatientData() {
  saveCurrentAppointment({
    patient: {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      cpf: cpfInput.value.trim(),
      birth: birthInput.value.trim(),
      notes: notesInput.value.trim()
    }
  });
}

/*
  Valida o formulário.

  Regras simples:
  - Nome precisa ter pelo menos 3 caracteres
  - Telefone precisa ter pelo menos 8 caracteres
  - E-mail precisa conter @
*/
function validateForm() {
  const nameIsValid = nameInput.value.trim().length >= 3;
  const phoneDigits = onlyNumbers(phoneInput.value);
  const cpfDigits = onlyNumbers(cpfInput.value);
  const birthDigits = onlyNumbers(birthInput.value);

  const phoneIsValid = phoneDigits.length === 10 || phoneDigits.length === 11;
  const emailIsValid = isValidEmail(emailInput.value.trim());
  const cpfIsValid = cpfDigits.length === 0 || cpfDigits.length === 11;
  const birthIsValid = birthDigits.length === 0 || isValidBirthDate(birthInput.value);

  if (nameIsValid && phoneIsValid && emailIsValid && cpfIsValid && birthIsValid) {
    enableContinueButton();
  } else {
    disableContinueButton();
  }
}

/*
  Libera o botão continuar.
*/
function enableContinueButton() {
  continueButton.classList.remove("disabled-link");
  continueButton.classList.remove("btn-disabled");
  continueButton.classList.add("btn-primary");
}

/*
  Bloqueia o botão continuar.
*/
function disableContinueButton() {
  continueButton.classList.add("disabled-link");
}

/*
  Aplica as máscaras e limites principais.

  - telefone: (11) 99999-9999 ou (11) 9999-9999
  - CPF: 000.000.000-00
  - nascimento: dd/mm/aaaa
*/
function applyFieldMasks() {
  nameInput.value = limitText(nameInput.value, 80);
  phoneInput.value = formatPhone(phoneInput.value);
  emailInput.value = limitText(emailInput.value, 120);
  cpfInput.value = formatCpf(cpfInput.value);
  birthInput.value = formatBirthDate(birthInput.value);
  notesInput.value = limitText(notesInput.value, 300);
}

/*
  Mantém apenas números.
*/
function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

/*
  Limita qualquer texto ao número máximo de caracteres.
*/
function limitText(value, maxLength) {
  return value.slice(0, maxLength);
}

/*
  Formata telefone brasileiro.

  Aceita:
  - 10 dígitos: (11) 3456-7890
  - 11 dígitos: (11) 93456-7890
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
  Formata CPF no padrão 000.000.000-00.
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
  Formata data de nascimento no padrão dd/mm/aaaa.
*/
function formatBirthDate(value) {
  const digits = onlyNumbers(value).slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/*
  Validação simples de e-mail.
*/
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/*
  Valida se a data opcional existe de verdade.

  Exemplo inválido: 31/02/2000.
*/
function isValidBirthDate(value) {
  const digits = onlyNumbers(value);

  if (digits.length !== 8) {
    return false;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4));
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
