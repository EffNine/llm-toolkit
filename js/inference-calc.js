const InferenceCalculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('infer-calculate')?.addEventListener('click', () => this.calculate());
  },
  
  calculate() {
    const modelSize = parseFloat(document.getElementById('infer-model-size')?.value) || 7;
    const precision = document.getElementById('infer-precision')?.value || 'bf16';
    const context = parseInt(document.getElementById('infer-context')?.value) || 4096;
    const batch = parseInt(document.getElementById('infer-batch')?.value) || 1;
    const layers = parseInt(document.getElementById('infer-layers')?.value) || 32;
    const hidden = parseInt(document.getElementById('infer-hidden')?.value) || 4096;
    const heads = parseInt(document.getElementById('infer-heads')?.value) || 32;
    const kvHeads = parseInt(document.getElementById('infer-kv-heads')?.value) || 8;
    const quantBits = parseInt(document.getElementById('infer-quant')?.value) || 0;
    
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
