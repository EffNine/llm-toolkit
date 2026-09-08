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
  },
  
  calculate() {
    const params = parseFloat(document.getElementById('param-count')?.value) || 0;
    const method = document.getElementById('training-method')?.value || 'pretrain';
    const precision = document.getElementById('precision')?.value || 'bf16';
    const optimizer = document.getElementById('optimizer')?.value || 'adamw';
    const batchSize = parseInt(document.getElementById('batch-size')?.value) || 4;
    const seqLen = parseInt(document.getElementById('seq-length')?.value) || 2048;
    const gradAccum = parseInt(document.getElementById('grad-accum')?.value) || 1;
    const checkpointing = document.getElementById('checkpointing')?.checked || false;
    const lora = document.getElementById('lora')?.checked || false;
    const quantBits = parseInt(document.getElementById('quant-bits')?.value) || 0;
    const gpuCount = parseInt(document.getElementById('gpu-count')?.value) || 1;
    const gpuVram = parseFloat(document.getElementById('gpu-vram')?.value) || 0;
    
    const bytesPerParam = this.getBytesPerParam(precision, quantBits);
    const totalParams = params * 1e9;
    
    // Weight memory
    const weightMem = totalParams * bytesPerParam / 1e9;
    
    // Gradient memory (same precision as weights)
    const gradBytes = quantBits > 0 ? quantBits / 8 : bytesPerParam;
    const gradMem = lora ? weightMem * 0.1 : totalParams * gradBytes / 1e9;
    
    // Optimizer memory
    let optimizerMem = 0;
    if (!lora) {
      if (optimizer === 'adamw') optimizerMem = weightMem * 2;
      else if (optimizer === 'sgd') optimizerMem = weightMem;
      else optimizerMem = weightMem * 2;
    }
    
    // Activation memory (rough estimate)
    const effectiveBatch = batchSize * gradAccum;
    const layers = parseInt(document.getElementById('num-layers')?.value) || 24;
    const hidden = parseInt(document.getElementById('hidden-size')?.value) || 4096;
    let activationMem = (effectiveBatch * seqLen * hidden * layers * 2) / 1e9;
    if (checkpointing) activationMem *= 0.1;
    
    // Temporary memory
    const tempMem = 2;
    
    // Framework overhead
    const overhead = 2;
    
    const totalEstimate = weightMem + gradMem + optimizerMem + activationMem + tempMem + overhead;
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
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="planner-result">
          <div class="planner-card-title">Estimated Memory Breakdown</div>
          <div class="vram-breakdown">
            <div class="vram-row">
              <span class="vram-row-label">Model weights (${precision.toUpperCase()})</span>
              <span class="vram-row-value">${weightMem.toFixed(1)} GB</span>
            </div>
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
            <div class="callout-title">Note</div>
            This is a rough estimate. Actual memory usage depends on framework, cuDNN benchmarks, GPU architecture, and runtime conditions. Always verify with actual measurements.
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
    if (panel) panel.classList.toggle('open');
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

  copyResult() {
    const resultEl = document.getElementById('vram-result');
    if (resultEl && navigator.clipboard) {
      navigator.clipboard.writeText(resultEl.textContent);
    }
  },

  downloadJSON() {
    const resultEl = document.getElementById('vram-result');
    if (resultEl) {
      const blob = new Blob([resultEl.textContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vram-estimate.json'; a.click();
      URL.revokeObjectURL(url);
    }
  }
};

window.Calculator = Calculator;
