/*
  TELA DE DATA E HORÁRIO

  Este arquivo controla a terceira etapa do agendamento.

  O objetivo aqui é:
  1. Criar o calendário automaticamente usando a data atual
  2. Deixar dias antigos e domingos cinza e sem clique
  3. Permitir escolher uma data disponível
  4. Permitir escolher um horário disponível
  5. Salvar data e horário no localStorage
  6. Liberar o botão "Continuar" apenas quando data + horário existirem
*/

/*
  ELEMENTOS DO HTML

  Aqui buscamos os elementos que o JavaScript precisa controlar.
*/
const calendarTitle = document.querySelector(".calendar-header h2")
const calendarDays = document.querySelector(".calendar-days")
const prevMonthButton = document.querySelector(".calendar-prev")
const nextMonthButton = document.querySelector(".calendar-next")
const timeButtons = document.querySelectorAll(".time-grid button[data-time]")
const continueButton = document.querySelector(".continue-button")

/*
  DATA ATUAL

  Criamos a data de hoje e zeramos hora/minuto/segundo.
  Isso evita erro ao comparar datas, porque uma data com horário atual
  poderia parecer "maior" que outra data do mesmo dia às 00:00.
*/
const today = new Date()
today.setHours(0, 0, 0, 0)

/*
  ESTADO DA TELA

  visibleMonth guarda qual mês aparece no calendário.
  selectedDate guarda a data escolhida.
  selectedTime guarda o horário escolhido.
*/
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1)
let selectedDate = null
let selectedTime = null

/*
  DADOS JÁ SALVOS

  Se o usuário voltar para esta tela depois de avançar,
  reaproveitamos o que já estava salvo no localStorage.
*/
const currentAppointment = getCurrentAppointment()

/*
  RESTAURA DATA SALVA

  Só restauramos a data se ela ainda for válida.
  Exemplo: se estava salvo um dia antigo, ele não volta selecionado.
*/
if (currentAppointment.date && isAvailableDate(parseDate(currentAppointment.date))) {
  selectedDate = currentAppointment.date

  /*
    Se a data salva for de outro mês, abrimos o calendário naquele mês.
  */
  visibleMonth = new Date(
    parseDate(currentAppointment.date).getFullYear(),
    parseDate(currentAppointment.date).getMonth(),
    1
  )
}

/*
  RESTAURA HORÁRIO SALVO

  O horário é restaurado depois que os botões já existem no HTML.
*/
if (currentAppointment.time) {
  selectedTime = currentAppointment.time
}

/*
  INICIALIZAÇÃO DA TELA

  Renderiza o calendário, marca o horário salvo se existir,
  e atualiza o estado do botão "Continuar".
*/
renderCalendar()
restoreSelectedTime()
updateContinueButton()

/*
  BOTÃO DE MÊS ANTERIOR

  Volta um mês no calendário.
  Não permite voltar para meses anteriores ao mês atual.
*/
prevMonthButton.addEventListener("click", () => {
  const previousMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() - 1,
    1
  )

  if (isBeforeCurrentMonth(previousMonth)) {
    return
  }

  visibleMonth = previousMonth
  renderCalendar()
})

/*
  BOTÃO DE PRÓXIMO MÊS

  Avança um mês e renderiza novamente o calendário.
*/
nextMonthButton.addEventListener("click", () => {
  visibleMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    1
  )

  renderCalendar()
})

/*
  SELEÇÃO DE HORÁRIO

  Para cada botão com data-time:
  - remove seleção dos outros horários
  - marca o horário clicado
  - salva no localStorage
  - verifica se já pode liberar o botão continuar
*/
timeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    timeButtons.forEach((item) => {
      item.classList.remove("selected")
    })

    button.classList.add("selected")
    selectedTime = button.dataset.time

    saveCurrentAppointment({
      time: selectedTime
    })

    updateContinueButton()
  })
})

