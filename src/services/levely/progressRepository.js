const { LevelyProgress } = require('./models');

class LevelyProgressRepository {
  async load() {
    throw new Error('load() not implemented');
  }

  async save() {
    throw new Error('save() not implemented');
  }
}

class InMemoryLevelyProgressRepository extends LevelyProgressRepository {
  constructor() {
    super();
    this.store = new Map();
  }

  async load(userId = 'default') {
    if (!this.store.has(userId)) {
      this.store.set(userId, LevelyProgress.empty());
    }
    return this.store.get(userId);
  }

  async save(userId = 'default', progress) {
    this.store.set(userId, progress);
  }
}

module.exports = {
  LevelyProgressRepository,
  InMemoryLevelyProgressRepository,
};
