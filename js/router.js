window.APP_ROUTES = [
  { path: '/', label: 'Home', section: 'start' },
  { path: '/pages/learn.html', label: 'Learn', section: 'start' },
  { path: '/pages/roadmap.html', label: 'Roadmap', section: 'start' },
  { path: '/pages/projects.html', label: 'Projects', section: 'start' },
  { path: '/pages/planner.html', label: 'Training Planner', section: 'plan' },
  { path: '/pages/data-planner.html', label: 'Data Planner', section: 'plan' },
  { path: '/pages/eval-planner.html', label: 'Eval Planner', section: 'plan' },
  { path: '/pages/calculator.html', label: 'VRAM Calculator', section: 'tools' },
  { path: '/pages/model-calc.html', label: 'Model Calculator', section: 'tools' },
  { path: '/pages/token-calc.html', label: 'Token Budget', section: 'tools' },
  { path: '/pages/inference-calc.html', label: 'Inference Memory', section: 'tools' },
  { path: '/pages/hardware.html', label: 'Hardware', section: 'tools' },
  { path: '/pages/data.html', label: 'Data', section: 'knowledge' },
  { path: '/pages/models.html', label: 'Models', section: 'knowledge' },
  { path: '/pages/training.html', label: 'Training', section: 'knowledge' },
  { path: '/pages/evaluation.html', label: 'Evaluation', section: 'knowledge' },
  { path: '/pages/scaling.html', label: 'Scaling', section: 'knowledge' },
  { path: '/pages/inference.html', label: 'Inference', section: 'knowledge' },
  { path: '/pages/deployment.html', label: 'Deployment', section: 'knowledge' },
  { path: '/pages/reference.html', label: 'Reference', section: 'knowledge' },
  { path: '/pages/troubleshooting.html', label: 'Troubleshooting', section: 'help' }
];

// Lightweight current-path utilities for a static multi-page site.
// This module intentionally does NOT intercept navigation, does NOT call
// preventDefault on normal links, and does NOT use history.pushState.
// Every page is an independent HTML document loaded via normal <a href>.
const Router = {
  // Normalise a pathname so equivalent URLs compare equal:
  // '/' stays '/', '/pages/learn.html' and '/pages/learn' (Cloudflare
  // Pages clean URLs) both become '/pages/learn'.
  normalize(path) {
    if (!path) return '/';
    let p = path;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    if (p.endsWith('.html')) p = p.slice(0, -'.html'.length) || '/';
    return p;
  },

  getCurrent() {
    return this.normalize(window.location.pathname);
  },

  getNavItems() {
    return window.APP_ROUTES;
  },

  isActive(path) {
    return this.normalize(path) === this.getCurrent();
  },

  // Sync visual active state + persist last visited page.
  // Safe to call on every static page load. No routing, no rendering.
  sync() {
    const current = this.getCurrent();
    document.querySelectorAll('.nav-item').forEach((item) => {
      const target = item.getAttribute('data-path') || item.getAttribute('href');
      item.classList.toggle('active', this.normalize(target) === current);
      if (this.normalize(target) === current) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
    try {
      if (window.Progress && typeof window.Progress.setPreference === 'function') {
        window.Progress.setPreference('lastPage', current);
      }
    } catch { /* private-mode localStorage may throw; ignore */ }
    return current;
  },

  // Back-compat: some inline handlers may still call Router.navigate().
  // Perform a normal full-page navigation so back/forward/reload,
  // middle-click, open-in-new-tab, and copy-link all behave natively.
  navigate(path) {
    window.location.assign(path);
  },

  // Back-compat no-op: previously attempted SPA-style rendering.
  // Kept so old call sites do not throw; does not render anything.
  handleRoute() {
    return this.sync();
  }
};

window.Router = Router;
