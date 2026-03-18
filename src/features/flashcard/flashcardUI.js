const flashcardUI = (() => {
  function renderCard(cardElements, card, status, normalizeStatus) {
    cardElements.kanjiEl.textContent = card.kanji || "";
    cardElements.kanjiEl.style.display = card.kanji ? "" : "none";
    cardElements.kanaEl.textContent = card.kana;
    cardElements.romajiEl.textContent = card.romaji;
    cardElements.meaningEl.textContent = card.meaning;

    renderCardStatusBadge(cardElements, status, normalizeStatus);
  }

  function renderCardStatusBadge(cardElements, status, normalizeStatus) {
    document
      .querySelectorAll(".card-status-badge")
      .forEach((badge) => badge.remove());

    const normalized = normalizeStatus(status);
    const badge = document.createElement("div");

    if (normalized === appConfig.status.remembered) {
      badge.className = "card-status-badge status-remembered";
      badge.textContent = "Remembered";
    } else if (normalized === appConfig.status.forgot) {
      badge.className = "card-status-badge status-forgot";
      badge.textContent = "Forgot";
    } else {
      badge.className = "card-status-badge status-new";
      badge.textContent = "New";
    }

    cardElements.frontFace.appendChild(badge);
    cardElements.backFace.appendChild(badge.cloneNode(true));
  }

  return {
    renderCard,
    renderCardStatusBadge,
  };
})();

window.flashcardUI = flashcardUI;
