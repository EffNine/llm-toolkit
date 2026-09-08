const Calculator = {
  init() {
    if (this._bound) return;
    this._bound = true;
    this.bindEvents();
  },
  
  bindEvents() {
    const calcBtn = document.getElementById('vram-calculate');
    if (calcBtn) calcBtn.addEventListener('click', () => this.calculate());

    const showCalcBtn = document.getElementById('show-calculations');
    if (showCalcBtn) showCalcBtn.addEventListener('click', () => this.toggleCalculations());

    const resetBtn = document.getElementById('vram-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
  },

  reset() {
    document.querySelectorAll('#plan-form .form-input, .planner-card .form-input').forEach(() => {});
    const defaults = {
      'param-count': '1', 'num-layers': '24', 'hidden-size': '4096', 'batch-size': '4',
      'seq-length': '2048', 'grad-accum': '1', 'quant-bits': '0', 'gpu-count': '1', 'gpu-vram': '0'
    };
    Object.entries(defaults).forEach(([id, val]) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = val;
        input.removeAttribute('aria-invalid');
      }
    });
    const errEl = document.getElementById('vram-form-error');
    if (errEl) errEl.textContent = '';
    const resultEl = document.getElementById('vram-result');
    if (resultEl) resultEl.innerHTML = '';
    const exp = document.getElementById('vram-export-btns');
    if (exp) exp.style.display = 'none';
    this._lastResult = null;
  },
  
  calculate() {
    const errEl = document.getElementById('vram-form-error');
    if (errEl) errEl.textContent = '';
    const bad = [];
    const num = (id, { min, max, integer, label, allowZero }) => {
      const input = document.getElementById(id);
      const raw = input?.value?.trim() ?? '';
      const v = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
      let msg = '';
      if (raw === '') msg = `${label} is required.`;
      else if (!Number.isFinite(v)) msg = `${label} must be a number.`;
      else if (integer && !Number.isInteger(v)) msg = `${label} must be a whole number.`;
      else if (!allowZero && v <= 0 && min !== 0) msg = `${label} must be > 0.`;
      else if (min !== undefined && v < min) msg = `${label} must be ≥ ${min}.`;
      else if (max !== undefined && v > max) msg = `${label} must be ≤ ${max}.`;
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) bad.push({ id, msg });
      return v;
    };
    const params = num('param-count', { min: 0.001, max: 10000, label: 'Parameter count' });
    const batchSize = num('batch-size', { min: 1, max: 65536, integer: true, label: 'Batch size' });
    const seqLen = num('seq-length', { min: 64, max: 1048576, integer: true, label: 'Sequence length' });
    const gradAccum = num('grad-accum', { min: 1, max: 4096, integer: true, label: 'Gradient accumulation' });
    const quantBits = num('quant-bits', { min: 0, max: 8, integer: true, label: 'Quantization bits', allowZero: true });
    const gpuCount = num('gpu-count', { min: 1, max: 4096, integer: true, label: 'GPU count' });
    const gpuVram = num('gpu-vram', { min: 0, max: 512, label: 'GPU VRAM', allowZero: true });
    const layers = num('num-layers', { min: 1, max: 256, integer: true, label: 'Layers' });
    const hidden = num('hidden-size', { min: 64, max: 32768, integer: true, label: 'Hidden size' });
    if (bad.length > 0) {
      if (errEl) errEl.textContent = `Please fix ${bad.length} field${bad.length === 1 ? '' : 's'}: ${bad[0].msg} No calculation was performed.`;
      document.getElementById(bad[0].id)?.focus();
      document.getElementById('vram-result').innerHTML = '';
      const exp = document.getElementById('vram-export-btns');
      if (exp) exp.style.display = 'none';
      return;
    }
    const method = document.getElementById('training-method')?.value || 'pretrain';
    const precision = document.getElementById('precision')?.value || 'bf16';
    const optimizer = document.getElementById('optimizer')?.value || 'adamw';
    const checkpointing = document.getElementById('checkpointing')?.checked || false;
    const lora = document.getElementById('lora')?.checked || false;
    
    const bytesPerParam = this.getBytesPerParam(precision, quantBits);
    const totalParams = params * 1e9;
    const isLowPrecision = bytesPerParam < 4 && quantBits === 0;

    // Weight memory (stored precision; quantized base when quantBits > 0)
    const weightMem = totalParams * bytesPerParam / 1e9;

    // FP32 master copy: mixed-precision training (AMP) keeps an FP32 copy of the
    // trainable weights for the optimizer step. Full-FT in BF16/FP16 therefore
    // costs an extra 4 bytes/param. Pure-FP32 training needs no separate copy.
    // LoRA/QLoRA freeze the base model, so no master copy of base weights.
    const masterMem = (!lora && isLowPrecision) ? totalParams * 4 / 1e9 : 0;

    // Gradient memory. Full fine-tuning: gradients for every trainable param in
    // the working precision. LoRA: only adapter params get gradients — typically
    // ~1% of base params (depends on rank/target modules; assumption, see note).
    const gradBytes = quantBits > 0 ? quantBits / 8 : bytesPerParam;
    const gradMem = lora ? totalParams * gradBytes / 1e9 * 0.01 : totalParams * gradBytes / 1e9;

    // Optimizer memory (FP32 m+v buffers for Adam-family). SGD with momentum
    // keeps one FP32 buffer; plain SGD keeps none. LoRA optimizes adapters only.
    let optimizerMem = 0;
    if (!lora) {
      if (optimizer === 'adamw' || optimizer === 'adam') optimizerMem = totalParams * 8 / 1e9;
      else if (optimizer === 'sgd') optimizerMem = totalParams * 4 / 1e9;
      else optimizerMem = totalParams * 8 / 1e9;
    } else {
      optimizerMem = totalParams * 8 / 1e9 * 0.01; // adapters only (assumption)
    }

    // Activation memory (rough lower-bound estimate).
    // Real activation memory depends on tensors saved per layer, attention
    // implementation (FlashAttention saves far less), and checkpointing
    // granularity. This uses the MICRO-batch (batchSize only) as the scale
    // proxy: gradient-accumulation micro-steps run sequentially and reuse the
    // same activation buffers, so accumulation must NOT multiply activations.
    // The batch input is per-GPU micro-batch, so this is already the per-GPU
    // activation figure (each data-parallel rank holds only its own micro-batch).
    const actBytes = quantBits > 0 ? 2 : bytesPerParam; // activations stay in compute precision
    let activationMem = (batchSize * seqLen * hidden * layers * actBytes) / 1e9;
    if (checkpointing) activationMem *= 0.1;
    
    // Temporary memory
    const tempMem = 2;
    
    // Framework overhead
    const overhead = 2;
    
    const totalEstimate = weightMem + masterMem + gradMem + optimizerMem + activationMem + tempMem + overhead;
    // Naive per-GPU split (data-parallel replication). FSDP/ZeRO-3 shards
    // weights+grads+optimizer across GPUs (~total/N each), so treat per-GPU as
    // pessimistic unless you use sharding — see the Scaling guide.
    const perGpu = totalEstimate / gpuCount;
    const headroom = gpuVram > 0 ? ((gpuVram - perGpu) / gpuVram * 100) : null;
    
    let status = 'unknown';
    let statusText = 'Calculate to see status';
    let statusClass = 'badge';
    
    if (gpuVram > 0) {
      if (perGpu <= gpuVram * 0.8) {
        status = 'recommended'; statusText = '✓ Recommended'; statusClass = 'badge-success';
      } else if (perGpu <= gpuVram * 0.95) {
        status = 'possible'; statusText = '⚠ Possible with optimization'; statusClass = 'badge-warning';
      } else if (perGpu <= gpuVram) {
        status = 'experimental'; statusText = '△ Tight fit — may OOM'; statusClass = 'badge-warning';
      } else {
        status = 'not-recommended'; statusText = '✗ Exceeds available VRAM'; statusClass = 'badge-error';
      }
    }
    
    const resultEl = document.getElementById('vram-result');
    this._lastResult = {
      inputs: { paramsB: params, method, precision, optimizer, batchSize, seqLen, gradAccum, checkpointing, lora, quantBits, gpuCount, gpuVram, layers, hidden },
      estimateGB: { weights: +weightMem.toFixed(2), masterWeights: +masterMem.toFixed(2), gradients: +gradMem.toFixed(2), optimizer: +optimizerMem.toFixed(2), activations: +activationMem.toFixed(2), temporaryAndOverhead: +(tempMem + overhead).toFixed(2), total: +totalEstimate.toFixed(2), perGpu: +perGpu.toFixed(2) },
      status, headroomPct: headroom !== null ? +headroom.toFixed(1) : null,
      note: 'Theoretical estimate only — verify with nvidia-smi / torch.cuda.max_memory_allocated. Not a guarantee of fit.'
    };
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="planner-result">
          <div class="planner-card-title">Estimated Memory Breakdown</div>
          <div class="vram-breakdown">
            <div class="vram-row">
              <span class="vram-row-label">Model weights (${precision.toUpperCase()})</span>
              <span class="vram-row-value">${weightMem.toFixed(1)} GB</span>
            </div>
            ${masterMem > 0 ? `
            <div class="vram-row">
              <span class="vram-row-label">FP32 master weights (mixed precision)</span>
              <span class="vram-row-value">${masterMem.toFixed(1)} GB</span>
            </div>
            ` : ''}
            <div class="vram-row">
              <span class="vram-row-label">Gradients</span>
              <span class="vram-row-value">${gradMem.toFixed(1)} GB</span>
            </div>
            <div class="vram-row">
              <span class="vram-row-label">Optimizer states (${optimizer.toUpperCase()})</span>
              <span class="vram-row-value">${optimizerMem.toFixed(1)} GB</span>
            </div>
            <div class="vram-row">
              <span class="vram-row-label">Activations${checkpointing ? ' (checkpointed)' : ''}</span>
              <span class="vram-row-value">${activationMem.toFixed(1)} GB</span>
            </div>
            <div class="vram-row">
              <span class="vram-row-label">Temporary + framework</span>
              <span class="vram-row-value">${(tempMem + overhead).toFixed(1)} GB</span>
            </div>
            <div class="vram-row vram-row-total">
              <span class="vram-row-label"><strong>Total estimate</strong></span>
              <span class="vram-row-value"><strong>${totalEstimate.toFixed(1)} GB</strong></span>
            </div>
            ${gpuCount > 1 ? `
            <div class="vram-row">
              <span class="vram-row-label">Per GPU (${gpuCount}×)</span>
              <span class="vram-row-value">${perGpu.toFixed(1)} GB</span>
            </div>
            ` : ''}
            ${gpuVram > 0 ? `
            <div class="vram-row">
              <span class="vram-row-label">Your GPU VRAM</span>
              <span class="vram-row-value">${gpuVram} GB</span>
            </div>
            <div class="vram-row">
              <span class="vram-row-label">Headroom</span>
              <span class="vram-row-value">${headroom?.toFixed(1) ?? 'N/A'}%</span>
            </div>
            <div class="mt-4">
              <span class="badge ${statusClass}">${statusText}</span>
            </div>
            ` : ''}
          </div>
          <div class="callout callout-info mt-4">
            <div class="callout-title">Assumptions (read before trusting the number)</div>
            Theoretical estimate, not a guarantee of fit. Mixed-precision full training counts an FP32 master
            copy + FP32 Adam m/v (8 bytes/param); LoRA counts gradients/optimizer on ~1% of params (adapters —
            actual share depends on rank and target modules). Activations are a rough lower bound on the
            micro-batch (accumulation steps reuse buffers — they add steps, not memory): FlashAttention,
            sequence packing, and checkpointing granularity change them significantly. Excluded: CUDA context
            (~0.5–1 GB), NCCL buffers, data-loader workers, fragmentation (10–20% extra is common). Per-GPU assumes
            replication; FSDP/ZeRO-3 shards weights+grads+optimizer (~÷N). Verify with
            torch.cuda.max_memory_allocated() and keep ~20% headroom.
          </div>
        </div>
      `;
      const exportBtns = document.getElementById('vram-export-btns');
      if (exportBtns) exportBtns.style.display = 'flex';
    }
    
    // Show calculations panel
    const calcPanel = document.getElementById('calculations-panel');
    if (calcPanel) {
      calcPanel.classList.add('open');
    }
  },
  
  toggleCalculations() {
    const panel = document.getElementById('calculations-panel');
    const btn = document.getElementById('show-calculations');
    if (panel) {
      const willOpen = panel.style.display === 'none' || !panel.classList.contains('open');
      panel.style.display = '';
      panel.classList.toggle('open', willOpen);
      if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }
  },
  
  getBytesPerParam(precision, quantBits) {
    if (quantBits > 0) return quantBits / 8;
    switch (precision) {
      case 'fp32': return 4;
      case 'tf32': return 4;
      case 'fp16': return 2;
      case 'bf16': return 2;
      case 'fp8': return 1;
      default: return 2;
    }
  },

  copyResult(srcEl) {
    if (!this._lastResult) return;
    const text = JSON.stringify(this._lastResult, null, 2);
    const done = (btn) => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    };
    const btn = srcEl instanceof HTMLElement ? srcEl : document.activeElement;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => done(btn)).catch(() => done(btn));
    }
  },

  downloadJSON() {
    if (!this._lastResult) return;
    const blob = new Blob([JSON.stringify(this._lastResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vram-estimate.json'; a.click();
    URL.revokeObjectURL(url);
  }
};

window.Calculator = Calculator;
