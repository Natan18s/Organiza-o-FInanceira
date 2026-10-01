// ====================================================================
// transactions.js — aba Lançamentos e formulário de gasto/entrada
// Tabela, seleção em massa (alterar data/excluir), formulário com divisão por pessoa e parcelas, reembolsos.
// ====================================================================

// Etiquetas de categoria (com valor) de um gasto.
function categoryLabels(t){
  const splits=t.splits||[];
  if(!splits.length) return "—";
  return splits.map(s=>`<span class="tag">${esc(s.category)} · ${fmtMoney(s.amount)}</span>`).join(" ");
}

// Quanto cada pessoa paga em um gasto (Você, João...).
function peopleLabels(t){
  if(t.type!=="expense") return "—";
  const people={};
  (t.splits||[]).forEach(s=>{const p=s.ownerId==="self"?"Você":data.people.find(x=>x.id===s.ownerId)?.name||"Outra pessoa";people[p]=(people[p]||0)+Number(s.amount||0)});
  return Object.entries(people).map(([p,v])=>`${esc(p)}: ${fmtMoney(v)}`).join("<br>");
}

// Texto da forma de pagamento (Pix, Débito, Crédito · Nubank...).
function paymentLabel(t){
  if(t.type==="card_payment") return "Crédito";
  const card=t.cardId?esc(data.cards.find(c=>c.id===t.cardId)?.name||"Cartão"):"";
  if(t.method&&METHODS[t.method]) return isCreditMethod(t.method)?`${METHODS[t.method]}${card?" · "+card:""}`:METHODS[t.method];
  return card||"Pix / débito / dinheiro";
}

// Data de pagamento previsto/realizado com a cor do status.
function paymentDateLabel(t){
  if(t.type!=="expense") return "—";
  const d=t.paymentDate||t.date;
  const status=t.paymentStatus||"planned";
  return `<span class="${status==="paid"?"pay-paid":"pay-planned"}"><b>${fmtDate(d)}</b><br><small>${status==="paid"?"Pago":"Previsto"}</small></span>`;
}

// Marca ou desmarca um lançamento na seleção.
function toggleSelect(id,checked){if(checked)selectedTxIds.add(id);else selectedTxIds.delete(id);updateBulkBar();}

// Marca ou desmarca todos os lançamentos visíveis (gastos e entradas).
function toggleSelectAll(e){
  const checks=[...document.querySelectorAll(".tx-check")];
  checks.forEach(c=>{c.checked=e.target.checked;if(c.checked)selectedTxIds.add(c.value);else selectedTxIds.delete(c.value)});
  updateBulkBar();
}

// Mostra ou esconde a barra de ações em massa conforme há lançamentos selecionados.
function updateBulkBar(){
  $("selectedCount").textContent=selectedTxIds.size;
  $("bulkBar").classList.toggle("hidden",selectedTxIds.size===0);
}

