const InferenceCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('infer-calculate')?.addEventListener('click', () => this.calculate());
  },
  
  readNum(id, { min, max, integer, label, allowZero }) {
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
  calculate() {
    const errEl = document.getElementById('infer-form-error');
    if (errEl) errEl.textContent = '';
    const get = (id, o) => {
      const r = this.readNum(id, o);
      if (r.error) {
        if (errEl) errEl.textContent = r.error + ' No calculation was performed.';
        document.getElementById('infer-result').innerHTML = '';
        document.getElementById(id)?.focus();
        throw new Error('validation');
      }
      return r.value;
    };
    let modelSize, context, batch, layers, hidden, heads, kvHeads, quantBits;
    try {
      modelSize = get('infer-model-size', { min: 0.01, max: 10000, label: 'Model size' });
      context = get('infer-context', { min: 64, max: 10000000, integer: true, label: 'Context length' });
      batch = get('infer-batch', { min: 1, max: 1024, integer: true, label: 'Batch size' });
      layers = get('infer-layers', { min: 1, max: 256, integer: true, label: 'Layers' });
      hidden = get('infer-hidden', { min: 64, max: 32768, integer: true, label: 'Hidden size' });
      heads = get('infer-heads', { min: 1, max: 256, integer: true, label: 'Attention heads' });
      kvHeads = get('infer-kv-heads', { min: 1, max: 256, integer: true, label: 'KV heads' });
      quantBits = get('infer-quant', { min: 0, max: 8, integer: true, label: 'Quantization bits' });
    } catch { return; }
    const precision = document.getElementById('infer-precision')?.value || 'bf16';
    
    const bytesPerParam = quantBits > 0 ? quantBits / 8 : (precision === 'fp32' ? 4 : 2);
    const headDim = hidden / heads;
    
    // Weight memory
    const weightMem = modelSize * 1e9 * bytesPerParam / 1e9;
    
    // KV cache memory (per request)
    const kvCachePerReq = 2 * context * layers * kvHeads * headDim * bytesPerParam / 1e9;
    const totalKvCache = kvCachePerReq * batch;
    
    // Runtime overhead (activations, temporary buffers)
    const overhead = Math.max(1, modelSize * 0.5);
    
    const totalMem = weightMem + totalKvCache + overhead;
    
    const el = document.getElementById('infer-result');
    if (!el) return;
    
    el.innerHTML = `
      <div class="planner-result">
        <div class="planner-card-title">INFERENCE MEMORY ESTIMATE</div>
        <div class="planner-result-grid">
          <div class="planner-result-item"><div class="metric-value">${weightMem.toFixed(1)}</div><div class="metric-label">Weights (GB)</div></div>
          <div class="planner-result-item"><div class="metric-value">${totalKvCache.toFixed(1)}</div><div class="metric-label">KV Cache (GB)</div></div>
          <div class="planner-result-item"><div class="metric-value">${overhead.toFixed(1)}</div><div class="metric-label">Overhead (GB)</div></div>
          <div class="planner-result-item"><div class="metric-value">${totalMem.toFixed(1)}</div><div class="metric-label">Total est. (GB)</div></div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section-title">KV CACHE BREAKDOWN</div>
        <div class="vram-breakdown mt-4">
          <div class="vram-row"><span class="vram-row-label">Per-request KV cache</span><span class="vram-row-value">${kvCachePerReq.toFixed(2)} GB</span></div>
          <div class="vram-row"><span class="vram-row-label">Batch ${batch} × per-request</span><span class="vram-row-value">${totalKvCache.toFixed(1)} GB</span></div>
          <div class="vram-row"><span class="vram-row-label">Context length</span><span class="vram-row-value">${context.toLocaleString()} tokens</span></div>
          <div class="vram-row"><span class="vram-row-label">Formula</span><span class="vram-row-value" style="font-size:var(--text-xs);">2 × seq × layers × kv_heads × head_dim × bytes</span></div>
        </div>
        
        <div class="section-title mt-4">CONTEXT LENGTH vs MEMORY TRADE-OFF</div>
        <div class="vram-breakdown mt-2">
          ${[1024, 2048, 4096, 8192, 16384, 32768].map(c => {
            const kv = 2 * c * layers * kvHeads * headDim * bytesPerParam / 1e9;
            const total = weightMem + kv + overhead;
            const fit = document.getElementById('infer-gpu-vram') ? 
              (total <= parseFloat(document.getElementById('infer-gpu-vram').value) || !document.getElementById('infer-gpu-vram').value) : true;
            return `<div class="vram-row"><span class="vram-row-label">${c.toLocaleString()} tokens</span><span class="vram-row-value">${total.toFixed(1)} GB${fit ? '' : ' ✗'}</span></div>`;
          }).join('')}
        </div>
        
        <div class="callout callout-info mt-4">
          <div class="callout-title">Note</div>
          <p style="margin:0; font-size: var(--text-sm);">
            This is a theoretical estimate. Actual memory usage depends on the inference engine 
            (vLLM, TGI, llama.cpp), continuous batching, PagedAttention, and quantization methods.
            KV cache is allocated per-request and grows with context length.
          </p>
        </div>
      </div>
    `;
  }
};

window.InferenceCalculator = InferenceCalculator;
