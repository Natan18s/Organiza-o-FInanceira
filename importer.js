// ====================================================================
// importer.js — importação de CSV/OFX
// Leitura de extratos de banco/cartão, detecção de duplicados e prévia antes de importar.
// ====================================================================

// Preenche a lista de cartões da aba Importar.
function renderImportCardOptions(){const sel=$("importCard");if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Detectar pelo arquivo OFX / sem cartão</option>'+data.cards.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");if(current)sel.value=current}

// Lê um arquivo como texto, detectando UTF-8 ou Windows-1252.
function readFileAsText(file){
  return file.arrayBuffer().then(buf=>{
    let utf8=new TextDecoder("utf-8",{fatal:false}).decode(buf);
    const needs1252=utf8.includes("�");
    if(needs1252) return new TextDecoder("windows-1252").decode(buf);
    return utf8.replace(/^\uFEFF/,"");
  });
}

// Descobre se o arquivo é OFX ou CSV.
function detectFormat(file,text){
  const ext=file.name.toLowerCase().split(".").pop();
  if(ext==="ofx"||ext==="qfx"||text.includes("<OFX>")) return "ofx";
  return "csv";
}

// Lê um CSV (Nubank, PicPay...) e devolve as linhas com data, descrição e valor.
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

// Padroniza o nome de uma coluna (minúsculas, sem acento) para reconhecê-la.
function normalizeHeader(h){return String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^["']|["']$/g,"")}

// Converte texto de valor (1.234,56 / -50,00 / R$ 10) em número.
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

// Converte DD/MM/AAAA ou AAAA-MM-DD para AAAA-MM-DD.
function normalizeDate(v){
  const s=String(v||"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  const m2=s.match(/^(\d{2})-(\d{2})-(\d{4})$/);if(m2)return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return "";
}

// Procura "2/10" ou "parcela 2 de 10" na descrição para identificar a parcela.
function parseInstallment(desc){
  const s=desc;
  let m=s.match(/(?:parcela\s*)?(\d{1,2})\s*[\/de]\s*(\d{1,2})/i);
  if(!m)m=s.match(/(\d{1,2})\s*[\/]\s*(\d{1,2})/);
  return m?{no:Number(m[1]),total:Number(m[2])}:{no:1,total:1};
}

// Lê um arquivo OFX (extrato/fatura) e devolve as transações.
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

// Lê o arquivo escolhido e classifica cada linha (gasto, pagamento de fatura, crédito).
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

// Diz se a linha já foi importada antes (para não duplicar).
function isDuplicate(r){
  return data.transactions.some(t=>t.importKey===r.sourceKey || (t.date===r.date && Math.abs(t.value-r.value)<0.005 && t.description.toLowerCase()===r.description.toLowerCase()));
}

// Recebe o arquivo da aba Importar. Backup .json é restaurado direto; CSV/OFX vira prévia.
async function handleFile(file){
  if(!file)return;
  selectedImport=file;$("selectedFile").textContent=`Selecionado: ${file.name}`;
  $("importStatus").classList.add("hidden");
  // Backup do próprio app (.json) solto aqui: restaura direto, em vez de tentar ler como extrato do banco
  if(/\.json$/i.test(file.name)||file.type==="application/json"){
    let parsed=null;
    try{ parsed=JSON.parse(await file.text()) }catch{}
    if(parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.cards) && Array.isArray(parsed.people)){
      if(applyBackup(parsed,"arquivo solto em Importar")){
        $("importStatus").textContent="Esse arquivo era um backup do próprio app — os dados foram restaurados direto, sem passar pela importação de extrato.";
        $("importStatus").classList.remove("hidden");
      }
      selectedImport=null;$("selectedFile").textContent="Nenhum arquivo selecionado";
      return;
    }
    $("importStatus").textContent="Esse .json não tem o formato de um extrato nem de um backup deste app.";
    $("importStatus").classList.remove("hidden");
    return;
  }
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

// Cria o cartão detectado no OFX se ele ainda não existir.
function ensureImportedCard(rows){
  const name=rows.find(r=>r.cardName)?.cardName;
  if(!name)return null;
  let c=data.cards.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!c){c={id:uid(),name:name,limit:0,closing:10,due:19};data.cards.push(c)}
  return c;
}

// Mostra a prévia da importação antes de confirmar.
function showImportPreview(format,rows,duplicates){
  $("importPreview").classList.remove("hidden");
  $("previewCount").textContent=`${rows.length} novos · ${duplicates} repetidos ignorados`;
  $("previewTable").innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.description)}</td><td class="${r.isExpense?"negative":"positive"}">${r.isExpense?"-":"+"} ${fmtMoney(r.value)}</td><td>${r.isCardPayment?"Pagamento do cartão":r.isExpense?"Gasto":"Crédito/ajuste"}</td><td>${r.isExpense?fmtDate(r.paymentDate):"—"}</td><td>${r.installments>1?`${r.installmentNo}/${r.installments}`:"—"}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">Nenhum lançamento novo.</td></tr>';
  $("importStatus").textContent=`Formato detectado: ${format.toUpperCase()}. O importador também normaliza acentuação, datas e valores.`;
  $("importStatus").classList.remove("hidden");
}
