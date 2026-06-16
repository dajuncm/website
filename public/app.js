

const S = {
  products  : [],
  cart      : JSON.parse(localStorage.getItem("nx_cart") || "[]"),
  user      : JSON.parse(localStorage.getItem("nx_user") || "null"),
  filters   : { category:"all", minPrice:0, maxPrice:1100, minRating:0, inStock:false, sort:"popularity", search:"" },
  aiWorking : false,
  currentView: "shop",
};

const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};


async function init() {
  document.documentElement.dataset.theme = localStorage.getItem("nx_theme") || "dark";
  renderAuthUI();
  await loadCategories();
  await loadProducts();
  initRangeSlider();
  bindEvents();
  renderCart();
}

function getUsers() {
  return JSON.parse(localStorage.getItem("nx_users") || "[]");
}
function saveUsers(users) {
  localStorage.setItem("nx_users", JSON.stringify(users));
}

function hashPass(pass) {
  let h = 0;
  for (let i = 0; i < pass.length; i++) {
    h = Math.imul(31, h) + pass.charCodeAt(i) | 0;
  }
  return h.toString(16);
}

function renderAuthUI() {
  if (S.user) {
    $("authBtns").style.display = "none";
    $("userChip").style.display = "flex";
    $("chipAvatar").textContent = S.user.name[0].toUpperCase();
    $("chipName").textContent   = S.user.name;
  } else {
    $("authBtns").style.display = "flex";
    $("userChip").style.display = "none";
  }
}

