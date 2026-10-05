// ====================================================================
// sheet-drag.js — arrastar categorias na Planilha do mês
// Segure uma categoria por ~0,3 s e arraste para cima/baixo; as outras se ajeitam sozinhas.
// A ordem é a mesma da aba Categorias (data.categories), então vale para o app todo.
// ====================================================================

let sheetDragMoved=false;   // true logo depois de um arrasto (evita abrir um lançamento sem querer)
let sheetDrag=null;         // arrasto em andamento: {cat, rows, ghost, target, x, y, raf}

// Liga o "segurar e arrastar" às células de categoria da planilha (chamado por renderSheet depois de desenhar).
function initSheetDrag(root){
  root.querySelectorAll(".sheet-cat[data-cat]").forEach(cell=>{
    cell.addEventListener("pointerdown",e=>sheetPress(e,cell));
    cell.addEventListener("contextmenu",e=>e.preventDefault());   // evita o menu do toque longo
  });
}

// Começa a contar o toque longo. Se o dedo se mexer antes disso (ou seja, o usuário está rolando a tela), cancela.
function sheetPress(e,cell){
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const id=e.pointerId, sx=e.clientX, sy=e.clientY;
  let active=false;
  const stop=()=>{clearTimeout(timer);document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",abort)};
  const timer=setTimeout(()=>{active=true;sheetBegin(cell,sx,sy)},320);
  const move=ev=>{ if(ev.pointerId!==id)return; if(!active){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10)stop(); } else sheetMove(ev.clientX,ev.clientY); };
  const up=ev=>{ if(ev.pointerId!==id)return; const was=active; stop(); if(was) sheetEnd(true); };
  const abort=ev=>{ if(ev.pointerId!==id)return; const was=active; stop(); if(was) sheetEnd(false); };
  document.addEventListener("pointermove",move);
  document.addEventListener("pointerup",up);
  document.addEventListener("pointercancel",abort);
}

// Impede a rolagem da tela enquanto uma categoria está sendo arrastada.
const sheetBlockTouch=e=>e.preventDefault();

// Início do arrasto: cria a "sombra" que acompanha o dedo e marca a categoria sendo movida.
function sheetBegin(cell,x,y){
  const cat=cell.dataset.cat;
  const rows=[...document.querySelectorAll("#sheetView tr[data-g]")];
  const ghost=document.createElement("div");
  ghost.className="sheet-ghost"; ghost.textContent="⠿ "+cat; document.body.appendChild(ghost);
  sheetDrag={cat,rows,ghost,target:null,x,y,raf:0};
  rows.filter(r=>r.dataset.g===cat).forEach(r=>r.classList.add("sheet-dragging"));
  document.body.classList.add("sheet-drag-on");
  document.addEventListener("touchmove",sheetBlockTouch,{passive:false});
  if(navigator.vibrate)navigator.vibrate(25);   // vibração curta avisa que pegou
  sheetMove(x,y);
  sheetLoop();
}

// Movimento do dedo/mouse: guarda a posição e leva a sombra junto.
function sheetMove(x,y){
  const d=sheetDrag; if(!d)return;
  d.x=x; d.y=y;
  d.ghost.style.left=(x+12)+"px"; d.ghost.style.top=(y-20)+"px";
}

// Grupos de linhas (uma categoria = um grupo) com a posição atual na tela.
function sheetGroups(){
  const map=new Map();
  sheetDrag.rows.forEach(r=>{ const g=r.dataset.g; if(!map.has(g))map.set(g,[]); map.get(g).push(r); });
  return [...map].map(([cat,rs])=>({cat,rows:rs,first:rs[0],last:rs[rs.length-1],top:rs[0].getBoundingClientRect().top,bottom:rs[rs.length-1].getBoundingClientRect().bottom}));
}

// Descobre onde a categoria cairia (antes/depois de qual categoria) e mostra a linha azul de destino.
function sheetUpdateTarget(){
  const d=sheetDrag; if(!d)return;
  document.querySelectorAll("#sheetView .sheet-drop-before,#sheetView .sheet-drop-after").forEach(el=>el.classList.remove("sheet-drop-before","sheet-drop-after"));
  const gs=sheetGroups(); let target=null;
  for(const g of gs){ if(d.y<=g.bottom){ target={cat:g.cat,pos:d.y<(g.top+g.bottom)/2?"before":"after",g}; break; } }
  if(!target){ const g=gs[gs.length-1]; target={cat:g.cat,pos:"after",g}; }   // abaixo da última categoria
  if(target.cat===d.cat){ d.target=null; return; }                             // soltar sobre si mesma não muda nada
  d.target=target;
  if(target.pos==="before") target.g.first.classList.add("sheet-drop-before");
  else target.g.rows.forEach(r=>r.querySelectorAll("td.sheet-cat,td.sheet-sub").forEach(td=>td.classList.add("sheet-drop-after")));
  if(target.pos==="after") target.g.last.classList.add("sheet-drop-after");
}

// Repete a cada quadro: rola a tela sozinha perto das bordas e atualiza o destino.
function sheetLoop(){
  const d=sheetDrag; if(!d)return;
  const h=window.innerHeight;
  if(d.y<80) window.scrollBy(0,-Math.ceil((80-d.y)/6));
  else if(d.y>h-80) window.scrollBy(0,Math.ceil((d.y-(h-80))/6));
  sheetUpdateTarget();
  d.raf=requestAnimationFrame(sheetLoop);
}

// Fim do arrasto: limpa a tela e, se soltou num destino válido (commit), muda a ordem das categorias.
function sheetEnd(commit){
  const d=sheetDrag; if(!d)return;
  sheetDrag=null;
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  document.removeEventListener("touchmove",sheetBlockTouch);
  document.body.classList.remove("sheet-drag-on");
  document.querySelectorAll("#sheetView .sheet-dragging,#sheetView .sheet-drop-before,#sheetView .sheet-drop-after").forEach(el=>el.classList.remove("sheet-dragging","sheet-drop-before","sheet-drop-after"));
  sheetDragMoved=true; setTimeout(()=>{sheetDragMoved=false},500);
  if(commit&&d.target) moveCategoryTo(d.cat,d.target.cat,d.target.pos);
}

// Tira a categoria do lugar atual e coloca antes ("before") ou depois ("after") da categoria de referência. As outras se ajeitam.
function moveCategoryTo(cat,ref,pos){
  const arr=data.categories, from=arr.indexOf(cat);
  if(from<0)return;
  arr.splice(from,1);
  const to=arr.indexOf(ref);
  if(to<0) arr.push(cat); else arr.splice(pos==="after"?to+1:to,0,cat);
  save();   // salva e redesenha (Resumo e aba Categorias já mostram a nova ordem)
}
