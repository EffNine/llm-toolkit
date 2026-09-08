const Hardware = {
  gpus: [],
  architectures: [],
  
  async init() {
    if (this._initialised) return;
    this._initialised = true;
    await this.loadGPUData();
    this.bindEvents();
    this.renderVendorFilter();
    this.renderArchFilter();
    this.filterGPUs();
    this.handleDeepLink();
  },
  
  async fetchJson(path) {
    try {
      const res = await fetch(path, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },

  async loadGPUData() {
    const tbody = document.getElementById('gpu-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--color-text-secondary);" role="status">Loading GPUs…</td></tr>`;
    this.gpus = await this.fetchJson('/data/gpus.json');
    this.architectures = await this.fetchJson('/data/gpu-architectures.json');
  },
  
  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    const vendorFilter = document.getElementById('gpu-vendor-filter');
    const archFilter = document.getElementById('gpu-arch-filter');
    const searchInput = document.getElementById('gpu-search');
    const tableBody = document.getElementById('gpu-table-body');
    
    if (vendorFilter) {
      vendorFilter.addEventListener('change', () => this.filterGPUs());
    }
    if (archFilter) {
      archFilter.addEventListener('change', () => this.filterGPUs());
    }
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterGPUs());
    }
  },
  
  renderVendorFilter() {
    const vendorFilter = document.getElementById('gpu-vendor-filter');
    if (!vendorFilter) return;
    
    const vendors = [...new Set(this.gpus.map(g => g.vendor))];
    vendorFilter.innerHTML = `<option value="">All Vendors</option>` +
      vendors.map(v => `<option value="${v}">${v}</option>`).join('');
  },
  
  renderArchFilter() {
    const archFilter = document.getElementById('gpu-arch-filter');
    if (!archFilter) return;
    
    const archs = [...new Set(this.gpus.map(g => g.architecture))];
    archFilter.innerHTML = `<option value="">All Architectures</option>` +
      archs.map(a => `<option value="${a}">${a}</option>`).join('');
  },
  
  filterGPUs() {
    const vendor = document.getElementById('gpu-vendor-filter')?.value || '';
    const arch = document.getElementById('gpu-arch-filter')?.value || '';
    const search = document.getElementById('gpu-search')?.value?.toLowerCase() || '';
    
    let filtered = this.gpus;
    if (vendor) filtered = filtered.filter(g => g.vendor === vendor);
    if (arch) filtered = filtered.filter(g => g.architecture === arch);
    if (search) filtered = filtered.filter(g => 
      g.name.toLowerCase().includes(search) ||
      (g.vendor || '').toLowerCase().includes(search) ||
      (g.architecture || '').toLowerCase().includes(search)
    );
    
    this.renderTable(filtered);
  },
  
  renderTable(gpus) {
    const tbody = document.getElementById('gpu-table-body');
    if (!tbody) return;
    
    if (gpus.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--color-text-tertiary);">No GPUs found matching your criteria</td></tr>`;
      return;
    }
    
    tbody.innerHTML = gpus.map(gpu => `
      <tr>
        <td><button type="button" class="linklike" data-gpu-id="${gpu.id}" style="font-weight:600;text-align:left;">${gpu.name}</button></td>
        <td>${gpu.vendor || '-'}</td>
        <td>${gpu.architecture || '-'}</td>
        <td class="text-mono">${gpu.vram ? gpu.vram + ' GB' : '-'}</td>
        <td class="text-mono">${gpu.memoryType || '-'}</td>
        <td class="text-mono">${gpu.computeCapability || gpu.isa || '-'}</td>
        <td>${this.renderPrecisionBadges(gpu)}</td>
        <td>${this.renderTrainingBadge(gpu)}</td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-gpu-id]').forEach((btn) => {
      btn.addEventListener('click', () => this.renderGPUProfile(btn.getAttribute('data-gpu-id')));
    });
  },
  
  renderPrecisionBadges(gpu) {
    const badges = [];
    if (gpu.bf16Support) badges.push('<span class="badge badge-success">BF16</span>');
    else if (gpu.fp16Support) badges.push('<span class="badge badge-warning">FP16</span>');
    if (gpu.fp8Support) badges.push('<span class="badge badge-info">FP8</span>');
    if (gpu.int8Support) badges.push('<span class="badge">INT8</span>');
    if (gpu.int4Support) badges.push('<span class="badge">INT4</span>');
    return badges.join(' ') || '<span class="text-muted text-xs">Verify specs</span>';
  },
  
  renderTrainingBadge(gpu) {
    if (!gpu.trainingSuitability) return '<span class="text-muted">-</span>';
    const map = {
      'recommended': 'badge-success',
      'possible': 'badge-warning',
      'experimental': 'badge-info',
      'not-recommended': 'badge-error'
    };
    const icon = {
      'recommended': '✓',
      'possible': '⚠',
      'experimental': '△',
      'not-recommended': '✗'
    };
    return `<span class="badge ${map[gpu.trainingSuitability] || ''}">${icon[gpu.trainingSuitability] || ''} ${gpu.trainingSuitability}</span>`;
  },
  
  renderGPUProfile(gpuId) {
    const gpu = this.gpus.find(g => g.id === gpuId || g.name === gpuId);
    if (!gpu) return;
    try {
      // Same-document deep link (not cross-page SPA navigation).
      window.history.replaceState(null, '', `#${gpu.id}`);
    } catch { /* ignore */ }
    
    const el = document.getElementById('gpu-profile');
    if (!el) return;
    
    el.innerHTML = `
      <div class="planner-card">
        <div class="planner-card-title">${gpu.name}</div>
        <div class="grid-2">
          <div>
            <div class="metric-label">Architecture</div>
            <div class="text-bold mt-1">${gpu.architecture || 'Unknown'}</div>
          </div>
          <div>
            <div class="metric-label">VRAM</div>
            <div class="metric-value mt-1">${gpu.vram || '?'}</div>
            <div class="metric-label">${gpu.memoryType || ''}</div>
          </div>
          <div>
            <div class="metric-label">Memory Bandwidth</div>
            <div class="text-bold mt-1">${gpu.memoryBandwidth || 'Verify spec'} GB/s</div>
          </div>
          <div>
            <div class="metric-label">Compute Capability</div>
            <div class="text-mono mt-1">${gpu.computeCapability || gpu.isa || 'Verify spec'}</div>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="grid-2">
          <div>
            <div class="metric-label">Supported Precisions</div>
            <div class="mt-2">
              ${gpu.bf16Support ? '<span class="badge badge-success">BF16</span> ' : ''}
              ${gpu.fp16Support ? '<span class="badge badge-warning">FP16</span> ' : ''}
              ${gpu.fp32Support !== false ? '<span class="badge">FP32</span> ' : ''}
              ${gpu.fp8Support ? '<span class="badge badge-info">FP8</span> ' : ''}
              ${gpu.int8Support ? '<span class="badge">INT8</span> ' : ''}
              ${gpu.int4Support ? '<span class="badge">INT4</span> ' : ''}
            </div>
          </div>
          <div>
            <div class="metric-label">Recommended Workloads</div>
            <div class="mt-2 text-sm">
              ${this.getRecommendations(gpu)}
            </div>
          </div>
        </div>
        
        ${gpu.notes ? `<div class="callout callout-info mt-4"><div class="callout-title">Notes</div>${gpu.notes}</div>` : ''}
        ${gpu.source ? `<div class="mt-2 text-xs text-tertiary">Source: <a href="${gpu.source}" target="_blank" rel="noopener">${gpu.source}</a> ${gpu.lastVerified ? '(verified ' + gpu.lastVerified + ')' : ''}</div>` : ''}
      </div>
    `;
  },
  
  getRecommendations(gpu) {
    const recs = [];
    if (gpu.trainingSuitability === 'recommended') recs.push('Full pretraining', 'Fine-tuning at scale');
    else if (gpu.trainingSuitability === 'possible') recs.push('Fine-tuning (LoRA/QLoRA)', 'Small model pretraining');
    else if (gpu.trainingSuitability === 'experimental') recs.push('Inference', 'Small fine-tuning');
    else recs.push('Inference only');

    return recs.join(', ');
  },

  handleDeepLink() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const id = decodeURIComponent(hash.slice(1));
      if (this.gpus.some((g) => g.id === id || g.name === id)) {
        this.renderGPUProfile(id);
      }
    }
  }
};

window.Hardware = Hardware;
