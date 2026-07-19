const initialProducts = [
  {
    id: 1,
    name: 'Kanchipuram Silk Sari',
    category: 'Sarees',
    vendor: 'Vanya Couture',
    price: 2499,
    originalPrice: 3299,
    rating: 4.9,
    reviews: 124,
    stock: 6,
    badge: 'Bestseller',
    description: 'A rich silk sari with intricate zari detailing for weddings and celebrations.',
    image: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 2,
    name: 'Regal Organza Festive Drapes',
    category: 'Sarees',
    vendor: 'Amara Studio',
    price: 1899,
    originalPrice: 2599,
    rating: 4.8,
    reviews: 88,
    stock: 8,
    badge: 'New Arrival',
    description: 'Lightweight organza with an elegant flow for festive brunches and soirees.',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 3,
    name: 'Aurelia Ethnic Kurta Set',
    category: 'Kurtas',
    vendor: 'Rudra House',
    price: 1599,
    originalPrice: 2199,
    rating: 4.7,
    reviews: 73,
    stock: 10,
    badge: 'Trending',
    description: 'A breathable kurta set made for smart casual dressing and festive comfort.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 4,
    name: 'Stellar Fusion Lehenga Top',
    category: 'Fusion',
    vendor: 'Neva Fashion',
    price: 2799,
    originalPrice: 3899,
    rating: 4.9,
    reviews: 105,
    stock: 4,
    badge: 'Limited',
    description: 'A statement fusion top with luxe texture and a modern silhouette.',
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 5,
    name: 'Velvet Banarasi Evening Sari',
    category: 'Sarees',
    vendor: 'Vanya Couture',
    price: 2999,
    originalPrice: 3999,
    rating: 5.0,
    reviews: 162,
    stock: 5,
    badge: 'VIP Pick',
    description: 'A luxurious velvet sari ideal for evening weddings and high-impact celebrations.',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 6,
    name: 'Luna Workwear Co-ord Set',
    category: 'Fusion',
    vendor: 'Neva Fashion',
    price: 1699,
    originalPrice: 2299,
    rating: 4.6,
    reviews: 54,
    stock: 12,
    badge: 'Fresh Drop',
    description: 'A polished co-ord set that moves from workdays to evening plans effortlessly.',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 7,
    name: 'Emerald Bridal Necklace',
    category: 'Jewelry',
    vendor: 'Aarvi Jewels',
    price: 12999,
    originalPrice: 15999,
    rating: 4.8,
    reviews: 41,
    stock: 3,
    badge: 'Jewelry Edit',
    description: 'A bold emerald jewelry piece designed for bridal grandeur and evening elegance.',
    image: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80'
  }
];

const STORAGE_KEY = 'ja-collections-products';

function normalizeProduct(product) {
  const originalPrice = product.originalPrice != null
    ? product.originalPrice
    : product.original_price != null
      ? product.original_price
      : Number(product.price || 0) + 200;

  return Object.assign({}, product, {
    id: Number(product.id),
    price: Number(product.price) || 0,
    originalPrice: Number(originalPrice),
    stock: Number(product.stock) || 0,
    rating: Number(product.rating) || 0,
    reviews: Number(product.reviews) || 0,
    badge: product.badge || 'New',
    description: product.description || 'A premium fashion pick curated for the collection.'
  });
}

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialProducts.map(normalizeProduct);
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeProduct) : initialProducts.map(normalizeProduct);
  } catch (error) {
    console.error('Unable to load saved products', error);
    return initialProducts.map(normalizeProduct);
  }
}

let products = loadProducts();

const state = {
  search: '',
  category: 'all',
  maxPrice: 20000,
  sort: 'featured',
  cart: [],
  wishlist: [],
  editingProductId: null,
  orderCount: 0,
  currentUser: null,
  authMode: 'login',
  csrfToken: null,
  stripeEnabled: false
};

function getRequestHeaders(isJson = true) {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (state.csrfToken) {
    headers['X-CSRF-Token'] = state.csrfToken;
  }
  return headers;
}

const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const categorySelect = document.getElementById('categorySelect');
const newCategoryInput = document.getElementById('newCategoryInput');
const addCategoryButton = document.getElementById('addCategoryButton');
const priceFilter = document.getElementById('priceFilter');
const priceValue = document.getElementById('priceValue');
const sortFilter = document.getElementById('sortFilter');
const clearFilters = document.getElementById('clearFilters');
const cartButton = document.getElementById('cartButton');
const wishlistButton = document.getElementById('wishlistButton');
const cartPanel = document.getElementById('cartPanel');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const wishlistCount = document.getElementById('wishlistCount');
const subtotal = document.getElementById('subtotal');
const activeFilters = document.getElementById('activeFilters');
const adminForm = document.getElementById('adminForm');
const adminMessage = document.getElementById('adminMessage');
const inventoryList = document.getElementById('inventoryList');
const categoriesList = document.getElementById('categoriesList');
const adminOrdersList = document.getElementById('adminOrdersList');
const usersList = document.getElementById('usersList');
const submitProductButton = document.getElementById('submitProductButton');
const liveInventory = document.getElementById('liveInventory');
const liveOrders = document.getElementById('liveOrders');
const liveVendors = document.getElementById('liveVendors');
const checkoutSection = document.getElementById('checkoutSection');
const checkoutToggle = document.getElementById('checkoutToggle');
const checkoutMessage = document.getElementById('checkoutMessage');
const checkoutName = document.getElementById('checkoutName');
const checkoutAddress = document.getElementById('checkoutAddress');
const checkoutPayment = document.getElementById('checkoutPayment');
const placeOrderButton = document.getElementById('placeOrder');
const productModalBackdrop = document.getElementById('productModalBackdrop');
const productModalContent = document.getElementById('productModalContent');
const authButton = document.getElementById('authButton');
const accountButton = document.getElementById('accountButton');
const supportButton = document.getElementById('supportButton');
const authModal = document.getElementById('authModal');
const authClose = document.getElementById('authClose');
const authForm = document.getElementById('authForm');
const authContact = document.getElementById('authContact');
const authPassword = document.getElementById('authPassword');
const authNameRow = document.getElementById('authNameRow');
const authName = document.getElementById('authName');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');
const authModalTitle = document.getElementById('authModalTitle');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const authSwitchText = document.getElementById('authSwitchText');
const authMessage = document.getElementById('authMessage');
const forgotPasswordButton = document.getElementById('forgotPasswordButton');
const profileForm = document.getElementById('profileForm');
const editProfileButton = document.getElementById('editProfileButton');
const profileName = document.getElementById('profileName');
const profileContact = document.getElementById('profileContact');
const profilePassword = document.getElementById('profilePassword');
const saveProfileButton = document.getElementById('saveProfileButton');
const cancelProfileButton = document.getElementById('cancelProfileButton');
const profileMessage = document.getElementById('profileMessage');
const supportModal = document.getElementById('supportModal');
const supportClose = document.getElementById('supportClose');
const bulkProductsInput = document.getElementById('bulkProductsInput');
const bulkImportButton = document.getElementById('bulkImportButton');
const offerInput = document.getElementById('offerInput');
const setOfferButton = document.getElementById('setOfferButton');
const currentOfferText = document.getElementById('currentOfferText');
const offerBanner = document.getElementById('offerBanner');
const offerTitle = document.getElementById('offerTitle');
const offerDescription = document.getElementById('offerDescription');
const offerDiscount = document.getElementById('offerDiscount');
const offerStarts = document.getElementById('offerStarts');
const offerEnds = document.getElementById('offerEnds');
const offerActive = document.getElementById('offerActive');
const createOfferButton = document.getElementById('createOfferButton');
const offersList = document.getElementById('offersList');
const ordersModal = document.getElementById('ordersModal');
const ordersClose = document.getElementById('ordersClose');
const orderList = document.getElementById('orderList');
const accountInfo = document.getElementById('accountInfo');
const logoutButton = document.getElementById('logoutButton');
const adminSection = document.getElementById('adminSection');
const liveStatus = document.getElementById('liveStatus');

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function getFilteredProducts() {
  let filtered = products.filter((product) => {
    const searchText = `${product.name} ${product.vendor} ${product.category}`.toLowerCase();
    const matchesSearch = searchText.includes(state.search.toLowerCase());
    const matchesCategory = state.category === 'all' || product.category === state.category;
    const matchesPrice = product.price <= state.maxPrice;
    return matchesSearch && matchesCategory && matchesPrice;
  });

  switch (state.sort) {
    case 'low':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'high':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    default:
      filtered.sort((a, b) => b.rating - a.rating);
  }

  return filtered;
}

