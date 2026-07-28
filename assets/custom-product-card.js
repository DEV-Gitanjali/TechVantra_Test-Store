/* Custom product card — touch behaviour.

   The card's "Choose options" CTA is revealed on hover, which touch devices don't have.
   So on those devices the first tap on a card reveals the CTA instead of following the
   card link, and every tap after that behaves normally — the CTA opens quick add, the
   rest of the card goes to the product page.

   Delegated from the document in the capture phase so it runs before the full-card
   <a> overlay, and so it keeps working after Dawn replaces the grid over AJAX. */

(function () {
  if (window.__customProductCardTouchInit) return;
  window.__customProductCardTouchInit = true;

  var REVEALED_CLASS = 'is-revealed';
  var touchQuery = window.matchMedia('(hover: none)');

  function collapseAll(except) {
    document.querySelectorAll('.custom-card.' + REVEALED_CLASS).forEach(function (card) {
      if (card !== except) card.classList.remove(REVEALED_CLASS);
    });
  }

  document.addEventListener(
    'click',
    function (event) {
      // Matches the @media (hover: none) block in custom-product-card.css. Read live
      // rather than cached, so plugging in a mouse takes effect straight away.
      if (!touchQuery.matches) return;

      var target = event.target;
      var card = target && target.closest ? target.closest('.custom-card') : null;

      if (!card) {
        collapseAll(null);
        return;
      }

      // Already open — let this tap do whatever it normally would.
      if (card.classList.contains(REVEALED_CLASS)) return;

      // First tap: reveal the CTA instead of navigating to the product.
      event.preventDefault();
      event.stopPropagation();
      collapseAll(card);
      card.classList.add(REVEALED_CLASS);
    },
    true
  );
})();
