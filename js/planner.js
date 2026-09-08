const Planner = {
  steps: ['experience', 'goal', 'hardware', 'time', 'budget'],
  currentStep: 0,
  answers: {},
  
  init() {
    this.renderStepper();
    this.renderStep();
  },
  
  renderStepper() {
    const el = document.getElementById('wizard-stepper');
    if (!el) return;
    
    el.innerHTML = this.steps.map((step, i) => `
      <div class="wizard-step ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}">
        <span class="wizard-step-num">${i < this.currentStep ? '✓' : i + 1}</span>
        <span>${step.charAt(0).toUpperCase() + step.slice(1)}</span>
      </div>
      ${i < this.steps.length - 1 ? `<div class="wizard-step-line ${i < this.currentStep ? 'completed' : ''}"></div>` : ''}
    `).join('');
  },
  
  renderStep() {
    const el = document.getElementById('wizard-step-content');
    if (!el) return;
    
    const step = this.steps[this.currentStep];
    const configs = {
      experience: {
        title: 'What is your experience level?',
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
        options: [
          { value: '1-2h', label: '1-2 hours/week', desc: 'Light engagement' },
          { value: '3-5h', label: '3-5 hours/week', desc: 'Moderate engagement' },
          { value: '5-10h', label: '5-10 hours/week', desc: 'Serious engagement' },
          { value: '10+h', label: '10+ hours/week', desc: 'Full-time learning' }
        ]
      },
      budget: {
        title: 'What is your budget?',
        options: [
          { value: 'free', label: 'Free / existing hardware', desc: 'No additional cost' },
          { value: 'low', label: 'Low ($0-100)', desc: 'Minimal spending allowed' },
          { value: 'moderate', label: 'Moderate ($100-500)', desc: 'Can invest in learning' },
          { value: 'high', label: 'High ($500-2000)', desc: 'Serious investment OK' },
          { value: 'enterprise', label: 'Research / enterprise', desc: 'Budget for production' }
        ]
      }
    };
    
    const config = configs[step];
    const selected = this.answers[step];
    
    el.innerHTML = `
      <h2 style="margin-bottom: var(--space-6);">${config.title}</h2>
      <div class="selection-grid" role="group" aria-label="${config.title}">
        ${config.options.map(opt => `
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
  
  select(step, value) {
    this.answers[step] = value;
    this.renderStep();
  },
  
  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.renderStepper();
      this.renderStep();
    }
  },
  
  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderStepper();
      this.renderStep();
    }
  },
  
  generateRoadmap() {
    const roadmap = this.buildRoadmap();
    Progress.setRoadmap({ ...this.answers, roadmap, generatedAt: new Date().toISOString() });
    this.renderRoadmap(roadmap);
  },
  
  buildRoadmap() {
    const { experience, goal, hardware, time, budget } = this.answers;
    const roadmap = [];
    
    // Always include fundamentals based on experience
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
    
    // Common finishers
    roadmap.push(
      { id: 'inference', title: 'Inference & Deployment', duration: '~4h' }
    );
    
    return roadmap;
  },
  
  renderRoadmap(roadmap) {
    const el = document.getElementById('roadmap-result');
    if (!el) return;
    el.style.display = '';

    const completed = Progress.completedLessons;

    el.innerHTML = `
      <div class="planner-card" role="status" aria-live="polite">
        <div class="planner-card-title">Your Personalized Roadmap</div>
        <div class="roadmap-path">
          ${roadmap.map((step, i) => `
            <div class="roadmap-step ${completed.includes(step.id) ? 'completed' : ''} ${i === 0 ? 'active' : ''}">
              <div class="roadmap-dot" aria-hidden="true">${completed.includes(step.id) ? '✓' : i + 1}</div>
              <div class="roadmap-content">
                <div class="roadmap-title">${step.title}</div>
                <div class="roadmap-desc">Estimated: ${step.duration}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="flex gap-4" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" data-action="save">Save Roadmap</button>
        <button type="button" class="btn btn-secondary" data-action="reset">Start Over</button>
        <button type="button" class="btn btn-ghost" data-action="modify">Modify</button>
      </div>
      <div id="roadmap-save-status" class="text-sm mt-2" role="status" aria-live="polite"></div>
    `;
    el.querySelector('[data-action="save"]')?.addEventListener('click', () => this.saveRoadmap());
    el.querySelector('[data-action="reset"]')?.addEventListener('click', () => this.resetWizard());
    el.querySelector('[data-action="modify"]')?.addEventListener('click', () => this.modifyWizard());
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  saveRoadmap() {
    Progress.setRoadmap({ ...this.answers, roadmap: this.buildRoadmap(), saved: true });
    const status = document.getElementById('roadmap-save-status');
    if (status) status.textContent = 'Roadmap saved on this device.';
  },
  
  resetWizard() {
    this.currentStep = 0;
    this.answers = {};
    const stepperEl = document.getElementById('wizard-stepper');
    const resultEl = document.getElementById('roadmap-result');
    if (stepperEl) stepperEl.remove();
    if (resultEl) resultEl.style.display = 'none';
    this.renderStep();
  },
  
  modifyWizard() {
    this.currentStep = 0;
    const stepperEl = document.getElementById('wizard-stepper');
    const resultEl = document.getElementById('roadmap-result');
    if (stepperEl) stepperEl.remove();
    if (resultEl) resultEl.style.display = 'none';
    this.renderStep();
  }
};

window.Planner = Planner;
