# Meu Controle Financeiro

App de organização financeira (HTML + CSS + JavaScript puro, sem instalar nada). Os dados ficam salvos no próprio aparelho (localStorage) e o app pode ser instalado no celular (PWA).

## Estrutura de arquivos

```
index.html            Estrutura das telas (abas, cards, tabelas, painel)
manifest.json         Nome, cores e ícones do app instalado no celular
sw.js                 Service worker (funcionar sem internet / instalar)
icon-192.png          Ícones do app
icon-512.png
css/
  theme.css           Cores dos temas claro e escuro (comece aqui para mudar cores)
  base.css            Cabeçalho, abas, cards, botões, formulários, tabelas, barras
  components.css      Painel, prévia de parcelas, Resumo, efeito de elevação, celular
js/                   (a ordem de carregamento está no index.html)
  utils.js            Funções auxiliares: dinheiro, datas, ids
  config.js           Constantes e estado global (mês visto, seleção, dados)
  theme.js            Tema claro/escuro
  calculations.js     Cálculos: entradas, gasto realmente seu, empréstimos, vencimentos
  storage.js          Salvar/carregar (localStorage) e histórico de atividades
  ui.js               Aviso rápido, painel (modal), troca de aba, mês visto
  dashboard.js        Aba Resumo
  transactions.js     Aba Lançamentos e formulário de gasto/entrada
  cadastros.js        Cartões, Pessoas, Categorias e Regras
  importer.js         Importação de CSV/OFX
  backup.js           Backup e restauração
  main.js             Liga os botões aos comportamentos e inicia o app (sempre o último)
```

## Onde mexer para...

| Quero mudar... | Arquivo |
|---|---|
| Uma cor do app | `css/theme.css` |
| Texto ou lugar de um card | `index.html` |
| Como um número do Resumo é calculado | `js/calculations.js` e `js/dashboard.js` |
| O formulário de gasto | `js/transactions.js` |
| Como o app lê extratos do banco | `js/importer.js` |

## Importante ao publicar

Sempre que alterar qualquer arquivo, aumente o número da versão em `sw.js` (`meu-controle-v6` -> `v7`) para o celular baixar a versão nova. Se criar um arquivo novo em `css/` ou `js/`, inclua-o na lista `FILES` do `sw.js` e no `index.html`.