function doRegister() {
  clearErr("regErr");
  const name  = $("regName").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const pass  = $("regPass").value;

  if (!name || !email || !pass)    return showErr("regErr", "Please fill in all fields");
  if (pass.length < 6)             return showErr("regErr", "Password must be at least 6 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr("regErr", "Please enter a valid email");

  const users = getUsers();
  if (users.find(u => u.email === email)) return showErr("regErr", "An account with this email already exists");

  const user = { id: Date.now(), name, email, password: hashPass(pass), created: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  loginUser({ id: user.id, name: user.name, email: user.email });
  closeModal("registerModal");
  $("regName").value = $("regEmail").value = $("regPass").value = "";
  toast(`Welcome to MaNar, ${name}! 🎉`);
}

function doLogin() {
  clearErr("loginErr");
  const email = $("loginEmail").value.trim().toLowerCase();
  const pass  = $("loginPass").value;

  if (!email || !pass) return showErr("loginErr", "Please fill in all fields");

  const users = getUsers();
  const user  = users.find(u => u.email === email && u.password === hashPass(pass));
  if (!user) return showErr("loginErr", "Invalid email or password");

  loginUser({ id: user.id, name: user.name, email: user.email });
  closeModal("loginModal");
  $("loginEmail").value = $("loginPass").value = "";
  toast(`Welcome back, ${user.name}! 👋`);
}

function loginUser(user) {
  S.user = user;
  localStorage.setItem("nx_user", JSON.stringify(user));
  renderAuthUI();
}

function logout() {
  S.user = null;
  localStorage.removeItem("nx_user");
  renderAuthUI();
  toast("You have been signed out");
}

function openModal(id)  { $(id).style.display = "grid"; document.body.style.overflow = "hidden"; }
function closeModal(id) { $(id).style.display = "none";  document.body.style.overflow = "";       }
function showErr(id, msg){ const e=$(id); e.textContent=msg; e.classList.add("show"); }
function clearErr(id)    { const e=$(id); e.textContent=""; e.classList.remove("show"); }


async function loadCategories() {
  const d = await fetch("/api/categories").then(r=>r.json()).catch(()=>({categories:[]}));
  const list = $("categoryList");
  list.innerHTML = `<button class="cat-btn active" data-cat="all">All</button>`;
  d.categories.forEach(c => {
    const b = el("button","cat-btn"); b.dataset.cat = c; b.textContent = c;
    list.appendChild(b);
  });
  list.addEventListener("click", e => {
    const b = e.target.closest(".cat-btn"); if (!b) return;
    list.querySelectorAll(".cat-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    S.filters.category = b.dataset.cat;
    loadProducts();
  });
}

async function loadProducts() {
  const f = S.filters;
  const p = new URLSearchParams();
  if (f.category !== "all") p.set("category", f.category);
  if (f.minPrice > 0)       p.set("minPrice", f.minPrice);
  if (f.maxPrice < 1100)    p.set("maxPrice", f.maxPrice);
  if (f.minRating > 0)      p.set("minRating", f.minRating);
  if (f.inStock)            p.set("inStock", "true");
  p.set("sort", f.sort);
  const d = await fetch("/api/products?"+p).then(r=>r.json()).catch(()=>({products:[],total:0}));
  S.products = d.products;
  renderProducts(d.products);
}

function starsHtml(r) {
  return "★".repeat(Math.floor(r)) + (r%1>=.5?"½":"") + "☆".repeat(5-Math.floor(r)-(r%1>=.5?1:0));
}

function renderProducts(list) {
  const grid  = $("productGrid");
  const empty = $("emptyState");
  const count = $("productCount");
  if (S.filters.search.trim()) {
    const q = S.filters.search.toLowerCase();
    list = list.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tags.some(t=>t.includes(q)));
  }
  if (!list.length) { grid.innerHTML=""; empty.style.display="block"; count.textContent="0 products"; return; }
  empty.style.display = "none";
  count.textContent   = `${list.length} product${list.length!==1?"s":""}`;
  grid.innerHTML = list.map((p,i) => {
    const disc = p.originalPrice>p.price ? Math.round((1-p.price/p.originalPrice)*100) : 0;
    return `
    <article class="pcard" data-id="${p.id}" style="animation-delay:${Math.min(i,20)*0.03}s">
      <div class="pcard-img-wrap">
        <img class="pcard-img" src="${p.image}" alt="${p.title}" loading="lazy"/>
        ${disc ? `<span class="pcard-badge badge-sale">-${disc}%</span>` : ""}
        ${!p.inStock ? `<span class="pcard-badge badge-oos">Out of stock</span>` : ""}
        ${p.inStock  ? `<button class="pcard-qa" data-id="${p.id}">+ Add to cart</button>` : ""}
      </div>
      <div class="pcard-body">
        <p class="pcard-cat">${p.category}</p>
        <h3 class="pcard-title">${p.title}</h3>
        <div class="pcard-rating">
          <span class="pcard-stars">${starsHtml(p.rating)}</span>
          <span class="pcard-rev">${p.rating} (${p.reviews.toLocaleString()})</span>
        </div>
        <div class="pcard-price-row">
          <span class="pcard-price">$${p.price.toFixed(2)}</span>
          ${p.originalPrice>p.price?`<span class="pcard-orig">$${p.originalPrice.toFixed(2)}</span>`:""}
          ${disc?`<span class="pcard-save">-${disc}%</span>`:""}
        </div>
        ${!p.inStock?`<span class="pcard-oos">⚠ Out of stock</span>`:""}
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".pcard-qa").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      addToCart(+b.dataset.id);
      b.textContent = "✓ Added!"; b.style.background="var(--green)";
      setTimeout(()=>{ b.textContent="+ Add to cart"; b.style.background=""; }, 1200);
    });
  });
  grid.querySelectorAll(".pcard").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".pcard-qa")) return;
      openDetailPage(+card.dataset.id);
    });
  });
}

async function openDetailPage(id) {
  const res = await fetch(`/api/products/${id}`).then(r=>r.json()).catch(()=>null);
  if (!res) return;
  const { product: p, related } = res;
  const disc = p.originalPrice>p.price ? Math.round((1-p.price/p.originalPrice)*100) : 0;
  const specsHtml = p.specs
    ? Object.entries(p.specs).map(([k,v])=>`<div class="spec-row"><span class="spec-key">${k}</span><span class="spec-val">${v}</span></div>`).join("")
    : "";
  const relatedHtml = related.length ? `
    <div class="detail-related">
      <h2 class="related-title">Related Products</h2>
      <div class="related-grid">${related.map(r=>{
        const rd = r.originalPrice>r.price?Math.round((1-r.price/r.originalPrice)*100):0;
        return `<article class="pcard" data-id="${r.id}">
          <div class="pcard-img-wrap">
            <img class="pcard-img" src="${r.image}" alt="${r.title}" loading="lazy"/>
            ${rd?`<span class="pcard-badge badge-sale">-${rd}%</span>`:""}
          </div>
          <div class="pcard-body">
            <p class="pcard-cat">${r.category}</p>
            <h3 class="pcard-title">${r.title}</h3>
            <div class="pcard-price-row">
              <span class="pcard-price">$${r.price.toFixed(2)}</span>
              ${r.originalPrice>r.price?`<span class="pcard-orig">$${r.originalPrice.toFixed(2)}</span>`:""}
            </div>
          </div>
        </article>`;
      }).join("")}</div>
    </div>` : "";

  $("detailContainer").innerHTML = `
    <button class="detail-back" id="detailBack">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      Back to Shop
    </button>
    <div class="detail-grid">
      <div class="detail-img-wrap">
        <img class="detail-img" src="${p.image}" alt="${p.title}"/>
        ${disc?`<div class="detail-badge">-${disc}% OFF</div>`:""}
      </div>
      <div class="detail-info">
        <p class="detail-cat">${p.category}</p>
        <h1 class="detail-title">${p.title}</h1>
        <div class="detail-rating">
          <span class="detail-stars">${starsHtml(p.rating)}</span>
          <span class="detail-rnum">${p.rating} · ${p.reviews.toLocaleString()} reviews</span>
        </div>
        <div class="detail-price-row">
          <span class="detail-price">$${p.price.toFixed(2)}</span>
          ${p.originalPrice>p.price?`<span class="detail-orig">$${p.originalPrice.toFixed(2)}</span>`:""}
          ${disc?`<span class="detail-save">Save ${disc}%</span>`:""}
        </div>
        <p class="detail-desc">${p.description}</p>
        <div class="detail-stock">
          <span class="stock-dot${p.inStock?"":" out"}"></span>
          ${p.inStock?"In Stock — Ready to ship":"Out of Stock"}
        </div>
        <div class="detail-actions">
          <button class="btn-add-cart" id="detailAddCart" ${!p.inStock?"disabled":""} data-id="${p.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            ${p.inStock?"Add to Cart":"Out of Stock"}
          </button>
        </div>
        ${specsHtml?`<div class="detail-specs"><p class="detail-specs-title">Specifications</p>${specsHtml}</div>`:""}
      </div>
    </div>
    ${relatedHtml}`;

  $("detailBack").addEventListener("click", ()=>switchView("shop"));
  const addBtn = $("detailAddCart");
  if (addBtn && p.inStock) {
    addBtn.addEventListener("click", ()=>{
      addToCart(p.id);
      addBtn.textContent="✓ Added to Cart!";
      addBtn.style.background="linear-gradient(135deg,var(--green),#00d980)";
      setTimeout(()=>{ addBtn.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> Add to Cart`; addBtn.style.background=""; },2000);
    });
  }
  document.querySelectorAll(".related-grid .pcard").forEach(card=>{
    card.addEventListener("click",()=>openDetailPage(+card.dataset.id));
  });
  switchView("detail");
  window.scrollTo({top:0,behavior:"smooth"});
}


