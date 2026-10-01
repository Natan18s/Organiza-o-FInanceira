// ====================================================================
// backup.js — backup e restauração
// Baixar, compartilhar, copiar e restaurar os dados.
// ====================================================================

// Texto JSON com todos os dados do app.
function backupPayload(){ return JSON.stringify(data,null,2); }

// Registra a data do último backup (some o lembrete).
function markBackedUp(){ data.lastBackupAt=Date.now(); save(); }

// Baixa o backup como arquivo .json.
function exportBackup(){
  const blob=new Blob([backupPayload()],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-controle-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  markBackedUp();toast("Backup exportado");
}

// Abre o menu de compartilhar do aparelho com o arquivo de backup (ou baixa, se não houver suporte).
async function shareBackup(){
  try{
    const file=new File([backupPayload()],`meu-controle-backup-${today()}.json`,{type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Backup Meu Controle"}); markBackedUp(); return }
  }catch(e){ if(e && e.name==="AbortError") return }
  exportBackup();   // sem suporte a compartilhamento de arquivo: cai para o download normal
}

// Copia o backup como texto para colar em outro aparelho.
async function copyBackupText(){
  const text=backupPayload();
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text) }
    else{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove() }
    markBackedUp();
    toast("Backup copiado. Cole em uma mensagem para você mesmo ou direto no outro aparelho.");
  }catch{
    $("backupExportText").value=text; $("backupExportText").classList.remove("hidden-file");
    alert("Não consegui copiar automaticamente. Selecione o texto que apareceu na caixa e copie manualmente.");
  }
}

// Junta o backup recebido (arquivo, texto colado...) aos dados atuais, preenchendo o que faltar, como o loadData() já faz ao abrir o app
function applyBackup(x,sourceLabel){
  if(!x || typeof x!=="object" || !Array.isArray(x.transactions) || !Array.isArray(x.cards) || !Array.isArray(x.people)){
    alert("Esse backup não tem o formato esperado (faltam lançamentos, cartões ou pessoas)."); return false;
  }
  if(!confirm("Restaurar este backup vai substituir TODOS os dados deste aparelho. Deseja continuar?")) return false;
  const merged=structuredClone(defaultData);
  merged.transactions=(x.transactions||[]).map(t=>normalizeTransaction({...t}));
  merged.cards=x.cards.length?x.cards:merged.cards;
  merged.people=x.people.some(p=>p.id==="self")?x.people:[{id:"self",name:"Você"},...x.people];
  merged.categories=[...new Set([...(x.categories||[]),...defaultData.categories])];
  merged.rules=x.rules||[];
  merged.importLog=x.importLog||[];
  merged.activityLog=x.activityLog||[];
  merged.lastBackupAt=x.lastBackupAt||null;
  data=merged;
  logActivity("restore",`Backup restaurado (${sourceLabel||"arquivo"})`,`${merged.transactions.length} lançamento(s) carregados`);
  save();
  toast(`Backup restaurado${sourceLabel?" ("+sourceLabel+")":""}`);
  return true;
}

// Restaura a partir de um arquivo .json escolhido.
function restoreBackup(){
  const f=$("backupInput").files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{ applyBackup(JSON.parse(reader.result),"arquivo") }
    catch(e){ alert("Não consegui ler esse arquivo como backup. Confira se é o .json exportado pelo próprio app.") }
  };
  reader.onerror=()=>alert("Não consegui abrir esse arquivo.");
  reader.readAsText(f);
  $("backupInput").value="";
}

// Restaura a partir do texto colado.
function restoreFromText(){
  const raw=$("backupPasteText").value.trim();
  if(!raw){alert("Cole o texto do backup antes de restaurar.");return}
  try{
    if(applyBackup(JSON.parse(raw),"texto colado")) $("backupPasteText").value="";
  }catch(e){ alert("Esse texto não é um backup válido. Confira se copiou tudo, do { inicial ao } final.") }
}
