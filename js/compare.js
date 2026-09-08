const Compare = {
  _gpus: [],
  _models: [],
  _tab: 'gpus',
  _picks: { gpus: [], models: [] },

  async init() {
    try {
      const [g, m] = await Promise.all([
        fetch('/data/gpus.json', { headers: { Accept: 'application/json' } }),
        fetch('/data/models.json', { headers: { Accept: 'application/json' } })
      ]);
      this._gpus = g.ok ? await g.json() : [];
      this._models = m.ok ? await m.json() : [];
      if (!Array.isArray(this._gpus)) this._gpus = [];
      if (!Array.isArray(this._models)) this._models = [];
    } catch { this._gpus = []; this._models = []; }
    // Sensible defaults starters: the classic 7B-class dilemma.
    const gpuDef = ['nvidia-4090', 'nvidia-a100', 'nvidia-3090'].filter((id) => this._gpus.some((g) => g.id === id));
    this._picks.gpus = gpuDef.length >= 2 ? gpuDef.slice(0, 3) : this._gpus.slice(0, 3).map((g) => g.id);
    const modDef = ['llama3-8b', 'mistral-7b', 'qwen2.5-7b'].filter((id) => this._models.some((m) => m.id === id));
    this._picks.models = modDef.length >= 2 ? modDef.slice(0, 3) : this._models.slice(0, 3).map((m) => m.id);
    document.querySelectorAll('[data-ctab]').forEach((b) => b.addEventListener('click', () => {
      this._tab = b.getAttribute('data-ctab');
      document.querySelectorAll('[data-ctab]').forEach((x) => x.classList.toggle('btn-primary', x === b));
      document.querySelectorAll('[data-ctab]').forEach((x) => x.classList.toggle('btn-secondary', x !== b));
      this.render();
    }));
    this.render();
  },

  escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  toggle(kind, id) {
    const picks = this._picks[kind];
    const i = picks.indexOf(id);
    if (i >= 0) { if (picks.length > 1) picks.splice(i, 1); }
    else if (picks.length < 3) picks.push(id);
    this.render();
  },

  fmt(v, suffix) {
    if (v === null || v === undefined || v === '') return '<span class="text-tertiary">—</span>';
    return `${v}${suffix || ''}`;
  },

  // Weight footprint at BF16 + per-token KV at BF16: the two numbers that
  // decide every deployment conversation. Same formulas as the calculators.
  modelFootprint(m) {
    const w = m.parameters * 2;
    const hd = m.hiddenSize / m.numHeads;
    const kvTok = 2 * m.layers * m.numKVHeads * hd * 2 / 1e6;
    return { w: w.toFixed(1) + ' GB', kvTok: kvTok.toFixed(3) + ' MB/tok' };
  },

  render() {
    const pickEl = document.getElementById('compare-picks');
    const tableEl = document.getElementById('compare-table');
    const countEl = document.getElementById('compare-count');
    if (!pickEl || !tableEl) return;
    const isGpu = this._tab === 'gpus';
    const all = isGpu ? this._gpus : this._models;
    const picks = this._picks[isGpu ? 'gpus' : 'models'];
    if (countEl) countEl.textContent = isGpu
      ? 'Graphics cards, dense Tensor figures. Cross-architecture TFLOPS are not directly comparable — bandwidth and VRAM decide most LLM work.'
      : 'Dense decoder-only models. Weight footprint at BF16; KV cache per token at BF16.';
    pickEl.innerHTML = all.map((x) => {
      const on = picks.includes(x.id);
      const label = isGpu ? `${x.name} (${x.vram}GB)` : `${x.name} (${x.parameters}B)`;
      return `<button type="button" class="btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}" data-pick="${x.id}" aria-pressed="${on}">${this.escapeHtml(label)}</button>`;
    }).join('');
    pickEl.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => this.toggle(isGpu ? 'gpus' : 'models', b.getAttribute('data-pick'))));

    const cols = picks.map((id) => all.find((x) => x.id === id)).filter(Boolean);
    if (cols.length === 0) {
      tableEl.innerHTML = '<div class="empty-state" role="status"><div class="empty-state-text">Pick at least one to compare.</div></div>';
      return;
    }
    let rows;
    if (isGpu) {
      const cell = (fn) => cols.map((g) => `<td>${fn(g)}</td>`).join('');
      rows = [
        ['VRAM', cell((g) => this.fmt(g.vram, ' GB'))],
        ['Memory bandwidth', cell((g) => this.fmt(g.memoryBandwidth, ' GB/s'))],
        ['Architecture', cell((g) => this.escapeHtml(g.architecture || ''))],
        ['FP32 (CUDA-core)', cell((g) => this.fmt(g.fp32TFLOPS, ''))],
        ['FP16 / BF16 (dense tensor)', cell((g) => this.fmt(g.fp16TFLOPS ?? g.bf16TFLOPS, ''))],
        ['FP8 (dense tensor)', cell((g) => this.fmt(g.fp8TFLOPS, ''))],
        ['BF16 support', cell((g) => (g.bf16Support ? '✓' : '✗'))],
        ['FP8 support', cell((g) => (g.fp8Support ? '✓' : '✗'))],
        ['Training', cell((g) => this.escapeHtml(g.trainingSuitability || ''))],
        ['Inference', cell((g) => this.escapeHtml(g.inferenceSuitability || ''))]
      ];
    } else {
      const cell = (fn) => cols.map((m) => `<td>${fn(m)}</td>`).join('');
      rows = [
        ['Parameters', cell((m) => this.fmt(m.parameters, 'B') + (m.numExperts ? ` (MoE: ${m.numExperts}×${m.expertsPerToken}, ~${m.denseParameters ?? '?'}B active)` : ''))],
        ['Layers / hidden', cell((m) => `${m.layers} / ${m.hiddenSize}`)],
        ['Heads (attn / KV)', cell((m) => `${m.numHeads} / ${m.numKVHeads}`)],
        ['FFN hidden', cell((m) => (m.ffnHiddenSize || '').toLocaleString())],
        ['Vocab', cell((m) => (m.vocabSize || '').toLocaleString())],
        ['Context', cell((m) => (m.contextLength || '').toLocaleString())],
        ['BF16 weights', cell((m) => this.modelFootprint(m).w)],
        ['KV cache / token', cell((m) => this.modelFootprint(m).kvTok)],
        ['License', cell((m) => this.escapeHtml(m.license || ''))]
      ];
    }
    tableEl.innerHTML = `
      <div class="scroll-x"><table class="data-table mt-4">
        <thead><tr><th></th>${cols.map((c) => `<th>${this.escapeHtml(isGpu ? c.name : c.name)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(([k, tds]) => `<tr><td class="text-bold">${k}</td>${tds}</tr>`).join('')}</tbody>
      </table></div>
      <p class="text-xs text-tertiary mt-2">Figures come from the hardware and model databases. Full detail: <a href="/pages/hardware.html">Hardware</a> · <a href="/pages/models.html">Models</a> · <a href="/pages/inference-calc.html">Inference Memory calculator</a>.</p>`;
  }
};

window.Compare = Compare;
