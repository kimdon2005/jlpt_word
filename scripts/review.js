(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  function appendText(parent, tagName, value, className = "") {
    const element = document.createElement(tagName);
    element.textContent = value;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function showView(name) {
    $("#reviewView").classList.toggle("hidden", name !== "review");
    $("#studyView").classList.toggle("hidden", name !== "study");
  }

  function renderReviewList() {
    const words = window.JLPT.reviewWords();
    $("#reviewCount").textContent = words.length;
    $("#reviewStudyCount").textContent = words.reduce((sum, word) => sum + window.JLPT.studyCount(word.id), 0);
    $("#startReviewBtn").disabled = words.length === 0;
    const list = $("#wordList");
    list.replaceChildren();
    if (!words.length) {
      appendText(list, "p", "저장된 단어가 없습니다.", "empty-state");
      return;
    }
    words.forEach((word) => {
      const row = document.createElement("article");
      row.className = "word-list-row";
      const title = document.createElement("div");
      appendText(title, "strong", word.japanese);
      appendText(title, "span", word.reading);
      row.append(title);
      appendText(row, "p", word.meaning);
      const meta = document.createElement("div");
      appendText(meta, "small", `${window.JLPT.levelConfig(word.level).label} · 공부하겠음 ${window.JLPT.studyCount(word.id)}회`);
      if (word.kanji_note) appendText(meta, "small", word.kanji_note);
      row.append(meta);
      list.append(row);
    });
  }

  function startReview() {
    const queue = window.JLPT.shuffle(window.JLPT.reviewWords()).slice(0, 150);
    showView("study");
    study.start({
      queue,
      label: "모르는 단어 회독",
      onComplete(result) {
        study.showComplete({
          eyebrow: "모르는 단어",
          title: "회독 완료",
          message: `${result.total}개 중 알고있음 ${result.knownCount}회 · 공부하겠음 ${result.studyCount}회`,
          actions: [
            { label: "다시 회독", onClick: startReview },
            {
              label: "저장 목록",
              onClick() {
                renderReviewList();
                showView("review");
              },
            },
          ],
        });
      },
    });
  }

  const study = window.JLPTStudy.create($("#studyMount"), {
    homeHref: "../",
    backLabel: "저장 목록",
    onBack() {
      renderReviewList();
      showView("review");
    },
  });

  $("#startReviewBtn").addEventListener("click", startReview);
  renderReviewList();
  showView("review");
})();