// Desenha a tabela da aba Lançamentos, aplicando mês, busca e tipo. Um gasto também aparece no mês do pagamento previsto.
function renderTransactions(){
  const m=$("txMonth").value||month,q=($("txSearch").value||"").toLowerCase(),type=$("txType").value;
  // mostra o gasto no mês da compra e também no mês do pagamento previsto (ex.: compra no crédito paga no mês seguinte)
  const inMonth=t=>t.date.slice(0,7)===m || (t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m);
  let arr=data.transactions.filter(t=>inMonth(t) && (!type||t.type===type));
  if(q) arr=arr.filter(t=>(t.description+" "+(t.splits||[]).map(s=>s.category).join(" ")+" "+(t.notes||"")).toLowerCase().includes(q));
  arr.sort(byNewest);
  const visibleIds=new Set(arr.map(t=>t.id));
  [...selectedTxIds].forEach(id=>{if(!visibleIds.has(id))selectedTxIds.delete(id)});
  $("selectAllTx").checked=arr.length>0 && arr.every(t=>selectedTxIds.has(t.id));
  $("txTable").innerHTML=arr.length ? arr.map(t=>{
    const par=t.installments>1?`${t.installmentNo||1}/${t.installments}`:"—";
    const val=t.type==="expense"?`- ${fmtMoney(t.value)}`:`+ ${fmtMoney(t.value)}`;
    const cls=t.type==="expense"?"negative":"positive";
    return `<tr id="tx-${t.id}">
      <td class="select-col"><input class="tx-check" type="checkbox" aria-label="Selecionar lançamento" value="${t.id}" ${selectedTxIds.has(t.id)?"checked":""} onchange="toggleSelect('${t.id}',this.checked)"></td>
      <td>${fmtDate(t.date)}</td><td><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}${t.type==="expense"&&t.date.slice(0,7)!==m?`<div><span class="tag">Compra de ${fmtMonthLabel(t.date)} · pagamento neste mês</span></div>`:""}</td>
      <td>${t.type==="expense"?categoryLabels(t):t.source==="reimbursement"?'<span class="pill">Reembolso</span>':"—"}</td>
      <td>${paymentLabel(t)}</td><td>${peopleLabels(t)}</td><td>${paymentDateLabel(t)}</td><td>${par}</td>
      <td class="right ${cls}">${val}</td>
      <td><div class="row-actions">${t.type!=="card_payment"?`<button class="btn" onclick="editTransaction('${t.id}')">Editar</button>`:""}<button class="btn ghost" onclick="removeTransaction('${t.id}')">Excluir</button></div></td>
    </tr>`;
  }).join("") : '<tr><td colspan="10" class="empty">Nenhum lançamento encontrado.</td></tr>';
  updateBulkBar();
}

