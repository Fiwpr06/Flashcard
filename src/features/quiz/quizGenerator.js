const quizGenerator = (() => {
  function pickRandomWrongChoices(deck, correctMeaning, count) {
    const filtered = deck.filter((item) => item.meaning !== correctMeaning);
    return helpers.shuffleArray(filtered).slice(0, count);
  }

  function generateQuiz(deck, count = 8) {
    if (!Array.isArray(deck) || deck.length < 4) {
      return {
        ok: false,
        error: "Need at least 4 cards to generate a quiz.",
        questions: [],
      };
    }

    const selected = helpers
      .shuffleArray(deck)
      .slice(0, Math.min(deck.length, count));
    const questions = selected.map((card, index) => {
      const wrong = pickRandomWrongChoices(deck, card.meaning, 3);
      const choices = helpers.shuffleArray([
        { text: card.meaning, correct: true },
        ...wrong.map((item) => ({ text: item.meaning, correct: false })),
      ]);

      return {
        id: `${card.kana}-${index}`,
        prompt: card.kanji || card.kana,
        promptKana: card.kana,
        correctMeaning: card.meaning,
        choices,
      };
    });

    return { ok: true, questions };
  }

  return { generateQuiz };
})();

window.quizGenerator = quizGenerator;