function applyActiveOffer() {
  const active = state.offers && state.offers.find((o) => Number(o.active) === 1);
  state.activeOffer = active || null;
  if (!state.activeOffer) {
    offerBanner.textContent = '✨ New arrivals from top vendors are live now';
    currentOfferText.textContent = 'No active offer yet.';
    return;
  }
  const text = `${state.activeOffer.title} — ${state.activeOffer.discount_percent}% off`;
  offerBanner.textContent = text;
  currentOfferText.textContent = `Active offer: ${state.activeOffer.title} (${state.activeOffer.discount_percent}% off)`;
}

function priceWithOffer(price) {
  if (!state.activeOffer) return price;
  const discount = Number(state.activeOffer.discount_percent) || 0;
  if (!discount) return price;
  return Math.round(price * (1 - discount / 100));
}

function renderProducts() {
  const filtered = getFilteredProducts();
  productGrid.innerHTML = '';

  if (!filtered.length) {
    productGrid.innerHTML = '<div class="empty-state">No products match your current filters. Try broadening your search.</div>';
    return;
  }

  filtered.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    const isWishlisted = state.wishlist.includes(product.id);
    const isInCart = state.cart.some((item) => item.id === product.id);
    const stockText = product.stock > 0 ? `Only ${product.stock} left` : 'Out of stock';

    const displayPrice = priceWithOffer(product.price);
    const hasDiscount = displayPrice !== Number(product.price);
    card.innerHTML = `
      <img class="product-image" src="${product.image}" alt="${product.name}" />
      <div class="product-body">
        <div class="product-meta">
          <span>${product.vendor}</span>
          <span>Rating: ${product.rating}</span>
        </div>
        <p class="badge">${product.badge}</p>
        <p class="stock-pill">${stockText}</p>
        <h4 class="product-name">${product.name}</h4>
        <p class="product-description">${product.description}</p>
        <div class="price-row">
          <span class="price">${formatPrice(displayPrice)}</span>
          <span class="original">${hasDiscount ? formatPrice(product.price) : formatPrice(product.originalPrice)}</span>
        </div>
        <div class="card-actions">
          <button class="ghost" data-wishlist="${product.id}">${isWishlisted ? 'In wishlist' : 'Add to wishlist'}</button>
          <button class="accent" data-cart="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>${product.stock <= 0 ? 'Sold out' : isInCart ? 'Added' : 'Add to cart'}</button>
        </div>
        <div class="card-actions" style="margin-top:8px;">
          <button class="secondary-btn" data-view="${product.id}">Quick view</button>
        </div>
      </div>
    `;

    productGrid.appendChild(card);
  });
}

