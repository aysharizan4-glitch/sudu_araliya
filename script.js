
// script.js (UPDATED fixes: delete sync, price display in grid, edit=update, out-of-stock blur+disable)

// ----------------- Supabase init (keep your values) -----------------
const SUPABASE_URL = "https://rzuyavmxugrqocydfljl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dXlhdm14dWdycW9jeWRmbGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk2MTUsImV4cCI6MjA3NjI3NTYxNX0.LtfbIi19rl6khkv1pjvnVtkFNdqj1MYyvMnDB-lVG3E";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------- Configuration / Defaults -----------------
const STORAGE_BUCKET = "product-images"; // change if different
const ADMIN_PASSWORD = "admin123"; // client-side only; change or use server-side auth
const WHATSAPP_NUMBER = "94788878600";
const CART_KEY = "sudu_cart_v1";
const ADMIN_LOCALFLAG = "sudu_admin_auth";

// ----------------- Helpers -----------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtCurrency = v => `LKR ${Number(v || 0).toFixed(2)}`;
function escapeHtml(s){ if(!s && s!==0) return ""; return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]); }

// ----------------- DOM refs (based on your HTML) -----------------
const adminToggleBtn = $("#adminToggleBtn");
const adminContainer = document.querySelector(".admin-container");
const adminCloseBtn = adminContainer ? adminContainer.querySelector(".close-btn") : null;
const productForm = adminContainer ? adminContainer.querySelector(".product-form") : null;
const productListAdmin = adminContainer ? adminContainer.querySelector(".product-list") : null;

const productGrid = document.querySelector(".product-grid");
const productPage = document.querySelector(".product-page");
const pName = $("#pName");
const pSku = $("#pSku");
const pDesc = $("#pDesc");
const pNewPrice = $("#pNewPrice");
const pOldPrice = $("#pOldPrice");
const pDiscount = $("#pDiscount");
const pStock = $("#pStock");
const sizeSelect = $("#sizeSelect");
const colorSelect = $("#colorSelect");
const qtyInput = $("#qty");
const decQty = $("#decQty");
const incQty = $("#incQty");
const addCartBtn = document.querySelector(".add-cart-btn");
const buyNowBtn = $("#buyNow");
const mainImage = $("#mainImage");
const thumbs = $("#thumbs");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const relatedGrid = $("#relatedGrid");

const cartBtn = document.querySelector(".cart-btn");
const cartCountEl = document.querySelector(".cart-count");
const subscribeForm = document.querySelector(".subscribe-form");
const subscribeInput = document.querySelector(".subscribe-input");
const yearSpan = document.getElementById("year");

// ----------------- State -----------------
let products = [];
let currentProduct = null;
let currentImages = [];
let mainImageIndex = 0;
let cart = loadCart();
let editingProductId = null; // <--- for edit/update tracking

if (yearSpan) yearSpan.textContent = new Date().getFullYear();
if (adminContainer) adminContainer.style.display = "none";

// ----------------- Initialization -----------------
init();

async function init(){
  attachUIHandlers();
  await loadAndRenderProducts();
  renderCartCount();
}

// ----------------- UI handlers -----------------
function attachUIHandlers(){
  if (adminToggleBtn){
    adminToggleBtn.addEventListener("click", () => {
      const already = localStorage.getItem(ADMIN_LOCALFLAG);
      if (already === "1") { showAdmin(); return; }
      const pw = prompt("Enter admin password:");
      if (pw === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_LOCALFLAG,"1");
        showAdmin();
      } else {
        alert("Incorrect password.");
      }
    });
  }
  if (adminCloseBtn) adminCloseBtn.addEventListener("click", hideAdmin);

  if (productForm) {
    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleAdminSaveProduct(e.target);
    });
  }

  if (cartBtn) cartBtn.addEventListener("click", () => openCartPanel());

  if (subscribeForm) {
    subscribeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = subscribeInput.value.trim();
      if (!email) return alert("Please enter your email.");
      alert("Thanks for subscribing!");
      // attempt to insert (will fail unless RLS allows writes)
      try {
        await supabase.from("subscribers").insert([{ email }]);
      } catch(err){ console.warn("Subscribe insert error:", err); }
      subscribeInput.value = "";
    });
  }

  if (decQty) decQty.addEventListener("click", ()=> { qtyInput.value = Math.max(1, Number(qtyInput.value||1)-1); });
  if (incQty) incQty.addEventListener("click", ()=> { qtyInput.value = Number(qtyInput.value||1)+1; });

  if (addCartBtn) addCartBtn.addEventListener("click", ()=> {
    if (!currentProduct) return;
    if (!currentProduct.in_stock) return alert("Out of stock.");
    addCurrentProductToCart();
  });

  if (buyNowBtn) buyNowBtn.addEventListener("click", ()=> {
    if (!currentProduct) return;
    if (!currentProduct.in_stock) return alert("Out of stock.");
    openCheckoutModal([buildCartItemFromCurrent()], "single");
  });

  if (prevBtn) prevBtn.addEventListener("click", ()=> showMainImage(mainImageIndex-1));
  if (nextBtn) nextBtn.addEventListener("click", ()=> showMainImage(mainImageIndex+1));
  if (mainImage) attachSwipe(mainImage);
}

