const ModelCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('model-calculate')?.addEventListener('click', () => this.calculate());
    document.getElementById('model-estimate')?.addEventListener('click', () => this.estimateFromParams());
  },
  
  calculate() {
    const layers = parseInt(document.getElementById('mc-layers')?.value) || 24;
    const hidden = parseInt(document.getElementById('mc-hidden')?.value) || 4096;
    const heads = parseInt(document.getElementById('mc-heads')?.value) || 32;
    const kvHeads = parseInt(document.getElementById('mc-kv-heads')?.value) || 32;
    const ffnExpand = parseFloat(document.getElementById('mc-ffn-expand')?.value) || 3;
    const vocab = parseInt(document.getElementById('mc-vocab')?.value) || 32000;
    const tiedEmbed = document.getElementById('mc-tied')?.checked || false;
    const rotary = document.getElementById('mc-rope')?.checked ?? true;
    
    const headDim = hidden / heads;
    
    // Embedding: vocab × hidden (tied or separate)
    const embedParams = tiedEmbed ? hidden * hidden : vocab * hidden;
    
    // Per-layer parameters
    // Q, K, V projections: hidden × hidden each
    const qkvParams = 3 * hidden * hidden;
    
    // KV heads for GQA
    const kvScale = kvHeads / heads;
    const kvParams = Math.round(2 * hidden * hidden * kvScale);
    
    // Output projection: hidden × hidden
    const outParams = hidden * hidden;
    
    // FFN: hidden → ffnExpand×hidden → hidden (with SwiGLU: 2 × hidden × ffnExpand×hidden + ffnExpand×hidden × hidden)
    const ffnParams = 2 * hidden * (ffnExpand * hidden) + (ffnExpand * hidden) * hidden;
    
    // Layer norm params (2 per layer: weight + bias)
    const lnParams = layers * 2 * hidden;
    
    const attnPerLayer = qkvParams + kvParams + outParams;
    const totalAttn = layers * attnPerLayer;
    const totalFfn = layers * ffnParams;
    const totalParams = embedParams + totalAttn + totalFfn + lnParams;
    
    const totalGB = totalParams * 2 / 1e9;
    const totalTokens = (totalParams / 1e9).toFixed(2);
    
    const el = document.getElementById('model-result');
    if (!el) return;
    
    el.innerHTML = `
      <div class="planner-result">
        <div class="planner-card-title">ARCHITECTURE BREAKDOWN</div>
        <div class="planner-result-grid">
          <div class="planner-result-item"><div class="metric-value">${totalTokens}</div><div class="metric-label">Parameters (B)</div></div>
          <div class="planner-result-item"><div class="metric-value">${totalGB.toFixed(1)}</div><div class="metric-label">BF16 Size (GB)</div></div>
          <div class="planner-result-item"><div class="metric-value">${totalParams.toLocaleString()}</div><div class="metric-label">Total Params</div></div>
          <div class="planner-result-item"><div class="metric-value">${headDim}</div><div class="metric-label">Head Dim</div></div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section-title">PARAMETER DISTRIBUTION</div>
        <div class="vram-breakdown mt-4">
          <div class="vram-row"><span class="vram-row-label">Embedding${tiedEmbed ? ' (tied)' : ''}</span><span class="vram-row-value">${(embedParams / 1e6).toFixed(0)}M (${(embedParams / totalParams * 100).toFixed(1)}%)</span></div>
          <div class="vram-row"><span class="vram-row-label">Attention (${layers} layers)</span><span class="vram-row-value">${(totalAttn / 1e6).toFixed(0)}M (${(totalAttn / totalParams * 100).toFixed(1)}%)</span></div>
          <div class="vram-row"><span class="vram-row-label">FFN (SwiGLU, expand=${ffnExpand})</span><span class="vram-row-value">${(totalFfn / 1e6).toFixed(0)}M (${(totalFfn / totalParams * 100).toFixed(1)}%)</span></div>
          <div class="vram-row"><span class="vram-row-label">Layer Norm</span><span class="vram-row-value">${(lnParams / 1e6).toFixed(0)}M (${(lnParams / totalParams * 100).toFixed(1)}%)</span></div>
          <div class="vram-row vram-row-total"><span class="vram-row-label"><strong>Total</strong></span><span class="vram-row-value"><strong>${(totalParams / 1e6).toFixed(0)}M</strong></span></div>
        </div>
        
        <div class="callout callout-info mt-4">
          <div class="callout-title">Formulas Used</div>
          <p style="margin:0; font-size: var(--text-sm);">
            Attention per layer = 3×(hidden²) + 2×(hidden² × kvHeads/headsWith) + hidden²<br>
            FFN per layer = 3×(hidden × ffnExpand × hidden)<br>
            Embedding = vocab × hidden${tiedEmbed ? ' (shared with output)' : ''}
          </p>
          <p style="margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--color-text-tertiary);">This is an approximation. Actual parameter counts vary by architecture variant (GPT, Llama, Mistral, etc.).</p>
        </div>
      </div>
    `;
  },
  
  estimateFromParams() {
    const targetParams = parseFloat(document.getElementById('mc-target-params')?.value) || 1;
    const layers = parseInt(document.getElementById('mc-est-layers')?.value) || 24;
    const vocab = parseInt(document.getElementById('mc-est-vocab')?.value) || 32000;
    const ffnExpand = parseFloat(document.getElementById('mc-est-ffn')?.value) || 3;
    const tiedEmbed = document.getElementById('mc-est-tied')?.checked || false;
    
    // Reverse-engineer hidden size from target params
    // total ≈ vocab*hidden + layers*(8*hidden² + 6*ffnExpand*hidden²) + 2*layers*hidden
    // Simplified: total ≈ vocab*hidden + layers*hidden²*(8 + 6*ffnExpand)
    const attnCoeff = 8 + 6 * ffnExpand;
    const a = layers * attnCoeff;
    const b = tiedEmbed ? vocab : vocab;
    const c = -(targetParams * 1e9);
    
    const hidden = Math.round((-b + Math.sqrt(b * b + 4 * a * targetParams * 1e9)) / (2 * a));
    const headDim = Math.round(hidden / 8) * 8; // round to multiple of 8
    const heads = Math.max(8, Math.min(64, Math.round(hidden / headDim)));
    
    // Recalculate actual params with these rounded values
    const headDimActual = hidden / heads;
    const embedP = tiedEmbed ? hidden * hidden : vocab * hidden;
    const attnP = layers * (3 * hidden * hidden + 2 * hidden * hidden + hidden * hidden);
    const ffnP = layers * 3 * hidden * (ffnExpand * hidden);
    const lnP = layers * 2 * hidden;
    const totalP = embedP + attnP + ffnP + lnP;
    
    const el = document.getElementById('model-result');
    if (!el) return;
    
    el.innerHTML = `
      <div class="planner-result">
        <div class="planner-card-title">ESTIMATED ARCHITECTURE FOR ${targetParams}B PARAMS</div>
        <div class="planner-result-grid">
          <div class="planner-result-item"><div class="metric-value">${hidden}</div><div class="metric-label">Hidden Size</div></div>
          <div class="planner-result-item"><div class="metric-value">${heads}</div><div class="metric-label">Attention Heads</div></div>
          <div class="planner-result-item"><div class="metric-value">${Math.round(headDimActual)}</div><div class="metric-label">Head Dim</div></div>
          <div class="planner-result-item"><div class="metric-value">${(totalP / 1e9).toFixed(2)}</div><div class="metric-label">Actual Params (B)</div></div>
        </div>
        
        <div class="callout callout-info mt-4">
          <div class="callout-title">Notes</div>
          <p style="margin:0; font-size: var(--text-sm);">
            Hidden size estimated from target parameter count using standard decoder-only transformer formulas. 
            Values are rounded for practicality. Actual architectures may differ (e.g., Llama uses different head counts).
          </p>
        </div>
      </div>
    `;
  }
};

window.ModelCalculator = ModelCalculator;