function updateCounts() {
  cartCount.textContent = state.cart.reduce((total, item) => total + item.quantity, 0);
  wishlistCount.textContent = state.wishlist.length;
  subtotal.textContent = formatPrice(state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

function renderCart() {
  if (!state.cart.length) {
    cartItems.innerHTML = '<div class="empty-state">Your cart is empty. Add a few elegant picks to get started.</div>';
    checkoutSection.hidden = true;
    checkoutMessage.textContent = '';
    updateCounts();
    return;
  }

  cartItems.innerHTML = state.cart
    .map(
      (item) => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div>
            <strong>${item.name}</strong>
            <div>${formatPrice(item.price)} x ${item.quantity}</div>
            <button class="ghost" data-remove="${item.id}">Remove</button>
          </div>
        </div>
      `
    )
    .join('');

  checkoutSection.hidden = false;
  updateCounts();
}

function renderFilters() {
  const tags = [];
  if (state.search) tags.push(`Search: ${state.search}`);
  if (state.category !== 'all') tags.push(`Category: ${state.category}`);
  if (state.maxPrice < 20000) tags.push(`Up to ${formatPrice(state.maxPrice)}`);

  activeFilters.innerHTML = tags.length ? tags.map((tag) => `<span>${tag}</span>`).join('') : '<span>All favorites</span>';
}

function renderInsights() {
  const inStockCount = products.filter((product) => product.stock > 0).length;
  liveInventory.textContent = `${inStockCount} live products`;
  liveOrders.textContent = `${state.orderCount} orders today`;
  liveVendors.textContent = `${new Set(products.map((product) => product.vendor)).size} premium partners`;
  if (liveStatus) {
    liveStatus.textContent = 'Live marketplace sync active';
  }
}

function updateAuthButtons() {
  if (state.currentUser) {
    authButton.classList.add('hidden');
    accountButton.classList.remove('hidden');
    accountButton.textContent = `Hi, ${state.currentUser.name}`;
    if (adminSection) {
      adminSection.classList.toggle('hidden', state.currentUser.role !== 'admin');
      if (state.currentUser.role === 'admin') {
        startAdminOrdersPolling();
        fetchAdminUsers();
      } else {
        stopAdminOrdersPolling();
      }
    }
  } else {
    authButton.classList.remove('hidden');
    accountButton.classList.add('hidden');
    if (adminSection) {
      adminSection.classList.add('hidden');
      stopAdminOrdersPolling();
    }
  }
}

function fetchAdminUsers() {
  if (!state.currentUser || state.currentUser.role !== 'admin') return;
  fetch('/api/admin/users').then((r) => r.json()).then((data) => {
    if (data && data.success) {
      state.adminUsers = data.users || [];
      renderAdminUsers();
    }
  }).catch((err) => console.error('Failed to fetch users', err));
}

function renderAdminUsers() {
  if (!usersList) return;
  const users = state.adminUsers || [];
  if (!users.length) {
    usersList.innerHTML = '<div class="empty-state">No users found.</div>';
    return;
  }
  usersList.innerHTML = users.map((u) => `
    <div class="user-row">
      <div class="user-info"><strong>${u.name}</strong> — ${u.email || u.phone || 'No contact'}</div>
      <div class="user-actions">
        <button data-action="toggle-role" data-user="${u.id}">${u.role === 'admin' ? 'Demote' : 'Promote'}</button>
        <button data-action="toggle-disabled" data-user="${u.id}">${u.disabled ? 'Enable' : 'Disable'}</button>
        <button data-action="reset-password" data-user="${u.id}">Reset Password</button>
      </div>
    </div>
  `).join('');
}

if (usersList) {
  usersList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const userId = btn.getAttribute('data-user');
    if (!action || !userId) return;
    if (action === 'toggle-role') {
      const user = (state.adminUsers || []).find((x) => String(x.id) === String(userId));
      const newRole = user && user.role === 'admin' ? 'customer' : 'admin';
      fetch(`/api/admin/users/${userId}`, {
        method: 'PUT', headers: getRequestHeaders(),
        body: JSON.stringify({role: newRole})
      }).then((r) => r.json()).then((data) => { if (data.success) fetchAdminUsers(); else alert(data.message || 'Failed'); });
    }
    if (action === 'toggle-disabled') {
      const user = (state.adminUsers || []).find((x) => String(x.id) === String(userId));
      const nowDisabled = user && user.disabled ? false : true;
      fetch(`/api/admin/users/${userId}`, {
        method: 'PUT', headers: getRequestHeaders(),
        body: JSON.stringify({disabled: nowDisabled})
      }).then((r) => r.json()).then((data) => { if (data.success) fetchAdminUsers(); else alert(data.message || 'Failed'); });
    }
    if (action === 'reset-password') {
      const newPass = prompt('Enter temporary password for user:');
      if (!newPass) return;
      fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST', headers: getRequestHeaders(),
        body: JSON.stringify({password: newPass})
      }).then((r) => r.json()).then((data) => { if (data.success) alert('Password reset'); else alert(data.message || 'Failed'); });
    }
  });
}

function setAuthMessage(message) {
  authMessage.textContent = message;
}

function openAuthModal(mode = 'login') {
  state.authMode = mode;
  authModal.classList.remove('hidden');
  authNameRow.classList.toggle('hidden', mode !== 'register');
  forgotPasswordButton.classList.toggle('hidden', mode !== 'login');
  authModalTitle.textContent = mode === 'login' ? 'Sign in to JA Collections' : mode === 'register' ? 'Create your JA Collections account' : 'Reset your password';
  authSwitchText.textContent = mode === 'login' ? 'New to JA Collections?' : mode === 'register' ? 'Already have an account?' : 'Remembered your password?';
  toggleAuthMode.textContent = mode === 'login' ? 'Create account' : 'Sign in';
  authSubmit.textContent = mode === 'login' ? 'Continue' : mode === 'register' ? 'Create account' : 'Reset password';
  authContact.placeholder = mode === 'register' ? 'Email or mobile number' : mode === 'reset' ? 'Email or mobile number' : 'Email or mobile number';
  authPassword.placeholder = mode === 'reset' ? 'New password' : 'Enter password';
  authContact.value = authContact.value.trim();
  authPassword.value = '';
  if (mode === 'register') {
    authName.value = authName.value.trim();
  }
  setAuthMessage('');
}

function closeAuthModal() {
  authModal.classList.add('hidden');
}

async function openSupportModal() {
  supportModal.classList.remove('hidden');
  try {
    const resp = await fetch('/api/support');
    const payload = resp.ok ? await resp.json() : null;
    const support = payload && payload.support ? payload.support : { email: 'admin@jacollections.com', phone: '+919876543210' };
    const detailsEl = supportModal.querySelector('.support-details');
    const isAdmin = state.currentUser && state.currentUser.role === 'admin';
    detailsEl.innerHTML = `
      <p><strong>Email:</strong> <a href="mailto:${support.email}">${support.email}</a></p>
      <p><strong>Phone:</strong> <a href="tel:${support.phone}">${support.phone}</a></p>
      <p>Available 10am–8pm daily.</p>
      ${isAdmin ? '<button id="supportEditButton" class="secondary-btn">Edit support</button>' : ''}
      <div id="supportEditor" class="hidden">
        <label><span>Email</span><input id="supportEmailInput" type="text" value="' + (support.email || '') + '" /></label>
        <label><span>Phone</span><input id="supportPhoneInput" type="text" value="' + (support.phone || '') + '" /></label>
        <button id="saveSupportButton" class="primary-btn">Save</button>
        <div id="supportMessage" class="auth-message"></div>
      </div>
    `;

    const editBtn = detailsEl.querySelector('#supportEditButton');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        detailsEl.querySelector('#supportEditor').classList.remove('hidden');
        editBtn.classList.add('hidden');
      });
    }

    const saveBtn = detailsEl.querySelector('#saveSupportButton');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const emailInput = detailsEl.querySelector('#supportEmailInput');
        const phoneInput = detailsEl.querySelector('#supportPhoneInput');
        const msgEl = detailsEl.querySelector('#supportMessage');
        const payload = { email: (emailInput.value || '').trim(), phone: (phoneInput.value || '').trim() };
        try {
          const r = await fetch('/api/support', { method: 'PUT', headers: getRequestHeaders(), body: JSON.stringify(payload) });
          const res = await r.json();
          if (!r.ok) {
            msgEl.textContent = res.message || 'Unable to update support details.';
            return;
          }
          msgEl.textContent = 'Support details updated.';
          // re-render to show updated contacts and hide editor
          setTimeout(() => openSupportModal(), 700);
        } catch (err) {
          msgEl.textContent = 'Unable to update support details.';
        }
      });
    }
  } catch (error) {
    console.warn('Failed to load support info', error);
  }
}

function closeSupportModal() {
  supportModal.classList.add('hidden');
}

function updateOfferBanner(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    offerBanner.textContent = '✨ New arrivals from top vendors are live now';
    currentOfferText.textContent = 'No active offer yet.';
    return;
  }
  offerBanner.textContent = trimmed;
  currentOfferText.textContent = `Active offer: ${trimmed}`;
}

async function renderAccountInfo() {
  if (!state.currentUser) {
    accountInfo.innerHTML = '<p>Please sign in to view your profile and orders.</p>';
    return;
  }
  let supportInfo = { email: 'admin@jacollections.com', phone: '+919876543210' };
  try {
    const resp = await fetch('/api/support');
    if (resp.ok) {
      const payload = await resp.json();
      if (payload && payload.support) supportInfo = payload.support;
    }
  } catch (err) {
    console.warn('Failed to load support info for account panel', err);
  }
  accountInfo.innerHTML = `
    <div class="account-summary">
      <p><strong>Name:</strong> ${state.currentUser.name}</p>
      <p><strong>Email:</strong> ${state.currentUser.email || 'Not set'}</p>
      <p><strong>Phone:</strong> ${state.currentUser.phone || 'Not set'}</p>
      <p><strong>Role:</strong> ${state.currentUser.role}</p>
      <p><strong>Support:</strong> <a href="mailto:${supportInfo.email}">${supportInfo.email}</a> | <a href="tel:${supportInfo.phone}">${supportInfo.phone}</a></p>
    </div>
  `;
}

function showProfileEditor() {
  if (!state.currentUser) return;
  profileForm.classList.remove('hidden');
  profileName.value = state.currentUser.name || '';
  profileContact.value = state.currentUser.email || state.currentUser.phone || '';
  profilePassword.value = '';
  profileMessage.textContent = '';
}

function hideProfileEditor() {
  profileForm.classList.add('hidden');
  profileMessage.textContent = '';
}

async function saveProfile() {
  if (!state.currentUser) return;
  const payload = {
    name: profileName.value.trim(),
    contact: profileContact.value.trim(),
    password: profilePassword.value.trim()
  };

  if (!payload.name || !payload.contact) {
    profileMessage.textContent = 'Please provide a name and contact.';
    return;
  }

  try {
    const response = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      profileMessage.textContent = result.message || 'Unable to update your profile.';
      return;
    }
      state.currentUser = result.user;
      await renderAccountInfo();
    profileMessage.textContent = 'Profile updated successfully.';
    hideProfileEditor();
    updateAuthButtons();
  } catch (error) {
    profileMessage.textContent = 'Unable to save profile now.';
  }
}

async function openOrdersModal() {
  await renderAccountInfo();
  ordersModal.classList.remove('hidden');
  fetchOrders();
}

function closeOrdersModal() {
  ordersModal.classList.add('hidden');
}

function renderOrders(orders) {
  if (!orders.length) {
    orderList.innerHTML = '<p class="empty-state">No orders yet. Start shopping to place your first order.</p>';
    return;
  }

  orderList.innerHTML = orders
    .map((order) => {
      const createdAt = order.created_at ? new Date(order.created_at).toLocaleString() : new Date(order.id * 1000).toLocaleString();
      const itemCount = Array.isArray(order.items) ? order.items.length : (String(order.items).match(/\{/g) || []).length;
      return `
        <div class="order-item">
          <div class="order-meta">
            <strong>Order #${order.id}</strong>
            <span>${order.status}</span>
          </div>
          <div>${createdAt}</div>
          <div>${itemCount} items • ${order.payment_method || 'COD'}</div>
          <div class="order-total">Total: ${formatPrice(order.total)}</div>
        </div>
      `;
    })
    .join('');
}

async function fetchAdminOrders() {
  if (!state.currentUser || state.currentUser.role !== 'admin') return;
  try {
    const resp = await fetch('/api/orders');
    if (!resp.ok) throw new Error('Unable to fetch orders');
    const payload = await resp.json();
    if (payload && Array.isArray(payload.orders)) {
      renderAdminOrders(payload.orders);
    }
  } catch (err) {
    console.warn('fetchAdminOrders failed', err);
  }
}

function renderAdminOrders(orders) {
  if (!adminOrdersList) return;
  if (!orders.length) {
    adminOrdersList.innerHTML = '<p class="empty-state">No orders found.</p>';
    return;
  }
  adminOrdersList.innerHTML = orders.map((o) => `
    <div class="admin-order-item" data-id="${o.id}">
      <div class="order-meta"><strong>Order #${o.id}</strong> <span>${o.status}</span></div>
      <div class="order-items">Items: ${o.items}</div>
      <div class="order-total">Total: ${formatPrice(o.total)}</div>
      <div class="order-actions">
        <select data-action="set-status" data-id="${o.id}">
          <option value="pending" ${o.status==='pending' ? 'selected' : ''}>pending</option>
          <option value="confirmed" ${o.status==='confirmed' ? 'selected' : ''}>confirmed</option>
          <option value="shipped" ${o.status==='shipped' ? 'selected' : ''}>shipped</option>
          <option value="delivered" ${o.status==='delivered' ? 'selected' : ''}>delivered</option>
          <option value="cancelled" ${o.status==='cancelled' ? 'selected' : ''}>cancelled</option>
        </select>
        <button data-action="delete-order" data-id="${o.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

if (adminOrdersList) {
  adminOrdersList.addEventListener('change', async (ev) => {
    const sel = ev.target.closest('select[data-action="set-status"]');
    if (!sel) return;
    const id = sel.getAttribute('data-id');
    const status = sel.value;
    try {
      const r = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: getRequestHeaders(), body: JSON.stringify({ status }) });
      const p = await r.json();
      if (!r.ok) return setAdminMessage(p.message || 'Unable to update order');
      setAdminMessage('Order status updated');
      await fetchAdminOrders();
    } catch (err) {
      console.error(err);
      setAdminMessage('Unable to update order');
    }
  });

  adminOrdersList.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action="delete-order"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!confirm('Delete this order?')) return;
    try {
      const r = await fetch(`/api/orders/${id}`, { method: 'DELETE', headers: getRequestHeaders(false) });
      const p = await r.json();
      if (!r.ok) return setAdminMessage(p.message || 'Unable to delete order');
      setAdminMessage('Order deleted');
      await fetchAdminOrders();
    } catch (err) {
      console.error(err);
      setAdminMessage('Unable to delete order');
    }
  });
}