// ----------------- Admin functions -----------------
function showAdmin(){ if (!adminContainer) return; adminContainer.style.display="block"; renderAdminList(); }
function hideAdmin(){ if (!adminContainer) return; adminContainer.style.display="none"; editingProductId = null; productForm.reset(); }

// NOTE: Because your HTML uses duplicate placeholders for new/old price,
// we select by order: first 0.00 is "New Price", second 0.00 is "Old Price".
async function handleAdminSaveProduct(formEl){
  // gather values
  const name = formEl.querySelector('input[placeholder="Enter product name"]').value.trim();
  const discountVal = formEl.querySelector('input[placeholder="0"]').value.trim(); // discount input
  const sku = formEl.querySelector('input[placeholder="Enter SKU number"]').value.trim();

  // Two inputs have placeholder "0.00" — first is New Price, second is Old Price
  const priceInputs = formEl.querySelectorAll('input[placeholder="0.00"]');
  const newPrice = priceInputs[0] ? priceInputs[0].value.trim() : "";
  const oldPrice = priceInputs[1] ? priceInputs[1].value.trim() : "";

  const files = formEl.querySelector('input[type="file"]').files;
  const category = formEl.querySelector("#category") ? formEl.querySelector("#category").value : "";
  const sizesText = formEl.querySelector('input[placeholder="Enter size"]').value.trim();
  const coloursText = formEl.querySelector('input[placeholder="write the Colour"]').value.trim();
  const desc = formEl.querySelector('textarea').value.trim();
  const stockRadios = formEl.querySelectorAll('input[name="stock"]');
  const inStock = stockRadios && stockRadios[0] && stockRadios[0].checked;

  const sizesArr = sizesText ? sizesText.split(",").map(s=>s.trim()).filter(Boolean) : [];
  const colorsArr = coloursText ? coloursText.split(",").map(s=>s.trim()).filter(Boolean) : [];

  if (!name || !newPrice) return alert("Please add name and new price.");

  // product payload
  const payload = {
    name,
    sku,
    price: Number(newPrice) || 0,
    compare_price: oldPrice ? Number(oldPrice) : null,
    discount_percent: discountVal ? Number(discountVal) : null,
    in_stock: !!inStock,
    stock_count: inStock ? 10 : 0,
    sizes: sizesArr,
    colors: colorsArr,
    category,
    description: desc,
    demo: false
  };

  try {
    if (editingProductId) {
      // ---- UPDATE existing product (no new row) ----
      const { error: updErr } = await supabase.from("products").update(payload).eq("id", editingProductId);
      if (updErr) {
        console.warn("Update failed (RLS?),", updErr.message);
        alert("Update attempted but may have failed due to DB permissions.");
      } else {
        // upload images if provided
        if (files && files.length) await uploadFilesForProduct(editingProductId, files);
        alert("Product updated.");
      }
      editingProductId = null;
    } else {
      // ---- INSERT new product ----
      const { data: created, error: insertErr } = await supabase.from("products").insert([payload]).select().single();
      if (insertErr) {
        console.warn("Insert failed:", insertErr.message);
        alert("Insert attempted but may have failed due to DB permissions.");
        return;
      }
      const productId = created.id;
      if (files && files.length) await uploadFilesForProduct(productId, files);
      alert("Product added.");
    }

    formEl.reset();
    await loadAndRenderProducts();
    renderAdminList();

  } catch (err) {
    console.error("Admin save error:", err);
    alert("Unexpected error. See console.");
  }
}

