// ===============================
// Sudu Araliya — Full JavaScript (Upload + Edit + Delete + Product Detail)
// ===============================

// ---------- Supabase config ----------
const SUPABASE_URL = "https://wnrvrmdclcsaugipqvnr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducnZybWRjbGNzYXVnaXBxdm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjU1NDAsImV4cCI6MjA3NTg0MTU0MH0.WSRGCm_pUeZSu-8MMz8a4jEx9p4ZrW8C8S3mrR29xeo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// script.js — COMPLETE for Sudu_Araliya
// Single-file: Admin (upload/edit/delete) + Product Grid + Product Detail (full-screen) + Cart (localStorage) + Supabase
// Paste this entire file as your script.js and replace previous versions.

// Wrap in IIFE to avoid global leaks
(function () {
  "use strict";

  // ---------- Supabase config ----------
  const SUPABASE_URL = "https://wnrvrmdclcsaugipqvnr.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducnZybWRjbGNzYXVnaXBxdm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjU1NDAsImV4cCI6MjA3NTg0MTU0MH0.WSRGCm_pUeZSu-8MMz8a4jEx9p4ZrW8C8S3mrR29xeo";

  const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---------- DOM references ----------
  const adminToggleBtn = document.getElementById("adminToggleBtn");
  const adminContainer = document.querySelector(".admin-container");
  const productForm = document.querySelector(".product-form");
  const productListAdmin = document.querySelector(".product-list");
  const productGrid = document.querySelector(".product-grid");

  // Product detail elements (the product-page section)
  const productPage = document.querySelector(".product-page");
  const mainImage = document.getElementById("mainImage");
  const thumbsEl = document.getElementById("thumbs");
  const pName = document.getElementById("pName");
  const pSku = document.getElementById("pSku");
  const pOldPrice = document.getElementById("pOldPrice");
  const pNewPrice = document.getElementById("pNewPrice");
  const pDiscount = document.getElementById("pDiscount");
  const pStock = document.getElementById("pStock");
  const sizeSelect = document.getElementById("sizeSelect");
  const colorSelect = document.getElementById("colorSelect");
  const qtyInput = document.getElementById("qty");
  const incQty = document.getElementById("incQty");
  const decQty = document.getElementById("decQty");
  const addCartBtn = document.getElementById("addCart");
  const buyNowBtn = document.getElementById("buyNow");
  const relatedGrid = document.getElementById("relatedGrid");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  const cartCountEls = document.querySelectorAll(".cart-count");
  const footerYear = document.getElementById("year");

  // small guards if elements are missing
  if (!supabase) console.warn("Supabase client not available. Check your script include.");

  // ---------- state ----------
  let currentProduct = null;
  let currentImageIndex = 0;

  // ---------- Admin password ----------
  const ADMIN_PASSWORD = "sudu123";

  // ---------- Helper functions ----------
  function log(...a) {
    // console.log(...a);
  }

  function formatLKR(v) {
    const n = Number(v || 0);
    return "LKR " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"'`=\/]/g, function (s) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;",
      }[s];
    });
  }

  async function uploadFile(file) {
    if (!supabase) return null;
    try {
      const path = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        console.error("Upload error:", error);
        return null;
      }
      const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(path);
      return publicData.publicUrl;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  // ---------- Cart (localStorage) ----------
  function getCart() {
    try {
      const raw = localStorage.getItem("sudu_cart");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem("sudu_cart", JSON.stringify(cart));
    updateCartCountUI();
  }

  function addToCart(item) {
    const cart = getCart();
    const idx = cart.findIndex((c) => c.id === item.id && c.size === item.size && c.color === item.color);
    if (idx > -1) cart[idx].qty = Number(cart[idx].qty) + Number(item.qty);
    else cart.push(item);
    saveCart(cart);
  }

  function updateCartCountUI() {
    const count = getCart().reduce((s, it) => s + Number(it.qty || 0), 0);
    cartCountEls.forEach((el) => (el.textContent = count));
  }

  // ---------- Admin UI handlers ----------
  if (adminContainer) adminContainer.style.display = "none";

  adminToggleBtn?.addEventListener("click", () => {
    const pw = prompt("Enter admin password:");
    if (pw === ADMIN_PASSWORD) adminContainer.style.display = "block";
    else alert("Incorrect password");
  });

  document.querySelector(".close-btn")?.addEventListener("click", () => {
    if (adminContainer) adminContainer.style.display = "none";
  });

  function renderAdminList(products) {
    if (!productListAdmin) return;
    productListAdmin.innerHTML = "";
    if (!products || products.length === 0) {
      productListAdmin.innerHTML = "<p>No products yet.</p>";
      return;
    }

    products.forEach((p) => {
      const row = document.createElement("div");
      row.className = "product-item";
      row.innerHTML = `
        <img src="${p.images?.[0] || "https://via.placeholder.com/100"}" alt="">
        <div class="info">
          <h4>${escapeHtml(p.name)}</h4>
          <p>${formatLKR(p.new_price)}</p>
        </div>
        <div class="actions">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </div>
      `;
      row.querySelector(".edit-btn").onclick = () => populateForm(p);
      row.querySelector(".delete-btn").onclick = async () => {
        if (!confirm(`Delete "${p.name}"?`)) return;
        try {
          await supabase.from("products").delete().eq("id", p.id);
          await loadProducts();
        } catch (err) {
          console.error(err);
        }
      };
      productListAdmin.appendChild(row);
    });
  }

  function populateForm(p) {
    if (!adminContainer || !productForm) return;
    adminContainer.style.display = "block";
    productForm.dataset.id = p.id;
    productForm.querySelector("input[placeholder='Enter product name']").value = p.name || "";
    productForm.querySelector("input[placeholder='0']").value = p.discount || "";
    productForm.querySelector("input[placeholder='Enter SKU number']").value = p.sku || "";
    const priceInputs = productForm.querySelectorAll("input[placeholder='0.00']");
    if (priceInputs.length >= 1) priceInputs[0].value = p.new_price || "";
    if (priceInputs.length >= 2) priceInputs[1].value = p.old_price || "";
    productForm.querySelector("#category").value = p.category || "";
    productForm.querySelector("input[placeholder='Enter size']").value = p.sizes || "";
    productForm.querySelector("input[placeholder='write the Colour']").value = p.colour || "";
    productForm.querySelector("textarea").value = p.description || "";
    // stock radio
    const radios = productForm.querySelectorAll("input[name='stock']");
    radios.forEach((r) => {
      const label = r.parentElement.textContent.trim();
      r.checked = label.toLowerCase().includes((p.stock_status || "").toLowerCase());
    });
  }

  // ---------- Product form submit (Add / Update) ----------
  productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = productForm.querySelector("input[placeholder='Enter product name']").value.trim();
    const discount = productForm.querySelector("input[placeholder='0']").value.trim();
    const sku = productForm.querySelector("input[placeholder='Enter SKU number']").value.trim();
    const priceInputs = productForm.querySelectorAll("input[placeholder='0.00']");
    const newPrice = parseFloat(priceInputs[0].value || "0") || 0;
    const oldPrice = parseFloat(priceInputs[1].value || "0") || 0;
    const category = document.getElementById("category").value || "";
    const sizes = productForm.querySelector("input[placeholder='Enter size']").value.trim();
    const colour = productForm.querySelector("input[placeholder='write the Colour']").value.trim();
    const stockEl = productForm.querySelector("input[name='stock']:checked");
    const stock_status = stockEl ? stockEl.parentElement.textContent.trim() : "In Stock";
    const description = productForm.querySelector("textarea").value.trim();
    const fileInput = productForm.querySelector("input[type='file']");

    let images = [];
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      for (let file of fileInput.files) {
        const url = await uploadFile(file);
        if (url) images.push(url);
      }
    }

    const payload = {
      name,
      discount: discount || null,
      sku,
      new_price: newPrice,
      old_price: oldPrice,
      category,
      sizes,
      colour,
      stock_status,
      description,
      images,
    };

    try {
      const editingId = productForm.dataset.id;
      if (editingId) {
        await supabase.from("products").update(payload).eq("id", editingId);
        alert("Product updated");
      } else {
        await supabase.from("products").insert([payload]);
        alert("Product added");
      }
      productForm.reset();
      delete productForm.dataset.id;
      await loadProducts();
    } catch (err) {
      console.error(err);
      alert("Save failed");
    }
  });

  // ---------- Load products from Supabase ----------
  async function loadProducts() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from("products").select("*").order("id", { ascending: false });
      if (error) {
        console.error("Load products error:", error);
        return;
      }
      renderProductsGrid(data || []);
      renderAdminList(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- Render product grid (interactive cards) ----------
  function renderProductsGrid(products) {
    if (!productGrid) return;
    productGrid.innerHTML = "";
    if (!products || products.length === 0) {
      productGrid.innerHTML = "<p>No products available.</p>";
      return;
    }

    products.forEach((p) => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.dataset.id = p.id;
      // Use container relative for badges if CSS expects that
      const mainImageUrl = p.images?.[0] || "https://via.placeholder.com/400";
      const discountHtml = p.discount ? `<div class='discount-badge'>-${p.discount}%</div>` : "";
      const oldPriceHtml = p.old_price && Number(p.old_price) > 0 ? `<span class='old-price' style='text-decoration:line-through;opacity:0.55;'>${formatLKR(p.old_price)}</span>` : "";
      card.innerHTML = `
        ${discountHtml}
        <div style="position:relative;">
          <div class="stock-badge ${p.stock_status === "Out of Stock" ? "out-stock" : "in-stock"}">
            ${p.stock_status || "In stock"}
          </div>
        </div>
        <img src="${mainImageUrl}" alt="${escapeHtml(p.name || "Product")}">
        <h3>${escapeHtml(p.name || "Untitled")}</h3>
        <div class="price-row">
          ${oldPriceHtml}
          <span class="new-price">${formatLKR(p.new_price)}</span>
        </div>
      `;
      // When clicking on card, open the product page (full-screen)
      card.addEventListener("click", () => {
        openProductPage(p);
      });
      productGrid.appendChild(card);
    });
  }

  // ---------- Product page behavior (hide other sections, show product-page) ----------
  if (productPage) productPage.style.display = "none";

  function hideMainSectionsExceptProductPage() {
    // Hide header, non-product sections, footer, bottom nav
    const selectors = ["header", "section", "footer", "nav"];
    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      // product-page is a section with class .product-page nested in main container; remove only that
      if (el.contains && el.classList && el.classList.contains && el.classList.contains("product-page")) {
        // skip product page container if the selector accidentally matches it
        return;
      }
      // But some "section" elements are the .product-page container's ancestors; we specifically want to hide
      // all sections except the element that has class product-page (which is nested deeper).
      if (!el.querySelector || !el.classList) {
        // generic hide for header/footer/nav
        el.style.display = "none";
      } else {
        // If element itself is the product-page, skip. If it *contains* the product-page, hide, because we want only product-page visible
        const isProductSection = el.classList && el.classList.contains("product-page");
        if (!isProductSection) {
          el.style.display = "none";
        }
      }
    });

    // Additionally hide any other elements except the productPage itself
    // (This helps when productPage is nested inside a section; we'll explicitly show productPage)
  }

  function showAllMainSections() {
    // Reset inline display style to default to show everything again
    document.querySelectorAll("header, section, footer, nav").forEach((el) => {
      el.style.display = "";
    });
  }

  // The main function to open a product's detail view
  function openProductPage(p) {
    currentProduct = p;
    currentImageIndex = 0;

    // Hide other sections (we'll show only productPage)
    hideMainSectionsExceptProductPage();

    // Show productPage fully
    if (productPage) productPage.style.display = "block";

    // Populate details
    if (pName) pName.textContent = p.name || "-";
    if (pSku) pSku.textContent = `SKU: ${p.sku || "-"}`;
    if (pNewPrice) pNewPrice.textContent = formatLKR(p.new_price || 0);
    if (pOldPrice) {
      if (p.old_price && Number(p.old_price) > 0) {
        pOldPrice.style.display = "";
        pOldPrice.textContent = formatLKR(p.old_price);
      } else {
        pOldPrice.style.display = "none";
      }
    }
    if (pDiscount) {
      if (p.discount) {
        pDiscount.style.display = "";
        pDiscount.textContent = `-${p.discount}%`;
      } else {
        pDiscount.style.display = "none";
      }
    }
    if (pStock) {
      pStock.textContent = p.stock_status || "In stock";
      pStock.className = (p.stock_status || "").toLowerCase().includes("out") ? "stock out" : "stock in";
    }
    // Description
    const pDesc = document.getElementById("pDesc");
    if (pDesc) pDesc.textContent = p.description || "—";

    // Images & gallery
    const images = Array.isArray(p.images) && p.images.length ? p.images : ["https://via.placeholder.com/800x600"];
    if (mainImage) mainImage.src = images[0];
    if (thumbsEl) {
      thumbsEl.innerHTML = "";
      images.forEach((url, i) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = `${p.name || "Product"} ${i + 1}`;
        if (i === 0) img.classList.add("active");
        img.addEventListener("click", () => {
          currentImageIndex = i;
          mainImage.src = url;
          thumbsEl.querySelectorAll("img").forEach((n) => n.classList.remove("active"));
          img.classList.add("active");
        });
        thumbsEl.appendChild(img);
      });
    }

    // Sizes & colors
    populateSelectFromCSV(sizeSelect, p.sizes);
    populateSelectFromCSV(colorSelect, p.colour);
    if (qtyInput) qtyInput.value = 1;

    // Related products
    loadRelatedProducts(p.category, p.id);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Populate select from CSV helper ----------
  function populateSelectFromCSV(selectEl, csv) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (!csv) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—";
      selectEl.appendChild(opt);
      return;
    }
    const parts = String(csv).split(/[,\/|]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—";
      selectEl.appendChild(opt);
      return;
    }
    parts.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      selectEl.appendChild(opt);
    });
  }

  // ---------- Gallery prev/next ----------
  prevBtn?.addEventListener("click", () => {
    if (!currentProduct) return;
    const images = currentProduct.images || [];
    if (!images.length) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    mainImage.src = images[currentImageIndex];
    thumbsEl.querySelectorAll("img").forEach((n, i) => n.classList.toggle("active", i === currentImageIndex));
  });
  nextBtn?.addEventListener("click", () => {
    if (!currentProduct) return;
    const images = currentProduct.images || [];
    if (!images.length) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
    mainImage.src = images[currentImageIndex];
    thumbsEl.querySelectorAll("img").forEach((n, i) => n.classList.toggle("active", i === currentImageIndex));
  });

  // ---------- Related products (same category) ----------
  async function loadRelatedProducts(category, excludeId) {
    if (!relatedGrid) return;
    relatedGrid.innerHTML = "<p>Loading related...</p>";
    try {
      const { data, error } = await supabase.from("products").select("*").eq("category", category).neq("id", excludeId).limit(6);
      if (error) {
        console.error(error);
        relatedGrid.innerHTML = "<p>Unable to load related products.</p>";
        return;
      }
      relatedGrid.innerHTML = "";
      (data || []).forEach((p) => {
        const el = document.createElement("div");
        el.className = "product-card";
        el.innerHTML = `
          <img src="${p.images?.[0] || "https://via.placeholder.com/400"}" alt="${escapeHtml(p.name)}">
          <h4 style="margin:0.4rem 0 0.3rem">${escapeHtml(p.name)}</h4>
          <div class="price-row"><span class="new-price">${formatLKR(p.new_price)}</span></div>
        `;
        el.addEventListener("click", () => {
          // open related product in product page full-screen
          openProductPage(p);
        });
        relatedGrid.appendChild(el);
      });
      if ((data || []).length === 0) relatedGrid.innerHTML = "<p>No related products.</p>";
    } catch (err) {
      console.error(err);
      relatedGrid.innerHTML = "<p>Error loading related.</p>";
    }
  }

  // ---------- Quantity controls ----------
  incQty?.addEventListener("click", () => {
    if (!qtyInput) return;
    qtyInput.value = Number(qtyInput.value || 1) + 1;
  });
  decQty?.addEventListener("click", () => {
    if (!qtyInput) return;
    qtyInput.value = Math.max(1, Number(qtyInput.value || 1) - 1);
  });

  // ---------- Add to cart & Buy now ----------
  addCartBtn?.addEventListener("click", () => {
    if (!currentProduct) return alert("Please select a product first.");
    const item = {
      id: currentProduct.id,
      name: currentProduct.name,
      price: Number(currentProduct.new_price || 0),
      size: sizeSelect ? sizeSelect.value : "",
      color: colorSelect ? colorSelect.value : "",
      qty: Number(qtyInput ? qtyInput.value : 1),
      image: (currentProduct.images && currentProduct.images[0]) || "",
    };
    addToCart(item);
    alert("Added to cart");
  });

  buyNowBtn?.addEventListener("click", () => {
    if (!currentProduct) return alert("Please select a product first.");
    const cartItem = {
      id: currentProduct.id,
      qty: Number(qtyInput ? qtyInput.value : 1),
      size: sizeSelect ? sizeSelect.value : "",
      color: colorSelect ? colorSelect.value : "",
    };
    localStorage.setItem("sudu_buy_now", JSON.stringify({ product: cartItem, timestamp: Date.now() }));
    window.alert("Proceed to checkout (placeholder). Implement payment gateway to complete.");
  });

  // ---------- Footer year ----------
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // ---------- Initialize: load products & update cart count ----------
  updateCartCountUI();
  loadProducts();

  // ---------- Optional: handle browser back (when user presses back, show sections again) ----------
  // If user uses browser back button while in product detail view, the page may stay same, but we want to restore sections.
  // We'll listen to popstate and also on hashchange as a fallback.
  window.addEventListener("popstate", () => {
    // If productPage is visible, hide it and show main sections
    if (productPage && productPage.style.display !== "none") {
      productPage.style.display = "none";
      showAllMainSections();
    }
  });

  window.addEventListener("hashchange", () => {
    if (productPage && productPage.style.display !== "none") {
      // nothing special — user may use hash navigation
    }
  });

  // ---------- Utility to show all sections (restore) ----------
  function showAllMainSections() {
    document.querySelectorAll("header, section, footer, nav").forEach((el) => {
      el.style.display = "";
    });
  }

  // Expose small functions for debug (optional)
  window.SuduAraliyaDebug = {
    openProductPage,
    loadProducts,
    addToCart,
    getCart,
  };
})();
// =========================
// BACK TO SHOP BUTTON — Sudu Araliya
// =========================
const backBtn = document.getElementById("backToShop");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    // hide product page
    const productPage = document.querySelector(".product-page");
    if (productPage) productPage.style.display = "none";

    // show all other sections again
    document.querySelectorAll("header, section, footer, nav").forEach(el => {
      if (!el.classList.contains("product-page")) el.style.display = "";
    });

    // scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
