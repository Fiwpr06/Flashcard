const flashcardUI = (() => {
  function renderCard(
    cardElements,
    card,
    status,
    normalizeStatus,
    isVietnameseFront = false,
  ) {
    if (isVietnameseFront) {
      const japaneseMain = card.kanji || card.kana || "";
      const japaneseSub = card.kanji && card.kana ? card.kana : "";

      cardElements.kanjiEl.textContent = card.meaning || "";
      cardElements.kanjiEl.style.display = card.meaning ? "" : "none";
      cardElements.kanaEl.textContent = "";
      cardElements.kanaEl.style.display = "none";

      cardElements.romajiEl.textContent = japaneseMain;
      cardElements.romajiEl.style.display = japaneseMain ? "" : "none";
      cardElements.meaningEl.textContent = japaneseSub;
      cardElements.meaningEl.style.display = japaneseSub ? "" : "none";
    } else {
      cardElements.kanjiEl.textContent = card.kanji || "";
      cardElements.kanjiEl.style.display = card.kanji ? "" : "none";
      cardElements.kanaEl.textContent = card.kana;
      cardElements.kanaEl.style.display = "";
      cardElements.romajiEl.textContent = card.romaji;
      cardElements.romajiEl.style.display = "";
      cardElements.meaningEl.textContent = card.meaning;
      cardElements.meaningEl.style.display = "";
    }

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
