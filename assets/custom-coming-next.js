if (!customElements.get('coming-next-carousel')) {
  class ComingNextCarousel extends HTMLElement {
    constructor() {
      super();
      this.track = this.querySelector('.coming-next__track');
      this.slides = Array.from(this.querySelectorAll('[data-coming-next-slide]'));
      this.dots = Array.from(this.querySelectorAll('[data-coming-next-dot]'));
      this.wrapper = this.closest('.coming-next__wrapper') || this;
      this.prevButton = this.wrapper.querySelector('[data-coming-next-prev]');
      this.nextButton = this.wrapper.querySelector('[data-coming-next-next]');

      this.isGrid = this.dataset.layout === 'grid';
      this.loop = this.dataset.loop === 'true';
      this.autoplayEnabled = this.dataset.autoplay === 'true';
      this.autoplaySpeed = (parseFloat(this.dataset.autoplaySpeed) || 4) * 1000;
      this.dragEnabled = this.dataset.drag === 'true';
      this.transitionSpeed = parseInt(this.dataset.transitionSpeed, 10) || 400;
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const featured = parseInt(this.dataset.featuredIndex, 10);
      this.currentIndex = Number.isFinite(featured) && featured >= 0 ? featured : 0;

      this.isDragging = false;
      this.autoplayTimer = null;

      if (!this.track || this.slides.length === 0 || this.isGrid) return;

      this.bindEvents();
      this.setActiveButton(this.prevButton);

      requestAnimationFrame(() => {
        this.scrollToIndex(this.currentIndex, false);
        this.updateActive();
      });

      if (this.autoplayEnabled && !this.reduceMotion && this.slides.length > 1) {
        this.startAutoplay();
      }
    }

    bindEvents() {
      this.track.addEventListener('scroll', () => this.onScroll(), { passive: true });

      if (this.prevButton) {
        this.prevButton.addEventListener('click', () => {
          this.prev();
          this.setActiveButton(this.prevButton);
        });
      }
      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => {
          this.next();
          this.setActiveButton(this.nextButton);
        });
      }

      this.dots.forEach((dot) => {
        dot.addEventListener('click', () => this.goTo(parseInt(dot.dataset.index, 10)));
      });

      if (this.autoplayEnabled) {
        this.addEventListener('pointerenter', () => this.stopAutoplay());
        this.addEventListener('pointerleave', () => this.startAutoplay());
        this.addEventListener('focusin', () => this.stopAutoplay());
        this.addEventListener('focusout', () => this.startAutoplay());
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.stopAutoplay();
          else this.startAutoplay();
        });
      }

      if (this.dragEnabled) this.bindDrag();

      this.resizeObserver = new ResizeObserver(() => this.updateActive());
      this.resizeObserver.observe(this.track);
    }

    bindDrag() {
      let startX = 0;
      let startScroll = 0;

      const onPointerMove = (event) => {
        if (!this.isDragging) return;
        const delta = event.clientX - startX;
        this.track.scrollLeft = startScroll - delta;
      };

      const onPointerUp = () => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.track.classList.remove('is-dragging');
        this.track.style.scrollSnapType = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        this.updateActive();
        this.goTo(this.currentIndex);
      };

      this.track.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse') return;
        this.cancelScrollAnimation();
        this.isDragging = true;
        startX = event.clientX;
        startScroll = this.track.scrollLeft;
        this.track.classList.add('is-dragging');
        this.track.style.scrollSnapType = 'none';
        this.stopAutoplay();
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    }

    onScroll() {
      if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = requestAnimationFrame(() => this.updateActive());
    }

    getClosestIndex() {
      const center = this.track.scrollLeft + this.track.clientWidth / 2;
      let closest = 0;
      let smallestDistance = Infinity;
      this.slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(slideCenter - center);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          closest = index;
        }
      });
      return closest;
    }

    updateActive() {
      this.currentIndex = this.getClosestIndex();

      this.slides.forEach((slide, index) => {
        slide.classList.toggle('is-active', index === this.currentIndex);
      });

      this.dots.forEach((dot, index) => {
        const active = index === this.currentIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      if (!this.loop) {
        if (this.prevButton) this.prevButton.toggleAttribute('disabled', this.currentIndex === 0);
        if (this.nextButton) this.nextButton.toggleAttribute('disabled', this.currentIndex === this.slides.length - 1);
      }
    }

    scrollToIndex(index, smooth = true) {
      const slide = this.slides[index];
      if (!slide) return;
      const left = slide.offsetLeft + slide.offsetWidth / 2 - this.track.clientWidth / 2;
      if (smooth && !this.reduceMotion) {
        this.animateScrollTo(left);
      } else {
        this.cancelScrollAnimation();
        this.track.scrollLeft = left;
      }
    }

    animateScrollTo(targetLeft) {
      this.cancelScrollAnimation();
      const startLeft = this.track.scrollLeft;
      const distance = targetLeft - startLeft;
      const duration = this.transitionSpeed;
      if (Math.abs(distance) < 1 || duration <= 0) {
        this.track.scrollLeft = targetLeft;
        return;
      }
      const startTime = performance.now();
      const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

      const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        this.track.scrollLeft = startLeft + distance * easeInOutCubic(progress);
        this.scrollAnimationFrame = progress < 1 ? requestAnimationFrame(step) : null;
      };

      this.scrollAnimationFrame = requestAnimationFrame(step);
    }

    cancelScrollAnimation() {
      if (this.scrollAnimationFrame) {
        cancelAnimationFrame(this.scrollAnimationFrame);
        this.scrollAnimationFrame = null;
      }
    }

    goTo(index) {
      let target = index;
      if (this.loop) {
        target = (index + this.slides.length) % this.slides.length;
      } else {
        target = Math.max(0, Math.min(index, this.slides.length - 1));
      }
      this.currentIndex = target;
      this.scrollToIndex(target);
    }

    next() {
      this.goTo(this.currentIndex + 1);
    }

    prev() {
      this.goTo(this.currentIndex - 1);
    }

    setActiveButton(button) {
      if (this.prevButton) this.prevButton.classList.toggle('is-current', button === this.prevButton);
      if (this.nextButton) this.nextButton.classList.toggle('is-current', button === this.nextButton);
    }

    startAutoplay() {
      if (!this.autoplayEnabled || this.reduceMotion || this.slides.length < 2) return;
      this.stopAutoplay();
      this.autoplayTimer = setInterval(() => this.next(), this.autoplaySpeed);
    }

    stopAutoplay() {
      if (this.autoplayTimer) {
        clearInterval(this.autoplayTimer);
        this.autoplayTimer = null;
      }
    }

    disconnectedCallback() {
      this.stopAutoplay();
      this.cancelScrollAnimation();
      if (this.resizeObserver) this.resizeObserver.disconnect();
    }
  }

  customElements.define('coming-next-carousel', ComingNextCarousel);
}
