/* Custom Facets — vertical filter enhancements
   1. "Filter by" heading → Hide/Show Filter toggle
   2. Applied Filter: move "Clear all" into the pills row, rename "Clear Filter"
   3. Price: currency ₹ inside each field + a real draggable range slider that
      drives the min/max inputs and triggers Dawn's AJAX filter submit
   Re-runs after Dawn replaces the facet HTML on AJAX (via MutationObserver),
   and is fully idempotent (guards prevent double-binding). */

(function () {
  /* ---------- Applied Filter ---------- */
  function reorganizeAppliedFilter(wrapper) {
    var applied = wrapper.querySelector('.active-facets-desktop');
    if (!applied) return;

    var clearWrap = applied.querySelector(
      '.active-facets-vertical-filter .active-facets__button-wrapper'
    );
    if (clearWrap && clearWrap.parentElement !== applied) {
      applied.appendChild(clearWrap);
    }
    if (clearWrap) {
      var label = clearWrap.querySelector('.active-facets__button-remove span');
      if (label && label.textContent.trim() !== 'Clear Filter') {
        label.textContent = 'Clear Filter';
      }
    }

    var pills = applied.querySelectorAll(
      ':scope > facet-remove:not(.active-facets__button-wrapper)'
    ).length;
    applied.dataset.hasAppliedFilters = pills > 0 ? 'true' : 'false';
  }

  /* ---------- Hide/Show Filter toggle ---------- */
  function initToggle(wrapper) {
    var heading = wrapper.querySelector('.facets__heading--vertical');
    if (!heading || heading.dataset.filterToggleInit === 'true') return;
    heading.dataset.filterToggleInit = 'true';

    heading.setAttribute('role', 'button');
    heading.setAttribute('aria-expanded', 'true');
    heading.setAttribute('tabindex', '0');
    heading.textContent = 'Hide Filter';
    heading.style.cursor = 'pointer';

    function toggle() {
      var collapsed = wrapper.classList.toggle('facets-vertical--collapsed');
      heading.setAttribute('aria-expanded', String(!collapsed));
      heading.textContent = collapsed ? 'Show Filter' : 'Hide Filter';
    }

    heading.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
    heading.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        toggle();
      }
    });
  }

  /* ---------- Price: currency inside fields + draggable slider ---------- */
  function initPriceSection(wrapper) {
    wrapper.querySelectorAll('.facets__price').forEach(function (pc) {
      if (pc.dataset.priceInit === 'true') return;
      pc.dataset.priceInit = 'true';

      var fields = pc.querySelectorAll(':scope > .field');
      if (fields.length < 2) return;

      // Move the standalone currency symbol into each field
      var standalone = pc.querySelector(':scope > .field-currency');
      var currencyText = standalone ? standalone.textContent.trim() : '';
      if (currencyText) {
        fields.forEach(function (field) {
          if (!field.querySelector('.field-currency')) {
            var c = document.createElement('span');
            c.className = 'field-currency';
            c.textContent = currencyText;
            field.insertBefore(c, field.firstChild);
          }
        });
      }
      if (standalone) standalone.remove();

      var inputs = pc.querySelectorAll('.field__input');
      var minInput = inputs[0];
      var maxInput = inputs[1];
      if (!minInput || !maxInput) return;

      var absMax = parseFloat(maxInput.getAttribute('data-max') || minInput.getAttribute('data-max')) || 100;
      var absMin = parseFloat(minInput.getAttribute('data-min')) || 0;
      if (absMax <= absMin) absMax = absMin + 1;

      var slider = document.createElement('div');
      slider.className = 'facets__price-slider';
      slider.innerHTML =
        '<div class="facets__price-slider-track">' +
        '<div class="facets__price-slider-progress"></div>' +
        '<button type="button" class="facets__price-slider-thumb" data-thumb="min" aria-label="Minimum price"></button>' +
        '<button type="button" class="facets__price-slider-thumb" data-thumb="max" aria-label="Maximum price"></button>' +
        '</div>';
      pc.insertBefore(slider, pc.firstChild);

      var track = slider.querySelector('.facets__price-slider-track');
      var progress = slider.querySelector('.facets__price-slider-progress');
      var thumbMin = slider.querySelector('[data-thumb="min"]');
      var thumbMax = slider.querySelector('[data-thumb="max"]');

      function num(s) {
        var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? null : n;
      }
      function vals() {
        var a = num(minInput.value);
        var b = num(maxInput.value);
        return { min: a == null ? absMin : a, max: b == null ? absMax : b };
      }
      function pct(v) { return ((v - absMin) / (absMax - absMin)) * 100; }
      function fromPct(p) { return absMin + (p / 100) * (absMax - absMin); }
      function clamp(p) { return Math.max(0, Math.min(100, p)); }

      function render() {
        var v = vals();
        var mn = clamp(pct(v.min));
        var mx = clamp(pct(v.max));
        thumbMin.style.left = mn + '%';
        thumbMax.style.left = mx + '%';
        progress.style.left = mn + '%';
        progress.style.right = 100 - mx + '%';
      }

      function commit() {
        // change → PriceRange validation; input → FacetFiltersForm debounced submit
        minInput.dispatchEvent(new Event('change', { bubbles: true }));
        maxInput.dispatchEvent(new Event('change', { bubbles: true }));
        minInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function startDrag(which, ev) {
        ev.preventDefault();
        var rect = track.getBoundingClientRect();

        function move(clientX) {
          var p = clamp(((clientX - rect.left) / rect.width) * 100);
          var nv = Math.round(fromPct(p));
          var v = vals();
          if (which === 'min') {
            if (nv > v.max) nv = v.max;
            minInput.value = nv;
          } else {
            if (nv < v.min) nv = v.min;
            maxInput.value = nv;
          }
          render();
        }
        function mm(e) { move(e.clientX); }
        function tm(e) { if (e.touches && e.touches[0]) move(e.touches[0].clientX); }
        function up() {
          document.removeEventListener('mousemove', mm);
          document.removeEventListener('mouseup', up);
          document.removeEventListener('touchmove', tm);
          document.removeEventListener('touchend', up);
          document.body.classList.remove('is-dragging-price');
          commit();
        }
        document.body.classList.add('is-dragging-price');
        document.addEventListener('mousemove', mm);
        document.addEventListener('mouseup', up);
        document.addEventListener('touchmove', tm, { passive: false });
        document.addEventListener('touchend', up);

        var sx = ev.clientX !== undefined
          ? ev.clientX
          : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
        if (sx !== undefined) move(sx);
      }

      thumbMin.addEventListener('mousedown', function (e) { startDrag('min', e); });
      thumbMax.addEventListener('mousedown', function (e) { startDrag('max', e); });
      thumbMin.addEventListener('touchstart', function (e) { startDrag('min', e); }, { passive: false });
      thumbMax.addEventListener('touchstart', function (e) { startDrag('max', e); }, { passive: false });

      track.addEventListener('mousedown', function (e) {
        var rect = track.getBoundingClientRect();
        var p = ((e.clientX - rect.left) / rect.width) * 100;
        var v = vals();
        var mid = (pct(v.min) + pct(v.max)) / 2;
        startDrag(p < mid ? 'min' : 'max', e);
      });

      function bindKeys(thumb, which) {
        thumb.addEventListener('keydown', function (e) {
          var step = Math.max(1, Math.round((absMax - absMin) / 100));
          var v = vals();
          var cur = which === 'min' ? v.min : v.max;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') cur -= step;
          else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') cur += step;
          else if (e.key === 'Home') cur = absMin;
          else if (e.key === 'End') cur = absMax;
          else return;
          e.preventDefault();
          cur = Math.round(Math.max(absMin, Math.min(absMax, cur)));
          if (which === 'min' && cur > v.max) cur = v.max;
          if (which === 'max' && cur < v.min) cur = v.min;
          (which === 'min' ? minInput : maxInput).value = cur;
          render();
          commit();
        });
      }
      bindKeys(thumbMin, 'min');
      bindKeys(thumbMax, 'max');

      // Keep thumbs in sync if the user types directly in the inputs
      minInput.addEventListener('input', render);
      maxInput.addEventListener('input', render);

      render();
    });
  }

  function init() {
    var wrapper = document.querySelector('.facets-vertical');
    if (!wrapper) return;
    reorganizeAppliedFilter(wrapper);
    initToggle(wrapper);
    initPriceSection(wrapper);
  }

  function boot() {
    init();

    // Dawn's renderFilters() replaces the facet HTML on every AJAX update,
    // wiping our injected slider — re-init on any childList change. Single
    // shared observer even if this script + the inline fallback both run.
    if (!window.__facetsEnhancerObserver) {
      var t;
      var obs = new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(init, 120);
      });
      var target = document.querySelector('.facets-vertical');
      if (target) {
        obs.observe(target, { childList: true, subtree: true });
        window.__facetsEnhancerObserver = obs;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
