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

  function statusClass(level, deck) {
    if (window.JLPT.isInProgress(level, deck)) return "running";
    if (window.JLPT.isCompleted(level, deck)) return "completed";
    return "pending";
  }

  function render() {
    $("#totalWords").textContent = window.JLPT.words.length;
    $("#savedWords").textContent = window.JLPT.reviewIds.size;
    $("#completedWords").textContent = `${window.JLPT.completedCount()}/${window.JLPT.totalDeckCount()}`;
    $("#studyClicks").textContent = window.JLPT.totalStudyCount();
    $("#reviewCount").textContent = `${window.JLPT.reviewIds.size}개`;
    $("#grammarPatternCount").textContent = `${(window.JLPT_GRAMMAR || []).length}개`;

    const grid = $("#levelCards");
    grid.replaceChildren();
    window.JLPT.LEVELS.forEach((level) => {
      const decks = window.JLPT.deckNumbers(level.key);
      const card = document.createElement("article");
      card.className = "level-card";
      appendText(card, "p", `${window.JLPT.levelWords(level.key).length}개 · ${decks.length}장`, "eyebrow");
      appendText(card, "h2", level.label);
      appendText(
        card,
        "p",
        `${window.JLPT.completedCount(level.key)}/${decks.length}장 완료 · 공부 ${window.JLPT.totalStudyCount(level.key)}회`,
        "level-card-meta"
      );

      const statuses = document.createElement("div");
      statuses.className = "mini-status-row";
      decks.forEach((deck) => {
        const badge = document.createElement("span");
        badge.className = `mini-status ${statusClass(level.key, deck)}`;
        badge.textContent = deck;
        badge.title = `${level.label} ${deck}장`;
        statuses.append(badge);
      });
      card.append(statuses);

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const levelLink = document.createElement("a");
      levelLink.className = "primary-link";
      levelLink.href = `${level.slug}/`;
      levelLink.textContent = "단계 선택";
      const testLink = document.createElement("a");
      testLink.className = "secondary-link";
      testLink.href = `${level.slug}/?mode=test`;
      testLink.textContent = "랜덤 테스트";
      actions.append(levelLink, testLink);
      card.append(actions);
      grid.append(card);
    });
  }

  render();
})();
