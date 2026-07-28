if (!customElements.get('product-addons')) {
  class ProductAddons extends HTMLElement {
    constructor() {
      super();
      this.checkboxes = Array.from(this.querySelectorAll('.product-addons__checkbox'));
      this.checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => this.onChange(event));
      });
    }

    onChange(event) {
      const checkbox = event.currentTarget;
      const variantId = checkbox.dataset.variantId;
      if (!variantId) return;

      checkbox.disabled = true;

      const request = checkbox.checked
        ? this.addToCart(variantId)
        : this.removeFromCart(variantId);

      request
        .then(() => {
          checkbox.disabled = false;
          this.dispatchEvent(
            new CustomEvent('addon:cart-updated', { bubbles: true, detail: { variantId, added: checkbox.checked } })
          );
        })
        .catch(() => {
          checkbox.checked = !checkbox.checked;
          checkbox.disabled = false;
        });
    }

    addToCart(variantId) {
      return fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
      }).then((response) => {
        if (!response.ok) throw new Error('Failed to add add-on to cart');
        return response.json();
      });
    }

    removeFromCart(variantId) {
      return fetch(`${window.Shopify?.routes?.root || '/'}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: 0 }),
      }).then((response) => {
        if (!response.ok) throw new Error('Failed to remove add-on from cart');
        return response.json();
      });
    }
  }

  customElements.define('product-addons', ProductAddons);
}
