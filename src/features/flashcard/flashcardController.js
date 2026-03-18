const flashcardController = (() => {
  function buildDeck(selectedTopics, vocabData, getCardsForKey) {
    let cards = [];
    selectedTopics.forEach((key) => {
      cards = cards.concat(getCardsForKey(vocabData, key));
    });
    return cards;
  }

  function nextCard(currentIndex, total) {
    if (!total) return 0;
    return (currentIndex + 1) % total;
  }

  function prevCard(currentIndex, total) {
    if (!total) return 0;
    return (currentIndex - 1 + total) % total;
  }

  function markRemembered(card, sessionStats, getCardKey) {
    const key = getCardKey(card);
    const remembered = new Set(sessionStats.rememberedKeys || []);
    const forgot = new Set(sessionStats.forgottenKeys || []);
    const learned = new Set(sessionStats.learnedWords || []);

    remembered.add(key);
    forgot.delete(key);
    learned.add(card.kanji || card.kana);

    return {
      ...sessionStats,
      rememberedKeys: Array.from(remembered),
      forgottenKeys: Array.from(forgot),
      learnedWords: Array.from(learned),
      remembered: remembered.size,
      forgot: forgot.size,
    };
  }

  function markForgot(card, sessionStats, getCardKey) {
    const key = getCardKey(card);
    const remembered = new Set(sessionStats.rememberedKeys || []);
    const forgot = new Set(sessionStats.forgottenKeys || []);
    const learned = new Set(sessionStats.learnedWords || []);

    forgot.add(key);
    remembered.delete(key);
    learned.delete(card.kanji || card.kana);

    return {
      ...sessionStats,
      rememberedKeys: Array.from(remembered),
      forgottenKeys: Array.from(forgot),
      learnedWords: Array.from(learned),
      remembered: remembered.size,
      forgot: forgot.size,
    };
  }

  return {
    buildDeck,
    nextCard,
    prevCard,
    markRemembered,
    markForgot,
  };
})();

window.flashcardController = flashcardController;
