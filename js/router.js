window.APP_ROUTES = [
  { path: '/', label: 'Home', section: 'start' },
  { path: '/pages/learn.html', label: 'Learn', section: 'start' },
  { path: '/pages/roadmap.html', label: 'Roadmap', section: 'start' },
  { path: '/pages/planner.html', label: 'Training Planner', section: 'tools' },
  { path: '/pages/calculator.html', label: 'VRAM Calculator', section: 'tools' },
  { path: '/pages/model-calc.html', label: 'Model Calculator', section: 'tools' },
  { path: '/pages/token-calc.html', label: 'Token Budget', section: 'tools' },
  { path: '/pages/inference-calc.html', label: 'Inference Memory', section: 'tools' },
  { path: '/pages/data-planner.html', label: 'Data Planner', section: 'tools' },
  { path: '/pages/eval-planner.html', label: 'Eval Planner', section: 'tools' },
  { path: '/pages/hardware.html', label: 'Hardware', section: 'tools' },
  { path: '/pages/troubleshooting.html', label: 'Troubleshooting', section: 'tools' },
  { path: '/pages/data.html', label: 'Data', section: 'knowledge' },
  { path: '/pages/models.html', label: 'Models', section: 'knowledge' },
  { path: '/pages/training.html', label: 'Training', section: 'knowledge' },
  { path: '/pages/evaluation.html', label: 'Evaluation', section: 'knowledge' },
  { path: '/pages/scaling.html', label: 'Scaling', section: 'knowledge' },
  { path: '/pages/inference.html', label: 'Inference', section: 'knowledge' },
  { path: '/pages/deployment.html', label: 'Deployment', section: 'knowledge' },
  { path: '/pages/reference.html', label: 'Reference', section: 'knowledge' },
  { path: '/pages/projects.html', label: 'Projects', section: 'knowledge' }
];

const Router = {
  currentPage: '/',
  
  init() {
    this.handleRoute();
    window.addEventListener('popstate', () => this.handleRoute());
  },
  
  navigate(path) {
    window.history.pushState({}, '', path);
    this.currentPage = path;
    this.handleRoute();
  },
  
  handleRoute() {
    const path = window.location.pathname;
    this.currentPage = path;
    Progress.setPreference('lastPage', path);
    
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.path === path);
    });
    
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      pageContent.scrollTop = 0;
    }
    
    if (window.App) {
      window.App.route(path);
    }
  },
  
  getCurrent() {
    return window.location.pathname;
  },
  
  getNavItems() {
    return APP_ROUTES;
  }
};
