const Learning = {
  _booted: false,
  _topics: null,
  _loadError: null,
  _currentId: null,

  async init() {
    if (this._booted) return;
    this._booted = true;
    this.renderLoadingState();
    await this.loadTopics();
    this.renderLessonList();
    this.setupTopicView();
    this.bindHashChanges();
    // If a hash is present on load, show that topic; otherwise show the list.
    if (window.location.hash) {
      this.showTopicFromHash();
    } else {
      this.showListView();
    }
  },

  renderLoadingState() {
    const container = document.getElementById('lesson-list');
    if (container) {
      container.innerHTML = '<div class="empty-state" role="status"><div class="empty-state-text">Loading curriculum…</div></div>';
    }
    const progressEl = document.getElementById('learning-progress');
    if (progressEl) {
      progressEl.innerHTML = '<div class="empty-state" role="status" style="padding:1rem;"><div class="empty-state-text">Loading progress…</div></div>';
    }
  },

  async loadTopics() {
    this._loadError = null;
    try {
      const res = await fetch('/data/topics.json', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._topics = Array.isArray(data) ? data : [];
      window.TOPICS = this._topics;
    } catch (err) {
      // Fallback: dynamic import for file:// or non-standard serving.
      try {
        const mod = await import('../data/topics.json', { assert: { type: 'json' } }).catch(() => import('../data/topics.json'));
        const data = mod.default || mod;
        this._topics = Array.isArray(data) ? data : (Array.isArray(data.topics) ? data.topics : []);
        window.TOPICS = this._topics;
      } catch {
        this._topics = Array.isArray(window.TOPICS) ? window.TOPICS : [];
        if (this._topics.length === 0) {
          this._loadError = err;
          window.TOPICS = [];
        }
      }
    }
    return window.TOPICS;
  },

  async loadSources() {
    // Best-effort: the curriculum works without the library; sources only
    // feed the "Primary Sources" block on topic pages.
    if (Array.isArray(window.SOURCES) && window.SOURCES.length > 0) return window.SOURCES;
    try {
      const res = await fetch('/data/sources.json', { headers: { Accept: 'application/json' } });
      const data = res.ok ? await res.json() : [];
      window.SOURCES = Array.isArray(data) ? data : [];
    } catch { window.SOURCES = []; }
    return window.SOURCES;
  },

  renderLessonList() {
    const container = document.getElementById('lesson-list');
    const progressEl = document.getElementById('learning-progress');

    // Error state
    if (this._loadError && (!window.TOPICS || window.TOPICS.length === 0)) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state" role="alert">
            <div class="empty-state-icon" aria-hidden="true">!</div>
            <div class="empty-state-text"><strong>Could not load the curriculum.</strong><br>Check your connection and try again.</div>
            <div class="mt-4"><button type="button" class="btn btn-secondary btn-sm" id="curriculum-retry">Retry</button></div>
          </div>`;
        document.getElementById('curriculum-retry')?.addEventListener('click', async () => {
          this._booted = false;
          await this.init();
        });
      }
      if (progressEl) progressEl.innerHTML = '';
      return;
    }

    // Empty state
    if (!window.TOPICS || window.TOPICS.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state" role="status">
            <div class="empty-state-icon" aria-hidden="true">□</div>
            <div class="empty-state-text"><strong>No lessons available yet.</strong><br>Check back soon or explore the <a href="/pages/roadmap.html">roadmap</a>.</div>
          </div>`;
      }
      if (progressEl) progressEl.innerHTML = '';
      return;
    }

    const completed = (window.Progress && window.Progress.completedLessons) || [];
    const progress = window.Progress ? window.Progress.getProgress() : { completed: 0, total: window.TOPICS.length, percentage: 0 };

    if (progressEl) {
      progressEl.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-muted">Your progress (stored locally)</span>
          <span class="text-sm text-mono" aria-live="polite">${progress.completed}/${progress.total} lessons</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${progress.percentage}" aria-valuemin="0" aria-valuemax="100" aria-label="Learning progress">
          <div class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
        </div>
      `;
    }

    if (!container) return;
    container.innerHTML = window.TOPICS.map((topic, i) => {
      const isCompleted = completed.includes(topic.id);
      return `
        <a href="#${topic.id}" class="lesson-card${isCompleted ? ' completed' : ''}" data-topic-id="${topic.id}"${isCompleted ? ' aria-label="' + this.escapeAttr(topic.title) + ' (completed)"' : ''}>
          <span class="lesson-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <span class="lesson-title">${this.escapeHtml(topic.title)}</span>
          <span class="lesson-difficulty difficulty-badge difficulty-${this.escapeAttr(topic.difficulty || 'L0')}">${this.escapeHtml(topic.difficulty || '')}</span>
          <span class="lesson-time">${this.escapeHtml(topic.estimatedTime || '~')}</span>
          <span class="lesson-status" aria-hidden="true">${isCompleted ? '✓' : ''}</span>
        </a>
      `;
    }).join('');
  },

  bindHashChanges() {
    if (this._hashBound) return;
    this._hashBound = true;
    window.addEventListener('hashchange', () => this.showTopicFromHash());
  },

  setupTopicView() {
    // No timers: hash handling is event-driven + explicit initial call in init().
  },

  showTopicFromHash() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) {
      this.showListView();
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    if (window.TOPICS && window.TOPICS.some((t) => t.id === id)) {
      this.viewTopic(id, { updateHash: false });
    } else if (window.TOPICS) {
      // Unknown hash: fall back to list with a notice.
      this.showListView();
    }
    // If TOPICS not loaded yet, init() will call this again after load.
  },

  showListView() {
    this._currentId = null;
    const listView = document.getElementById('lesson-list-view');
    const topicView = document.getElementById('topic-content-view');
    if (listView) listView.style.display = '';
    if (topicView) topicView.style.display = 'none';
    this.renderLessonList();
  },

  // OPEN LESSON -> READ -> MARK COMPLETE -> NEXT. Opening never completes.
  viewTopic(id, opts = {}) {
    const topic = (window.TOPICS || []).find((t) => t.id === id);
    if (!topic) return;

    if (opts.updateHash !== false && window.location.hash !== `#${id}`) {
      window.location.hash = id;
      // hashchange will re-enter viewTopic with updateHash:false; continue rendering anyway.
    }

    this._currentId = id;
    try {
      if (window.Progress) window.Progress.setPreference('lastLesson', id);
    } catch { /* ignore */ }

    const listView = document.getElementById('lesson-list-view');
    const topicView = document.getElementById('topic-content-view');
    const container = document.getElementById('topic-content');
    if (!container) return;
    if (listView) listView.style.display = 'none';
    if (topicView) topicView.style.display = '';

    const isCompleted = window.Progress ? window.Progress.isCompleted(id) : false;

    const prereqs = (topic.prerequisites || []).map((p) => `<span class="prereq-tag">${this.escapeHtml(p)}</span>`).join('');
    const related = (topic.related || []).map((r) => `<span class="prereq-tag">${this.escapeHtml(r)}</span>`).join('');
    const next = this.getNextTopicIndex(id);
    const prev = this.getPrevTopicIndex(id);

    container.innerHTML = `
      <div class="topic-header">
        <div class="breadcrumbs">
          <a href="/pages/learn.html">Learn</a>
          <span class="sep" aria-hidden="true">/</span>
          <span>${this.escapeHtml(topic.title)}</span>
        </div>
        <h1>${this.escapeHtml(topic.title)}</h1>
        <div class="topic-meta">
          <span class="difficulty-badge difficulty-${this.escapeAttr(topic.difficulty || 'L0')}">${this.escapeHtml(topic.difficulty || '')}</span>
          ${topic.estimatedTime ? `<span class="badge">${this.escapeHtml(topic.estimatedTime)}</span>` : ''}
          <span class="badge">${this.escapeHtml(topic.category || 'topic')}</span>
          ${isCompleted ? '<span class="badge badge-success" aria-label="Completed">✓ Completed</span>' : ''}
        </div>
        ${prereqs ? `<div class="topic-prerequisites mt-4"><strong style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--color-text-secondary);">Prerequisites:</strong>${prereqs}</div>` : ''}
        <div class="flex gap-3 mt-4" style="flex-wrap:wrap;">
          <button type="button" class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'}" id="lesson-complete-btn" aria-pressed="${isCompleted ? 'true' : 'false'}">
            ${isCompleted ? '✓ Completed — Undo' : 'Mark as complete'}
          </button>
          <a class="btn btn-ghost btn-sm" href="/pages/learn.html" id="lesson-back-link">← All lessons</a>
        </div>
        <div id="lesson-complete-status" class="text-sm mt-2" role="status" aria-live="polite"></div>
      </div>

      <div class="expert-layers">
        ${this.layerBlock(topic, 'beginner', 'Beginner — What is it?', this.getBeginnerContent(topic), false)}
        ${this.layerBlock(topic, 'intermediate', 'Intermediate — How does it work?', this.getIntermediateContent(topic), false)}
        ${this.layerBlock(topic, 'advanced', 'Advanced — Implementation', this.getAdvancedContent(topic), true)}
        ${this.layerBlock(topic, 'deepdive', 'Deep Dive — Details', this.getDeepDiveContent(topic), true)}
      </div>

      ${this.nextActionsBlock(topic)}

      ${related ? `
        <div class="mt-8">
          <div class="section-title">Related Concepts</div>
          <div class="knowledge-graph">
            ${(topic.related || []).map((r) => `<div class="graph-card"><div class="graph-card-title">${this.escapeHtml(r.trim())}</div><div class="graph-card-type">Related topic</div></div>`).join('')}
          </div>
        </div>
      ` : ''}

      <div id="topic-sources" class="mt-8"></div>

      <div class="topic-nav">
        <button type="button" class="topic-nav-btn prev" id="topic-prev-btn"${prev ? '' : ' disabled'}>
          <span class="topic-nav-prev-label">← Previous</span>
          <span class="topic-nav-title">${this.escapeHtml(this.getPrevTitle(id))}</span>
        </button>
        <button type="button" class="topic-nav-btn next" id="topic-next-btn"${next ? '' : ' disabled'}>
          <span class="topic-nav-next-label">Next →</span>
          <span class="topic-nav-title">${this.escapeHtml(this.getNextTitle(id))}</span>
        </button>
      </div>
    `;

    document.getElementById('lesson-complete-btn')?.addEventListener('click', () => this.toggleComplete(id));
    document.getElementById('lesson-back-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '';
      this.showListView();
      document.getElementById('lesson-list-view')?.scrollIntoView();
    });
    document.getElementById('topic-prev-btn')?.addEventListener('click', () => this.prevTopic(id));
    document.getElementById('topic-next-btn')?.addEventListener('click', () => this.nextTopic(id));

    // Wire layer toggles (native buttons).
    container.querySelectorAll('[data-layer-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleLayerBtn(btn));
    });

    // Refresh the list behind the detail so progress stays consistent.
    this.renderLessonList();
    // Fill the Primary Sources block (async; never blocks the lesson).
    this.renderTopicSources(id);
    // Move focus to the lesson heading for keyboard/screen-reader users.
    const h1 = container.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  },

  async renderTopicSources(id) {
    const box = document.getElementById('topic-sources');
    if (!box) return;
    const sources = await this.loadSources();
    // The user may have navigated away while sources loaded.
    if (this._currentId !== id || !document.getElementById('topic-sources')) return;
    const mine = sources
      .filter((s) => (s.topics || []).includes(id))
      .sort((a, b) => (a.tier - b.tier) || a.title.localeCompare(b.title))
      .slice(0, 6);
    if (mine.length === 0) return;
    box.innerHTML = `
      <div class="section-title">Primary Sources</div>
      <div class="vram-breakdown mt-4">
        ${mine.map((s) => `<div class="vram-row"><span class="vram-row-label"><a href="${this.escapeHtml(s.url)}" target="_blank" rel="noopener">${this.escapeHtml(s.title)} ↗</a></span><span class="vram-row-value" style="font-size:var(--text-xs);">Tier ${s.tier}</span></div>`).join('')}
      </div>
      <div class="mt-2"><a class="btn btn-sm btn-secondary" href="/pages/library.html?topic=${this.escapeAttr(id)}">All sources for this topic →</a></div>`;
  },

  layerBlock(topic, layer, title, contentHtml, collapsed) {    const contentId = `layer-${this.escapeAttr(topic.id)}-${layer}`;
    const btnId = `${contentId}-btn`;
    return `
      <div class="expert-layer" data-layer="${layer}">
        <button type="button" class="expert-layer-header" id="${btnId}" data-layer-toggle aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="${contentId}">
          <span class="expert-layer-title">${this.escapeHtml(title)}</span>
          <span class="expandable-icon" aria-hidden="true">${collapsed ? '+' : '−'}</span>
        </button>
        <div class="expert-layer-content" id="${contentId}"${collapsed ? ' hidden' : ''}>${contentHtml}</div>
      </div>`;
  },

  toggleLayerBtn(btn) {
    const panel = btn.closest('.expert-layer');
    const contentId = btn.getAttribute('aria-controls');
    const content = contentId ? document.getElementById(contentId) : panel?.querySelector('.expert-layer-content');
    if (!content) return;
    const willExpand = content.hasAttribute('hidden');
    if (willExpand) content.removeAttribute('hidden');
    else content.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
    const icon = btn.querySelector('.expandable-icon');
    if (icon) icon.textContent = willExpand ? '−' : '+';
  },

  // Legacy inline-handler entry point (kept; delegates to the button logic).
  toggleLayer(header) {
    const btn = header.closest ? header.closest('.expert-layer')?.querySelector('[data-layer-toggle]') : null;
    if (btn) this.toggleLayerBtn(btn);
    else if (header instanceof HTMLElement) {
      const panel = header.closest('.expert-layer');
      const content = panel?.querySelector('.expert-layer-content');
      const icon = header.querySelector?.('.expandable-icon');
      if (!content) return;
      const hidden = content.hasAttribute('hidden') || content.classList.contains('hidden');
      content.classList.remove('hidden');
      if (hidden) content.removeAttribute('hidden');
      else content.setAttribute('hidden', '');
      if (icon) icon.textContent = hidden ? '−' : '+';
    }
  },

  toggleComplete(id) {
    if (!window.Progress) return;
    const nowCompleted = window.Progress.toggleLesson(id);
    const status = document.getElementById('lesson-complete-status');
    if (status) {
      status.textContent = nowCompleted ? 'Marked as complete. Progress saved on this device.' : 'Completion removed. Progress updated.';
    }
    // Re-render detail header state + list without losing scroll.
    this.viewTopic(id, { updateHash: false });
    const msg = document.getElementById('lesson-complete-status');
    if (msg) msg.textContent = nowCompleted ? 'Marked as complete. Progress saved on this device.' : 'Completion removed. Progress updated.';
  },

  nextActionsBlock(topic) {
    // Contextual cross-links: only where they genuinely help.
    const id = (topic.id || '').toLowerCase();
    const byId = {
      'lora': [['/pages/planner.html', 'Try it in Training Planner →'], ['/pages/calculator.html', 'Estimate VRAM →']],
      'qlora': [['/pages/calculator.html', 'Estimate QLoRA VRAM →'], ['/pages/planner.html', 'Plan the run →']],
      'fine-tuning': [['/pages/planner.html', 'Try it in Training Planner →'], ['/pages/calculator.html', 'Estimate VRAM →']],
      'sft-formatting': [['/pages/planner.html', 'Try it in Training Planner →'], ['/pages/learn.html#tokenizers', 'Review tokenization →']],
      'continued-pretraining': [['/pages/planner.html', 'Plan continued pretraining →'], ['/pages/data-planner.html', 'Plan the data mix →']],
      'dpo': [['/pages/planner.html', 'Try it in Training Planner →']],
      'rlhf': [['/pages/planner.html', 'Try it in Training Planner →']],
      'pretraining': [['/pages/planner.html', 'Plan a pretraining run →'], ['/pages/calculator.html', 'Estimate VRAM →']],
      'effective-batch-size': [['/pages/calculator.html', 'Estimate VRAM →'], ['/pages/learn.html#gradient-accumulation', 'Learn accumulation →']],
      'gradient-accumulation': [['/pages/calculator.html', 'Estimate VRAM →']],
      'tokenizers': [['/pages/token-calc.html', 'Open Token Budget calculator →']],
      'tokenizer-bpe': [['/pages/token-calc.html', 'Open Token Budget calculator →']],
      'sentencepiece': [['/pages/token-calc.html', 'Open Token Budget calculator →']],
      'embeddings': [['/pages/model-calc.html', 'Open Model Calculator →']],
      'attention': [['/pages/model-calc.html', 'Open Model Calculator →']],
      'multi-head-attention': [['/pages/model-calc.html', 'Open Model Calculator →']],
      'gqa': [['/pages/inference-calc.html', 'See KV-cache savings →']],
      'mqa': [['/pages/inference-calc.html', 'See KV-cache savings →']],
      'kv-cache': [['/pages/inference-calc.html', 'Estimate inference memory →']],
      'inference-basic': [['/pages/inference-calc.html', 'Estimate inference memory →']],
      'inference-batching': [['/pages/inference-calc.html', 'Estimate inference memory →']],
      'sampling': [['/pages/learn.html#inference-basic', 'Review inference basics →']],
      'quantization': [['/pages/inference-calc.html', 'Estimate quantized inference →']],
      'evaluation': [['/pages/eval-planner.html', 'Plan an evaluation →'], ['/pages/evaluation.html', 'Browse benchmarks →']],
      'eval-design': [['/pages/eval-planner.html', 'Plan an evaluation →'], ['/pages/evaluation.html', 'Browse benchmarks →']],
      'perplexity': [['/pages/learn.html#loss-curves', 'Learn to read curves →']],
      'loss-curves': [['/pages/learn.html#overfitting-underfitting', 'Diagnose over/underfit →']],
      'overfitting-underfitting': [['/pages/learn.html#eval-design', 'Design the eval →']],
      'contamination': [['/pages/learn.html#eval-design', 'Design clean evals →']],
      'deduplication': [['/pages/data-planner.html', 'Open Data Planner →']],
      'dataset-engineering': [['/pages/data-planner.html', 'Open Data Planner →']],
      'data-cleaning': [['/pages/data-planner.html', 'Open Data Planner →']],
      'data-mixing-splits': [['/pages/data-planner.html', 'Open Data Planner →']],
      'licensing': [['/pages/data-planner.html', 'Open Data Planner →']],
      'vram-memory': [['/pages/calculator.html', 'Estimate VRAM →'], ['/pages/hardware.html', 'Check GPUs →']],
      'memory-optimization': [['/pages/calculator.html', 'Estimate VRAM →'], ['/pages/hardware.html', 'Check GPUs →']],
      'gradient-checkpointing': [['/pages/calculator.html', 'Estimate VRAM →']],
      'mixed-precision': [['/pages/calculator.html', 'Estimate VRAM →']],
      'bf16': [['/pages/calculator.html', 'Estimate VRAM →']],
      'precision-fp16': [['/pages/learn.html#bf16', 'Why BF16 instead →']],
      'fp8': [['/pages/hardware.html', 'Check FP8 support →']],
      'ddp': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'fsdp': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'zero': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'tensor-parallelism': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'pipeline-parallelism': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'expert-parallelism': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'moe': [['/pages/scaling.html', 'Read the Scaling guide →']],
      'throughput': [['/pages/scaling.html', 'Read the Scaling guide →'], ['/pages/calculator.html', 'Estimate VRAM →']],
      'profiling': [['/pages/learn.html#throughput', 'Understand MFU first →']],
      'reproducibility': [['/pages/learn.html#eval-design', 'Lock evals too →']],
      'deployment-basics': [['/pages/inference-calc.html', 'Size the deployment →'], ['/pages/troubleshooting.html', 'Know the failure modes →']],
      'serving-observability': [['/pages/inference-calc.html', 'Size the deployment →'], ['/pages/troubleshooting.html', 'Know the failure modes →']],
      'checkpoints': [['/pages/learn.html#reproducibility', 'Track runs too →']],
      'learning-rate': [['/pages/learn.html#schedulers', 'Pair with a schedule →'], ['/pages/calculator.html', 'Check the batch budget →']],
      'schedulers': [['/pages/learn.html#learning-rate', 'Pair with the LR →']],
      'optimization': [['/pages/learn.html#learning-rate', 'LR matters most →']],
      'weight-decay': [['/pages/learn.html#learning-rate', 'Pair with the LR →']]
    };
    let links = byId[id];
    if (!links) {
      if (id.includes('lora') || id.includes('fine-tun') || id.includes('sft') || id.includes('dpo')) {
        links = [{ href: '/pages/planner.html', label: 'Try it in Training Planner →' }, { href: '/pages/calculator.html', label: 'Estimate VRAM →' }];
      } else if (id.includes('token')) {
        links = [{ href: '/pages/token-calc.html', label: 'Open Token Budget calculator →' }];
      } else if (id.includes('eval')) {
        links = [{ href: '/pages/eval-planner.html', label: 'Plan an evaluation →' }];
      } else if (id.includes('data')) {
        links = [{ href: '/pages/data-planner.html', label: 'Open Data Planner →' }];
      } else if (id.includes('infer') || id.includes('deploy') || id.includes('quant')) {
        links = [{ href: '/pages/inference-calc.html', label: 'Estimate inference memory →' }];
      } else if (id.includes('gpu') || id.includes('hardware') || id.includes('memory') || id.includes('optim')) {
        links = [{ href: '/pages/hardware.html', label: 'Check GPUs →' }, { href: '/pages/calculator.html', label: 'Estimate VRAM →' }];
      } else if (id.includes('distributed') || id.includes('parallel') || id.includes('scal')) {
        links = [{ href: '/pages/scaling.html', label: 'Read the Scaling guide →' }];
      } else {
        return '';
      }
      return `
        <div class="callout callout-info mt-8">
          <div class="callout-title">Next actions</div>
          <div class="flex gap-3" style="flex-wrap:wrap;">
            ${links.map((l) => `<a class="btn btn-sm btn-secondary" href="${l.href}">${this.escapeHtml(l.label)}</a>`).join('')}
          </div>
        </div>`;
    }
    return `
      <div class="callout callout-info mt-8">
        <div class="callout-title">Next actions</div>
        <div class="flex gap-3" style="flex-wrap:wrap;">
          ${links.map(([href, label]) => `<a class="btn btn-sm btn-secondary" href="${href}">${this.escapeHtml(label)}</a>`).join('')}
        </div>
      </div>`;
  },

  getBeginnerContent(topic) {
    return topic.sections?.beginner || topic.explanation || `<p>${this.escapeHtml(topic.title)} is a fundamental concept in LLM engineering. It covers the basics that every practitioner should understand.</p>`;
  },

  getIntermediateContent(topic) {
    return topic.sections?.intermediate || `<p>At an intermediate level, ${this.escapeHtml(topic.title)} involves understanding the mechanics and practical considerations.</p>`;
  },

  getAdvancedContent(topic) {
    return topic.sections?.advanced || `<p>Advanced usage of ${this.escapeHtml(topic.title)} requires deep understanding of underlying systems.</p>`;
  },

  getDeepDiveContent(topic) {
    return topic.sections?.deepdive || `<p>For those who want to go deeper into ${this.escapeHtml(topic.title)}, the technical details and edge cases are important.</p>`;
  },

  getNextTopicIndex(id) {
    const idx = (window.TOPICS || []).findIndex((t) => t.id === id);
    return idx >= 0 && idx < window.TOPICS.length - 1 ? window.TOPICS[idx + 1] : null;
  },

  getPrevTopicIndex(id) {
    const idx = (window.TOPICS || []).findIndex((t) => t.id === id);
    return idx > 0 ? window.TOPICS[idx - 1] : null;
  },

  nextTopic(id) {
    const next = this.getNextTopicIndex(id);
    if (next) this.viewTopic(next.id);
  },

  prevTopic(id) {
    const prev = this.getPrevTopicIndex(id);
    if (prev) this.viewTopic(prev.id);
  },

  getPrevTitle(id) {
    const prev = this.getPrevTopicIndex(id);
    return prev ? prev.title : 'Start here';
  },

  getNextTitle(id) {
    const next = this.getNextTopicIndex(id);
    return next ? next.title : 'End of curriculum';
  },

  escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  escapeAttr(s) {
    return this.escapeHtml(s).replace(/"/g, '&quot;');
  }
};

window.Learning = Learning;