// Upload images to storage + insert product_images rows
async function uploadFilesForProduct(productId, files){
  for (let f of files){
    const path = `${productId}/${Date.now()}_${sanitizeFilename(f.name)}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, f, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      console.warn("Upload error:", uploadError.message);
      continue;
    }
    // insert mapping row (may fail if RLS blocks insert)
    const { error: imgInsertErr } = await supabase.from("product_images").insert([{ product_id: productId, storage_path: path }]);
    if (imgInsertErr) console.warn("product_images insert error:", imgInsertErr.message);
  }
}

// Admin list rendering
async function renderAdminList(){
  if (!productListAdmin) return;
  productListAdmin.innerHTML = "<p>Loading admin products...</p>";
  try {
    const { data: rows, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) {
      productListAdmin.innerHTML = `<p>Unable to load admin list: ${error.message}</p>`;
      return;
    }
    productListAdmin.innerHTML = "";
    rows.forEach(p => {
      const outer = document.createElement("div");
      outer.className = "admin-item";
      outer.id = `adminProduct-${p.id}`;
      outer.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${escapeHtml(p.name)}</strong><br/>
            <small>${escapeHtml(p.category || "")}</small><br/>
            SKU: ${escapeHtml(p.sku || "")} — ${fmtCurrency(p.price)}
          </div>
          <div>
            <button class="adm-edit" data-id="${p.id}">Edit</button>
            <button class="adm-delete" data-id="${p.id}">Delete</button>
          </div>
        </div>
      `;
      productListAdmin.appendChild(outer);
    });

    $$(".adm-edit", productListAdmin).forEach(btn => btn.addEventListener("click", async (ev) => {
      const id = ev.currentTarget.dataset.id;
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (!data) return alert("Product not found.");
      populateAdminForm(data);
      editingProductId = id;
      showAdmin();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));

    $$(".adm-delete", productListAdmin).forEach(btn => btn.addEventListener("click", async (ev) => {
      const id = ev.currentTarget.dataset.id;
      if (!confirm("Delete this product? This removes it from storefront and admin.")) return;
      // delete product -> product_images rows will cascade if foreign key cascade set (your schema uses on delete cascade)
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) {
        console.warn("Delete error (RLS?):", error.message);
        alert("Delete attempted but may have failed due to DB permissions.");
      } else {
        // update local UI
        document.querySelector(`#adminProduct-${id}`)?.remove();
        // remove from products array and re-render grid
        products = products.filter(p => p.id !== id);
        renderProductGrid();
        alert("Product deleted.");
      }
    }));

  } catch (err) {
    productListAdmin.innerHTML = "<p>Unexpected error loading admin list.</p>";
    console.error(err);
  }
}

function populateAdminForm(product){
  if (!productForm) return;
  productForm.querySelector('input[placeholder="Enter product name"]').value = product.name || "";
  productForm.querySelector('input[placeholder="Enter SKU number"]').value = product.sku || "";
  productForm.querySelector('input[placeholder="0"]').value = product.discount_percent || "";
  const priceInputs = productForm.querySelectorAll('input[placeholder="0.00"]');
  if (priceInputs[0]) priceInputs[0].value = product.price || "";
  if (priceInputs[1]) priceInputs[1].value = product.compare_price || "";
  productForm.querySelector('textarea').value = product.description || "";
  if (productForm.querySelector("#category")) productForm.querySelector("#category").value = product.category || "";
  productForm.querySelector('input[placeholder="Enter size"]').value = (product.sizes || []).join(", ");
  productForm.querySelector('input[placeholder="write the Colour"]').value = (product.colors || []).join(", ");
  // stock radios
  const stockRadios = productForm.querySelectorAll('input[name="stock"]');
  if (stockRadios && stockRadios.length >= 2){
    if (product.in_stock) { stockRadios[0].checked = true; stockRadios[1].checked = false; }
    else { stockRadios[0].checked = false; stockRadios[1].checked = true; }
  }
}

// ----------------- Product loading & rendering -----------------
async function loadAndRenderProducts(){
  try {
    const { data: prods, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Load products error:", error);
      return;
    }
    // fetch images for each product
    const enriched = await Promise.all(prods.map(async p => {
      const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", p.id).order("is_main", { ascending: false });
      const mapped = (imgs || []).map(img => {
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(img.storage_path);
        return { ...img, url: data.publicUrl, storage_path: img.storage_path };
      });
      return { ...p, images: mapped };
    }));
    products = enriched;
    renderProductGrid();
  } catch (err) {
    console.error("loadAndRenderProducts error:", err);
  }
}

