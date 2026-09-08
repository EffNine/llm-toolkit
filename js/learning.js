const Learning = {
  init() {
    this.loadTopics();
    this.renderLessonList();
    this.setupTopicView();
  },
  
  async loadTopics() {
    try {
      const mod = await import('../data/topics.json');
      window.TOPICS = mod.default || mod;
    } catch {
      window.TOPICS = [];
    }
    this.setupTopicView();
  },
  
  renderLessonList() {
    const container = document.getElementById('lesson-list');
    if (!container || !window.TOPICS) return;
    
    const completed = Progress.completedLessons;
    const progress = Progress.getProgress();
    
    const progressEl = document.getElementById('learning-progress');
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-muted">Your progress</span>
          <span class="text-sm text-mono">${progress.completed}/${progress.total} lessons</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
        </div>
      `;
    }
    
    container.innerHTML = window.TOPICS.map((topic, i) => {
      const isCompleted = completed.includes(topic.id);
      return `
        <div class="lesson-card ${isCompleted ? 'completed' : ''}" data-topic-id="${topic.id}" onclick="Learning.viewTopic('${topic.id}')">
          <span class="lesson-number">${String(i + 1).padStart(2, '0')}</span>
          <div class="lesson-title">${topic.title}</div>
          <span class="lesson-difficulty difficulty-badge difficulty-${topic.difficulty}">${topic.difficulty}</span>
          <span class="lesson-time">${topic.estimatedTime || '~'}</span>
          <div class="lesson-status">${isCompleted ? '✓' : ''}</div>
        </div>
      `;
    }).join('');
  },
  
  viewTopic(id) {
    const topic = window.TOPICS.find(t => t.id === id);
    if (!topic) return;
    
    const container = document.getElementById('topic-content');
    if (!container) return;
    
    Progress.completeLesson(id);
    this.renderLessonList();
    
    const prereqs = (topic.prerequisites || []).map(p => `<span class="prereq-tag">${p}</span>`).join('');
    const related = (topic.related || []).map(r => `<span class="prereq-tag">${r}</span>`).join('');
    
    container.innerHTML = `
      <div class="topic-header">
        <div class="breadcrumbs">
          <a href="/pages/learn.html">Learn</a>
          <span class="sep">/</span>
          <span>${topic.title}</span>
        </div>
        <h1>${topic.title}</h1>
        <div class="topic-meta">
          <span class="difficulty-badge difficulty-${topic.difficulty}">${topic.difficulty}</span>
          ${topic.estimatedTime ? `<span class="badge">${topic.estimatedTime}</span>` : ''}
          <span class="badge">${topic.category || 'topic'}</span>
        </div>
        ${prereqs ? `<div class="topic-prerequisites mt-4"><strong style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--color-text-tertiary);">Prerequisites:</strong>${prereqs}</div>` : ''}
      </div>
      
      <div class="expert-layers">
        <div class="expert-layer" data-layer="beginner">
          <div class="expert-layer-header" onclick="Learning.toggleLayer(this)">
            <span class="expert-layer-title">Beginner — What is it?</span>
            <span class="expandable-icon">+</span>
          </div>
          <div class="expert-layer-content">${this.getBeginnerContent(topic)}</div>
        </div>
        <div class="expert-layer" data-layer="intermediate">
          <div class="expert-layer-header" onclick="Learning.toggleLayer(this)">
            <span class="expert-layer-title">Intermediate — How does it work?</span>
            <span class="expandable-icon">+</span>
          </div>
          <div class="expert-layer-content">${this.getIntermediateContent(topic)}</div>
        </div>
        <div class="expert-layer hidden" data-layer="advanced">
          <div class="expert-layer-header" onclick="Learning.toggleLayer(this)">
            <span class="expert-layer-title">Advanced — Implementation</span>
            <span class="expandable-icon">+</span>
          </div>
          <div class="expert-layer-content">${this.getAdvancedContent(topic)}</div>
        </div>
        <div class="expert-layer hidden" data-layer="deepdive">
          <div class="expert-layer-header" onclick="Learning.toggleLayer(this)">
            <span class="expert-layer-title">Deep Dive — Details</span>
            <span class="expandable-icon">+</span>
          </div>
          <div class="expert-layer-content">${this.getDeepDiveContent(topic)}</div>
        </div>
      </div>
      
      ${related ? `
        <div class="mt-8">
          <div class="section-title">Related Concepts</div>
          <div class="knowledge-graph">
            ${related.split(',').map(r => `<div class="graph-card"><div class="graph-card-title">${r.trim()}</div><div class="graph-card-type">Related topic</div></div>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="topic-nav">
        <button class="topic-nav-btn prev" onclick="Learning.prevTopic('${id}')">
          <div class="topic-nav-prev-label">← Previous</div>
          <div class="topic-nav-title">${this.getPrevTitle(id)}</div>
        </button>
        <button class="topic-nav-btn next" onclick="Learning.nextTopic('${id}')">
          <div class="topic-nav-next-label">Next →</div>
          <div class="topic-nav-title">${this.getNextTitle(id)}</div>
        </button>
      </div>
    `;
  },
  
  toggleLayer(header) {
    const panel = header.closest('.expert-layer');
    const content = panel.querySelector('.expert-layer-content');
    const icon = header.querySelector('.expandable-icon');
    content.classList.toggle('hidden');
    if (icon) icon.textContent = content.classList.contains('hidden') ? '+' : '−';
  },
  
  getBeginnerContent(topic) {
    return topic.sections?.beginner || topic.explanation || `<p>${topic.title} is a fundamental concept in LLM engineering. It covers the basics that every practitioner should understand.</p>`;
  },
  
  getIntermediateContent(topic) {
    return topic.sections?.intermediate || `<p>At an intermediate level, ${topic.title} involves understanding the mechanics and practical considerations.</p>`;
  },
  
  getAdvancedContent(topic) {
    return topic.sections?.advanced || `<p>Advanced usage of ${topic.title} requires deep understanding of underlying systems.</p>`;
  },
  
  getDeepDiveContent(topic) {
    return topic.sections?.deepdive || `<p>For those who want to go deeper into ${topic.title}, the technical details and edge cases are important.</p>`;
  },
  
  getNextTopicIndex(id) {
    const idx = window.TOPICS.findIndex(t => t.id === id);
    return idx < window.TOPICS.length - 1 ? window.TOPICS[idx + 1] : null;
  },
  
  getPrevTopicIndex(id) {
    const idx = window.TOPICS.findIndex(t => t.id === id);
    return idx > 0 ? window.TOPICS[idx - 1] : null;
  },
  
  nextTopic(id) {
    const next = this.getNextTopicIndex(id);
    if (next) this.viewTopic(next.id);
  },
  
  prevTopic(id) {
    const prev = this.getPrevTopicIndex(id);
    if (prev) this.viewTopic(prev.id);
  },
  
  getPrevTitle(id) {
    const prev = this.getPrevTopicIndex(id);
    return prev ? prev.title : 'Start here';
  },
  
  getNextTitle(id) {
    const next = this.getNextTopicIndex(id);
    return next ? next.title : 'End of curriculum';
  },
  
  setupTopicView() {
    const hash = window.location.hash;
    if (hash && window.TOPICS) {
      const id = hash.slice(1);
      setTimeout(() => this.viewTopic(id), 50);
    }
  }
};

window.Learning = Learning;
