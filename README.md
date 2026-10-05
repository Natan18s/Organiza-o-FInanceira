# Meu Controle Financeiro

App de organização financeira em HTML + CSS + JavaScript puro (sem instalar nada). Os dados ficam salvos no aparelho (localStorage) e o app pode ser instalado no celular (PWA). Todos os arquivos ficam na MESMA pasta (sem subpastas).

## Regras para a IA que for analisar ou alterar este projeto
1. Responda em português e de forma curta.
2. Devolva SOMENTE os arquivos que mudaram, cada um com o código INTEIRO, em blocos separados e com o nome do arquivo como título. O usuário cola cada um direto no VS Code do GitHub.
3. Todo trecho de código tem um comentário em português dizendo O QUE ele faz. Mantenha esse padrão nos trechos novos e atualize o comentário se o comportamento mudar.
4. São scripts clássicos, sem módulos: as funções são globais (o HTML usa `onclick="..."`) e a ordem de carregamento no `index.html` importa. `main.js` é sempre o último.
5. Os dados são de uma pessoa real, guardados no aparelho: nunca mude o formato salvo sem uma migração em `loadData` / `normalizeTransaction` (`storage.js`).
6. Ao alterar qualquer arquivo, aumente a versão do cache em `sw.js` (`meu-controle-v10` -> `v11`). Se criar um arquivo novo, inclua-o na lista `FILES` do `sw.js` e no `index.html`.
7. Antes de entregar, confira se a mudança respeita as "Regras de negócio" abaixo.

## Arquivos
- `index.html` — estrutura das telas (abas, cards, tabelas, painel)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — instalação no celular e funcionamento sem internet
- `theme.css` — cores dos temas claro e escuro (comece aqui para mudar uma cor)
- `base.css` — cabeçalho, abas, cards, botões, formulários, tabelas, barras
- `components.css` — painel, prévia de parcelas, Resumo, efeito de elevação, ajustes para celular
- `utils.js` — dinheiro, datas, ids
- `config.js` — constantes e estado global (mês visto, seleção, dados)
- `theme.js` — tema claro/escuro (padrão: claro)
- `calculations.js` — cálculos: entradas, gasto realmente seu, empréstimos, vencimentos
- `storage.js` — salvar/carregar (localStorage) e histórico de atividades
- `ui.js` — aviso rápido, painel (modal), troca de aba, mês visto, redesenho geral
- `dashboard.js` — aba Resumo
- `transactions.js` — aba Lançamentos, seleção em massa e formulário de gasto/entrada
- `cadastros.js` — Cartões, Pessoas, Categorias e Regras
- `importer.js` — leitura de CSV/OFX
- `backup.js` — baixar, compartilhar e restaurar backup
- `main.js` — liga os botões aos comportamentos e inicia o app

## Onde mexer para...
| Quero mudar... | Arquivo |
|---|---|
| Uma cor do app | `theme.css` |
| Texto ou lugar de um card | `index.html` |
| Como um número do Resumo é calculado | `calculations.js` e `dashboard.js` |
| O formulário de gasto/entrada | `transactions.js` |
| Cartões, pessoas, categorias, regras | `cadastros.js` |
| Como o app lê extratos | `importer.js` |
| Um botão que não faz nada | `main.js` (é onde os botões são ligados) |

## Formato dos dados (localStorage, chave `meu-controle-v2`)
```
data = {
  version: 2,
  transactions: [ ...lançamentos... ],
  people:  [{id, name}],                       // id "self" = o próprio usuário ("Você")
  cards:   [{id, name, limit, closing, due}],  // closing = dia do fechamento, due = dia do vencimento
  categories: ["Casa", "Alimentação", ...],    // lista de nomes
  rules:   [{id, keyword, category}],          // palavra na descrição -> categoria sugerida
  importLog:   [{id, file, date, count}],      // arquivos já importados
  activityLog: [{id, at, kind, text, detail, txId}],  // histórico de "Últimos lançamentos" (máx. 300)
  lastBackupAt: número | null
}

// Gasto (type "expense")
{ id, createdAt, type:"expense",
  date:"AAAA-MM-DD",            // data da compra
  description, notes, 
  value,                         // valor cheio (de uma parcela, se for parcelado)
  method:"pix|debit|cash|credit|installment",
  cardId,                        // "" se não for crédito/parcelado
  paymentDate:"AAAA-MM-DD",      // quando será pago (é ESTA data que manda no Resumo)
  paymentStatus:"planned|paid",
  installments, installmentNo,   // total de parcelas e número desta (1 e 1 se não parcelado)
  splits:[{id, category, amount, ownerId, reimbursed}] }  // divisão por categoria/pessoa; soma = value

// Entrada (type "income")
{ id, createdAt, type:"income", date, description, value, notes,
  source:"normal|reimbursement",
  sourceCategory, linkedTransactionId, linkedSplitId }   // os 3 últimos só existem em reembolsos automáticos

// Pagamento de fatura importado (type "card_payment")
{ id, date, description, value, cardId, importKey }
```

## Regras de negócio importantes
- O Resumo conta cada gasto pelo mês do PAGAMENTO PREVISTO (`paymentDate`), não pelo mês da compra. As entradas contam pela data da entrada.
- Saídas previstas = valor cheio dos gastos com pagamento no mês. Gasto realmente seu = só a parte do `ownerId:"self"`. Saldo previsto = Entradas − Gasto realmente seu.
- As porcentagens das barras (categoria, cartão e gasto realmente seu) são o valor dividido pelas Entradas do mês; sem entradas aparece "—".
- Pix, Débito e Dinheiro: pagamento na própria data da compra e já pago. Crédito e Parcelado: precisam de cartão; o vencimento sugerido é o dia `due` do cartão no mês seguinte à compra; o status padrão é "previsto".
- Parcelado: cada parcela é um lançamento próprio. O total é dividido pelo número de parcelas (a última leva os centavos que sobrarem) e a data da compra e do pagamento avançam um mês por parcela.
- Divisão: a soma das partes precisa ser igual ao valor. A parte de outra pessoa fica "a receber" até `reimbursed:true`; ao marcar como recebido, o app cria uma entrada (`source:"reimbursement"`) ligada ao gasto.
- A categoria "Empréstimos cedidos" é especial: é dinheiro emprestado. O que volta aparece à parte e não entra no Saldo previsto como previsão.
- Resumo: os 4 cards do topo são clicáveis (abrem a lista de lançamentos). A "Planilha do mês" mostra despesas por categoria (valor cheio, na ordem da aba Categorias), entradas e saldo; o saldo dela usa valores cheios, por isso pode diferir do "Saldo previsto" do topo.
- Categorias: `data.categories` é uma lista de nomes na ordem escolhida pelo usuário (▲ ▼ na aba Categorias). `categoriesV2` marca a migração única que juntou as categorias padrão e ordenou em ordem alfabética.
- Aba Lançamentos: "Selecionar" marca gastos e entradas; definir/limpar pagamento previsto vale só para gastos; excluir vale para tudo e pode ser desfeito.
- Tema: padrão claro; a escolha fica em `localStorage` na chave `meu-controle-theme` (fora do backup).
