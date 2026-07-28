document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.product-review__write-button').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.reviewScrollTarget;
      const target = targetId && document.getElementById(targetId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-review-rating-stars]').forEach((group) => {
    const wrapper = group.closest('.product-review__form');
    const input = wrapper?.querySelector('[data-review-rating-input]');
    const stars = Array.from(group.querySelectorAll('[data-review-star]'));

    const setRating = (value) => {
      stars.forEach((star) => {
        const active = Number(star.dataset.value) <= value;
        star.classList.toggle('is-active', active);
        star.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      if (input) input.value = value;
    };

    stars.forEach((star) => {
      star.addEventListener('click', () => setRating(Number(star.dataset.value)));
    });
  });

  document.querySelectorAll('[data-review-title-input]').forEach((input) => {
    const field = input.closest('.product-review__field');
    const counter = field?.querySelector('[data-review-counter]');
    if (!counter) return;

    const maxLength = Number(input.getAttribute('maxlength')) || 100;
    const updateCounter = () => {
      counter.textContent = `(${input.value.length}/${maxLength})`;
    };
    updateCounter();
    input.addEventListener('input', updateCounter);
  });

  document.querySelectorAll('[data-review-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      const form = button.closest('form');
      if (!form) return;
      form.querySelectorAll('[data-review-star].is-active').forEach((star) => {
        star.classList.remove('is-active');
        star.setAttribute('aria-checked', 'false');
      });
      const ratingInput = form.querySelector('[data-review-rating-input]');
      if (ratingInput) ratingInput.value = 0;
      const counter = form.querySelector('[data-review-counter]');
      const titleInput = form.querySelector('[data-review-title-input]');
      if (counter && titleInput) {
        counter.textContent = `(0/${titleInput.getAttribute('maxlength') || 100})`;
      }
    });
  });
});
