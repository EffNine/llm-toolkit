const Navigation = {
  _booted: false,
  init() {
    if (this._booted) return;
    this._booted = true;
    this.renderSidebar();
    this.setupMobileMenu();
    this.setupScrollPersistence();
    this.setupKeyboardShortcuts();
    // Mark active nav item + persist last page for "continue where you left off".
    if (window.Router && typeof window.Router.sync === 'function') {
      window.Router.sync();
    }
  },

  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const SECTION_META = [
      { key: 'start', label: 'Start' },
      { key: 'plan', label: 'Build / Plan' },
      { key: 'tools', label: 'Tools' },
      { key: 'knowledge', label: 'Knowledge' },
      { key: 'help', label: 'Help' }
    ];

    const icons = {
      '/': '⌂',
      '/pages/learn.html': '▸',
      '/pages/roadmap.html': '↗',
      '/pages/projects.html': '⊞',
      '/pages/planner.html': '⚙',
      '/pages/data-planner.html': '◫',
      '/pages/eval-planner.html': '◆',
      '/pages/calculator.html': '∑',
      '/pages/model-calc.html': '◈',
      '/pages/token-calc.html': 'T',
      '/pages/inference-calc.html': '△',
      '/pages/hardware.html': '◉',
      '/pages/data.html': '□',
      '/pages/models.html': '◎',
      '/pages/training.html': '▶',
      '/pages/evaluation.html': '◎',
      '/pages/scaling.html': '⇈',
      '/pages/inference.html': '▷',
      '/pages/deployment.html': '▣',
      '/pages/reference.html': '≡',
      '/pages/library.html': '❖',
      '/pages/troubleshooting.html': '!'
    };

    const current = (window.Router && typeof window.Router.getCurrent === 'function')
      ? window.Router.getCurrent()
      : window.location.pathname;

    let html = '';
    SECTION_META.forEach(({ key, label }) => {
      const routes = (window.APP_ROUTES || []).filter((r) => r.section === key);
      if (routes.length === 0) return;
      html += `<div class="nav-section-label" aria-hidden="false">${label}</div>`;
      routes.forEach((route) => {
        const icon = icons[route.path] || '·';
        const isActive = route.path === current;
        html += `<a href="${route.path}" class="nav-item${isActive ? ' active' : ''}" data-path="${route.path}"${isActive ? ' aria-current="page"' : ''}>`
          + `<span class="nav-item-icon" aria-hidden="true">${icon}</span>`
          + `${route.label}`
          + `</a>`;
      });
    });

    nav.innerHTML = html;

    // Do NOT preventDefault: these are real links to independent documents.
    // Only close the mobile drawer (before the browser navigates away).
    nav.addEventListener('click', (e) => {
      const link = e.target.closest('a.nav-item');
      if (link) this.closeMobileMenu(false);
    });
    this.restoreSidebarScroll();
  },

  // The sidebar scrolls independently and every navigation is a full page
  // load, so without this the menu jumps back to the top on every click.
  // Persist per-tab (sessionStorage): a new tab starts at the top.
  saveSidebarScroll() {
    try {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sessionStorage.setItem('llm-toolkit:sidebar-scroll', String(sidebar.scrollTop || 0));
    } catch { /* private-mode storage may throw; ignore */ }
  },

  restoreSidebarScroll() {
    let y = 0;
    try {
      y = parseInt(sessionStorage.getItem('llm-toolkit:sidebar-scroll') || '0', 10) || 0;
    } catch { y = 0; }
    if (y <= 0) return;
    const apply = () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.scrollHeight > sidebar.clientHeight) sidebar.scrollTop = y;
    };
    apply();
    // Layout (fonts/images) can shift heights after first paint; re-apply once.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
  },

  setupScrollPersistence() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.dataset.scrollPersist) {
      sidebar.dataset.scrollPersist = '1';
      let ticking = false;
      sidebar.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        const done = () => { ticking = false; this.saveSidebarScroll(); };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(done);
        else setTimeout(done, 100);
      }, { passive: true });
    }
    // Covers link clicks and tab closes between scroll events.
    window.addEventListener('pagehide', () => this.saveSidebarScroll());
  },

  setupMobileMenu() {    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (hamburger && sidebar) {
      if (!hamburger.hasAttribute('aria-controls')) {
        hamburger.setAttribute('aria-controls', 'sidebar');
      }
      hamburger.addEventListener('click', () => this.toggleMobileMenu());
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.closeMobileMenu(true));
    }
    // Overlay is decorative; hide it from AT when inactive.
    if (overlay && !overlay.classList.contains('active')) {
      overlay.setAttribute('aria-hidden', 'true');
    }
  },

  toggleMobileMenu(force) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    if (!sidebar) return;
    const willOpen = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', willOpen);
    overlay?.classList.toggle('active', willOpen);
    if (willOpen) {
      overlay?.removeAttribute('aria-hidden');
    } else {
      overlay?.setAttribute('aria-hidden', 'true');
    }
    if (hamburger) hamburger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) {
      // Move focus into the drawer for keyboard users.
      const firstLink = sidebar.querySelector('a.nav-item');
      if (firstLink) firstLink.focus({ preventScroll: true });
    } else if (document.activeElement && sidebar.contains(document.activeElement)) {
      // Return focus to the toggle when closing via Escape/overlay.
      hamburger?.focus({ preventScroll: true });
    }
  },

  openMobileMenu() {
    this.toggleMobileMenu(true);
  },

  closeMobileMenu(returnFocus) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    const wasOpen = sidebar?.classList.contains('open');
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    if (wasOpen && returnFocus) hamburger?.focus({ preventScroll: true });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const inField = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'SELECT' ||
        document.activeElement.isContentEditable
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.Search) window.Search.toggle();
        return;
      }
      if (e.key === 'Escape') {
        // Search handles its own Escape; only close drawer here if search is shut.
        const searchOpen = document.getElementById('search-modal')?.classList.contains('active');
        if (!searchOpen) this.closeMobileMenu(true);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !inField) {
        e.preventDefault();
        if (window.Search) window.Search.open();
      }
    });
  }
};

window.Navigation = Navigation;
