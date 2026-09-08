const Search = {
  modal: null,
  results: [],
  focusedIndex: 0,
  
  init() {
    this.buildModal();
    this.setupTrigger();
  },
  
  buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'search-modal';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-labelledby="search-title">
        <div class="modal-search">
          <input type="text" id="search-input" placeholder="Search the toolkit..." autocomplete="off" aria-label="Search">
        </div>
        <div class="modal-results" id="search-results"></div>
        <div class="modal-hint">
          <span><kbd>/</kbd> Search</span>
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modal = overlay;
    
    const input = overlay.querySelector('#search-input');
    input.addEventListener('input', (e) => this.search(e.target.value));
    input.addEventListener('keydown', (e) => this.handleKey(e));
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  },
  
  setupTrigger() {
    const btn = document.getElementById('nav-search-btn');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  },
  
  toggle() {
    if (this.modal.classList.contains('active')) {
      this.close();
    } else {
      this.open();
    }
  },
  
  open() {
    this.modal.classList.add('active');
    const input = this.modal.querySelector('#search-input');
    input.focus();
    this.search('');
  },
  
  close() {
    this.modal.classList.remove('active');
    const input = this.modal.querySelector('#search-input');
    input.value = '';
    this.focusedIndex = 0;
  },
  
  async search(query) {
    const resultsEl = this.modal.querySelector('#search-results');
    
    if (!query || query.length < 2) {
      resultsEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--color-text-tertiary); font-size: var(--text-sm);">Type at least 2 characters to search</div>';
      this.results = [];
      return;
    }
    
    const allData = await this.collectData();
    const q = query.toLowerCase();
    
    this.results = allData.filter(item => 
      item.title.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.tags || []).some(t => t.toLowerCase().includes(q))
    ).slice(0, 20);
    
    this.focusedIndex = 0;
    this.renderResults(resultsEl);
  },
  
  async collectData() {
    const items = [];
    
    try {
      const topics = await import('../data/topics.json').then(m => m.default || m).catch(() => []);
      topics.forEach(t => items.push({
        ...t,
        type: 'topic',
        path: `/pages/learn.html#${t.id}`
      }));
    } catch {}
    
    try {
      const gpus = await import('../data/gpus.json').then(m => m.default || m).catch(() => []);
      gpus.forEach(g => items.push({
        ...g,
        type: 'GPU',
        path: `/pages/hardware.html#${g.id}`
      }));
    } catch {}
    
    try {
      const models = await import('../data/models.json').then(m => m.default || m).catch(() => []);
      models.forEach(m => items.push({
        ...m,
        type: 'Model',
        path: `/pages/models.html#${m.id}`
      }));
    } catch {}
    
    try {
      const projects = await import('../data/projects.json').then(m => m.default || m).catch(() => []);
      projects.forEach(p => items.push({
        ...p,
        type: 'Project',
        path: `/pages/projects.html#${p.id}`
      }));
    } catch {}
    
    APP_ROUTES.forEach(r => items.push({
      title: r.label,
      type: 'Page',
      description: `Navigate to ${r.label.toLowerCase()}`,
      path: r.path,
      tags: [r.section]
    }));
    
    // Add tool pages
    const tools = [
      { title: 'VRAM Calculator', desc: 'Estimate GPU memory for training', path: '/pages/calculator.html', type: 'Tool' },
      { title: 'Model Calculator', desc: 'Design transformer architecture', path: '/pages/model-calc.html', type: 'Tool' },
      { title: 'Token Budget', desc: 'Calculate training token requirements', path: '/pages/token-calc.html', type: 'Tool' },
      { title: 'Inference Memory', desc: 'Estimate inference GPU memory', path: '/pages/inference-calc.html', type: 'Tool' },
      { title: 'Data Planner', desc: 'Plan dataset processing pipeline', path: '/pages/data-planner.html', type: 'Tool' },
      { title: 'Evaluation Planner', desc: 'Plan model evaluation strategy', path: '/pages/eval-planner.html', type: 'Tool' },
    ];
    tools.forEach(t => items.push(t));
    
    return items;
  },
  
  renderResults(container) {
    if (this.results.length === 0) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--color-text-tertiary); font-size: var(--text-sm);">No results found</div>';
      return;
    }
    
    container.innerHTML = this.results.map((item, i) => `
      <div class="modal-result-item ${i === this.focusedIndex ? 'focused' : ''}" data-index="${i}" data-path="${item.path}">
        <div>
          <div class="modal-result-title">${this.highlightMatch(item.title)}</div>
          <div class="modal-result-meta">${item.type}${item.difficulty ? ' · ' + item.difficulty : ''}</div>
        </div>
      </div>
    `).join('');
    
    container.querySelectorAll('.modal-result-item').forEach(el => {
      el.addEventListener('click', () => {
        window.location.href = el.dataset.path;
      });
    });
  },
  
  highlightMatch(text) {
    const input = this.modal.querySelector('#search-input').value;
    if (!input) return text;
    const regex = new RegExp(`(${input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
  },
  
  handleKey(e) {
    const items = this.modal.querySelectorAll('.modal-result-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex = Math.min(this.focusedIndex + 1, items.length - 1);
      this.updateFocus(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
      this.updateFocus(items);
    } else if (e.key === 'Enter' && this.focusedIndex >= 0 && items[this.focusedIndex]) {
      e.preventDefault();
      window.location.href = items[this.focusedIndex].dataset.path;
    }
  },
  
  updateFocus(items) {
    items.forEach((item, i) => {
      item.classList.toggle('focused', i === this.focusedIndex);
    });
    items[this.focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }
};