function switchView(v) {
  S.currentView = v;
  $("shopView").style.display   = v==="shop"   ? "" : "none";
  $("detailView").style.display = v==="detail"  ? "" : "none";
  $("aiView").style.display     = v==="ai"      ? "" : "none";
  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.view===v || (v==="detail" && b.dataset.view==="shop")));
}

function clearFilters() {
  S.filters = {category:"all",minPrice:0,maxPrice:1100,minRating:0,inStock:false,sort:S.filters.sort,search:""};
  document.querySelectorAll(".cat-btn").forEach(b=>b.classList.toggle("active",b.dataset.cat==="all"));
  $("rangeMin").value=0; $("rangeMax").value=1100; initRangeSlider();
  $("inStockOnly").checked=false;
  document.querySelectorAll(".star-btn").forEach(b=>b.classList.toggle("active",b.dataset.r==="0"));
  $("shopSearch").value="";
  loadProducts();
}

function initRangeSlider() {
  const mn=$("rangeMin"), mx=$("rangeMax"), fill=$("rangeFill");
  function upd(){
    const lo=+mn.value, hi=+mx.value;
    fill.style.left=(lo/1100*100)+"%";
    fill.style.width=((hi-lo)/1100*100)+"%";
    $("priceMin").textContent=`$${lo}`;
    $("priceMax").textContent=`$${hi}`;
  }
  mn.addEventListener("input",()=>{ if(+mn.value>+mx.value-20) mn.value=+mx.value-20; S.filters.minPrice=+mn.value; upd(); loadProducts(); });
  mx.addEventListener("input",()=>{ if(+mx.value<+mn.value+20) mx.value=+mn.value+20; S.filters.maxPrice=+mx.value; upd(); loadProducts(); });
  upd();
}