function renderProductGrid(){
  if (!productGrid) return;
  productGrid.innerHTML = ""; // remove demo cards and replace

  if (!products.length) {
    productGrid.innerHTML = "<p>No products available.</p>";
    return;
  }

  products.forEach(prod => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.id = `storeProduct-${prod.id}`;

    // stock/blur handling
    const isOut = !prod.in_stock;
    if (isOut) card.classList.add("out-of-stock");

    const mainImg = (prod.images && prod.images[0] && prod.images[0].url) || "placeholder.jpg";
    const discountBadge = prod.discount_percent ? `<div class="discount-badge">${escapeHtml(String(prod.discount_percent))}% OFF</div>` : "";
    // Price in grid: show both if compare_price exists
    const oldPriceHtml = (prod.compare_price !== null && prod.compare_price !== undefined) ? `<p class="old-price">${fmtCurrency(prod.compare_price)}</p>` : "";
    const newPriceHtml = `<p class="new-price">${fmtCurrency(prod.price)}</p>`;

    // note: view detail button left enabled so admin or users can view; add-to-cart / buy controls are in detail view.
    card.innerHTML = `
      <div class="badge-stock">${isOut ? "Out of stock" : "In stock"}</div>
      <img src="${mainImg}" alt="${escapeHtml(prod.name)}" class="product-img" />
      ${discountBadge}
      <div class="product-info">
        <h3 class="brand">${escapeHtml(prod.brand || prod.name)}</h3>
        <div class="price-section">
          ${oldPriceHtml}
          ${newPriceHtml}
        </div>
        <p class="desc">${escapeHtml(prod.description || "")}</p>
      </div>
      <button class="view-detail" data-id="${prod.id}">View Details</button>
    `;
    productGrid.appendChild(card);
  });

  // attach listeners to view-detail and also apply out-of-stock visual styles
  $$(".view-detail", productGrid).forEach(btn => btn.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.id;
    const prod = products.find(p => p.id === id);
    if (!prod) return alert("Product not found.");
    showProductDetail(prod);
  }));

  // optional: add CSS rules for .out-of-stock if not present
  ensureOutOfStockCSS();
}

// ----------------- Product Detail (ORDER PRODUCT) -----------------
function showProductDetail(prod){
  currentProduct = prod;
  currentImages = (prod.images || []).map(i => ({ storage_path: i.storage_path, url: i.url }));
  if (!currentImages.length) currentImages = [{ url: prod.image || "placeholder.jpg", storage_path: null }];
  mainImageIndex = 0;
  showMainImage(0);

  pName.textContent = prod.name || "Product name";
  pSku.textContent = `SKU: ${prod.sku || "-"}`;
  pDesc.textContent = prod.description || "—";
  pNewPrice.textContent = fmtCurrency(prod.price || 0);
  if (prod.compare_price) {
    pOldPrice.style.display = "block";
    pOldPrice.textContent = fmtCurrency(prod.compare_price);
  } else {
    pOldPrice.style.display = "none";
  }
  if (prod.discount_percent) {
    pDiscount.style.display = "inline-block";
    pDiscount.textContent = `-${prod.discount_percent}%`;
  } else {
    pDiscount.style.display = "none";
  }

  // stock UI: blur detail area and disable add/buy if out-of-stock
  if (!prod.in_stock) {
    pStock.className = "stock out";
    pStock.textContent = "Out of stock";
    productPage.classList.add("out-of-stock");
    if (addCartBtn) { addCartBtn.disabled = true; addCartBtn.style.opacity = "0.5"; }
    if (buyNowBtn) { buyNowBtn.disabled = true; buyNowBtn.style.opacity = "0.5"; }
  } else {
    pStock.className = "stock in";
    pStock.textContent = "In stock";
    productPage.classList.remove("out-of-stock");
    if (addCartBtn) { addCartBtn.disabled = false; addCartBtn.style.opacity = ""; }
    if (buyNowBtn) { buyNowBtn.disabled = false; buyNowBtn.style.opacity = ""; }
  }

  populateSelectFromArray(sizeSelect, prod.sizes || [], "Size");
  populateSelectFromArray(colorSelect, prod.colors || [], "Colour");
  renderRelated(prod);
  productPage.scrollIntoView({ behavior: "smooth" });
}

function populateSelectFromArray(selEl, arr, label){
  if (!selEl) return;
  selEl.innerHTML = "";
  if (!arr || !arr.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = `No ${label} available`;
    selEl.appendChild(opt);
    selEl.disabled = true;
    return;
  }
  selEl.disabled = false;
  arr.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selEl.appendChild(opt);
  });
}

