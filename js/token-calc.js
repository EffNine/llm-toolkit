const TokenCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('token-calculate')?.addEventListener('click', () => this.calculate());
    document.getElementById('token-estimate')?.addEventListener('click', () => this.estimateBudget());
  },
  
  calculate() {
    const records = parseInt(document.getElementById('tc-records')?.value) || 1000000;
    const avgTokens = parseInt(document.getElementById('tc-avg-tokens')?.value) || 500;
    const epochs = parseFloat(document.getElementById('tc-epochs')?.value) || 1;
    const seqLen = parseInt(document.getElementById('tc-seq-len')?.value) || 2048;
    const microBatch = parseInt(document.getElementById('tc-micro-batch')?.value) || 32;
    const gradAccum = parseInt(document.getElementById('tc-grad-accum')?.value) || 1;
    const gpuCount = parseInt(document.getElementById('tc-gpu-count')?.value) || 1;
    
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
    const modelSize = parseFloat(document.getElementById('tc-model-size')?.value) || 1;
    const heuristic = document.getElementById('tc-heuristic')?.value || 'standard';
    
    // Heuristics for token targets based on model size
    // These are well-known rough guidelines from the literature
    const heuristics = {
      standard: { label: 'Standard (Chinchilla-optimal)', mult: 20 },
      dataLimited: { label: 'Data-limited (below Chinchilla)', mult: 10 },
      computeLimited: { label: 'Compute-limited (above Chinchilla)', mult: 40 },
      aggressive: { label: 'Aggressive scaling', mult: 100 }
    };
    
    const h = heuristics[heuristic] || heuristics.standard;
    const tokenBillions = modelSize * h.mult / 1e9;
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
            Well-curated data can achieve good results with fewer tokens.
          </p>
        </div>
      </div>
    `;
  }
};

window.TokenCalculator = TokenCalculator;