function addToCart(id) {
  const p = S.products.find(x=>x.id===id);
  if (!p||!p.inStock) return;
  const ex = S.cart.find(x=>x.id===id);
  if (ex) ex.qty++;
  else S.cart.push({id:p.id,title:p.title,price:p.price,image:p.image,category:p.category,qty:1});
  localStorage.setItem("nx_cart",JSON.stringify(S.cart));
  renderCart(); openDrawer();
}
function removeFromCart(id){ S.cart=S.cart.filter(x=>x.id!==id); localStorage.setItem("nx_cart",JSON.stringify(S.cart)); renderCart(); }
function changeQty(id,d){
  const item=S.cart.find(x=>x.id===id); if(!item) return;
  item.qty+=d;
  if(item.qty<=0) S.cart=S.cart.filter(x=>x.id!==id);
  localStorage.setItem("nx_cart",JSON.stringify(S.cart)); renderCart();
}
function renderCart(){
  const total=S.cart.reduce((s,i)=>s+i.qty,0);
  const badge=$("cartCount");
  badge.textContent=total; badge.classList.toggle("show",total>0);
  const body=$("cartItems");
  body.querySelectorAll(".cart-item").forEach(e=>e.remove());
  if(!S.cart.length){ $("cartEmpty").style.display=""; $("cartFooter").style.display="none"; return; }
  $("cartEmpty").style.display="none"; $("cartFooter").style.display="block";
  S.cart.forEach(item=>{
    const d=el("div","cart-item");
    d.innerHTML=`
      <img class="ci-img" src="${item.image}" alt="${item.title}"/>
      <div class="ci-info">
        <p class="ci-name">${item.title}</p>
        <p class="ci-cat">${item.category}</p>
        <div class="ci-foot">
          <div class="qty-ctrl">
            <button class="qty-btn" data-id="${item.id}" data-d="-1">−</button>
            <span class="qty-n">${item.qty}</span>
            <button class="qty-btn" data-id="${item.id}" data-d="1">+</button>
          </div>
          <span class="ci-price">$${(item.price*item.qty).toFixed(2)}</span>
          <button class="ci-remove" data-id="${item.id}">✕</button>
        </div>
      </div>`;
    body.appendChild(d);
  });
  body.querySelectorAll(".qty-btn").forEach(b=>b.addEventListener("click",()=>changeQty(+b.dataset.id,+b.dataset.d)));
  body.querySelectorAll(".ci-remove").forEach(b=>b.addEventListener("click",()=>removeFromCart(+b.dataset.id)));
  const sub=S.cart.reduce((s,i)=>s+i.price*i.qty,0);
  $("cartSubtotal").textContent=$("cartTotal").textContent=`$${sub.toFixed(2)}`;
}
function openDrawer(){ $("cartDrawer").classList.add("open"); $("cartOverlay").classList.add("open"); document.body.style.overflow="hidden"; }
function closeDrawer(){ $("cartDrawer").classList.remove("open"); $("cartOverlay").classList.remove("open"); document.body.style.overflow=""; }


