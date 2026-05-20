/*
  TELA ADMIN FINANCEIRO

  Responsabilidades:
  1. Verificar login fake temporário
  2. Buscar movimentações financeiras no Supabase
  3. Cadastrar entrada ou saída
  4. Calcular total de entradas
  5. Calcular total de saídas
  6. Calcular saldo
  7. Filtrar movimentações por texto e tipo
  8. Excluir movimentação
*/

/*
  Verifica se o admin está logado.
  Por enquanto usamos login fake no localStorage.
  Depois vamos substituir por Supabase Auth.
*/
const isAdminLogged = localStorage.getItem("odontoflow_admin_logged");

if (isAdminLogged !== "true") {
  window.location.href = "./admin-login.html";
}

/*
  Seleciona o formulário financeiro.
*/
const financeForm = document.querySelector("#financeForm");

/*
  Seleciona os campos do formulário.
*/
const transactionTypeInput = document.querySelector("#transactionType");
const transactionDescriptionInput = document.querySelector("#transactionDescription");
const transactionAmountInput = document.querySelector("#transactionAmount");
const transactionCategoryInput = document.querySelector("#transactionCategory");
const paymentMethodInput = document.querySelector("#paymentMethod");
const transactionDateInput = document.querySelector("#transactionDate");
const transactionNotesInput = document.querySelector("#transactionNotes");

/*
  Botão de salvar.
*/
const saveTransactionButton = document.querySelector("#saveTransactionButton");

/*
  Elementos dos cards financeiros.
*/
const totalIncomeElement = document.querySelector("#totalIncome");
const totalExpenseElement = document.querySelector("#totalExpense");
const balanceElement = document.querySelector("#balance");
const totalTransactionsElement = document.querySelector("#totalTransactions");

/*
  Tabela de movimentações.
*/
const transactionsTable = document.querySelector("#transactionsTable");

/*
  Botões e filtros.
*/
const reloadButton = document.querySelector("#reloadButton");
const logoutButton = document.querySelector("#logoutButton");
const financeSearchInput = document.querySelector("#financeSearchInput");
const typeFilter = document.querySelector("#typeFilter");

/*
  Lista completa de movimentações carregadas do banco.
*/
let allTransactions = [];

/*
  Define a data atual no campo de data ao abrir a tela.
*/
transactionDateInput.value = getTodayDate();

/*
  Evento de logout.
*/
logoutButton.addEventListener("click", () => {
  localStorage.removeItem("odontoflow_admin_logged");
  window.location.href = "./admin-login.html";
});

/*
  Evento do botão atualizar.
*/
reloadButton.addEventListener("click", () => {
  loadTransactions();
});

/*
  Quando digita na busca, aplicamos filtros.
*/
financeSearchInput.addEventListener("input", applyFilters);

/*
  Quando muda o tipo, aplicamos filtros.
*/
typeFilter.addEventListener("change", applyFilters);

/*
  Evento de cadastro de movimentação.
*/
financeForm.addEventListener("submit", async (event) => {
  /*
    Evita recarregar a página.
  */
  event.preventDefault();

  /*
    Pega os valores digitados.
  */
  const type = transactionTypeInput.value;
  const description = transactionDescriptionInput.value.trim();
  const amount = Number(transactionAmountInput.value);
  const category = transactionCategoryInput.value;
  const paymentMethod = paymentMethodInput.value;
  const transactionDate = transactionDateInput.value;
  const notes = transactionNotesInput.value.trim();

  /*
    Validação dos campos obrigatórios.
  */
  if (!type || !description || !amount || !transactionDate) {
    alert("Preencha tipo, descrição, valor e data.");
    return;
  }

  /*
    Evita valor inválido.
  */
  if (amount <= 0) {
    alert("Informe um valor maior que zero.");
    return;
  }

  /*
    Bloqueia o botão para evitar duplo cadastro.
  */
  saveTransactionButton.textContent = "Salvando...";
  saveTransactionButton.disabled = true;

  /*
    Monta o objeto no formato da tabela financial_transactions.
  */
  const transactionData = {
    type: type,
    description: description,
    category: category || null,
    amount: amount,
    payment_method: paymentMethod || null,
    transaction_date: transactionDate,
    notes: notes || null
  };

  /*
    Insere no Supabase.
  */
  const { error } = await supabaseClient
    .from("financial_transactions")
    .insert(transactionData);

  /*
    Trata erro.
  */
  if (error) {
    console.error("Erro ao cadastrar movimentação:", error);
    alert("Erro ao cadastrar movimentação.");

    saveTransactionButton.textContent = "Cadastrar movimentação";
    saveTransactionButton.disabled = false;

    return;
  }

  /*
    Limpa o formulário.
  */
  financeForm.reset();

  /*
    Recoloca a data de hoje após limpar.
  */
  transactionDateInput.value = getTodayDate();

  /*
    Restaura o botão.
  */
  saveTransactionButton.textContent = "Cadastrar movimentação";
  saveTransactionButton.disabled = false;

  /*
    Atualiza a lista.
  */
  await loadTransactions();

  alert("Movimentação cadastrada com sucesso!");
});

