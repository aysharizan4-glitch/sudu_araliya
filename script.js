// --- Supabase Setup (already connected) ---
const SUPABASE_URL = "https://jppqpmhxammpwjwaikcd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwcHFwbWh4YW1tcHdqd2Fpa2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMDY0ODcsImV4cCI6MjA3NTg4MjQ4N30.3xfsiPp3qcmEHOJUs_EF_UDpFBX-kPOi79SfvT93HLI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   Sudu Araliya — Admin Panel Toggle
   ========================= */

// --- Config ---
const ADMIN_PASSWORD = "sudu123"; // change this to your own secure password
const SESSION_AUTH_KEY = "sudu_admin_authenticated"; // keeps session until page reload

// --- DOM Elements ---
const adminPanel = document.querySelector(".admin-container");
const adminToggleBtn = document.getElementById("adminToggleBtn");
const closeBtn = document.querySelector(".close-btn");

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  // Hide admin panel by default
  adminPanel.style.display = "none";

  // If already authenticated in this session, show it
  if (sessionStorage.getItem(SESSION_AUTH_KEY) === "true") {
    adminPanel.style.display = "block";
  }
});

// --- Admin Toggle Button ---
adminToggleBtn.addEventListener("click", () => {
  if (adminPanel.style.display === "block") {
    adminPanel.style.display = "none";
    return;
  }

  // Check if already authenticated
  if (sessionStorage.getItem(SESSION_AUTH_KEY) === "true") {
    adminPanel.style.display = "block";
    return;
  }

  // Ask for password
  const password = prompt("Enter admin password:");
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_AUTH_KEY, "true");
    adminPanel.style.display = "block";
  } else {
    alert("Incorrect password ❌");
  }
});

// --- Close Button ---
closeBtn.addEventListener("click", () => {
  adminPanel.style.display = "none";
});
/* =========================
   Step 2 — Product Upload + Render
   ========================= */

// --- DOM Elements ---
const productForm = document.querySelector(".product-form");
const productGrid = document.querySelector(".product-grid");
const demoProducts = document.querySelectorAll(".product-card"); // to hide demo items
const productListAdmin = document.querySelector(".product-list"); // in admin section

// --- Hide demo products initially ---
demoProducts.forEach((item) => (item.style.display = "none"));

// --- Load existing products from Supabase ---
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading products:", error);
    return;
  }

  renderProducts(data);
  renderAdminList(data);
}

// --- Render on shop page ---
function renderProducts(products) {
  productGrid.innerHTML = ""; // clear before render

  if (!products.length) {
    productGrid.innerHTML = `<p>No products yet.</p>`;
    return;
  }

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const stockClass = p.stock === "In Stock" ? "in-stock" : "out-stock";
    const stockText = p.stock === "In Stock" ? "In stock" : "Out of stock";

    card.innerHTML = `
      <div class="stock-badge ${stockClass}">${stockText}</div>
      <img src="${p.image_url || "https://via.placeholder.com/200"}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p class="price">LKR ${Number(p.new_price).toFixed(2)}</p>
    `;
    productGrid.appendChild(card);
  });
}

// --- Render list in admin panel ---
function renderAdminList(products) {
  productListAdmin.innerHTML = "";
  if (!products.length) {
    productListAdmin.innerHTML = `<p>No uploaded products yet.</p>`;
    return;
  }

  products.forEach((p) => {
    const item = document.createElement("div");
    item.className = "product-item";
    item.innerHTML = `
      <img src="${p.image_url || "https://via.placeholder.com/100"}" alt="${p.name}">
      <div class="product-info">
        <h4>${p.name}</h4>
        <p>LKR ${Number(p.new_price).toFixed(2)}</p>
      </div>
      <div class="actions">
        <button class="edit-btn" data-id="${p.id}">Edit</button>
        <button class="delete-btn" data-id="${p.id}">Delete</button>
      </div>
    `;
    productListAdmin.appendChild(item);
  });
}

// --- Add new product ---
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = productForm.querySelector("input[placeholder='Enter product name']").value.trim();
  const discount = productForm.querySelector("input[placeholder='0']").value.trim();
  const sku = productForm.querySelector("input[placeholder='Enter SKU number']").value.trim();
  const newPrice = productForm.querySelector("input[placeholder='0.00']").value.trim();
  const oldPrice = productForm.querySelectorAll("input[placeholder='0.00']")[1].value.trim();
  const category = document.getElementById("category").value.trim();
  const size = productForm.querySelector("input[placeholder='Enter size']").value.trim();
  const color = productForm.querySelector("input[placeholder='write the Colour']").value.trim();
  const stock = productForm.querySelector("input[name='stock']:checked").nextSibling.textContent.trim();
  const description = productForm.querySelector("textarea").value.trim();

  // handle image upload (first image only for now)
  const fileInput = productForm.querySelector("input[type='file']");
  let imageUrl = "";
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("product-images").upload(fileName, file);
    if (error) {
      alert("Image upload failed!");
      console.error(error);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    imageUrl = publicUrlData.publicUrl;
  }

  const product = {
    name,
    discount,
    sku,
    new_price: parseFloat(newPrice),
    old_price: parseFloat(oldPrice),
    category,
    size,
    color,
    stock,
    description,
    image_url: imageUrl,
  };

  const { error } = await supabase.from("products").insert([product]);
  if (error) {
    alert("Upload failed ❌");
 
    return;
  }

  alert("✅ Product added successfully!");
  productForm.reset();
  await loadProducts();
});

// --- Load all on start ---
loadProducts();
