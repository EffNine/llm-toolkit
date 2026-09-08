const Planner = {
  steps: ['experience', 'goal', 'hardware', 'time', 'budget'],
  currentStep: 0,
  answers: {},
  topicsById: null,

  init() {
    if (this._booted) return;
    this._booted = true;
    this.restoreWizard();
    this.renderStepper();
    this.renderStep();
    this.renderSavedBanner();
    this.loadTopicIndex();
  },

  // --- persistence (continuity) -------------------------------------------
  wizardKey() {
    return 'roadmapWizard';
  },

  persistWizard() {
    try {
      if (window.Progress) window.Progress.setPreference(this.wizardKey(), { answers: this.answers, currentStep: this.currentStep });
    } catch { /* private mode: ignore */ }
  },

  restoreWizard() {
    try {
      const saved = window.Progress?.preferences?.[this.wizardKey()];
      if (saved && saved.answers && typeof saved.answers === 'object') {
        this.answers = saved.answers;
        if (Number.isInteger(saved.currentStep) && saved.currentStep >= 0 && saved.currentStep < this.steps.length) {
          this.currentStep = saved.currentStep;
        }
        this._restored = Object.keys(this.answers).length > 0;
      }
    } catch { /* ignore */ }
  },

  clearWizard() {
    try {
      if (window.Progress) window.Progress.setPreference(this.wizardKey(), null);
    } catch { /* ignore */ }
    this._restored = false;
  },

  async loadTopicIndex() {
    try {
      const res = await fetch('/data/topics.json', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        this.topicsById = {};
        data.forEach((t) => { if (t && t.id) this.topicsById[t.id] = t; });
      }
    } catch { /* offline or file:// — static link map still works */ }
  },

  // --- wizard rendering -----------------------------------------------------
  renderStepper() {
    const el = document.getElementById('wizard-stepper');
    if (!el) return;

    el.innerHTML = this.steps.map((step, i) => `
      <div class="wizard-step ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}" role="listitem" ${i === this.currentStep ? 'aria-current="step"' : ''}>
        <span class="wizard-step-num" aria-hidden="true">${i < this.currentStep ? '✓' : i + 1}</span>
        <span>${step.charAt(0).toUpperCase() + step.slice(1)}${this.answers[step] ? ' ✓' : ''}</span>
      </div>
      ${i < this.steps.length - 1 ? `<div class="wizard-step-line ${i < this.currentStep ? 'completed' : ''}" aria-hidden="true"></div>` : ''}
    `).join('');
  },

  stepConfigs() {
    return {
      experience: {
        title: 'What is your experience level?',
        hint: 'This decides how much foundation material your roadmap includes.',
        options: [
          { value: 'beginner', label: 'Complete beginner', desc: 'No programming or ML experience' },
          { value: 'some-code', label: 'Some programming', desc: 'Know basic Python, new to ML' },
          { value: 'ml-beginner', label: 'ML beginner', desc: 'Understand ML basics, not LLMs' },
          { value: 'ml-practitioner', label: 'ML practitioner', desc: 'Have trained models before' },
          { value: 'experienced', label: 'Experienced engineer', desc: 'Comfortable with DL and LLMs' }
        ]
      },
      goal: {
        title: 'What is your primary goal?',
        hint: 'Your goal shapes the projects and depth of your roadmap.',
        options: [
          { value: 'understand', label: 'Understand LLMs', desc: 'Learn how they work conceptually' },
          { value: 'tiny-lm', label: 'Train a tiny LLM', desc: 'Build a small model from scratch' },
          { value: 'small-llm', label: 'Train a small LLM', desc: 'Train a 100M-1B parameter model' },
          { value: 'finetune', label: 'Fine-tune a model', desc: 'Adapt an existing model' },
          { value: 'domain-model', label: 'Build a domain model', desc: 'Create a specialized model' },
          { value: 'distributed', label: 'Learn distributed training', desc: 'Scale across multiple GPUs' }
        ]
      },
      hardware: {
        title: 'What hardware do you have access to?',
        hint: 'We use this to keep project recommendations realistic.',
        options: [
          { value: 'cpu', label: 'CPU only', desc: 'No GPU available' },
          { value: 'laptop', label: 'Laptop GPU', desc: 'Consumer GPU like RTX 3050/4050' },
          { value: 'consumer', label: 'Consumer GPU', desc: 'RTX 3080/4080/4090 or equivalent' },
          { value: 'workstation', label: 'Workstation', desc: 'Multiple consumer or RTX A-series' },
          { value: 'multigpu', label: 'Multi-GPU setup', desc: '2+ GPUs with NVLink or PCIe' },
          { value: 'cloud', label: 'Cloud access', desc: 'Can rent GPU instances' }
        ]
      },
      time: {
        title: 'How much time can you commit?',
        hint: 'Used to estimate how many weeks your roadmap will take.',
        options: [
          { value: '1-2h', label: '1-2 hours/week', desc: 'Light engagement' },
          { value: '3-5h', label: '3-5 hours/week', desc: 'Moderate engagement' },
          { value: '5-10h', label: '5-10 hours/week', desc: 'Serious engagement' },
          { value: '10+h', label: '10+ hours/week', desc: 'Full-time learning' }
        ]
      },
      budget: {
        title: 'What is your budget?',
        hint: 'Used to tailor hardware and tooling suggestions.',
        options: [
          { value: 'free', label: 'Free / existing hardware', desc: 'No additional cost' },
          { value: 'low', label: 'Low ($0-100)', desc: 'Minimal spending allowed' },
          { value: 'moderate', label: 'Moderate ($100-500)', desc: 'Can invest in learning' },
          { value: 'high', label: 'High ($500-2000)', desc: 'Serious investment OK' },
          { value: 'enterprise', label: 'Research / enterprise', desc: 'Budget for production' }
        ]
      }
    };
  },

  renderStep() {
    const el = document.getElementById('wizard-step-content');
    if (!el) return;

    const step = this.steps[this.currentStep];
    const config = this.stepConfigs()[step];
    const selected = this.answers[step];

    el.innerHTML = `
      <h2 tabindex="-1" id="wizard-step-heading" style="margin-bottom: var(--space-2);">Step ${this.currentStep + 1} of ${this.steps.length}: ${config.title}</h2>
      <p class="text-sm text-muted" style="margin-bottom:var(--space-6);">${config.hint}</p>
      ${this._restored && this.currentStep === 0 ? `<div class="callout callout-info" role="status"><div class="callout-title">Welcome back</div><p style="margin:0;font-size:var(--text-sm);">We restored your previous answers. Change anything or continue where you left off.</p></div>` : ''}
      <div class="selection-grid" role="group" aria-label="${config.title}">
        ${config.options.map((opt) => `
          <button type="button" class="selection-option ${selected === opt.value ? 'selected' : ''}"
               aria-pressed="${selected === opt.value ? 'true' : 'false'}"
               data-step="${step}" data-value="${opt.value}">
            <span class="selection-option-title" style="display:block;">${opt.label}</span>
            <span class="selection-option-desc" style="display:block;">${opt.desc}</span>
          </button>
        `).join('')}
      </div>
      <div class="flex justify-between mt-8">
        ${this.currentStep > 0 ? `<button type="button" class="btn btn-secondary" data-action="prev">← Back</button>` : '<div></div>'}
        ${this.currentStep < this.steps.length - 1
          ? `<button type="button" class="btn btn-primary" data-action="next"${!selected ? ' disabled' : ''}>Next →</button>`
          : `<button type="button" class="btn btn-primary btn-lg" data-action="generate"${!selected ? ' disabled' : ''}>Generate Roadmap →</button>`
        }
      </div>
    `;
    el.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => this.select(btn.dataset.step, btn.dataset.value));
    });
    el.querySelector('[data-action="prev"]')?.addEventListener('click', () => this.prevStep());
    el.querySelector('[data-action="next"]')?.addEventListener('click', () => this.nextStep());
    el.querySelector('[data-action="generate"]')?.addEventListener('click', () => this.generateRoadmap());
  },

  focusHeading() {
    document.getElementById('wizard-step-heading')?.focus({ preventScroll: true });
  },

  select(step, value) {
    this.answers[step] = value;
    this._restored = false;
    this.persistWizard();
    this.renderStepper();
    this.renderStep();
    // Keep keyboard users where they are after the re-render.
    document.querySelector(`#wizard-step-content [data-value="${value}"]`)?.focus({ preventScroll: true });
  },

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.persistWizard();
      this.renderStepper();
      this.renderStep();
      this.focusHeading();
    }
  },

  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.persistWizard();
      this.renderStepper();
      this.renderStep();
      this.focusHeading();
    }
  },

  // --- roadmap construction --------------------------------------------------
  // Static navigation map: each roadmap step points at the most relevant
  // existing Learn topic (by id) or toolkit page. Blurbs come from
  // topics.json at runtime; `fallback` covers steps with no topic match.
  stepLinks() {
    return {
      'linux-basics': { learn: 'linux-basics', tool: { href: '/pages/reference.html', label: 'Command reference' } },
      'python-fundamentals': { learn: 'python-fundamentals' },
      'git-basics': { learn: 'git-basics' },
      'math-fundamentals': { learn: 'linear-algebra', fallback: 'Math foundations: start with Linear Algebra, then Calculus and Probability.' },
      'numpy': { learn: 'numpy' },
      'ml-fundamentals': { learn: 'ml-fundamentals', tool: { href: '/pages/eval-planner.html', label: 'Plan an evaluation' } },
      'pytorch-intro': { learn: 'tensors', fallback: 'PyTorch introduction: tensors and automatic differentiation.' },
      'tensors': { learn: 'tensors' },
      'neural-networks': { learn: 'neural-networks' },
      'attention': { learn: 'attention' },
      'transformers': { learn: 'transformer-block', fallback: 'Transformer architecture: the transformer block, attention and variants.' },
      'tokenizers': { learn: 'tokenizers', tool: { href: '/pages/token-calc.html', label: 'Token budget calculator' } },
      'dataset-engineering': { learn: 'dataset-engineering', tool: { href: '/pages/data-planner.html', label: 'Data pipeline planner' } },
      'tiny-lm-project': { page: '/pages/projects.html', fallback: 'Hands-on project: train a character-level model from scratch.' },
      '10m-project': { page: '/pages/projects.html', fallback: 'Hands-on project: a 10M parameter transformer.' },
      '100m-project': { page: '/pages/projects.html', fallback: 'Hands-on project: scale up to a 100M language model.' },
      'fine-tuning': { learn: 'fine-tuning', tool: { href: '/pages/planner.html', label: 'Training planner' } },
      'lora': { learn: 'lora', tool: { href: '/pages/calculator.html', label: 'VRAM estimator' } },
      '1b-project': { page: '/pages/projects.html', fallback: 'Hands-on project: fine-tune a 1B model.' },
      'evaluation': { learn: 'evaluation', tool: { href: '/pages/eval-planner.html', label: 'Evaluation planner' } },
      'optimization': { learn: 'optimization', tool: { href: '/pages/calculator.html', label: 'VRAM estimator' } },
      'distributed-training': { learn: 'tensor-parallelism', tool: { href: '/pages/scaling.html', label: 'Scaling guide' } },
      'distributed-project': { page: '/pages/projects.html', fallback: 'Hands-on project: multi-GPU training.' },
      'inference': { learn: 'inference-basic', tool: { href: '/pages/inference-calc.html', label: 'Inference memory estimator' } }
    };
  },

  paceHoursPerWeek() {
    return { '1-2h': 1.5, '3-5h': 4, '5-10h': 7.5, '10+h': 12 };
  },

  parseHours(duration) {
    const m = String(duration || '').match(/([\d.]+)\s*h/);
    return m ? parseFloat(m[1]) : 0;
  },

  hardwareNote(hardware) {
    const notes = {
      cpu: 'CPU only: stick to small models and free cloud tiers until you have GPU access.',
      laptop: 'Laptop GPU: ideal for learning and QLoRA experiments on small models.',
      consumer: 'A 24GB consumer GPU handles 7B QLoRA fine-tuning; full pretraining needs more.',
      workstation: 'Workstation: room for larger fine-tuning runs and multi-GPU experiments.',
      multigpu: 'Multi-GPU: read the Scaling guide (FSDP / ZeRO) before planning large runs.',
      cloud: 'Cloud: compare on-demand vs spot pricing, and watch storage and egress costs.'
    };
    return notes[hardware] || '';
  },

  budgetNote(budget) {
    const notes = {
      free: 'Free budget: favor free tiers, existing hardware, and efficient methods like QLoRA.',
      low: 'Low budget: one cloud experiment at a time; prefer spot instances and small models.',
      moderate: 'Moderate budget: enough for serious consumer-GPU or short cloud runs.',
      high: 'High budget: workstation-class or extended cloud training is in reach.',
      enterprise: 'Research budget: plan production-grade runs with proper evaluation.'
    };
    return notes[budget] || '';
  },

  goalLabel(value) {
    const found = this.stepConfigs().goal.options.find((o) => o.value === value);
    return found ? found.label : value;
  },

  hardwareLabel(value) {
    const found = this.stepConfigs().hardware.options.find((o) => o.value === value);
    return found ? found.label : value;
  },

  generateRoadmap() {
    const roadmap = this.buildRoadmap();
    this.clearWizard();
    try {
      Progress.setRoadmap({ ...this.answers, roadmap, generatedAt: new Date().toISOString() });
    } catch { /* ignore */ }
    this.renderRoadmap(roadmap, this.answers);
  },

  buildRoadmap() {
    const { experience, goal, hardware, time, budget } = this.answers;
    const roadmap = [];

    if (experience === 'beginner' || experience === 'some-code') {
      roadmap.push(
        { id: 'linux-basics', title: 'Linux & Shell Basics', duration: '~4h' },
        { id: 'python-fundamentals', title: 'Python Fundamentals', duration: '~8h' },
        { id: 'git-basics', title: 'Git & Version Control', duration: '~2h' }
      );
    }

    if (experience === 'beginner' || experience === 'some-code' || experience === 'ml-beginner') {
      roadmap.push(
        { id: 'math-fundamentals', title: 'Math Foundations', duration: '~10h' },
        { id: 'numpy', title: 'NumPy & Arrays', duration: '~4h' },
        { id: 'ml-fundamentals', title: 'Machine Learning Basics', duration: '~8h' }
      );
    }

    roadmap.push(
      { id: 'pytorch-intro', title: 'PyTorch Introduction', duration: '~6h' },
      { id: 'tensors', title: 'Tensors & Autograd', duration: '~4h' },
      { id: 'neural-networks', title: 'Neural Networks', duration: '~6h' },
      { id: 'attention', title: 'Attention Mechanism', duration: '~4h' },
      { id: 'transformers', title: 'Transformer Architecture', duration: '~8h' }
    );

    if (goal === 'understand') {
      roadmap.push(
        { id: 'tokenizers', title: 'Tokenization', duration: '~4h' },
        { id: 'evaluation', title: 'Evaluation Methods', duration: '~4h' },
        { id: 'inference', title: 'Inference & Deployment', duration: '~4h' }
      );
      return roadmap;
    }

    if (['tiny-lm', 'small-llm', 'domain-model', 'distributed'].includes(goal)) {
      roadmap.push(
        { id: 'tokenizers', title: 'Tokenization', duration: '~4h' },
        { id: 'dataset-engineering', title: 'Dataset Engineering', duration: '~6h' },
        { id: 'tiny-lm-project', title: 'Project: Tiny LM', duration: '~12h' }
      );
    }

    if (['small-llm', 'domain-model', 'distributed'].includes(goal)) {
      roadmap.push(
        { id: '10m-project', title: 'Project: 10M Transformer', duration: '~16h' },
        { id: '100m-project', title: 'Project: 100M LM', duration: '~20h' }
      );
    }

    if (['finetune', 'domain-model', 'distributed'].includes(goal)) {
      roadmap.push(
        { id: 'fine-tuning', title: 'Fine-tuning Methods', duration: '~6h' },
        { id: 'lora', title: 'LoRA / QLoRA', duration: '~6h' },
        { id: '1b-project', title: 'Project: 1B Fine-tuning', duration: '~12h' }
      );
    }

    if (goal === 'distributed') {
      roadmap.push(
        { id: 'evaluation', title: 'Evaluation Methods', duration: '~4h' },
        { id: 'optimization', title: 'Training Optimization', duration: '~6h' },
        { id: 'distributed-training', title: 'Distributed Training', duration: '~10h' },
        { id: 'distributed-project', title: 'Project: Multi-GPU Training', duration: '~16h' }
      );
    }

    roadmap.push(
      { id: 'inference', title: 'Inference & Deployment', duration: '~4h' }
    );

    return roadmap;
  },

  // --- detailed result --------------------------------------------------------
  stepDetail(step) {
    const links = this.stepLinks()[step.id] || {};
    let learnHref = null;
    let learnLabel = 'Open in Learn';
    let blurb = '';
    const topic = links.learn && this.topicsById ? this.topicsById[links.learn] : null;
    if (topic) {
      learnHref = `/pages/learn.html#${topic.id}`;
      learnLabel = `Learn: ${topic.title}`;
      blurb = topic.summary || '';
    } else if (links.learn) {
      learnHref = `/pages/learn.html#${links.learn}`;
      blurb = links.fallback || '';
    } else if (links.page) {
      learnHref = links.page;
      learnLabel = links.page.includes('projects') ? 'Open Hands-on Projects' : 'Open guide';
      blurb = links.fallback || '';
    }
    return { learnHref, learnLabel, blurb, tool: links.tool || null };
  },

  estimateTotals(roadmap, time) {
    const totalHours = roadmap.reduce((sum, s) => sum + this.parseHours(s.duration), 0);
    const pace = this.paceHoursPerWeek()[time] || 4;
    const weeks = Math.max(1, Math.ceil(totalHours / pace));
    return { totalHours, weeks };
  },

  renderRoadmap(roadmap, answers = {}) {
    const el = document.getElementById('roadmap-result');
    if (!el) return;
    el.style.display = '';

    if (!roadmap || roadmap.length === 0) {
      el.innerHTML = `
        <div class="empty-state" role="status">
          <div class="empty-state-text"><strong>No roadmap steps.</strong><br>Answer the questions above and generate again.</div>
        </div>`;
      return;
    }

    const completed = (window.Progress && window.Progress.completedLessons) || [];
    const doneCount = roadmap.filter((s) => completed.includes(s.id)).length;
    const { totalHours, weeks } = this.estimateTotals(roadmap, answers.time);
    const hwNote = this.hardwareNote(answers.hardware);
    const bNote = this.budgetNote(answers.budget);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.innerHTML = `
      <div class="planner-card" role="status" aria-live="polite">
        <h2 class="planner-card-title" tabindex="-1" id="roadmap-result-heading">Your Personalized Roadmap</h2>
        <p class="text-sm text-muted">
          Goal: <strong>${this.escapeHtml(this.goalLabel(answers.goal))}</strong>
          · Hardware: <strong>${this.escapeHtml(this.hardwareLabel(answers.hardware))}</strong>
          · ${roadmap.length} steps · ≈${totalHours}h total · ~${weeks} week${weeks === 1 ? '' : 's'} at your pace (estimate)
          ${doneCount > 0 ? ` · <strong>${doneCount} completed</strong>` : ''}
        </p>
        <div class="progress-bar" role="progressbar" aria-valuenow="${doneCount}" aria-valuemin="0" aria-valuemax="${roadmap.length}" aria-label="Roadmap progress" style="margin: var(--space-4) 0;">
          <div class="progress-bar-fill" style="width: ${roadmap.length ? Math.round((doneCount / roadmap.length) * 100) : 0}%"></div>
        </div>
        <div class="roadmap-path">
          ${roadmap.map((step, i) => {
            const detail = this.stepDetail(step);
            const isDone = completed.includes(step.id);
            return `
            <div class="roadmap-step ${isDone ? 'completed' : ''} ${i === 0 && doneCount === 0 ? 'active' : ''}">
              <div class="roadmap-dot" aria-hidden="true">${isDone ? '✓' : i + 1}</div>
              <div class="roadmap-content">
                <div class="roadmap-title">${this.escapeHtml(step.title)}${isDone ? ' <span class="badge badge-success">done</span>' : ''}</div>
                <div class="roadmap-desc">Estimated: ${this.escapeHtml(step.duration)}</div>
                ${detail.blurb ? `<p class="text-sm text-muted" style="margin: var(--space-2) 0 0;">${this.escapeHtml(detail.blurb)}</p>` : ''}
                <div class="flex gap-3 mt-2" style="flex-wrap:wrap;">
                  ${detail.learnHref ? `<a class="btn btn-sm btn-secondary" href="${detail.learnHref}">${this.escapeHtml(detail.learnLabel)} →</a>` : ''}
                  ${detail.tool ? `<a class="btn btn-sm btn-ghost" href="${detail.tool.href}">${this.escapeHtml(detail.tool.label)} →</a>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${(hwNote || bNote) ? `
        <div class="callout callout-info mt-6">
          <div class="callout-title">Tailored to your setup</div>
          ${hwNote ? `<p style="margin:0 0 var(--space-2);font-size:var(--text-sm);">${this.escapeHtml(hwNote)} <a href="/pages/hardware.html">Check GPUs →</a></p>` : ''}
          ${bNote ? `<p style="margin:0;font-size:var(--text-sm);">${this.escapeHtml(bNote)}</p>` : ''}
        </div>` : ''}
        <div class="callout mt-4" style="background:var(--color-surface-2);border-color:var(--color-border-strong);">
          <div class="callout-title">Assumptions</div>
          <p style="margin:0;font-size:var(--text-sm);">Durations are rough study-time estimates, not guarantees. Weeks assume steady pace with no breaks. Projects take longer on limited hardware — start small, then scale.</p>
        </div>
        <div class="callout callout-info mt-4">
          <div class="callout-title">Next actions</div>
          <div class="flex gap-3" style="flex-wrap:wrap;">
            <a class="btn btn-sm btn-secondary" href="/pages/learn.html">Start learning →</a>
            <a class="btn btn-sm btn-secondary" href="/pages/projects.html">Browse projects →</a>
            <a class="btn btn-sm btn-secondary" href="/pages/planner.html">Plan a training run →</a>
          </div>
        </div>
      </div>
      <div class="flex gap-4 mt-4" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" data-action="save">Save Roadmap</button>
        <button type="button" class="btn btn-secondary" data-action="reset">Start Over</button>
        <button type="button" class="btn btn-ghost" data-action="modify">Modify answers</button>
      </div>
      <div id="roadmap-save-status" class="text-sm mt-2" role="status" aria-live="polite"></div>
    `;
    el.querySelector('[data-action="save"]')?.addEventListener('click', () => this.saveRoadmap());
    el.querySelector('[data-action="reset"]')?.addEventListener('click', () => this.resetWizard());
    el.querySelector('[data-action="modify"]')?.addEventListener('click', () => this.modifyWizard());
    document.getElementById('roadmap-result-heading')?.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  },

  renderSavedBanner() {
    let saved = null;
    try {
      saved = window.Progress?.currentRoadmap;
    } catch { /* ignore */ }
    if (!saved || !Array.isArray(saved.roadmap) || saved.roadmap.length === 0) return;
    const el = document.getElementById('roadmap-result');
    if (!el || el.hasChildNodes()) return;
    el.style.display = '';
    const when = saved.generatedAt ? new Date(saved.generatedAt).toLocaleDateString() : null;
    el.innerHTML = `
      <div class="callout callout-info" role="status">
        <div class="callout-title">Saved roadmap found${when ? ` (${this.escapeHtml(when)})` : ''}</div>
        <p style="margin:0 0 var(--space-3);font-size:var(--text-sm);">${saved.roadmap.length} steps${saved.goal ? ` · Goal: ${this.escapeHtml(this.goalLabel(saved.goal))}` : ''}. Continue with it or build a new one below.</p>
        <div class="flex gap-3" style="flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-primary" data-action="view-saved">View saved roadmap</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="dismiss-saved">Dismiss</button>
        </div>
      </div>`;
    el.querySelector('[data-action="view-saved"]')?.addEventListener('click', () => {
      this.answers = { ...(saved.answers || {}), goal: saved.goal, hardware: saved.hardware, time: saved.time, budget: saved.budget, experience: saved.experience };
      this.renderRoadmap(saved.roadmap, saved);
    });
    el.querySelector('[data-action="dismiss-saved"]')?.addEventListener('click', () => {
      el.style.display = 'none';
      el.innerHTML = '';
    });
  },

  saveRoadmap() {
    try {
      Progress.setRoadmap({ ...this.answers, roadmap: this.buildRoadmap(), saved: true });
    } catch { /* ignore */ }
    const status = document.getElementById('roadmap-save-status');
    if (status) status.textContent = 'Roadmap saved on this device.';
  },

  resetWizard() {
    this.currentStep = 0;
    this.answers = {};
    this.clearWizard();
    this.renderStepper();
    this.renderStep();
    const resultEl = document.getElementById('roadmap-result');
    if (resultEl) {
      resultEl.style.display = 'none';
      resultEl.innerHTML = '';
    }
    document.getElementById('wizard-container')?.scrollIntoView();
    this.focusHeading();
  },

  modifyWizard() {
    this.currentStep = 0;
    this.renderStepper();
    this.renderStep();
    const resultEl = document.getElementById('roadmap-result');
    if (resultEl) {
      resultEl.style.display = 'none';
      resultEl.innerHTML = '';
    }
    document.getElementById('wizard-container')?.scrollIntoView();
    this.focusHeading();
  },

  escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
};

window.Planner = Planner;
