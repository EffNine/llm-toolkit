const Guide = {
  _booted: false,
  _guide: null,
  _done: new Set(),
  _blocks: [],

  store() {
    if (window.Storage && typeof window.Storage.get === 'function') return window.Storage;
    return {
      get(k, fb) {
        try {
          const v = localStorage.getItem(`llmtoolkit_${k}`);
          return v ? JSON.parse(v) : fb;
        } catch { return fb; }
      },
      set(k, v) {
        try { localStorage.setItem(`llmtoolkit_${k}`, JSON.stringify(v)); } catch {}
      }
    };
  },

  progressKey() {
    return `guide_${this._guide ? this._guide.id : 'unknown'}`;
  },

  async init() {
    if (this._booted) return;
    this._booted = true;
    const root = document.getElementById('guide-root');
    if (!root) return;
    const id = document.body.getAttribute('data-guide')
      || new URLSearchParams(window.location.search).get('g')
      || 'tiny-lm';
    root.innerHTML = '<div class="empty-state" role="status"><div class="empty-state-text">Loading guide…</div></div>';
    let guides = [];
    try {
      const res = await fetch('/data/guides.json', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      guides = Array.isArray(data) ? data : (data.guides || []);
    } catch {
      root.innerHTML = '<div class="empty-state" role="alert"><div class="empty-state-text"><strong>Could not load the guide.</strong><br>Check your connection and reload.</div></div>';
      return;
    }
    const guide = guides.find((g) => g.id === id) || guides[0];
    if (!guide) {
      root.innerHTML = '<div class="empty-state" role="status"><div class="empty-state-text"><strong>No guides yet.</strong><br>Check back soon.</div></div>';
      return;
    }
    this._guide = guide;
    this._done = new Set(this.store().get(this.progressKey(), []));
    this.render(root);
  },

  saveProgress() {
    this.store().set(this.progressKey(), [...this._done]);
  },

  render(root) {
    const g = this._guide;
    this._blocks = [];
    const prereqs = (g.prerequisites || []).map((p) =>
      `<a class="prereq-tag" href="/pages/learn.html#${this.escapeAttr(p)}">${this.escapeHtml(p)}</a>`
    ).join('');
    root.innerHTML = `
      <div class="page-header narrow">
        <div class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><a href="/pages/projects.html">Projects</a><span class="sep">/</span><span>Guide</span></div>
        <h1>${this.escapeHtml(g.title)}</h1>
        <p style="margin-top: var(--space-4);">${this.escapeHtml(g.objective || '')}</p>
        <div class="topic-meta mt-4">
          <span class="difficulty-badge difficulty-${this.escapeAttr(g.difficulty || 'L1')}">${this.escapeHtml(g.difficulty || '')}</span>
          ${g.estimatedTime ? `<span class="badge">${this.escapeHtml(g.estimatedTime)}</span>` : ''}
        </div>
        <div class="grid-2 mt-6" style="gap: var(--space-6);">
          <div><div class="section-title">YOU NEED</div><p class="text-sm">${this.escapeHtml(g.hardware || '')}<br>${this.escapeHtml(g.software || '')}</p></div>
          <div><div class="section-title">PREREQUISITES</div><div class="topic-prerequisites">${prereqs || '<span class="text-muted text-sm">None</span>'}</div></div>
        </div>
        <div id="guide-progress" class="mt-6"></div>
      </div>
      <div class="page-content narrow">
        <h2 class="section-title">STEPS</h2>
        <div id="guide-steps">
          ${(g.steps || []).map((s, i) => this.stepHtml(s, i)).join('')}
        </div>
        ${g.next ? `
        <div class="callout callout-info mt-8">
          <div class="callout-title">Done with this guide?</div>
          <div class="flex gap-3" style="flex-wrap:wrap;">
            <a class="btn btn-sm btn-secondary" href="${this.escapeAttr(g.next.href)}">${this.escapeHtml(g.next.label)} →</a>
          </div>
        </div>` : ''}
      </div>`;
    this.renderProgress();
    root.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.copyBlock(btn));
    });
    root.querySelectorAll('[data-step-done]').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleStep(btn.getAttribute('data-step-done')));
    });
    const reset = document.getElementById('guide-reset');
    if (reset) reset.addEventListener('click', () => this.resetProgress());
  },

  stepHtml(step, idx) {
    const done = this._done.has(step.id);
    const open = !done && (idx === 0 || this._done.has(((this._guide.steps || [])[idx - 1] || {}).id));
    return `
      <div class="expandable-panel guide-step${open ? ' open' : ''}${done ? ' guide-step-done' : ''}" data-step-panel="${this.escapeAttr(step.id)}">
        <button type="button" class="expandable-header" aria-expanded="${open ? 'true' : 'false'}">
          <span class="expandable-title">${done ? '✓ ' : ''}<span class="text-mono text-tertiary">Step ${idx + 1} · </span>${this.escapeHtml(step.title)}${step.time ? ` <span class="text-xs text-tertiary">(${this.escapeHtml(step.time)})</span>` : ''}</span>
          <span class="expandable-icon" aria-hidden="true">${open ? '−' : '+'}</span>
        </button>
        <div class="expandable-content">
          <div class="expandable-body">
            ${step.goal ? `<p style="margin-bottom: var(--space-4);"><strong>Goal:</strong> ${this.escapeHtml(step.goal)}</p>` : ''}
            ${(step.blocks || []).map((b) => this.codeHtml(b)).join('')}
            ${step.expected ? `<div class="callout callout-tip"><div class="callout-title">What success looks like</div><p style="margin:0;">${this.escapeHtml(step.expected)}</p></div>` : ''}
            ${(step.checks || []).length > 0 ? `
            <div class="section-title">VERIFY</div>
            <ul style="padding-left: var(--space-4); margin-bottom: var(--space-4);">
              ${step.checks.map((c) => `<li style="margin-bottom: var(--space-1);">☐ ${this.escapeHtml(c)}</li>`).join('')}
            </ul>` : ''}
            ${(step.fixes || []).length > 0 ? `
            <div class="section-title">IF IT BREAKS</div>
            <div class="vram-breakdown">
              ${step.fixes.map((f) => `<div class="vram-row"><span class="vram-row-label"><strong>${this.escapeHtml(f.s)}</strong><br><span class="text-sm text-muted">${this.escapeHtml(f.fix)}</span></span></div>`).join('')}
            </div>` : ''}
            <div class="flex gap-3 mt-4" style="flex-wrap:wrap;">
              <button type="button" class="btn btn-sm ${done ? 'btn-secondary' : 'btn-primary'}" data-step-done="${this.escapeAttr(step.id)}" aria-pressed="${done ? 'true' : 'false'}">${done ? '✓ Done — Undo' : 'Mark step done'}</button>
            </div>
          </div>
        </div>
      </div>`;
  },

  codeHtml(block) {
    const code = Array.isArray(block.code) ? block.code.join('\n') : String(block.code || '');
    const idx = this._blocks.length;
    this._blocks.push(code);
    return `
      <div class="guide-code">
        <div class="guide-code-head"><span>${this.escapeHtml(block.label || block.lang || 'code')}</span><button type="button" class="btn btn-sm btn-ghost" data-copy="${idx}">Copy</button></div>
        <pre>${this.escapeHtml(code)}</pre>
      </div>`;
  },

  copyBlock(btn) {
    const code = this._blocks[Number(btn.getAttribute('data-copy'))] || '';
    const done = () => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => done());
    } else {
      done();
    }
  },

  toggleStep(id) {
    if (this._done.has(id)) this._done.delete(id);
    else this._done.add(id);
    this.saveProgress();
    this.renderProgress();
    // Update the step panel + button in place (no full re-render).
    const steps = this._guide.steps || [];
    const idx = steps.findIndex((s) => s.id === id);
    const panel = document.querySelector(`[data-step-panel="${id}"]`);
    if (panel) {
      const done = this._done.has(id);
      panel.classList.toggle('guide-step-done', done);
      const btn = panel.querySelector('[data-step-done]');
      if (btn) {
        btn.setAttribute('aria-pressed', done ? 'true' : 'false');
        btn.textContent = done ? '✓ Done — Undo' : 'Mark step done';
        btn.classList.toggle('btn-primary', !done);
        btn.classList.toggle('btn-secondary', done);
      }
      const title = panel.querySelector('.expandable-title');
      if (title) {
        const step = steps[idx];
        title.innerHTML = `${done ? '✓ ' : ''}<span class="text-mono text-tertiary">Step ${idx + 1} · </span>${this.escapeHtml(step.title)}${step.time ? ` <span class="text-xs text-tertiary">(${this.escapeHtml(step.time)})</span>` : ''}`;
      }
      // Completing a step opens the next one.
      if (done) {
        const next = steps[idx + 1];
        const nextPanel = next ? document.querySelector(`[data-step-panel="${next.id}"]`) : null;
        if (nextPanel && !nextPanel.classList.contains('open')) {
          const header = nextPanel.querySelector('.expandable-header');
          if (header) header.click();
          nextPanel.scrollIntoView({ block: 'start' });
        }
      }
      btn?.focus({ preventScroll: true });
    }
  },

  resetProgress() {
    this._done = new Set();
    this.saveProgress();
    const root = document.getElementById('guide-root');
    if (root) this.render(root);
  },

  renderProgress() {
    const el = document.getElementById('guide-progress');
    if (!el || !this._guide) return;
    const total = (this._guide.steps || []).length;
    const done = (this._guide.steps || []).filter((s) => this._done.has(s.id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    el.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-muted">Your progress (stored locally)</span>
        <span class="text-sm text-mono" aria-live="polite">${done}/${total} steps</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Guide progress">
        <div class="progress-bar-fill" style="width: ${pct}%"></div>
      </div>
      ${done > 0 ? `<div class="mt-2"><button type="button" class="btn btn-sm btn-ghost" id="guide-reset">Reset progress</button></div>` : ''}`;
    const reset = document.getElementById('guide-reset');
    if (reset) reset.addEventListener('click', () => this.resetProgress());
  },

  escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  escapeAttr(s) {
    return this.escapeHtml(s).replace(/"/g, '&quot;');
  }
};

window.Guide = Guide;
