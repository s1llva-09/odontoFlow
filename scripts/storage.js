/*
  STORAGE TEMPORÁRIO DO AGENDAMENTO

  O localStorage será usado apenas para guardar os dados
  durante o fluxo do paciente.

  Exemplo:
  - escolheu procedimento na página 1
  - escolheu dentista na página 2
  - escolheu data na página 3
  - preencheu dados na página 4

  Quando o paciente confirmar, aí sim salvamos tudo no Supabase.
*/

/*
  Chave usada para guardar o agendamento que ainda está em andamento.
*/
const STORAGE_KEY = "odontoflow_current_appointment"

/*
  Busca o agendamento atual salvo no localStorage.
  Se não existir nada salvo, retorna um objeto vazio.
*/
function getCurrentAppointment() {
    const data = localStorage.getItem(STORAGE_KEY)

    if (!data) {
        return {}
    }

    return JSON.parse(data)
}

/*
  Salva novas informações no agendamento atual.

  O operador ... mantém os dados antigos
  e adiciona/atualiza os novos.
*/
function saveCurrentAppointment(newData) {
    const currentData = getCurrentAppointment()

    const updatedAppointment = {
        ...currentData,
        ...newData
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAppointment))
}

/*
  Limpa o agendamento temporário.

  Usamos depois que o agendamento já foi salvo no banco.
*/

function clearCurrentAppointment() {
  localStorage.removeItem(STORAGE_KEY);
}

/*
  Formata valores em Real brasileiro.

  Exemplo:
  150 → R$ 150,00
*/
function formatCurrency(value) {
    return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    })
}

/*
  Gera um código aleatório para o agendamento.

  Exemplo:
  OF-A8K92P

  Esse código será entregue ao paciente para consultar o status depois.
*/
function generateAppointmentCode() {
    const randomCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()

    return `OF-${randomCode}`
}
