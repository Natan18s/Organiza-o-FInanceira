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

// Troca de aba: mostra a seção escolhida e esconde as outras.
function switchTab(tab){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("hidden",p.id!==tab));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="transactions") renderTransactions();
  if(tab==="categories") renderCategories();
}

// Muda o mês visto e sincroniza os três seletores de mês (Resumo, Lançamentos e Cartões).
function setMonth(m){ if(!m)return; month=m; ["dashboardMonth","txMonth","cardsMonth"].forEach(id=>{$(id).value=m}); renderAll(); }

// Redesenha todas as abas. Chamada por save() depois de qualquer mudança.
function renderAll(){ renderDashboard(); renderTransactions(); renderCards(); renderPeople(); renderCategories(); renderRules(); renderImportCardOptions(); }

// Vai para a aba Lançamentos e destaca a linha do lançamento
function goToTransaction(id){
  const t=data.transactions.find(x=>x.id===id);
  if(!t){toast("Esse lançamento não existe mais.");return}
  closeModal();
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
}

// Fecha o painel e libera a rolagem da tela.
function closeModal(){$("modal").classList.add("hidden");document.documentElement.classList.remove("modal-open")}
