document.addEventListener(
  'invalid',
  (event) => {
    const input = event.target;
    if (!input.classList || !input.classList.contains('product-personalization__input')) return;
    event.preventDefault();

    const wrapper = input.closest('.product-personalization');
    if (!wrapper) return;

    const errorEl = wrapper.querySelector('.product-personalization__error');
    if (errorEl) {
      errorEl.textContent = input.dataset.errorMessage || 'This is a required field';
    }
    wrapper.classList.add('has-error');
    input.focus();
  },
  true
);

document.addEventListener('input', (event) => {
  const input = event.target;
  if (!input.classList || !input.classList.contains('product-personalization__input')) return;
  if (input.checkValidity()) {
    input.closest('.product-personalization')?.classList.remove('has-error');
  }
});
