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
