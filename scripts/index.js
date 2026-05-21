/*
  HOME PUBLICA

  Busca as informacoes cadastradas pela clinica no painel admin
  e aplica automaticamente no site publico.
*/

loadPublicClinicInfo();

async function loadPublicClinicInfo() {
  await Promise.all([
    loadClinicSettings(),
    loadClinicHours()
  ]);
}

async function loadClinicSettings() {
  const { data, error } = await supabaseClient
    .from("clinic_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar dados da clinica:", JSON.stringify(error, null, 2));
    return;
  }

  if (!data || !data.length) {
    return;
  }

  const clinic = data[0];

  setText("[data-clinic-name]", clinic.clinic_name || "OdontoFlow");
  setText("[data-clinic-phone]", clinic.phone || "(11) 3456-7890");
  setText("[data-clinic-email]", clinic.email || "contato@odontoflow.com");
  setText("[data-clinic-address]", clinic.address || "Av. Paulista, 1000 — São Paulo/SP");
}

async function loadClinicHours() {
  const { data, error } = await supabaseClient
    .from("clinic_working_hours")
    .select("*")
    .order("week_day", { ascending: true });

  if (error) {
    console.error("Erro ao buscar horarios da clinica:", JSON.stringify(error, null, 2));
    return;
  }

  if (!data || !data.length) {
    return;
  }

  setText("[data-clinic-hours]", formatWorkingHours(data));
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function formatWorkingHours(hours) {
  const openDays = sortWorkingHours(hours).filter((day) => day.is_open);

  if (!openDays.length) {
    return "Horarios sob consulta";
  }

  return openDays.map((day) => {
    const dayName = getShortDayName(day.week_day);
    const openTime = formatTime(day.open_time);
    const closeTime = formatTime(day.close_time);

    return `${dayName}: ${openTime}–${closeTime}`;
  }).join(" | ");
}

function sortWorkingHours(hours) {
  const order = [1, 2, 3, 4, 5, 6, 0];

  return [...hours].sort((a, b) => {
    return order.indexOf(a.week_day) - order.indexOf(b.week_day);
  });
}

function getShortDayName(weekDay) {
  const days = {
    0: "Dom",
    1: "Seg",
    2: "Ter",
    3: "Qua",
    4: "Qui",
    5: "Sex",
    6: "Sab"
  };

  return days[weekDay] || "Dia";
}

function formatTime(time) {
  if (!time) {
    return "--:--";
  }

  return time.slice(0, 5);
}
