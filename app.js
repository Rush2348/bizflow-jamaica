const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const STORE = "bizflow-jamaica-v1";
const defaults = {businessName:"",email:"",phone:"",trn:"",address:"",currency:"JMD",tax:0};
let state = loadState();
let currentPreview = null;

function loadState(){
  try { const saved = JSON.parse(localStorage.getItem(STORE)); return saved || {settings:{...defaults},documents:[]}; }
  catch { return {settings:{...defaults},documents:[]}; }
}
function persist(){ localStorage.setItem(STORE, JSON.stringify(state)); renderAll(); }
function money(value){ return new Intl.NumberFormat("en-JM",{style:"currency",currency:state.settings.currency||"JMD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0); }
function dateText(value){ if(!value) return "—"; return new Date(value+"T12:00:00").toLocaleDateString("en-JM",{day:"numeric",month:"short",year:"numeric"}); }
function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function showView(name){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  $$(".nav-link[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("#breadcrumb-current").textContent=({dashboard:"Overview",documents:"Documents",customers:"Customers",settings:"Business settings",plans:"Plans"})[name]||"Overview";
  $("#sidebar").classList.remove("open");
  if(name==="documents") renderDocuments();
  if(name==="customers") renderCustomers();
}
function openModal(id){const el=$("#"+id);el.classList.add("open");el.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
function closeModal(id){const el=$("#"+id);el.classList.remove("open");el.setAttribute("aria-hidden","true");document.body.style.overflow="";}
function nextNumber(type){
  const prefix=type==="Invoice"?"INV":type==="Quotation"?"QUO":"REC";
  const count=state.documents.filter(d=>d.type===type).length+1;
  return `${prefix}-${new Date().getFullYear()}-${String(count).padStart(3,"0")}`;
}
function newDocument(type="Invoice"){
  $("#document-form").reset();
  $("#doc-type").value=type;
  $("#doc-number").value=nextNumber(type);
  $("#doc-date").value=new Date().toISOString().slice(0,10);
  $("#doc-tax").value=state.settings.tax||0;
  $("#form-error").textContent="";
  $("#line-items").innerHTML="";
  addLine();
  $("#modal-title").textContent=`Create ${type.toLowerCase()}`;
  openModal("document-modal");
}
function addLine(item={description:"",qty:1,rate:0}){
  const row=document.createElement("div");row.className="line-row";
  row.innerHTML=`<input class="item-description" aria-label="Item description" placeholder="Product or service" value="${escapeHtml(item.description)}"><input class="item-qty" aria-label="Quantity" type="number" min="0.01" step="0.01" value="${item.qty}"><input class="item-rate" aria-label="Rate" type="number" min="0" step="0.01" value="${item.rate}"><span class="line-amount">${money((Number(item.qty)||0)*(Number(item.rate)||0))}</span><button type="button" class="remove-line" aria-label="Remove item">×</button>`;
  $("#line-items").append(row);
  row.addEventListener("input",updateTotals);
  $(".remove-line",row).addEventListener("click",()=>{if($$(".line-row").length===1){$(".item-description",row).value="";$(".item-qty",row).value=1;$(".item-rate",row).value=0;}else row.remove();updateTotals();});
  updateTotals();
}
function collectLines(){
  return $$(".line-row").map(row=>({description:$(".item-description",row).value.trim(),qty:Number($(".item-qty",row).value)||0,rate:Number($(".item-rate",row).value)||0})).filter(x=>x.description||x.rate);
}
function totals(lines,taxRate){
  const subtotal=lines.reduce((sum,l)=>sum+l.qty*l.rate,0),tax=subtotal*(Math.max(0,Number(taxRate)||0)/100);
  return {subtotal,tax,total:subtotal+tax};
}
function updateTotals(){
  const lines=collectLines(),t=totals(lines,$("#doc-tax").value);
  $$(".line-row").forEach((row,i)=>{$(".line-amount",row).textContent=money((Number($(".item-qty",row).value)||0)*(Number($(".item-rate",row).value)||0));});
  $("#subtotal").textContent=money(t.subtotal);$("#tax-amount").textContent=money(t.tax);$("#grand-total").textContent=money(t.total);
}
function saveDocument(event){
  event.preventDefault();
  const customer={name:$("#customer-name").value.trim(),email:$("#customer-email").value.trim(),phone:$("#customer-phone").value.trim(),address:$("#customer-address").value.trim()};
  const lines=collectLines(),type=$("#doc-type").value,t=totals(lines,$("#doc-tax").value);
  if(!customer.name){$("#form-error").textContent="Please enter the customer or business name.";return;}
  if(!lines.length||lines.some(l=>!l.description||l.qty<=0||l.rate<0)){ $("#form-error").textContent="Add at least one complete item with a description and valid quantity.";return;}
  const doc={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type,number:$("#doc-number").value,date:$("#doc-date").value,customer,lines,taxRate:Number($("#doc-tax").value)||0,...t,notes:$("#doc-notes").value.trim(),createdAt:new Date().toISOString(),business:{...state.settings}};
  state.documents.unshift(doc);persist();closeModal("document-modal");toast(`${type} saved successfully`);previewDocument(doc.id);
}
function renderAll(){renderDashboard();renderDocuments();renderCustomers();$("#profile-name").textContent=state.settings.businessName||"Your business";}
function renderDashboard(){
  const docs=state.documents;
  $("#stat-docs").textContent=docs.length;
  $("#stat-invoices").textContent=docs.filter(d=>d.type==="Invoice").length;
  $("#stat-quotes").textContent=docs.filter(d=>d.type==="Quotation").length;
  $("#stat-value").textContent=money(docs.filter(d=>d.type==="Invoice").reduce((s,d)=>s+d.total,0));
  const recent=docs.slice(0,5);
  const el=$("#recent-list");
  if(!recent.length){el.className="document-list empty-state";el.innerHTML='<div class="empty-illustration">▤</div><strong>No documents yet</strong><p>Create your first invoice, quote or receipt to get started.</p><button class="button secondary small" id="empty-create">Create first document</button>';$("#empty-create").onclick=()=>newDocument();return;}
  el.className="document-list";
  el.innerHTML=recent.map(d=>`<div class="doc-row"><span class="doc-type-icon">${d.type==="Invoice"?"↗":d.type==="Quotation"?"☷":"✓"}</span><div class="doc-row-main"><strong>${escapeHtml(d.number)} · ${escapeHtml(d.customer.name)}</strong><small>${escapeHtml(d.type)} · ${dateText(d.date)}</small></div><span class="doc-row-total">${money(d.total)}</span><button class="row-action" data-preview="${d.id}">View</button></div>`).join("");
  $$("[data-preview]",el).forEach(b=>b.onclick=()=>previewDocument(b.dataset.preview));
}
function renderDocuments(){
  if(!$("#documents-table"))return;
  const q=($("#document-search")?.value||"").toLowerCase(),filter=$("#document-filter")?.value||"All";
  const docs=state.documents.filter(d=>(filter==="All"||d.type===filter)&&(`${d.number} ${d.customer.name} ${d.type}`).toLowerCase().includes(q));
  $("#documents-table").innerHTML=docs.map(d=>`<tr><td><strong>${escapeHtml(d.number)}</strong><br><span class="muted">${escapeHtml(d.type)}</span></td><td>${escapeHtml(d.customer.name)}</td><td>${dateText(d.date)}</td><td><span class="status-pill">Saved</span></td><td class="align-right"><strong>${money(d.total)}</strong></td><td><button class="row-action" data-preview="${d.id}">View</button> <button class="row-action" data-delete="${d.id}" style="color:#c46a62">Delete</button></td></tr>`).join("");
  $("#documents-empty").style.display=docs.length?"none":"flex";
  $$("[data-preview]",$("#documents-table")).forEach(b=>b.onclick=()=>previewDocument(b.dataset.preview));
  $$("[data-delete]",$("#documents-table")).forEach(b=>b.onclick=()=>deleteDocument(b.dataset.delete));
}
function deleteDocument(id){if(!confirm("Delete this saved document? This cannot be undone."))return;state.documents=state.documents.filter(d=>d.id!==id);persist();toast("Document deleted");}
function renderCustomers(){
  if(!$("#customers-table"))return;
  const map=new Map();
  state.documents.forEach(d=>{const key=d.customer.email||d.customer.name.toLowerCase();if(!map.has(key))map.set(key,{...d.customer,count:0});map.get(key).count++;});
  const q=($("#customer-search")?.value||"").toLowerCase();
  const customers=[...map.values()].filter(c=>`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q));
  $("#customers-table").innerHTML=customers.map(c=>`<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${escapeHtml(c.email||"—")}</td><td>${escapeHtml(c.phone||"—")}</td><td>${c.count}</td></tr>`).join("");
  $("#customers-empty").style.display=customers.length?"none":"flex";
}
function previewDocument(id){
  const d=state.documents.find(x=>x.id===id);if(!d)return;currentPreview=d;
  $("#preview-title").textContent=`${d.type} · ${d.number}`;
  const b=d.business||state.settings;
  const businessName=b.businessName||"Your business";
  const address=(b.address||"").replace(/\n/g,"<br>");
  const customerAddress=(d.customer.address||"").replace(/\n/g,"<br>");
  $("#print-area").innerHTML=`<div class="paper-head"><div class="paper-brand"><h2>${escapeHtml(businessName)}</h2><p>${escapeHtml(address)}</p><p>${escapeHtml(b.email||"")}${b.phone?" · "+escapeHtml(b.phone):""}</p>${b.trn?`<p>TRN: ${escapeHtml(b.trn)}</p>`:""}</div><div class="paper-meta"><h3>${escapeHtml(d.type)}</h3><p><strong>${escapeHtml(d.number)}</strong></p><p>Date: ${dateText(d.date)}</p></div></div><div class="paper-customer"><small>${d.type==="Receipt"?"RECEIVED FROM":"PREPARED FOR"}</small><strong>${escapeHtml(d.customer.name)}</strong><p>${escapeHtml(d.customer.email||"")}</p><p>${escapeHtml(d.customer.phone||"")}</p><p>${customerAddress}</p></div><table class="paper-items"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>RATE</th><th class="align-right">AMOUNT</th></tr></thead><tbody>${d.lines.map(l=>`<tr><td>${escapeHtml(l.description)}</td><td>${l.qty}</td><td>${money(l.rate)}</td><td class="align-right">${money(l.qty*l.rate)}</td></tr>`).join("")}</tbody></table><div class="paper-totals"><div><span>Subtotal</span><strong>${money(d.subtotal)}</strong></div><div><span>Tax (${d.taxRate}%)</span><strong>${money(d.tax)}</strong></div><div class="paper-grand"><span>Total</span><strong>${money(d.total)}</strong></div></div>${d.notes?`<div class="paper-notes"><strong>Notes</strong><br>${escapeHtml(d.notes)}</div>`:""}<div class="paper-thanks">${d.type==="Receipt"?"Thank you. Payment received.":"Thank you for your business."}</div>`;
  openModal("preview-modal");
}
function loadSettings(){
  const s=state.settings;
  $("#business-name").value=s.businessName||"";$("#business-email").value=s.email||"";$("#business-phone").value=s.phone||"";$("#business-trn").value=s.trn||"";$("#business-address").value=s.address||"";$("#business-currency").value=s.currency||"JMD";$("#business-tax").value=s.tax??0;
}
function saveSettings(e){
  e.preventDefault();
  state.settings={businessName:$("#business-name").value.trim(),email:$("#business-email").value.trim(),phone:$("#business-phone").value.trim(),trn:$("#business-trn").value.trim(),address:$("#business-address").value.trim(),currency:$("#business-currency").value,tax:Number($("#business-tax").value)||0};
  persist();$("#settings-message").textContent="Business details saved.";setTimeout(()=>$("#settings-message").textContent="",3000);toast("Business profile updated");
}

$$(".nav-link[data-view], [data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("#new-document").onclick=$("#documents-new").onclick=$("#customer-create").onclick=()=>newDocument();
$("#empty-create").onclick=()=>newDocument();
$$("[data-doc]").forEach(b=>b.onclick=()=>newDocument(b.dataset.doc));
$("#add-line").onclick=()=>addLine();
$("#document-form").addEventListener("submit",saveDocument);
$("#doc-tax").addEventListener("input",updateTotals);
$("#document-search").addEventListener("input",renderDocuments);
$("#document-filter").addEventListener("change",renderDocuments);
$("#customer-search").addEventListener("input",renderCustomers);
$("#settings-form").addEventListener("submit",saveSettings);
$("#print-document").onclick=()=>window.print();
$("#help-button").onclick=()=>openModal("help-modal");
$("#mobile-menu").onclick=()=>$("#sidebar").classList.toggle("open");
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
$$(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeModal(backdrop.id);}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-backdrop.open").forEach(m=>closeModal(m.id));});
$("#notify-pro").onclick=()=>toast("Launch list sign-up will be added in a future version.");
loadSettings();renderAll();
