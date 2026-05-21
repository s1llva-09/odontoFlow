/*
  ADMIN CLINIC UI

  Responsável por buscar o nome da clínica no Supabase
  e aplicar automaticamente no topo das páginas admin.
*/

loadClinicUiInfo();

async function loadClinicUiInfo() {
  const { data, error } = await supabaseClient
    .from("clinic_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar dados visuais da clínica:", JSON.stringify(error, null, 2));
    return;
  }

  if (!data || !data.length) {
    return;
  }

  const clinic = data[0];

  applyClinicUiInfo(clinic);
}

function applyClinicUiInfo(clinic) {
  const clinicName = clinic.clinic_name || "Clínica OdontoFlow";

  /*
    Atualiza breadcrumb:
    "Clínica OdontoFlow / Configurações"
  */
  const breadcrumbClinicName = document.querySelector(".admin-breadcrumb span");

  if (breadcrumbClinicName) {
    breadcrumbClinicName.textContent = clinicName;
  }

  /*
    Atualiza o nome da marca no menu lateral, se quiser.
    Mantém OdontoFlow como sistema caso prefira não trocar.
  */
  const brandText = document.querySelector(".admin-brand span:last-child");

  if (brandText) {
    brandText.textContent = clinicName;
  }
}
