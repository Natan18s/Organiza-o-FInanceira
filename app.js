
const DB_KEY = "meu-controle-v2";
const APP_VERSION = 2;

const defaultData = {
  version: APP_VERSION,
  transactions: [],
  people: [{id:"self", name:"Você"}],
  cards: [
    {id:"nubank", name:"Nubank", limit:0, closing:10, due:19},
    {id:"picpay", name:"PicPay", limit:0, closing:10, due:19}
  ],
  categories: ["Casa","Alimentação","Transporte","Contas","Lazer","Compras","Saúde","Educação","Investimentos","Doações","Outros"],
  rules: [
    {id:"r1", keyword:"uber", category:"Transporte"},
    {id:"r2", keyword:"99", category:"Transporte"},
    {id:"r3", keyword:"posto", category:"Transporte"},
    {id:"r4", keyword:"mercado", category:"Alimentação"}
  ],
  importLog: []
};

let data;
let selectedImport = null;
let pendingImport = [];
let selectedTxIds = new Set();
let month = localISO(new Date()).slice(0,7);

const $ = id => document.getElementById(id);
const fmtMoney = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
function localISO(d){ return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
const today = () => localISO(new Date());
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");
const toast = msg => { const t=$("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); };
data = loadData();

function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(DB_KEY));
    if(saved && Array.isArray(saved.transactions) && Array.isArray(saved.people) && Array.isArray(saved.cards)){
      saved.categories=[...new Set([...(saved.categories||[]),...defaultData.categories])];
      saved.rules ||= [];
      saved.importLog ||= [];
      saved.people=saved.people.some(p=>p.id==="self") ? saved.people : [{id:"self",name:"Você"},...saved.people];
      saved.transactions=saved.transactions.map(t=>normalizeTransaction(t));
      return saved;
    }
  }catch{}
  const fresh=structuredClone(defaultData);
  fresh.transactions=fresh.transactions.map(normalizeTransaction);
  return fresh;
}
function save(){ localStorage.setItem(DB_KEY, JSON.stringify(data)); renderAll(); }

function switchTab(tab){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("hidden",p.id!==tab));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="transactions") renderTransactions();
  if(tab==="categories") renderCategories();
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
document.querySelectorAll("[data-tab-link]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tabLink)));

$("dashboardMonth").value=month;
$("txMonth").value=month;
$("dashboardMonth").addEventListener("change",e=>{month=e.target.value;$("txMonth").value=month;renderAll()});
$("txMonth").addEventListener("change",e=>{month=e.target.value;$("dashboardMonth").value=month;renderAll()});
$("txSearch").addEventListener("input",renderTransactions);
$("txType").addEventListener("change",renderTransactions);
$("selectAllTx").addEventListener("change",toggleSelectAll);
$("quickExpense").onclick=()=>openTransactionModal("expense");
$("quickIncome").onclick=()=>openTransactionModal("income");
$("newExpense").onclick=()=>openTransactionModal("expense");
$("newIncome").onclick=()=>openTransactionModal("income");
$("newCard").onclick=()=>openCardModal();
$("newPerson").onclick=()=>openPersonModal();
$("newRule").onclick=()=>openRuleModal();
$("newCategory").onclick=()=>openCategoryModal();
$("bulkPaymentDate").onclick=()=>openBulkPaymentModal();
$("bulkClearPayment").onclick=clearBulkPaymentDate;
$("clearSelection").onclick=()=>{selectedTxIds.clear();renderTransactions()};
$("exportBackup").onclick=exportBackup;
$("restoreBackup").onclick=()=>$("backupInput").click();
$("backupInput").onchange=restoreBackup;

function txForMonth(m){return data.transactions.filter(t=>t.date.slice(0,7)===m);}
function transactionGross(t){ return Number(t.value)||0; }
function splitTotal(t){ return (t.splits||[]).reduce((s,x)=>s+Number(x.amount||0),0); }
function ownAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId==="self").reduce((s,x)=>s+Number(x.amount||0),0); }
function receivableAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId!=="self" && s.reimbursed!==true).reduce((s,x)=>s+Number(x.amount||0),0); }
function reimbursedAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId!=="self" && s.reimbursed===true).reduce((s,x)=>s+Number(x.amount||0),0); }

function renderAll(){ renderDashboard(); renderTransactions(); renderCards(); renderPeople(); renderCategories(); renderRules(); renderImportCardOptions(); }

