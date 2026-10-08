// ====================================================================
// ui.js — peças comuns da interface
// Aviso rápido (toast), painel (modal), troca de aba, mês visto e redesenho geral.
// ====================================================================

// Mostra o aviso rápido no canto da tela, com um botão de ação opcional (ex.: Desfazer).
function showToast(msg,actionLabel,actionFn){
  const t=$("toast");
  t.innerHTML = actionLabel ? `<span>${esc(msg)}</span><button type="button" class="toast-action">${esc(actionLabel)}</button>` : esc(msg);
  if(actionLabel){ t.querySelector(".toast-action").onclick=()=>{actionFn();t.classList.remove("show")} }
  t.classList.add("show");
  clearTimeout(showToast._h);
  showToast._h=setTimeout(()=>t.classList.remove("show"),actionLabel?6000:2200);
}

// Aviso rápido simples, sem botão.
const toast = msg => showToast(msg);

// ----- Botão "voltar" do celular -----
// Cada aba aberta e cada painel aberto ganham uma entrada no histórico do navegador. Assim o botão voltar fecha o painel
// ou volta para a aba anterior, em vez de sair do site (o tratamento do evento "popstate" fica em main.js).
let currentTab="dashboard";   // aba que está aberta
let modalHistory=false;       // true quando o painel aberto tem uma entrada própria no histórico
let ignorePop=0;              // quantos eventos "popstate" causados pelo próprio app devem ser ignorados

// Troca de aba: mostra a seção escolhida e esconde as outras. fromHistory=true quando veio do botão voltar (não cria entrada nova).
function switchTab(tab,fromHistory){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("hidden",p.id!==tab));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="transactions") renderTransactions();
  if(tab==="rules") renderCategories();   // Categorias agora ficam dentro da aba Regras
  if(fromHistory!==true){
    if(modalHistory){ history.replaceState({tab},""); modalHistory=false; }   // o painel foi fechado por navegação: a entrada dele vira a da nova aba
    else if(tab!==currentTab) history.pushState({tab},"");
  }
  currentTab=tab;
  window.scrollTo(0,0);
}

// Muda o mês visto e sincroniza os três seletores de mês (Resumo, Lançamentos e Cartões).
function setMonth(m){ if(!m)return; month=m; ["dashboardMonth","txMonth","cardsMonth"].forEach(id=>{$(id).value=m}); renderAll(); }

// Redesenha todas as abas. Chamada por save() depois de qualquer mudança.
function renderAll(){ renderDashboard(); renderTransactions(); renderCards(); renderPeople(); renderCategories(); renderRules(); renderImportCardOptions(); }

// Vai para a aba Lançamentos e destaca a linha do lançamento
function goToTransaction(id){
  const t=data.transactions.find(x=>x.id===id);
  if(!t){toast("Esse lançamento não existe mais.");return}
  closeModal("keep");   // fecha o painel sem mexer no histórico (switchTab ajusta)
  $("txSearch").value="";$("txType").value="";
  const inView=t.date.slice(0,7)===month||(t.type==="expense"&&(t.paymentDate||t.date).slice(0,7)===month);
  if(!inView) setMonth(t.date.slice(0,7));
  switchTab("transactions");
  renderTransactions();
  const row=$("tx-"+id);
  if(row){row.scrollIntoView({block:"center",behavior:"smooth"});row.classList.add("row-highlight");setTimeout(()=>row.classList.remove("row-highlight"),2800)}
}

// Abre o painel (janela) com título e conteúdo. Enquanto está aberto, só ele rola; a tela de trás fica parada.
function openModal(title, body){
  $("modalTitle").textContent=title;
  $("modalBody").innerHTML=body;
  $("modal").classList.remove("hidden");
  document.documentElement.classList.add("modal-open");   // só o painel rola; a tela de trás fica parada
  $("modal").querySelector(".modal-box").scrollTop=0;
  if(!modalHistory){ history.pushState({tab:currentTab,modal:true},""); modalHistory=true; }   // o botão voltar do celular vai fechar este painel
}

// Fecha o painel e libera a rolagem da tela.
// mode="pop": veio do botão voltar (a entrada do histórico já saiu). mode="keep": navegação vai cuidar do histórico. Sem mode (✕, fora, Esc, salvar): remove a entrada do painel.
function closeModal(mode){
  $("modal").classList.add("hidden");
  document.documentElement.classList.remove("modal-open");
  if(!modalHistory||mode==="keep")return;
  modalHistory=false;
  if(mode!=="pop"){ ignorePop++; history.back(); }
}
