/*
  ARQUIVO DE CONEXÃO COM O SUPABASE

  Esse arquivo é responsável por conectar o front-end
  ao banco de dados do Supabase.

  IMPORTANTE:
  Aqui usamos a chave "anon public".
  Essa chave pode ficar no front-end, desde que as políticas RLS estejam corretas.

  NUNCA coloque a "service_role key" no front-end.
  A service_role tem acesso total ao banco e deve ficar apenas no backend.
*/

/*
  Cole aqui a URL do seu projeto Supabase.

  Onde encontrar:
  Supabase Dashboard
  → Project Settings
  → API
  → Project URL
*/
const SUPABASE_URL = "https://nnkokgtplnuhmhlqarba.supabase.co"

/*
  Cole aqui a anon/public key do Supabase.

  Onde encontrar:
  Supabase Dashboard
  → Project Settings
  → API
  → Project API keys
  → anon public
*/

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ua29rZ3RwbG51aG1obHFhcmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMjk3MjUsImV4cCI6MjA5NDgwNTcyNX0.2nf1eytsNVNAAi4FymsmTSQEnwpzokGRXV6Lbp7k0pU"

/*
  Aqui criamos o cliente do Supabase.

  A variável "supabase" vem do script CDN:
  https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2

  O resultado fica salvo em "supabaseClient",
  que será usado nos outros arquivos JS.
*/

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
)
