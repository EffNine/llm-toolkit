const ModelCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('model-calculate')?.addEventListener('click', () => this.calculate());
    document.getElementById('model-estimate')?.addEventListener('click', () => this.estimateFromParams());
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
  formError(msg, badId) {
    const errEl = document.getElementById('model-form-error');
    if (errEl) errEl.textContent = msg || '';
    if (msg) {
      document.getElementById('model-result').innerHTML = '';
      if (badId) document.getElementById(badId)?.focus();
      return false;
    }
    return true;
  },
  calculate() {
    const checks = [
      ['mc-layers', { min: 1, max: 256, integer: true, label: 'Layers' }],
      ['mc-hidden', { min: 64, max: 32768, integer: true, label: 'Hidden size' }],
      ['mc-heads', { min: 1, max: 256, integer: true, label: 'Attention heads' }],
      ['mc-kv-heads', { min: 1, max: 256, integer: true, label: 'KV heads' }],
      ['mc-ffn-expand', { min: 0.5, max: 16, label: 'FFN expansion' }],
      ['mc-vocab', { min: 1000, max: 1000000, integer: true, label: 'Vocabulary size' }]
    ];
    const vals = {};
    for (const [id, opts] of checks) {
      const r = this.readNum(id, opts);
      if (r.error) { this.formError(r.error, id); return; }
      vals[id] = r.value;
    }
    this.formError('');
    const layers = vals['mc-layers'];
    const hidden = vals['mc-hidden'];
    const heads = vals['mc-heads'];
    const kvHeads = vals['mc-kv-heads'];
    const ffnExpand = vals['mc-ffn-expand'];
    const vocab = vals['mc-vocab'];
    const tiedEmbed = document.getElementById('mc-tied')?.checked || false;
    const rotary = document.getElementById('mc-rope')?.checked ?? true;
    
    const headDim = hidden / heads;
    const kvHeadDim = kvHeads * headDim;
    // NOTE: assumes heads * headDim == hidden (standard). Biases excluded (approximation).
    if (!Number.isInteger(headDim)) {
      this.formError(`Hidden size (${hidden}) must be divisible by attention heads (${heads}) — head dim would be ${headDim.toFixed(2)}, which no real architecture uses.`, 'mc-hidden');
      return;
    }

    // Embedding + output head. Tied weights count the matrix once, untied counts it twice.
    const embedParams = tiedEmbed ? vocab * hidden : 2 * vocab * hidden;

    // Per-layer attention with GQA: Q (hidden x hidden), K+V (hidden x kvHeads*headDim each), O (hidden x hidden).
    const qParams = hidden * hidden;
    const kvParamsEach = hidden * kvHeadDim;

    // Output projection: hidden × hidden
    const outParams = hidden * hidden;

    // FFN (SwiGLU-gated): gate + up + down = 3 x hidden x ffnHidden.
    // Non-gated FFNs (GPT-2 style) use 2 x hidden x ffnHidden instead.
    const ffnHidden = Math.round(ffnExpand * hidden);
    const ffnParams = 3 * hidden * ffnHidden;
    
    // Norm params: 2 RMSNorms per block (attention input + FFN input) plus the
    // final norm — 1 param per hidden element each (RMSNorm has weight only,
    // no bias). Negligible (<0.01%) but included so the parts sum to the total.
    const lnParams = (layers * 2 + 1) * hidden;
    
    const attnPerLayer = qParams + 2 * kvParamsEach + outParams;
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
            Attention per layer = hidden² (Q) + 2 × hidden × kvHeads × headDim (K,V) + hidden² (O)<br>
            FFN per layer = 3 × hidden × ffnHidden, with ffnHidden = expand × hidden (SwiGLU-gated; use 2× for non-gated FFN)<br>
            Embedding + head = vocab × hidden${tiedEmbed ? ' (tied: counted once)' : ' × 2 (untied input + output)'}; norms = (2 × layers + 1) × hidden (RMSNorm assumption)<br>
            Dense only — for MoE, multiply the FFN term by numExperts for total params (and by topK for active per token): e.g. Mixtral 8×7B ≈ 46.7B total / ~12.9B active
          </p>
          <p style="margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--color-text-tertiary);">Approximation: excludes biases; assumes heads × headDim == hidden (Gemma2-style models with 256-dim heads break this — expect ~5–8% error there). Actual parameter counts vary by architecture variant (GPT, Llama, Mistral, etc.).</p>
        </div>
      </div>
    `;
  },
  
  estimateFromParams() {
    const t = this.readNum('mc-target-params', { min: 0.01, max: 10000, label: 'Target parameters' });
    if (t.error) { this.formError(t.error, 'mc-target-params'); return; }
    const l = this.readNum('mc-est-layers', { min: 1, max: 256, integer: true, label: 'Layers' });
    if (l.error) { this.formError(l.error, 'mc-est-layers'); return; }
    const v = this.readNum('mc-est-vocab', { min: 1000, max: 1000000, integer: true, label: 'Vocabulary size' });
    if (v.error) { this.formError(v.error, 'mc-est-vocab'); return; }
    const f = this.readNum('mc-est-ffn', { min: 0.5, max: 16, label: 'FFN expansion' });
    if (f.error) { this.formError(f.error, 'mc-est-ffn'); return; }
    this.formError('');
    const targetParams = t.value;
    const layers = l.value;
    const vocab = v.value;
    const ffnExpand = f.value;
    const tiedEmbed = document.getElementById('mc-est-tied')?.checked || false;
    
    // Reverse-engineer hidden size from target params (assumes MHA, SwiGLU FFN, untied
    // embeddings unless tiedEmbed is set):
    // total ~= embedMult*vocab*hidden + layers*hidden^2*(4 + 3*ffnExpand) + 2*layers*hidden
    // where embedMult is 1 (tied) or 2 (untied), and 4 = Q+O (2) + K+V under MHA (2).
    const attnCoeff = 4 + 3 * ffnExpand;
    const a = layers * attnCoeff;
    const b = (tiedEmbed ? 1 : 2) * vocab + 2 * layers;
    const c = -(targetParams * 1e9);
    
    const hidden = Math.round((-b + Math.sqrt(b * b + 4 * a * targetParams * 1e9)) / (2 * a));
    // Modern decoder-only models use head dim 128 (LLaMA/Mistral/Qwen convention):
    // pick head count from hidden size instead of the previous circular rounding.
    const heads = Math.max(1, Math.min(128, Math.round(hidden / 128)));
    
    // Recalculate actual params with these rounded values (MHA assumption: kvHeads == heads)
    const headDimActual = hidden / heads;
    const embedP = tiedEmbed ? vocab * hidden : 2 * vocab * hidden;
    const attnP = layers * (2 * hidden * hidden + 2 * hidden * hidden);
    const ffnP = layers * 3 * hidden * (ffnExpand * hidden);
    const lnP = (layers * 2 + 1) * hidden;
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
            Hidden size estimated from target parameter count using standard decoder-only transformer formulas
            (MHA attention, SwiGLU FFN${tiedEmbed ? ', tied embeddings' : ', untied embeddings'}).
            Values are rounded for practicality. Actual architectures may differ (e.g., Llama uses GQA and different head counts).
          </p>
        </div>
      </div>
    `;
  }
};

window.ModelCalculator = ModelCalculator;