/*
  Carrega movimentações ao abrir a página.
*/
loadTransactions();

/*
  Busca movimentações financeiras no Supabase.
*/
async function loadTransactions() {
  transactionsTable.innerHTML = `
    <tr>
      <td colspan="8">Carregando movimentações...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("financial_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar movimentações:", error);

    transactionsTable.innerHTML = `
      <tr>
        <td colspan="8">Erro ao carregar movimentações.</td>
      </tr>
    `;

    return;
  }

  /*
    Guarda a lista completa.
  */
  allTransactions = data || [];

  /*
    Atualiza cards com a lista completa.
  */
  updateFinanceCards(allTransactions);

  /*
    Renderiza tabela.
  */
  renderTransactions(allTransactions);
}

/*
  Atualiza os cards financeiros.
*/
function updateFinanceCards(transactions) {
  /*
    Soma todas as entradas.
  */
  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => {
      return total + Number(transaction.amount || 0);
    }, 0);

  /*
    Soma todas as saídas.
  */
  const totalExpense = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => {
      return total + Number(transaction.amount || 0);
    }, 0);

  /*
    Saldo = entradas - saídas.
  */
  const balance = totalIncome - totalExpense;

  /*
    Atualiza o HTML.
  */
  totalIncomeElement.textContent = formatCurrency(totalIncome);
  totalExpenseElement.textContent = formatCurrency(totalExpense);
  balanceElement.textContent = formatCurrency(balance);
  totalTransactionsElement.textContent = transactions.length;
}

/*
  Aplica filtros de busca e tipo.
*/
function applyFilters() {
  const searchTerm = financeSearchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;

  /*
    Começa com a lista completa.
  */
  let filteredTransactions = [...allTransactions];

  /*
    Filtra por tipo, se não for "all".
  */
  if (selectedType !== "all") {
    filteredTransactions = filteredTransactions.filter((transaction) => {
      return transaction.type === selectedType;
    });
  }

  /*
    Filtra por texto.
  */
  if (searchTerm) {
    filteredTransactions = filteredTransactions.filter((transaction) => {
      const description = transaction.description || "";
      const category = transaction.category || "";
      const paymentMethod = transaction.payment_method || "";
      const notes = transaction.notes || "";

      return (
        description.toLowerCase().includes(searchTerm) ||
        category.toLowerCase().includes(searchTerm) ||
        paymentMethod.toLowerCase().includes(searchTerm) ||
        notes.toLowerCase().includes(searchTerm)
      );
    });
  }

  /*
    Cards devem refletir o filtro atual.
  */
  updateFinanceCards(filteredTransactions);

  /*
    Renderiza tabela filtrada.
  */
  renderTransactions(filteredTransactions);
}

/*
  Renderiza movimentações na tabela.
*/
function renderTransactions(transactions) {
  if (!transactions.length) {
    transactionsTable.innerHTML = `
      <tr>
        <td colspan="8">Nenhuma movimentação encontrada.</td>
      </tr>
    `;

    return;
  }

  transactionsTable.innerHTML = transactions.map((transaction) => {
    const isIncome = transaction.type === "income";

    const typeLabel = isIncome ? "Entrada" : "Saída";
    const typeClass = isIncome ? "finance-type-income" : "finance-type-expense";
    const valueClass = isIncome ? "finance-value-income" : "finance-value-expense";
    const valuePrefix = isIncome ? "+" : "-";

    return `
      <tr>
        <td>
          <span class="status-badge ${typeClass}">
            ${typeLabel}
          </span>
        </td>

        <td>${transaction.description || "-"}</td>
        <td>${transaction.category || "-"}</td>

        <td class="${valueClass}">
          ${valuePrefix} ${formatCurrency(transaction.amount || 0)}
        </td>

        <td>${transaction.payment_method || "-"}</td>
        <td>${formatDateToBR(transaction.transaction_date)}</td>
        <td>${transaction.notes || "-"}</td>

        <td>
          <div class="table-actions">
            <button 
              class="table-action-btn cancel"
              onclick="deleteTransaction('${transaction.id}')"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/*
  Exclui uma movimentação financeira.
*/
async function deleteTransaction(transactionId) {
  const confirmAction = confirm("Tem certeza que deseja excluir esta movimentação?");

  if (!confirmAction) {
    return;
  }

  const { error } = await supabaseClient
    .from("financial_transactions")
    .delete()
    .eq("id", transactionId);

  if (error) {
    console.error("Erro ao excluir movimentação:", error);
    alert("Erro ao excluir movimentação.");
    return;
  }

  await loadTransactions();

  alert("Movimentação excluída com sucesso!");
}

/*
  Retorna a data atual no formato YYYY-MM-DD.
  Esse é o formato aceito pelo input type="date".
*/
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

/*
  Formata data YYYY-MM-DD para DD/MM/YYYY.
*/
function formatDateToBR(date) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}