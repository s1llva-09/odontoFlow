/*
  TELA DE DATA E HORARIO

  Controla a terceira etapa do agendamento.

  Aqui o calendario continua sendo gerado automaticamente, mas os horarios
  disponiveis agora respeitam os horarios cadastrados no admin da clinica.
*/

/*
  ELEMENTOS DO HTML
*/
const calendarTitle = document.querySelector(".calendar-header h2");
const calendarDays = document.querySelector(".calendar-days");
const prevMonthButton = document.querySelector(".calendar-prev");
const nextMonthButton = document.querySelector(".calendar-next");
const timesContainer = document.querySelector(".time-grid");
const continueButton = document.querySelector(".continue-button");

/*
  DATA ATUAL

  Zeramos hora/minuto/segundo para comparar apenas ano, mes e dia.
*/
const today = new Date();
today.setHours(0, 0, 0, 0);

/*
  ESTADO DA TELA
*/
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;
let selectedTime = null;
let clinicWorkingHours = [];
let selectedDateWorkingHours = null;
/*
  Guarda os horarios ja ocupados no dia e dentista selecionados.
*/
let bookedAppointments = [];

/*
  DADOS JA SALVOS
*/
const currentAppointment = getCurrentAppointment();

initSchedulePage();

/*
  INICIALIZACAO DA TELA

  Primeiro buscamos os horarios da clinica no Supabase.
  Depois restauramos selecoes antigas e renderizamos calendario/horarios.
*/
async function initSchedulePage() {
  await loadClinicWorkingHours();

  restoreSavedAppointment();
  renderCalendar();

  if (selectedDate) {
    const dentistId = getSelectedDentistId();

    if (!dentistId) {
      selectedTime = null;
      saveCurrentAppointment({
        time: null
      });

      renderAvailableTimes([]);
    } else {
      const generatedTimes = generateAvailableTimesForDate(selectedDate, 90);

      await loadBookedAppointmentsForDate(selectedDate, dentistId);

      const freeTimes = removeBookedTimes(generatedTimes);

      if (!freeTimes.includes(selectedTime)) {
        selectedTime = null;
        saveCurrentAppointment({
          time: null
        });
      }

      renderAvailableTimes(freeTimes);
    }
  } else {
    renderAvailableTimes([]);
  }

  updateContinueButton();
}

/*
  Busca os horarios de funcionamento cadastrados no admin.
*/
async function loadClinicWorkingHours() {
  const { data, error } = await supabaseClient
    .from("clinic_working_hours")
    .select("*")
    .order("week_day", { ascending: true });

  if (error) {
    console.error("Erro ao buscar horarios da clinica:", JSON.stringify(error, null, 2));
    clinicWorkingHours = [];
    return;
  }

  clinicWorkingHours = data || [];
}

/*
  Busca no Supabase os agendamentos ja existentes para:
  - dentista selecionado
  - data selecionada

  Nao consideramos cancelados como horario ocupado.
*/
async function loadBookedAppointmentsForDate(dateString, dentistId) {
  if (!dateString || !dentistId) {
    bookedAppointments = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .eq("appointment_date", dateString)
    .eq("dentist_id", dentistId)
    .not("status", "in", "(cancelled_by_patient,cancelled_by_clinic,cancelled)");

  if (error) {
    console.error("Erro ao buscar horarios ocupados:", JSON.stringify(error, null, 2));
    bookedAppointments = [];
    return;
  }

  bookedAppointments = data || [];
}

/*
  Recebe os horarios gerados pelo funcionamento da clinica
  e remove os que ja estao ocupados no banco.
*/
function removeBookedTimes(availableTimes) {
  const bookedTimes = bookedAppointments.map((appointment) => {
    return String(appointment.appointment_time).slice(0, 5);
  });

  return availableTimes.filter((time) => {
    return !bookedTimes.includes(time);
  });
}

/*
  Restaura data e horario salvos caso ainda sejam validos.
*/
function restoreSavedAppointment() {
  if (currentAppointment.date && isAvailableDate(parseDate(currentAppointment.date))) {
    selectedDate = currentAppointment.date;

    visibleMonth = new Date(
      parseDate(currentAppointment.date).getFullYear(),
      parseDate(currentAppointment.date).getMonth(),
      1
    );
  }

  if (currentAppointment.time) {
    selectedTime = currentAppointment.time;
  }
}

/*
  BOTAO DE MES ANTERIOR

  Nao permite voltar para meses anteriores ao mes atual.
*/
prevMonthButton.addEventListener("click", () => {
  const previousMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() - 1,
    1
  );

  if (isBeforeCurrentMonth(previousMonth)) {
    return;
  }

  visibleMonth = previousMonth;
  renderCalendar();
});