let adminOrdersPolling = null;
function startAdminOrdersPolling() {
  if (adminOrdersPolling) return;
  fetchAdminOrders();
  adminOrdersPolling = setInterval(fetchAdminOrders, 5000);
}
function stopAdminOrdersPolling() {
  if (!adminOrdersPolling) return;
  clearInterval(adminOrdersPolling);
  adminOrdersPolling = null;
}

// Socket.IO client (optional). Safe no-op if socket script not loaded.
if (typeof io !== 'undefined') {
  const socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    console.info('socket connected');
    if (state.currentUser && state.currentUser.role === 'admin') {
      setAdminMessage('Live updates enabled');
    }
  });
  socket.on('disconnect', () => {
    console.info('socket disconnected');
    if (state.currentUser && state.currentUser.role === 'admin') {
      setAdminMessage('Live updates temporarily disconnected');
    }
  });
  socket.on('order_created', (order) => {
    if (state.currentUser && state.currentUser.role === 'admin') {
      fetchAdminOrders();
    }
  });
  socket.on('order_updated', (order) => {
    if (state.currentUser && state.currentUser.role === 'admin') {
      fetchAdminOrders();
    }
  });
  socket.on('product_created', () => {
    loadProductsFromApi();
  });
  socket.on('product_updated', () => {
    loadProductsFromApi();
  });
  socket.on('product_deleted', () => {
    loadProductsFromApi();
  });
  socket.on('offer_created', () => {
    fetchOffers();
  });
  socket.on('offer_updated', () => {
    fetchOffers();
  });
  socket.on('offer_deleted', () => {
    fetchOffers();
  });
}

