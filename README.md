# Meu Controle Financeiro

App de organização financeira (HTML + CSS + JavaScript puro). Os dados ficam salvos no aparelho (localStorage) e o app pode ser instalado no celular (PWA).

Esta versão usa **todos os arquivos na mesma pasta** (sem subpastas), para evitar erro de caminho ao publicar.

## Arquivos

- `index.html` — estrutura das telas
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — instalação no celular e funcionamento sem internet
- CSS: `theme.css` (cores dos temas), `base.css` (estrutura geral), `components.css` (componentes e celular)
- JS (ordem de carregamento no `index.html`): `utils.js`, `config.js`, `theme.js`, `calculations.js`, `storage.js`, `ui.js`, `dashboard.js`, `transactions.js`, `cadastros.js`, `importer.js`, `backup.js`, `main.js` (sempre o último)

Sempre que alterar qualquer arquivo, aumente a versão em `sw.js` (`meu-controle-v6` -> `v7`). Se criar um arquivo novo, inclua-o na lista `FILES` do `sw.js` e no `index.html`.