/*
  RENDERIZA O CALENDÁRIO

  Esta função monta os botões dos dias do mês visível.
  Como o HTML começa com <div class="calendar-days"></div>,
  todos os dias são criados aqui pelo JavaScript.
*/
function renderCalendar() {
  /*
    Atualiza o título do calendário.
    Exemplo: "Maio 2026".
  */
  calendarTitle.textContent = getMonthTitle(visibleMonth)

  /*
    Limpa o calendário antes de montar novamente.
    Isso é necessário ao trocar de mês.
  */
  calendarDays.innerHTML = ""

  /*
    Desabilita a seta de voltar quando o mês anterior seria passado.
  */
  prevMonthButton.disabled = isBeforeCurrentMonth(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
  )

  /*
    firstWeekday indica em qual dia da semana o mês começa.
    0 = domingo, 1 = segunda, 2 = terça...
  */
  const firstWeekday = visibleMonth.getDay()

  /*
    lastDay pega o último dia do mês.
    Exemplo: maio tem 31, junho tem 30.
  */
  const lastDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate()

  /*
    Cria botões vazios antes do dia 1.
    Isso mantém o alinhamento correto no calendário.
  */
  for (let index = 0; index < firstWeekday; index++) {
    const emptyButton = document.createElement("button")
    emptyButton.className = "empty"
    emptyButton.type = "button"
    calendarDays.appendChild(emptyButton)
  }

  /*
    Cria os botões reais dos dias do mês.
  */
  for (let day = 1; day <= lastDay; day++) {
    const button = document.createElement("button")

    /*
      Cria uma data real para o dia atual do loop.
    */
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    )

    /*
      Formato salvo no localStorage.
      Exemplo: "2026-05-20".
    */
    const dateValue = formatDate(date)

    button.type = "button"

    button.textContent = day

    /*
      Se a data estiver disponível, ela vira clicável.
      Caso contrário, fica visualmente desativada.
    */
    if (isAvailableDate(date)) {
      button.dataset.date = dateValue

      /*
        Se essa data já estava selecionada, restauramos o visual.
      */
      if (selectedDate === dateValue) {
        button.classList.add("selected")
      }

      button.addEventListener("click", () => {
        selectDate(button, dateValue)
      })
    } else {
      button.classList.add("muted")
    }

    calendarDays.appendChild(button)
  }
}

/*
  SELECIONA UMA DATA

  Recebe o botão clicado e o valor da data no formato YYYY-MM-DD.
*/
function selectDate(button, dateValue) {
  /*
    Remove a seleção de qualquer outro dia.
  */
  document.querySelectorAll(".calendar-days button[data-date]").forEach((item) => {
    item.classList.remove("selected")
  })

  /*
    Marca o dia clicado como selecionado.
  */
  button.classList.add("selected")
  selectedDate = dateValue

  /*
    Salva a data escolhida no agendamento temporário.
  */
  saveCurrentAppointment({
    date: selectedDate
  })

  updateContinueButton()
}

/*
  RESTAURA HORÁRIO SELECIONADO

  Se o usuário já tinha escolhido um horário antes,
  adicionamos a classe selected no botão correspondente.
*/
function restoreSelectedTime() {
  timeButtons.forEach((button) => {
    if (button.dataset.time === selectedTime) {
      button.classList.add("selected")
    }
  })
}

/*
  ATUALIZA O BOTÃO CONTINUAR

  O botão só libera quando existe data e horário.
*/
function updateContinueButton() {
  if (!continueButton) {
    return
  }

  if (selectedDate && selectedTime) {
    continueButton.classList.remove("disabled-link")
    continueButton.classList.remove("btn-disabled")
    continueButton.classList.add("btn-primary")
    return
  }

  continueButton.classList.add("disabled-link")
}

/*
  VERIFICA SE UMA DATA ESTÁ DISPONÍVEL

  Regras atuais:
  - dias passados aparecem cinza, mas não podem ser clicados
  - domingos aparecem cinza, mas não podem ser clicados
*/
function isAvailableDate(date) {
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  const isSunday = normalizedDate.getDay() === 0

  return !isPastDate(normalizedDate) && !isSunday
}

/*
  VERIFICA SE UMA DATA JÁ PASSOU

  Compara apenas ano, mês e dia.
*/
function isPastDate(date) {
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  return normalizedDate < today
}

/*
  VERIFICA SE UM MÊS É ANTERIOR AO MÊS ATUAL

  Usado para impedir que o usuário navegue para meses passados.
*/
function isBeforeCurrentMonth(date) {
  return (
    date.getFullYear() < today.getFullYear() ||
    (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() < today.getMonth()
    )
  )
}

/*
  FORMATA UMA DATA PARA SALVAR

  Transforma um objeto Date em texto no formato YYYY-MM-DD.
*/
function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

/*
  CONVERTE TEXTO EM DATA

  Transforma "2026-05-20" em um objeto Date.
*/
function parseDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number)

  return new Date(year, month - 1, day)
}

/*
  TÍTULO DO MÊS

  Gera textos como:
  "Maio 2026"
  "Junho 2026"
*/
function getMonthTitle(date) {
  const month = date.toLocaleString("pt-BR", {
    month: "long"
  })
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1)

  return `${capitalizedMonth} ${date.getFullYear()}`
}
