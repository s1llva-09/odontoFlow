/*
  Dashboard da clinica.

  Esta tela usa os dados reais do Supabase para:
  - atualizar os cards principais;
  - montar o grafico de faturamento dos ultimos 6 meses;
  - montar a rosca de status dos agendamentos;
  - listar os proximos agendamentos.
*/

const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

const todayAppointments = document.querySelector("#todayAppointments");
const pendingAppointments = document.querySelector("#pendingAppointments");
const confirmedAppointments = document.querySelector("#confirmedAppointments");
const totalPatients = document.querySelector("#totalPatients");
const estimatedRevenue = document.querySelector("#estimatedRevenue");
const cancelledAppointments = document.querySelector("#cancelledAppointments");
const dashboardReceivable = document.querySelector("#dashboardReceivable");
const dashboardPayable = document.querySelector("#dashboardPayable");

const statusConfirmedCount = document.querySelector("#statusConfirmedCount");
const statusRequestedCount = document.querySelector("#statusRequestedCount");
const statusCompletedCount = document.querySelector("#statusCompletedCount");
const statusCancelledCount = document.querySelector("#statusCancelledCount");

/*
  Elementos dos graficos dinamicos.

  O HTML deixa apenas os containers vazios.
  O JavaScript busca os dados no Supabase e monta o visual dentro deles.
*/
const monthlyRevenueChart = document.querySelector("#monthlyRevenueChart");
const appointmentsStatusChart = document.querySelector("#appointmentsStatusChart");
const recentAppointmentsTable = document.querySelector("#recentAppointmentsTable");
const logoutButton = document.querySelector("#logoutButton");

logoutButton?.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

loadDashboard();

async function loadDashboard() {
  const { data: appointments, error: appointmentsError } = await supabaseClient
    .from("appointments")
    .select(`
      *,
      patients (*),
      procedures (*),
      dentists (*)
    `)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (appointmentsError) {
    console.error("Erro ao buscar agendamentos:", appointmentsError);

    recentAppointmentsTable.innerHTML = `
      <tr>
        <td colspan="6">Erro ao carregar agendamentos.</td>
      </tr>
    `;

    return;
  }

  const { count: patientsCount, error: patientsError } = await supabaseClient
    .from("patients")
    .select("*", { count: "exact", head: true });

  if (patientsError) {
    console.error("Erro ao contar pacientes:", patientsError);
  }

  const { data: transactions, error: transactionsError } = await supabaseClient
    .from("financial_transactions")
    .select("*");

  if (transactionsError) {
    console.warn("Financeiro ainda indisponivel na dashboard:", transactionsError);
  }

  const safeAppointments = appointments || [];
  const safeTransactions = transactions || [];

  /*
    Atualiza tudo depois que os dados chegam:
    - cards numericos;
    - grafico de barras;
    - grafico de rosca;
    - tabela de proximos agendamentos.
  */
  updateDashboardCards(safeAppointments, patientsCount || 0, safeTransactions);
  renderMonthlyRevenueChart(safeAppointments);
  renderStatusDonut(getStatusCounts(safeAppointments));
  renderRecentAppointments(safeAppointments);
}

