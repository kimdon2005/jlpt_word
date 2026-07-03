(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const grammar = [...(window.JLPT_GRAMMAR || [])].sort((a, b) => a.priority - b.priority);
  const grammarMap = new Map(grammar.map((item) => [item.id, item]));
  const STORAGE = {
    review: "jlpt-grammar-review-v1",
    counts: "jlpt-grammar-counts-v1",
    completed: "jlpt-grammar-completed-v1",
    session: "jlpt-grammar-session-v1",
  };
  const DECKS = [
    { deck: 1, title: "최우선 판별", description: "わけ·はず·추측·ところ처럼 같은 보기에 자주 섞이는 문형" },
    { deck: 2, title: "동사 결합", description: "ます형·て형·의지형 뒤에서 뜻을 바꾸는 동사 문형" },
    { deck: 3, title: "명사·조사 문형", description: "に·を·上을 축으로 대상, 범위, 수단을 고르는 문형" },
    { deck: 4, title: "시간·평가 함정", description: "직후, 반복, 원인, 역접의 미세한 차이를 묻는 문형" },
    { deck: 5, title: "단정·조건·강조", description: "확신의 강도, 양보 조건, 한정과 비교를 고르는 문형" },
    { deck: 6, title: "중급 보완 문형", description: "원본 자료의 나머지 중급 문형과 회화에서 자주 들리는 축약 표현" },
  ];

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const reviewIds = new Set(load(STORAGE.review, []).filter((id) => grammarMap.has(id)));
  const counts = load(STORAGE.counts, {});
  const completed = new Set(load(STORAGE.completed, []).map(Number).filter((deck) => DECKS.some((item) => item.deck === deck)));
  let session = normalizeSession(load(STORAGE.session, null));
  let activeListDeck = 1;
  let currentMode = "deck";
  let state = { queue: [], index: 0, label: "문법 회독", revealed: false, completed: false };

  function normalizeSession(value) {
    if (!value || !Array.isArray(value.queueIds)) return null;
    const queueIds = value.queueIds.filter((id) => grammarMap.has(id));
    if (!queueIds.length) return null;
    return {
      mode: value.mode || "deck",
      deck: Number(value.deck || 0),
      label: String(value.label || "문법 회독"),
      index: Math.min(Math.max(0, Number(value.index || 0)), queueIds.length - 1),
      queueIds,
    };
  }

  function persistSession() {
    if (session) save(STORAGE.session, session);
    else localStorage.removeItem(STORAGE.session);
  }

  function deckItems(deck) {
    return grammar.filter((item) => item.deck === Number(deck));
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  function appendText(parent, tagName, text, className = "") {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function showView(name) {
    $("#deckView").classList.toggle("hidden", name !== "deck");
    $("#grammarListView").classList.toggle("hidden", name !== "list");
    $("#grammarStudyView").classList.toggle("hidden", name !== "study");
  }

  function updateStats() {
    $("#grammarCount").textContent = grammar.length;
    $("#grammarDeckCount").textContent = DECKS.length;
    $("#grammarCompletedCount").textContent = completed.size;
    $("#grammarReviewCount").textContent = reviewIds.size;
    $("#reviewGrammarBtn").disabled = reviewIds.size === 0;
  }

  function statusClass(deck) {
    if (completed.has(deck)) return "completed";
    if (session?.mode === "deck" && session.deck === deck) return "running";
    return "pending";
  }

  function statusLabel(deck) {
    if (completed.has(deck)) return "회독 완료";
    if (session?.mode === "deck" && session.deck === deck) return "회독중";
    return "대기";
  }

  function renderDecks() {
    const grid = $("#grammarDeckGrid");
    grid.replaceChildren();
    DECKS.forEach((meta) => {
      const items = deckItems(meta.deck);
      const card = document.createElement("article");
      card.className = `stage-card grammar-deck-card ${statusClass(meta.deck)}`;
      const top = document.createElement("div");
      top.className = "stage-card-top";
      appendText(top, "h3", `${meta.deck}장 · ${meta.title}`);
      appendText(top, "span", statusLabel(meta.deck), "status-pill");
      card.append(top);
      appendText(card, "p", `${items[0].priority}-${items.at(-1).priority}번 · ${items.length}개`, "stage-subtext");
      appendText(card, "p", meta.description, "stage-detail");
      const families = [...new Set(items.map((item) => item.family))].slice(0, 4);
      const tags = document.createElement("div");
      tags.className = "grammar-tags";
      families.forEach((family) => appendText(tags, "span", family));
      card.append(tags);
      const actions = document.createElement("div");
      actions.className = "stage-actions";
      const start = appendText(actions, "button", session?.mode === "deck" && session.deck === meta.deck ? "회독 이어하기" : "회독 시작");
      start.type = "button";
      start.addEventListener("click", () => startDeck(meta.deck, true));
      const list = appendText(actions, "button", "문형 목록", "secondary-action");
      list.type = "button";
      list.addEventListener("click", () => openList(meta.deck));
      card.append(actions);
      grid.append(card);
    });
    updateStats();
    showView("deck");
  }

  function openList(deck) {
    activeListDeck = Number(deck);
    const meta = DECKS.find((item) => item.deck === activeListDeck);
    $("#grammarListMeta").textContent = `${activeListDeck}장 · ${deckItems(activeListDeck).length}개`;
    $("#grammarListTitle").textContent = meta.title;
    const list = $("#grammarList");
    list.replaceChildren();
    deckItems(activeListDeck).forEach((item) => {
      const row = document.createElement("article");
      row.className = "grammar-list-row";
      const pattern = document.createElement("div");
      appendText(pattern, "span", `${item.priority} · ${item.type}`, "grammar-list-meta");
      appendText(pattern, "strong", item.pattern);
      row.append(pattern);
      const answer = document.createElement("div");
      appendText(answer, "strong", item.meaning);
      appendText(answer, "span", item.connection);
      row.append(answer);
      const distinction = document.createElement("div");
      appendText(distinction, "span", "보기 구별", "grammar-list-meta");
      appendText(distinction, "p", item.contrast);
      row.append(distinction);
      list.append(row);
    });
    showView("list");
  }

  function validDeckSession(deck) {
    if (!session || session.mode !== "deck" || session.deck !== Number(deck)) return null;
    const expected = new Set(deckItems(deck).map((item) => item.id));
    return session.queueIds.length === expected.size && session.queueIds.every((id) => expected.has(id)) ? session : null;
  }

  function startDeck(deck, resume = false) {
    const saved = resume ? validDeckSession(deck) : null;
    const queue = saved ? saved.queueIds.map((id) => grammarMap.get(id)) : deckItems(deck);
    const meta = DECKS.find((item) => item.deck === Number(deck));
    startStudy(queue, {
      mode: "deck",
      deck: Number(deck),
      label: `${deck}장 · ${meta.title}`,
      initialIndex: saved?.index || 0,
      saveSession: true,
    });
  }

  function startReview() {
    const queue = grammar.filter((item) => reviewIds.has(item.id));
    startStudy(queue, { mode: "review", deck: 0, label: "헷갈린 문형", saveSession: false });
  }

  function startRandom() {
    const weighted = [];
    grammar.forEach((item) => {
      const weight = 1 + Math.min(5, Number(counts[item.id] || 0));
      for (let index = 0; index < weight; index += 1) weighted.push(item);
    });
    const selected = [];
    const used = new Set();
    for (const item of shuffle(weighted)) {
      if (used.has(item.id)) continue;
      selected.push(item);
      used.add(item.id);
      if (selected.length === Math.min(20, grammar.length)) break;
    }
    startStudy(selected, { mode: "random", deck: 0, label: "랜덤 회독 20개", saveSession: false });
  }

  function startStudy(queue, options) {
    if (!queue.length) return;
    currentMode = options.mode;
    state = {
      queue: [...queue],
      index: Math.min(Math.max(0, Number(options.initialIndex || 0)), queue.length - 1),
      label: options.label,
      revealed: false,
      completed: false,
    };
    if (options.saveSession) {
      session = {
        mode: options.mode,
        deck: options.deck,
        label: options.label,
        index: state.index,
        queueIds: state.queue.map((item) => item.id),
      };
      persistSession();
    }
    $("#grammarCompleteView").classList.add("hidden");
    $("#grammarCardView").classList.remove("hidden");
    showView("study");
    renderCard();
  }

  function currentItem() {
    return state.queue[state.index] || null;
  }

  function renderCard() {
    const item = currentItem();
    if (!item) return finishStudy();
    const position = state.index + 1;
    $("#grammarCardMeta").textContent = `${state.label} · ${position}/${state.queue.length}`;
    $("#grammarFamilyBadge").textContent = `${item.type} · ${item.family}`;
    $("#grammarSavedBadge").classList.toggle("hidden", !reviewIds.has(item.id));
    $("#grammarProgressFill").style.width = `${Math.round((position / state.queue.length) * 100)}%`;
    $("#grammarProgressText").textContent = `${position} / ${state.queue.length}`;
    $("#grammarPattern").textContent = item.pattern;
    $("#grammarType").textContent = `우선순위 ${item.priority}`;
    $("#grammarMeaning").textContent = item.meaning;
    $("#grammarConnection").textContent = item.connection;
    $("#grammarNuance").textContent = item.nuance;
    $("#grammarContrast").textContent = item.contrast;
    $("#grammarExample").textContent = item.example;
    $("#grammarExampleReading").textContent = item.example_reading;
    $("#grammarExampleKo").textContent = item.example_ko;
    $("#grammarAnswer").classList.toggle("hidden", !state.revealed);
    $("#revealGrammarBtn").textContent = state.revealed ? "정답을 확인했습니다" : "뜻 · 접속 보기";
    $("#revealGrammarBtn").disabled = state.revealed;
    $("#prevGrammarBtn").disabled = state.index === 0;
    $("#nextGrammarBtn").textContent = state.index === state.queue.length - 1 ? "완료" : "다음";
    if (session?.mode === "deck") {
      session.index = state.index;
      persistSession();
    }
  }

  function reveal() {
    state.revealed = true;
    renderCard();
  }

  function move(offset) {
    const next = state.index + offset;
    if (next < 0) return;
    if (next >= state.queue.length) return finishStudy();
    state.index = next;
    state.revealed = false;
    renderCard();
  }

  function markConfusing() {
    const item = currentItem();
    if (!item) return;
    reviewIds.add(item.id);
    counts[item.id] = Number(counts[item.id] || 0) + 1;
    save(STORAGE.review, [...reviewIds]);
    save(STORAGE.counts, counts);
    move(1);
  }

  function markKnown() {
    const item = currentItem();
    if (!item) return;
    reviewIds.delete(item.id);
    save(STORAGE.review, [...reviewIds]);
    move(1);
  }

  function finishStudy() {
    if (state.completed) return;
    state.completed = true;
    if (currentMode === "deck" && session?.deck) {
      completed.add(session.deck);
      save(STORAGE.completed, [...completed].sort((a, b) => a - b));
      session = null;
      persistSession();
    }
    $("#grammarCardView").classList.add("hidden");
    const complete = $("#grammarCompleteView");
    complete.classList.remove("hidden");
    complete.replaceChildren();
    appendText(complete, "p", state.label, "eyebrow");
    appendText(complete, "h2", "회독 완료");
    appendText(complete, "p", `${state.queue.length}개 문형을 확인했습니다. 현재 헷갈린 문형은 ${reviewIds.size}개입니다.`);
    const actions = document.createElement("div");
    actions.className = "complete-actions";
    const again = appendText(actions, "button", "다시 회독");
    again.type = "button";
    again.addEventListener("click", () => startStudy(state.queue, { mode: currentMode, deck: 0, label: state.label, saveSession: false }));
    if (reviewIds.size) {
      const review = appendText(actions, "button", "헷갈린 문형");
      review.type = "button";
      review.addEventListener("click", startReview);
    }
    const decks = appendText(actions, "button", "단계 목록");
    decks.type = "button";
    decks.addEventListener("click", renderDecks);
    complete.append(actions);
    updateStats();
  }

  $("#reviewGrammarBtn").addEventListener("click", startReview);
  $("#randomGrammarBtn").addEventListener("click", startRandom);
  $("#backGrammarDeckBtn").addEventListener("click", renderDecks);
  $("#startGrammarListBtn").addEventListener("click", () => startDeck(activeListDeck, true));
  $("#studyGrammarBackBtn").addEventListener("click", renderDecks);
  $("#revealGrammarBtn").addEventListener("click", reveal);
  $("#confusingGrammarBtn").addEventListener("click", markConfusing);
  $("#knownGrammarBtn").addEventListener("click", markKnown);
  $("#prevGrammarBtn").addEventListener("click", () => move(-1));
  $("#nextGrammarBtn").addEventListener("click", () => move(1));
  $("#resetGrammarBtn").addEventListener("click", () => {
    state.index = 0;
    state.revealed = false;
    renderCard();
  });

  document.addEventListener("keydown", (event) => {
    if ($("#grammarStudyView").classList.contains("hidden") || event.target.matches("input, textarea, select")) return;
    if (event.code === "Space") {
      event.preventDefault();
      reveal();
    } else if (event.key.toLowerCase() === "s") markConfusing();
    else if (event.key === "Enter") markKnown();
    else if (event.key === "ArrowLeft") move(-1);
    else if (event.key === "ArrowRight") move(1);
  });

  renderDecks();
})();
