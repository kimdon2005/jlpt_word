(() => {
  "use strict";

  const REVIEW_STORAGE_KEY = "jlpt-vocab-review-ids-v1";
  const PROGRESS_STORAGE_KEY = "jlpt-vocab-progress-v1";
  const SESSION_STORAGE_KEY = "jlpt-vocab-active-session-v1";

  const LEVEL_LABELS = {
    N5: "N5",
    N4: "N4",
    "추가": "N3",
  };

  const WORDS = (window.JLPT_WORDS || []).map((word) => ({
    ...word,
    deck: Number(word.deck),
    number: Number(word.number),
  }));
  const KANJI_RADICALS = window.JLPT_KANJI_RADICALS || {};

  const state = {
    view: "home",
    level: "N5",
    deck: 1,
    mode: "level",
    queue: [],
    index: 0,
    revealedReading: false,
    revealedMeaning: false,
    queueSessionId: "",
  };

  const $ = (selector) => document.querySelector(selector);

  const els = {
    totalWords: $("#totalWords"),
    savedWords: $("#savedWords"),
    completedWords: $("#completedWords"),
    homeView: $("#homeView"),
    levelCards: $("#levelCards"),
    reviewAllBtn: $("#reviewAllBtn"),
    reviewCount: $("#reviewCount"),
    stageView: $("#stageView"),
    stageTitle: $("#stageTitle"),
    stageMeta: $("#stageMeta"),
    stageGrid: $("#stageGrid"),
    backHomeBtn: $("#backHomeBtn"),
    listView: $("#listView"),
    listTitle: $("#listTitle"),
    listMeta: $("#listMeta"),
    wordList: $("#wordList"),
    backStageBtn: $("#backStageBtn"),
    startListDeckBtn: $("#startListDeckBtn"),
    studyView: $("#studyView"),
    studyHomeBtn: $("#studyHomeBtn"),
    studyStageBtn: $("#studyStageBtn"),
    completeView: $("#completeView"),
    completeMeta: $("#completeMeta"),
    completeTitle: $("#completeTitle"),
    completeMessage: $("#completeMessage"),
    repeatBtn: $("#repeatBtn"),
    nextDeckBtn: $("#nextDeckBtn"),
    stageSelectBtn: $("#stageSelectBtn"),
    homeBtn: $("#homeBtn"),
    cardView: $("#cardView"),
    cardMeta: $("#cardMeta"),
    savedBadge: $("#savedBadge"),
    progressFill: $("#progressFill"),
    progressText: $("#progressText"),
    japaneseWord: $("#japaneseWord"),
    readingBox: $("#readingBox"),
    readingValue: $("#readingValue"),
    meaningBox: $("#meaningBox"),
    meaningValue: $("#meaningValue"),
    extraInfo: $("#extraInfo"),
    kanjiNote: $("#kanjiNote"),
    radicalAnalysis: $("#radicalAnalysis"),
    exampleText: $("#exampleText"),
    exampleKo: $("#exampleKo"),
    showReadingBtn: $("#showReadingBtn"),
    showMeaningBtn: $("#showMeaningBtn"),
    saveStudyBtn: $("#saveStudyBtn"),
    knownBtn: $("#knownBtn"),
    prevBtn: $("#prevBtn"),
    resetBtn: $("#resetBtn"),
    nextBtn: $("#nextBtn"),
  };

  const reviewIds = new Set(loadJson(REVIEW_STORAGE_KEY, []));
  const progress = normalizeProgress(loadJson(PROGRESS_STORAGE_KEY, {}));
  let activeSession = normalizeSession(loadJson(SESSION_STORAGE_KEY, null));

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

  function normalizeProgress(value) {
    const completed = value && typeof value === "object" && value.completed ? value.completed : {};
    const inProgress = value && typeof value === "object" && value.inProgress ? value.inProgress : {};
    return { completed, inProgress };
  }

  function normalizeSession(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.queueIds)) return null;
    if (!["level", "review"].includes(value.mode)) return null;
    return {
      mode: value.mode,
      level: value.level || "N5",
      deck: Number(value.deck || 1),
      index: Number(value.index || 0),
      queueIds: value.queueIds,
      sessionId: value.sessionId || "",
    };
  }

  function persistReviewIds() {
    saveJson(REVIEW_STORAGE_KEY, [...reviewIds]);
  }

  function persistProgress() {
    saveJson(PROGRESS_STORAGE_KEY, progress);
  }

  function persistActiveSession() {
    if (activeSession) {
      saveJson(SESSION_STORAGE_KEY, activeSession);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  function levels() {
    return [...new Set(WORDS.map((word) => word.level))];
  }

  function levelLabel(level) {
    return LEVEL_LABELS[level] || level;
  }

  function levelWords(level = state.level) {
    return WORDS.filter((word) => word.level === level).sort((a, b) => a.number - b.number);
  }

  function deckWords(level = state.level, deck = state.deck) {
    return levelWords(level).filter((word) => word.deck === Number(deck));
  }

  function cumulativeWords(level = state.level, deck = state.deck) {
    return levelWords(level).filter((word) => word.deck <= Number(deck));
  }

  function reviewWords() {
    return WORDS.filter((word) => reviewIds.has(word.id)).sort((a, b) => {
      const levelCompare = levelLabel(a.level).localeCompare(levelLabel(b.level), "ko");
      return levelCompare || a.number - b.number;
    });
  }

  function deckNumbers(level = state.level) {
    return [...new Set(levelWords(level).map((word) => word.deck))].sort((a, b) => a - b);
  }

  function deckRange(level, deck) {
    const rows = deckWords(level, deck);
    if (!rows.length) return "";
    return `${rows[0].number}-${rows[rows.length - 1].number}`;
  }

  function completedSet(level) {
    return new Set((progress.completed[level] || []).map(Number));
  }

  function isCompleted(level, deck) {
    return completedSet(level).has(Number(deck));
  }

  function isInProgress(level, deck) {
    return Number(progress.inProgress[level]) === Number(deck) && !isCompleted(level, deck);
  }

  function markInProgress(level, deck) {
    progress.inProgress[level] = Number(deck);
    persistProgress();
  }

  function markCompleted(level, deck) {
    const completed = completedSet(level);
    deckNumbers(level)
      .filter((deckNumber) => deckNumber <= Number(deck))
      .forEach((deckNumber) => completed.add(deckNumber));
    progress.completed[level] = [...completed].sort((a, b) => a - b);
    if (Number(progress.inProgress[level]) === Number(deck)) {
      delete progress.inProgress[level];
    }
    persistProgress();
  }

  function completedCount() {
    return levels().reduce((sum, level) => sum + completedSet(level).size, 0);
  }

  function totalDeckCount() {
    return levels().reduce((sum, level) => sum + deckNumbers(level).length, 0);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function wordsFromIds(ids) {
    const map = new Map(WORDS.map((word) => [word.id, word]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  function sessionId(mode, level, deck) {
    return mode === "review" ? "review:all" : `level:${level}:${deck}`;
  }

  function currentWord() {
    return state.queue[state.index] || null;
  }

  function updateStats() {
    els.totalWords.textContent = WORDS.length.toString();
    els.savedWords.textContent = reviewIds.size.toString();
    els.completedWords.textContent = `${completedCount()}/${totalDeckCount()}`;
    els.reviewCount.textContent = `${reviewIds.size}개`;
  }

  function showView(name) {
    state.view = name;
    [els.homeView, els.stageView, els.listView, els.studyView].forEach((view) => view.classList.add("hidden"));
    if (name === "home") els.homeView.classList.remove("hidden");
    if (name === "stage") els.stageView.classList.remove("hidden");
    if (name === "list") els.listView.classList.remove("hidden");
    if (name === "study") els.studyView.classList.remove("hidden");
    updateStats();
  }

  function renderHome() {
    els.levelCards.replaceChildren();

    levels().forEach((level) => {
      const decks = deckNumbers(level);
      const done = completedSet(level).size;
      const inProgressDeck = progress.inProgress[level];
      const card = document.createElement("article");
      card.className = "level-card";

      appendText(card, "p", `${levelWords(level).length}개 · ${decks.length}단계`, "eyebrow");
      appendText(card, "h2", levelLabel(level));
      appendText(card, "p", inProgressDeck ? `${inProgressDeck}단계 회독중` : `${done}/${decks.length}단계 회독 완료`, "level-card-meta");

      const status = document.createElement("div");
      status.className = "mini-status-row";
      decks.forEach((deck) => {
        const badge = document.createElement("span");
        badge.className = `mini-status ${deckStatusClass(level, deck)}`;
        badge.textContent = `${deck}`;
        badge.title = `${levelLabel(level)} ${deck}단계 ${deckStatusLabel(level, deck)}`;
        status.append(badge);
      });
      card.append(status);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "단계 선택";
      button.addEventListener("click", () => openStage(level));
      card.append(button);
      els.levelCards.append(card);
    });

    showView("home");
  }

  function deckStatusLabel(level, deck) {
    if (isCompleted(level, deck)) return "회독 완료";
    if (isInProgress(level, deck)) return "회독중";
    return "대기";
  }

  function deckStatusClass(level, deck) {
    if (isCompleted(level, deck)) return "completed";
    if (isInProgress(level, deck)) return "running";
    return "pending";
  }

  function openStage(level) {
    state.level = level;
    state.deck = deckNumbers(level)[0] || 1;
    renderStage();
  }

  function renderStage() {
    const level = state.level;
    const decks = deckNumbers(level);
    const done = completedSet(level).size;

    els.stageTitle.textContent = `${levelLabel(level)} 회독 단계`;
    els.stageMeta.textContent = `${done}/${decks.length}단계 완료 · 선택한 단계까지 누적 회독`;
    els.stageGrid.replaceChildren();

    decks.forEach((deck) => {
      const singleDeckWords = deckWords(level, deck);
      const cumulative = cumulativeWords(level, deck);
      const item = document.createElement("article");
      item.className = `stage-card ${deckStatusClass(level, deck)}`;

      const top = document.createElement("div");
      top.className = "stage-card-top";
      appendText(top, "h3", `${deck}단계`);
      appendText(top, "span", deckStatusLabel(level, deck), "status-pill");
      item.append(top);

      appendText(item, "p", `${deckRange(level, deck)}번 · 이 단계 ${singleDeckWords.length}개`, "stage-subtext");
      appendText(item, "p", `회독 시작 시 1-${deck}단계 누적 ${cumulative.length}개가 섞여 나옵니다.`, "stage-detail");

      const actions = document.createElement("div");
      actions.className = "stage-actions";

      const startBtn = document.createElement("button");
      startBtn.type = "button";
      startBtn.textContent = isInProgress(level, deck) ? "회독 이어하기" : "누적 회독 시작";
      startBtn.addEventListener("click", () => startLevelStudy(level, deck, { resume: true }));

      const listBtn = document.createElement("button");
      listBtn.type = "button";
      listBtn.className = "secondary-action";
      listBtn.textContent = "단어장 보기";
      listBtn.addEventListener("click", () => openWordList(level, deck));

      actions.append(startBtn, listBtn);
      item.append(actions);
      els.stageGrid.append(item);
    });

    showView("stage");
  }

  function openWordList(level, deck) {
    state.level = level;
    state.deck = Number(deck);
    els.listTitle.textContent = `${levelLabel(level)} ${deck}단계 단어장`;
    els.listMeta.textContent = `${deckRange(level, deck)}번 · ${deckWords(level, deck).length}개`;
    els.wordList.replaceChildren();

    deckWords(level, deck).forEach((word) => {
      const row = document.createElement("article");
      row.className = "word-list-row";
      const title = document.createElement("div");
      appendText(title, "strong", word.japanese);
      appendText(title, "span", word.reading);
      row.append(title);
      appendText(row, "p", word.meaning);
      if (word.kanji_note) appendText(row, "small", word.kanji_note);
      els.wordList.append(row);
    });

    showView("list");
  }

  function startLevelStudy(level, deck, { resume = false } = {}) {
    const nextSessionId = sessionId("level", level, deck);
    const canResume =
      resume &&
      activeSession &&
      activeSession.sessionId === nextSessionId &&
      activeSession.queueIds.length > 0;

    const queue = canResume ? wordsFromIds(activeSession.queueIds) : shuffle(cumulativeWords(level, deck));
    state.level = level;
    state.deck = Number(deck);
    state.mode = "level";
    state.queue = queue;
    state.index = canResume ? Math.min(activeSession.index, Math.max(0, queue.length - 1)) : 0;
    state.queueSessionId = nextSessionId;
    resetRevealState();

    activeSession = {
      mode: "level",
      level,
      deck: Number(deck),
      index: state.index,
      queueIds: queue.map((word) => word.id),
      sessionId: nextSessionId,
    };
    markInProgress(level, deck);
    persistActiveSession();
    renderStudy();
  }

  function startReviewStudy() {
    const queue = shuffle(reviewWords());
    state.mode = "review";
    state.level = "review";
    state.deck = 0;
    state.queue = queue;
    state.index = 0;
    state.queueSessionId = sessionId("review");
    resetRevealState();

    activeSession = {
      mode: "review",
      level: "review",
      deck: 0,
      index: 0,
      queueIds: queue.map((word) => word.id),
      sessionId: state.queueSessionId,
    };
    persistActiveSession();
    renderStudy();
  }

  function renderStudy() {
    showView("study");

    if (!state.queue.length || state.index >= state.queue.length) {
      renderComplete();
      return;
    }

    renderCard();
  }

  function renderCard() {
    const word = currentWord();
    if (!word) {
      renderComplete();
      return;
    }

    els.completeView.classList.add("hidden");
    els.cardView.classList.remove("hidden");

    const count = state.queue.length;
    const position = state.index + 1;
    const pct = Math.round((position / count) * 100);
    const meta =
      state.mode === "review"
        ? `모르는 단어 회독 · ${position}/${count}`
        : `${levelLabel(state.level)} ${state.deck}단계 누적 · ${position}/${count}`;

    els.cardMeta.textContent = meta;
    els.savedBadge.classList.toggle("hidden", !reviewIds.has(word.id));
    els.progressFill.style.width = `${pct}%`;
    els.progressText.textContent = `${position} / ${count}`;
    els.japaneseWord.textContent = word.japanese;

    els.readingBox.classList.toggle("pending", !state.revealedReading);
    els.meaningBox.classList.toggle("pending", !state.revealedMeaning);
    els.readingValue.textContent = state.revealedReading ? word.reading : "일본어 버튼을 누르면 표시됩니다.";
    els.meaningValue.textContent = state.revealedMeaning ? word.meaning : "한국어 버튼을 누르면 표시됩니다.";

    els.extraInfo.classList.toggle("hidden", !state.revealedMeaning);
    els.kanjiNote.textContent = word.kanji_note ? `한자: ${word.kanji_note}` : "";
    renderRadicalAnalysis(word);
    els.exampleText.textContent = word.example ? `예문: ${word.example}` : "";
    els.exampleKo.textContent = word.example_ko ? `해석: ${word.example_ko}` : "";

    els.prevBtn.disabled = state.index === 0;
    els.nextBtn.textContent = state.index >= state.queue.length - 1 ? "완료" : "다음";
    updateActiveSessionIndex();
  }

  function renderComplete() {
    els.cardView.classList.add("hidden");
    els.completeView.classList.remove("hidden");

    if (state.mode === "level") {
      markCompleted(state.level, state.deck);
      updateStats();
      if (activeSession && activeSession.sessionId === state.queueSessionId) {
        activeSession = null;
        persistActiveSession();
      }
      els.completeMeta.textContent = `${levelLabel(state.level)} ${state.deck}단계`;
      els.completeTitle.textContent = "회독 완료";
      els.completeMessage.textContent = `${levelLabel(state.level)} ${state.deck}단계가 회독 완료로 표시되었습니다. 다음 단계는 이전 단계 단어까지 누적해 섞어서 회독합니다.`;
      els.nextDeckBtn.classList.toggle("hidden", !hasNextDeck());
      els.stageSelectBtn.classList.remove("hidden");
      els.repeatBtn.classList.remove("hidden");
      return;
    }

    if (activeSession && activeSession.sessionId === state.queueSessionId) {
      activeSession = null;
      persistActiveSession();
    }
    updateStats();
    els.completeMeta.textContent = "모르는 단어";
    els.completeTitle.textContent = state.queue.length ? "모르는 단어 회독 완료" : "모르는 단어가 없습니다.";
    els.completeMessage.textContent = state.queue.length
      ? `현재 저장된 모르는 단어는 ${reviewIds.size}개입니다.`
      : "회독 중 ‘공부하겠음’을 누른 단어가 여기에 모입니다.";
    els.nextDeckBtn.classList.add("hidden");
    els.stageSelectBtn.classList.add("hidden");
    els.repeatBtn.classList.toggle("hidden", reviewIds.size === 0);
  }

  function hasNextDeck() {
    return deckNumbers(state.level).some((deck) => deck > state.deck);
  }

  function moveToNextDeck() {
    const next = deckNumbers(state.level).find((deck) => deck > state.deck);
    if (!next) return;
    startLevelStudy(state.level, next);
  }

  function resetRevealState() {
    state.revealedReading = false;
    state.revealedMeaning = false;
  }

  function updateActiveSessionIndex() {
    if (!activeSession || activeSession.sessionId !== state.queueSessionId) return;
    activeSession.index = state.index;
    persistActiveSession();
  }

  function goNext() {
    if (!state.queue.length) return;
    state.index += 1;
    resetRevealState();
    renderStudy();
  }

  function goPrev() {
    if (!state.queue.length || state.index === 0) return;
    state.index -= 1;
    resetRevealState();
    renderStudy();
  }

  function saveForStudy() {
    const word = currentWord();
    if (!word) return;
    reviewIds.add(word.id);
    persistReviewIds();
    goNext();
  }

  function markKnown() {
    const word = currentWord();
    if (!word) return;
    if (reviewIds.has(word.id)) {
      reviewIds.delete(word.id);
      persistReviewIds();
    }
    goNext();
  }

  function revealReading() {
    if (!currentWord()) return;
    state.revealedReading = true;
    renderStudy();
  }

  function revealMeaning() {
    if (!currentWord()) return;
    state.revealedMeaning = true;
    renderStudy();
  }

  function resetCurrentQueue() {
    state.index = 0;
    resetRevealState();
    updateActiveSessionIndex();
    renderStudy();
  }

  function uniqueKanji(text = "") {
    const seen = new Set();
    return [...text].filter((char) => {
      if (!/\p{Script=Han}/u.test(char) || seen.has(char)) return false;
      seen.add(char);
      return true;
    });
  }

  function meaningSense(meaning = "") {
    return meaning.replace(/\s+[가-힣]$/u, "").trim();
  }

  function appendText(parent, tagName, text, className = "") {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function buildKanjiAnalysisText(entry) {
    const sense = meaningSense(entry.meaning);
    const strokeText =
      entry.totalStrokes && entry.additionalStrokes >= 0
        ? `총 ${entry.totalStrokes}획, 부수 ${entry.radicalStrokes}획 + 추가 ${entry.additionalStrokes}획. `
        : "";
    const componentFlow = (entry.components || [])
      .map((component) => `${component.component}의 ‘${component.hint}’`)
      .join(" / ");
    const meaningText = sense ? `이 한자는 ‘${sense}’ 뜻으로 기억합니다.` : "이 한자의 기본 의미를 기억합니다.";
    return `${strokeText}대표 부수 ${entry.radical}(${entry.radicalName})는 ‘${entry.radicalHint}’ 범위를 잡아 줍니다. 구성요소 의미는 ${componentFlow}입니다. 이 요소들을 함께 보면서 ${meaningText}`;
  }

  function buildWordBridge(word, entries) {
    const parts = entries
      .map((entry) => `${entry.kanji}(${meaningSense(entry.meaning) || entry.meaning || "뜻"})`)
      .join(" + ");

    if (!parts) return "";
    if (entries.length === 1) {
      return `${parts}가 핵심 의미입니다. 이 단어에서는 ‘${word.meaning}’의 뜻으로 쓰입니다.`;
    }
    return `${parts}처럼 각 한자의 의미를 이어 보면 이 단어는 ‘${word.meaning}’입니다.`;
  }

  function renderRadicalAnalysis(word) {
    els.radicalAnalysis.replaceChildren();

    const entries = uniqueKanji(word.japanese)
      .map((char) => KANJI_RADICALS[char])
      .filter(Boolean);

    if (!entries.length) {
      els.radicalAnalysis.classList.add("hidden");
      return;
    }

    els.radicalAnalysis.classList.remove("hidden");
    appendText(els.radicalAnalysis, "h3", "부수로 이해하기");
    appendText(els.radicalAnalysis, "p", buildWordBridge(word, entries), "radical-summary");

    const list = document.createElement("div");
    list.className = "radical-list";
    entries.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "radical-row";

      const title = document.createElement("div");
      title.className = "radical-title";
      appendText(title, "strong", entry.kanji);
      appendText(title, "span", entry.meaning || "뜻 정보 없음");
      item.append(title);

      const components = document.createElement("div");
      components.className = "component-list";
      (entry.components || []).forEach((component) => {
        const token = document.createElement("span");
        token.className = component.role === "대표 부수" ? "component-token radical-token" : "component-token";
        appendText(token, "b", component.component);
        appendText(token, "em", component.name);
        appendText(token, "small", component.hint);
        components.append(token);
      });
      item.append(components);

      appendText(item, "p", buildKanjiAnalysisText(entry));
      list.append(item);
    });

    els.radicalAnalysis.append(list);
  }

  els.reviewAllBtn.addEventListener("click", startReviewStudy);
  els.backHomeBtn.addEventListener("click", renderHome);
  els.backStageBtn.addEventListener("click", renderStage);
  els.startListDeckBtn.addEventListener("click", () => startLevelStudy(state.level, state.deck, { resume: true }));
  els.studyHomeBtn.addEventListener("click", renderHome);
  els.studyStageBtn.addEventListener("click", () => {
    if (state.mode === "level") renderStage();
    if (state.mode === "review") renderHome();
  });
  els.showReadingBtn.addEventListener("click", revealReading);
  els.showMeaningBtn.addEventListener("click", revealMeaning);
  els.saveStudyBtn.addEventListener("click", saveForStudy);
  els.knownBtn.addEventListener("click", markKnown);
  els.prevBtn.addEventListener("click", goPrev);
  els.nextBtn.addEventListener("click", goNext);
  els.resetBtn.addEventListener("click", resetCurrentQueue);
  els.repeatBtn.addEventListener("click", () => {
    if (state.mode === "review") startReviewStudy();
    if (state.mode === "level") startLevelStudy(state.level, state.deck);
  });
  els.nextDeckBtn.addEventListener("click", moveToNextDeck);
  els.stageSelectBtn.addEventListener("click", renderStage);
  els.homeBtn.addEventListener("click", renderHome);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement) return;
    if (state.view !== "study") return;

    const key = event.key.toLowerCase();
    if (key === "j") revealReading();
    if (key === "k") revealMeaning();
    if (key === "s") saveForStudy();
    if (event.key === "Enter") markKnown();
    if (event.key === "ArrowLeft") goPrev();
    if (event.key === "ArrowRight") goNext();
  });

  renderHome();
})();
