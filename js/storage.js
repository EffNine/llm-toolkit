const Storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(`llmtoolkit_${key}`);
      return item ? JSON.parse(item) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`llmtoolkit_${key}`, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(`llmtoolkit_${key}`); } catch {}
  }
};

const Progress = {
  completedLessons: Storage.get('completedLessons', []),
  bookmarks: Storage.get('bookmarks', []),
  currentRoadmap: Storage.get('currentRoadmap', null),
  preferences: Storage.get('preferences', { theme: 'light', lastPage: '/' }),

  completeLesson(id) {
    if (!id) return;
    if (!this.completedLessons.includes(id)) {
      this.completedLessons.push(id);
      Storage.set('completedLessons', this.completedLessons);
    }
  },
  uncompleteLesson(id) {
    if (!id) return;
    const idx = this.completedLessons.indexOf(id);
    if (idx >= 0) {
      this.completedLessons.splice(idx, 1);
      Storage.set('completedLessons', this.completedLessons);
    }
  },
  toggleLesson(id) {
    if (this.isCompleted(id)) this.uncompleteLesson(id);
    else this.completeLesson(id);
    return this.isCompleted(id);
  },
  isCompleted(id) {
    return Array.isArray(this.completedLessons) && this.completedLessons.includes(id);
  },
  toggleBookmark(page) {
    const idx = this.bookmarks.indexOf(page);
    if (idx >= 0) {
      this.bookmarks.splice(idx, 1);
    } else {
      this.bookmarks.push(page);
    }
    Storage.set('bookmarks', this.bookmarks);
  },
  isBookmarked(page) {
    return this.bookmarks.includes(page);
  },
  setRoadmap(roadmap) {
    this.currentRoadmap = roadmap;
    Storage.set('currentRoadmap', roadmap);
  },
  setPreference(key, value) {
    this.preferences[key] = value;
    Storage.set('preferences', this.preferences);
  },
  reset() {
    this.completedLessons = [];
    this.bookmarks = [];
    this.currentRoadmap = null;
    Storage.set('completedLessons', []);
    Storage.set('bookmarks', []);
    Storage.set('currentRoadmap', null);
  },
  getProgress() {
    const total = window.TOPICS?.length || 0;
    const completed = (this.completedLessons || []).filter((id) =>
      (window.TOPICS || []).some((t) => t.id === id)
    ).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }
};

window.Storage = Storage;
window.Progress = Progress;
