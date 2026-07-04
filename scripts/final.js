(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const DATA = window.JLPT_FINAL || {words: [], kanji: [], grammar: []};
  const DECKS = [
    {key:"words", title:"최빈출 단어", eyebrow:"2–3개 영상 공통", description:"서로 다른 영상에서 두 번 이상 나온 단어만 모은 최우선 회독", front:"읽기와 뜻을 떠올리기"},
    {key:"kanji", title:"한자 읽기 점검", eyebrow:"읽기·형태 함정", description:"영상에서 한자 읽기나 유사 글자를 직접 짚은 항목", front:"읽기와 뜻을 떠올리기"},
    {key:"grammar", title:"문법 문형 점검", eyebrow:"접속·구별 중심", description:"영상에서 용법이나 보기 구별을 직접 설명한 문형", front:"뜻과 접속을 떠올리기"},
  ];
  const STORAGE = {
    review:"jlpt-final-review-v1",
    completed:"jlpt-final-completed-v1",
    session:"jlpt-final-session-v1",
  };
  const itemMap = new Map(DECKS.flatMap((deck) => DATA[deck.key].map((item) => [item.id, {...item, deck:deck.key}])));

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  }

  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function appendText(parent, tag, value, className = "") {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  const reviewIds = new Set(load(STORAGE.review, []).filter((id) => itemMap.has(id)));
  const completed = new Set(load(STORAGE.completed, []).filter((key) => DECKS.some((deck) => deck.key === key)));
  let session = normalizeSession(load(STORAGE.session, null));
  let activeDeck = "words";
  let mode = "deck";
  let state = {queue:[], index:0, label:"", revealed:false, done:false};

  function normalizeSession(value) {
    if (!value || !DECKS.some((deck) => deck.key === value.deck) || !Array.isArray(value.queueIds)) return null;
    const queueIds = value.queueIds.filter((id) => itemMap.has(id));
    if (!queueIds.length) return null;
    return {deck:value.deck, index:Math.min(Math.max(0, Number(value.index || 0)), queueIds.length - 1), queueIds};
  }

  function deckMeta(key) { return DECKS.find((deck) => deck.key === key); }
  function deckItems(key) { return DATA[key] || []; }
  function frequencyLabel(item) { return `${item.sourceCount}개 영상`; }
  function sourceLabel(item) { return `출처: ${item.sources.join(" · ")}`; }

  function showView(name) {
    $("#finalDeckView").classList.toggle("hidden", name !== "deck");
    $("#finalListView").classList.toggle("hidden", name !== "list");
    $("#finalStudyView").classList.toggle("hidden", name !== "study");
  }

  function updateStats() {
    $("#finalWordCount").textContent = DATA.words.length;
    $("#finalKanjiCount").textContent = DATA.kanji.length;
    $("#finalGrammarCount").textContent = DATA.grammar.length;
    $("#finalReviewCount").textContent = reviewIds.size;
    $("#finalAllReviewBtn").disabled = reviewIds.size === 0;
  }

  function renderDecks() {
    const grid = $("#finalDeckGrid");
    grid.replaceChildren();
    DECKS.forEach((meta) => {
      const items = deckItems(meta.key);
      const repeated = items.filter((item) => item.sourceCount >= 2).length;
      const card = document.createElement("article");
      card.className = `stage-card final-deck-card ${completed.has(meta.key) ? "completed" : session?.deck === meta.key ? "running" : "pending"}`;
      const top = document.createElement("div");
      top.className = "stage-card-top";
      appendText(top, "h3", meta.title);
      appendText(top, "span", completed.has(meta.key) ? "회독 완료" : session?.deck === meta.key ? "회독중" : "대기", "status-pill");
      card.append(top);
      appendText(card, "p", `${meta.eyebrow} · ${items.length}개`, "stage-subtext");
      appendText(card, "p", meta.description, "stage-detail");
      const tags = document.createElement("div");
      tags.className = "grammar-tags";
      appendText(tags, "span", `영상 공통 ${repeated}개`);
      appendText(tags, "span", `다시 볼 것 ${items.filter((item) => reviewIds.has(item.id)).length}개`);
      card.append(tags);
      const actions = document.createElement("div");
      actions.className = "stage-actions final-stage-actions";
      const start = appendText(actions, "button", session?.deck === meta.key ? "회독 이어하기" : "회독 시작");
      start.type = "button";
      start.addEventListener("click", () => startDeck(meta.key, true));
      const list = appendText(actions, "button", "전체 목록", "secondary-action");
      list.type = "button";
      list.addEventListener("click", () => openList(meta.key));
      const review = appendText(actions, "button", "다시 볼 것", "secondary-action");
      review.type = "button";
      review.disabled = !items.some((item) => reviewIds.has(item.id));
      review.addEventListener("click", () => startReview(meta.key));
      card.append(actions);
      grid.append(card);
    });
    updateStats();
    showView("deck");
  }

  function openList(key) {
    activeDeck = key;
    const meta = deckMeta(key);
    $("#finalListMeta").textContent = `${meta.eyebrow} · ${deckItems(key).length}개`;
    $("#finalListTitle").textContent = meta.title;
    const list = $("#finalList");
    list.replaceChildren();
    deckItems(key).forEach((item, index) => {
      const row = document.createElement("article");
      row.className = "final-list-row";
      const term = document.createElement("div");
      appendText(term, "span", `${index + 1} · ${frequencyLabel(item)}`, "grammar-list-meta");
      appendText(term, "strong", key === "grammar" ? item.pattern : item.japanese);
      row.append(term);
      const answer = document.createElement("div");
      if (key !== "grammar") appendText(answer, "span", item.reading);
      appendText(answer, "strong", item.meaning);
      row.append(answer);
      const note = document.createElement("div");
      appendText(note, "span", sourceLabel(item), "final-list-source");
      appendText(note, "p", key === "grammar" ? item.connection : item.note);
      row.append(note);
      list.append(row);
    });
    showView("list");
  }

  function validSession(key) {
    if (!session || session.deck !== key) return null;
    const expected = new Set(deckItems(key).map((item) => item.id));
    return session.queueIds.length === expected.size && session.queueIds.every((id) => expected.has(id)) ? session : null;
  }

  function startDeck(key, resume = false) {
    const saved = resume ? validSession(key) : null;
    const queue = saved ? saved.queueIds.map((id) => itemMap.get(id)) : deckItems(key).map((item) => ({...item, deck:key}));
    startStudy(queue, {deck:key, label:deckMeta(key).title, index:saved?.index || 0, persist:true, sessionMode:"deck"});
  }

  function startReview(key = "") {
    const queue = [...itemMap.values()].filter((item) => reviewIds.has(item.id) && (!key || item.deck === key));
    startStudy(queue, {deck:key || "words", label:key ? `${deckMeta(key).title} · 다시 볼 것` : "다시 볼 것 전체", persist:false, sessionMode:"review"});
  }

  function startStudy(queue, options) {
    if (!queue.length) return;
    activeDeck = options.deck;
    mode = options.sessionMode;
    state = {queue:[...queue], index:Number(options.index || 0), label:options.label, revealed:false, done:false};
    if (options.persist) {
      session = {deck:options.deck, index:state.index, queueIds:state.queue.map((item) => item.id)};
      save(STORAGE.session, session);
    }
    $("#finalCompleteView").classList.add("hidden");
    $("#finalCardView").classList.remove("hidden");
    showView("study");
    renderCard();
  }

  function current() { return state.queue[state.index]; }

  function renderCard() {
    const item = current();
    if (!item) return finish();
    const itemDeck = item.deck || activeDeck;
    const meta = deckMeta(itemDeck);
    const position = state.index + 1;
    $("#finalCardMeta").textContent = `${state.label} · ${position}/${state.queue.length}`;
    $("#finalTypeBadge").textContent = itemDeck === "words" ? item.type : itemDeck === "kanji" ? "한자" : `${item.type} · ${item.family}`;
    $("#finalFrequencyBadge").textContent = frequencyLabel(item);
    $("#finalFrequencyBadge").classList.toggle("top", item.sourceCount === 3);
    $("#finalSavedBadge").classList.toggle("hidden", !reviewIds.has(item.id));
    $("#finalProgressFill").style.width = `${Math.round(position / state.queue.length * 100)}%`;
    $("#finalProgressText").textContent = `${position} / ${state.queue.length}`;
    $("#finalFrontLabel").textContent = meta.front;
    $("#finalTerm").textContent = itemDeck === "grammar" ? item.pattern : item.japanese;

    if (itemDeck === "grammar") {
      setAnswer("핵심 뜻", item.meaning, "접속", item.connection, "보기 구별", item.contrast, "쓰는 감각", item.nuance);
      setExample(item.example, item.example_reading, item.example_ko);
    } else {
      setAnswer("읽기", item.reading, "뜻", item.meaning, "암기 포인트", item.note, "", "");
      setExample(item.example || "", "", item.example_ko || "");
    }
    $("#finalSourceLine").textContent = sourceLabel(item);
    $("#finalAnswer").classList.toggle("hidden", !state.revealed);
    $("#finalRevealBtn").disabled = state.revealed;
    $("#finalRevealBtn").textContent = state.revealed ? "정답을 확인했습니다" : "정답 보기";
    $("#finalPrevBtn").disabled = state.index === 0;
    $("#finalNextBtn").textContent = state.index === state.queue.length - 1 ? "완료" : "다음";
    if (session && mode === "deck") {
      session.index = state.index;
      save(STORAGE.session, session);
    }
  }

  function setAnswer(labelA, answerA, labelB, answerB, noteLabel, note, extraLabel, extra) {
    $("#finalAnswerALabel").textContent = labelA;
    $("#finalAnswerA").textContent = answerA;
    $("#finalAnswerBLabel").textContent = labelB;
    $("#finalAnswerB").textContent = answerB;
    $("#finalNoteLabel").textContent = noteLabel;
    $("#finalNote").textContent = note;
    $("#finalExtraLabel").textContent = extraLabel;
    $("#finalExtra").textContent = extra;
    $("#finalExtraBox").classList.toggle("hidden", !extra);
  }

  function setExample(example, reading, korean) {
    $("#finalExample").textContent = example;
    $("#finalExampleReading").textContent = reading;
    $("#finalExampleKo").textContent = korean;
    $("#finalExampleBox").classList.toggle("hidden", !example);
  }

  function reveal() { state.revealed = true; renderCard(); }
  function move(offset) {
    const next = state.index + offset;
    if (next < 0) return;
    if (next >= state.queue.length) return finish();
    state.index = next;
    state.revealed = false;
    renderCard();
  }
  function markReview(known) {
    const item = current();
    if (!item) return;
    if (known) reviewIds.delete(item.id); else reviewIds.add(item.id);
    save(STORAGE.review, [...reviewIds]);
    move(1);
  }

  function finish() {
    if (state.done) return;
    state.done = true;
    if (mode === "deck" && session) {
      completed.add(session.deck);
      save(STORAGE.completed, [...completed]);
      session = null;
      localStorage.removeItem(STORAGE.session);
    }
    $("#finalCardView").classList.add("hidden");
    const complete = $("#finalCompleteView");
    complete.classList.remove("hidden");
    complete.replaceChildren();
    appendText(complete, "p", state.label, "eyebrow");
    appendText(complete, "h2", "회독 완료");
    appendText(complete, "p", `${state.queue.length}개를 확인했습니다. 현재 다시 볼 항목은 ${reviewIds.size}개입니다.`);
    const actions = document.createElement("div");
    actions.className = "complete-actions";
    const again = appendText(actions, "button", "다시 회독");
    again.type = "button";
    again.addEventListener("click", () => startStudy(state.queue, {deck:activeDeck, label:state.label, persist:false, sessionMode:mode}));
    if (reviewIds.size) {
      const review = appendText(actions, "button", "다시 볼 것 전체");
      review.type = "button";
      review.addEventListener("click", () => startReview());
    }
    const decks = appendText(actions, "button", "세션 목록");
    decks.type = "button";
    decks.addEventListener("click", renderDecks);
    complete.append(actions);
    updateStats();
  }

  $("#finalAllReviewBtn").addEventListener("click", () => startReview());
  $("#finalListBackBtn").addEventListener("click", renderDecks);
  $("#finalListStartBtn").addEventListener("click", () => startDeck(activeDeck, true));
  $("#finalStudyBackBtn").addEventListener("click", renderDecks);
  $("#finalRevealBtn").addEventListener("click", reveal);
  $("#finalSaveBtn").addEventListener("click", () => markReview(false));
  $("#finalKnownBtn").addEventListener("click", () => markReview(true));
  $("#finalPrevBtn").addEventListener("click", () => move(-1));
  $("#finalNextBtn").addEventListener("click", () => move(1));
  $("#finalResetBtn").addEventListener("click", () => { state.index = 0; state.revealed = false; renderCard(); });
  document.addEventListener("keydown", (event) => {
    if ($("#finalStudyView").classList.contains("hidden") || event.target.matches("input, textarea, select")) return;
    if (event.code === "Space") { event.preventDefault(); reveal(); }
    else if (event.key.toLowerCase() === "s") markReview(false);
    else if (event.key === "Enter") markReview(true);
    else if (event.key === "ArrowLeft") move(-1);
    else if (event.key === "ArrowRight") move(1);
  });

  renderDecks();
})();
