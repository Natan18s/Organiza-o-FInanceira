// ====================================================================
// dashboard.js — aba Resumo
// Cards do topo, barras (com % sobre as entradas do mês), fluxo de caixa, pendências, histórico e painéis de detalhe.
// ====================================================================

// Nota mostrada quando o mês não tem entradas (sem entradas não dá para calcular a porcentagem).
const NO_INCOME_NOTE='<div class="field-note">Sem entradas neste mês: a porcentagem aparece quando houver entradas.</div>';
// Quanto um valor representa das ENTRADAS do mês, em % (devolve null se não há entradas).
function pctOfIncome(value,income){ return income>0 ? value/income*100 : null; }
// Texto da porcentagem: "35%", "<1%" ou "—" quando não dá para calcular.
function pctText(p){ if(p===null) return "—"; if(p>0&&p<1) return "<1%"; return Math.round(p)+"%"; }
// Largura da barra (0 a 100). Com entradas, 100% da barra = todas as entradas do mês; sem entradas, compara com o maior valor.
function barWidth(value,income,fallbackMax){ return income>0 ? Math.min(100,value/income*100) : (fallbackMax>0 ? value/fallbackMax*100 : 0); }

// Desenha a aba Resumo: os 4 cards do topo, barras, empréstimos, fluxo de caixa, pendências e histórico.
function renderDashboard(){
  const txPurchase=txForMonth(month);          // usado só para as Entradas (dinheiro que entrou de fato neste mês)
  const sched=scheduledPaymentsForMonth(month); // gastos cujo PAGAMENTO previsto cai neste mês (é essa data que manda no Resumo)
  const incB=incomeBreakdownForMonth(month);
  const income=incB.total;
  const gross=sched.reduce((s,t)=>s+t.value,0);
  const own=sched.reduce((s,t)=>s+ownAmount(t),0);   // sua parte, no mês em que o cartão vence (não no mês da compra)
  const scheduled=gross;
  const loanReceivable=loanReceivableForMonth(month);
  const loanGiven=loanGivenForMonth(month);
  const projected=income-own;   // Saldo previsto = Entradas - Gasto realmente seu

  $("mIncome").textContent=fmtMoney(income);
  $("mScheduled").textContent=fmtMoney(scheduled);
  $("mOwn").textContent=fmtMoney(own);
  $("mBalance").textContent=fmtMoney(projected);
  $("mBalance").className=""+(projected>=0?"positive":"negative");

  // Balanço visual: o mesmo cálculo do Saldo previsto (Entradas x Gasto realmente seu)
  const maxBal=Math.max(income,own,1);
  $("balanceBars").innerHTML=`
    <div class="bar-row bar-click" data-income-detail="all" title="Ver entradas"><div class="bar-label"><span>Entradas</span><b class="positive">${fmtMoney(income)}</b></div><div class="bar"><i style="width:${income>0?100:0}%;background:var(--green)"></i></div></div>
    <div class="bar-row bar-click" data-own-detail="1" title="Ver gastos"><div class="bar-label"><span>Gasto realmente seu (${pctText(pctOfIncome(own,income))} das entradas)</span><b class="negative">${fmtMoney(own)}</b></div><div class="bar"><i style="width:${barWidth(own,income,maxBal)}%;background:var(--red)"></i></div></div>
    <div class="field-note">Saldo previsto = Entradas − Gasto realmente seu, ambos contados no mês do pagamento previsto (não no mês da compra). "Saídas previstas no mês" (abaixo) é o valor cheio da fatura, incluindo a parte que outras pessoas te devem. Toque numa barra para ver os lançamentos.</div>`;
  $("balanceBars").querySelector("[data-income-detail]").onclick=()=>showIncomeDetail("all");
  $("balanceBars").querySelector("[data-own-detail]").onclick=()=>showOwnDetail();

  // Entradas por origem: salário/normal, devolução de empréstimo, outros reembolsos
  const incRows=[
    {label:"Salário e outras entradas",v:incB.normal,color:"#2563eb",origin:"normal"},
    {label:"Devolução de empréstimos cedidos",v:incB.loan,color:"#15803d",origin:"loan"},
    {label:"Outros reembolsos recebidos",v:incB.reimb,color:"#7c3aed",origin:"reimb"}
  ].filter(r=>r.v>0.004);
  $("incomeBreakdown").innerHTML=incRows.length ? incRows.map(r=>{const pct=incB.total>0?Math.round(r.v/incB.total*100):0;return `<div class="bar-row bar-click" data-origin="${r.origin}" title="Ver entradas"><div class="bar-label"><span>${r.label} (${pct}%)</span><b>${fmtMoney(r.v)}</b></div><div class="bar"><i style="width:${pct}%;background:${r.color}"></i></div></div>`}).join("") : '<div class="empty">Nenhuma entrada neste mês.</div>';
  $("incomeBreakdown").querySelectorAll("[data-origin]").forEach(el=>el.onclick=()=>showIncomeDetail(el.dataset.origin));

  $("mLoanReceivable").textContent=fmtMoney(loanReceivable);
  $("mLoanGiven").textContent=fmtMoney(loanGiven);

  // Gastos por categoria (clicável: abre a lista de lançamentos da categoria)
  const cat={}; sched.forEach(t=>(t.splits||[]).forEach(s=>cat[s.category]=(cat[s.category]||0)+Number(s.amount||0)));
  const catArr=Object.entries(cat).sort((a,b)=>b[1]-a[1]);
  const max=catArr[0]?.[1]||1;
  $("categoryTotal").textContent=gross>0?`Total do mês: ${fmtMoney(gross)}`:"";
  $("categoryBars").innerHTML=catArr.length ? catArr.slice(0,10).map(([k,v])=>{const p=pctOfIncome(v,income);return `<div class="bar-row bar-click" data-cat="${esc(k)}" title="Ver lançamentos"><div class="bar-label"><span>${esc(k)} (${pctText(p)})</span><b>${fmtMoney(v)}</b></div><div class="bar"><i style="width:${barWidth(v,income,max)}%"></i></div></div>`}).join("") : '<div class="empty">Sem gastos neste mês.</div>';
  $("categoryBars").querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>showCategoryDetail(el.dataset.cat));
  if(income<=0&&catArr.length)$("categoryBars").insertAdjacentHTML("beforeend",NO_INCOME_NOTE);

  // Cartões (clicável: abre as compras do cartão)
  const cardsCat={}; sched.filter(t=>t.cardId).forEach(t=>cardsCat[t.cardId]=(cardsCat[t.cardId]||0)+t.value);
  const cArr=Object.entries(cardsCat).sort((a,b)=>b[1]-a[1]);
  $("cardBars").innerHTML=cArr.length ? cArr.map(([id,v])=>{
    const c=data.cards.find(x=>x.id===id), p=pctOfIncome(v,income);
    return `<div class="bar-row bar-click" data-card="${esc(id)}" title="Ver compras"><div class="bar-label"><span>${esc(c?.name||"Cartão")} (${pctText(p)})</span><b>${fmtMoney(v)}</b></div><div class="bar"><i style="width:${barWidth(v,income,cArr[0][1])}%"></i></div></div>`;
  }).join("") : '<div class="empty">Sem compras em cartão neste mês.</div>';
  $("cardBars").querySelectorAll("[data-card]").forEach(el=>el.onclick=()=>showCardDetail(el.dataset.card));
  if(income<=0&&cArr.length)$("cardBars").insertAdjacentHTML("beforeend",NO_INCOME_NOTE);

  // Pagamentos previstos do mês separados por status
  const isPaid=t=>t.paymentStatus==="paid";
  const paidSum=sched.filter(isPaid).reduce((s,t)=>s+t.value,0);
  const pendingSum=scheduled-paidSum;
  const paidPct=scheduled>0?Math.round(paidSum/scheduled*100):0, pendingPct=scheduled>0?100-paidPct:0;
  $("paymentStatusBars").innerHTML=scheduled>0
    ? `<div class="bar-row"><div class="bar-label"><span>Saídas previstas já pagas (${paidPct}%)</span><b class="positive">${fmtMoney(paidSum)}</b></div><div class="bar"><i style="width:${paidPct}%;background:#15803d"></i></div></div><div class="bar-row"><div class="bar-label"><span>Saídas previstas não pagas (${pendingPct}%)</span><b class="warning">${fmtMoney(pendingSum)}</b></div><div class="bar"><i style="width:${pendingPct}%;background:#b45309"></i></div></div>`
    : '<div class="empty">Nenhuma saída prevista neste mês.</div>';

  // Fluxo de caixa com filtro (Todos / Pagos / Não pagos); clicar no item leva ao lançamento
  const flows=sched.slice().sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||(a.createdAt||0)-(b.createdAt||0));
  const shownFlows=flows.filter(t=>cashFilter==="all"||(cashFilter==="paid"?isPaid(t):!isPaid(t)));
  const cashItems=[];
  if(cashFilter==="all") txPurchase.filter(t=>t.type==="income").forEach(t=>cashItems.push({txId:t.id,date:t.date,type:"income",title:t.description,value:t.value,status:t.source==="reimbursement"?(t.sourceCategory===LOAN_CATEGORY?"Empréstimo devolvido":"Reembolso"):"Entrada"}));
  shownFlows.forEach(t=>cashItems.push({txId:t.id,id:t.id,paid:isPaid(t),date:t.paymentDate,type:"expense",title:t.description,value:t.value,status:isPaid(t)?"Pago":"Previsto",card:t.cardId?data.cards.find(c=>c.id===t.cardId)?.name:""}));
  cashItems.sort((a,b)=>a.date.localeCompare(b.date));
  document.querySelectorAll("[data-cash-filter]").forEach(b=>b.classList.toggle("primary",b.dataset.cashFilter===cashFilter));
  $("cashflowList").innerHTML=cashItems.length ? cashItems.map(x=>`<div class="cashflow-item"><div class="cashflow-main"><span class="cashflow-dot ${x.type}"></span><div><div class="cashflow-link" onclick="goToTransaction('${x.txId}')" title="Ver em Lançamentos"><b>${esc(x.title)}</b><div class="muted">${fmtDate(x.date)} · ${esc(x.status)}${x.card?` · ${esc(x.card)}`:""}</div></div>${x.id?`<button class="btn ghost" style="margin-top:6px;padding:4px 9px;font-size:12px" onclick="togglePaid('${x.id}')">${x.paid?"Voltar para previsto":"Marcar como pago"}</button>`:""}</div></div><strong class="${x.type==="expense"?"negative":"positive"}">${x.type==="expense"?"-":"+"} ${fmtMoney(x.value)}</strong></div>`).join("") : '<div class="empty">Nenhuma entrada ou saída prevista neste mês.</div>';
  const sub=shownFlows.reduce((sum,t)=>sum+t.value,0);
  $("cashflowSubtotal").innerHTML=cashFilter==="all"?"":`Subtotal ${cashFilter==="paid"?"das saídas já pagas":"das saídas não pagas"}: <b>${fmtMoney(sub)}</b>`;

  // Pendências de reembolso: só as do mês visto (pelo mês do pagamento previsto, o mesmo critério do fluxo de caixa)
  const pend=[];
  data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===month).forEach(t=>(t.splits||[]).forEach((s,idx)=>{
    if(s.ownerId!=="self" && s.reimbursed!==true) pend.push({t,s,idx});
  }));
  const pendTotal=pend.reduce((s,{s:x})=>s+Number(x.amount||0),0);
  $("receivableBadge").textContent=pend.length?`${pend.length} · ${fmtMoney(pendTotal)}`:"nenhuma";
  $("receivableList").innerHTML=pend.length ? pend.map(({t,s,idx})=>{
    const p=data.people.find(x=>x.id===s.ownerId);
    return `<div class="reimbursed-row"><div><b>${esc(p?.name||"Outra pessoa")}</b> · ${fmtMoney(s.amount)}${s.category===LOAN_CATEGORY?' <span class="tag">Empréstimo</span>':""}<div class="muted">${esc(t.description)} · compra ${fmtDate(t.date)} · pagamento ${fmtDate(t.paymentDate||t.date)}</div></div><button class="btn" onclick="markReimbursement('${t.id}',${idx})">Marcar como recebido</button></div>`;
  }).join("") : '<div class="empty">Nenhum reembolso pendente neste mês.</div>';

  // Últimos lançamentos: registro do que foi feito (independe do mês), do mais novo para o mais antigo
  const log=data.activityLog||[];
  const fmtWhen=at=>{const d=new Date(at);return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};
  $("activityBadge").textContent=String(log.length);
  $("activityList").innerHTML=log.length ? log.slice(0,100).map(a=>{
    const exists=a.txId&&data.transactions.some(t=>t.id===a.txId);
    return `<div class="activity-item${exists?" clickable":""}"${exists?` onclick="goToTransaction('${a.txId}')" title="Ver em Lançamentos"`:""}><span class="activity-icon">${ACTIVITY_ICONS[a.kind]||"•"}</span><div class="activity-main"><b>${esc(a.text)}</b><div class="muted">${esc(a.detail||"")}</div></div><div class="activity-when muted">${fmtWhen(a.at)}</div></div>`;
  }).join("")+(log.length>100?`<div class="muted" style="padding:8px 0">Mostrando os 100 mais recentes de ${log.length}.</div>`:"") : '<div class="empty">Nenhuma atividade registrada ainda. O que você lançar, editar ou excluir daqui para frente aparece aqui.</div>';
}

