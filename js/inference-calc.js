const InferenceCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('infer-calculate')?.addEventListener('click', () => this.calculate());
    document.getElementById('infer-share')?.addEventListener('click', (e) => this.share(e.currentTarget));
    if (this.applyShare()) this.calculate();
  },

  // Shareable estimates: inputs round-trip through ?params so a result can
  // be pasted into an issue or chat and reproduce exactly.
  shareSpec() {
    return {
      nums: ['infer-model-size', 'infer-quant', 'infer-context', 'infer-batch', 'infer-layers', 'infer-hidden', 'infer-heads', 'infer-kv-heads', 'infer-gpu-vram'],
      selects: ['infer-precision', 'infer-kv-precision'],
      checks: []
    };
  },

  applyShare() {
    let found = false;
    try {
      const q = new URLSearchParams(window.location.search);
      const spec = this.shareSpec();
      spec.nums.forEach((id) => {
        if (q.has(id)) { const el = document.getElementById(id); if (el) { el.value = q.get(id); found = true; } }
      });
      spec.selects.forEach((id) => {
        if (q.has(id)) { const el = document.getElementById(id); if (el) { el.value = q.get(id); found = true; } }
      });
    } catch { /* location unavailable; ignore */ }
    return found;
  },

  shareURL() {
    const url = new URL(window.location.href);
    url.search = '';
    const spec = this.shareSpec();
    spec.nums.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.value !== '') url.searchParams.set(id, el.value.trim());
    });
    spec.selects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) url.searchParams.set(id, el.value);
    });
    return url.toString();
  },

  share(btn) {
    const link = this.shareURL();
    const done = () => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done).catch(() => done(btn));
    else done(btn);
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
    const kvPrecision = document.getElementById('infer-kv-precision')?.value || 'same';
    
    const bytesPerParam = quantBits > 0 ? quantBits / 8 : ({ fp32: 4, bf16: 2, fp16: 2, fp8: 1, int8: 1, int4: 0.5, fp4: 0.5 }[precision] ?? 2);
    // KV cache precision is an independent knob from weight precision: engines
    // commonly keep weights in BF16/INT4 while caching K/V in FP8/INT8.
    const kvBytes = kvPrecision === 'same' ? bytesPerParam
      : kvPrecision === 'fp32' ? 4
      : kvPrecision === 'fp8' || kvPrecision === 'int8' ? 1 : 2;
    const headDim = hidden / heads;
    
    // Weight memory
    const weightMem = modelSize * 1e9 * bytesPerParam / 1e9;
    
    // KV cache memory (per request) — uses the KV dtype, not the weight dtype.
    const kvCachePerReq = 2 * context * layers * kvHeads * headDim * kvBytes / 1e9;
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
            const kv = 2 * c * layers * kvHeads * headDim * kvBytes / 1e9;
            const total = weightMem + kv + overhead;
            const fit = document.getElementById('infer-gpu-vram') ? 
              (total <= parseFloat(document.getElementById('infer-gpu-vram').value) || !document.getElementById('infer-gpu-vram').value) : true;
            return `<div class="vram-row"><span class="vram-row-label">${c.toLocaleString()} tokens</span><span class="vram-row-value">${total.toFixed(1)} GB${fit ? '' : ' ✗'}</span></div>`;
          }).join('')}
        </div>
        
        <div class="callout callout-info mt-4">
          <div class="callout-title">Assumptions (read before trusting the number)</div>
          <p style="margin:0; font-size: var(--text-sm);">
            Theoretical estimate, not a guarantee of fit. Weight precision covers FP8/INT8/INT4/FP4 weight-only
            quantization (scales/metadata add ~10-30% over raw bits — the same caveat as the Quantization topic).
            FP4 is Blackwell-only: verify kernels and re-run quality evals. KV cache uses the selected KV precision,
            independently of the weight precision (8-bit KV is frequently near-free on quality — verify on your evals).
            Runtime overhead is a rough allowance (activations, CUDA context, engine bookkeeping), not a measurement.
            Excluded: fragmentation, continuous-batching dynamics, speculative-decoding buffers, and per-engine
            differences (vLLM PagedAttention vs TGI vs llama.cpp). Verify on the target engine and keep headroom.
            GQA savings are exact in the formula: fewer KV heads = proportionally smaller cache.
          </p>
        </div>
      </div>
    `;
  }
};

window.InferenceCalculator = InferenceCalculator;
