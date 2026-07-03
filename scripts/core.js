(() => {
  "use strict";

  const STORAGE_KEYS = {
    review: "jlpt-vocab-review-ids-v1",
    progress: "jlpt-vocab-progress-v1",
    session: "jlpt-vocab-active-session-v1",
    studyCounts: "jlpt-vocab-study-counts-v1",
    layout: "jlpt-vocab-layout-version",
  };
  const LAYOUT_VERSION = "3";
  const LEVELS = [
    { key: "N5", label: "N5", slug: "N5" },
    { key: "N4", label: "N4", slug: "N4" },
    { key: "추가", label: "N3", slug: "N3" },
  ];
  const SPECIAL_LEVELS = [{ key: "동사", label: "동사", slug: "N3" }];
  const words = [...(window.JLPT_WORDS || []), ...(window.JLPT_VERBS || [])].map((word) => ({
    ...word,
    deck: Number(word.deck),
    number: Number(word.number),
  }));
  const wordMap = new Map(words.map((word) => [word.id, word]));

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const reviewIds = new Set(loadJson(STORAGE_KEYS.review, []));
  const progressValue = loadJson(STORAGE_KEYS.progress, {});
  const progress = {
    completed: progressValue?.completed || {},
    inProgress: progressValue?.inProgress || {},
  };
  const studyCounts = loadJson(STORAGE_KEYS.studyCounts, {});
  let activeSession = normalizeSession(loadJson(STORAGE_KEYS.session, null));

  function normalizeSession(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.queueIds)) return null;
    if (!["level", "review", "chapter"].includes(value.mode)) return null;
    return {
      mode: value.mode,
      level: value.level || "N5",
      deck: Number(value.deck || 0),
      index: Math.max(0, Number(value.index || 0)),
      queueIds: value.queueIds.filter((id) => wordMap.has(id)),
      sessionId: String(value.sessionId || ""),
    };
  }

  function persistReviewIds() {
    saveJson(STORAGE_KEYS.review, [...reviewIds]);
  }

  function persistProgress() {
    saveJson(STORAGE_KEYS.progress, progress);
  }

  function persistStudyCounts() {
    saveJson(STORAGE_KEYS.studyCounts, studyCounts);
  }

  function persistSession() {
    if (activeSession) saveJson(STORAGE_KEYS.session, activeSession);
    else localStorage.removeItem(STORAGE_KEYS.session);
  }

  function migrateLayout() {
    if (localStorage.getItem(STORAGE_KEYS.layout) === LAYOUT_VERSION) return;

    progress.completed = {};
    progress.inProgress = {};
    activeSession = null;

    persistProgress();
    persistSession();
    localStorage.setItem(STORAGE_KEYS.layout, LAYOUT_VERSION);
  }

  function initializeStudyCounts() {
    let changed = false;
    reviewIds.forEach((id) => {
      if (!Number.isFinite(Number(studyCounts[id]))) {
        studyCounts[id] = 1;
        changed = true;
      }
    });
    if (changed) persistStudyCounts();
  }

  function levelConfig(value) {
    return [...LEVELS, ...SPECIAL_LEVELS].find((level) => level.key === value || level.slug === value) || LEVELS[0];
  }

  function chapterWords(chapter) {
    return words
      .filter((word) => word.chapter === chapter)
      .sort((a, b) => a.number - b.number);
  }

  function levelWords(level) {
    const key = levelConfig(level).key;
    return words.filter((word) => word.level === key).sort((a, b) => a.number - b.number);
  }

  function deckWords(level, deck) {
    return levelWords(level).filter((word) => word.deck === Number(deck));
  }

  function deckNumbers(level) {
    return [...new Set(levelWords(level).map((word) => word.deck))].sort((a, b) => a - b);
  }

  function deckRange(level, deck) {
    const rows = deckWords(level, deck);
    if (!rows.length) return { start: 0, end: 0, count: 0 };
    return { start: rows[0].number, end: rows.at(-1).number, count: rows.length };
  }

  function reviewWindowStartDeck(deck) {
    return Math.floor((Number(deck) - 1) / 3) * 3 + 1;
  }

  function reviewWindowWords(level, deck) {
    const endDeck = Number(deck);
    const startDeck = reviewWindowStartDeck(endDeck);
    return levelWords(level).filter((word) => word.deck >= startDeck && word.deck <= endDeck);
  }

  function reviewWindow(level, deck) {
    const rows = reviewWindowWords(level, deck);
    if (!rows.length) return { start: 0, end: 0, count: 0, startDeck: 0, endDeck: 0 };
    return {
      start: rows[0].number,
      end: rows.at(-1).number,
      count: rows.length,
      startDeck: reviewWindowStartDeck(deck),
      endDeck: Number(deck),
    };
  }

  function completedSet(level) {
    const key = levelConfig(level).key;
    const valid = new Set(deckNumbers(key));
    return new Set((progress.completed[key] || []).map(Number).filter((deck) => valid.has(deck)));
  }

  function isCompleted(level, deck) {
    return completedSet(level).has(Number(deck));
  }

  function isInProgress(level, deck) {
    const key = levelConfig(level).key;
    return Number(progress.inProgress[key]) === Number(deck);
  }

  function markInProgress(level, deck) {
    const key = levelConfig(level).key;
    progress.inProgress[key] = Number(deck);
    persistProgress();
  }

  function markCompleted(level, deck) {
    const key = levelConfig(level).key;
    const completed = completedSet(key);
    const startDeck = reviewWindowStartDeck(deck);
    deckNumbers(key)
      .filter((value) => value >= startDeck && value <= Number(deck))
      .forEach((value) => completed.add(value));
    progress.completed[key] = [...completed].sort((a, b) => a - b);
    if (Number(progress.inProgress[key]) === Number(deck)) delete progress.inProgress[key];
    persistProgress();
  }

  function completedCount(level) {
    if (level) return completedSet(level).size;
    return LEVELS.reduce((sum, item) => sum + completedSet(item.key).size, 0);
  }

  function totalDeckCount() {
    return LEVELS.reduce((sum, item) => sum + deckNumbers(item.key).length, 0);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function wordsFromIds(ids) {
    return ids.map((id) => wordMap.get(id)).filter(Boolean);
  }

  function reviewWords() {
    return words.filter((word) => reviewIds.has(word.id)).sort((a, b) => {
      const levelDifference = levelConfig(a.level).label.localeCompare(levelConfig(b.level).label, "ko");
      return levelDifference || a.number - b.number;
    });
  }

  function addReviewWord(id) {
    reviewIds.add(id);
    persistReviewIds();
  }

  function removeReviewWord(id) {
    reviewIds.delete(id);
    persistReviewIds();
  }

  function studyCount(id) {
    return Math.max(0, Number(studyCounts[id] || 0));
  }

  function incrementStudyCount(id) {
    studyCounts[id] = studyCount(id) + 1;
    persistStudyCounts();
    return studyCounts[id];
  }

  function totalStudyCount(level) {
    const candidates = level ? levelWords(level) : words;
    return candidates.reduce((sum, word) => sum + studyCount(word.id), 0);
  }

  function testWeight(word) {
    return 1 + Math.min(studyCount(word.id), 20) * 2;
  }

  function weightedChoice(candidates, previousId = "") {
    const pool = candidates.length > 1 ? candidates.filter((word) => word.id !== previousId) : candidates;
    const totalWeight = pool.reduce((sum, word) => sum + testWeight(word), 0);
    let target = Math.random() * totalWeight;
    for (const word of pool) {
      target -= testWeight(word);
      if (target < 0) return word;
    }
    return pool.at(-1);
  }

  function createWeightedTest(level, count = 20) {
    const candidates = levelWords(level);
    const queue = [];
    while (queue.length < count && candidates.length) {
      queue.push(weightedChoice(candidates, queue.at(-1)?.id));
    }
    return queue;
  }

  function getActiveSession() {
    return activeSession ? { ...activeSession, queueIds: [...activeSession.queueIds] } : null;
  }

  function setActiveSession(value) {
    activeSession = normalizeSession(value);
    persistSession();
  }

  function clearActiveSession(sessionId = "") {
    if (sessionId && activeSession?.sessionId !== sessionId) return;
    activeSession = null;
    persistSession();
  }

  migrateLayout();
  initializeStudyCounts();

  window.JLPT = {
    LEVELS,
    KANJI_RADICALS: window.JLPT_KANJI_RADICALS || {},
    words,
    chapterWords,
    levelConfig,
    levelWords,
    deckWords,
    deckNumbers,
    deckRange,
    reviewWindow,
    reviewWindowWords,
    completedSet,
    completedCount,
    totalDeckCount,
    isCompleted,
    isInProgress,
    markInProgress,
    markCompleted,
    shuffle,
    wordsFromIds,
    reviewWords,
    reviewIds,
    addReviewWord,
    removeReviewWord,
    studyCount,
    incrementStudyCount,
    totalStudyCount,
    testWeight,
    createWeightedTest,
    getActiveSession,
    setActiveSession,
    clearActiveSession,
  };
})();
