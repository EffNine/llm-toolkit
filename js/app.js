// App bootstrap for a static multi-page site.
// Each HTML document is independent. There is no SPA rendering:
// navigation is always a normal full-page load via <a href>.
const App = {
  currentPage: null,
  _booted: false,

  init() {
    if (this._booted) return;
    this._booted = true;
    try {
      if (window.Navigation && typeof window.Navigation.init === 'function') {
        window.Navigation.init();
      }
    } catch { /* ignore */ }
    try {
      if (window.Search && typeof window.Search.init === 'function') {
        window.Search.init();
      }
    } catch { /* ignore */ }
    try {
      if (window.Router && typeof window.Router.sync === 'function') {
        this.currentPage = window.Router.sync();
      } else {
        this.currentPage = window.location.pathname;
      }
    } catch { this.currentPage = window.location.pathname; }
    this.saveLastPage();
    this.bootCurrentPage();
    this.initExpandablePanels();
    this.initSelectionAria();
  },

  // Native <button class="expandable-header"> panels: toggle .open on the
  // closest .expandable-panel and keep aria-expanded in sync. Delegated so
  // dynamically rendered panels (training methods, etc.) work too.
  initExpandablePanels() {
    if (this._expandBound) return;
    this._expandBound = true;
    // Assign stable IDs for aria-controls where missing.
    let n = 0;
    const assignIds = (root = document) => {
      root.querySelectorAll('.expandable-panel').forEach((panel) => {
        const header = panel.querySelector('.expandable-header');
        const content = panel.querySelector('.expandable-content');
        if (header && content && !header.getAttribute('aria-controls')) {
          n += 1;
          const id = `expandable-content-${n}`;
          content.id = content.id || id;
          header.setAttribute('aria-controls', content.id);
          const open = panel.classList.contains('open');
          header.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      });
    };
    assignIds();
    // Re-scan after dynamic renders.
    new MutationObserver(() => assignIds()).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', (e) => {
      const header = e.target.closest('.expandable-header');
      if (!header) return;
      const panel = header.closest('.expandable-panel');
      if (!panel) return;
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open', willOpen);
      header.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      const icon = header.querySelector('.expandable-icon');
      if (icon && (icon.textContent === '+' || icon.textContent === '−')) {
        icon.textContent = willOpen ? '−' : '+';
      }
    });
  },

  // Keep aria-pressed in sync for toggle/selection buttons that use
  // inline onclick handlers (PlannerSelect, EvalPlanner, Training, etc.).
  // Native buttons already handle Enter/Space; this only fixes semantics.
  initSelectionAria() {
    if (this._selBound) return;
    this._selBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.selection-option, .decision-branch, .troubleshoot-option, .graph-card');
      if (!btn) return;
      // Defer so the inline handler runs first and updates .selected.
      setTimeout(() => {
        if (btn.classList.contains('selected')) btn.setAttribute('aria-pressed', 'true');
        else if (btn.hasAttribute('aria-pressed')) {
          // Single-select groups: clear siblings, set this one.
          const grid = btn.closest('.selection-grid, .decision-branches, .troubleshoot-flow, .knowledge-graph');
          if (grid && (btn.classList.contains('selected') || btn.closest('#eval-purpose-grid'))) {
            grid.querySelectorAll('[aria-pressed]').forEach((sib) => {
              sib.setAttribute('aria-pressed', sib.classList.contains('selected') ? 'true' : 'false');
            });
          } else {
            btn.setAttribute('aria-pressed', btn.classList.contains('selected') ? 'true' : 'false');
          }
        }
      }, 0);
    });
  },

  // Initialise only the widgets belonging to the current document.
  // This is NOT SPA rendering: it never loads an unrelated page.
  bootCurrentPage() {
    const rawPath = window.location.pathname;
    // Accept both '/pages/learn.html' and clean-URL '/pages/learn' forms.
    const path = rawPath.endsWith('.html') ? rawPath : `${rawPath}.html`;
    const call = (fn) => { try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch { /* ignore */ } };
    if (path === '/' || path === '/index.html') {
      if (typeof window.renderHome === 'function') call(() => window.renderHome());
      call(() => this.initContinueBanner());
      return;
    }
    if (path.endsWith('/pages/learn.html')) {
      if (window.Learning && typeof window.Learning.init === 'function') call(() => window.Learning.init());
      else if (typeof window.renderLearn === 'function') call(() => window.renderLearn());
      return;
    }
    if (path.endsWith('/pages/roadmap.html')) {
      if (window.Planner && typeof window.Planner.init === 'function') call(() => window.Planner.init());
      else if (typeof window.renderRoadmap === 'function') call(() => window.renderRoadmap());
      return;
    }
    if (path.endsWith('/pages/calculator.html')) {
      if (window.Calculator) call(() => window.Calculator.init());
      else if (typeof window.renderCalculator === 'function') call(() => window.renderCalculator());
      return;
    }
    if (path.endsWith('/pages/hardware.html')) {
      if (window.Hardware) call(() => window.Hardware.init());
      else if (typeof window.renderHardware === 'function') call(() => window.renderHardware());
      return;
    }
    if (path.endsWith('/pages/model-calc.html')) {
      if (window.ModelCalculator) call(() => window.ModelCalculator.init());
      else if (typeof window.renderModelCalc === 'function') call(() => window.renderModelCalc());
      return;
    }
    if (path.endsWith('/pages/token-calc.html')) {
      if (window.TokenCalculator) call(() => window.TokenCalculator.init());
      else if (typeof window.renderTokenCalc === 'function') call(() => window.renderTokenCalc());
      return;
    }
    if (path.endsWith('/pages/inference-calc.html')) {
      if (window.InferenceCalculator) call(() => window.InferenceCalculator.init());
      else if (typeof window.renderInferenceCalc === 'function') call(() => window.renderInferenceCalc());
      return;
    }
    if (path.endsWith('/pages/training.html')) {
      if (typeof window.renderTraining === 'function') call(() => window.renderTraining());
      return;
    }
    if (path.endsWith('/pages/models.html')) {
      if (typeof window.renderModels === 'function') call(() => window.renderModels());
      return;
    }
    if (path.endsWith('/pages/projects.html')) {
      if (typeof window.renderProjects === 'function') call(() => window.renderProjects());
      return;
    }
    // Other static pages expose a renderX stub or need no JS.
    const stub = this.stubFor(path);
    if (stub && typeof window[stub] === 'function') call(() => window[stub]());
  },

  stubFor(path) {
    const m = path.match(/\/pages\/([a-z-]+)\.html$/);
    if (!m) return null;
    const camel = m[1].split('-').map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1))).join('');
    return `render${camel}`;
  },

  initContinueBanner() {
    // Rendered by inline homepage script if present; nothing required here.
  },

  saveLastPage() {
    try {
      if (window.Progress && typeof window.Progress.setPreference === 'function') {
        window.Progress.setPreference('lastPage', window.location.pathname);
      }
    } catch { /* private mode: ignore */ }
  },

  // Legacy entry point: previously attempted to dynamically render an
  // unrelated page into the current document. No longer supported (no-op).
  async route(_path) {
    return this.currentPage;
  },

  // Normal full-page navigation helper.
  loadPage(pageName) {
    window.location.assign(`/pages/${pageName}.html`);
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  try { App.init(); } catch { /* ignore */ }
});