async function fetchOrders() {
  try {
    const response = await fetch('/api/orders');
    if (!response.ok) throw new Error('Unable to load orders');
    const payload = await response.json();
    if (payload.orders) {
      renderOrders(payload.orders);
    }
  } catch (error) {
    orderList.innerHTML = '<p class="empty-state">Unable to load your orders right now.</p>';
  }
}

async function fetchStripeConfig() {
  try {
    const response = await fetch('/api/stripe/config');
    if (!response.ok) throw new Error('Stripe config unavailable');
    const payload = await response.json();
    state.stripeEnabled = Boolean(payload.enabled);
  } catch (_error) {
    state.stripeEnabled = false;
  }
  updateCheckoutOptions();
}

function updateCheckoutOptions() {
  const cardOption = checkoutPayment.querySelector('option[value="Card"]');
  if (!cardOption) return;
  if (!state.stripeEnabled) {
    cardOption.disabled = true;
    if (checkoutPayment.value === 'Card') {
      checkoutPayment.value = 'COD';
    }
  } else {
    cardOption.disabled = false;
  }
}

async function loadUser() {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) throw new Error('Not signed in');
    const payload = await response.json();
    state.currentUser = payload.user;
    state.csrfToken = payload.csrf_token || state.csrfToken;
  } catch (_error) {
    state.currentUser = null;
    state.csrfToken = null;
  }
  updateAuthButtons();
}

async function submitAuthForm(event) {
  event.preventDefault();
  setAuthMessage('');
  const payload = {
    contact: authContact.value.trim(),
    password: authPassword.value.trim()
  };

  if (!payload.contact) {
    return setAuthMessage('Please enter an email or mobile number.');
  }

  if (!payload.password) {
    return setAuthMessage(state.authMode === 'reset' ? 'Please enter a new password.' : 'Please enter your password.');
  }

  if (state.authMode === 'register') {
    payload.name = authName.value.trim();
    if (!payload.name) {
      return setAuthMessage('Please enter your name.');
    }
  }

  try {
    let url;
    if (state.authMode === 'login') {
      url = '/api/auth/login';
    } else if (state.authMode === 'register') {
      url = '/api/auth/register';
    } else {
      url = '/api/auth/reset-password';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      return setAuthMessage(result.message || 'Authentication failed.');
    }

    if (state.authMode === 'register') {
      openAuthModal('login');
      setAuthMessage('Account created! Please sign in with your contact and password.');
      return;
    }

    if (state.authMode === 'reset') {
      openAuthModal('login');
      setAuthMessage('Password reset successfully. Please sign in.');
      return;
    }

    await loadUser();
    // If support modal is open, refresh it so admin edit controls appear immediately
    if (supportModal && !supportModal.classList.contains('hidden')) {
      openSupportModal();
    }
    closeAuthModal();
  } catch (error) {
    setAuthMessage('Unable to connect to authentication service.');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getRequestHeaders() });
  } catch (error) {
    console.warn('Logout failed', error);
  }
  state.currentUser = null;
  state.csrfToken = null;
  updateAuthButtons();
  closeOrdersModal();
}

function renderInventory() {
  inventoryList.innerHTML = products
    .map(
      (product) => `
        <div class="inventory-item">
          <div>
            <strong>${product.name}</strong>
            <div>${product.vendor} - stock ${product.stock}</div>
          </div>
          <div class="inventory-actions">
            <button data-action="edit" data-id="${product.id}">Edit</button>
            <button data-action="restock" data-id="${product.id}">Restock</button>
            <button data-action="delete" data-id="${product.id}">Delete</button>
          </div>
        </div>
      `
    )
    .join('');
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

async function loadProductsFromApi() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Unable to load products');
    const payload = await response.json();
    if (Array.isArray(payload.products)) {
      if (payload.products.length > 0) {
        products = payload.products.map(normalizeProduct);
        saveProducts();
      } else if (!products.length) {
        products = initialProducts.map(normalizeProduct);
      }
      renderAll();
      return;
    }
  } catch (error) {
    console.warn('Falling back to local product data', error);
  }

  products = loadProducts();
  // attempt to load categories to populate admin select
  try {
    const cResp = await fetch('/api/categories');
    if (cResp.ok) {
      const cPayload = await cResp.json();
      if (Array.isArray(cPayload.categories) && typeof populateCategorySelect === 'function') {
        populateCategorySelect(cPayload.categories);
      }
    }
  } catch (err) {
    console.warn('Unable to load categories', err);
  }

  renderAll();
}


async function fetchCategories() {
  try {
    const resp = await fetch('/api/categories');
    if (!resp.ok) throw new Error('Unable to load categories');
    const payload = await resp.json();
    if (Array.isArray(payload.categories)) {
      renderCategories(payload.categories);
      populateCategorySelect(payload.categories);
    }
  } catch (err) {
    console.warn('fetchCategories failed', err);
  }
}

async function fetchOffers() {
  try {
    const resp = await fetch('/api/offers');
    if (!resp.ok) throw new Error('Unable to load offers');
    const payload = await resp.json();
    if (Array.isArray(payload.offers)) {
      state.offers = payload.offers;
      renderOffers(payload.offers);
      applyActiveOffer();
      renderProducts();
    }
  } catch (err) {
    console.warn('fetchOffers failed', err);
  }
}

