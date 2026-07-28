if (!customElements.get('coming-next-carousel')) {
  // Breathing room kept between the featured card and the edges of the track.
  const EDGE_GUTTER = 24;

  // Sub-pixel cushion so a rounded line height can never clip the title.
  const FRAME_SLACK = 4;

  const SIZE_VARS = [
    '--coming-next-featured-w',
    '--coming-next-featured-h',
    '--coming-next-side-w',
    '--coming-next-side-h',
  ];

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
      this.isAnimating = false;
      this.autoplayTimer = null;
      this.scrollAnimationFrame = null;
      this.scrollEndTimer = null;
      this.userInteracted = false;
      this.textSpace = 0;
      this.cardSizes = null;

      if (!this.track || this.slides.length === 0 || this.isGrid) return;

      this.bindEvents();
      this.setActiveButton(this.prevButton);
      // Fit the cards before the first paint so narrow viewports never render an
      // oversized card and then snap it down.
      this.fitCardSizes();

      requestAnimationFrame(() => {
        this.applyActiveState(this.currentIndex);
        requestAnimationFrame(() => this.lockFrame());
      });

      // Web fonts land after first paint and can change the title's box, so
      // re-measure once they're ready.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.lockFrame());
      }

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

      this.resizeObserverPrimed = false;
      this.lastTrackWidth = 0;
      this.resizeObserver = new ResizeObserver((entries) => {
        const width = Math.round(entries[0].contentRect.width);
        if (!this.resizeObserverPrimed) {
          this.resizeObserverPrimed = true;
          this.lastTrackWidth = width;
          return;
        }
        // The track's height changes while a card grows/shrinks. Only react to
        // real width changes, otherwise the transition re-enters this callback
        // on every frame and fights the scroll animation.
        if (width === this.lastTrackWidth) return;
        this.lastTrackWidth = width;
        if (this.isAnimating || this.isDragging) return;
        // Card sizes are viewport-dependent, so the frame has to be re-measured
        // whenever the track actually resizes.
        this.lockFrame();
        if (!this.userInteracted) return;
        // The card sizes may have just been rescaled, so re-frame the active card
        // rather than picking whichever one the old scroll position now sits over.
        this.scrollToIndex(this.currentIndex, false);
      });
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
        this.suspendNativeScroll(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        this.goTo(this.getClosestIndex());
      };

      this.track.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse') return;
        this.userInteracted = true;
        this.cancelScrollAnimation();
        this.isDragging = true;
        startX = event.clientX;
        startScroll = this.track.scrollLeft;
        this.track.classList.add('is-dragging');
        this.suspendNativeScroll(true);
        this.stopAutoplay();
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    }

    onScroll() {
      if (!this.userInteracted) return;
      // Ignore scroll events we caused ourselves, and anything mid-drag: resizing
      // the active card while the track is moving is what makes it stutter.
      if (this.isAnimating || this.isDragging) return;

      // Native (touch / trackpad) scrolling: wait until it settles, then grow the
      // new active card once and hold the centre while it animates.
      clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = setTimeout(() => {
        const index = this.getClosestIndex();
        this.applyActiveState(index);
        this.settleOn(index);
      }, 100);
    }

    getClosestIndex() {
      const maxScrollLeft = this.track.scrollWidth - this.track.clientWidth;
      if (this.track.scrollLeft <= 1) return 0;
      if (this.track.scrollLeft >= maxScrollLeft - 1) return this.slides.length - 1;

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
      this.applyActiveState(this.getClosestIndex());
    }

    // Slide heights used to be content-driven, so activating a card resized its box
    // (image 320 -> 460) *and* flipped its label/title from display:none to visible
    // in the same frame. That changed the flex line's height, which re-centred the
    // whole row - the section and the intro column beside it shifted up and down on
    // every slide. The section's stylesheet now gives each slide one fixed frame;
    // this only feeds it the true text height.
    lockFrame() {
      // Only measure at rest - mid-transition the text may be mid-toggle.
      if (this.isGrid || this.isAnimating || this.isDragging) return;

      // Stacked mobile / any column layout sizes itself; leave it alone.
      if (getComputedStyle(this.track).flexDirection !== 'row') {
        this.clearFrame();
        return;
      }

      this.clearFrame();
      this.fitCardSizes();

      // The frame height itself is CSS (see the section's style block, which sizes
      // every slide from --coming-next-featured-h plus this variable). All the
      // script does is replace the stylesheet's estimate of the text block with
      // the real measurement, so a title that wraps onto a second line still fits.
      let textHeight = 0;
      this.slides.forEach((slide) => {
        textHeight = Math.max(textHeight, this.measureSlideText(slide));
      });
      if (textHeight <= 0) return;

      this.textSpace = Math.ceil(textHeight) + FRAME_SLACK;
      this.style.setProperty('--coming-next-text-space', `${this.textSpace}px`);
    }

    // The card sizes are fixed pixel settings, but the track only gets whatever the
    // intro column leaves over. Once the featured width is wider than that, the
    // active card can never be shown in full - it stays clipped at the edge no
    // matter where the carousel scrolls. Scale the sizes down (keeping the
    // authored aspect ratio) so the featured card always fits the visible track.
    fitCardSizes() {
      // Stacked and grid layouts are full-width by CSS and don't need scaling.
      if (this.isGrid || getComputedStyle(this.track).flexDirection !== 'row') return;

      const authored = this.authoredSizes || (this.authoredSizes = this.readAuthoredSizes());
      if (!authored.featuredW) return;

      const available = this.track.clientWidth - EDGE_GUTTER;
      if (available <= 0) return;

      const scale = Math.min(1, available / authored.featuredW);
      // Keep the resulting sizes: the frame is built from these numbers rather
      // than from measuring the cards, which can't be trusted while they animate.
      this.cardSizes = {
        featuredW: Math.floor(authored.featuredW * scale),
        featuredH: Math.floor(authored.featuredH * scale),
        sideW: Math.floor(authored.sideW * scale),
        sideH: Math.floor(authored.sideH * scale),
      };

      if (scale >= 1) return;

      this.style.setProperty('--coming-next-featured-w', `${this.cardSizes.featuredW}px`);
      this.style.setProperty('--coming-next-featured-h', `${this.cardSizes.featuredH}px`);
      this.style.setProperty('--coming-next-side-w', `${this.cardSizes.sideW}px`);
      this.style.setProperty('--coming-next-side-h', `${this.cardSizes.sideH}px`);
    }

    // Read once, before any override of ours is in place.
    readAuthoredSizes() {
      const styles = getComputedStyle(this);
      const value = (name) => parseFloat(styles.getPropertyValue(name)) || 0;
      return {
        featuredW: value('--coming-next-featured-w'),
        featuredH: value('--coming-next-featured-h'),
        sideW: value('--coming-next-side-w'),
        sideH: value('--coming-next-side-h'),
      };
    }

    clearFrame() {
      this.textSpace = 0;
      this.style.removeProperty('--coming-next-text-space');
      SIZE_VARS.forEach((name) => this.style.removeProperty(name));
    }

    // Reads the label/title height of a slide even while they're display:none. The
    // override is reverted in the same synchronous block, so nothing ever paints.
    measureSlideText(slide) {
      if (!slide) return 0;
      let height = 0;
      ['.coming-next__label', '.coming-next__title'].forEach((selector) => {
        const element = slide.querySelector(selector);
        if (!element) return;
        const hidden = getComputedStyle(element).display === 'none';
        if (hidden) {
          element.style.visibility = 'hidden';
          element.style.display = selector === '.coming-next__title' ? 'inline-flex' : 'block';
        }
        const styles = getComputedStyle(element);
        height +=
          element.getBoundingClientRect().height +
          (parseFloat(styles.marginTop) || 0) +
          (parseFloat(styles.marginBottom) || 0);
        if (hidden) {
          element.style.display = '';
          element.style.visibility = '';
        }
      });
      return height;
    }

    applyActiveState(index) {
      this.currentIndex = index;

      this.slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === this.currentIndex);
      });

      this.dots.forEach((dot, i) => {
        const active = i === this.currentIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      if (!this.loop) {
        if (this.prevButton) this.prevButton.toggleAttribute('disabled', this.currentIndex === 0);
        if (this.nextButton) this.nextButton.toggleAttribute('disabled', this.currentIndex === this.slides.length - 1);
      }
    }

    // Live target: the active card is growing while we scroll, so the centre of
    // the destination keeps moving. Recomputing it every frame is what keeps the
    // motion continuous instead of landing short and snapping into place.
    targetScrollFor(index) {
      const slide = this.slides[index];
      if (!slide) return this.track.scrollLeft;

      const view = this.track.clientWidth;
      const gutter = EDGE_GUTTER;
      let left = slide.offsetLeft + slide.offsetWidth / 2 - view / 2;

      // Centring is impossible at the ends of the track (there isn't enough
      // padding to scroll that far), and the browser's own clamp would leave the
      // card half out of frame. Keep the whole card inside the visible box.
      const showRightEdge = slide.offsetLeft + slide.offsetWidth - view + gutter;
      const showLeftEdge = slide.offsetLeft - gutter;
      if (showRightEdge <= showLeftEdge) left = Math.min(Math.max(left, showRightEdge), showLeftEdge);

      const maxScrollLeft = Math.max(0, this.track.scrollWidth - view);
      return Math.max(0, Math.min(left, maxScrollLeft));
    }

    setAnimating(animating) {
      this.isAnimating = animating;
      this.suspendNativeScroll(animating || this.isDragging);
    }

    // CSS puts `scroll-snap-type: x mandatory` and `scroll-behavior: smooth` on the
    // track. Both fight a scripted scroll: snapping re-snaps the track on every
    // layout change while a card resizes, and smooth scrolling starts its own
    // animation on each scrollLeft write. Turn them off while we drive the scroll.
    suspendNativeScroll(suspend) {
      this.track.style.scrollSnapType = suspend ? 'none' : '';
      this.track.style.scrollBehavior = suspend ? 'auto' : '';
    }

    scrollToIndex(index, smooth = true) {
      if (!this.slides[index]) return;
      this.cancelScrollAnimation();

      if (!smooth || this.reduceMotion || this.transitionSpeed <= 0) {
        this.track.scrollLeft = this.targetScrollFor(index);
        return;
      }

      const startLeft = this.track.scrollLeft;
      const duration = this.transitionSpeed;
      const startTime = performance.now();
      const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

      this.setAnimating(true);

      const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const target = this.targetScrollFor(index);
        this.track.scrollLeft = startLeft + (target - startLeft) * easeInOutCubic(progress);
        if (progress < 1) {
          this.scrollAnimationFrame = requestAnimationFrame(step);
        } else {
          this.scrollAnimationFrame = null;
          this.settleOn(index, false);
        }
      };

      this.scrollAnimationFrame = requestAnimationFrame(step);
    }

    // Hold the card centred for the tail of the width/height transition, then hand
    // scroll snapping back to the browser once nothing is moving any more.
    settleOn(index, fromStart = true) {
      this.cancelScrollAnimation();
      this.setAnimating(true);
      const until = performance.now() + (fromStart ? this.transitionSpeed : 0) + 120;

      const step = (now) => {
        this.track.scrollLeft = this.targetScrollFor(index);
        if (now < until) {
          this.scrollAnimationFrame = requestAnimationFrame(step);
        } else {
          this.scrollAnimationFrame = null;
          this.setAnimating(false);
        }
      };

      this.scrollAnimationFrame = requestAnimationFrame(step);
    }

    cancelScrollAnimation() {
      if (this.scrollAnimationFrame) {
        cancelAnimationFrame(this.scrollAnimationFrame);
        this.scrollAnimationFrame = null;
      }
      this.setAnimating(false);
    }

    goTo(index) {
      this.userInteracted = true;
      clearTimeout(this.scrollEndTimer);
      let target = index;
      if (this.loop) {
        target = (index + this.slides.length) % this.slides.length;
      } else {
        target = Math.max(0, Math.min(index, this.slides.length - 1));
      }
      // Resize the cards and move the track in the same frame so both eases run
      // together, instead of the resize kicking in halfway through the scroll.
      this.applyActiveState(target);
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
      clearTimeout(this.scrollEndTimer);
      this.cancelScrollAnimation();
      if (this.resizeObserver) this.resizeObserver.disconnect();
    }
  }

  customElements.define('coming-next-carousel', ComingNextCarousel);
}
