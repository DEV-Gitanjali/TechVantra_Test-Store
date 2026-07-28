/* Collection toolbar — "Show: N", grid/list view toggle.

   Show: Liquid cannot read arbitrary query parameters, so the page size is carried by
   an alternate collection template (`?view=show-18` -> templates/collection.show-18.json).
   Selecting a value reloads the collection with that `view` parameter; the section reads
   the number back out of `template.suffix`.

   The `view` parameter also has to survive Dawn's AJAX filtering: hidden `view` inputs in
   the facet forms cover form submits, and patchFacetLinks() covers the "remove filter"
   pills, which navigate from their href instead. */

(function () {
  var VIEW_MODE_KEY = 'fb:collection-view-mode';

  function currentViewSuffix() {
    return new URLSearchParams(window.location.search).get('view') || '';
  }

  /* ---------- Show: N products per page ---------- */
  function initPerPage(toolbar) {
    var select = toolbar.querySelector('[data-per-page-select]');
    if (!select || select.dataset.perPageInit === 'true') return;
    select.dataset.perPageInit = 'true';

    select.addEventListener('change', function (event) {
      // The select sits outside the facet form, but stop the bubble anyway so a
      // future markup change can never trigger Dawn's debounced filter submit.
      event.stopPropagation();

      var perPage = parseInt(select.value, 10);
      var defaultPerPage = parseInt(select.dataset.defaultPerPage, 10);
      if (!perPage) return;

      var params = new URLSearchParams(window.location.search);
      params.delete('page');
      if (perPage === defaultPerPage) {
        params.delete('view');
      } else {
        params.set('view', 'show-' + perPage);
      }

      var query = params.toString();
      window.location.href = window.location.pathname + (query ? '?' + query : '');
    });
  }

  /* ---------- Grid / list view ---------- */
  function storedViewMode() {
    try {
      return window.localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
    } catch (error) {
      return 'grid';
    }
  }

  function storeViewMode(mode) {
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch (error) {
      /* private mode — the toggle still works for this page view */
    }
  }

  function applyViewMode(mode) {
    var grid = document.getElementById('product-grid');
    if (grid) grid.classList.toggle('product-grid--list', mode === 'list');

    document.querySelectorAll('[data-view-mode]').forEach(function (button) {
      var isActive = button.dataset.viewMode === mode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function initViewMode(toolbar) {
    toolbar.querySelectorAll('[data-view-mode]').forEach(function (button) {
      if (button.dataset.viewModeInit === 'true') return;
      button.dataset.viewModeInit = 'true';

      button.addEventListener('click', function () {
        var mode = button.dataset.viewMode;
        storeViewMode(mode);
        applyViewMode(mode);
      });
    });

    applyViewMode(storedViewMode());
  }

  /* ---------- Keep ?view= on the "remove filter" pills ---------- */
  function patchFacetLinks() {
    var suffix = currentViewSuffix();
    if (!suffix) return;

    document.querySelectorAll('facet-remove a[href]').forEach(function (link) {
      if (link.dataset.viewPatched === 'true') return;
      link.dataset.viewPatched = 'true';

      try {
        var url = new URL(link.href, window.location.origin);
        if (!url.searchParams.get('view')) {
          url.searchParams.set('view', suffix);
          link.href = url.pathname + url.search;
        }
      } catch (error) {
        /* leave the href untouched if it can't be parsed */
      }
    });
  }

  function init() {
    var toolbar = document.querySelector('[data-collection-toolbar]');
    if (toolbar) {
      initPerPage(toolbar);
      initViewMode(toolbar);
    }
    patchFacetLinks();
  }

  function boot() {
    init();

    // Dawn replaces #ProductGridContainer and the facet pills on every AJAX update,
    // which drops the list-view class and the patched hrefs — re-apply on change.
    if (window.__collectionToolbarObserver) return;

    var target = document.querySelector('.facets-vertical') || document.getElementById('ProductGridContainer');
    if (!target) return;

    var timer;
    var observer = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(init, 120);
    });
    observer.observe(target, { childList: true, subtree: true });
    window.__collectionToolbarObserver = observer;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