function renderOffers(offers) {
  if (!offersList) return;
  if (!offers.length) {
    offersList.innerHTML = '<p class="empty-state">No offers yet.</p>';
    return;
  }
  offersList.innerHTML = offers.map((o) => `
    <div class="offer-item" data-id="${o.id}">
      <div><strong>${o.title}</strong> — ${o.discount_percent}%</div>
      <div>${o.description || ''}</div>
      <div class="offer-actions">
        <label><input type="checkbox" data-action="toggle-active" data-id="${o.id}" ${o.active ? 'checked' : ''}/> Active</label>
        <button data-action="edit-offer" data-id="${o.id}">Edit</button>
        <button data-action="delete-offer" data-id="${o.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

if (createOfferButton) {
  createOfferButton.addEventListener('click', async () => {
    const title = (offerTitle.value || '').trim();
    const description = (offerDescription.value || '').trim();
    const discount = Number(offerDiscount.value) || 0;
    const starts_at = offerStarts.value || null;
    const ends_at = offerEnds.value || null;
    const active = !!offerActive.checked;
    if (!title || discount <= 0) return setAdminMessage('Provide title and discount%');
    try {
      const r = await fetch('/api/offers', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ title, description, discount_percent: discount, starts_at, ends_at, active }) });
      const p = await r.json();
      if (!r.ok) return setAdminMessage(p.message || 'Unable to create offer');
      setAdminMessage('Offer created');
      offerTitle.value = '';
      offerDescription.value = '';
      offerDiscount.value = 10;
      offerStarts.value = '';
      offerEnds.value = '';
      offerActive.checked = false;
      await fetchOffers();
    } catch (err) {
      console.error(err);
      setAdminMessage('Unable to create offer');
    }
  });
}

if (offersList) {
  offersList.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (action === 'edit-offer') {
      const o = state.offers.find((x) => String(x.id) === String(id));
      if (!o) return;
      const newTitle = window.prompt('Title', o.title);
      if (newTitle === null) return;
      const newDesc = window.prompt('Description', o.description || '') || '';
      const newDiscount = window.prompt('Discount %', String(o.discount_percent || 0));
      try {
        const r = await fetch(`/api/offers/${id}`, { method: 'PUT', headers: getRequestHeaders(), body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim(), discount_percent: Number(newDiscount) || 0 }) });
        const p = await r.json();
        if (!r.ok) return setAdminMessage(p.message || 'Unable to update offer');
        setAdminMessage('Offer updated');
        await fetchOffers();
      } catch (err) {
        console.error(err);
        setAdminMessage('Unable to update offer');
      }
    } else if (action === 'delete-offer') {
      if (!confirm('Delete this offer?')) return;
      try {
        const r = await fetch(`/api/offers/${id}`, { method: 'DELETE', headers: getRequestHeaders(false) });
        const p = await r.json();
        if (!r.ok) return setAdminMessage(p.message || 'Unable to delete offer');
        setAdminMessage('Offer deleted');
        await fetchOffers();
      } catch (err) {
        console.error(err);
        setAdminMessage('Unable to delete offer');
      }
    }
  });

  offersList.addEventListener('change', async (ev) => {
    const chk = ev.target.closest('input[data-action="toggle-active"]');
    if (!chk) return;
    const id = chk.getAttribute('data-id');
    const active = chk.checked;
    try {
      const r = await fetch(`/api/offers/${id}`, { method: 'PUT', headers: getRequestHeaders(), body: JSON.stringify({ active }) });
      const p = await r.json();
      if (!r.ok) return setAdminMessage(p.message || 'Unable to set active');
      setAdminMessage('Offer updated');
      await fetchOffers();
    } catch (err) {
      console.error(err);
      setAdminMessage('Unable to set active');
    }
  });
}

function renderCategories(categories) {
  if (!categoriesList) return;
  if (!categories.length) {
    categoriesList.innerHTML = '<p class="empty-state">No categories yet.</p>';
    return;
  }
  categoriesList.innerHTML = categories.map((c) => `
    <div class="category-item" data-id="${c.id}">
      <div>${c.name}</div>
      <div class="category-actions">
        <button data-action="edit" data-id="${c.id}">Edit</button>
        <button data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

if (categoriesList) {
  categoriesList.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!action || !id) return;
    if (action === 'edit') {
      const newName = window.prompt('New category name:');
      if (!newName) return;
      try {
        const r = await fetch(`/api/categories/${id}`, { method: 'PUT', headers: getRequestHeaders(), body: JSON.stringify({ name: newName }) });
        const p = await r.json();
        if (!r.ok) return setAdminMessage(p.message || 'Unable to update category');
        setAdminMessage('Category updated');
        await fetchCategories();
        await loadProductsFromApi();
      } catch (err) {
        console.error(err);
        setAdminMessage('Unable to update category');
      }
    } else if (action === 'delete') {
      if (!confirm('Delete this category? Products will move to "Uncategorized".')) return;
      try {
        const r = await fetch(`/api/categories/${id}`, { method: 'DELETE', headers: getRequestHeaders(false) });
        const p = await r.json();
        if (!r.ok) return setAdminMessage(p.message || 'Unable to delete category');
        setAdminMessage('Category deleted');
        await fetchCategories();
        await loadProductsFromApi();
      } catch (err) {
        console.error(err);
        setAdminMessage('Unable to delete category');
      }
    }
  });
}


function populateCategorySelect(categories) {
  if (!categorySelect) return;
  const opts = categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
  categorySelect.innerHTML = opts;
}

function setAdminMessage(message) {
  adminMessage.textContent = message;
}

function resetAdminForm() {
  adminForm.reset();
  state.editingProductId = null;
  submitProductButton.textContent = 'Add product to catalog';
}

function populateAdminForm(product) {
  if (!product) {
    resetAdminForm();
    return;
  }

  state.editingProductId = product.id;
  submitProductButton.textContent = 'Update product';
  const formElements = adminForm.elements;
  formElements.name.value = product.name;
  formElements.category.value = product.category;
  formElements.vendor.value = product.vendor;
  formElements.price.value = product.price;
  formElements.originalPrice.value = product.originalPrice;
  formElements.stock.value = product.stock;
  formElements.rating.value = product.rating;
  formElements.reviews.value = product.reviews;
  formElements.badge.value = product.badge;
  formElements.image.value = product.image;
  formElements.description.value = product.description;
}

async function handleAdminSubmit(event) {
  event.preventDefault();
  const formData = new FormData(adminForm);
  const productData = {
    name: String(formData.get('name') || '').trim(),
    category: String(formData.get('category') || 'Sarees').trim(),
    vendor: String(formData.get('vendor') || '').trim(),
    price: Number(formData.get('price')) || 0,
    originalPrice: Number(formData.get('originalPrice')) || 0,
    stock: Number(formData.get('stock')) || 0,
    rating: Number(formData.get('rating')) || 4.7,
    reviews: Number(formData.get('reviews')) || 0,
    badge: String(formData.get('badge') || 'Admin Added').trim(),
    image: String(formData.get('image') || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80').trim(),
    description: String(formData.get('description') || 'A premium fashion pick curated for the collection.').trim()
  };

  if (!productData.name || !productData.vendor || productData.price <= 0 || productData.originalPrice <= 0) {
    setAdminMessage('Please provide valid product details.');
    return;
  }

  if (productData.originalPrice < productData.price) {
    productData.originalPrice = productData.price + 200;
  }

  try {
    const endpoint = state.editingProductId ? `/api/products/${state.editingProductId}` : '/api/products';
    const method = state.editingProductId ? 'PUT' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: getRequestHeaders(),
      body: JSON.stringify(productData)
    });

    if (!response.ok) throw new Error('Unable to save product');
    const payload = await response.json();
    setAdminMessage(payload.message || `${productData.name} was updated.`);
    resetAdminForm();
    await loadProductsFromApi();
  } catch (error) {
    console.error(error);
    setAdminMessage('The product could not be saved right now.');
  }
}

async function importBulkProducts() {
  if (!bulkProductsInput) return;
  const rawText = bulkProductsInput.value.trim();
  if (!rawText) {
    setAdminMessage('Paste JSON for your full inventory before importing.');
    return;
  }

  let productsPayload;
  try {
    productsPayload = JSON.parse(rawText);
  } catch (error) {
    setAdminMessage('Invalid JSON. Please provide a valid product array.');
    return;
  }

  if (!Array.isArray(productsPayload) || !productsPayload.length) {
    setAdminMessage('Please provide a JSON array of products to import.');
    return;
  }

  try {
    const response = await fetch('/api/products/import', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ products: productsPayload })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to import products.');
    }

    setAdminMessage(`${payload.imported_count || 0} products imported successfully.`);
    bulkProductsInput.value = '';
    await fetchCategories();
    await loadProductsFromApi();
  } catch (error) {
    console.error(error);
    setAdminMessage(error.message || 'Bulk import failed.');
  }
}