function updateDashboardCards(appointments, patientsCount, transactions) {
  const today = getTodayDate();
  const currentMonth = today.slice(0, 7);
  const statusCounts = getStatusCounts(appointments);

  /*
    Conta somente consultas marcadas para hoje.
    appointment_date ja vem do banco no formato YYYY-MM-DD.
  */
  const todayList = appointments.filter((appointment) => {
    return appointment.appointment_date === today;
  });

  /*
    Faturamento do mes atual.
    Cancelamentos nao entram nessa soma.
  */
  const revenue = appointments.reduce((total, appointment) => {
    const appointmentMonth = appointment.appointment_date?.slice(0, 7);

    if (isCancelledAppointment(appointment) || appointmentMonth !== currentMonth) {
      return total;
    }

    return total + getAppointmentPrice(appointment);
  }, 0);

  /*
    A receber ainda e um resumo simples:
    soma solicitados e confirmados, porque esses valores ainda podem entrar.
  */
  const receivable = appointments.reduce((total, appointment) => {
    const canReceive = [
      "requested",
      "clinic_confirmed",
      "patient_confirmed"
    ].includes(appointment.status);

    if (!canReceive) {
      return total;
    }

    return total + getAppointmentPrice(appointment);
  }, 0);

  /*
    A pagar vem das movimentacoes financeiras cadastradas como despesa.
  */
  const payable = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => {
      return total + Number(transaction.amount || 0);
    }, 0);

  /*
    Cancelamentos exibidos no card:
    conta apenas cancelamentos do mes atual.
  */
  const cancelledThisMonth = appointments.filter((appointment) => {
    const appointmentMonth = appointment.appointment_date?.slice(0, 7);

    return isCancelledAppointment(appointment) && appointmentMonth === currentMonth;
  });

  setText(todayAppointments, todayList.length);
  setText(pendingAppointments, statusCounts.requested);
  setText(confirmedAppointments, statusCounts.confirmed);
  setText(totalPatients, patientsCount);
  setText(estimatedRevenue, formatMoney(revenue));
  setText(cancelledAppointments, cancelledThisMonth.length);
  setText(dashboardReceivable, formatMoney(receivable));
  setText(dashboardPayable, formatMoney(payable));

  setText(statusConfirmedCount, statusCounts.confirmed);
  setText(statusRequestedCount, statusCounts.requested);
  setText(statusCompletedCount, statusCounts.completed);
  setText(statusCancelledCount, statusCounts.cancelled);
}

function renderMonthlyRevenueChart(appointments) {
  if (!monthlyRevenueChart) {
    return;
  }

  /*
    Gera os ultimos 6 meses em ordem cronologica.
    Cada mes recebe uma key no formato YYYY-MM para comparar com appointment_date.
  */
  const months = getLastMonths(6);

  /*
    Para cada mes, soma o valor dos procedimentos daquele periodo.
    Agendamentos cancelados ficam fora do faturamento.
  */
  const revenueByMonth = months.map((month) => {
    const total = appointments.reduce((sum, appointment) => {
      const appointmentMonth = appointment.appointment_date?.slice(0, 7);

      if (isCancelledAppointment(appointment) || appointmentMonth !== month.key) {
        return sum;
      }

      return sum + getAppointmentPrice(appointment);
    }, 0);

    return {
      ...month,
      total
    };
  });

  /*
    A maior receita vira a barra de 100%.
    As outras barras usam porcentagem proporcional a ela.
  */
  const maxRevenue = Math.max(...revenueByMonth.map((month) => month.total), 0);

  monthlyRevenueChart.innerHTML = revenueByMonth.map((month) => {
    /*
      Mesmo com valor zero, deixamos altura minima de 6%.
      Isso evita que o grafico pareca quebrado quando um mes nao faturou.
    */
    const height = maxRevenue > 0 ? Math.max((month.total / maxRevenue) * 100, 6) : 6;

    return `
      <div class="fake-bar-item" title="${month.label}: ${formatMoney(month.total)}">
        <span class="fake-bar-value">${formatShortMoney(month.total)}</span>

        <div class="fake-bar-track">
          <div class="fake-bar" style="height: ${height}%;"></div>
        </div>

        <small>${month.shortLabel}</small>
      </div>
    `;
  }).join("");
}

function renderStatusDonut(statusCounts) {
  if (!appointmentsStatusChart) {
    return;
  }

  /*
    Cada item representa uma fatia da rosca:
    confirmado, solicitado, concluido e cancelado.
  */
  const slices = [
    { value: statusCounts.confirmed, color: "#2563eb" },
    { value: statusCounts.requested, color: "#facc15" },
    { value: statusCounts.completed, color: "#22c55e" },
    { value: statusCounts.cancelled, color: "#ef4444" }
  ];

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  /*
    Sem dados, a rosca fica cinza para indicar estado vazio.
  */
  if (total === 0) {
    appointmentsStatusChart.style.background = "#e2e8f0";
    appointmentsStatusChart.title = "Nenhum agendamento encontrado";
    return;
  }

  let currentPercentage = 0;

  /*
    Monta o conic-gradient de forma acumulada.
    Exemplo final: azul 0% 40%, amarelo 40% 60%, ...
  */
  const gradientParts = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const start = currentPercentage;
      const end = currentPercentage + (slice.value / total) * 100;

      currentPercentage = end;

      return `${slice.color} ${start}% ${end}%`;
    });

  appointmentsStatusChart.style.background = `conic-gradient(${gradientParts.join(", ")})`;
  appointmentsStatusChart.title = `${total} agendamento(s) no resumo`;
}