async function aiSearch(query){
  if(S.aiWorking) return;
  S.aiWorking=true; $("aiSendBtn").disabled=true;
  appendUserMsg(query);
  const thinking=appendThinking();
  try{
    const r=await fetch("/api/search/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query})});
    const d=await r.json();
    thinking.remove();
    r.ok ? appendBotResults(d.intentSummary,d.results) : appendBotMsg("Sorry, something went wrong.");
  }catch{ thinking.remove(); appendBotMsg("Network error. Please try again."); }
  finally{ S.aiWorking=false; $("aiSendBtn").disabled=false; }
}
function appendUserMsg(text){
  const d=el("div","msg user"); d.innerHTML=`<div class="user-bubble">${esc(text)}</div>`;
  $("aiMessages").appendChild(d); scrollChat();
}
function appendBotMsg(text){
  const d=el("div","msg bot"); d.innerHTML=`<div class="bot-ava">✦</div><div class="bot-bubble"><p>${esc(text)}</p></div>`;
  $("aiMessages").appendChild(d); scrollChat();
}
function appendThinking(){
  const d=el("div","msg bot");
  d.innerHTML=`<div class="bot-ava">✦</div><div class="bot-bubble" style="display:flex;gap:5px;align-items:center;padding:16px 18px"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  $("aiMessages").appendChild(d); scrollChat(); return d;
}
function appendBotResults(summary,results){
  const d=el("div","msg bot");
  if(!results?.length){
    d.innerHTML=`<div class="bot-ava">✦</div><div class="bot-bubble"><p>No products found. Try rephrasing — e.g. "wireless headphones for running".</p></div>`;
  } else {
    const cards=results.map(p=>`
      <div class="ai-card" data-id="${p.id}">
        <img src="${p.image}" alt="${p.title}" loading="lazy"/>
        <div class="ai-card-body">
          <p class="ai-card-cat">${p.category}</p>
          <p class="ai-card-name">${p.title}</p>
          <p class="ai-card-price">$${p.price.toFixed(2)}</p>
          ${p.inStock?`<button class="ai-add-btn" data-id="${p.id}">+ Add to Cart</button>`:`<button class="ai-add-btn" disabled style="opacity:.35;cursor:not-allowed">Out of Stock</button>`}
        </div>
      </div>`).join("");
    d.innerHTML=`<div class="bot-ava">✦</div><div class="bot-bubble"><div class="ai-intent-tag">✦ ${esc(summary)}</div><div class="ai-result-grid">${cards}</div></div>`;
  }
  $("aiMessages").appendChild(d);
  d.querySelectorAll(".ai-card[data-id]").forEach(card=>card.addEventListener("click",e=>{
    if(e.target.closest(".ai-add-btn")) return;
    openDetailPage(+card.dataset.id);
  }));
  d.querySelectorAll(".ai-add-btn[data-id]").forEach(b=>{
    b.addEventListener("click",()=>{
      addToCart(+b.dataset.id);
      b.textContent="✓ Added!"; b.style.background="var(--green)";
      setTimeout(()=>{ b.textContent="✓ In Cart"; b.style.background=""; },1500);
    });
  });
  scrollChat();
}
function scrollChat(){ requestAnimationFrame(()=>{ $("aiMessages").scrollTop=9999; }); }
function toast(msg,dur=3000){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),dur);
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }


function bindEvents(){
  $("themeToggle").addEventListener("click",()=>{
    const next=document.documentElement.dataset.theme==="dark"?"light":"dark";
    document.documentElement.dataset.theme=next;
    localStorage.setItem("nx_theme",next);
  });

  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
  $("logoLink").addEventListener("click",e=>{ e.preventDefault(); switchView("shop"); });
  $("tryAiBtn").addEventListener("click",()=>switchView("ai"));

  $("openLogin").addEventListener("click",    ()=>{ clearErr("loginErr");   openModal("loginModal"); });
  $("openRegister").addEventListener("click", ()=>{ clearErr("regErr");     openModal("registerModal"); });
  $("logoutBtn").addEventListener("click", logout);

  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  ["loginModal","registerModal"].forEach(id=>$(id).addEventListener("click",e=>{ if(e.target===$(id)) closeModal(id); }));

  $("switchToRegister").addEventListener("click",()=>{ closeModal("loginModal");    clearErr("regErr");   openModal("registerModal"); });
  $("switchToLogin").addEventListener("click",   ()=>{ closeModal("registerModal"); clearErr("loginErr"); openModal("loginModal"); });

  $("loginBtn").addEventListener("click", doLogin);
  $("registerBtn").addEventListener("click", doRegister);
  ["loginEmail","loginPass"].forEach(id=>$(id).addEventListener("keydown",e=>{ if(e.key==="Enter") doLogin(); }));
  ["regName","regEmail","regPass"].forEach(id=>$(id).addEventListener("keydown",e=>{ if(e.key==="Enter") doRegister(); }));

  $("cartBtn").addEventListener("click", openDrawer);
  $("cartClose").addEventListener("click", closeDrawer);
  $("cartOverlay").addEventListener("click", closeDrawer);
  $("checkoutBtn").addEventListener("click",()=>{ closeDrawer(); openModal("checkoutModal"); });
  $("modalCloseBtn").addEventListener("click",()=>{
    closeModal("checkoutModal");
    S.cart=[]; localStorage.setItem("nx_cart","[]"); renderCart();
  });

  $("sortSelect").addEventListener("change",e=>{ S.filters.sort=e.target.value; loadProducts(); });
  $("inStockOnly").addEventListener("change",e=>{ S.filters.inStock=e.target.checked; loadProducts(); });
  document.querySelectorAll(".star-btn").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".star-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); S.filters.minRating=+b.dataset.r; loadProducts();
  }));

  let st;
  $("shopSearch").addEventListener("input",e=>{
    clearTimeout(st); S.filters.search=e.target.value;
    st=setTimeout(()=>renderProducts(S.products),250);
  });
  $("clearFilters").addEventListener("click",clearFilters);

  $("aiSendBtn").addEventListener("click",sendAI);
  $("aiInput").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendAI(); } });
  $("aiInput").addEventListener("input",()=>{
    $("aiInput").style.height="auto";
    $("aiInput").style.height=Math.min($("aiInput").scrollHeight,110)+"px";
  });
  document.addEventListener("click",e=>{
    const c=e.target.closest(".chip[data-q]"); if(!c) return;
    $("aiInput").value=c.dataset.q; sendAI();
  });
}

function sendAI(){
  const txt=$("aiInput").value.trim();
  if(!txt||S.aiWorking) return;
  $("aiInput").value=""; $("aiInput").style.height="auto";
  aiSearch(txt);
}

init();
