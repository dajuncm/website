const S = {
  products  : [],
  cart      : JSON.parse(localStorage.getItem("nx_cart") || "[]"),
  token     : localStorage.getItem("nx_token") || null,
  user      : JSON.parse(localStorage.getItem("nx_user") || "null"),
  filters   : { category:"all", minPrice:0, maxPrice:1100, minRating:0, inStock:false, sort:"popularity", search:"" },
  aiWorking : false,
  prevView  : "shop",
};

const $  = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

async function init() {
  loadTheme();
  renderAuthUI();
  await loadCategories();
  await loadProducts();
  initRangeSlider();
  bindEvents();
  renderCart();
}

function loadTheme() {
  document.documentElement.dataset.theme = localStorage.getItem("nx_theme") || "dark";
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

function openModal(id)  { $(id).style.display = "grid"; document.body.style.overflow = "hidden"; }
function closeModal(id) { $(id).style.display = "none";  document.body.style.overflow = "";       }
function showErr(id, msg){ const e=$(id); e.textContent=msg; e.classList.add("show"); }
function clearErr(id)    { const e=$(id); e.textContent=""; e.classList.remove("show"); }

async function doLogin() {
  clearErr("loginErr");
  const email = $("loginEmail").value.trim();
  const pass  = $("loginPass").value;
  if (!email || !pass) return showErr("loginErr", "Please fill in all fields");
  const btn = $("loginBtn");
  btn.disabled = true; btn.textContent = "Signing in…";
  try {
    const r = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email, password:pass}) });
    const d = await r.json();
    if (!r.ok) return showErr("loginErr", d.error || "Error");
    saveSession(d.token, d.user);
    closeModal("loginModal");
    $("loginEmail").value = $("loginPass").value = "";
    toast(`Welcome back, ${d.user.name}! 👋`);
  } catch { showErr("loginErr", "Network error"); }
  finally { btn.disabled = false; btn.textContent = "Sign In"; }
}

async function doRegister() {
  clearErr("regErr");
  const name  = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const pass  = $("regPass").value;
  if (!name || !email || !pass) return showErr("regErr", "Please fill in all fields");
  const btn = $("registerBtn");
  btn.disabled = true; btn.textContent = "Creating account…";
  try {
    const r = await fetch("/api/auth/register", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name, email, password:pass}) });
    const d = await r.json();
    if (!r.ok) return showErr("regErr", d.error || "Error");
    saveSession(d.token, d.user);
    closeModal("registerModal");
    $("regName").value = $("regEmail").value = $("regPass").value = "";
    toast(`Welcome to NEXUS, ${d.user.name}! 🎉`);
  } catch { showErr("regErr", "Network error"); }
  finally { btn.disabled = false; btn.textContent = "Create Account"; }
}

function saveSession(token, user) {
  S.token = token; S.user = user;
  localStorage.setItem("nx_token", token);
  localStorage.setItem("nx_user", JSON.stringify(user));
  renderAuthUI();
}

function logout() {
  S.token = null; S.user = null;
  localStorage.removeItem("nx_token");
  localStorage.removeItem("nx_user");
  renderAuthUI();
  toast("You have been signed out");
}

async function loadCategories() {
  const d = await fetch("/api/categories").then(r => r.json()).catch(() => ({categories:[]}));
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
  const d = await fetch("/api/products?" + p).then(r => r.json()).catch(() => ({products:[],total:0}));
  S.products = d.products;
  renderProducts(d.products);
}

function starsHtml(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

function renderProducts(list) {
  const grid  = $("productGrid");
  const empty = $("emptyState");
  const count = $("productCount");
  if (S.filters.search.trim()) {
    const q = S.filters.search.toLowerCase();
    list = list.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
  }
  if (!list.length) { grid.innerHTML = ""; empty.style.display = "block"; count.textContent = "0 products"; return; }
  empty.style.display = "none";
  count.textContent = `${list.length} product${list.length !== 1 ? "s" : ""}`;
  grid.innerHTML = list.map((p, i) => {
    const disc = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    return `
    <article class="pcard" data-id="${p.id}" style="animation-delay:${Math.min(i,20)*0.03}s">
      <div class="pcard-img-wrap">
        <img class="pcard-img" src="${p.image}" alt="${p.title}" loading="lazy"/>
        ${disc ? `<span class="pcard-badge badge-sale">-${disc}%</span>` : ""}
        ${!p.inStock ? `<span class="pcard-badge badge-oos">Out of stock</span>` : ""}
        ${p.inStock ? `<button class="pcard-qa" data-id="${p.id}">+ Add to cart</button>` : ""}
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
          ${p.originalPrice > p.price ? `<span class="pcard-orig">$${p.originalPrice.toFixed(2)}</span>` : ""}
          ${disc ? `<span class="pcard-save">-${disc}%</span>` : ""}
        </div>
        ${!p.inStock ? `<span class="pcard-oos">⚠ Out of stock</span>` : ""}
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".pcard-qa").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      addToCart(+b.dataset.id);
      b.textContent = "✓ Added!";
      b.style.background = "var(--green)";
      setTimeout(() => { b.textContent = "+ Add to cart"; b.style.background = ""; }, 1200);
    });
  });

  grid.querySelectorAll(".pcard").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".pcard-qa")) return;
      openDetailPage(+card.dataset.id);
    });
  });
}
