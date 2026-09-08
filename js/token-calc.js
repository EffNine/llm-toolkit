const TokenCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('token-calculate')?.addEventListener('click', () => this.calculate());
    document.getElementById('token-estimate')?.addEventListener('click', () => this.estimateBudget());
  },
  
  readNum(id, { min, max, integer, label }) {
    const input = document.getElementById(id);
    const raw = input?.value?.trim() ?? '';
    const v = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
    let msg = '';
    if (raw === '') msg = `${label} is required.`;
    else if (!Number.isFinite(v)) msg = `${label} must be a number.`;
    else if (integer && !Number.isInteger(v)) msg = `${label} must be a whole number.`;
    else if (min !== undefined && v < min) msg = `${label} must be ≥ ${min}.`;
    else if (max !== undefined && v > max) msg = `${label} must be ≤ ${max}.`;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return { value: v, error: msg };
  },
  fail(msg, badId) {
    const errEl = document.getElementById('token-form-error');
    if (errEl) errEl.textContent = msg || '';
    if (msg) {
      document.getElementById('token-result').innerHTML = '';
      if (badId) document.getElementById(badId)?.focus();
      return true;
    }
    return false;
  },
  calculate() {
    const get = (id, o) => {
      const r = this.readNum(id, o);
      if (r.error) { this.fail(r.error, id); throw new Error('validation'); }
      return r.value;
    };
    let records, avgTokens, epochs, seqLen, microBatch, gradAccum, gpuCount;
    try {
      records = get('tc-records', { min: 1, max: 1e15, integer: true, label: 'Dataset records' });
      avgTokens = get('tc-avg-tokens', { min: 1, max: 10000000, integer: true, label: 'Avg tokens per record' });
      epochs = get('tc-epochs', { min: 0.1, max: 1000, label: 'Epochs' });
      seqLen = get('tc-seq-len', { min: 64, max: 1048576, integer: true, label: 'Sequence length' });
      microBatch = get('tc-micro-batch', { min: 1, max: 65536, integer: true, label: 'Micro batch size' });
      gradAccum = get('tc-grad-accum', { min: 1, max: 4096, integer: true, label: 'Grad accumulation' });
      gpuCount = get('tc-gpu-count', { min: 1, max: 4096, integer: true, label: 'GPU count' });
    } catch { return; }
    this.fail('');
    
    const totalTokens = records * avgTokens * epochs;
    const tokensPerStep = microBatch * gradAccum * gpuCount * seqLen;
    const steps = Math.ceil(totalTokens / tokensPerStep);
    const effectiveBatch = microBatch * gradAccum * gpuCount;
    
    const el = document.getElementById('token-result');
    if (!el) return;
    
    el.innerHTML = `
      <div class="planner-result">
        <div class="planner-card-title">TOKEN BUDGET CALCULATION</div>
        <div class="planner-result-grid">
          <div class="planner-result-item"><div class="metric-value">${(totalTokens / 1e9).toFixed(1)}B</div><div class="metric-label">Total Tokens</div></div>
          <div class="planner-result-item"><div class="metric-value">${steps.toLocaleString()}</div><div class="metric-label">Training Steps</div></div>
          <div class="planner-result-item"><div class="metric-value">${effectiveBatch}</div><div class="metric-label">Eff. Batch Size</div></div>
          <div class="planner-result-item"><div class="metric-value">${records.toLocaleString()}</div><div class="metric-label">Examples</div></div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section-title">CALCULATION DETAILS</div>
        <div class="vram-breakdown mt-4">
          <div class="vram-row"><span class="vram-row-label">Records × Avg Tokens × Epochs</span><span class="vram-row-value">${records.toLocaleString()} × ${avgTokens.toLocaleString()} × ${epochs} = ${(totalTokens / 1e6).toFixed(0)}M tokens</span></div>
          <div class="vram-row"><span class="vram-row-label">Tokens per step</span><span class="vram-row-value">${microBatch} × ${gradAccum} × ${gpuCount} × ${seqLen} = ${tokensPerStep.toLocaleString()}</span></div>
          <div class="vram-row vram-row-total"><span class="vram-row-label"><strong>Steps</strong></span><span class="vram-row-value"><strong>${steps.toLocaleString()}</strong></span></div>
        </div>
        
        <div class="callout callout-info mt-4">
          <div class="callout-title">Note</div>
          <p style="margin:0; font-size: var(--text-sm);">
            This assumes all tokens fit within sequence length ${seqLen}. If avg token count exceeds seqLen, 
            you will need packing or truncation, which affects effective tokens per step.
          </p>
        </div>
      </div>
    `;
  },
  
  estimateBudget() {
    const r = this.readNum('tc-model-size', { min: 0.01, max: 10000, label: 'Model size' });
    if (r.error) { this.fail(r.error, 'tc-model-size'); return; }
    this.fail('');
    const modelSize = r.value;
    const heuristic = document.getElementById('tc-heuristic')?.value || 'standard';
    
    // Heuristics for token targets based on model size
    // Chinchilla (~20 tok/param) is the compute-optimal minimum for a fixed
    // training budget. Modern open models routinely overtrain past it
    // (100-300+ tok/param) because inference is far cheaper on a dense,
    // well-trained small model than on a larger undertrained one.
    const heuristics = {
      standard: { label: 'Standard (Chinchilla ~20x)', mult: 20 },
      dataLimited: { label: 'Data-limited (~10x)', mult: 10 },
      inferenceOptimal: { label: 'Inference-optimal overtraining (~100x)', mult: 100 },
      aggressive: { label: 'LLaMA-3-style overtraining (~300x)', mult: 300 }
    };
    
    const h = heuristics[heuristic] || heuristics.standard;
    const totalTokens = modelSize * h.mult * 1e9;
    
    const el = document.getElementById('token-result');
    if (!el) return;
    
    el.innerHTML = `
      <div class="planner-result">
        <div class="planner-card-title">RECOMMENDED TOKEN TARGET</div>
        <div class="planner-result-grid">
          <div class="planner-result-item"><div class="metric-value">${(totalTokens / 1e9).toFixed(0)}B</div><div class="metric-label">Recommended Tokens</div></div>
          <div class="planner-result-item"><div class="metric-value">${modelSize}B</div><div class="metric-label">Model Size</div></div>
          <div class="planner-result-item"><div class="metric-value">${h.label}</div><div class="metric-label">Heuristic</div></div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section-title">ALL HEURISTICS FOR ${modelSize}B MODEL</div>
        <div class="vram-breakdown mt-4">
          ${Object.entries(heuristics).map(([key, val]) => {
            const t = modelSize * val.mult * 1e9;
            return `<div class="vram-row"><span class="vram-row-label">${val.label}</span><span class="vram-row-value">${(t / 1e9).toFixed(0)}B tokens</span></div>`;
          }).join('')}
        </div>
        
        <div class="callout callout-warning mt-4">
          <div class="callout-title">Heuristics, Not Laws</div>
          <p style="margin:0; font-size: var(--text-sm);">
            These are rough guidelines based on Chinchilla-scaling laws and empirical observations. 
            The optimal token count depends on data quality, model architecture, and training objectives. 
            Well-curated data can achieve good results with fewer tokens. Conversely, training past Chinchilla 
            (100-300+ tokens/param) is standard when inference cost dominates: a small overtrained model 
            serves far cheaper than a larger undertrained one at equal quality.
          </p>
        </div>
      </div>
    `;
  }
};

window.TokenCalculator = TokenCalculator;
