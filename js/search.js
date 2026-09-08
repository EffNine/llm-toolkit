const Search = {
  modal: null,
  results: [],
  focusedIndex: -1,
  _booted: false,
  _opener: null,
  _requestId: 0,
  _cache: null,
  _cachePromise: null,

  init() {
    if (this._booted) return;
    this._booted = true;
    this.buildModal();
    this.setupTrigger();
  },

  buildModal() {
    if (document.getElementById('search-modal')) {
      this.modal = document.getElementById('search-modal');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'search-modal';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <div class="modal-search">
          <label id="search-title" class="sr-only" for="search-input">Search the toolkit</label>
          <input type="text" id="search-input" placeholder="Search the toolkit..." autocomplete="off"
            role="combobox" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list"
            aria-describedby="search-count" spellcheck="false">
        </div>
        <div class="modal-results" id="search-results" role="list" aria-label="Search results"></div>
        <div class="modal-hint" aria-hidden="true">
          <span><kbd>/</kbd> Search</span>
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
        <div id="search-count" class="sr-only" role="status" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modal = overlay;

    const input = overlay.querySelector('#search-input');
    input.addEventListener('input', (e) => this.search(e.target.value));
    input.addEventListener('keydown', (e) => this.handleKey(e));

    // Focus containment: keep Tab cycling inside the dialog while open.
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = overlay.querySelectorAll('#search-input, .modal-result-item');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  },

  setupTrigger() {
    const btn = document.getElementById('nav-search-btn');
    if (btn && !btn.dataset.searchBound) {
      btn.dataset.searchBound = 'true';
      btn.addEventListener('click', () => this.toggle());
    }
  },

  toggle() {
    if (this.modal.classList.contains('active')) this.close();
    else this.open();
  },

  open() {
    this._opener = document.activeElement;
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    const input = this.modal.querySelector('#search-input');
    // Preload index so first keystrokes are fast; show hint state meanwhile.
    this.preload();
    requestAnimationFrame(() => input.focus());
    this.search(input.value || '');
  },

  close() {
    if (!this.modal.classList.contains('active')) return;
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    const input = this.modal.querySelector('#search-input');
    input.value = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    this.focusedIndex = -1;
    this._requestId += 1; // invalidate in-flight searches
    if (this._opener && document.contains(this._opener)) {
      this._opener.focus({ preventScroll: true });
    }
    this._opener = null;
  },

  preload() {
    if (this._cache) return Promise.resolve(this._cache);
    if (this._cachePromise) return this._cachePromise;
    this._cachePromise = this.collectData().then((items) => {
      this._cache = items;
      return items;
    });
    return this._cachePromise;
  },

  async search(query) {
    const resultsEl = this.modal.querySelector('#search-results');
    const countEl = this.modal.querySelector('#search-count');
    const input = this.modal.querySelector('#search-input');
    const myRequest = ++this._requestId;

    if (!query || query.length < 2) {
      this.results = [];
      this.focusedIndex = -1;
      resultsEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--color-text-secondary); font-size: var(--text-sm);">Type at least 2 characters to search</div>';
      if (countEl) countEl.textContent = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      return;
    }

    // Loading state for noticeably slow collection.
    const loadingTimer = setTimeout(() => {
      if (this._requestId === myRequest) {
        resultsEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--color-text-secondary); font-size: var(--text-sm);" role="status">Searching…</div>';
      }
    }, 150);

    let allData;
    try {
      allData = this._cache || await this.preload();
    } catch {
      allData = [];
    }
    clearTimeout(loadingTimer);
    // Stale guard: a newer query started while we were collecting.
    if (this._requestId !== myRequest) return;

    const q = query.toLowerCase();
    this.results = allData.filter((item) =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.description || item.desc || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.tags || []).some((t) => (t || '').toLowerCase().includes(q))
    ).slice(0, 20);

    this.focusedIndex = this.results.length > 0 ? 0 : -1;
    this.renderResults(resultsEl);
    if (countEl) {
      countEl.textContent = this.results.length === 0
        ? 'No results found'
        : `${this.results.length} result${this.results.length === 1 ? '' : 's'} found`;
    }
    input.setAttribute('aria-expanded', this.results.length > 0 ? 'true' : 'false');
  },

  async fetchJson(path) {
    try {
      const res = await fetch(path, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },

  async collectData() {
    const items = [];
    const [topics, gpus, models, projects] = await Promise.all([
      this.fetchJson('/data/topics.json'),
      this.fetchJson('/data/gpus.json'),
      this.fetchJson('/data/models.json'),
      this.fetchJson('/data/projects.json')
    ]);
    topics.forEach((t) => items.push({ ...t, type: 'Topic', path: `/pages/learn.html#${t.id}`, tags: [t.category, t.difficulty].filter(Boolean) }));
    gpus.forEach((g) => items.push({ title: g.name, description: `${g.vendor || ''} ${g.architecture || ''} ${g.vram || ''}GB`, type: 'GPU', path: `/pages/hardware.html#${g.id}`, tags: [g.vendor, g.architecture].filter(Boolean) }));
    models.forEach((m) => items.push({ title: m.name, description: `${m.parameters || ''}B ${m.type || ''}`, type: 'Model', path: '/pages/models.html', tags: [m.type].filter(Boolean) }));
    projects.forEach((p, i) => items.push({ title: p.title, description: p.objective, type: 'Project', path: '/pages/projects.html', tags: [p.difficulty].filter(Boolean), _idx: i }));

    (window.APP_ROUTES || []).forEach((r) => items.push({
      title: r.label,
      type: 'Page',
      description: `Navigate to ${r.label.toLowerCase()}`,
      path: r.path,
      tags: [r.section]
    }));

    return items;
  },

  renderResults(container) {
    const input = this.modal.querySelector('#search-input');
    if (this.results.length === 0) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--color-text-secondary); font-size: var(--text-sm);" role="status">No results found. Try a different term, e.g. “LoRA”, “VRAM”, or “evaluation”.</div>';
      input.removeAttribute('aria-activedescendant');
      return;
    }

    container.innerHTML = `<ul style="list-style:none;margin:0;padding:0;">${this.results.map((item, i) => `
      <li>
        <a class="modal-result-item${i === this.focusedIndex ? ' focused' : ''}" id="search-result-${i}" href="${item.path}"${i === this.focusedIndex ? ' aria-current="true"' : ''}>
          <span>
            <span class="modal-result-title" style="display:block;">${this.highlightMatch(this.escapeHtml(item.title || 'Untitled'))}</span>
            <span class="modal-result-meta" style="display:block;">${this.escapeHtml(item.type || '')}${item.difficulty ? ' · ' + this.escapeHtml(item.difficulty) : ''}</span>
          </span>
        </a>
      </li>`).join('')}</ul>`;

    input.setAttribute('aria-activedescendant', `search-result-${this.focusedIndex}`);
  },

  escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  highlightMatch(text) {
    const raw = this.modal.querySelector('#search-input').value;
    if (!raw) return text;
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return text.replace(new RegExp(`(${esc})`, 'gi'), '<strong>$1</strong>');
    } catch { return text; }
  },

  handleKey(e) {
    // Only handle navigation keys; never interfere with normal text input.
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    const links = Array.from(this.modal.querySelectorAll('.modal-result-item'));
    if (links.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex = Math.min(this.focusedIndex + 1, links.length - 1);
      this.updateFocus(links);
      links[this.focusedIndex].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // ArrowUp on first result returns focus to the input.
      if (this.focusedIndex <= 0) {
        this.focusedIndex = 0;
        this.updateFocus(links);
        this.modal.querySelector('#search-input').focus();
      } else {
        this.focusedIndex -= 1;
        this.updateFocus(links);
        links[this.focusedIndex].focus();
      }
    } else if (e.key === 'Enter') {
      // Let native link activation handle Enter when focus is on a result.
      // When focus is still in the input, open the highlighted result.
      if (document.activeElement === this.modal.querySelector('#search-input') && links[this.focusedIndex]) {
        e.preventDefault();
        window.location.assign(links[this.focusedIndex].getAttribute('href'));
      }
    }
  },

  updateFocus(links) {
    const input = this.modal.querySelector('#search-input');
    links.forEach((link, i) => {
      const active = i === this.focusedIndex;
      link.classList.toggle('focused', active);
      if (active) {
        link.setAttribute('aria-current', 'true');
        input.setAttribute('aria-activedescendant', link.id);
      } else {
        link.removeAttribute('aria-current');
      }
    });
    links[this.focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }
};

window.Search = Search;
