(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const level = window.JLPT.levelConfig(document.body.dataset.level);
  const isN3 = level.key === "추가";
  const state = { view: "stages", deck: 1, mode: "level" };

  function appendText(parent, tagName, value, className = "") {
    const element = document.createElement(tagName);
    element.textContent = value;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function statusLabel(deck) {
    if (window.JLPT.isInProgress(level.key, deck)) return "회독중";
    if (window.JLPT.isCompleted(level.key, deck)) return "회독 완료";
    return "대기";
  }

  function statusClass(deck) {
    if (window.JLPT.isInProgress(level.key, deck)) return "running";
    if (window.JLPT.isCompleted(level.key, deck)) return "completed";
    return "pending";
  }

  function showView(name) {
    state.view = name;
    ["#stageView", "#listView", "#studyView"].forEach((selector) => $(selector).classList.add("hidden"));
    $(`#${name}View`).classList.remove("hidden");
    updateStats();
  }

  function updateStats() {
    $("#levelWordCount").textContent = window.JLPT.levelWords(level.key).length;
    $("#levelDeckCount").textContent = window.JLPT.deckNumbers(level.key).length;
    $("#levelCompletedCount").textContent = window.JLPT.completedCount(level.key);
    $("#levelStudyCount").textContent = window.JLPT.totalStudyCount(level.key);
  }

  function updateVerbChapterCard() {
    const card = $("#verbChapterCard");
    if (!card) return;
    const inProgress = window.JLPT.isInProgress("동사", 1);
    const isCompleted = window.JLPT.isCompleted("동사", 1);
    card.classList.toggle("running", inProgress);
    card.classList.toggle("completed", isCompleted);
    $("#verbChapterStatus").textContent = inProgress ? "회독중" : isCompleted ? "회독 완료" : "기준 회독과 분리";
    $("#verbChapterCount").textContent = window.JLPT.chapterWords("verbs").length;
    $("#startVerbChapterBtn").textContent = inProgress ? "동사 회독 이어하기" : "동사 회독 시작";
  }

  function renderStages() {
    const grid = $("#stageGrid");
    grid.replaceChildren();
    window.JLPT.deckNumbers(level.key).forEach((deck) => {
      const range = window.JLPT.deckRange(level.key, deck);
      const review = window.JLPT.reviewWindow(level.key, deck);
      const card = document.createElement("article");
      card.className = `stage-card ${statusClass(deck)}`;
      const top = document.createElement("div");
      top.className = "stage-card-top";
      appendText(top, "h3", `${deck}장`);
      appendText(top, "span", statusLabel(deck), "status-pill");
      card.append(top);
      appendText(card, "p", `${range.start}-${range.end}번 · 이 장 ${range.count}개`, "stage-subtext");
      appendText(card, "p", `회독 범위 ${review.start}-${review.end}번 · ${review.count}개`, "stage-detail");

      const actions = document.createElement("div");
      actions.className = "stage-actions";
      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.textContent = window.JLPT.isInProgress(level.key, deck) ? "회독 이어하기" : "회독 시작";
      startButton.addEventListener("click", () => startLevelStudy(deck, true));
      const listButton = document.createElement("button");
      listButton.type = "button";
      listButton.className = "secondary-action";
      listButton.textContent = "단어장";
      listButton.addEventListener("click", () => openWordList(deck));
      actions.append(startButton, listButton);
      card.append(actions);
      grid.append(card);
    });
    updateVerbChapterCard();
    showView("stage");
  }

  function renderWordRows(words) {
    const list = $("#wordList");
    list.replaceChildren();
    words.forEach((word) => {
      const row = document.createElement("article");
      row.className = "word-list-row";
      const title = document.createElement("div");
      appendText(title, "strong", word.japanese);
      appendText(title, "span", word.reading);
      row.append(title);
      appendText(row, "p", word.meaning);
      const details = document.createElement("div");
      if (word.kanji_note) appendText(details, "small", word.kanji_note);
      appendText(details, "small", `공부하겠음 ${window.JLPT.studyCount(word.id)}회`, "study-history");
      row.append(details);
      list.append(row);
    });
  }

  function openWordList(deck) {
    state.deck = Number(deck);
    state.mode = "level";
    const range = window.JLPT.deckRange(level.key, deck);
    $("#listTitle").textContent = `${level.label} ${deck}장 단어`;
    $("#listMeta").textContent = `${range.start}-${range.end}번 · ${range.count}개`;
    renderWordRows(window.JLPT.deckWords(level.key, deck));
    showView("list");
  }

  function openVerbList() {
    state.mode = "chapter";
    state.deck = 1;
    const words = window.JLPT.chapterWords("verbs");
    $("#listTitle").textContent = "동사 집중 챕터";
    $("#listMeta").textContent = `기준 회독과 분리 · ${words.length}개`;
    renderWordRows(words);
    showView("list");
  }

  function validResumeSession(deck, expectedWords) {
    const sessionId = `level:${level.key}:${deck}`;
    const session = window.JLPT.getActiveSession();
    if (!session || session.sessionId !== sessionId || session.queueIds.length !== expectedWords.length) return null;
    const expectedIds = new Set(expectedWords.map((word) => word.id));
    if (!session.queueIds.every((id) => expectedIds.has(id))) return null;
    return session;
  }

  function startLevelStudy(deck, resume = false) {
    state.deck = Number(deck);
    state.mode = "level";
    const expectedWords = window.JLPT.reviewWindowWords(level.key, deck);
    const savedSession = resume ? validResumeSession(deck, expectedWords) : null;
    const queue = savedSession ? window.JLPT.wordsFromIds(savedSession.queueIds) : window.JLPT.shuffle(expectedWords);
    const sessionId = `level:${level.key}:${deck}`;
    const initialIndex = savedSession ? Math.min(savedSession.index, queue.length - 1) : 0;
    window.JLPT.markInProgress(level.key, deck);
    window.JLPT.setActiveSession({
      mode: "level",
      level: level.key,
      deck,
      index: initialIndex,
      queueIds: queue.map((word) => word.id),
      sessionId,
    });
    showView("study");
    study.start({
      queue,
      initialIndex,
      label: `${level.label} ${deck}장 회독`,
      onIndexChange(index) {
        const active = window.JLPT.getActiveSession();
        if (active?.sessionId !== sessionId) return;
        window.JLPT.setActiveSession({ ...active, index });
      },
      onComplete() {
        window.JLPT.markCompleted(level.key, deck);
        window.JLPT.clearActiveSession(sessionId);
        const range = window.JLPT.reviewWindow(level.key, deck);
        const actions = [
          { label: "다시 회독", onClick: () => startLevelStudy(deck) },
          { label: "단계 목록", onClick: renderStages },
        ];
        const nextDeck = window.JLPT.deckNumbers(level.key).find((value) => value > deck);
        if (nextDeck) actions.splice(1, 0, { label: "다음 장", onClick: () => startLevelStudy(nextDeck) });
        study.showComplete({
          eyebrow: `${level.label} ${deck}장`,
          title: "회독 완료",
          message: `${range.start}-${range.end}번 ${range.count}개 회독을 완료했습니다.`,
          actions,
        });
        updateStats();
      },
    });
  }

  function validVerbSession(expectedWords) {
    const sessionId = "chapter:verbs";
    const session = window.JLPT.getActiveSession();
    if (!session || session.sessionId !== sessionId || session.queueIds.length !== expectedWords.length) return null;
    const expectedIds = new Set(expectedWords.map((word) => word.id));
    if (!session.queueIds.every((id) => expectedIds.has(id))) return null;
    return session;
  }

  function startVerbStudy(resume = false) {
    state.deck = 1;
    state.mode = "chapter";
    const expectedWords = window.JLPT.chapterWords("verbs");
    const savedSession = resume ? validVerbSession(expectedWords) : null;
    const queue = savedSession ? window.JLPT.wordsFromIds(savedSession.queueIds) : window.JLPT.shuffle(expectedWords);
    const sessionId = "chapter:verbs";
    const initialIndex = savedSession ? Math.min(savedSession.index, queue.length - 1) : 0;
    window.JLPT.markInProgress("동사", 1);
    window.JLPT.setActiveSession({
      mode: "chapter",
      level: "동사",
      deck: 1,
      index: initialIndex,
      queueIds: queue.map((word) => word.id),
      sessionId,
    });
    showView("study");
    study.start({
      queue,
      initialIndex,
      label: "N3 동사 집중 챕터",
      onIndexChange(index) {
        const active = window.JLPT.getActiveSession();
        if (active?.sessionId !== sessionId) return;
        window.JLPT.setActiveSession({ ...active, index });
      },
      onComplete() {
        window.JLPT.markCompleted("동사", 1);
        window.JLPT.clearActiveSession(sessionId);
        study.showComplete({
          eyebrow: "SPECIAL CHAPTER",
          title: "동사 회독 완료",
          message: `${expectedWords.length}개 동사 전용 회독을 완료했습니다. 기준 회독 완료 기록에는 영향을 주지 않습니다.`,
          actions: [
            { label: "다시 회독", onClick: () => startVerbStudy() },
            { label: "단계 목록", onClick: renderStages },
          ],
        });
        updateVerbChapterCard();
      },
    });
  }

  function startRandomTest() {
    state.mode = "test";
    const queue = window.JLPT.createWeightedTest(level.key, 20);
    showView("study");
    study.start({
      queue,
      label: `${level.label} 랜덤 테스트`,
      onComplete(result) {
        study.showComplete({
          eyebrow: `${level.label} 랜덤 테스트`,
          title: "테스트 완료",
          message: `20문제 중 알고있음 ${result.knownCount}회 · 공부하겠음 ${result.studyCount}회`,
          actions: [
            { label: "새 테스트", onClick: startRandomTest },
            { label: "단계 목록", onClick: renderStages },
          ],
        });
        updateStats();
      },
    });
  }

  document.title = `${level.label} 단어장 | JLPT 회독`;
  $("#levelTitle").textContent = `${level.label} 단어장`;
  $("#levelEyebrow").textContent = `${level.label} VOCABULARY`;
  $("#randomTestBtn").addEventListener("click", startRandomTest);
  $("#backStageBtn").addEventListener("click", renderStages);
  $("#startListDeckBtn").addEventListener("click", () => {
    if (state.mode === "chapter") startVerbStudy(true);
    else startLevelStudy(state.deck, true);
  });
  if (isN3) {
    $("#startVerbChapterBtn").addEventListener("click", () => startVerbStudy(true));
    $("#openVerbListBtn").addEventListener("click", openVerbList);
  }

  const study = window.JLPTStudy.create($("#studyMount"), {
    homeHref: "../",
    backLabel: "단계 목록",
    onBack: renderStages,
  });

  renderStages();
  if (new URLSearchParams(location.search).get("mode") === "test") startRandomTest();
})();
