(function () {
  function pauseAllVideos(root) {
    root.querySelectorAll('.hero-slide__video-wrapper video').forEach(function (video) {
      video.pause();
    });
    root.querySelectorAll('.hero-slide__video-wrapper.is-playing').forEach(function (wrapper) {
      wrapper.classList.remove('is-playing');
    });
  }

  function formatCounter(index) {
    return index < 10 ? '0' + index : String(index);
  }

  function initHeroBannerSlider(root) {
    if (!root || root.dataset.hbsInitialized === 'true') return;
    if (typeof Swiper === 'undefined') return;

    var swiperEl = root.querySelector('.hero-banner-slider__swiper');
    if (!swiperEl) return;

    var autoplayEnabled = root.dataset.autoplay === 'true';
    var autoplaySpeed = (parseFloat(root.dataset.autoplaySpeed) || 5) * 1000;
    var loop = root.dataset.loop === 'true';
    var speed = parseFloat(root.dataset.speed) || 600;
    var fade = root.dataset.fade === 'true';
    var pauseOnHover = root.dataset.pauseOnHover === 'true';
    var touchEnabled = root.dataset.touch !== 'false';

    var prevEl = root.querySelector('.hero-banner-slider__arrow--prev');
    var nextEl = root.querySelector('.hero-banner-slider__arrow--next');
    var paginationEl = root.querySelector('.hero-banner-slider__pagination');
    var counterCurrentEl = root.querySelector('.hero-banner-slider__counter-current');

    var config = {
      loop: loop,
      speed: speed,
      effect: fade ? 'fade' : 'slide',
      fadeEffect: { crossFade: true },
      allowTouchMove: touchEnabled,
      on: {
        slideChangeTransitionStart: function () {
          pauseAllVideos(root);
        },
      },
    };

    if (prevEl && nextEl) {
      config.navigation = { prevEl: prevEl, nextEl: nextEl };

      var setActiveArrow = function (activeEl) {
        prevEl.classList.toggle('is-current', activeEl === prevEl);
        nextEl.classList.toggle('is-current', activeEl === nextEl);
      };
      setActiveArrow(prevEl);
      prevEl.addEventListener('click', function () {
        setActiveArrow(prevEl);
      });
      nextEl.addEventListener('click', function () {
        setActiveArrow(nextEl);
      });
    }

    if (paginationEl) {
      config.pagination = { el: paginationEl, clickable: true };
    }

    if (autoplayEnabled) {
      config.autoplay = {
        delay: autoplaySpeed,
        disableOnInteraction: false,
        pauseOnMouseEnter: pauseOnHover,
      };
    }

    var swiper = new Swiper(swiperEl, config);

    if (counterCurrentEl) {
      var updateCounter = function () {
        counterCurrentEl.textContent = formatCounter(swiper.realIndex + 1);
      };
      updateCounter();
      swiper.on('slideChange', updateCounter);
    }

    root.querySelectorAll('.hero-slide__play-button').forEach(function (button) {
      button.addEventListener('click', function () {
        var wrapper = button.closest('.hero-slide__video-wrapper');
        if (!wrapper) return;
        var video = wrapper.querySelector('video');
        if (!video) return;

        pauseAllVideos(root);
        video.muted = false;
        video.play();
        wrapper.classList.add('is-playing');

        if (swiper.autoplay && swiper.autoplay.running) {
          swiper.autoplay.stop();
        }
      });
    });

    root.dataset.hbsInitialized = 'true';
    root.heroBannerSlider = swiper;
  }

  function initAll(context) {
    (context || document).querySelectorAll('.hero-banner-slider').forEach(initHeroBannerSlider);
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
