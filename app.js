const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const STORE = "bizflow-jamaica-v1";
const ACTIVE_SECTION_STORE = "bizflow-jamaica-active-section";
const ACTIVE_SECTIONS = new Set(["dashboard","customers","documents","invoices","quotations","receipts","settings"]);
const defaults = {businessName:"",email:"",phone:"",trn:"",address:"",currency:"JMD",tax:0};
let state = loadState();
let currentPreview = null;
let editingDocumentId = null;
let editingCustomer = null;

function loadState(){
  try { const saved = JSON.parse(localStorage.getItem(STORE)); return saved ? {...saved,customers:saved.customers||[]} : {settings:{...defaults},documents:[],customers:[]}; }
  catch { return {settings:{...defaults},documents:[],customers:[]}; }
}
function persist(){ localStorage.setItem(STORE, JSON.stringify(state)); renderAll(); }
function money(value){ return new Intl.NumberFormat("en-JM",{style:"currency",currency:state.settings.currency||"JMD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0); }
function dateText(value){ if(!value) return "—"; return new Date(value+"T12:00:00").toLocaleDateString("en-JM",{day:"numeric",month:"short",year:"numeric"}); }
function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function sameCustomer(a,b){
  const emailA=String(a?.email||"").trim().toLowerCase(),emailB=String(b?.email||"").trim().toLowerCase();
  if(emailA&&emailB)return emailA===emailB;
  const nameA=String(a?.name||"").trim().toLowerCase(),nameB=String(b?.name||"").trim().toLowerCase();
  return Boolean(nameA&&nameB&&nameA===nameB);
}
function activeSectionStorageKey(){
  return `${ACTIVE_SECTION_STORE}:${activeUser?activeUser.id:"guest"}`;
}
function rememberActiveSection(section){
  if(ACTIVE_SECTIONS.has(section))localStorage.setItem(activeSectionStorageKey(),section);
}
function sectionForDocumentFilter(filter){
  return ({Invoice:"invoices",Quotation:"quotations",Receipt:"receipts"})[filter]||"documents";
}
function restoreActiveSection(){
  const saved=localStorage.getItem(activeSectionStorageKey());
  const section=ACTIVE_SECTIONS.has(saved)?saved:"dashboard";
  const documentFilter=({invoices:"Invoice",quotations:"Quotation",receipts:"Receipt",documents:"All"})[section];
  if(documentFilter)$("#document-filter").value=documentFilter;
  showView(section==="invoices"||section==="quotations"||section==="receipts"||section==="documents"?"documents":section);
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function showView(name){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  $$(".nav-link[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  const filter=name==="documents"?$("#document-filter").value:"All";
  $("#breadcrumb-current").textContent=name==="documents"?({Invoice:"Invoices",Quotation:"Quotations",Receipt:"Receipts"})[filter]||"Documents":({dashboard:"Overview",customers:"Customers",settings:"Business settings",plans:"Plans"})[name]||"Overview";
  $("#sidebar").classList.remove("open");
  if(name==="documents"){
    renderDocuments();
    rememberActiveSection(sectionForDocumentFilter(filter));
  }else if(ACTIVE_SECTIONS.has(name))rememberActiveSection(name);
  if(name==="customers") renderCustomers();
}
function openModal(id){const el=$("#"+id);el.classList.add("open");el.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
function closeModal(id){const el=$("#"+id);el.classList.remove("open");el.setAttribute("aria-hidden","true");document.body.style.overflow="";}
function nextNumber(type){
  const prefix=type==="Invoice"?"INV":type==="Quotation"?"QUO":"REC";
  const count=state.documents.filter(d=>d.type===type).length+1;
  return `${prefix}-${new Date().getFullYear()}-${String(count).padStart(3,"0")}`;
}
function populateCustomerChoices(){
  const select=$("#existing-customer");
  if(!select)return;
  const unique=new Map();
  const sources=[
    ...(state.customers||[]),
    ...(state.documents||[]).map(d=>d.customer||{})
  ];
  sources.forEach(c=>{
    const email=(c.email||"").trim().toLowerCase();
    const name=(c.name||c.business_name||c.businessName||"").trim();
    if(!email&&!name)return;
    const key=email||name.toLowerCase();
    const previous=unique.get(key)||{};
    unique.set(key,{
      ...previous,...c,
      name:name||previous.name||"",
      email:(c.email||previous.email||"").trim(),
      phone:(c.phone||previous.phone||"").trim(),
      address:(c.address||previous.address||"").trim()
    });
  });
  const customers=[...unique.values()].filter(c=>c.name||c.email);
  select.innerHTML='<option value="">— Enter a new customer below —</option>'+customers.map((c,i)=>{
    const name=c.name||"Customer";
    const label=c.email?(`${name} — ${c.email}`):name;
    return `<option value="${escapeHtml(c.id||c.email||String(i))}" data-name="${escapeHtml(c.name||"")}" data-email="${escapeHtml(c.email||"")}" data-phone="${escapeHtml(c.phone||"")}" data-address="${escapeHtml(c.address||"")}">${escapeHtml(label)}</option>`;
  }).join("");
}
function fillSelectedCustomer(){
  const option=$("#existing-customer")?.selectedOptions[0];
  if(!option||!option.value)return;
  $("#customer-name").value=option.dataset.name||"";
  $("#customer-email").value=option.dataset.email||"";
  $("#customer-phone").value=option.dataset.phone||"";
  $("#customer-address").value=option.dataset.address||"";
}
function newCustomer(){
  editingCustomer=null;
  $("#customer-form").reset();
  $("#customer-modal-title").textContent="Add customer";
  $("#customer-form-submit").textContent="Save customer";
  $("#customer-form-error").textContent="";
  openModal("customer-modal");
}
function editCustomer(customer){
  editingCustomer={...customer};
  $("#customer-form").reset();
  $("#new-customer-name").value=customer.name||"";
  $("#new-customer-email").value=customer.email||"";
  $("#new-customer-phone").value=customer.phone||"";
  $("#new-customer-address").value=customer.address||"";
  $("#customer-modal-title").textContent="Edit customer";
  $("#customer-form-submit").textContent="Save changes";
  $("#customer-form-error").textContent="";
  openModal("customer-modal");
}
function saveCustomer(event){
  event.preventDefault();
  const customer={id:editingCustomer?.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now())),name:$("#new-customer-name").value.trim(),email:$("#new-customer-email").value.trim(),phone:$("#new-customer-phone").value.trim(),address:$("#new-customer-address").value.trim()};
  if(!customer.name){$("#customer-form-error").textContent="Please enter a customer name.";return;}
  const existingIndex=editingCustomer?state.customers.findIndex(c=>editingCustomer.id!=null?c.id===editingCustomer.id:sameCustomer(c,editingCustomer)):-1;
  const duplicate=editingCustomer
    ?state.customers.some((c,index)=>index!==existingIndex&&sameCustomer(c,customer))
    :state.customers.some(c=>`${c.name.toLowerCase()}|${(c.email||"").toLowerCase()}`===`${customer.name.toLowerCase()}|${(customer.email||"").toLowerCase()}`);
  if(duplicate){$("#customer-form-error").textContent=editingCustomer?"Another customer already has these details.":"This customer is already saved.";return;}
  if(editingCustomer){
    if(existingIndex<0)state.customers.unshift(customer);
    else state.customers[existingIndex]={...state.customers[existingIndex],...customer};
    state.documents.forEach(doc=>{
      if(sameCustomer(editingCustomer,doc.customer||{}))doc.customer={...doc.customer,name:customer.name,email:customer.email,phone:customer.phone,address:customer.address};
    });
  }else state.customers.unshift(customer);
  editingCustomer=null;
  persist();closeModal("customer-modal");toast("Customer saved successfully");
}
function newDocument(type="Invoice"){
  editingDocumentId = null;
  $("#document-form").reset();
  populateCustomerChoices();
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
function editDocument(id){
  const doc=state.documents.find(item=>item.id===id);
  if(!doc)return;
  editingDocumentId=id;
  $("#document-form").reset();
  populateCustomerChoices();
  $("#doc-type").value=doc.type;
  $("#doc-number").value=doc.number;
  $("#doc-date").value=doc.date||new Date().toISOString().slice(0,10);
  $("#customer-name").value=doc.customer?.name||"";
  $("#customer-email").value=doc.customer?.email||"";
  $("#customer-phone").value=doc.customer?.phone||"";
  $("#customer-address").value=doc.customer?.address||"";
  $("#doc-tax").value=doc.taxRate||0;
  $("#doc-notes").value=doc.notes||"";
  $("#form-error").textContent="";
  $("#line-items").innerHTML="";
  (doc.lines||[]).forEach(line=>addLine(line));
  if(!(doc.lines||[]).length)addLine();
  $("#modal-title").textContent=`Edit ${doc.type.toLowerCase()}`;
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
  const existing=editingDocumentId?state.documents.find(d=>d.id===editingDocumentId):null;
  const doc={id:existing?.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now())),type,number:$("#doc-number").value,date:$("#doc-date").value,customer,lines,taxRate:Number($("#doc-tax").value)||0,...t,notes:$("#doc-notes").value.trim(),createdAt:existing?.createdAt||new Date().toISOString(),business:existing?.business||{...state.settings}};
  if(existing){state.documents=state.documents.map(d=>d.id===doc.id?doc:d);}else{state.documents.unshift(doc);}
  editingDocumentId=null;persist();closeModal("document-modal");toast(`${type} ${existing?"updated":"saved"} successfully`);previewDocument(doc.id);
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
  $("#documents-table").innerHTML=docs.map(d=>`<tr><td><strong>${escapeHtml(d.number)}</strong><br><span class="muted">${escapeHtml(d.type)}</span></td><td>${escapeHtml(d.customer.name)}</td><td>${dateText(d.date)}</td><td><span class="status-pill">Saved</span></td><td class="align-right"><strong>${money(d.total)}</strong></td><td><button class="row-action" data-preview="${d.id}">View</button> <button class="row-action" data-edit="${d.id}">Edit</button> <button class="row-action" data-delete="${d.id}" style="color:#c46a62">Delete</button></td></tr>`).join("");
  $("#documents-empty").style.display=docs.length?"none":"flex";
  $$("[data-preview]",$("#documents-table")).forEach(b=>b.onclick=()=>previewDocument(b.dataset.preview));
  $$("[data-edit]",$("#documents-table")).forEach(b=>b.onclick=()=>editDocument(b.dataset.edit));
  $$("[data-delete]",$("#documents-table")).forEach(b=>b.onclick=()=>deleteDocument(b.dataset.delete));
}
function deleteDocument(id){if(!confirm("Delete this saved document? This cannot be undone."))return;state.documents=state.documents.filter(d=>d.id!==id);persist();toast("Document deleted");}
function renderCustomers(){
  if(!$("#customers-table"))return;
  const customers=[];
  (state.customers||[]).forEach(c=>{
    const matchIndex=customers.findIndex(existing=>sameCustomer(existing,c));
    if(matchIndex<0)customers.push({...c});
    else customers[matchIndex]={...customers[matchIndex],...c};
  });
  (state.documents||[]).forEach(d=>{
    const docCustomer=d.customer||{},matchIndex=customers.findIndex(c=>sameCustomer(c,docCustomer));
    if(matchIndex<0)customers.push({...docCustomer});
    else customers[matchIndex]={...docCustomer,...customers[matchIndex],name:customers[matchIndex].name||docCustomer.name,email:customers[matchIndex].email||docCustomer.email,phone:customers[matchIndex].phone||docCustomer.phone,address:customers[matchIndex].address||docCustomer.address};
  });
  const q=($("#customer-search")?.value||"").toLowerCase();
  const visibleCustomers=customers.map(c=>({...c,count:(state.documents||[]).filter(d=>sameCustomer(c,d.customer||{})).length})).filter(c=>`${c.name||""} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(q));
  $("#customers-table").innerHTML=visibleCustomers.map((c,index)=>`<tr><td><button type="button" class="row-action" data-customer-index="${index}">${escapeHtml(c.name||"")}</button> <button type="button" class="row-action" data-edit-customer-index="${index}">Edit</button></td><td>${escapeHtml(c.email||"—")}</td><td>${escapeHtml(c.phone||"—")}</td><td>${c.count}</td></tr>`).join("");
  $("#customers-empty").style.display=visibleCustomers.length?"none":"flex";
  $$("[data-customer-index]",$("#customers-table")).forEach(button=>button.onclick=()=>showCustomerDetails(visibleCustomers[Number(button.dataset.customerIndex)]));
  $$("[data-edit-customer-index]",$("#customers-table")).forEach(button=>button.onclick=()=>editCustomer(visibleCustomers[Number(button.dataset.editCustomerIndex)]));
}
function showCustomerDetails(customer){
  const docs=(state.documents||[]).filter(d=>sameCustomer(customer,d.customer||{}));
  $("#customer-details-title").textContent=customer.name||"Customer";
  const address=escapeHtml(customer.address||"—").replace(/\n/g,"<br>");
  const docsContent=docs.length
    ?`<h3>Documents</h3><div class="table-scroll"><table><thead><tr><th>NUMBER</th><th>TYPE</th><th>DATE</th><th>TOTAL</th><th></th></tr></thead><tbody>${docs.map(d=>`<tr><td>${escapeHtml(d.number||"—")}</td><td>${escapeHtml(d.type||"—")}</td><td>${escapeHtml(dateText(d.date))}</td><td>${escapeHtml(money(d.total))}</td><td><button type="button" class="row-action" data-customer-document-preview="${escapeHtml(d.id)}">View</button></td></tr>`).join("")}</tbody></table></div>`
    :"<p>No documents yet.</p>";
  $("#customer-detail-content").innerHTML=`<div class="form-grid two"><div><strong>Name</strong><p>${escapeHtml(customer.name||"—")}</p></div><div><strong>Email</strong><p>${escapeHtml(customer.email||"—")}</p></div><div><strong>Phone</strong><p>${escapeHtml(customer.phone||"—")}</p></div><div><strong>Address</strong><p>${address}</p></div></div><div class="form-section-title modal-section"><h3>Saved documents</h3></div>${docsContent}`;
  $$("[data-customer-document-preview]",$("#customer-detail-content")).forEach(button=>button.onclick=()=>{
    const id=button.dataset.customerDocumentPreview;
    closeModal("customer-details-modal");
    previewDocument(id);
  });
  openModal("customer-details-modal");
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
$("#new-document").onclick=$("#documents-new").onclick=()=>newDocument();
$("#customer-create").onclick=()=>newCustomer();
$("#customer-form").addEventListener("submit",saveCustomer);
$("#existing-customer").addEventListener("change",fillSelectedCustomer);
$("#empty-create").onclick=()=>newDocument();
$$("[data-doc]").forEach(b=>b.onclick=()=>newDocument(b.dataset.doc));
$("#add-line").onclick=()=>addLine();
$("#document-form").addEventListener("submit",saveDocument);
$("#doc-tax").addEventListener("input",updateTotals);
$("#document-search").addEventListener("input",renderDocuments);
$("#document-filter").addEventListener("change",()=>showView("documents"));
$("#customer-search").addEventListener("input",renderCustomers);
$("#settings-form").addEventListener("submit",saveSettings);
$("#print-document").onclick=()=>window.print();
$("#help-button").onclick=()=>openModal("help-modal");
$("#mobile-menu").onclick=()=>$("#sidebar").classList.toggle("open");
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
$$(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeModal(backdrop.id);}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-backdrop.open").forEach(m=>closeModal(m.id));});
const notifyProButton = $("#notify-pro");
if(notifyProButton) notifyProButton.onclick=()=>toast("Launch list sign-up will be added in a future version.");

/* Supabase cloud account and database integration */
const SUPABASE_URL = "https://dckurwexkkyjtcmbkiod.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1gUrnPchrYIjoiTIET89SQ_kd5mpoDs";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let activeUser = null;
let activeBusiness = null;
let cloudReady = false;
let authMode = "signin";
let passwordRecoveryMode = false;
let passwordRecoveryUser = null;

function authMessage(message, isError=false){
  const el = $("#auth-message");
  if(el){ el.textContent=message; el.style.color=isError?"#bd554d":"#0b887c"; }
}
function setAuthMode(mode){
  authMode=mode;
  const isRecovery=mode==="recovery";
  const isForgot=mode==="forgot";
  $("#auth-title").textContent=isRecovery?"Set New Password":isForgot?"Reset your password.":mode==="signup"?"Create your account.":"Welcome back.";
  $("#auth-copy").textContent=isRecovery?"Choose a new password for your BizFlow account.":isForgot?"Enter your registered email address to receive a recovery link.":mode==="signup"?"Create a secure BizFlow account for your business.":"Sign in to access your business documents from any device.";
  $("#auth-submit").textContent=isRecovery?"Update password":isForgot?"Send recovery email":mode==="signup"?"Create account":"Sign in";
  $("#auth-switch").hidden=isRecovery;
  $("#auth-switch").textContent=isForgot?"Back to sign in":mode==="signup"?"Already have an account? Sign in":"New to BizFlow? Create an account";
  $("#forgot-password").hidden=mode!=="signin";
  $("#auth-email-label").hidden=isRecovery;
  $("#auth-email").required=!isRecovery;
  $("#auth-password-label").hidden=isForgot;
  $("#auth-password-label").firstChild.textContent=isRecovery?"New password":"Password";
  $("#auth-password").required=!isForgot;
  $("#auth-password").autocomplete=isRecovery||mode==="signup"?"new-password":"current-password";
  $("#auth-confirm-password-label").hidden=!isRecovery;
  $("#auth-confirm-password").required=isRecovery;
  authMessage("");
}
async function ensureBusiness(){
  const {data:rows,error}=await supabaseClient.from("businesses").select("*").eq("owner_id",activeUser.id).limit(1);
  if(error) throw error;
  if(rows && rows.length){ activeBusiness=rows[0]; return activeBusiness; }
  const localName=state.settings.businessName||"My Business";
  const {data,error:insertError}=await supabaseClient.from("businesses").insert({
    owner_id:activeUser.id,business_name:localName,email:state.settings.email||activeUser.email||null,
    phone:state.settings.phone||null,address:state.settings.address||null,currency:state.settings.currency||"JMD"
  }).select().single();
  if(insertError) throw insertError;
  activeBusiness=data;
  return activeBusiness;
}
async function loadCloudState(){
  const businessId=activeBusiness.id;
  const [customersRes,docsRes,itemsRes]=await Promise.all([
    supabaseClient.from("customers").select("*").eq("business_id",businessId),
    supabaseClient.from("documents").select("*").eq("business_id",businessId).order("created_at",{ascending:false}),
    supabaseClient.from("document_items").select("*")
  ]);
  if(customersRes.error) throw customersRes.error;
  if(docsRes.error) throw docsRes.error;
  if(itemsRes.error) throw itemsRes.error;
  const customerMap=new Map(customersRes.data.map(c=>[c.id,c]));
  const itemsByDoc=new Map();
  itemsRes.data.forEach(item=>{if(!itemsByDoc.has(item.document_id))itemsByDoc.set(item.document_id,[]);itemsByDoc.get(item.document_id).push(item);});
  const cloudDocs=docsRes.data.map(d=>{
    const c=customerMap.get(d.customer_id)||{};
    const lines=(itemsByDoc.get(d.id)||[]).map(i=>({description:i.description,qty:Number(i.quantity),rate:Number(i.unit_price)}));
    return {
      id:d.id,type:d.document_type==="quotation"?"Quotation":d.document_type==="receipt"?"Receipt":"Invoice",
      number:d.document_number||"",date:d.issue_date,customer:{id:c.id,name:c.name||"Customer",email:c.email||"",phone:c.phone||"",address:c.address||""},
      lines,taxRate:Number(d.tax_rate)||0,subtotal:Number(d.subtotal)||0,tax:Number(d.tax_amount)||0,total:Number(d.total)||0,
      notes:d.notes||"",createdAt:d.created_at||new Date().toISOString(),
      business:{businessName:activeBusiness.business_name||"",email:activeBusiness.email||"",phone:activeBusiness.phone||"",address:activeBusiness.address||"",currency:activeBusiness.currency||"JMD",trn:""}
    };
  });
  state.settings={...state.settings,businessName:activeBusiness.business_name||"",email:activeBusiness.email||"",phone:activeBusiness.phone||"",address:activeBusiness.address||"",currency:activeBusiness.currency||"JMD"};
  state.documents=cloudDocs;
  state.customers=(customersRes.data||[]).map(c=>({id:c.id,name:c.name||"",email:c.email||"",phone:c.phone||"",address:c.address||""}));
}
async function syncCloudState(){
  if(!cloudReady||!activeBusiness||!activeUser)return;
  const businessId=activeBusiness.id;
  const settings=state.settings;
  const {error:businessError}=await supabaseClient.from("businesses").update({
    business_name:settings.businessName||"My Business",email:settings.email||null,
    phone:settings.phone||null,address:settings.address||null,currency:settings.currency||"JMD"
  }).eq("id",businessId);
  if(businessError) throw businessError;
  const customerRows=await supabaseClient.from("customers").select("*").eq("business_id",businessId);
  if(customerRows.error) throw customerRows.error;
  const knownCustomers=customerRows.data||[];
  for(const saved of (state.customers||[])){
    const match=knownCustomers.find(c=>c.id===saved.id)||knownCustomers.find(c=>c.name===saved.name && (c.email||"")===(saved.email||""));
    const payload={business_id:businessId,name:saved.name,email:saved.email||null,phone:saved.phone||null,address:saved.address||null};
    if(match){
      const {error}=await supabaseClient.from("customers").update(payload).eq("id",match.id);
      if(error) throw error;
      Object.assign(match,payload);
      saved.id=match.id;
    }else{
      const {data,error}=await supabaseClient.from("customers").insert(payload).select().single();
      if(error) throw error;
      saved.id=data.id;
      knownCustomers.push(data);
    }
  }
  const localDocIds=state.documents.map(d=>d.id);
  for(const doc of state.documents){
    let customer=knownCustomers.find(c=>c.id===doc.customer.id)||knownCustomers.find(c=>c.name===doc.customer.name && (c.email||"")===(doc.customer.email||""));
    const customerPayload={business_id:businessId,name:doc.customer.name,email:doc.customer.email||null,phone:doc.customer.phone||null,address:doc.customer.address||null};
    if(customer){
      const {error}=await supabaseClient.from("customers").update(customerPayload).eq("id",customer.id);
      if(error) throw error;
      Object.assign(customer,customerPayload);
    }else{
      const {data,error}=await supabaseClient.from("customers").insert(customerPayload).select().single();
      if(error) throw error;
      customer=data;knownCustomers.push(customer);
    }
    doc.customer.id=customer.id;
    const docPayload={
      id:doc.id,business_id:businessId,customer_id:customer.id,
      document_type:doc.type.toLowerCase(),document_number:doc.number||null,issue_date:doc.date||null,
      status:"draft",subtotal:doc.subtotal||0,tax_rate:doc.taxRate||0,tax_amount:doc.tax||0,total:doc.total||0,notes:doc.notes||null
    };
    const {error:docError}=await supabaseClient.from("documents").upsert(docPayload);
    if(docError) throw docError;
    const {error:deleteItemsError}=await supabaseClient.from("document_items").delete().eq("document_id",doc.id);
    if(deleteItemsError) throw deleteItemsError;
    if(doc.lines.length){
      const itemPayload=doc.lines.map(line=>({document_id:doc.id,description:line.description,quantity:line.qty,unit_price:line.rate,amount:line.qty*line.rate}));
      const {error:itemError}=await supabaseClient.from("document_items").insert(itemPayload);
      if(itemError) throw itemError;
    }
  }
  const {data:remoteDocs,error:remoteError}=await supabaseClient.from("documents").select("id").eq("business_id",businessId);
  if(remoteError) throw remoteError;
  const removed=(remoteDocs||[]).map(d=>d.id).filter(id=>!localDocIds.includes(id));
  if(removed.length){
    const {error}=await supabaseClient.from("documents").delete().in("id",removed);
    if(error) throw error;
  }
  localStorage.setItem(STORE,JSON.stringify(state));
}
const localPersist = persist;
persist = function(){
  localPersist();
  syncCloudState().then(()=>toast("Saved securely to your BizFlow account")).catch(error=>{
    console.error("BizFlow cloud save:",error);
    toast("Saved on this device; cloud sync needs attention");
  });
};
async function enterWorkspace(user){
  activeUser=user;
  cloudReady=false;
  const localBackup=JSON.parse(JSON.stringify(state));
  try{
    activeBusiness=await ensureBusiness();
    await loadCloudState();
    // Preserve existing browser-only documents when the new cloud account is empty.
    if(state.documents.length===0 && localBackup.documents.length>0){
      state=localBackup;
      await syncCloudState();
    }
    cloudReady=true;
    document.body.classList.add("authenticated");
    $("#profile-name").textContent=state.settings.businessName||user.email||"Your business";
    loadSettings();
    renderAll();
    restoreActiveSection();
  }catch(error){
    console.error("BizFlow setup:",error);
    authMessage("We couldn't load your business data: "+(error.message||"Please check your Supabase tables and policies."),true);
    document.body.classList.remove("authenticated");
  }
}
async function handleAuthSubmit(event){
  event.preventDefault();
  const email=$("#auth-email").value.trim();
  if(authMode==="forgot"&&(!email||!$("#auth-email").checkValidity())){
    authMessage("Enter a valid email address.",true);
    return;
  }
  if(authMode==="recovery"&&$("#auth-password").value!==$("#auth-confirm-password").value){
    authMessage("The passwords do not match.",true);
    return;
  }
  const password=$("#auth-password").value;
  $("#auth-submit").disabled=true;
  authMessage(authMode==="recovery"?"Updating your password…":authMode==="forgot"?"Sending recovery email…":authMode==="signup"?"Creating your account…":"Signing in…");
  try{
    if(authMode==="forgot"){
      const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:"https://bizflowja.pages.dev/"});
      if(error) throw error;
      authMessage("Password recovery email sent. Check your inbox.");
    }else if(authMode==="recovery"){
      const {data,error}=await supabaseClient.auth.updateUser({password});
      if(error) throw error;
      passwordRecoveryMode=false;
      $("#auth-form").reset();
      const user=data.user||passwordRecoveryUser;
      setAuthMode("signin");
      if(user){
        $("#auth-email").value=user.email||"";
        authMessage("Password updated successfully.");
        await enterWorkspace(user);
      }else authMessage("Password updated successfully. Sign in with your new password.");
      toast("Password updated successfully.");
    }else if(authMode==="signup"){
      const {data,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:"https://rush2348.github.io/bizflow-jamaica/"}});
      if(error) throw error;
      if(data.session) await enterWorkspace(data.user);
      else authMessage("Account created. Check your email to confirm, then return here and sign in.");
    }else{
      const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
      if(error) throw error;
      await enterWorkspace(data.user);
    }
  }catch(error){authMessage(error.message||"Something went wrong. Please try again.",true);}
  finally{$("#auth-submit").disabled=false;}
}
async function initAuth(){
  if(SUPABASE_PUBLISHABLE_KEY==="PASTE_SUPABASE_PUBLISHABLE_KEY_HERE"){authMessage("Add your Supabase publishable key to finish connecting BizFlow.",true);return;}
  $("#auth-form").addEventListener("submit",handleAuthSubmit);
  $("#auth-switch").addEventListener("click",()=>setAuthMode(authMode==="signin"?"signup":"signin"));
  $("#forgot-password").addEventListener("click",()=>setAuthMode("forgot"));
  if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery"){
    passwordRecoveryMode=true;
    setAuthMode("recovery");
  }
  supabaseClient.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){
      passwordRecoveryMode=true;
      passwordRecoveryUser=session?.user||null;
      setAuthMode("recovery");
    }
  });
  $("#signout-button").addEventListener("click",async()=>{
    cloudReady=false;
    const {error}=await supabaseClient.auth.signOut();
    if(error){toast("Could not sign out: "+error.message);return;}
    activeUser=null;activeBusiness=null;document.body.classList.remove("authenticated");setAuthMode("signin");
  });
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){authMessage(error.message,true);return;}
  await new Promise(resolve=>setTimeout(resolve,0));
  if(passwordRecoveryMode){
    passwordRecoveryUser=passwordRecoveryUser||data.session?.user||null;
    return;
  }
  if(data.session) await enterWorkspace(data.session.user);
  else setAuthMode("signin");
}

initAuth();
