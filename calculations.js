// ====================================================================
// calculations.js — cálculos financeiros
// Funções que apenas CALCULAM a partir de data (entradas, gastos do mês, empréstimos, vencimentos). Não mexem na tela.
// ====================================================================

// Lançamentos cuja data (compra ou entrada) cai no mês informado.
function txForMonth(m){return data.transactions.filter(t=>t.date.slice(0,7)===m);}

// Valor cheio do lançamento.
function transactionGross(t){ return Number(t.value)||0; }

// Soma das partes (divisão por pessoa) de um gasto.
function splitTotal(t){ return (t.splits||[]).reduce((s,x)=>s+Number(x.amount||0),0); }

// Parte do gasto que é realmente sua (divisões atribuídas a "Você").
function ownAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId==="self").reduce((s,x)=>s+Number(x.amount||0),0); }

// Quanto de um gasto outras pessoas ainda te devem (partes não reembolsadas).
function receivableAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId!=="self" && s.reimbursed!==true).reduce((s,x)=>s+Number(x.amount||0),0); }

// Quanto de um gasto outras pessoas já te devolveram.
function reimbursedAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId!=="self" && s.reimbursed===true).reduce((s,x)=>s+Number(x.amount||0),0); }

// Partes de um gasto que pertencem à categoria de empréstimos cedidos.
function loanSplits(t){ return (t.splits||[]).filter(s=>s.category===LOAN_CATEGORY); }

// Dinheiro que outras pessoas ainda te devem de empréstimos, com pagamento previsto no mês m (é uma incógnita: pode não vir)
function loanReceivableForMonth(m){
  let sum=0;
  data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m).forEach(t=>{
    loanSplits(t).forEach(s=>{ if(s.ownerId!=="self" && s.reimbursed!==true) sum+=Number(s.amount||0); });
  });
  return sum;
}

// Dinheiro novo emprestado a outras pessoas no mês (saída de caixa)
function loanGivenForMonth(m){
  let sum=0;
  scheduledPaymentsForMonth(m).forEach(t=>loanSplits(t).forEach(s=>sum+=Number(s.amount||0)));
  return sum;
}

// Entradas do mês separadas por origem: salário/normal, devolução de empréstimo, outros reembolsos
function incomeBreakdownForMonth(m){
  const inc=txForMonth(m).filter(t=>t.type==="income");
  const loan=inc.filter(t=>t.sourceCategory===LOAN_CATEGORY).reduce((s,t)=>s+t.value,0);
  const reimb=inc.filter(t=>t.source==="reimbursement" && t.sourceCategory!==LOAN_CATEGORY).reduce((s,t)=>s+t.value,0);
  const total=inc.reduce((s,t)=>s+t.value,0);
  return {normal:total-loan-reimb, loan, reimb, total};
}

// Gastos cujo PAGAMENTO previsto cai no mês. É esta data (e não a da compra) que manda no Resumo.
function scheduledPaymentsForMonth(m){return data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m);}

// Calcula o próximo vencimento do cartão a partir do dia do fechamento.
function nextCardPaymentDate(cardId, baseDate=today()){
  const card=data.cards.find(c=>c.id===cardId);
  if(!card) return baseDate;
  const d=new Date(baseDate+"T12:00:00");
  let y=d.getFullYear(), m=d.getMonth();
  if(d.getDate()>=Number(card.closing||31)) m+=1;
  let day=Math.min(Number(card.due||1), new Date(y,m+1,0).getDate());
  return localISO(new Date(y,m,day));
}

// Classifica uma entrada: normal, devolução de empréstimo (loan) ou outro reembolso (reimb).
function incomeOrigin(t){
  if(t.source!=="reimbursement") return "normal";
  return t.sourceCategory===LOAN_CATEGORY ? "loan" : "reimb";
}

// Crédito/Parcelado: vencimento do cartão no MÊS SEGUINTE ao da compra
function nextMonthPaymentDate(cardId,baseDate){
  const card=data.cards.find(c=>c.id===cardId);
  const d=new Date((baseDate||today())+"T12:00:00");
  const y=d.getFullYear(), m=d.getMonth()+1;
  const day=Math.min(Number(card?.due)||d.getDate(), new Date(y,m+1,0).getDate());
  return localISO(new Date(y,m,day));
}