// Tabela de gastos usada nos painéis de detalhe (categoria, cartão, gasto realmente seu).
function detailTable(rows,valueOf){
  if(!rows.length) return '<div class="empty">Nenhum lançamento.</div>';
  const body=rows.map(t=>{
    const v=valueOf(t), par=t.installments>1?`${t.installmentNo||1}/${t.installments}`:"—";
    const sub=Math.abs(v-t.value)>0.004?`<div class="muted">de ${fmtMoney(t.value)}</div>`:"";
    return `<tr><td>${fmtDate(t.date)}</td><td><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}</td><td>${paymentLabel(t)}</td><td>${peopleLabels(t)}</td><td>${paymentDateLabel(t)}</td><td>${par}</td><td class="right negative">- ${fmtMoney(v)}${sub}</td></tr>`;
  }).join("");
  return `<div class="table-wrap detail-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Forma</th><th>Responsável</th><th>Pagamento previsto</th><th>Parcelas</th><th class="right">Valor</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

// Painel com os lançamentos de uma categoria no mês visto.
function showCategoryDetail(cat){
  const partOf=t=>(t.splits||[]).filter(s=>s.category===cat).reduce((a,x)=>a+Number(x.amount||0),0);
  const rows=scheduledPaymentsForMonth(month).filter(t=>(t.splits||[]).some(s=>s.category===cat)).sort(byNewest);
  const total=rows.reduce((s,t)=>s+partOf(t),0);
  openModal(`${cat} · compras de ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b></div>`+detailTable(rows,partOf));
}

// Tabela de entradas usada no painel de detalhe das entradas.
function incomeDetailTable(rows){
  if(!rows.length) return '<div class="empty">Nenhuma entrada.</div>';
  const body=rows.map(t=>`<tr><td>${fmtDate(t.date)}</td><td><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}</td><td class="right positive">+ ${fmtMoney(t.value)}</td></tr>`).join("");
  return `<div class="table-wrap detail-table"><table><thead><tr><th>Data</th><th>Descrição</th><th class="right">Valor</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

