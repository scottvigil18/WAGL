// ─── Cart Storage Helpers ────────────────────────────────────────────────────

function getCart() {
  return JSON.parse(localStorage.getItem('shopmart_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('shopmart_cart', JSON.stringify(cart));
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  showAddedToast();
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
  updateCartBadge();
}

function setCartItemQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty = qty;
    saveCart(cart);
  }
  updateCartBadge();
}

function clearCart() {
  saveCart([]);
  updateCartBadge();
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const count = getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

// Floating "Added!" toast notification
function showAddedToast() {
  let toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.className = 'cart-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = '✅ Added to cart!';
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}
