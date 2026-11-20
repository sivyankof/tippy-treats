// Tippy Treats: language switch for the public pages.
// No network and no stored state: the language is worked out again on every page load
// from ?lang=, then from the browser language, then English by default.
// Without this script (JavaScript off) every language section is visible one after another:
// only this file hides them, never style.css.
// `globalThis` is used so the root eslint config needs no browser globals.
(function () {
  var win = globalThis;
  var doc = win.document;
  var SUPPORTED = ['en', 'ru'];
  var FALLBACK = 'en';

  // Own pages of the site: only they get ?lang= appended, external links are left alone
  var SITE_PAGES = ['index.html', 'privacy.html', 'terms.html', 'support.html', ''];

  function detectLang() {
    var query = new win.URLSearchParams(win.location.search).get('lang');
    if (query && SUPPORTED.indexOf(query) !== -1) {
      return query;
    }

    var deviceLang = (win.navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.indexOf(deviceLang) !== -1) {
      return deviceLang;
    }

    return FALLBACK;
  }

  function showLang(lang) {
    doc.documentElement.lang = lang;

    var sections = doc.querySelectorAll('[data-lang]');
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      section.hidden = section.getAttribute('data-lang') !== lang;
    }
  }

  function highlightSwitch(lang) {
    var links = doc.querySelectorAll('[data-lang-link]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var isActive = link.getAttribute('data-lang-link') === lang;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  // Keep the language when moving between site pages: append the current ?lang= to links
  // to index/privacy/terms/support (the language switch sets its own lang in href).
  function carryLang(lang) {
    var links = doc.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.hasAttribute('data-lang-link')) {
        continue;
      }

      var href = link.getAttribute('href');
      if (!href) {
        continue;
      }

      var withoutHash = href.split('#')[0];
      var path = withoutHash.split('?')[0];
      // The 404 page links from the site root ("/privacy.html"): the page name is what counts.
      if (SITE_PAGES.indexOf(path.replace(/^\//, '')) === -1) {
        continue;
      }

      var hash = href.indexOf('#') !== -1 ? href.slice(href.indexOf('#')) : '';
      link.setAttribute('href', path + '?lang=' + lang + hash);
    }
  }

  // An anchor without a language (#deletion) leads to the element of the current language
  // (#deletion-ru): ids must be unique, so each language section carries its own, and the
  // browser does not scroll to an element inside a hidden section, so the jump is done here.
  function jumpToAnchor(lang) {
    var hash = win.location.hash.slice(1);
    if (!hash) {
      return;
    }

    var target = doc.getElementById(hash + '-' + lang);
    if (target) {
      target.scrollIntoView();
    }
  }

  var lang = detectLang();
  showLang(lang);
  highlightSwitch(lang);
  carryLang(lang);
  jumpToAnchor(lang);
})();
