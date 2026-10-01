// ====================================================================
// theme.js — tema claro/escuro
// O app abre sempre no tema claro. A escolha do usuário fica guardada à parte dos dados (não entra no backup).
// ====================================================================

// ===== Tema claro / escuro (guardado à parte dos dados, não entra no backup) =====
const THEME_KEY="meu-controle-theme";

// Devolve o tema em uso: "light" ou "dark".
function currentTheme(){ return document.documentElement.dataset.theme==="dark"?"dark":"light"; }

// Aplica o tema (troca as cores, o ícone/texto do botão e a cor da barra do navegador). Se persist=true, lembra a escolha neste aparelho.
function applyTheme(t,persist){
  document.documentElement.dataset.theme=t;
  if(persist){ try{localStorage.setItem(THEME_KEY,t)}catch{} }
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=t==="dark"?"#0a101d":"#14275f";
  $("themeIcon").textContent=t==="dark"?"☀️":"🌙";
  $("themeLabel").textContent=t==="dark"?"Claro":"Escuro";
  const b=$("themeToggle"), txt=t==="dark"?"Mudar para o modo claro":"Mudar para o modo escuro";
  b.title=txt; b.setAttribute("aria-label",txt);
}