// Painel para definir a data/status de pagamento de todos os gastos selecionados.
function openBulkPaymentModal(){
  const ids=[...selectedTxIds], expenses=ids.map(id=>data.transactions.find(t=>t.id===id)).filter(t=>t?.type==="expense");
  if(!expenses.length){alert("Selecione pelo menos um gasto. A data de pagamento previsto só vale para gastos.");return}
  const suggested=expenses.length===1?(expenses[0].paymentDate||nextCardPaymentDate(expenses[0].cardId,expenses[0].date)):(month+"-19");
  openModal("Definir pagamento previsto",`<form id="bulkPayForm"><p>Você selecionou <b>${expenses.length}</b> gasto(s). A data abaixo será aplicada a todos.${ids.length>expenses.length?" As entradas selecionadas serão ignoradas.":""}</p><div><label>Data de pagamento</label><input name="paymentDate" type="date" value="${suggested}" required></div><div style="margin-top:10px"><label>Status</label><select name="status"><option value="planned">Pagamento previsto</option><option value="paid">Já pago</option></select></div><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Aplicar aos selecionados</button></div></form>`);
  $("bulkPayForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);expenses.forEach(t=>{t.paymentDate=f.get("paymentDate");t.paymentStatus=f.get("status")});logActivity("bulk",`Pagamento previsto definido em ${expenses.length} gasto(s)`,`Data ${fmtDate(f.get("paymentDate"))} · ${f.get("status")==="paid"?"já pago":"previsto"} · ${expenses.slice(0,3).map(t=>t.description).join(", ")}${expenses.length>3?"…":""}`);selectedTxIds.clear();closeModal();save();toast(`Pagamento previsto aplicado a ${expenses.length} gasto(s)`) };
}

// Remove a previsão de pagamento dos gastos selecionados (volta para a data da compra, como pago).
function clearBulkPaymentDate(){
  const expenses=[...selectedTxIds].map(id=>data.transactions.find(t=>t.id===id)).filter(t=>t?.type==="expense");
  if(!expenses.length){toast("Selecione pelo menos um gasto.");return}
  expenses.forEach(t=>{t.paymentDate=t.date;t.paymentStatus="paid"});logActivity("bulk",`Previsão de pagamento removida de ${expenses.length} gasto(s)`,expenses.slice(0,3).map(t=>t.description).join(", ")+(expenses.length>3?"…":""));selectedTxIds.clear();save();toast("Previsão de pagamento removida");
}

// Exclui de uma vez todos os lançamentos selecionados, com confirmação e opção de desfazer.
function bulkDelete(){
  const items=[...selectedTxIds].map(id=>data.transactions.find(t=>t.id===id)).filter(Boolean);
  if(!items.length)return;
  if(!confirm(`Excluir ${items.length} lançamento(s) selecionado(s)? Logo depois você poderá desfazer.`))return;
  const ids=new Set(items.map(t=>t.id));
  data.transactions=data.transactions.filter(t=>!ids.has(t.id));
  logActivity("delete",`${items.length} lançamento(s) excluído(s) de uma vez`,items.slice(0,3).map(t=>t.description).join(", ")+(items.length>3?"…":""));
  lastDeleted=items;
  selectedTxIds.clear();
  save();
  showToast(`${items.length} lançamento(s) excluído(s)`,"Desfazer",undoDelete);
}

// "Para onde foi" um gasto: categorias, forma/cartão, pagamento previsto e pessoas envolvidas
function expenseDestination(t){
  const cats=[...new Set((t.splits||[]).map(s=>s.category))].join(", ");
  const others=[...new Set((t.splits||[]).filter(s=>s.ownerId!=="self").map(s=>data.people.find(p=>p.id===s.ownerId)?.name||"outra pessoa"))];
  const way=t.cardId?(data.cards.find(c=>c.id===t.cardId)?.name||"Cartão"):(METHODS[t.method]||"Pix / débito / dinheiro");
  const parts=[`Categoria: ${cats||"—"}`,`Forma: ${way}`,`Pagamento ${t.paymentStatus==="paid"?"feito":"previsto"} em ${fmtDate(t.paymentDate||t.date)}`];
  if(others.length) parts.push(`Com: ${others.join(", ")}`);
  return parts.join(" · ");
}

// Data sugerida num lançamento novo: hoje, ou o dia 1 do mês visto se não for o mês atual.
function defaultEntryDate(){ return today().slice(0,7)===month ? today() : `${month}-01`; }   // abre o calendário no mês que está sendo visto

// Divisão padrão de um gasto novo: tudo para "Você", com a categoria sugerida pelas regras.
function makeDefaultSplit(amount, description, existing){
  return existing || [{id:uid(),category:applyRule(description),amount:Number(amount)||0,ownerId:"self",reimbursed:false}];
}

// Monta o HTML do formulário de gasto ou entrada (novo ou edição).
function transactionForm(t=null,type="expense"){
  const isExpense=type==="expense";
  const splits=(t?.splits?.length?t.splits:makeDefaultSplit(t?.value||0,t?.description||"")).map(s=>({...s}));
  const method=t?.method||"pix";
  const status=t?.paymentStatus||(isCreditMethod(method)?"planned":"paid");
  const lock=t?'data-lock="1" disabled':"";
  return `<form id="txForm"><div class="form-grid">
    <div><label>Data da compra / lançamento</label><input name="date" id="txDate" type="date" value="${t?.date||defaultEntryDate()}" required></div>
    <div><label id="txValueLabel">Valor total</label><input name="value" id="txValue" type="number" min="0" step="0.01" value="${t?.value??""}" required><div class="field-note" id="valueNote"></div></div>
    <div class="full"><label>Descrição</label><input name="description" id="txDescription" value="${esc(t?.description||"")}" placeholder="Ex.: Mercado, Uber, conta de luz..." required></div>
    ${isExpense?`
      <div><label>Forma de pagamento</label><select name="method" id="txMethod">${Object.entries(METHODS).map(([k,v])=>`<option value="${k}" ${k===method?"selected":""}>${v}</option>`).join("")}</select></div>
      <div id="grpCard"><label>Cartão</label><select name="cardId" id="txCard"><option value="">Selecione o cartão</option>${data.cards.map(c=>`<option value="${c.id}" ${t?.cardId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div id="grpPay"><label>Pagamento previsto</label><input name="paymentDate" id="txPaymentDate" type="date" value="${t?.paymentDate||""}"><div class="row-actions" style="margin-top:5px"><button type="button" class="btn ghost" id="useCardDue">Usar vencimento pelo fechamento</button></div></div>
      <div id="grpStatus"><label>Status do pagamento</label><select name="paymentStatus" id="txStatus"><option value="planned" ${status!=="paid"?"selected":""}>Previsto / ainda não pago</option><option value="paid" ${status==="paid"?"selected":""}>Já pago</option></select><div class="field-note">Pix, débito e dinheiro começam como "Já pago"; mude para "Previsto" se for uma despesa futura.</div></div>
      <div id="grpInst" class="full form-grid">
        <div><label>Total de parcelas</label><input name="installments" id="txInstallments" type="number" step="1" value="${t?.installments>1?t.installments:""}" placeholder="Ex.: 10" ${lock}></div>
        <div><label>Parcela inicial (restantes)</label><input name="startInstallment" id="txStart" type="number" step="1" value="${t?.installmentNo||1}" ${lock}><div class="field-note">1 = compra nova. Se já pagou 3 parcelas, use 4: só as restantes serão lançadas.</div></div>
        <div><label>Mês da 1ª parcela lançada</label><input name="firstMonth" id="txFirstMonth" type="month" value="${t?.date?.slice(0,7)||month}" ${lock}></div>
        <div class="full"><div class="install-preview" id="installPreview"></div></div>
      </div>
      <div class="full"><label>Observação</label><input name="notes" value="${esc(t?.notes||"")}" placeholder="Ex.: fatura de outubro"></div>
    `:`
      <div><label>Origem</label><select name="incomeSource"><option value="normal" ${t?.source!=="reimbursement"?"selected":""}>Entrada normal</option><option value="reimbursement" ${t?.source==="reimbursement"?"selected":""}>Reembolso recebido</option></select></div>
      <div><label>Observação</label><input name="notes" value="${esc(t?.notes||"")}" placeholder="Ex.: salário, extra..."></div>
    `}</div>
    ${isExpense?`<div class="split-header"><div><b>Divisão do gasto por pessoa</b><div class="field-note">Por padrão o valor total fica com Você. Ao adicionar pessoas, o valor é dividido igualmente entre elas (dá para ajustar depois).</div></div><div class="split-actions"><button type="button" class="btn equal-btn" id="splitEqual">Dividir igualmente</button><button type="button" class="btn" id="addSplit">Adicionar pessoas</button></div></div><div id="splitList">${splits.map((s,i)=>splitRow(s,i,data.categories,data.people)).join("")}</div><div class="split-total"><span>Total dividido</span><span id="splitSum">${fmtMoney(splits.reduce((a,x)=>a+Number(x.amount||0),0))}</span></div><div class="field-note" id="splitHint"></div>`:""}
    <div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" id="cancelTx">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`;
}

// HTML de uma linha da divisão do gasto (categoria, valor, quem paga e status).
function splitRow(s,i,categories,people){
  return `<div class="split" data-index="${i}"><div class="category"><label>Categoria</label><select class="split-category">${categories.map(c=>`<option ${c===s.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div><div><label>Valor</label><input class="split-amount" type="number" min="0" step="0.01" value="${Number(s.amount||0)}"></div><div class="owner"><label>Quem paga?</label><select class="split-owner">${people.map(p=>`<option value="${p.id}" ${s.ownerId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div><div class="person"><label>Status</label>${s.ownerId==="self"?`<div class="field-note">Não gera reembolso</div>`:`<select class="split-status"><option value="pending" ${s.reimbursed!==true?"selected":""}>A receber</option><option value="received" ${s.reimbursed===true?"selected":""}>Já recebi</option></select>`}</div><button type="button" class="btn ghost remove-split" title="Remover">✕</button></div>`;
}

// Divide o valor total igualmente entre as linhas da divisão (a última leva o centavo que sobrar).
function distributeEqual(){
  const rows=[...document.querySelectorAll("#splitList .split")]; if(!rows.length)return;
  const cents=Math.round(Number($("txValue").value||0)*100), each=Math.floor(cents/rows.length);
  rows.forEach((r,i)=>{const c=i===rows.length-1?cents-each*(rows.length-1):each;r.querySelector(".split-amount").value=(c/100).toFixed(2)});
  updateSplitTotal();
}

// Prévia das parcelas no formulário: quantas serão lançadas, o mês, a data de pagamento e o valor de cada uma.
function renderInstallPreview(){
  const box=$("installPreview"); if(!box)return;
  if($("txMethod").value!=="installment"||$("txInstallments").disabled){box.textContent="";return}
  const n=Number($("txInstallments").value||0),start=Number($("txStart").value||1),total=Number($("txValue").value||0),fm=$("txFirstMonth").value,day=$("txDate").value.slice(8,10)||"01",pay=$("txPaymentDate").value;
  if(!(n>=2&&n<=48)||!(start>=1&&start<=n)||!fm||!total){box.textContent="Informe o valor e o total de parcelas para ver como ficarão os lançamentos.";return}
  const base=Math.floor(Math.round(total*100)/n), rows=[]; let sum=0;
  for(let k=start;k<=n;k++){
    const cents=k===n?Math.round(total*100)-base*(n-1):base; sum+=cents;
    const d=shiftMonthDate(fm,day,k-start), pd=pay?shiftMonthDate(pay.slice(0,7),pay.slice(8,10),k-start):"";
    rows.push(`<div class="inst-row"><span class="inst-no">${k}/${n}</span><span class="inst-when"><b>${MONTHS_PT[Number(d.slice(5,7))-1]}/${d.slice(0,4)}</b>${pd?`<small>paga em ${fmtDate(pd)}</small>`:""}</span><span class="inst-val">${fmtMoney(cents/100)}</span></div>`);
  }
  const count=n-start+1, first=shiftMonthDate(fm,day,0);
  box.innerHTML=`<div class="inst-box"><div class="inst-head"><div><b>${count} parcela${count>1?"s":""} ser${count>1?"ão":"á"} lançada${count>1?"s":""}</b><small>Uma por mês, começando em ${MONTHS_PT[Number(first.slice(5,7))-1]}/${first.slice(0,4)}</small></div><div class="inst-total"><small>Total lançado</small><b>${fmtMoney(sum/100)}</b></div></div><div class="inst-cols"><span>Parcela</span><span>Mês do lançamento</span><span>Valor</span></div><div class="inst-list">${rows.join("")}</div></div>`;
}

// Abre o formulário de gasto/entrada e liga todos os comportamentos automáticos (vencimento, status, divisão, parcelas).
function openTransactionModal(type="expense",tx=null){
  openModal(tx?(type==="expense"?"Editar gasto":"Editar entrada"):(type==="expense"?"Novo gasto":"Nova entrada"),transactionForm(tx,type));
  if(type==="expense"){
    const list=$("splitList");
    autoSplit=!tx; payTouched=!!tx; firstMonthTouched=!!tx; statusTouched=!!tx;
    const show=(id,on)=>{const g=$(id);g.classList.toggle("hidden",!on);g.querySelectorAll("input,select").forEach(i=>{i.disabled=!on||i.dataset.lock==="1"})};
    const autoPaymentDate=()=>{$("txPaymentDate").value=nextMonthPaymentDate($("txCard").value,$("txDate").value)};
    // Regra 2: pagamento em mês diferente da compra => status "Previsto" e parcelamento acompanha o mês do pagamento
    const syncPaymentRules=()=>{
      const d=$("txDate").value,p=$("txPaymentDate").value;
      if(isCreditMethod($("txMethod").value)&&d&&p&&d.slice(0,7)!==p.slice(0,7)){
        $("txStatus").value="planned";
        if($("txMethod").value==="installment"&&!firstMonthTouched&&!tx)$("txFirstMonth").value=p.slice(0,7);
      }
    };
    const refreshMethod=()=>{
      const m=$("txMethod").value,credit=isCreditMethod(m),inst=m==="installment";
      show("grpCard",credit);show("grpPay",credit);show("grpInst",inst);   // Pix/Débito/Dinheiro: cartão, vencimento e parcelas somem (não são validados); o status continua editável
      if(!statusTouched)$("txStatus").value=credit?"planned":"paid";   // padrão automático, mas o usuário pode mudar
      $("txValueLabel").textContent=tx&&tx.installments>1?"Valor desta parcela":(inst&&!tx?"Valor total da compra":"Valor total");
      $("valueNote").textContent=inst&&!tx?"Será dividido pelo total de parcelas.":"";
      if(credit){if(!$("txCard").value&&data.cards.length===1)$("txCard").value=data.cards[0].id;if(!tx&&!payTouched)autoPaymentDate();syncPaymentRules()}
      renderInstallPreview();
    };
    const addPerson=()=>{
      const rows=[...list.querySelectorAll(".split")],used=new Set(rows.map(r=>r.querySelector(".split-owner").value));
      const cand=data.people.find(p=>!used.has(p.id))||data.people.find(p=>p.id!=="self")||data.people[0];
      const cat=rows[0]?.querySelector(".split-category").value||"Outros";
      list.insertAdjacentHTML("beforeend",splitRow({id:uid(),category:cat,amount:0,ownerId:cand.id,reimbursed:false},rows.length,data.categories,data.people));
      bindSplitRow(list.lastElementChild);
      autoSplit=true;distributeEqual();   // recalcula o valor entre todas as pessoas
      if(data.people.length<2)toast("Cadastre pessoas na aba Pessoas para dividir o gasto.");
    };
    $("addSplit").onclick=addPerson;
    $("splitEqual").onclick=()=>{autoSplit=true;distributeEqual()};
    [...list.children].forEach(bindSplitRow);
    $("txMethod").addEventListener("change",refreshMethod);
    $("txStatus").addEventListener("change",()=>{statusTouched=true});
    $("txCard").addEventListener("change",()=>{if(!tx&&!payTouched)autoPaymentDate();syncPaymentRules();renderInstallPreview()});
    $("txDate").addEventListener("change",()=>{if(!tx&&!payTouched&&isCreditMethod($("txMethod").value))autoPaymentDate();syncPaymentRules();renderInstallPreview()});
    $("txPaymentDate").addEventListener("input",()=>{payTouched=true;syncPaymentRules();renderInstallPreview()});
    $("txFirstMonth").addEventListener("input",()=>{firstMonthTouched=true;renderInstallPreview()});
    $("txInstallments").addEventListener("input",renderInstallPreview);
    $("txStart").addEventListener("input",renderInstallPreview);
    $("txValue").addEventListener("input",()=>{if(autoSplit)distributeEqual();else updateSplitTotal();renderInstallPreview()});
    $("useCardDue").onclick=()=>{$("txPaymentDate").value=$("txCard").value?nextCardPaymentDate($("txCard").value,$("txDate").value):$("txDate").value;payTouched=true;syncPaymentRules();renderInstallPreview()};
    $("txDescription").addEventListener("input",e=>{if(!tx){const first=$("splitList").querySelector(".split-category");if(first&&first.value==="Outros")first.value=applyRule(e.target.value)}});
    if(autoSplit)distributeEqual();
    refreshMethod();updateSplitTotal();
  }
  $("cancelTx").onclick=closeModal;
  $("txForm").onsubmit=e=>{e.preventDefault();type==="expense"?saveExpenseFromForm(tx?.id||null):saveIncomeFromForm(tx?.id||null)};
}

// Liga os botões e campos de uma linha da divisão (remover, editar valor, trocar pessoa).
function bindSplitRow(row){
  row.querySelector(".remove-split").onclick=()=>{
    if(document.querySelectorAll("#splitList .split").length<=1){alert("O gasto precisa ter pelo menos uma parte.");return}
    row.remove();autoSplit?distributeEqual():updateSplitTotal();
  };
  row.querySelector(".split-amount").addEventListener("input",()=>{autoSplit=false;updateSplitTotal()});
  row.querySelector(".split-owner").addEventListener("change",updateSplitStatus);
}

// Mostra ou esconde o status "A receber / Já recebi" conforme quem paga a parte.
function updateSplitStatus(e){const row=e.target.closest(".split"),owner=e.target.value,person=row.querySelector(".person");person.innerHTML=owner==="self"?`<label>Status</label><div class="field-note">Não gera reembolso</div>`:`<label>Status</label><select class="split-status"><option value="pending">A receber</option><option value="received">Já recebi</option></select>`}

// Atualiza o total dividido e avisa se a soma das partes difere do valor total.
function updateSplitTotal(){if(!$("splitList"))return;const total=[...document.querySelectorAll(".split-amount")].reduce((s,i)=>s+Number(i.value||0),0),target=Number($("txValue")?.value||0);$("splitSum").textContent=fmtMoney(total);const diff=target-total;$("splitHint").textContent=Math.abs(diff)<0.005?"Divisão correta.":`Diferença: ${fmtMoney(Math.abs(diff))} ${diff>0?"a distribuir":"a mais"}.`;$("splitHint").style.color=Math.abs(diff)<0.005?"var(--green)":"var(--red)"}

// Lê as linhas da divisão do formulário e devolve a lista de partes.
function collectSplits(){return [...document.querySelectorAll("#splitList .split")].map(row=>({id:uid(),category:row.querySelector(".split-category").value,amount:Number(row.querySelector(".split-amount").value||0),ownerId:row.querySelector(".split-owner").value,reimbursed:row.querySelector(".split-owner").value==="self"?false:row.querySelector(".split-status")?.value==="received"}));}

// Ajusta as partes proporcionalmente ao valor de cada parcela, fechando os centavos na última.
function scaleSplits(splits,part,total){
  let acc=0;
  return splits.map((s,i)=>{
    const amt=i===splits.length-1?Math.round((part-acc)*100)/100:Math.round(Number(s.amount)*part/total*100)/100;
    acc+=amt;return {...s,id:uid(),amount:amt};
  });
}

// Valida e salva o gasto do formulário (novo, edição, ou todas as parcelas de uma compra parcelada).
function saveExpenseFromForm(existingId){
  const f=new FormData($("txForm")),value=Number(f.get("value")||0),splits=collectSplits(),sum=splits.reduce((s,x)=>s+x.amount,0);
  const method=f.get("method")||"pix",credit=isCreditMethod(method),date=f.get("date");
  if(!value){alert("Informe um valor.");return}
  if(Math.abs(sum-value)>0.005){alert("A soma das partes precisa ser exatamente igual ao valor total.");return}
  if(credit&&!f.get("cardId")){alert("Selecione o cartão.");return}
  let n=1,start=1;
  if(method==="installment"&&!existingId){
    n=Number(f.get("installments")||0);start=Number(f.get("startInstallment")||1);
    if(!(n>=2&&n<=48)){alert("Informe o total de parcelas (de 2 a 48).");return}
    if(!(start>=1&&start<=n)){alert("A parcela inicial deve estar entre 1 e o total de parcelas.");return}
  }
  // Pix/Débito/Dinheiro: campos de cartão/parcelas ficam de fora; pagamento = data da compra, já pago
  const base={date,description:f.get("description"),value,method,cardId:credit?f.get("cardId"):"",paymentDate:credit?(f.get("paymentDate")||date):date,paymentStatus:f.get("paymentStatus")||(credit?"planned":"paid"),notes:f.get("notes")||"",type:"expense",splits};
  if(existingId){
    const old=data.transactions.find(t=>t.id===existingId);
    data.transactions=data.transactions.map(t=>t.id===existingId?{...old,...base}:t);
    logActivity("edit",`Gasto editado: ${base.description}`,`${fmtMoney(base.value)} · ${expenseDestination({...old,...base})}`,existingId);
    toast("Gasto atualizado");
  }else if(method==="installment"){
    const rem=n-start+1,totalCents=Math.round(value*100),per=Math.floor(totalCents/n),first=f.get("firstMonth")||date.slice(0,7),day=date.slice(8,10),pay=base.paymentDate;
    for(let i=0;i<rem;i++){
      const k=start+i,cents=k===n?totalCents-per*(n-1):per;
      data.transactions.push({...base,id:uid(),createdAt:Date.now()+i,value:cents/100,splits:scaleSplits(splits,cents/100,value),date:shiftMonthDate(first,day,i),paymentDate:shiftMonthDate(pay.slice(0,7),pay.slice(8,10),i),paymentStatus:i===0?base.paymentStatus:"planned",installments:n,installmentNo:k});
    }
    const firstTx=data.transactions[data.transactions.length-rem];
    logActivity("create",`Gasto parcelado: ${base.description}`,`${n}x · lançadas ${rem} (${start}/${n} a ${n}/${n}) · total ${fmtMoney(value)} · ${expenseDestination(firstTx)}`,firstTx.id);
    toast(`${rem} parcela(s) lançada(s)`);
  }else{
    const nt={...base,id:uid(),createdAt:Date.now(),installments:1,installmentNo:1};
    data.transactions.push(nt);
    logActivity("create",`Novo gasto: ${base.description}`,`${fmtMoney(value)} · ${expenseDestination(nt)}`,nt.id);
    toast("Gasto salvo");
  }
  closeModal();save();
}

// Valida e salva a entrada do formulário (nova ou edição).
function saveIncomeFromForm(existingId){
  const f=new FormData($("txForm")),value=Number(f.get("value")||0);
  if(!value){alert("Informe um valor.");return}
  const base={date:f.get("date"),description:f.get("description"),value,type:"income",source:f.get("incomeSource")||"normal",notes:f.get("notes")||""};
  const where=`${base.source==="reimbursement"?"Reembolso recebido":"Entrada normal"} · entra em ${fmtDate(base.date)} (${fmtMonthLabel(base.date)})`;
  if(existingId){
    const old=data.transactions.find(t=>t.id===existingId);
    data.transactions=data.transactions.map(t=>t.id===existingId?{...old,...base}:t);
    logActivity("edit",`Entrada editada: ${base.description}`,`${fmtMoney(value)} · ${where}`,existingId);
    toast("Entrada atualizada");
  }else{
    const nt={...base,id:uid(),createdAt:Date.now()};
    data.transactions.push(nt);
    logActivity("create",`Nova entrada: ${base.description}`,`${fmtMoney(value)} · ${where}`,nt.id);
    toast("Entrada registrada");
  }
  closeModal();save();
}

// Abre o formulário para editar um lançamento.
function editTransaction(id){
  const t=data.transactions.find(x=>x.id===id);if(!t)return;
  if(t.type==="expense")openTransactionModal("expense",t);
  else if(t.type==="income")openTransactionModal("income",t);
  else alert("Pagamento de cartão importado é um ajuste da fatura e, nesta versão, deve ser excluído/reimportado se necessário.");
}

// Exclui um lançamento (com confirmação e opção de desfazer).
function removeTransaction(id){
  const t=data.transactions.find(x=>x.id===id); if(!t)return;
  if(!confirm("Excluir este lançamento?"))return;
  data.transactions=data.transactions.filter(x=>x.id!==id);
  logActivity("delete",`Excluído: ${t.description}`,`${t.type==="income"?"Entrada":t.type==="expense"?"Gasto":"Pagamento de cartão"} de ${fmtMoney(t.value)} · data ${fmtDate(t.date)}`);
  lastDeleted=[t];
  save();
  showToast("Lançamento excluído","Desfazer",undoDelete);
}

// Desfaz a última exclusão (de um ou de vários lançamentos).
function undoDelete(){
  if(!lastDeleted||!lastDeleted.length)return;
  const back=lastDeleted;
  back.forEach(t=>data.transactions.push(t));
  logActivity("create",back.length>1?`Exclusão desfeita: ${back.length} lançamentos`:`Exclusão desfeita: ${back[0].description}`,back.length>1?back.slice(0,3).map(t=>t.description).join(", ")+(back.length>3?"…":""):fmtMoney(back[0].value),back.length===1?back[0].id:"");
  lastDeleted=null;
  save();
  toast("Exclusão desfeita");
}

// Marca uma parte como reembolsada e cria automaticamente uma entrada com o valor recebido.
function markReimbursement(txId,splitIndex){
  const t=data.transactions.find(x=>x.id===txId);if(!t)return;
  const s=t.splits?.[splitIndex];if(!s||s.ownerId==="self")return;
  if(s.reimbursed)return;
  s.reimbursed=true;
  const p=data.people.find(x=>x.id===s.ownerId);
  const isLoan=s.category===LOAN_CATEGORY;
  const inc={id:uid(),createdAt:Date.now(),date:today(),description:`${isLoan?"Empréstimo devolvido":"Reembolso"}: ${t.description}`,value:Number(s.amount),type:"income",source:"reimbursement",sourceCategory:s.category,notes:`Recebido de ${p?.name||"outra pessoa"}`,linkedTransactionId:txId,linkedSplitId:s.id};
  data.transactions.push(inc);
  logActivity("received",`${isLoan?"Empréstimo devolvido":"Reembolso recebido"} de ${p?.name||"outra pessoa"}: ${fmtMoney(s.amount)}`,`Referente a "${t.description}" (${s.category}) · entrou como entrada em ${fmtDate(inc.date)}`,inc.id);
  save();toast("Reembolso registrado");
}
