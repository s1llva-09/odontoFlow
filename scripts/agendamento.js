/*
  TELA DE ESCOLHA DO PROCEDIMENTO

  Essa tela agora busca os procedimentos direto do Supabase.

  Responsabilidades:
  1. Buscar procedimentos ativos no banco
  2. Criar os cards dinamicamente no HTML
  3. Permitir que o paciente escolha um procedimento
  4. Salvar a escolha temporariamente no localStorage
  5. Liberar o botão "Continuar"
*/

/*
  Pega do HTML o elemento onde os cards serão inseridos.
*/
const appointmentGrid = document.querySelector(".appointment-grid");

/*
  Pega o botão continuar.
  Ele começa desabilitado e só libera após escolher um procedimento.
*/
const continueButton = document.querySelector(".continue-button");

/*
  Variável que guarda o procedimento selecionado nesta tela.
*/
let selectedProcedure = null;

/*
  Assim que o arquivo carrega, chamamos a função que busca os dados.
*/
loadProcedures();

/*
  Busca os procedimentos no Supabase.
*/
async function loadProcedures() {
  /*
    Mensagem temporária enquanto carrega.
  */
  appointmentGrid.innerHTML = "<p>Carregando procedimentos...</p>";

  /*
    Consulta na tabela procedures.

    .eq("active", true)
    busca apenas procedimentos ativos.

    .order("created_at")
    organiza pela data de criação.
  */
  const { data, error } = await supabaseClient
    .from("procedures")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  /*
    Se houver erro, mostramos no console e na tela.
  */
  if (error) {
    console.error("Erro ao buscar procedimentos:", error);

    appointmentGrid.innerHTML = `
      <p>Erro ao carregar procedimentos. Verifique o banco.</p>
    `;

    return;
  }

  /*
    Se não vier nenhum procedimento, avisamos na tela.
  */
  if (!data || data.length === 0) {
    appointmentGrid.innerHTML = `
      <p>Nenhum procedimento cadastrado.</p>
    `;

    return;
  }

  /*
    Se deu certo, renderizamos os cards.
  */
  renderProcedures(data);
}

/*
  Cria os cards de procedimentos no HTML.
*/
function renderProcedures(procedures) {
  /*
    Limpa o grid antes de adicionar os cards.
  */
  appointmentGrid.innerHTML = "";

  /*
    Busca se já havia um procedimento salvo antes.
    Isso ajuda caso o paciente volte para essa etapa.
  */
  const currentAppointment = getCurrentAppointment();

  /*
    Percorre cada procedimento vindo do banco.
  */
  procedures.forEach((procedure) => {
    /*
      Cria um botão para ser o card.
    */
    const card = document.createElement("button");

    /*
      Define a classe do card.
    */
    card.className = "service-card";

    /*
      Define o tipo como button para não tentar enviar formulário.
    */
    card.type = "button";

    /*
      Monta o conteúdo do card.
    */
    card.innerHTML = `
      <span class="service-icon">${procedure.icon || "🦷"}</span>

      <div>
        <h2>${procedure.name}</h2>

        <div class="service-meta">
          <span>🕘 ${procedure.duration_minutes} min</span>
          <strong>${formatCurrency(procedure.price)}</strong>
        </div>
      </div>
    `;

    /*
      Se esse procedimento já estava salvo,
      marcamos ele como selecionado novamente.
    */
    if (
      currentAppointment.procedure &&
      currentAppointment.procedure.id === procedure.id
    ) {
      card.classList.add("selected");
      addSelectedLabel(card);
      selectedProcedure = procedure;
      enableContinueButton();
    }

    /*
      Quando o usuário clica no card,
      chamamos a função de seleção.
    */
    card.addEventListener("click", () => {
      selectProcedure(card, procedure);
    });

    /*
      Adiciona o card dentro do grid.
    */
    appointmentGrid.appendChild(card);
  });
}

/*
  Seleciona um procedimento.
*/
function selectProcedure(card, procedure) {
  /*
    Pega todos os cards da tela.
  */
  const allCards = document.querySelectorAll(".service-card");

  /*
    Remove seleção dos outros cards.
  */
  allCards.forEach((item) => {
    item.classList.remove("selected");

    const oldLabel = item.querySelector(".selected-label");

    if (oldLabel) {
      oldLabel.remove();
    }
  });

  /*
    Marca o card clicado como selecionado.
  */
  card.classList.add("selected");

  /*
    Adiciona o texto "Selecionado".
  */
  addSelectedLabel(card);

  /*
    Guarda o procedimento selecionado na variável.
  */
  selectedProcedure = procedure;

  /*
    Salva temporariamente no localStorage.
  */
  saveCurrentAppointment({
    procedure: selectedProcedure
  });

  /*
    Libera o botão continuar.
  */
  enableContinueButton();
}

/*
  Adiciona o selo "Selecionado" no card.
*/
function addSelectedLabel(card) {
  /*
    Evita duplicar a label.
  */
  const alreadyHasLabel = card.querySelector(".selected-label");

  if (alreadyHasLabel) {
    return;
  }

  /*
    Cria o elemento visual.
  */
  const label = document.createElement("span");

  label.classList.add("selected-label");
  label.textContent = "✓ Selecionado";

  /*
    Adiciona no final do card.
  */
  card.appendChild(label);
}

/*
  Libera o botão continuar.
*/
function enableContinueButton() {
  continueButton.classList.remove("disabled-link");
  continueButton.classList.remove("btn-disabled");
  continueButton.classList.add("btn-primary");
}