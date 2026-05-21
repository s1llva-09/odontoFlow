/*
  TELA DE ESCOLHA DO DENTISTA

  Essa tela busca os dentistas diretamente do Supabase.

  Responsabilidades deste arquivo:
  1. Buscar dentistas ativos no banco
  2. Criar os cards de dentistas automaticamente
  3. Permitir que o paciente selecione um dentista
  4. Salvar o dentista escolhido no localStorage temporariamente
  5. Liberar o botão "Continuar"
*/

/*
  Seleciona no HTML o local onde os cards dos dentistas serão exibidos.
*/
const dentistGrid = document.querySelector(".dentist-grid");

/*
  Seleciona o botão continuar.

  Esse botão começa bloqueado com a classe disabled-link.
  Só será liberado depois que o paciente escolher um dentista.
*/
const continueButton = document.querySelector(".continue-button");

/*
  Guarda temporariamente o dentista selecionado nesta tela.
*/
let selectedDentist = null;
let dentists = [];

/*
  Assim que a página carrega, chamamos a função que busca os dentistas.
*/
loadDentists();

/*
  Função responsável por buscar os dentistas no Supabase.
*/
async function loadDentists() {
  /*
    Enquanto os dados não chegam, mostramos uma mensagem simples.
  */
  dentistGrid.innerHTML = "<p>Carregando dentistas...</p>";

  /*
    Consulta na tabela dentists.

    .eq("active", true)
    busca apenas os dentistas ativos.

    .order("created_at")
    organiza os dentistas pela ordem em que foram cadastrados.
  */
  const { data, error } = await supabaseClient
    .from("dentists")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  /*
    Se der erro na consulta, mostramos no console e na tela.
  */
  if (error) {
    console.error("Erro ao buscar dentistas:", error);

    dentistGrid.innerHTML = `
      <p>Erro ao carregar dentistas. Verifique o banco.</p>
    `;

    return;
  }

  /*
    Se a tabela estiver vazia, mostramos uma mensagem.
  */
  if (!data || data.length === 0) {
    dentistGrid.innerHTML = `
      <p>Nenhum dentista cadastrado.</p>
    `;

    return;
  }

  /*
    Se tudo der certo, criamos os cards dos dentistas.
  */
  dentists = data || [];

  renderDentists(dentists);
}

/*
  Cria os cards dos dentistas no HTML.
*/
function renderDentists(dentists) {
  /*
    Limpa o grid antes de inserir os cards.
  */
  dentistGrid.innerHTML = "";

  /*
    Busca se já existe algum dentista salvo no agendamento atual.
    Isso é útil caso o paciente volte de uma etapa posterior.
  */
  const currentAppointment = getCurrentAppointment();

  /*
    Percorre todos os dentistas vindos do banco.
  */
  dentists.forEach((dentist) => {
    /*
      Cria um botão que será o card do dentista.
    */
    const card = document.createElement("button");

    /*
      Define as classes visuais do card.
    */
    card.className = "dentist-card";

    /*
      Define o tipo button para evitar comportamento de submit.
    */
    card.type = "button";

    /*
      Monta o conteúdo do card.

      avatar_color vem do banco e pode ser:
      blue, purple, pink etc.
    */
    card.innerHTML = `
      <div class="dentist-avatar ${dentist.avatar_color || "blue"}">
        ${dentist.initials || "DR"}
      </div>

      <h2>${dentist.name}</h2>
      <p>${dentist.specialty}</p>
    `;

    /*
      Se esse dentista já estava salvo no localStorage,
      marcamos ele novamente como selecionado.
    */
    if (
      currentAppointment.dentist &&
      currentAppointment.dentist.id === dentist.id
    ) {
      card.classList.add("selected");
      addSelectedLabel(card);
      selectedDentist = dentist;
      enableContinueButton();
    }

    /*
      Quando o usuário clicar no card,
      chamamos a função que seleciona o dentista.
    */
    card.addEventListener("click", () => {
      selectDentist(card, dentist);
    });

    /*
      Adiciona o card no grid da página.
    */
    dentistGrid.appendChild(card);
  });
}

/*
  Seleciona um dentista.
*/
function selectDentist(card, dentist) {
  /*
    Busca todos os cards de dentistas da tela.
  */
  const allCards = document.querySelectorAll(".dentist-card");

  /*
    Remove a seleção dos outros cards.
  */
  allCards.forEach((item) => {
    item.classList.remove("selected");

    /*
      Remove o texto "Selecionado" antigo, se existir.
    */
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
    Adiciona o texto "Selecionado" dentro do card.
  */
  addSelectedLabel(card);

  /*
    Guarda o dentista selecionado na variável.
  */
  selectedDentist = dentist;

  /*
    Salva o dentista escolhido no localStorage temporário.
  */
  saveCurrentAppointment({
    dentist: selectedDentist,
    dentist_id: selectedDentist.id,
    date: null,
    time: null
  });

  /*
    Libera o botão continuar.
  */
  enableContinueButton();
}

/*
  Adiciona a label "Selecionado" no card.
*/
function addSelectedLabel(card) {
  /*
    Verifica se o card já tem a label.
    Isso evita duplicar o texto.
  */
  const alreadyHasLabel = card.querySelector(".selected-label");

  if (alreadyHasLabel) {
    return;
  }

  /*
    Cria o elemento da label.
  */
  const label = document.createElement("span");

  /*
    Classe usada no CSS para deixar o texto verde.
  */
  label.classList.add("selected-label");

  /*
    Texto exibido dentro do card.
  */
  label.textContent = "✓ Selecionado";

  /*
    Adiciona a label no final do card.
  */
  card.appendChild(label);
}

/*
  Libera o botão continuar.
*/
function enableContinueButton() {
  /*
    Remove a classe que bloqueia o clique.
  */
  continueButton.classList.remove("disabled-link");

  /*
    Remove estilo de botão desabilitado, caso exista.
  */
  continueButton.classList.remove("btn-disabled");

  /*
    Garante visual de botão azul principal.
  */
  continueButton.classList.add("btn-primary");
}
