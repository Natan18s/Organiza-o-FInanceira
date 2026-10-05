// ====================================================================
// cadastros.js — Cartões, Pessoas, Categorias e Regras
// Telas de cadastro e seus painéis de criar/editar/excluir.
// ====================================================================

// Desenha a aba Cartões: compras do mês, pagamento previsto, fechamento, vencimento e limite.
function renderCards(){
  const purchases=txForMonth(month), toPayMonth=scheduledPaymentsForMonth(month);
  $("cardsGrid").innerHTML=data.cards.map(c=>{
    const total=purchases.filter(t=>t.type==="expense"&&t.cardId===c.id).reduce((s,t)=>s+t.value,0);
    const toPay=toPayMonth.filter(t=>t.cardId===c.id).reduce((s,t)=>s+t.value,0);
    const pct=c.limit ? Math.min(100,total/c.limit*100):0;
    return `<article class="card-mini"><h3>${esc(c.name)}</h3><div class="muted">Compras no mês</div><div class="big">${fmtMoney(total)}</div><div class="muted">Pagamento previsto no mês: <b>${fmtMoney(toPay)}</b></div><div class="muted">Fecha dia ${c.closing} · vence dia ${c.due}</div>${c.limit?`<div class="bar-row"><div class="bar-label"><span>Limite</span><span>${fmtMoney(c.limit)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`:""}<div class="row-actions"><button class="btn" onclick="openCardModal('${c.id}')">Editar</button><button class="btn ghost" onclick="deleteCard('${c.id}')">Excluir</button></div></article>`;
  }).join("");
}

// Lista as pessoas e quanto cada uma ainda te deve.
function renderPeople(){
  const pendingBy={};
  data.transactions.filter(t=>t.type==="expense").forEach(t=>(t.splits||[]).forEach(s=>{
    if(s.ownerId!=="self"&&s.reimbursed!==true) pendingBy[s.ownerId]=(pendingBy[s.ownerId]||0)+Number(s.amount||0);
  }));
  $("peopleList").innerHTML=data.people.map(p=>`<div class="person-card"><div><b>${esc(p.name)}</b><div class="muted">${p.id==="self"?"Você":`A receber: ${fmtMoney(pendingBy[p.id]||0)}`}</div></div>${p.id!=="self"?`<button class="btn ghost" onclick="deletePerson('${p.id}')">Excluir</button>`:""}</div>`).join("");
}

// Lista as regras automáticas palavra → categoria.
function renderRules(){
  $("rulesList").innerHTML=data.rules.length ? data.rules.map(r=>`<div class="rule-row"><div><b>${esc(r.keyword)}</b> → ${esc(r.category)}</div><button class="btn ghost" onclick="deleteRule('${r.id}')">Excluir</button></div>`).join(""):'<div class="empty">Nenhuma regra.</div>';
}

// Sugere a categoria de uma descrição olhando as regras (padrão: Outros).
function applyRule(description){
  const d=description.toLowerCase();
  const rule=data.rules.find(r=>d.includes(r.keyword.toLowerCase()));
  return rule?.category || "Outros";
}

// Lista as categorias com botões para subir/descer (▲ ▼), editar e excluir. A ordem daqui é a ordem usada nos formulários e na Planilha do mês.
function renderCategories(){
  const last=data.categories.length-1;
  $("categoriesList").innerHTML=data.categories.map((c,i)=>`<div class="category-row"><div class="category-name"><span class="tag">#${i+1}</span><b>${esc(c)}</b></div><div class="row-actions"><button class="btn icon-move" title="Subir" aria-label="Subir ${esc(c)}" ${i===0?"disabled":""} onclick="moveCategory(${i},-1)">▲</button><button class="btn icon-move" title="Descer" aria-label="Descer ${esc(c)}" ${i===last?"disabled":""} onclick="moveCategory(${i},1)">▼</button><button class="btn" onclick="editCategory(${i})">Editar</button><button class="btn ghost" onclick="deleteCategory(${i})">Excluir</button></div></div>`).join("");
}

// Move a categoria de posição i uma casa para cima (dir=-1) ou para baixo (dir=1) e salva.
function moveCategory(i,dir){
  const j=i+dir; if(j<0||j>=data.categories.length)return;
  [data.categories[i],data.categories[j]]=[data.categories[j],data.categories[i]];
  save();
}

// Painel para criar ou renomear uma categoria (renomear atualiza lançamentos e regras).
function openCategoryModal(index=null){const old=index!==null?data.categories[index]:"";openModal(index!==null?"Editar categoria":"Nova categoria",`<form id="categoryForm"><label>Nome da categoria</label><input name="name" value="${esc(old)}" placeholder="Ex.: Assinaturas" required><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);$("categoryForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get("name").trim();if(!name)return;if(data.categories.some((c,i)=>c.toLowerCase()===name.toLowerCase()&&i!==index)){alert("Essa categoria já existe.");return}if(index===null)data.categories.push(name);else{const oldName=data.categories[index];data.categories[index]=name;data.rules.forEach(r=>{if(r.category===oldName)r.category=name});data.transactions.forEach(t=>(t.splits||[]).forEach(s=>{if(s.category===oldName)s.category=name}))}closeModal();save();toast("Categoria salva")}}

// Atalho para editar a categoria de posição i.
function editCategory(i){openCategoryModal(i)}

// Exclui uma categoria, se nenhum lançamento a estiver usando.
function deleteCategory(i){const name=data.categories[i];if(data.transactions.some(t=>(t.splits||[]).some(s=>s.category===name))){alert("Essa categoria está sendo usada em lançamentos. Edite os lançamentos ou mova-os para outra categoria antes de excluir.");return}if(confirm(`Excluir a categoria "${name}"?`)){data.categories.splice(i,1);save();toast("Categoria excluída")}}

// Painel para criar ou editar um cartão.
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

// Exclui um cartão, se não houver lançamentos nele.
function deleteCard(id){if(data.transactions.some(t=>t.cardId===id)){alert("Este cartão possui lançamentos. Exclua ou mova os lançamentos antes de remover o cartão.");return}if(confirm("Excluir cartão?")){data.cards=data.cards.filter(c=>c.id!==id);save()}}

// Painel para cadastrar uma pessoa nas divisões.
function openPersonModal(){
  openModal("Nova pessoa",`<form id="personForm"><label>Nome</label><input name="name" placeholder="Ex.: João" required><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("personForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.people.push({id:uid(),name:f.get("name")});closeModal();save();toast("Pessoa adicionada")};
}

// Exclui uma pessoa, se não estiver ligada a lançamentos.
function deletePerson(id){if(data.transactions.some(t=>(t.splits||[]).some(s=>s.ownerId===id))){alert("Esta pessoa está vinculada a lançamentos.");return}if(confirm("Excluir pessoa?")){data.people=data.people.filter(p=>p.id!==id);save()}}

// Painel para criar uma regra automática de categoria.
function openRuleModal(){
  openModal("Nova regra automática",`<form id="ruleForm" class="form-grid"><div><label>Palavra ou trecho</label><input name="keyword" placeholder="ex.: uber" required></div><div><label>Categoria</label><select name="category">${data.categories.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div><div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("ruleForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.rules.push({id:uid(),keyword:f.get("keyword"),category:f.get("category")});closeModal();save();toast("Regra criada")};
}

// Exclui uma regra automática.
function deleteRule(id){if(confirm("Excluir regra?")){data.rules=data.rules.filter(r=>r.id!==id);save()}}
