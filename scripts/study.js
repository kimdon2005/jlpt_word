(() => {
  "use strict";

  function appendText(parent, tagName, value, className = "") {
    const element = document.createElement(tagName);
    element.textContent = value;
    if (className) element.className = className;
    parent.append(element);
    return element;
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

  function buildKanjiAnalysisText(entry) {
    const sense = meaningSense(entry.meaning);
    const strokeText =
      entry.totalStrokes && entry.additionalStrokes >= 0
        ? `총 ${entry.totalStrokes}획, 부수 ${entry.radicalStrokes}획 + 추가 ${entry.additionalStrokes}획. `
        : "";
    const componentFlow = (entry.components || [])
      .map((component) => `${component.component}의 '${component.hint}'`)
      .join(" / ");
    const meaningText = sense ? `이 한자는 '${sense}' 뜻으로 기억합니다.` : "이 한자의 기본 의미를 기억합니다.";
    return `${strokeText}대표 부수 ${entry.radical}(${entry.radicalName})는 '${entry.radicalHint}' 범위를 잡아 줍니다. 구성요소 의미는 ${componentFlow}입니다. 이 요소들을 함께 보면서 ${meaningText}`;
  }

  function buildWordBridge(word, entries) {
    const parts = entries
      .map((entry) => `${entry.kanji}(${meaningSense(entry.meaning) || entry.meaning || "뜻"})`)
      .join(" + ");
    if (!parts) return "";
    if (entries.length === 1) return `${parts}가 핵심 의미입니다. 이 단어에서는 '${word.meaning}'의 뜻으로 쓰입니다.`;
    return `${parts}처럼 각 한자의 의미를 이어 보면 이 단어는 '${word.meaning}'입니다.`;
  }

  function create(root, config = {}) {
    root.innerHTML = `
      <div class="study-topbar">
        <a class="text-btn link-btn" href="${config.homeHref || "../"}">홈</a>
        <button id="studyBackBtn" class="text-btn" type="button">${config.backLabel || "목록"}</button>
      </div>
      <div id="completeView" class="complete hidden"></div>
      <article id="cardView" class="word-card">
        <div class="card-top">
          <span id="cardMeta" class="badge"></span>
          <span id="studyCountBadge" class="badge count-badge hidden"></span>
          <span id="savedBadge" class="badge saved hidden">모르는 단어</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar"><span id="progressFill"></span></div>
          <p id="progressText"></p>
        </div>
        <section class="front">
          <p class="front-label">먼저 보고 떠올리기</p>
          <h2 id="japaneseWord"></h2>
        </section>
        <section class="reveals">
          <div class="answer-box pending" id="readingBox">
            <span>일본어 발음</span><strong id="readingValue"></strong>
          </div>
          <div class="answer-box pending" id="meaningBox">
            <span>한국어 뜻</span><strong id="meaningValue"></strong>
          </div>
        </section>
        <section id="extraInfo" class="extra-info hidden">
          <p id="kanjiNote"></p>
          <div id="radicalAnalysis" class="radical-analysis"></div>
          <p id="exampleText"></p>
          <p id="exampleKo"></p>
        </section>
        <div class="primary-actions">
          <button id="showReadingBtn" class="secondary" type="button">일본어</button>
          <button id="showMeaningBtn" class="secondary" type="button">한국어</button>
        </div>
        <div class="decision-actions">
          <button id="saveStudyBtn" class="study" type="button">공부하겠음</button>
          <button id="knownBtn" class="known" type="button">알고있음</button>
        </div>
        <div class="nav-actions">
          <button id="prevBtn" type="button">이전</button>
          <button id="resetBtn" type="button">처음부터</button>
          <button id="nextBtn" type="button">다음</button>
        </div>
      </article>`;

    const elements = {};
    [
      "studyBackBtn",
      "completeView",
      "cardView",
      "cardMeta",
      "studyCountBadge",
      "savedBadge",
      "progressFill",
      "progressText",
      "japaneseWord",
      "readingBox",
      "readingValue",
      "meaningBox",
      "meaningValue",
      "extraInfo",
      "kanjiNote",
      "radicalAnalysis",
      "exampleText",
      "exampleKo",
      "showReadingBtn",
      "showMeaningBtn",
      "saveStudyBtn",
      "knownBtn",
      "prevBtn",
      "resetBtn",
      "nextBtn",
    ].forEach((id) => {
      elements[id] = root.querySelector(`#${id}`);
    });

    const state = {
      queue: [],
      index: 0,
      label: "회독",
      revealedReading: false,
      revealedMeaning: false,
      onComplete: null,
      onIndexChange: null,
      knownCount: 0,
      studyCount: 0,
      completed: false,
    };

    function currentWord() {
      return state.queue[state.index] || null;
    }

    function renderRadicalAnalysis(word) {
      elements.radicalAnalysis.replaceChildren();
      const entries = uniqueKanji(word.japanese)
        .map((char) => window.JLPT.KANJI_RADICALS[char])
        .filter(Boolean);
      elements.radicalAnalysis.classList.toggle("hidden", entries.length === 0);
      if (!entries.length) return;

      appendText(elements.radicalAnalysis, "h3", "부수로 이해하기");
      appendText(elements.radicalAnalysis, "p", buildWordBridge(word, entries), "radical-summary");
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
      elements.radicalAnalysis.append(list);
    }

    function notifyIndexChange() {
      if (typeof state.onIndexChange === "function") state.onIndexChange(state.index);
    }

    function resetReveal() {
      state.revealedReading = false;
      state.revealedMeaning = false;
    }

    function finish() {
      if (state.completed) return;
      state.completed = true;
      if (typeof state.onComplete === "function") {
        state.onComplete({ knownCount: state.knownCount, studyCount: state.studyCount, total: state.queue.length });
      }
    }

    function render() {
      const word = currentWord();
      if (!word) {
        finish();
        return;
      }

      elements.completeView.classList.add("hidden");
      elements.cardView.classList.remove("hidden");
      const position = state.index + 1;
      const count = state.queue.length;
      elements.cardMeta.textContent = `${state.label} · ${position}/${count}`;
      const savedCount = window.JLPT.studyCount(word.id);
      elements.studyCountBadge.textContent = `공부 ${savedCount}회`;
      elements.studyCountBadge.classList.toggle("hidden", savedCount === 0);
      elements.savedBadge.classList.toggle("hidden", !window.JLPT.reviewIds.has(word.id));
      elements.progressFill.style.width = `${Math.round((position / count) * 100)}%`;
      elements.progressText.textContent = `${position} / ${count}`;
      elements.japaneseWord.textContent = word.japanese;
      elements.readingBox.classList.toggle("pending", !state.revealedReading);
      elements.meaningBox.classList.toggle("pending", !state.revealedMeaning);
      elements.readingValue.textContent = state.revealedReading ? word.reading : "일본어 버튼을 누르면 표시됩니다.";
      elements.meaningValue.textContent = state.revealedMeaning ? word.meaning : "한국어 버튼을 누르면 표시됩니다.";
      elements.extraInfo.classList.toggle("hidden", !state.revealedMeaning);
      elements.kanjiNote.textContent = word.kanji_note ? `한자: ${word.kanji_note}` : "";
      elements.exampleText.textContent = word.example ? `예문: ${word.example}` : "";
      elements.exampleKo.textContent = word.example_ko ? `해석: ${word.example_ko}` : "";
      renderRadicalAnalysis(word);
      elements.prevBtn.disabled = state.index === 0;
      elements.nextBtn.textContent = state.index === count - 1 ? "완료" : "다음";
      notifyIndexChange();
    }

    function moveNext() {
      if (!currentWord()) return;
      state.index += 1;
      resetReveal();
      render();
    }

    function movePrevious() {
      if (state.index === 0) return;
      state.index -= 1;
      resetReveal();
      render();
    }

    function saveForStudy() {
      const word = currentWord();
      if (!word) return;
      window.JLPT.addReviewWord(word.id);
      window.JLPT.incrementStudyCount(word.id);
      state.studyCount += 1;
      moveNext();
    }

    function markKnown() {
      const word = currentWord();
      if (!word) return;
      window.JLPT.removeReviewWord(word.id);
      state.knownCount += 1;
      moveNext();
    }

    elements.studyBackBtn.addEventListener("click", () => config.onBack?.());
    elements.showReadingBtn.addEventListener("click", () => {
      state.revealedReading = true;
      render();
    });
    elements.showMeaningBtn.addEventListener("click", () => {
      state.revealedMeaning = true;
      render();
    });
    elements.saveStudyBtn.addEventListener("click", saveForStudy);
    elements.knownBtn.addEventListener("click", markKnown);
    elements.prevBtn.addEventListener("click", movePrevious);
    elements.nextBtn.addEventListener("click", moveNext);
    elements.resetBtn.addEventListener("click", () => {
      state.index = 0;
      resetReveal();
      render();
    });

    document.addEventListener("keydown", (event) => {
      if (root.closest(".hidden") || event.target instanceof HTMLButtonElement) return;
      const key = event.key.toLowerCase();
      if (key === "j") elements.showReadingBtn.click();
      if (key === "k") elements.showMeaningBtn.click();
      if (key === "s") saveForStudy();
      if (event.key === "Enter") markKnown();
      if (event.key === "ArrowLeft") movePrevious();
      if (event.key === "ArrowRight") moveNext();
    });

    return {
      start(options) {
        state.queue = [...(options.queue || [])];
        state.index = Math.min(Math.max(0, Number(options.initialIndex || 0)), Math.max(0, state.queue.length - 1));
        state.label = options.label || "회독";
        state.onComplete = options.onComplete;
        state.onIndexChange = options.onIndexChange;
        state.knownCount = 0;
        state.studyCount = 0;
        state.completed = false;
        resetReveal();
        render();
      },
      showComplete({ eyebrow = "완료", title, message, actions = [] }) {
        elements.cardView.classList.add("hidden");
        elements.completeView.classList.remove("hidden");
        elements.completeView.replaceChildren();
        appendText(elements.completeView, "p", eyebrow, "eyebrow");
        appendText(elements.completeView, "h2", title);
        appendText(elements.completeView, "p", message);
        const actionBox = document.createElement("div");
        actionBox.className = "complete-actions";
        actions.forEach((action) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = action.label;
          button.addEventListener("click", action.onClick);
          actionBox.append(button);
        });
        elements.completeView.append(actionBox);
      },
    };
  }

  window.JLPTStudy = { create };
})();
