// ====================================================================
// storage.js — salvar, carregar e histórico
// Leitura/gravação no localStorage, normalização de lançamentos antigos e o registro de atividades.
// ====================================================================

// Lê os dados do localStorage ao abrir o app. Completa o que faltar (categorias, regras...) e cria dados novos se não houver nada salvo.
function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(DB_KEY));
    if(saved && Array.isArray(saved.transactions) && Array.isArray(saved.people) && Array.isArray(saved.cards)){
      saved.categories=[...new Set([...(saved.categories||[]),...defaultData.categories])];
      saved.rules ||= [];
      saved.importLog ||= [];
      saved.activityLog ||= [];
      if(saved.lastBackupAt===undefined) saved.lastBackupAt=null;
      saved.people=saved.people.some(p=>p.id==="self") ? saved.people : [{id:"self",name:"Você"},...saved.people];
      saved.transactions=saved.transactions.map(t=>normalizeTransaction(t));
      return saved;
    }
  }catch{}
  const fresh=structuredClone(defaultData);
  fresh.transactions=fresh.transactions.map(normalizeTransaction);
  return fresh;
}

// Salva tudo no localStorage e redesenha todas as telas. Chame depois de qualquer alteração nos dados.
function save(){ localStorage.setItem(DB_KEY, JSON.stringify(data)); renderAll(); }

// Garante que lançamentos antigos tenham todos os campos novos (divisões, parcelas, data/status de pagamento).
function normalizeTransaction(t){
  if(t.type==="expense"){
    t.splits=Array.isArray(t.splits)&&t.splits.length?t.splits:[{id:uid(),category:"Outros",amount:Number(t.value)||0,ownerId:"self",reimbursed:false}];
    t.installments=t.installments||1;t.installmentNo=t.installmentNo||1;if(!t.method&&t.cardId)t.method=t.installments>1?"installment":"credit";
    if(!t.paymentDate) t.paymentDate=t.cardId?nextCardPaymentDate(t.cardId,t.date||today()):(t.date||today());
    if(!t.paymentStatus) t.paymentStatus=t.cardId?"planned":"paid";
  }
  return t;
}

// Registra uma ação no histórico de "Últimos lançamentos" (guarda no máximo 300).
function logActivity(kind,text,detail="",txId=""){
  data.activityLog=data.activityLog||[];
  data.activityLog.unshift({id:uid(),at:Date.now(),kind,text,detail,txId});
  if(data.activityLog.length>300) data.activityLog.length=300;
}