function addToCart(productId) {
  const product = products.find((item) => item.id === Number(productId));
  if (!product || product.stock <= 0) return;

  const existingItem = state.cart.find((item) => item.id === product.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }

  product.stock -= 1;
  saveProducts();
  renderAll();
}

function toggleWishlist(productId) {
  const id = Number(productId);
  if (state.wishlist.includes(id)) {
    state.wishlist = state.wishlist.filter((item) => item !== id);
  } else {
    state.wishlist.push(id);
  }
  renderProducts();
  updateCounts();
}

function openProductModal(productId) {
  const product = products.find((item) => item.id === Number(productId));
  if (!product) return;

  const deliveryEstimate = product.stock > 0 ? 'Dispatched in 1-2 business days' : 'Currently out of stock';
  const trustHighlights = [
    'Authenticity verified by JA Collections',
    'Free shipping above ₹999',
    deliveryEstimate,
    'Secure packaging and careful handling'
  ];

  productModalContent.innerHTML = `
    <div class="modal-grid modal-product-detail">
      <img class="modal-image" src="${product.image}" alt="${product.name}" />
      <div>
        <p class="badge">${product.badge}</p>
        <h3>${product.name}</h3>
        <div class="product-description-block">
          <p class="product-description">${product.description}</p>
          <ul class="trust-list">
            ${trustHighlights.map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </div>
        <div class="price-row">
          <span class="price">${formatPrice(priceWithOffer(product.price))}</span>
          <span class="original">${formatPrice(product.price)}</span>
        </div>
        <div class="product-meta-block">
          <p><strong>Vendor:</strong> ${product.vendor}</p>
          <p><strong>Category:</strong> ${product.category}</p>
          <p><strong>Stock:</strong> ${product.stock > 0 ? `${product.stock} available` : 'Out of stock'}</p>
          <p><strong>Rating:</strong> ${product.rating} ★ (${product.reviews} reviews)</p>
        </div>
        <button class="primary-btn" data-cart="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>${product.stock <= 0 ? 'Sold out' : 'Add to cart'}</button>
      </div>
    </div>
  `;
  productModalBackdrop.classList.remove('hidden');
}

function closeProductModal() {
  productModalBackdrop.classList.add('hidden');
  productModalContent.innerHTML = '';
}

function updateCountdown() {
  const target = new Date();
  target.setHours(target.getHours() + 6);
  const countdown = document.getElementById('countdown');
  const tick = () => {
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) {
      countdown.textContent = 'Deal ended';
      return;
    }
    const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
    const mins = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
    const secs = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
    countdown.textContent = `${hours}h ${mins}m ${secs}s`;
  };
  tick();
  setInterval(tick, 1000);
}

function renderAll() {
  renderProducts();
  renderCart();
  renderFilters();
  renderInsights();
  renderInventory();
  updateCounts();
}

searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderProducts();
  renderFilters();
});

categoryFilter.addEventListener('change', (event) => {
  state.category = event.target.value;
  renderProducts();
  renderFilters();
});

priceFilter.addEventListener('input', (event) => {
  state.maxPrice = Number(event.target.value);
  priceValue.textContent = formatPrice(state.maxPrice);
  renderProducts();
  renderFilters();
});

sortFilter.addEventListener('change', (event) => {
  state.sort = event.target.value;
  renderProducts();
});

clearFilters.addEventListener('click', () => {
  state.search = '';
  state.category = 'all';
  state.maxPrice = 20000;
  state.sort = 'featured';
  searchInput.value = '';
  categoryFilter.value = 'all';
  priceFilter.value = 20000;
  priceValue.textContent = formatPrice(20000);
  sortFilter.value = 'featured';
  renderProducts();
  renderFilters();
});

cartButton.addEventListener('click', () => {
  cartPanel.classList.add('open');
});

wishlistButton.addEventListener('click', () => {
  cartPanel.classList.add('open');
  const favoriteProducts = products.filter((product) => state.wishlist.includes(product.id));
  cartItems.innerHTML = favoriteProducts.length
    ? favoriteProducts.map((product) => `<div class="cart-item"><div><strong>${product.name}</strong><div>${formatPrice(product.price)}</div></div></div>`).join('')
    : '<div class="empty-state">No wishlist items yet.</div>';
  checkoutSection.hidden = true;
});

closeCart.addEventListener('click', () => {
  cartPanel.classList.remove('open');
});

adminForm.addEventListener('submit', handleAdminSubmit);

inventoryList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const productId = Number(button.getAttribute('data-id'));
  const action = button.getAttribute('data-action');
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  if (action === 'delete') {
    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE', headers: getRequestHeaders(false) });
      if (!response.ok) throw new Error('Delete failed');
      await loadProductsFromApi();
      setAdminMessage(`${product.name} was removed.`);
    } catch (error) {
      console.error(error);
      setAdminMessage('The product could not be removed.');
    }
  } else if (action === 'restock') {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: getRequestHeaders(),
        body: JSON.stringify({ ...product, stock: Number(product.stock) + 8 })
      });
      if (!response.ok) throw new Error('Restock failed');
      await loadProductsFromApi();
      setAdminMessage(`${product.name} was restocked.`);
    } catch (error) {
      console.error(error);
      setAdminMessage('The product could not be restocked.');
    }
  } else if (action === 'edit') {
    populateAdminForm(product);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const productId = button.getAttribute('data-cart') || button.getAttribute('data-wishlist') || button.getAttribute('data-view');
  if (button.hasAttribute('data-cart')) {
    addToCart(productId);
  }
  if (button.hasAttribute('data-wishlist')) {
    toggleWishlist(productId);
  }
  if (button.hasAttribute('data-view')) {
    openProductModal(productId);
  }
});

cartItems.addEventListener('click', (event) => {
  const removeButton = event.target.closest('button[data-remove]');
  if (!removeButton) return;
  const productId = Number(removeButton.getAttribute('data-remove'));
  const cartItem = state.cart.find((item) => item.id === productId);
  const product = products.find((item) => item.id === productId);
  if (product && cartItem) {
    product.stock += cartItem.quantity;
  }
  state.cart = state.cart.filter((item) => item.id !== productId);
  saveProducts();
  renderAll();
});

checkoutToggle.addEventListener('click', () => {
  if (!state.cart.length) {
    checkoutMessage.textContent = 'Add items to the cart before checkout.';
    return;
  }
  checkoutSection.hidden = !checkoutSection.hidden;
});