function showMainImage(index){
  if (!currentImages || !currentImages.length) return;
  if (index < 0) index = currentImages.length-1;
  if (index >= currentImages.length) index = 0;
  mainImageIndex = index;
  mainImage.src = currentImages[index].url;
  if (thumbs) {
    thumbs.innerHTML = "";
    currentImages.forEach((img, i) => {
      const t = document.createElement("img");
      t.className = "thumb-item";
      t.src = img.url;
      t.dataset.idx = i;
      t.addEventListener("click", ()=> showMainImage(i));
      thumbs.appendChild(t);
    });
  }
}

function attachSwipe(el){
  let startX = null;
  el.addEventListener("touchstart", e => startX = e.touches[0].clientX);
  el.addEventListener("touchend", e => {
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    if (Math.abs(dx) > 30) {
      if (dx < 0) showMainImage(mainImageIndex + 1);
      else showMainImage(mainImageIndex - 1);
    }
    startX = null;
  });
}

function renderRelated(prod){
  if (!relatedGrid) return;
  relatedGrid.innerHTML = "";
  const others = products.filter(p => p.id !== prod.id && p.category === prod.category).slice(0,4);
  others.forEach(r => {
    const el = document.createElement("div");
    el.className = "related-item";
    const img = (r.images && r.images[0] && r.images[0].url) || "placeholder.jpg";
    el.innerHTML = `<img src="${img}" alt="${escapeHtml(r.name)}"><div>${escapeHtml(r.name)}</div><div>${fmtCurrency(r.price)}</div>`;
    el.addEventListener("click", ()=> showProductDetail(r));
    relatedGrid.appendChild(el);
  });
}

// ----------------- Cart logic -----------------
function loadCart(){ try { const raw = localStorage.getItem(CART_KEY); return raw ? JSON.parse(raw) : []; } catch(e){ return []; } }
function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); renderCartCount(); }
function renderCartCount(){ const count = cart.reduce((s,it)=>s+(it.quantity||0),0); if (cartCountEl) cartCountEl.textContent = count; }

function buildCartItemFromCurrent(){
  const size = sizeSelect ? sizeSelect.value : "";
  const color = colorSelect ? colorSelect.value : "";
  const qty = Number(qtyInput.value || 1);
  return {
    product_id: currentProduct.id,
    name: currentProduct.name,
    sku: currentProduct.sku,
    size,
    color,
    quantity: qty,
    price: Number(currentProduct.price),
    line_total: Number(currentProduct.price) * qty
  };
}

function addCurrentProductToCart(){
  if (!currentProduct) return;
  if (!currentProduct.in_stock) return alert("Out of stock.");
  const item = buildCartItemFromCurrent();
  const sameIdx = cart.findIndex(c => c.product_id === item.product_id && c.size === item.size && c.color === item.color);
  if (sameIdx >= 0) {
    cart[sameIdx].quantity += item.quantity;
    cart[sameIdx].line_total = cart[sameIdx].quantity * cart[sameIdx].price;
  } else {
    cart.push(item);
  }
  saveCart();
  alert("Added to cart.");
}

