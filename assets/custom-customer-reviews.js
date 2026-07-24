(function () {
  function initCustomerReviews(swiperEl) {
    if (!swiperEl || swiperEl.dataset.crInitialized === 'true') return;
    if (typeof Swiper === 'undefined') return;

    var root = swiperEl.closest('.customer-reviews');
    if (!root) return;

    var slidesDesktop = parseInt(swiperEl.dataset.slidesDesktop, 10) || 3;
    var slidesTablet = parseInt(swiperEl.dataset.slidesTablet, 10) || 2;
    var loop = swiperEl.dataset.loop === 'true';
    var autoplayEnabled = swiperEl.dataset.autoplay === 'true';
    var autoplaySpeed = (parseFloat(swiperEl.dataset.autoplaySpeed) || 5) * 1000;
    var spaceBetween = parseFloat(swiperEl.dataset.spaceBetween) || 24;

    var prevEl = root.querySelector('.customer-reviews__arrow--prev');
    var nextEl = root.querySelector('.customer-reviews__arrow--next');

    var config = {
      slidesPerView: 1,
      spaceBetween: spaceBetween,
      loop: loop,
      breakpoints: {
        750: { slidesPerView: Math.min(slidesTablet, swiperEl.querySelectorAll('.swiper-slide').length) },
        990: { slidesPerView: Math.min(slidesDesktop, swiperEl.querySelectorAll('.swiper-slide').length) },
      },
    };

    if (prevEl && nextEl) {
      config.navigation = { prevEl: prevEl, nextEl: nextEl };
    }

    if (autoplayEnabled) {
      config.autoplay = {
        delay: autoplaySpeed,
        disableOnInteraction: false,
      };
    }

    var swiper = new Swiper(swiperEl, config);

    swiperEl.dataset.crInitialized = 'true';
    swiperEl.customerReviewsSwiper = swiper;
  }

  function initAll(context) {
    (context || document).querySelectorAll('.customer-reviews__swiper').forEach(initCustomerReviews);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
