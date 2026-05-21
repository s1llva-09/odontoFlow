/*
  LOGIN ADMIN TEMPORÁRIO

  Esse login busca o usuário na tabela admin_users.

  IMPORTANTE:
  Esta versão é para teste/MVP local.
  Em produção, o ideal é usar Supabase Auth com senha criptografada.
*/

const adminLoginForm = document.querySelector("#adminLoginForm");
const adminEmailInput = document.querySelector("#adminEmail");
const adminPasswordInput = document.querySelector("#adminPassword");
const adminLoginButton = document.querySelector("#adminLoginButton");

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = adminEmailInput.value.trim().toLowerCase();
  const password = adminPasswordInput.value.trim();

  if (!email || !password) {
    alert("Informe e-mail e senha.");
    return;
  }

  adminLoginButton.textContent = "Entrando...";
  adminLoginButton.disabled = true;

  const { data: user, error } = await supabaseClient
    .from("admin_users")
    .select(`
      *,
      dentists (*)
    `)
    .eq("email", email)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar usuário:", JSON.stringify(error, null, 2));
    alert("Erro ao fazer login.");

    adminLoginButton.textContent = "Entrar no painel";
    adminLoginButton.disabled = false;
    return;
  }

  if (!user) {
    alert("Usuário não encontrado ou inativo.");

    adminLoginButton.textContent = "Entrar no painel";
    adminLoginButton.disabled = false;
    return;
  }

  if ((user.password || "123456") !== password) {
    alert("Senha incorreta.");

    adminLoginButton.textContent = "Entrar no painel";
    adminLoginButton.disabled = false;
    return;
  }

  await supabaseClient
    .from("admin_users")
    .update({
      last_access_at: new Date().toISOString()
    })
    .eq("id", user.id);

  localStorage.setItem("odontoflow_admin_logged", "true");
  localStorage.setItem("odontoflow_admin_user_id", user.id);
  localStorage.setItem("odontoflow_admin_name", user.full_name);
  localStorage.setItem("odontoflow_admin_email", user.email);
  localStorage.setItem("odontoflow_admin_role", user.role);
  localStorage.setItem("odontoflow_admin_dentist_id", user.dentist_id || "");

  window.location.href = "./admin-dashboard.html";
});