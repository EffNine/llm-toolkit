const FitChecker = {
  _models: [],
  _gpus: [],
  _bound: false,

  WEIGHT_BYTES: { fp32: 4, bf16: 2, fp16: 2, fp8: 1, int8: 1, int4: 0.5, fp4: 0.5 },
  KV_BYTES: { fp32: 4, bf16: 2, fp16: 2, fp8: 1, int8: 1 },

  async init() {
    if (this._bound) return;
    this._bound = true;
    const list = document.getElementById('fit-result');
    if (list) list.innerHTML = '';
    try {
      const [m, g] = await Promise.all([
        fetch('/data/models.json', { headers: { Accept: 'application/json' } }),
        fetch('/data/gpus.json', { headers: { Accept: 'application/json' } })
      ]);
      this._models = m.ok ? await m.json() : [];
      this._gpus = g.ok ? await g.json() : [];
      if (!Array.isArray(this._models)) this._models = [];
      if (!Array.isArray(this._gpus)) this._gpus = [];
    } catch { this._models = []; this._gpus = []; }
    this.fillSelects();
    document.getElementById('fit-calculate')?.addEventListener('click', () => this.calculate());
    document.getElementById('fit-share')?.addEventListener('click', (e) => this.share(e.currentTarget));
    this.applyShare();
    if (this._models.length > 0) this.calculate();
  },

  // Shareable verdicts: the full configuration round-trips through ?params
  // so a fit check can be pasted into an issue or chat and reproduce exactly.
  shareSpec() {
    return {
      nums: ['fit-context', 'fit-batch', 'fit-gpu-count'],
      selects: ['fit-model', 'fit-gpu', 'fit-precision', 'fit-kv-precision'],
      checks: []
    };
  },

  applyShare() {
    try {
      const q = new URLSearchParams(window.location.search);
      const spec = this.shareSpec();
      spec.nums.forEach((id) => {
        if (q.has(id)) { const el = document.getElementById(id); if (el) el.value = q.get(id); }
      });
      spec.selects.forEach((id) => {
        if (!q.has(id)) return;
        const el = document.getElementById(id);
        if (el && [...el.options].some((o) => o.value === q.get(id))) el.value = q.get(id);
      });
    } catch { /* location unavailable; ignore */ }
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

  fillSelects() {
    const ms = document.getElementById('fit-model');
    const gs = document.getElementById('fit-gpu');
    if (ms) {
      ms.innerHTML = this._models.map((m) =>
        `<option value="${m.id}">${m.name} (${m.parameters}B)</option>`).join('');
      const def = this._models.some((m) => m.id === 'llama3-8b') ? 'llama3-8b' : this._models[0]?.id;
      if (def) ms.value = def;
    }
    if (gs) {
      const sorted = [...this._gpus].sort((a, b) => (a.vram || 0) - (b.vram || 0));
      gs.innerHTML = sorted.map((g) =>
        `<option value="${g.id}">${g.name} (${g.vram}GB)</option>`).join('');
      const def = sorted.some((g) => g.id === 'nvidia-4090') ? 'nvidia-4090' : sorted[0]?.id;
      if (def) gs.value = def;
    }
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
    const errEl = document.getElementById('fit-form-error');
    if (errEl) errEl.textContent = msg || '';
    if (msg) {
      document.getElementById('fit-result').innerHTML = '';
      if (badId) document.getElementById(badId)?.focus();
      return false;
    }
    return true;
  },

  // Shared accounting with the Inference Memory calculator: weights at the
  // selected weight precision, KV cache at the independent KV precision,
  // same runtime-overhead allowance. Verdict bands match the VRAM
  // calculator (≤80% recommended, ≤95% possible, ≤100% tight).
  compute(model, gpu, { context, batch, gpuCount, weightBytes, kvBytes }) {
    const headDim = model.hiddenSize / model.numHeads;
    // MoE loads ALL experts into VRAM even though only topK compute per token.
    const weightMem = model.parameters * 1e9 * weightBytes / 1e9;
    const kvPerReq = 2 * context * model.layers * model.numKVHeads * headDim * kvBytes / 1e9;
    const totalKv = kvPerReq * batch;
    const overhead = Math.max(1, model.parameters * 0.5);
    // Tensor-parallel estimate: weights and KV shard across ranks.
    const perGpu = (weightMem + totalKv) / gpuCount + overhead;
    return { headDim, weightMem, kvPerReq, totalKv, overhead, perGpu };
  },

  verdict(perGpu, vram) {
    if (!(vram > 0)) return { status: 'unknown', text: 'Select a GPU to get a verdict', cls: 'badge' };
    if (perGpu <= vram * 0.8) return { status: 'recommended', text: '✓ Fits comfortably', cls: 'badge-success' };
    if (perGpu <= vram * 0.95) return { status: 'possible', text: '⚠ Fits with optimization', cls: 'badge-warning' };
    if (perGpu <= vram) return { status: 'tight', text: '△ Tight fit — may OOM', cls: 'badge-warning' };
    return { status: 'no', text: '✗ Does not fit', cls: 'badge-error' };
  },

  applySuggestion(patch) {
    if (patch.precision) document.getElementById('fit-precision').value = patch.precision;
    if (patch.kv) document.getElementById('fit-kv-precision').value = patch.kv;
    if (patch.batch) document.getElementById('fit-batch').value = String(patch.batch);
    if (patch.context) document.getElementById('fit-context').value = String(patch.context);
    this.calculate();
  },

  calculate() {
    const err = (id, o) => {
      const r = this.readNum(id, o);
      if (r.error) { this.formError(r.error + ' No calculation was performed.', id); throw new Error('validation'); }
      return r.value;
    };
    let context, batch, gpuCount;
    try {
      context = err('fit-context', { min: 64, max: 10000000, integer: true, label: 'Context length' });
      batch = err('fit-batch', { min: 1, max: 1024, integer: true, label: 'Concurrent requests' });
      gpuCount = err('fit-gpu-count', { min: 1, max: 8, integer: true, label: 'GPU count' });
    } catch { return; }
    this.formError('');
    const model = this._models.find((m) => m.id === document.getElementById('fit-model')?.value) || this._models[0];
    const gpu = this._gpus.find((g) => g.id === document.getElementById('fit-gpu')?.value) || this._gpus[0];
    if (!model || !gpu) { this.formError('Model or GPU data failed to load. Check your connection and reload.', null); return; }
    const precision = document.getElementById('fit-precision')?.value || 'bf16';
    const kvSel = document.getElementById('fit-kv-precision')?.value || 'same';
    const weightBytes = this.WEIGHT_BYTES[precision] ?? 2;
    const kvBytes = kvSel === 'same' ? weightBytes : (this.KV_BYTES[kvSel] ?? 2);

    const r = this.compute(model, gpu, { context, batch, gpuCount, weightBytes, kvBytes });
    const v = this.verdict(r.perGpu, gpu.vram);
    const headroom = gpu.vram > 0 ? ((gpu.vram - r.perGpu) / gpu.vram * 100) : null;
    const ctxOver = context > (model.contextLength || 0);
    const isMoe = (model.numExperts || 0) > 1;

    // What-if suggestions: only the ones that actually move the needle.
    const sug = [];
    if (v.status === 'possible' || v.status === 'tight' || v.status === 'no') {
      if (weightBytes > 0.5) sug.push({ label: 'Try 4-bit weights', patch: { precision: 'int4' } });
      if (kvBytes > 1) sug.push({ label: 'Try 8-bit KV cache', patch: { kv: 'int8' } });
      if (batch > 1) sug.push({ label: `Halve concurrency to ${Math.max(1, Math.floor(batch / 2))}`, patch: { batch: Math.max(1, Math.floor(batch / 2)) } });
      if (context > 2048) sug.push({ label: `Cap context to ${Math.max(2048, Math.floor(context / 2)).toLocaleString()}`, patch: { context: Math.max(2048, Math.floor(context / 2)) } });
    }
    // Headroom upsell: max concurrency that stays in the recommended band.
    let maxBatchNote = '';
    if ((v.status === 'recommended' || v.status === 'possible') && r.kvPerReq > 0 && gpu.vram > 0) {
      const room = gpu.vram * 0.8 - r.weightMem / gpuCount - r.overhead;
      const maxB = Math.floor(room / (r.kvPerReq / gpuCount));
      if (maxB > batch) maxBatchNote = `Headroom for ~${maxB} concurrent requests in the recommended band.`;
    }

    const el = document.getElementById('fit-result');
    if (!el) return;
    el.innerHTML = `
      <div class="planner-result">
        <div class="planner-card-title">FIT CHECK: ${model.name.toUpperCase()} ON ${gpuCount}× ${gpu.name.toUpperCase()}</div>
        <div class="mt-2"><span class="badge ${v.cls}">${v.text}</span>
        ${gpu.vram > 0 ? `<span class="text-sm text-muted"> — ${r.perGpu.toFixed(1)} GB needed per GPU of ${gpu.vram} GB (${headroom?.toFixed(0) ?? '—'}% headroom)</span>` : ''}</div>
        ${ctxOver ? `<div class="callout callout-warning mt-4"><div class="callout-title">Beyond trained context</div><p style="margin:0; font-size: var(--text-sm);">Requested ${context.toLocaleString()} tokens exceeds the model's ${model.contextLength.toLocaleString()}-token context. Quality degrades out here without RoPE scaling or a long-context variant — the memory fits, the model may not behave.</p></div>` : ''}
        ${isMoe ? `<div class="callout callout-info mt-4"><div class="callout-title">MoE weights</div><p style="margin:0; font-size: var(--text-sm);">All ${model.numExperts} experts (${model.parameters}B params) must fit in VRAM even though only ~${model.denseParameters ?? '?'}B compute per token.</p></div>` : ''}

        <div class="divider"></div>
        <div class="section-title">MEMORY BREAKDOWN (PER GPU)</div>
        <div class="vram-breakdown mt-4">
          <div class="vram-row"><span class="vram-row-label">Weights (${precision.toUpperCase()}${gpuCount > 1 ? `, ÷${gpuCount} TP` : ''})</span><span class="vram-row-value">${(r.weightMem / gpuCount).toFixed(1)} GB</span></div>
          <div class="vram-row"><span class="vram-row-label">KV cache (${batch} × ${r.kvPerReq.toFixed(2)} GB${gpuCount > 1 ? `, ÷${gpuCount} TP` : ''})</span><span class="vram-row-value">${(r.totalKv / gpuCount).toFixed(1)} GB</span></div>
          <div class="vram-row"><span class="vram-row-label">Runtime overhead</span><span class="vram-row-value">${r.overhead.toFixed(1)} GB</span></div>
          <div class="vram-row vram-row-total"><span class="vram-row-label"><strong>Per GPU</strong></span><span class="vram-row-value"><strong>${r.perGpu.toFixed(1)} GB</strong></span></div>
        </div>
        ${maxBatchNote ? `<p class="text-sm text-muted mt-2">${maxBatchNote}</p>` : ''}

        ${sug.length > 0 ? `
        <div class="section-title mt-4">WHAT IF?</div>
        <div class="flex gap-3 mt-2" style="flex-wrap:wrap;">
          ${sug.map((s, i) => `<button type="button" class="btn btn-sm btn-secondary" data-sug="${i}">${s.label} →</button>`).join('')}
        </div>` : ''}

        <div class="callout callout-info mt-4">
          <div class="callout-title">Assumptions (read before trusting the verdict)</div>
          <p style="margin:0; font-size: var(--text-sm);">
            Same accounting as the Inference Memory calculator: 2 × seq × layers × KV-heads × head-dim × KV-bytes per request;
            runtime overhead is a rough allowance, not a measurement. Multi-GPU assumes tensor-parallel sharding of weights and KV cache.
            4-bit weights carry scale/metadata overhead (~10–30% over raw bits); FP4 is Blackwell-only. Quantized configs need quality evals, not just fit.
            Keep ~20% headroom: a green verdict is a budget, not a guarantee — verify with the serving engine.
          </p>
        </div>
      </div>
    `;
    el.querySelectorAll('[data-sug]').forEach((b) => b.addEventListener('click', () => {
      const s = sug[parseInt(b.getAttribute('data-sug'), 10)];
      if (s) this.applySuggestion(s.patch);
    }));
  }
};

window.FitChecker = FitChecker;
