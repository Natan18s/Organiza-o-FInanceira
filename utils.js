// ====================================================================
// utils.js — funções auxiliares
// Pequenas funções usadas em todo o app: formatar dinheiro/datas, escapar texto, gerar ids.
//  Não dependem dos dados do app.
// ====================================================================

// Atalho para document.getElementById: $("idDoElemento").
const $ = id => document.getElementById(id);

// Formata um número como moeda brasileira (ex.: R$ 1.234,56).
const fmtMoney = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);

// Escapa caracteres especiais do texto antes de colocá-lo em HTML (evita quebrar a tela ou injetar código).
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Gera um identificador único para cada lançamento, pessoa, regra, divisão etc.
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));

// Converte uma data do JavaScript em texto AAAA-MM-DD usando o fuso do aparelho (e não o UTC).
function localISO(d){ return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }

// Data de hoje no formato AAAA-MM-DD.
const today = () => localISO(new Date());

// Mostra uma data AAAA-MM-DD no formato brasileiro DD/MM/AAAA.
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");

// Soma ou subtrai meses de um texto AAAA-MM. Usado pelas setas ‹ › do seletor de mês.
function shiftMonthStr(m,delta){const [y,mo]=m.split("-").map(Number);const d=new Date(y,mo-1+delta,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}

// Transforma AAAA-MM em MM/AAAA (ex.: 2026-10 vira 10/2026).
const fmtMonthLabel=m=>m.slice(5,7)+"/"+m.slice(0,4);

// Nomes curtos dos meses, usados na prévia das parcelas.
const MONTHS_PT=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

// Ordenação dos lançamentos: do mais novo para o mais antigo (desempata pela hora em que foi criado).
const byNewest=(a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0);

// Devolve a data (dia fixo) N meses depois do mês informado. Respeita meses curtos: 31/02 vira o último dia de fevereiro.
function shiftMonthDate(firstMonth, day, offset){
  const [y,m]=firstMonth.split("-").map(Number);
  const last=new Date(y,m+offset,0).getDate();   // último dia do mês alvo (evita 31/02 virar março)
  return localISO(new Date(y,m-1+offset,Math.min(Number(day)||1,last)));
}