function renderRecentAppointments(appointments) {
  if (!appointments.length) {
    recentAppointmentsTable.innerHTML = `
      <tr>
        <td colspan="6">Nenhum agendamento encontrado.</td>
      </tr>
    `;

    return;
  }

  const today = getTodayDate();

  /*
    A tabela da dashboard prioriza proximos agendamentos ativos.
    Se nao existir nenhum proximo, ela mostra os primeiros registros retornados.
  */
  const upcomingAppointments = appointments.filter((appointment) => {
    return (
      appointment.appointment_date >= today &&
      !isCancelledAppointment(appointment) &&
      appointment.status !== "completed"
    );
  });

  const recent = (upcomingAppointments.length ? upcomingAppointments : appointments).slice(0, 6);

  recentAppointmentsTable.innerHTML = recent.map((appointment) => {
    return `
      <tr>
        <td>${appointment.patients?.full_name || "-"}</td>
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

function getStatusCounts(appointments) {
  /*
    Agrupa os status tecnicos do banco nos quatro grupos mostrados no grafico.
  */
  return appointments.reduce((counts, appointment) => {
    if (appointment.status === "requested") {
      counts.requested += 1;
      return counts;
    }

    if (
      appointment.status === "clinic_confirmed" ||
      appointment.status === "patient_confirmed"
    ) {
      counts.confirmed += 1;
      return counts;
    }

    if (appointment.status === "completed") {
      counts.completed += 1;
      return counts;
    }

    if (isCancelledAppointment(appointment)) {
      counts.cancelled += 1;
    }

    return counts;
  }, {
    confirmed: 0,
    requested: 0,
    completed: 0,
    cancelled: 0
  });
}

function getLastMonths(totalMonths) {
  /*
    Cria labels e keys dos meses.
    key: usada no calculo.
    label/shortLabel: usadas no grafico.
  */
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "short"
  });

  const fullFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  });

  const today = new Date();
  const months = [];

  for (let index = totalMonths - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const shortLabel = formatter.format(date).replace(".", "");
    const label = fullFormatter.format(date);

    months.push({
      key: `${year}-${month}`,
      shortLabel: capitalizeFirstLetter(shortLabel),
      label: capitalizeFirstLetter(label)
    });
  }

  return months;
}

function getAppointmentPrice(appointment) {
  /*
    O preco do atendimento vem da tabela procedures relacionada ao agendamento.
  */
  return Number(appointment.procedures?.price || 0);
}

function isCancelledAppointment(appointment) {
  /*
    Centraliza a regra de cancelamento para reaproveitar em cards e graficos.
  */
  return (
    appointment.status === "cancelled_by_patient" ||
    appointment.status === "cancelled_by_clinic"
  );
}

function setText(element, value) {
  /*
    Protecao simples para nao quebrar caso algum card ainda nao exista no HTML.
  */
  if (element) {
    element.textContent = value;
  }
}

function getTodayDate() {
  /*
    Retorna a data local no mesmo formato salvo no banco: YYYY-MM-DD.
  */
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function translateStatus(status) {
  /*
    Traduz os status tecnicos para textos melhores na interface.
  */
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

function formatDateToBR(date) {
  /*
    Converte YYYY-MM-DD para DD/MM/YYYY.
  */
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatMoney(value) {
  /*
    Formata valor completo em Real brasileiro.
  */
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));
}

function formatShortMoney(value) {
  /*
    Versao curta para caber acima das barras.
    Exemplo: R$ 1,5 mil.
  */
  const amount = Number(value || 0);

  if (amount >= 1000) {
    const shortValue = amount / 1000;
    const fractionDigits = shortValue >= 10 ? 0 : 1;

    return `R$ ${shortValue.toFixed(fractionDigits).replace(".", ",")} mil`;
  }

  return formatMoney(amount);
}

function capitalizeFirstLetter(text) {
  if (!text) {
    return "";
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}