function openCartPanel(){
  const modal = document.createElement("div");
  modal.className = "cart-modal";
  modal.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;";
  const dialog = document.createElement("div");
  dialog.style = "background:#fff;padding:1rem;border-radius:8px;max-width:600px;width:90%;max-height:80vh;overflow:auto;";
  modal.appendChild(dialog);

  if (!cart.length) {
    dialog.innerHTML = `<h3>Your cart is empty</h3><button id="closeCart">Close</button>`;
    document.body.appendChild(modal);
    $("#closeCart", dialog).addEventListener("click", ()=> modal.remove());
    return;
  }

  const rows = cart.map((it,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;margin:.5rem 0;border-bottom:1px solid #eee;padding-bottom:.5rem;">
      <div>
        <strong>${escapeHtml(it.name)}</strong><br/>
        SKU: ${escapeHtml(it.sku||"-")} ${it.size? `| Size: ${escapeHtml(it.size)}` : ""} ${it.color? `| Color: ${escapeHtml(it.color)}` : ""}
        <div>Qty: ${it.quantity} × ${fmtCurrency(it.price)}</div>
      </div>
      <div style="text-align:right;">
        <div>${fmtCurrency(it.line_total)}</div>
        <button class="remove-item" data-idx="${i}">Remove</button>
      </div>
    </div>
  `).join("");

  const total = cart.reduce((s,it) => s + (it.line_total || (it.quantity * it.price)), 0);

  dialog.innerHTML = `
    <h3>Your Cart</h3>
    <div>${rows}</div>
    <div style="text-align:right;margin-top:1rem"><strong>Total: ${fmtCurrency(total)}</strong></div>
    <div style="display:flex;gap:.5rem;margin-top:1rem;justify-content:flex-end">
      <button id="cartCancel">Cancel</button>
      <button id="cartCheckout">Checkout</button>
    </div>
  `;

  document.body.appendChild(modal);

  $$(".remove-item", dialog).forEach(b=> b.addEventListener("click", (ev)=> {
    const idx = Number(ev.currentTarget.dataset.idx);
    cart.splice(idx,1);
    saveCart();
    modal.remove();
    openCartPanel();
  }));

  $("#cartCancel", dialog).addEventListener("click", ()=> modal.remove());
  $("#cartCheckout", dialog).addEventListener("click", ()=> { modal.remove(); openCheckoutModal(cart, "cart"); });
}

function openCheckoutModal(items, type="cart"){
  const modal = document.createElement("div");
  modal.className = "checkout-modal";
  modal.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2100;";
  const dialog = document.createElement("div");
  dialog.style = "background:#fff;padding:1rem;border-radius:8px;max-width:640px;width:95%;max-height:85vh;overflow:auto;";
  modal.appendChild(dialog);

  const total = items.reduce((s,it) => s + (it.line_total || (it.quantity * it.price)), 0);

  dialog.innerHTML = `
    <h3>Checkout</h3>
    <form id="checkoutForm">
      <div><label>Name</label><input name="name" required /></div>
      <div><label>Address</label><input name="address" required /></div>
      <div><label>Phone</label><input name="phone" required /></div>
      <div>
        <label>Payment Method</label>
        <label><input type="radio" name="pmt" value="Cash on Delivery" checked /> Cash on Delivery</label>
        <label><input type="radio" name="pmt" value="Bank Transfer" /> Bank Transfer</label>
      </div>
      <div style="margin-top:.5rem"><strong>Order total: ${fmtCurrency(total)}</strong></div>
      <div style="display:flex;gap:.5rem;margin-top:1rem;justify-content:flex-end;">
        <button type="button" id="checkoutCancel">Cancel</button>
        <button type="submit" id="checkoutConfirm">Confirm</button>
      </div>
    </form>
  `;

  document.body.appendChild(modal);

  $("#checkoutCancel", dialog).addEventListener("click", ()=> modal.remove());
  $("#checkoutForm", dialog).addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const name = form.name.value.trim();
    const address = form.address.value.trim();
    const phone = form.phone.value.trim();
    const pmt = form.pmt.value || "Cash on Delivery";

    let msg = `Order from ${name}%0APhone: ${phone}%0AAddress: ${encodeURIComponent(address)}%0APayment: ${encodeURIComponent(pmt)}%0A%0AItems:%0A`;
    items.forEach(it => {
      msg += `${encodeURIComponent(it.name)} - SKU:${encodeURIComponent(it.sku||"-")} - Size:${encodeURIComponent(it.size||"-")} - Color:${encodeURIComponent(it.color||"-")} - Qty:${it.quantity} - ${fmtCurrency(it.line_total || (it.quantity * it.price))}%0A`;
    });
    msg += `%0ATotal: ${fmtCurrency(total)}`;
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
    window.open(waLink, "_blank");

    if (type === "cart") { cart = []; saveCart(); }
    modal.remove();
  });
}

// ----------------- Utilities -----------------
function sanitizeFilename(name){ return name.replace(/[^a-z0-9.\-_]/gi, "_"); }

// ensure some CSS for out-of-stock if not present
function ensureOutOfStockCSS(){
  if (document.getElementById("sudu-outofstock-css")) return;
  const css = `
    .product-card.out-of-stock { filter: blur(1.2px); opacity: 0.7; pointer-events: auto; position: relative; }
    .product-card.out-of-stock::after { content: "Out of Stock"; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(0,0,0,0.65); color:#fff; padding:6px 10px; border-radius:6px; font-weight:600; }
    .product-page.out-of-stock .selectors, .product-page.out-of-stock .actions { opacity: 0.6; pointer-events: none; }
  `;
  const st = document.createElement("style");
  st.id = "sudu-outofstock-css";
  st.appendChild(document.createTextNode(css));
  document.head.appendChild(st);
}
