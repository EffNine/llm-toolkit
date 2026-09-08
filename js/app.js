const App = {
  currentPage: null,
  
  init() {
    Router.init();
    Navigation.init();
    Search.init();
    this.setupGlobalListeners();
  },
  
  setupGlobalListeners() {
    document.addEventListener('DOMContentLoaded', () => {
      const lastPage = Progress.preferences.lastPage;
      if (lastPage && lastPage !== '/') {
        // Could restore state but let home load by default
      }
    });
  },
  
  async route(path) {
    const page = path.replace(/\/$/, '').replace('.html', '') || 'home';
    
    if (window[`render${page.charAt(0).toUpperCase()}${page.slice(1)}`]) {
      window[`render${page.charAt(0).toUpperCase()}${page.slice(1)}`]();
    } else if (window.renderHome) {
      window.renderHome();
    }
  },
  
  loadPage(pageName) {
    window.location.href = `/pages/${pageName}.html`;
  }
};

window.App = App;
window.Router = Router;
window.Navigation = Navigation;
window.Search = Search;
window.Progress = Progress;
window.Storage = Storage;

document.addEventListener('DOMContentLoaded', () => App.init());