function renderDashboard(){
  const txPurchase=txForMonth(month);
  const income=txPurchase.filter(t=>t.type==="income").reduce((s,t)=>s+t.value,0);
  const gross=txPurchase.filter(t=>t.type==="expense").reduce((s,t)=>s+t.value,0);
  const receivable=txPurchase.filter(t=>t.type==="expense").reduce((s,t)=>s+receivableAmount(t),0);
  const own=txPurchase.filter(t=>t.type==="expense").reduce((s,t)=>s+ownAmount(t),0);
  const scheduled=scheduledPaymentsForMonth(month).reduce((s,t)=>s+t.value,0);
  const reimb=txPurchase.filter(t=>t.type==="income" && t.source==="reimbursement").reduce((s,t)=>s+t.value,0);
  const projected=income-scheduled;
  $("mIncome").textContent=fmtMoney(income);
  $("mGross").textContent=fmtMoney(gross);
  $("mScheduled").textContent=fmtMoney(scheduled);
  $("mReceivable").textContent=fmtMoney(receivable);
  $("mOwn").textContent=fmtMoney(own);
  $("mBalance").textContent=fmtMoney(projected);
  $("mBalance").className=""+(projected>=0?"positive":"negative");

  const cat={}; txPurchase.filter(t=>t.type==="expense").forEach(t=>(t.splits||[]).forEach(s=>cat[s.category]=(cat[s.category]||0)+Number(s.amount||0)));
  const catArr=Object.entries(cat).sort((a,b)=>b[1]-a[1]);
  const max=catArr[0]?.[1]||1;
  $("categoryBars").innerHTML=catArr.length ? catArr.slice(0,10).map(([k,v])=>`<div class="bar-row"><div class="bar-label"><span>${esc(k)}</span><b>${fmtMoney(v)}</b></div><div class="bar"><i style="width:${(v/max)*100}%"></i></div></div>`).join("") : '<div class="empty">Sem gastos neste mês.</div>';

  const cards={}; txPurchase.filter(t=>t.type==="expense"&&t.cardId).forEach(t=>cards[t.cardId]=(cards[t.cardId]||0)+t.value);
  const cArr=Object.entries(cards).sort((a,b)=>b[1]-a[1]);
  $("cardBars").innerHTML=cArr.length ? cArr.map(([id,v])=>{
    const c=data.cards.find(x=>x.id===id);
    return `<div class="bar-row"><div class="bar-label"><span>${esc(c?.name||"Cartão")}</span><b>${fmtMoney(v)}</b></div><div class="bar"><i style="width:${Math.min(100,v/(c?.limit||Math.max(v,1))*100)}%"></i></div></div>`;
  }).join("") : '<div class="empty">Sem compras em cartão neste mês.</div>';

  const flows=scheduledPaymentsForMonth(month).slice().sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate));
  const cashItems=[];
  txPurchase.filter(t=>t.type==="income").forEach(t=>cashItems.push({date:t.date,type:"income",title:t.description,value:t.value,status:t.source==="reimbursement"?"Reembolso":"Entrada"}));
  flows.forEach(t=>cashItems.push({date:t.paymentDate,type:"expense",title:t.description,value:t.value,status:t.paymentStatus==="paid"?"Pago":"Previsto",card:t.cardId?data.cards.find(c=>c.id===t.cardId)?.name:""}));
  cashItems.sort((a,b)=>a.date.localeCompare(b.date));
  $("cashflowList").innerHTML=cashItems.length ? cashItems.map(x=>`<div class="cashflow-item"><div class="cashflow-main"><span class="cashflow-dot ${x.type}"></span><div><b>${esc(x.title)}</b><div class="muted">${fmtDate(x.date)} · ${esc(x.status)}${x.card?` · ${esc(x.card)}`:""}</div></div></div><strong class="${x.type==="expense"?"negative":"positive"}">${x.type==="expense"?"-":"+"} ${fmtMoney(x.value)}</strong></div>`).join("") : '<div class="empty">Nenhuma entrada ou pagamento previsto neste mês.</div>';

  const pend=[];
  data.transactions.filter(t=>t.type==="expense").forEach(t=>(t.splits||[]).forEach((s,idx)=>{
    if(s.ownerId!=="self" && s.reimbursed!==true) pend.push({t,s,idx});
  }));
  $("receivableList").innerHTML=pend.length ? pend.map(({t,s,idx})=>{
    const p=data.people.find(x=>x.id===s.ownerId);
    return `<div class="reimbursed-row"><div><b>${esc(p?.name||"Outra pessoa")}</b> · ${fmtMoney(s.amount)}<div class="muted">${esc(t.description)} · compra ${fmtDate(t.date)} · pagamento ${fmtDate(t.paymentDate||t.date)}</div></div><button class="btn" onclick="markReimbursement('${t.id}',${idx})">Marcar como recebido</button></div>`;
  }).join("") : '<div class="empty">Nenhum reembolso pendente.</div>';

  const recent=txPurchase.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
  $("recentList").innerHTML=recent.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th class="right">Valor</th></tr></thead><tbody>${recent.map(t=>{const label=t.type==="expense"?"Gasto":t.type==="income"?(t.source==="reimbursement"?"Reembolso":"Entrada"):"Pagamento de cartão";const cls=t.type==="expense"?"negative":"positive";return `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td><td>${label}</td><td class="right ${cls}">${t.type==="expense"?"-":"+"} ${fmtMoney(t.value)}</td></tr>`}).join("")}</tbody></table></div>` : '<div class="empty">Nenhum lançamento.</div>';
}
function scheduledPaymentsForMonth(m){return data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m);}
function nextCardPaymentDate(cardId, baseDate=today()){
  const card=data.cards.find(c=>c.id===cardId);
  if(!card) return baseDate;
  const d=new Date(baseDate+"T12:00:00");
  let y=d.getFullYear(), m=d.getMonth();
  if(d.getDate()>=Number(card.closing||31)) m+=1;
  let day=Math.min(Number(card.due||1), new Date(y,m+1,0).getDate());
  return localISO(new Date(y,m,day));
}
function normalizeTransaction(t){
  if(t.type==="expense"){
    t.splits=Array.isArray(t.splits)&&t.splits.length?t.splits:[{id:uid(),category:"Outros",amount:Number(t.value)||0,ownerId:"self",reimbursed:false}];
    t.installments=t.installments||1;t.installmentNo=t.installmentNo||1;
    if(!t.paymentDate) t.paymentDate=t.cardId?nextCardPaymentDate(t.cardId,t.date||today()):(t.date||today());
    if(!t.paymentStatus) t.paymentStatus=t.cardId?"planned":"paid";
  }
  return t;
}

function categoryLabels(t){
  const splits=t.splits||[];
  if(!splits.length) return "—";
  return splits.map(s=>`<span class="tag">${esc(s.category)} · ${fmtMoney(s.amount)}</span>`).join(" ");
}
function peopleLabels(t){
  if(t.type!=="expense") return "—";
  const people={};
  (t.splits||[]).forEach(s=>{const p=s.ownerId==="self"?"Você":data.people.find(x=>x.id===s.ownerId)?.name||"Outra pessoa";people[p]=(people[p]||0)+Number(s.amount||0)});
  return Object.entries(people).map(([p,v])=>`${esc(p)}: ${fmtMoney(v)}`).join("<br>");
}
function paymentLabel(t){
  if(t.type==="card_payment") return "Crédito";
  if(t.cardId) return esc(data.cards.find(c=>c.id===t.cardId)?.name||"Cartão");
  return "Pix / débito / dinheiro";
}
function paymentDateLabel(t){
  if(t.type!=="expense") return "—";
  const d=t.paymentDate||t.date;
  const status=t.paymentStatus||"planned";
  return `<span class="${status==="paid"?"pay-paid":"pay-planned"}"><b>${fmtDate(d)}</b><br><small>${status==="paid"?"Pago":"Previsto"}</small></span>`;
}
function toggleSelect(id,checked){if(checked)selectedTxIds.add(id);else selectedTxIds.delete(id);updateBulkBar();}
function toggleSelectAll(e){
  const checks=[...document.querySelectorAll(".tx-check")];
  checks.forEach(c=>{c.checked=e.target.checked;if(c.checked)selectedTxIds.add(c.value);else selectedTxIds.delete(c.value)});
  updateBulkBar();
}
function updateBulkBar(){
  $("selectedCount").textContent=selectedTxIds.size;
  $("bulkBar").classList.toggle("hidden",selectedTxIds.size===0);
}
function renderTransactions(){
  const m=$("txMonth").value||month,q=($("txSearch").value||"").toLowerCase(),type=$("txType").value;
  let arr=data.transactions.filter(t=>t.date.slice(0,7)===m && (!type||t.type===type));
  if(q) arr=arr.filter(t=>(t.description+" "+(t.splits||[]).map(s=>s.category).join(" ")+" "+(t.notes||"")).toLowerCase().includes(q));
  arr.sort((a,b)=>b.date.localeCompare(a.date));
  const visibleIds=new Set(arr.map(t=>t.id));
  [...selectedTxIds].forEach(id=>{if(!visibleIds.has(id))selectedTxIds.delete(id)});
  const allExpenses=arr.filter(t=>t.type==="expense");
  $("selectAllTx").checked=allExpenses.length>0 && allExpenses.every(t=>selectedTxIds.has(t.id));
  $("txTable").innerHTML=arr.length ? arr.map(t=>{
    const par=t.installments>1?`${t.installmentNo||1}/${t.installments}`:"—";
    const val=t.type==="expense"?`- ${fmtMoney(t.value)}`:`+ ${fmtMoney(t.value)}`;
    const cls=t.type==="expense"?"negative":"positive";
    return `<tr>
      <td>${t.type==="expense"?`<input class="tx-check" type="checkbox" value="${t.id}" ${selectedTxIds.has(t.id)?"checked":""} onchange="toggleSelect('${t.id}',this.checked)">`:""}</td>
      <td>${fmtDate(t.date)}</td><td><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}</td>
      <td>${t.type==="expense"?categoryLabels(t):t.source==="reimbursement"?'<span class="pill">Reembolso</span>':"—"}</td>
      <td>${paymentLabel(t)}</td><td>${peopleLabels(t)}</td><td>${paymentDateLabel(t)}</td><td>${par}</td>
      <td class="right ${cls}">${val}</td>
      <td><div class="row-actions">${t.type!=="card_payment"?`<button class="btn" onclick="editTransaction('${t.id}')">Editar</button>`:""}<button class="btn ghost" onclick="removeTransaction('${t.id}')">Excluir</button></div></td>
    </tr>`;
  }).join("") : '<tr><td colspan="10" class="empty">Nenhum lançamento encontrado.</td></tr>';
  updateBulkBar();
}
function openBulkPaymentModal(){
  const ids=[...selectedTxIds], expenses=ids.map(id=>data.transactions.find(t=>t.id===id)).filter(t=>t?.type==="expense");
  if(!expenses.length){alert("Selecione pelo menos um gasto.");return}
  const suggested=expenses.length===1?(expenses[0].paymentDate||nextCardPaymentDate(expenses[0].cardId,expenses[0].date)):(month+"-19");
  openModal("Definir pagamento previsto",`<form id="bulkPayForm"><p>Você selecionou <b>${expenses.length}</b> gasto(s). A data abaixo será aplicada a todos.</p><div><label>Data de pagamento</label><input name="paymentDate" type="date" value="${suggested}" required></div><div style="margin-top:10px"><label>Status</label><select name="status"><option value="planned">Pagamento previsto</option><option value="paid">Já pago</option></select></div><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Aplicar aos selecionados</button></div></form>`);
  $("bulkPayForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);expenses.forEach(t=>{t.paymentDate=f.get("paymentDate");t.paymentStatus=f.get("status")});selectedTxIds.clear();closeModal();save();toast(`Pagamento previsto aplicado a ${expenses.length} gasto(s)`) };
}
function clearBulkPaymentDate(){
  const expenses=[...selectedTxIds].map(id=>data.transactions.find(t=>t.id===id)).filter(t=>t?.type==="expense");
  if(!expenses.length)return;
  expenses.forEach(t=>{t.paymentDate=t.date;t.paymentStatus="paid"});selectedTxIds.clear();save();toast("Previsão de pagamento removida");
}

function renderCards(){
  $("cardsGrid").innerHTML=data.cards.map(c=>{
    const total=txForMonth(month).filter(t=>t.type==="expense"&&t.cardId===c.id).reduce((s,t)=>s+t.value,0);
    const pct=c.limit ? Math.min(100,total/c.limit*100):0;
    return `<article class="card-mini"><h3>${esc(c.name)}</h3><div class="big">${fmtMoney(total)}</div><div class="muted">Fecha dia ${c.closing} · vence dia ${c.due}</div>${c.limit?`<div class="bar-row"><div class="bar-label"><span>Limite</span><span>${fmtMoney(c.limit)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`:""}<div class="row-actions"><button class="btn" onclick="openCardModal('${c.id}')">Editar</button><button class="btn ghost" onclick="deleteCard('${c.id}')">Excluir</button></div></article>`;
  }).join("");
}
function renderPeople(){
  const pendingBy={};
  data.transactions.filter(t=>t.type==="expense").forEach(t=>(t.splits||[]).forEach(s=>{
    if(s.ownerId!=="self"&&s.reimbursed!==true) pendingBy[s.ownerId]=(pendingBy[s.ownerId]||0)+Number(s.amount||0);
  }));
  $("peopleList").innerHTML=data.people.map(p=>`<div class="person-card"><div><b>${esc(p.name)}</b><div class="muted">${p.id==="self"?"Você":`A receber: ${fmtMoney(pendingBy[p.id]||0)}`}</div></div>${p.id!=="self"?`<button class="btn ghost" onclick="deletePerson('${p.id}')">Excluir</button>`:""}</div>`).join("");
}
function renderRules(){
  $("rulesList").innerHTML=data.rules.length ? data.rules.map(r=>`<div class="rule-row"><div><b>${esc(r.keyword)}</b> → ${esc(r.category)}</div><button class="btn ghost" onclick="deleteRule('${r.id}')">Excluir</button></div>`).join(""):'<div class="empty">Nenhuma regra.</div>';
}

function openModal(title, body){
  $("modalTitle").textContent=title;
  $("modalBody").innerHTML=body;
  $("modal").classList.remove("hidden");
}
function closeModal(){$("modal").classList.add("hidden")}
$("closeModal").onclick=closeModal;
$("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});

function applyRule(description){
  const d=description.toLowerCase();
  const rule=data.rules.find(r=>d.includes(r.keyword.toLowerCase()));
  return rule?.category || "Outros";
}
function makeDefaultSplit(amount, description, existing){
  return existing || [{id:uid(),category:applyRule(description),amount:Number(amount)||0,ownerId:"self",reimbursed:false}];
}

function transactionForm(t=null,type="expense"){
  const isExpense=type==="expense";const categories=[...data.categories];const cards=data.cards;const people=data.people;
  const splits=(t?.splits?.length?t.splits:makeDefaultSplit(t?.value||0,t?.description||"")).map(s=>({...s}));
  const defaultCard=t?.cardId||"";
  const paymentDate=t?.paymentDate || (defaultCard?nextCardPaymentDate(defaultCard,t?.date||today()):(t?.date||today()));
  return `<form id="txForm"><div class="form-grid">
    <div><label>Data da compra / lançamento</label><input name="date" type="date" value="${t?.date||today()}" required></div>
    <div><label>Valor total</label><input name="value" id="txValue" type="number" min="0" step="0.01" value="${t?.value??""}" required></div>
    <div class="full"><label>Descrição</label><input name="description" id="txDescription" value="${esc(t?.description||"")}" placeholder="Ex.: Mercado, Uber, conta de luz..." required></div>
    ${isExpense?`
      <div><label>Forma / cartão</label><select name="cardId" id="txCard"><option value="">Pix / débito / dinheiro</option>${cards.map(c=>`<option value="${c.id}" ${defaultCard===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select><div class="field-note">Para cartão, o app pode sugerir o próximo vencimento.</div></div>
      <div><label>Pagamento previsto</label><input name="paymentDate" id="txPaymentDate" type="date" value="${paymentDate}"><div class="row-actions" style="margin-top:5px"><button type="button" class="btn ghost" id="useCardDue">Usar próximo vencimento</button></div></div>
      <div><label>Status do pagamento</label><select name="paymentStatus"><option value="planned" ${t?.paymentStatus!=="paid"?"selected":""}>Previsto / ainda não pago</option><option value="paid" ${t?.paymentStatus==="paid"?"selected":""}>Já pago</option></select></div>
      <div><label>Parcelas</label><input name="installments" type="number" min="1" max="48" value="${t?.installments||1}" ${t?"disabled":""}></div>
      <div><label>Mês da 1ª parcela</label><input name="firstMonth" type="month" value="${t?.date?.slice(0,7)||month}" ${t?"disabled":""}></div>
      <div><label>Observação</label><input name="notes" value="${esc(t?.notes||"")}" placeholder="Ex.: fatura de outubro"></div>
    `:`
      <div><label>Origem</label><select name="incomeSource"><option value="normal" ${t?.source!=="reimbursement"?"selected":""}>Entrada normal</option><option value="reimbursement" ${t?.source==="reimbursement"?"selected":""}>Reembolso recebido</option></select></div>
      <div><label>Observação</label><input name="notes" value="${esc(t?.notes||"")}" placeholder="Ex.: salário, extra..."></div>
    `}</div>
    ${isExpense?`<div class="split-header"><div><b>Divisão do gasto</b><div class="field-note">Cada linha pode ter uma categoria e uma pessoa. A soma das linhas precisa bater com o valor total.</div></div><div class="split-actions"><button type="button" class="btn equal-btn" id="splitEqual">Dividir igualmente</button><button type="button" class="btn" id="addSplit">+ Categoria / pessoa</button><button type="button" class="btn ghost" id="manageCategoriesFromTx">Categorias</button></div></div><div id="splitList">${splits.map((s,i)=>splitRow(s,i,categories,people)).join("")}</div><div class="split-total"><span>Total dividido</span><span id="splitSum">${fmtMoney(splits.reduce((a,s)=>a+Number(s.amount||0),0))}</span></div><div class="field-note" id="splitHint"></div>`:""}
    <div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" id="cancelTx">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`;
}
function splitRow(s,i,categories,people){
  return `<div class="split" data-index="${i}"><div class="category"><label>Categoria</label><select class="split-category">${categories.map(c=>`<option ${c===s.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div><div><label>Valor</label><input class="split-amount" type="number" min="0" step="0.01" value="${Number(s.amount||0)}"></div><div class="owner"><label>Quem paga?</label><select class="split-owner">${people.map(p=>`<option value="${p.id}" ${s.ownerId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div><div class="person"><label>Status</label>${s.ownerId==="self"?`<div class="field-note">Não gera reembolso</div>`:`<select class="split-status"><option value="pending" ${s.reimbursed!==true?"selected":""}>A receber</option><option value="received" ${s.reimbursed===true?"selected":""}>Já recebi</option></select>`}</div><button type="button" class="btn ghost remove-split" title="Remover">✕</button></div>`;
}
function makeDefaultSplit(amount,description){return [{id:uid(),category:applyRule(description),amount:Number(amount)||0,ownerId:"self",reimbursed:false}]}
function openTransactionModal(type="expense",tx=null){
  openModal(tx?(type==="expense"?"Editar gasto":"Editar entrada"):(type==="expense"?"Novo gasto":"Nova entrada"),transactionForm(tx,type));
  if(type==="expense"){
    const list=$("splitList");
    const add=()=>{const idx=list.querySelectorAll(".split").length;list.insertAdjacentHTML("beforeend",splitRow({id:uid(),category:"Outros",amount:0,ownerId:"self",reimbursed:false},idx,data.categories,data.people));bindSplitRow(list.lastElementChild);updateSplitTotal()};
    $("addSplit").onclick=add;$("manageCategoriesFromTx").onclick=()=>{closeModal();openCategoryModal()};$("splitEqual").onclick=()=>{const rows=[...list.querySelectorAll(".split")],total=Number($("txValue").value||0),each=rows.length?Math.floor((total/rows.length)*100)/100:0;rows.forEach((r,i)=>r.querySelector(".split-amount").value=i===rows.length-1?(total-each*(rows.length-1)).toFixed(2):each.toFixed(2));updateSplitTotal()};
    [...list.children].forEach(bindSplitRow);updateSplitTotal();
    $("txValue").addEventListener("input",updateSplitTotal);$("txCard").addEventListener("change",()=>{if($("txCard").value && !tx)$("txPaymentDate").value=nextCardPaymentDate($("txCard").value,$("txForm").elements.date.value)});
    $("useCardDue").onclick=()=>{$("txPaymentDate").value=$("txCard").value?nextCardPaymentDate($("txCard").value,$("txForm").elements.date.value):$("txForm").elements.date.value};
    $("txDescription").addEventListener("input",e=>{if(!tx){const first=$("splitList").querySelector(".split-category");if(first&&first.value==="Outros")first.value=applyRule(e.target.value)}});
  }
  $("cancelTx").onclick=closeModal;
  $("txForm").onsubmit=e=>{e.preventDefault();type==="expense"?saveExpenseFromForm(tx?.id||null):saveIncomeFromForm(tx?.id||null)};
}
function bindSplitRow(row){row.querySelector(".remove-split").onclick=()=>{if(document.querySelectorAll("#splitList .split").length<=1){alert("O gasto precisa ter pelo menos uma categoria/parte.");return}row.remove();updateSplitTotal()};row.querySelector(".split-amount").addEventListener("input",updateSplitTotal);row.querySelector(".split-owner").addEventListener("change",updateSplitStatus)}
function updateSplitStatus(e){const row=e.target.closest(".split"),owner=e.target.value,person=row.querySelector(".person");person.innerHTML=owner==="self"?`<label>Status</label><div class="field-note">Não gera reembolso</div>`:`<label>Status</label><select class="split-status"><option value="pending">A receber</option><option value="received">Já recebi</option></select>`}
function updateSplitTotal(){if(!$("splitList"))return;const total=[...document.querySelectorAll(".split-amount")].reduce((s,i)=>s+Number(i.value||0),0),target=Number($("txValue")?.value||0);$("splitSum").textContent=fmtMoney(total);const diff=target-total;$("splitHint").textContent=Math.abs(diff)<0.005?"Divisão correta.":`Diferença: ${fmtMoney(Math.abs(diff))} ${diff>0?"a distribuir":"a mais"}.`;$("splitHint").style.color=Math.abs(diff)<0.005?"#15803d":"#b91c1c"}

function collectSplits(){return [...document.querySelectorAll("#splitList .split")].map(row=>({id:uid(),category:row.querySelector(".split-category").value,amount:Number(row.querySelector(".split-amount").value||0),ownerId:row.querySelector(".split-owner").value,reimbursed:row.querySelector(".split-owner").value==="self"?false:row.querySelector(".split-status")?.value==="received"}));}
function saveExpenseFromForm(existingId){
  const f=new FormData($("txForm")),value=Number(f.get("value")||0),splits=collectSplits(),sum=splits.reduce((s,x)=>s+x.amount,0);if(!value){alert("Informe um valor.");return}if(Math.abs(sum-value)>0.005){alert("A soma das partes/categorias precisa ser exatamente igual ao valor total.");return}
  const base={date:f.get("date"),description:f.get("description"),value,cardId:f.get("cardId")||"",paymentDate:f.get("paymentDate")||f.get("date"),paymentStatus:f.get("paymentStatus")||"paid",notes:f.get("notes")||"",type:"expense",splits,installments:Number(f.get("installments")||1)};
  if(existingId){const old=data.transactions.find(t=>t.id===existingId);data.transactions=data.transactions.map(t=>t.id===existingId?{...old,...base}:t);toast("Gasto atualizado")}else{const n=base.installments,first=f.get("firstMonth")||base.date.slice(0,7);for(let i=0;i<n;i++){const d=shiftMonthDate(first,base.date.slice(8,10),i);const pd=i===0?base.paymentDate:shiftMonthDate(base.paymentDate.slice(0,7),base.paymentDate.slice(8,10),i);data.transactions.push({...base,id:uid(),date:d,paymentDate:pd,installmentNo:i+1})}toast(n>1?`${n} parcelas criadas`:"Gasto salvo")}
  closeModal();save();
}
function saveIncomeFromForm(existingId){const f=new FormData($("txForm")),value=Number(f.get("value")||0);if(!value){alert("Informe um valor.");return}const base={date:f.get("date"),description:f.get("description"),value,type:"income",source:f.get("incomeSource")||"normal",notes:f.get("notes")||""};if(existingId){const old=data.transactions.find(t=>t.id===existingId);data.transactions=data.transactions.map(t=>t.id===existingId?{...old,...base}:t);toast("Entrada atualizada")}else{data.transactions.push({...base,id:uid()});toast("Entrada registrada")}closeModal();save();}
function shiftMonthDate(firstMonth, day, offset){
  const [y,m]=firstMonth.split("-").map(Number);const d=new Date(y,m-1+offset,Number(day));return localISO(d);
}
function editTransaction(id){
  const t=data.transactions.find(x=>x.id===id);if(!t)return;
  if(t.type==="expense")openTransactionModal("expense",t);
  else if(t.type==="income")openTransactionModal("income",t);
  else alert("Pagamento de cartão importado é um ajuste da fatura e, nesta versão, deve ser excluído/reimportado se necessário.");
}
function removeTransaction(id){if(!confirm("Excluir este lançamento?"))return;data.transactions=data.transactions.filter(t=>t.id!==id);save();toast("Lançamento excluído")}
function markReimbursement(txId,splitIndex){
  const t=data.transactions.find(x=>x.id===txId);if(!t)return;
  const s=t.splits?.[splitIndex];if(!s||s.ownerId==="self")return;
  if(s.reimbursed)return;
  s.reimbursed=true;
  const p=data.people.find(x=>x.id===s.ownerId);
  data.transactions.push({id:uid(),date:today(),description:`Reembolso: ${t.description}`,value:Number(s.amount),type:"income",source:"reimbursement",notes:`Recebido de ${p?.name||"outra pessoa"}`,linkedTransactionId:txId,linkedSplitId:s.id});
  save();toast("Reembolso registrado");
}

function renderCategories(){
  $("categoriesList").innerHTML=data.categories.map((c,i)=>`<div class="category-row"><div class="category-name"><span class="tag">#${i+1}</span><b>${esc(c)}</b></div><div class="row-actions"><button class="btn" onclick="editCategory(${i})">Editar</button><button class="btn ghost" onclick="deleteCategory(${i})">Excluir</button></div></div>`).join("");
}
function openCategoryModal(index=null){const old=index!==null?data.categories[index]:"";openModal(index!==null?"Editar categoria":"Nova categoria",`<form id="categoryForm"><label>Nome da categoria</label><input name="name" value="${esc(old)}" placeholder="Ex.: Assinaturas" required><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);$("categoryForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get("name").trim();if(!name)return;if(data.categories.some((c,i)=>c.toLowerCase()===name.toLowerCase()&&i!==index)){alert("Essa categoria já existe.");return}if(index===null)data.categories.push(name);else{const oldName=data.categories[index];data.categories[index]=name;data.rules.forEach(r=>{if(r.category===oldName)r.category=name});data.transactions.forEach(t=>(t.splits||[]).forEach(s=>{if(s.category===oldName)s.category=name}))}closeModal();save();toast("Categoria salva")}}
function editCategory(i){openCategoryModal(i)}
function deleteCategory(i){const name=data.categories[i];if(data.transactions.some(t=>(t.splits||[]).some(s=>s.category===name))){alert("Essa categoria está sendo usada em lançamentos. Edite os lançamentos ou mova-os para outra categoria antes de excluir.");return}if(confirm(`Excluir a categoria "${name}"?`)){data.categories.splice(i,1);save();toast("Categoria excluída")}}

function renderImportCardOptions(){const sel=$("importCard");if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Detectar pelo arquivo OFX / sem cartão</option>'+data.cards.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");if(current)sel.value=current}

function openCardModal(id=null){
  const c=id?data.cards.find(x=>x.id===id):{name:"",limit:0,closing:10,due:19};
  openModal(id?"Editar cartão":"Novo cartão",`<form id="cardForm" class="form-grid">
    <div class="full"><label>Nome</label><input name="name" value="${esc(c.name)}" required></div>
    <div><label>Limite</label><input name="limit" type="number" min="0" step=".01" value="${c.limit||0}"></div>
    <div><label>Fechamento</label><input name="closing" type="number" min="1" max="31" value="${c.closing||10}"></div>
    <div><label>Vencimento</label><input name="due" type="number" min="1" max="31" value="${c.due||19}"></div>
    <div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`);
  $("cardForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),obj={id:id||uid(),name:f.get("name"),limit:Number(f.get("limit")||0),closing:Number(f.get("closing")),due:Number(f.get("due"))};if(id)data.cards=data.cards.map(x=>x.id===id?obj:x);else data.cards.push(obj);closeModal();save();toast("Cartão salvo")};
}
function deleteCard(id){if(data.transactions.some(t=>t.cardId===id)){alert("Este cartão possui lançamentos. Exclua ou mova os lançamentos antes de remover o cartão.");return}if(confirm("Excluir cartão?")){data.cards=data.cards.filter(c=>c.id!==id);save()}}
function openPersonModal(){
  openModal("Nova pessoa",`<form id="personForm"><label>Nome</label><input name="name" placeholder="Ex.: João" required><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("personForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.people.push({id:uid(),name:f.get("name")});closeModal();save();toast("Pessoa adicionada")};
}
function deletePerson(id){if(data.transactions.some(t=>(t.splits||[]).some(s=>s.ownerId===id))){alert("Esta pessoa está vinculada a lançamentos.");return}if(confirm("Excluir pessoa?")){data.people=data.people.filter(p=>p.id!==id);save()}}
function openRuleModal(){
  openModal("Nova regra automática",`<form id="ruleForm" class="form-grid"><div><label>Palavra ou trecho</label><input name="keyword" placeholder="ex.: uber" required></div><div><label>Categoria</label><select name="category">${data.categories.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div><div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("ruleForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.rules.push({id:uid(),keyword:f.get("keyword"),category:f.get("category")});closeModal();save();toast("Regra criada")};
}
function deleteRule(id){if(confirm("Excluir regra?")){data.rules=data.rules.filter(r=>r.id!==id);save()}}

function readFileAsText(file){
  return file.arrayBuffer().then(buf=>{
    let utf8=new TextDecoder("utf-8",{fatal:false}).decode(buf);
    const needs1252=utf8.includes("�");
    if(needs1252) return new TextDecoder("windows-1252").decode(buf);
    return utf8.replace(/^\uFEFF/,"");
  });
}
function detectFormat(file,text){
  const ext=file.name.toLowerCase().split(".").pop();
  if(ext==="ofx"||ext==="qfx"||text.includes("<OFX>")) return "ofx";
  return "csv";
}
function parseCSV(text){
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
    }else if((ch===","||ch===";"||ch==="\t")&&!quoted){
      row.push(cell);cell="";
    }else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&text[i+1]==="\n")i++;
      row.push(cell); if(row.some(x=>x.trim()!==""))rows.push(row); row=[];cell="";
    }else cell+=ch;
  }
  row.push(cell);if(row.some(x=>x.trim()!==""))rows.push(row);
  if(rows.length<2) return [];
  const headers=rows[0].map(h=>normalizeHeader(h));
  const getIndex=(aliases)=>headers.findIndex(h=>aliases.includes(h));
  const iDate=getIndex(["date","data","data da compra","data da transacao","data transacao"]);
  const iDesc=getIndex(["title","descricao","descrição","description","estabelecimento","historico","histórico","nome"]);
  const iAmount=getIndex(["amount","valor","value"]);
  if(iDate<0||iDesc<0||iAmount<0) throw new Error("Não consegui identificar as colunas de data, descrição e valor.");
  return rows.slice(1).map(r=>{
    const rawAmount=(r[iAmount]||"").trim();
    return {
      date:normalizeDate(r[iDate]),
      description:(r[iDesc]||"").trim(),
      amount:parseBRL(rawAmount),
      rawAmount,
      sourceKey:`csv|${r[iDate]}|${r[iDesc]}|${rawAmount}`,
      cardName:""
    };
  }).filter(x=>x.date&&x.description&&Number.isFinite(x.amount));
}
function normalizeHeader(h){return String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^["']|["']$/g,"")}
function parseBRL(v){
  let s=String(v).trim().replace(/\s/g,"");
  if(!s)return NaN;
  const neg=/^-/.test(s); s=s.replace(/^[-+]/,"");
  s=s.replace(/R\$/gi,"");
  if(s.includes(",") && s.includes(".")) s=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(",")) s=s.replace(",",".");
  const n=Number(s);
  return neg?-Math.abs(n):Math.abs(n);
}
function normalizeDate(v){
  const s=String(v||"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  const m2=s.match(/^(\d{2})-(\d{2})-(\d{4})$/);if(m2)return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return "";
}
function parseInstallment(desc){
  const s=desc;
  let m=s.match(/(?:parcela\s*)?(\d{1,2})\s*[\/de]\s*(\d{1,2})/i);
  if(!m)m=s.match(/(\d{1,2})\s*[\/]\s*(\d{1,2})/);
  return m?{no:Number(m[1]),total:Number(m[2])}:{no:1,total:1};
}
function parseOFX(text){
  const blocks=[...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map(m=>m[1]);
  if(!blocks.length) throw new Error("Não encontrei transações <STMTTRN> no OFX.");
  const cardName=text.match(/<ORG>([^<]+)/i)?.[1]||"Cartão importado";
  return blocks.map(b=>{
    const tag=name=>b.match(new RegExp(`<${name}>([^<\r\n]+)`,`i`))?.[1]?.trim()||"";
    const rawDate=tag("DTPOSTED").slice(0,8);
    const date=rawDate.length===8?`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`:"";
    const amount=Number(tag("TRNAMT").replace(",","."));
    const desc=tag("MEMO")||tag("NAME")||"Transação";
    const fitid=tag("FITID");
    return {date,description:desc,amount,sourceKey:`ofx|${fitid||date+"|"+desc+"|"+amount}`,fitid,cardName};
  }).filter(x=>x.date&&Number.isFinite(x.amount));
}

async function parseImport(file){
  const text=await readFileAsText(file);
  const format=detectFormat(file,text);
  const rows=format==="ofx"?parseOFX(text):parseCSV(text);
  const selectedImportCard=$("importCard")?.value||"";
  const mapped=rows.map(r=>{
    const installment=parseInstallment(r.description);
    const isCardPayment=(r.amount>0 && /pagamento recebido|payment/i.test(r.description)) || (r.amount<0 && /pagamento recebido|payment/i.test(r.description));
    const isExpense=r.amount>0 && !isCardPayment;
    const value=Math.abs(r.amount);
    const cardId=r.cardName?ensureImportedCard([r])?.id:selectedImportCard;
    return {...r,value,isExpense,isCardPayment,installmentNo:installment.no,installments:installment.total,format,cardId,paymentDate:(isExpense&&cardId)?nextCardPaymentDate(cardId,r.date):r.date,paymentStatus:(isExpense&&cardId)?"planned":"paid"};
  });
  return {format,rows:mapped};
}

function isDuplicate(r){
  return data.transactions.some(t=>t.importKey===r.sourceKey || (t.date===r.date && Math.abs(t.value-r.value)<0.005 && t.description.toLowerCase()===r.description.toLowerCase()));
}
async function handleFile(file){
  if(!file)return;
  selectedImport=file;$("selectedFile").textContent=`Selecionado: ${file.name}`;
  $("importStatus").classList.add("hidden");
  try{
    const result=await parseImport(file);
    const card=ensureImportedCard(result.rows);
    pendingImport=result.rows.filter(r=>!isDuplicate(r)).map(r=>({...r,cardId:card?.id||r.cardId||"",category:applyRule(r.description)}));
    const duplicates=result.rows.length-pendingImport.length;
    showImportPreview(result.format,pendingImport,duplicates);
  }catch(e){
    $("importStatus").textContent=`Erro ao ler arquivo: ${e.message}`;
    $("importStatus").classList.remove("hidden");
    $("importPreview").classList.add("hidden");
  }
}
function ensureImportedCard(rows){
  const name=rows.find(r=>r.cardName)?.cardName;
  if(!name)return null;
  let c=data.cards.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!c){c={id:uid(),name:name,limit:0,closing:10,due:19};data.cards.push(c)}
  return c;
}
function showImportPreview(format,rows,duplicates){
  $("importPreview").classList.remove("hidden");
  $("previewCount").textContent=`${rows.length} novos · ${duplicates} repetidos ignorados`;
  $("previewTable").innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.description)}</td><td class="${r.isExpense?"negative":"positive"}">${r.isExpense?"-":"+"} ${fmtMoney(r.value)}</td><td>${r.isCardPayment?"Pagamento do cartão":r.isExpense?"Gasto":"Crédito/ajuste"}</td><td>${r.isExpense?fmtDate(r.paymentDate):"—"}</td><td>${r.installments>1?`${r.installmentNo}/${r.installments}`:"—"}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">Nenhum lançamento novo.</td></tr>';
  $("importStatus").textContent=`Formato detectado: ${format.toUpperCase()}. O importador também normaliza acentuação, datas e valores.`;
  $("importStatus").classList.remove("hidden");
}
$("confirmImport").onclick=()=>{
  if(!pendingImport.length){toast("Nada novo para importar.");return}
  pendingImport.forEach(r=>{
    if(r.isCardPayment){
      data.transactions.push({id:uid(),date:r.date,description:r.description,value:r.value,type:"card_payment",cardId:r.cardId,importKey:r.sourceKey});
    }else if(r.isExpense){
      data.transactions.push({
        id:uid(),date:r.date,description:r.description,value:r.value,type:"expense",cardId:r.cardId,
        paymentDate:r.paymentDate||r.date,paymentStatus:r.paymentStatus||"paid",
        splits:[{id:uid(),category:r.category||"Outros",amount:r.value,ownerId:"self",reimbursed:false}],
        installments:r.installments||1,installmentNo:r.installmentNo||1,importKey:r.sourceKey
      });
    }else{
      data.transactions.push({id:uid(),date:r.date,description:r.description,value:r.value,type:"income",source:"imported-credit",notes:"Crédito importado",importKey:r.sourceKey});
    }
  });
  data.importLog.push({id:uid(),file:selectedImport?.name||"",date:new Date().toISOString(),count:pendingImport.length});
  pendingImport=[];selectedImport=null;$("importPreview").classList.add("hidden");$("selectedFile").textContent="Nenhum arquivo selecionado";save();toast("Importação concluída");
};
$("cancelImport").onclick=()=>{pendingImport=[];$("importPreview").classList.add("hidden")};

$("pickFile").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>handleFile(e.target.files[0]);
["dragenter","dragover"].forEach(ev=>$("dropZone").addEventListener(ev,e=>{e.preventDefault();$("dropZone").classList.add("drag")}));
["dragleave","drop"].forEach(ev=>$("dropZone").addEventListener(ev,e=>{e.preventDefault();$("dropZone").classList.remove("drag")}));
$("dropZone").addEventListener("drop",e=>handleFile(e.dataTransfer.files[0]));

function exportBackup(){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-controle-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Backup exportado");
}
function restoreBackup(){
  const f=$("backupInput").files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{try{
    const x=JSON.parse(reader.result);if(!x.transactions||!x.cards||!x.people)throw new Error("estrutura inválida");
    data=x;save();toast("Backup restaurado");
  }catch{alert("Backup inválido.")}};
  reader.readAsText(f);
  $("backupInput").value="";
}

// Start
renderAll();
