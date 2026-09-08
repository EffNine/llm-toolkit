const Navigation = {
  init() {
    this.renderSidebar();
    this.setupMobileMenu();
    this.setupKeyboardShortcuts();
  },
  
  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    
    const sections = {
      'start': APP_ROUTES.filter(r => r.section === 'start'),
      'tools': APP_ROUTES.filter(r => r.section === 'tools'),
      'knowledge': APP_ROUTES.filter(r => r.section === 'knowledge')
    };
    
    const icons = {
      '/': '⌂',
      '/pages/learn.html': '▸',
      '/pages/roadmap.html': '↗',
      '/pages/planner.html': '⚙',
      '/pages/calculator.html': '∑',
      '/pages/model-calc.html': '◈',
      '/pages/token-calc.html': 'T',
      '/pages/inference-calc.html': '△',
      '/pages/data-planner.html': '◫',
      '/pages/eval-planner.html': '◆',
      '/pages/hardware.html': '◉',
      '/pages/troubleshooting.html': '!',
      '/pages/data.html': '□',
      '/pages/models.html': '◎',
      '/pages/training.html': '▶',
      '/pages/evaluation.html': '◎',
      '/pages/scaling.html': '⇈',
      '/pages/inference.html': '▷',
      '/pages/deployment.html': '▣',
      '/pages/reference.html': '≡',
      '/pages/projects.html': '⊞'
    };
    
    let html = '';
    
    Object.entries(sections).forEach(([section, routes]) => {
      if (routes.length === 0) return;
      html += `<div class="nav-section-label">${section}</div>`;
      routes.forEach(route => {
        const icon = icons[route.path] || '·';
        const isActive = route.path === Router.getCurrent();
        html += `<a href="${route.path}" class="nav-item ${isActive ? 'active' : ''}" data-path="${route.path}">
          <span class="nav-item-icon">${icon}</span>
          ${route.label}
        </a>`;
      });
    });
    
    nav.innerHTML = html;
    
    nav.addEventListener('click', (e) => {
      const link = e.target.closest('a.nav-item');
      if (link) {
        e.preventDefault();
        Router.navigate(link.dataset.path);
        this.closeMobileMenu();
      }
    });
  },
  
  setupMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (hamburger && sidebar) {
      hamburger.addEventListener('click', () => this.toggleMobileMenu());
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.closeMobileMenu());
    }
  },
  
  toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('active');
  },
  
  closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  },
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        Search.toggle();
      }
      if (e.key === 'Escape') {
        Search.close();
        this.closeMobileMenu();
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        Search.toggle();
      }
    });
  }
};