// Painel com as entradas do mês (todas ou de uma origem).
function showIncomeDetail(origin){
  const titles={all:"Todas as entradas",normal:"Salário e outras entradas",loan:"Devolução de empréstimos cedidos",reimb:"Outros reembolsos recebidos"};
  const rows=txForMonth(month).filter(t=>t.type==="income"&&(origin==="all"||incomeOrigin(t)===origin)).sort(byNewest);
  const total=rows.reduce((s,t)=>s+t.value,0);
  openModal(`${titles[origin]} · ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b></div>`+incomeDetailTable(rows));
}

// Painel com os gastos que compõem o "Gasto realmente seu".
function showOwnDetail(){
  const rows=scheduledPaymentsForMonth(month).filter(t=>ownAmount(t)>0.004).sort(byNewest);
  const total=rows.reduce((s,t)=>s+ownAmount(t),0);
  openModal(`Gasto realmente seu · ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · sua parte <b>${fmtMoney(total)}</b></div>`+detailTable(rows,ownAmount));
}

// Painel com as compras de um cartão no mês visto.
function showCardDetail(id){
  const c=data.cards.find(x=>x.id===id);
  const rows=scheduledPaymentsForMonth(month).filter(t=>t.cardId===id).sort(byNewest);
  const total=rows.reduce((s,t)=>s+t.value,0);
  openModal(`${c?.name||"Cartão"} · compras de ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b></div>`+detailTable(rows,t=>t.value));
}

// Filtro do fluxo de caixa: all (todos), paid (já pagos) ou pending (não pagos).
function setCashFilter(f){ cashFilter=f; renderDashboard(); }

// Alterna um gasto entre "previsto" e "pago".
function togglePaid(id){
  const t=data.transactions.find(x=>x.id===id); if(!t||t.type!=="expense")return;
  t.paymentStatus=t.paymentStatus==="paid"?"planned":"paid";
  logActivity(t.paymentStatus==="paid"?"paid":"unpaid",`${t.paymentStatus==="paid"?"Marcado como pago":"Voltou para previsto"}: ${t.description}`,`${fmtMoney(t.value)} · pagamento em ${fmtDate(t.paymentDate||t.date)}`,t.id);
  save(); toast(t.paymentStatus==="paid"?"Marcado como pago":"Voltou para previsto");   // save() recalcula o Resumo
}
