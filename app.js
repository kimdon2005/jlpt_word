(() => {
  "use strict";

  const STORAGE_KEY = "jlpt-vocab-review-ids-v1";
  const WORDS = (window.JLPT_WORDS || []).map((word) => ({
    ...word,
    deck: Number(word.deck),
    number: Number(word.number),
  }));
  const KANJI_RADICALS = window.JLPT_KANJI_RADICALS || {};

  const state = {
    level: "N5",
    deck: 1,
    mode: "normal",
    queue: [],
    index: 0,
    revealedReading: false,
    revealedMeaning: false,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    totalWords: $("#totalWords"),
    savedWords: $("#savedWords"),
    levelBtns: $$(".level-btn"),
    deckSelect: $("#deckSelect"),
    normalModeBtn: $("#normalModeBtn"),
    reviewModeBtn: $("#reviewModeBtn"),
    completeView: $("#completeView"),
    completeMeta: $("#completeMeta"),
    completeTitle: $("#completeTitle"),
    completeMessage: $("#completeMessage"),
    repeatBtn: $("#repeatBtn"),
    nextDeckBtn: $("#nextDeckBtn"),
    reviewSavedBtn: $("#reviewSavedBtn"),
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

  const reviewIds = new Set(loadReviewIds());

  function loadReviewIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistReviewIds() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...reviewIds]));
  }

  function levelWords(level = state.level) {
    return WORDS.filter((word) => word.level === level).sort((a, b) => a.number - b.number);
  }

  function deckWords(level = state.level, deck = state.deck) {
    return levelWords(level).filter((word) => word.deck === Number(deck));
  }

  function reviewWords(level = state.level) {
    return levelWords(level).filter((word) => reviewIds.has(word.id));
  }

  function deckNumbers(level = state.level) {
    return [...new Set(levelWords(level).map((word) => word.deck))].sort((a, b) => a - b);
  }

  function deckLabel(level, deck) {
    const rows = deckWords(level, deck);
    if (!rows.length) return `${deck}장`;
    return `${deck}장 (${rows[0].number}-${rows[rows.length - 1].number})`;
  }

  function currentWord() {
    return state.queue[state.index] || null;
  }

  function updateStats() {
    els.totalWords.textContent = WORDS.length.toString();
    els.savedWords.textContent = reviewIds.size.toString();
  }

  function updateLevelTabs() {
    els.levelBtns.forEach((button) => {
      button.classList.toggle("active", button.dataset.level === state.level);
    });
  }

  function updateModeButtons() {
    els.normalModeBtn.classList.toggle("active", state.mode === "normal");
    els.reviewModeBtn.classList.toggle("active", state.mode === "review");
  }

  function populateDeckSelect() {
    const decks = deckNumbers();
    if (!decks.includes(state.deck)) {
      state.deck = decks[0] || 1;
    }

    els.deckSelect.replaceChildren();
    decks.forEach((deck) => {
      const option = document.createElement("option");
      option.value = String(deck);
      option.textContent = deckLabel(state.level, deck);
      option.selected = deck === state.deck;
      els.deckSelect.append(option);
    });
  }

  function resetRevealState() {
    state.revealedReading = false;
    state.revealedMeaning = false;
  }

  function buildQueue({ keepIndex = false } = {}) {
    state.queue = state.mode === "review" ? reviewWords() : deckWords();
    if (!keepIndex) {
      state.index = 0;
    }
    if (state.index >= state.queue.length) {
      state.index = Math.max(0, state.queue.length - 1);
    }
    resetRevealState();
    render();
  }

  function setLevel(level) {
    state.level = level;
    state.mode = "normal";
    state.deck = 1;
    updateLevelTabs();
    updateModeButtons();
    populateDeckSelect();
    buildQueue();
  }

  function setMode(mode) {
    state.mode = mode;
    updateModeButtons();
    buildQueue();
  }

  function setDeck(deck) {
    state.deck = Number(deck);
    state.mode = "normal";
    updateModeButtons();
    buildQueue();
  }

  function render() {
    updateStats();
    updateLevelTabs();
    updateModeButtons();

    if (!WORDS.length || !state.queue.length || state.index >= state.queue.length) {
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

    els.cardMeta.textContent =
      state.mode === "review"
        ? `${word.level} 저장 단어 · ${position}/${count}`
        : `${word.level} ${word.deck}장 · ${word.number}번`;
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
    els.nextBtn.disabled = state.index >= state.queue.length - 1;
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

  function renderComplete() {
    els.cardView.classList.add("hidden");
    els.completeView.classList.remove("hidden");

    const savedForLevel = reviewWords().length;
    const hasQueue = state.queue.length > 0;

    if (!WORDS.length) {
      els.completeMeta.textContent = "데이터 없음";
      els.completeTitle.textContent = "단어 데이터를 찾을 수 없습니다.";
      els.completeMessage.textContent = "data/jlpt_words_data.js 파일이 index.html과 함께 있는지 확인하세요.";
      els.repeatBtn.classList.add("hidden");
      els.nextDeckBtn.classList.add("hidden");
      els.reviewSavedBtn.classList.add("hidden");
      return;
    }

    if (state.mode === "review" && !hasQueue) {
      els.completeMeta.textContent = `${state.level} 저장 단어`;
      els.completeTitle.textContent = "공부할 단어가 없습니다.";
      els.completeMessage.textContent = "일반 회독에서 ‘공부하겠음’을 누른 단어가 여기에 모입니다.";
      els.repeatBtn.classList.add("hidden");
      els.nextDeckBtn.classList.add("hidden");
      els.reviewSavedBtn.classList.add("hidden");
      return;
    }

    if (state.mode === "normal" && !hasQueue) {
      els.completeMeta.textContent = `${state.level}`;
      els.completeTitle.textContent = "이 묶음에 단어가 없습니다.";
      els.completeMessage.textContent = "다른 급수나 20개 단위를 선택하세요.";
      els.repeatBtn.classList.add("hidden");
      els.nextDeckBtn.classList.add("hidden");
      els.reviewSavedBtn.classList.toggle("hidden", savedForLevel === 0);
      return;
    }

    els.completeMeta.textContent =
      state.mode === "review" ? `${state.level} 저장 단어 회독` : `${state.level} ${state.deck}장`;
    els.completeTitle.textContent = state.mode === "review" ? "저장 단어 회독 완료" : "이번 20개 회독 완료";
    els.completeMessage.textContent =
      state.mode === "review"
        ? `아직 저장된 ${state.level} 단어는 ${savedForLevel}개입니다. 알고 있는 단어는 회독 중 ‘알고있음’을 누르면 저장 목록에서 빠집니다.`
        : `‘공부하겠음’을 누른 ${state.level} 단어는 현재 ${savedForLevel}개입니다. 저장 단어만 모아서 다시 회독할 수 있습니다.`;

    els.repeatBtn.classList.remove("hidden");
    els.nextDeckBtn.classList.toggle("hidden", state.mode !== "normal" || !hasNextDeck());
    els.reviewSavedBtn.classList.toggle("hidden", savedForLevel === 0);
  }

  function hasNextDeck() {
    return deckNumbers().some((deck) => deck > state.deck);
  }

  function moveToNextDeck() {
    const next = deckNumbers().find((deck) => deck > state.deck);
    if (!next) return;
    state.deck = next;
    state.mode = "normal";
    populateDeckSelect();
    updateModeButtons();
    buildQueue();
  }

  function goNext() {
    if (!state.queue.length) return;
    state.index += 1;
    resetRevealState();
    render();
  }

  function goPrev() {
    if (!state.queue.length || state.index === 0) return;
    state.index -= 1;
    resetRevealState();
    render();
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
    render();
  }

  function revealMeaning() {
    if (!currentWord()) return;
    state.revealedMeaning = true;
    render();
  }

  function resetCurrentQueue() {
    state.index = 0;
    resetRevealState();
    render();
  }

  els.levelBtns.forEach((button) => {
    button.addEventListener("click", () => setLevel(button.dataset.level));
  });

  els.deckSelect.addEventListener("change", (event) => setDeck(event.target.value));
  els.normalModeBtn.addEventListener("click", () => setMode("normal"));
  els.reviewModeBtn.addEventListener("click", () => setMode("review"));
  els.showReadingBtn.addEventListener("click", revealReading);
  els.showMeaningBtn.addEventListener("click", revealMeaning);
  els.saveStudyBtn.addEventListener("click", saveForStudy);
  els.knownBtn.addEventListener("click", markKnown);
  els.prevBtn.addEventListener("click", goPrev);
  els.nextBtn.addEventListener("click", goNext);
  els.resetBtn.addEventListener("click", resetCurrentQueue);
  els.repeatBtn.addEventListener("click", () => buildQueue());
  els.nextDeckBtn.addEventListener("click", moveToNextDeck);
  els.reviewSavedBtn.addEventListener("click", () => setMode("review"));

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) return;

    const key = event.key.toLowerCase();
    if (key === "j") revealReading();
    if (key === "k") revealMeaning();
    if (key === "s") saveForStudy();
    if (event.key === "Enter") markKnown();
    if (event.key === "ArrowLeft") goPrev();
    if (event.key === "ArrowRight") goNext();
  });

  populateDeckSelect();
  buildQueue();
})();