checkoutPayment.addEventListener('change', () => {
  const detailRow = document.getElementById('paymentDetailRow');
  const detailLabel = document.getElementById('paymentDetailLabel');
  const detailInput = document.getElementById('paymentDetailInput');
  if (checkoutPayment.value === 'COD') {
    detailRow.classList.add('hidden');
    detailInput.placeholder = 'No payment details required for COD';
    return;
  }
  if (checkoutPayment.value === 'Card' && !state.stripeEnabled) {
    detailRow.classList.add('hidden');
    checkoutMessage.textContent = 'Card checkout is currently unavailable. Please choose COD.';
    checkoutPayment.value = 'COD';
    return;
  }
  detailRow.classList.remove('hidden');
  detailLabel.textContent = checkoutPayment.value === 'Card' ? 'Card number' : 'UPI ID';
  detailInput.placeholder = checkoutPayment.value === 'Card' ? 'Enter card number' : 'Enter UPI ID';
});

async function createStripeCheckout(items, total, customerName, address) {
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        items,
        total,
        customer_name: customerName,
        address,
        payment: 'Card'
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.message || 'Unable to start Stripe checkout');
    }

    const payload = await response.json();
    if (!payload.checkout_url) {
      throw new Error('Stripe checkout URL not returned');
    }
    window.location.href = payload.checkout_url;
  } catch (error) {
    checkoutMessage.textContent = error.message || 'Unable to redirect to payment gateway.';
  }
}

placeOrderButton.addEventListener('click', async () => {
  if (!state.cart.length) {
    checkoutMessage.textContent = 'Your cart is empty.';
    return;
  }

  if (!state.currentUser) {
    checkoutMessage.textContent = 'Please sign in before checkout.';
    openAuthModal('login');
    return;
  }

  if (!checkoutName.value.trim() || !checkoutAddress.value.trim()) {
    checkoutMessage.textContent = 'Please provide your name and delivery address.';
    return;
  }

  const paymentMode = checkoutPayment.value;
  const paymentDetail = document.getElementById('paymentDetailInput').value.trim();
  if (paymentMode === 'Card' && !state.stripeEnabled) {
    checkoutMessage.textContent = 'Card payments are unavailable at the moment. Please choose COD.';
    return;
  }
  if (paymentMode !== 'COD' && paymentMode !== 'Card' && !paymentDetail) {
    checkoutMessage.textContent = `Please enter your ${paymentMode === 'Card' ? 'card number' : 'UPI ID'}.`;
    return;
  }

  const payload = {
    items: state.cart,
    total: state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    customer_name: checkoutName.value.trim(),
    address: checkoutAddress.value.trim(),
    payment: checkoutPayment.value,
    payment_details: paymentMode === 'COD' ? '' : paymentDetail
  };

  try {
    if (paymentMode === 'Card') {
      await createStripeCheckout(payload.items, payload.total, payload.customer_name, payload.address);
      return;
    }

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.message || 'Order failed');
    }

    state.orderCount += 1;
    checkoutMessage.textContent = `Order placed successfully for ${checkoutName.value.trim()} via ${checkoutPayment.value}.`;
    state.cart = [];
    saveProducts();
    renderAll();
    checkoutName.value = '';
    checkoutAddress.value = '';
    checkoutPayment.value = 'COD';
    document.getElementById('paymentDetailRow').classList.add('hidden');
    checkoutSection.hidden = true;
  } catch (error) {
    console.error(error);
    checkoutMessage.textContent = error.message || 'The order could not be placed right now.';
  }
});

productModalBackdrop.addEventListener('click', (event) => {
  if (event.target === productModalBackdrop) {
    closeProductModal();
  }
});

productModalContent.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-cart]');
  if (!button) return;
  const productId = button.getAttribute('data-cart');
  addToCart(productId);
  closeProductModal();
});

authButton.addEventListener('click', () => openAuthModal('login'));
accountButton.addEventListener('click', openOrdersModal);
supportButton.addEventListener('click', openSupportModal);
authCancel.addEventListener('click', closeAuthModal);
ordersClose.addEventListener('click', closeOrdersModal);
supportClose.addEventListener('click', closeSupportModal);
authClose.addEventListener('click', closeAuthModal);
authModal.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuthModal();
});
supportModal.addEventListener('click', (event) => {
  if (event.target === supportModal) closeSupportModal();
});
ordersModal.addEventListener('click', (event) => {
  if (event.target === ordersModal) closeOrdersModal();
});
authForm.addEventListener('submit', submitAuthForm);
forgotPasswordButton.addEventListener('click', () => openAuthModal('reset'));
toggleAuthMode.addEventListener('click', () => openAuthModal(state.authMode === 'login' ? 'register' : 'login'));
editProfileButton.addEventListener('click', showProfileEditor);
saveProfileButton.addEventListener('click', saveProfile);
cancelProfileButton.addEventListener('click', hideProfileEditor);
setOfferButton.addEventListener('click', () => {
  updateOfferBanner(offerInput.value);
  offerInput.value = '';
});
if (bulkImportButton) {
  bulkImportButton.addEventListener('click', importBulkProducts);
}
if (addCategoryButton) {
  addCategoryButton.addEventListener('click', async () => {
    const name = (newCategoryInput.value || '').trim();
    if (!name) return;
    try {
      const resp = await fetch('/api/categories', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ name }) });
      const payload = await resp.json();
      if (!resp.ok) {
        setAdminMessage(payload.message || 'Unable to add category');
        return;
      }
      setAdminMessage('Category added');
      newCategoryInput.value = '';
      const cResp = await fetch('/api/categories');
      if (cResp.ok) {
        const cPayload = await cResp.json();
        if (Array.isArray(cPayload.categories)) {
          populateCategorySelect(cPayload.categories);
          categorySelect.value = name;
        }
      }
    } catch (err) {
      console.error(err);
      setAdminMessage('Unable to add category');
    }
  });
}
logoutButton.addEventListener('click', logout);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAuthModal();
    closeOrdersModal();
    closeProductModal();
    cartPanel.classList.remove('open');
  }
});

async function syncMarketplaceStatus() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Health check failed');
    const payload = await response.json();
    state.orderCount = payload.orders || 0;
    if (liveStatus) {
      liveStatus.textContent = `Live marketplace sync - ${payload.products} products - ${payload.orders} orders`;
    }
    renderInsights();
  } catch (error) {
    console.warn('Marketplace status unavailable', error);
  }
}

function showCheckoutQueryState() {
  const params = new URLSearchParams(window.location.search);
  const checkoutStatus = params.get('checkout');
  if (!checkoutStatus) return;
  if (checkoutStatus === 'success') {
    checkoutMessage.textContent = 'Payment completed successfully. Your order is now being processed.';
  } else if (checkoutStatus === 'cancel') {
    checkoutMessage.textContent = 'Payment was cancelled. You can retry or choose COD.';
  }
}

async function startApp() {
  await loadUser();
  await fetchStripeConfig();
  await loadProductsFromApi();
  await fetchCategories();
  await fetchOffers();
  await syncMarketplaceStatus();
  showCheckoutQueryState();
  updateCountdown();
}

startApp();