/*
  BOTAO DE PROXIMO MES
*/
nextMonthButton.addEventListener("click", () => {
  visibleMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    1
  );

  renderCalendar();
});

/*
  RENDERIZA O CALENDARIO
*/
function renderCalendar() {
  calendarTitle.textContent = getMonthTitle(visibleMonth);
  calendarDays.innerHTML = "";

  prevMonthButton.disabled = isBeforeCurrentMonth(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
  );

  const firstWeekday = visibleMonth.getDay();
  const lastDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate();

  /*
    Botoes vazios antes do dia 1 mantem o alinhamento do calendario.
  */
  for (let index = 0; index < firstWeekday; index++) {
    const emptyButton = document.createElement("button");
    emptyButton.className = "empty";
    emptyButton.type = "button";
    calendarDays.appendChild(emptyButton);
  }

  /*
    Dias reais do mes visivel.
  */
  for (let day = 1; day <= lastDay; day++) {
    const button = document.createElement("button");
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    );
    const dateValue = formatDate(date);

    button.type = "button";
    button.textContent = day;

    if (isAvailableDate(date)) {
      button.dataset.date = dateValue;

      if (selectedDate === dateValue) {
        button.classList.add("selected");
      }

      button.addEventListener("click", () => {
        selectDate(button, dateValue);
      });
    } else {
      button.classList.add("muted");
    }

    calendarDays.appendChild(button);
  }
}

/*
  SELECIONA UMA DATA

  Ao trocar de data, o horario anterior e limpo para evitar salvar
  um horario que nao pertence ao novo dia.
*/
async function selectDate(button, dateValue) {
  const dentistId = getSelectedDentistId();

  if (!dentistId) {
    alert("Selecione um dentista antes de escolher a data.");
    return;
  }

  document.querySelectorAll(".calendar-days button[data-date]").forEach((item) => {
    item.classList.remove("selected");
  });

  button.classList.add("selected");
  selectedDate = dateValue;
  selectedTime = null;

  saveCurrentAppointment({
    date: selectedDate,
    time: null
  });

  const generatedTimes = generateAvailableTimesForDate(selectedDate, 90);

  await loadBookedAppointmentsForDate(selectedDate, dentistId);

  const freeTimes = removeBookedTimes(generatedTimes);

  renderAvailableTimes(freeTimes);
  updateContinueButton();
}

/*
  Gera horarios disponiveis com base no funcionamento da clinica.

  Exemplo:
  abertura: 08:00
  fechamento: 18:00
  intervalo: 90 minutos
  resultado: 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00
*/
function generateAvailableTimesForDate(dateString, intervalMinutes = 90) {
  const weekDay = getWeekDayFromDateString(dateString);

  const daySettings = clinicWorkingHours.find((day) => {
    return Number(day.week_day) === weekDay;
  });

  selectedDateWorkingHours = daySettings || null;

  if (!daySettings || !daySettings.is_open) {
    return [];
  }

  const openTime = daySettings.open_time?.slice(0, 5);
  const closeTime = daySettings.close_time?.slice(0, 5);

  if (!openTime || !closeTime) {
    return [];
  }

  const times = [];

  let currentMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);

  /*
    Gera horarios ate antes do fechamento.
  */
  while (currentMinutes < closeMinutes) {
    times.push(minutesToTime(currentMinutes));
    currentMinutes += intervalMinutes;
  }

  return times;
}

/*
  Renderiza os horarios disponiveis para a data escolhida.
*/
function renderAvailableTimes(times) {
  if (!timesContainer) {
    return;
  }

  if (!selectedDate) {
    timesContainer.innerHTML = `
      <div class="empty-times-message">
        Selecione uma data no calendario.
      </div>
    `;

    return;
  }

  if (!getSelectedDentistId()) {
    timesContainer.innerHTML = `
      <div class="empty-times-message">
        Selecione um dentista antes de escolher os horarios.
      </div>
    `;

    return;
  }

  if (!times.length) {
    timesContainer.innerHTML = `
      <div class="empty-times-message">
        Nao existem horarios livres para esta data.
        <br />
        Escolha outro dia ou outro dentista.
      </div>
    `;

    return;
  }

  timesContainer.innerHTML = times.map((time) => {
    const isSelected = selectedTime === time;

    return `
      <button
        type="button"
        class="time-option ${isSelected ? "selected" : ""}"
        data-time="${time}"
      >
        ${time}
      </button>
    `;
  }).join("");

  timesContainer.querySelectorAll("button[data-time]").forEach((button) => {
    button.addEventListener("click", () => {
      selectTime(button.dataset.time);
    });
  });
}

/*
  Seleciona um horario gerado dinamicamente.
*/
function selectTime(time) {
  selectedTime = time;

  saveCurrentAppointment({
    time: selectedTime
  });

  const availableTimes = generateAvailableTimesForDate(selectedDate, 90);
  const freeTimes = removeBookedTimes(availableTimes);

  renderAvailableTimes(freeTimes);
  updateContinueButton();
}

function getSelectedDentistId() {
  const appointment = getCurrentAppointment();

  return appointment.dentist?.id || appointment.dentist_id || "";
}

/*
  ATUALIZA O BOTAO CONTINUAR
*/
function updateContinueButton() {
  if (!continueButton) {
    return;
  }

  if (selectedDate && selectedTime && getSelectedDentistId()) {
    continueButton.classList.remove("disabled-link");
    continueButton.classList.remove("btn-disabled");
    continueButton.classList.add("btn-primary");
    return;
  }

  continueButton.classList.add("disabled-link");
}

/*
  VERIFICA SE UMA DATA ESTA DISPONIVEL

  Regras:
  - dias passados ficam cinza e sem clique;
  - se houver horarios cadastrados, somente dias abertos ficam clicaveis;
  - se ainda nao houver cadastro, mantemos o fallback antigo: domingo fechado.
*/
function isAvailableDate(date) {
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  return !isPastDate(normalizedDate) && isClinicOpenDate(normalizedDate);
}

function isClinicOpenDate(date) {
  const weekDay = date.getDay();

  if (!clinicWorkingHours.length) {
    return weekDay !== 0;
  }

  const daySettings = clinicWorkingHours.find((day) => {
    return Number(day.week_day) === weekDay;
  });

  return Boolean(daySettings && daySettings.is_open);
}

/*
  VERIFICA SE UMA DATA JA PASSOU
*/
function isPastDate(date) {
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  return normalizedDate < today;
}

/*
  VERIFICA SE UM MES E ANTERIOR AO MES ATUAL
*/
function isBeforeCurrentMonth(date) {
  return (
    date.getFullYear() < today.getFullYear() ||
    (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() < today.getMonth()
    )
  );
}

/*
  Converte uma data YYYY-MM-DD para dia da semana.
  0 = Domingo, 1 = Segunda...
*/
function getWeekDayFromDateString(dateString) {
  const [year, month, day] = dateString.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return date.getDay();
}

/*
  "08:30" vira 510 minutos.
*/
function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

/*
  510 minutos vira "08:30".
*/
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/*
  FORMATA UMA DATA PARA SALVAR
*/
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/*
  CONVERTE TEXTO EM DATA
*/
function parseDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);

  return new Date(year, month - 1, day);
}

/*
  TITULO DO MES
*/
function getMonthTitle(date) {
  const month = date.toLocaleString("pt-BR", {
    month: "long"
  });
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

  return `${capitalizedMonth} ${date.getFullYear()}`;
}
