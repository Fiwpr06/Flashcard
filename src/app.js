const app = (() => {
  const { status, dataFilePath } = window.appConfig;
  const { normalizeStatus, getCardKey, shuffleArray } = window.helpers;
  const FLASHCARD_MODE_KEY = "jp_flashcard_vietnamese_front";

  let swipeInstance = null;
  let audioContext = null;

  const dom = {
    unitTabs: document.getElementById("unitTabs"),
    topicChips: document.getElementById("topicChips"),
    flashcardContainer: document.getElementById("flashcard-container"),
    flashcard: document.getElementById("flashcard"),
    kanjiEl: document.getElementById("kanji"),
    kanaEl: document.getElementById("kana"),
    romajiEl: document.getElementById("romaji"),
    meaningEl: document.getElementById("meaning"),
    frontFace: document.getElementById("card-front"),
    backFace: document.getElementById("card-back"),
    progressEl: document.getElementById("progress"),
    randomMode: document.getElementById("randomMode"),
    markButtons: document.getElementById("markButtons"),
    reviewBadge: document.getElementById("reviewBadge"),
    sessionSummary: document.getElementById("sessionSummary"),
    summaryTotal: document.getElementById("summaryTotal"),
    summaryRemembered: document.getElementById("summaryRemembered"),
    summaryForgot: document.getElementById("summaryForgot"),
    aiEnabled: document.getElementById("aiEnabled"),
    geminiApiKey: document.getElementById("geminiApiKey"),
    aiResult: document.getElementById("aiResult"),
    storyBox: document.getElementById("storyBox"),
    quizPanel: document.getElementById("quizPanel"),
    quizProgress: document.getElementById("quizProgress"),
    quizQuestion: document.getElementById("quizQuestion"),
    quizChoices: document.getElementById("quizChoices"),
    quizFeedback: document.getElementById("quizFeedback"),
    statTotal: document.getElementById("statTotal"),
    statKnown: document.getElementById("statKnown"),
    statUnknown: document.getElementById("statUnknown"),
    statPercent: document.getElementById("statPercent"),
  };

  function getState() {
    return appState.getState();
  }

  function setState(patch) {
    return appState.setState(patch);
  }

  function getSelectedCards(selectedTopics, vocabData) {
    return flashcardController.buildDeck(
      selectedTopics,
      vocabData,
      vocabService.getCardsForKey,
    );
  }

  async function initialize() {
    const vocabData = await vocabService.fetchVocabData(dataFilePath);
    setState({
      vocabData,
      isVietnameseFront: localStorage.getItem(FLASHCARD_MODE_KEY) === "1",
    });

    setupAiSettingsUI();
    buildNav();
    setupSwipe();
    selectUnit("all");
    updateStats();
    bindKeyboard();
  }

  function setupAiSettingsUI() {
    dom.aiEnabled.checked = aiService.getAiEnabled();
    dom.geminiApiKey.value = aiService.getApiKey();
  }

  function saveAiSettings() {
    aiController.saveAiSettings(dom.aiEnabled.checked, dom.geminiApiKey.value);
    renderers.renderMessage(dom.aiResult, "AI settings saved.");
  }

  function allTopicKeys() {
    return vocabService.allTopicKeys(getState().vocabData);
  }

  function buildNav() {
    const state = getState();
    dom.unitTabs.innerHTML = "";

    const allTab = document.createElement("button");
    allTab.className = "unit-tab active";
    allTab.textContent = "All";
    allTab.addEventListener("click", () => selectUnit("all"));
    dom.unitTabs.appendChild(allTab);

    Object.keys(state.vocabData).forEach((unit) => {
      const tab = document.createElement("button");
      tab.className = "unit-tab";
      tab.textContent = unit;
      tab.addEventListener("click", () => selectUnit(unit));
      dom.unitTabs.appendChild(tab);
    });
  }

  function selectUnit(unit) {
    const state = getState();
    dom.unitTabs.querySelectorAll(".unit-tab").forEach((tab) => {
      tab.classList.toggle(
        "active",
        (unit === "all" && tab.textContent === "All") ||
          tab.textContent === unit,
      );
    });

    let selectedTopics = [];
    if (unit === "all") {
      selectedTopics = allTopicKeys();
    } else {
      selectedTopics = Object.keys(state.vocabData[unit] || {}).map(
        (topic) => `${unit}|${topic}`,
      );
    }

    setState({ activeUnit: unit, selectedTopics, isRevengeMode: false });
    dom.reviewBadge.style.display = "none";
    buildTopicChips();
    rebuildCards();
    updateStats();
  }

  function buildTopicChips() {
    const state = getState();
    dom.topicChips.innerHTML = "";

    if (state.activeUnit === "all") {
      const merged = {};
      Object.keys(state.vocabData).forEach((unit) => {
        Object.keys(state.vocabData[unit]).forEach((topic) => {
          if (!merged[topic]) merged[topic] = [];
          merged[topic].push(`${unit}|${topic}`);
        });
      });

      Object.keys(merged).forEach((topic) => {
        const keys = merged[topic];
        const count = keys.reduce(
          (sum, key) =>
            sum + vocabService.getCardsForKey(state.vocabData, key).length,
          0,
        );
        const chip = document.createElement("button");
        chip.className = "topic-chip active";
        chip.textContent = `${topic} (${count})`;
        chip.addEventListener("click", () => toggleTopic(keys, chip));
        dom.topicChips.appendChild(chip);
      });
      return;
    }

    const unit = state.activeUnit;
    Object.keys(state.vocabData[unit] || {}).forEach((topic) => {
      const key = `${unit}|${topic}`;
      const chip = document.createElement("button");
      chip.className = "topic-chip active";
      chip.textContent = `${topic} (${vocabService.getCardsForKey(state.vocabData, key).length})`;
      chip.addEventListener("click", () => toggleTopic([key], chip));
      dom.topicChips.appendChild(chip);
    });
  }

  function toggleTopic(keys, chip) {
    const state = getState();
    const selected = new Set(state.selectedTopics);
    const allActive = keys.every((key) => selected.has(key));

    if (allActive) {
      keys.forEach((key) => selected.delete(key));
      chip.classList.remove("active");
    } else {
      keys.forEach((key) => selected.add(key));
      chip.classList.add("active");
    }

    setState({ selectedTopics: Array.from(selected), isRevengeMode: false });
    dom.reviewBadge.style.display = "none";
    rebuildCards();
    updateStats();
  }

  function rebuildCards() {
    const state = getState();
    let cards = getSelectedCards(state.selectedTopics, state.vocabData);
    if (dom.randomMode.checked) cards = shuffleArray(cards);

    const sessionStats = sessionController.createInitialSessionStats(
      cards.length,
    );
    setState({
      currentCards: cards,
      currentCardIndex: 0,
      isFlipped: false,
      isTransitioning: false,
      sessionStats,
    });

    closeSmartQuiz();
    hideSummary();
    renderCurrentCard();
  }

  function getCurrentCard() {
    const state = getState();
    if (!state.currentCards.length) return null;
    return state.currentCards[state.currentCardIndex];
  }

  function renderCurrentCard() {
    const state = getState();
    resetSwipeVisuals();
    dom.markButtons.classList.remove("visible");
    dom.flashcard.style.transition = "";
    dom.flashcard.style.transform = "";
    dom.flashcard.style.opacity = "";

    if (!state.currentCards.length) {
      showSummary();
      return;
    }

    dom.flashcardContainer.style.display = "block";
    dom.sessionSummary.style.display = "none";
    dom.flashcard.classList.remove("flipped");
    setState({ isFlipped: false });

    const card = getCurrentCard();
    const statusValue = progressService.fetchCardStatus(
      card,
      getCardKey,
      normalizeStatus,
    );

    flashcardUI.renderCard(
      {
        kanjiEl: dom.kanjiEl,
        kanaEl: dom.kanaEl,
        romajiEl: dom.romajiEl,
        meaningEl: dom.meaningEl,
        frontFace: dom.frontFace,
        backFace: dom.backFace,
      },
      card,
      statusValue,
      normalizeStatus,
      state.isVietnameseFront,
    );

    const totalInSession =
      state.sessionStats.total || state.currentCards.length;
    const completedInSession =
      (state.sessionStats.remembered || 0) + (state.sessionStats.forgot || 0);
    const currentInSession =
      totalInSession > 0 ? Math.min(totalInSession, completedInSession + 1) : 0;

    renderers.renderProgress(dom.progressEl, currentInSession, totalInSession);

    dom.flashcardContainer.classList.remove("animate");
    void dom.flashcardContainer.offsetWidth;
    dom.flashcardContainer.classList.add("animate");
  }

  function flipCard() {
    const state = getState();
    if (!state.currentCards.length || state.isTransitioning) return;
    const next = !state.isFlipped;
    setState({ isFlipped: next });
    dom.flashcard.classList.toggle("flipped", next);
    dom.markButtons.classList.toggle("visible", next);
  }

  function nextCard() {
    const state = getState();
    if (!state.currentCards.length) return;
    const nextIndex = flashcardController.nextCard(
      state.currentCardIndex,
      state.currentCards.length,
    );
    setState({ currentCardIndex: nextIndex });
    renderCurrentCard();
  }

  function prevCard() {
    const state = getState();
    if (!state.currentCards.length) return;
    const nextIndex = flashcardController.prevCard(
      state.currentCardIndex,
      state.currentCards.length,
    );
    setState({ currentCardIndex: nextIndex });
    renderCurrentCard();
  }

  function shuffleCards() {
    const state = getState();
    const cards = shuffleArray(state.currentCards);
    setState({ currentCards: cards, currentCardIndex: 0 });
    renderCurrentCard();
  }

  function toggleMode() {
    if (dom.randomMode.checked) {
      shuffleCards();
    } else {
      rebuildCards();
    }
  }

  function toggleVietnameseFrontMode() {
    const nextMode = !getState().isVietnameseFront;
    localStorage.setItem(FLASHCARD_MODE_KEY, nextMode ? "1" : "0");
    setState({ isVietnameseFront: nextMode, isFlipped: false });
    renderCurrentCard();
  }

  function updateSessionStats(card, markStatus) {
    const state = getState();
    const updated =
      markStatus === status.remembered
        ? flashcardController.markRemembered(
            card,
            state.sessionStats,
            getCardKey,
          )
        : flashcardController.markForgot(card, state.sessionStats, getCardKey);
    setState({ sessionStats: updated });
  }

  function commitCardDecision(markStatus, direction, animateOut) {
    const state = getState();
    if (!state.currentCards.length || state.isTransitioning) return;

    const card = getCurrentCard();
    setState({ isTransitioning: true });

    progressService.markCardStatus(
      card,
      markStatus,
      getCardKey,
      normalizeStatus,
    );
    updateSessionStats(card, markStatus);
    updateStats();

    if (markStatus === status.remembered) {
      playRememberedFeedback();
    } else {
      playForgotFeedback();
    }

    if (animateOut) {
      const outX =
        direction === "right" ? window.innerWidth : -window.innerWidth;
      const outRotate = direction === "right" ? 18 : -18;
      dom.flashcard.style.transition =
        "transform 220ms ease, opacity 220ms ease";
      dom.flashcard.style.transform = `translateX(${outX}px) rotate(${outRotate}deg)`;
      dom.flashcard.style.opacity = "0";
    }

    setTimeout(() => {
      const latest = getState();
      const cards = [...latest.currentCards];
      cards.splice(latest.currentCardIndex, 1);
      const nextIndex = cards.length
        ? Math.min(latest.currentCardIndex, cards.length - 1)
        : 0;
      setState({
        currentCards: cards,
        currentCardIndex: nextIndex,
        isTransitioning: false,
      });
      if (!cards.length) {
        showSummary();
        return;
      }
      renderCurrentCard();
    }, 240);
  }

  function markCard(statusValue) {
    if (statusValue !== status.remembered && statusValue !== status.forgot)
      return;
    const direction = statusValue === status.remembered ? "right" : "left";
    commitCardDecision(statusValue, direction, true);
  }

  function setupSwipe() {
    swipeInstance = useSwipe.create(dom.flashcardContainer, dom.flashcard, {
      threshold: appConfig.swipe.horizontalThreshold,
      verticalThreshold: appConfig.swipe.verticalThreshold,
      onDrag: ({ ratio, direction }) => {
        const strength = helpers.clamp(ratio, 0, 1);
        dom.flashcardContainer.style.setProperty(
          "--swipe-strength",
          `${strength}`,
        );
        dom.flashcardContainer.classList.toggle(
          "swiping-right",
          direction === "right",
        );
        dom.flashcardContainer.classList.toggle(
          "swiping-left",
          direction === "left",
        );
        dom.flashcardContainer.classList.toggle(
          "swiping-up",
          direction === "up",
        );
      },
      onReset: resetSwipeVisuals,
      onSwipe: (direction) => {
        if (direction === "up") {
          flipCard();
          swipeInstance.reset();
          return;
        }
        const markStatus =
          direction === "right" ? status.remembered : status.forgot;
        commitCardDecision(markStatus, direction, false);
      },
      onTap: () => {
        if (!getState().isTransitioning) flipCard();
      },
    });
  }

  function resetSwipeVisuals() {
    dom.flashcardContainer.classList.remove(
      "swiping-right",
      "swiping-left",
      "swiping-up",
    );
    dom.flashcardContainer.style.setProperty("--swipe-strength", "0");
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    return audioContext;
  }

  function playTone({ frequency, durationMs, type = "sine", gain = 0.06 }) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = gain;
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), durationMs);
  }

  function playRememberedFeedback() {
    playTone({ frequency: 880, durationMs: 100 });
    setTimeout(
      () => playTone({ frequency: 1175, durationMs: 120, type: "triangle" }),
      90,
    );
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function playForgotFeedback() {
    playTone({ frequency: 180, durationMs: 120, type: "sawtooth", gain: 0.08 });
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
  }

  function updateStats() {
    const state = getState();
    const progress = progressService.loadProgress(normalizeStatus);
    let total = 0;
    let remembered = 0;
    let forgot = 0;

    state.selectedTopics.forEach((key) => {
      vocabService.getCardsForKey(state.vocabData, key).forEach((card) => {
        total += 1;
        const st = normalizeStatus(progress[getCardKey(card)]);
        if (st === status.remembered) remembered += 1;
        if (st === status.forgot) forgot += 1;
      });
    });

    const percent = total > 0 ? Math.round((remembered / total) * 100) : 0;
    renderers.renderStats(
      {
        total: dom.statTotal,
        remembered: dom.statKnown,
        forgot: dom.statUnknown,
        percent: dom.statPercent,
      },
      { total, remembered, forgot, percent },
    );
  }

  function recordSessionIfNeeded() {
    const state = getState();
    if (state.sessionStats.recorded) return;

    revengeMode.pushSession({
      rememberedKeys: state.sessionStats.rememberedKeys,
      forgottenKeys: state.sessionStats.forgottenKeys,
    });

    setState({
      sessionStats: sessionController.finalizeSession(state.sessionStats),
    });
  }

  function maybeCelebratePerfectTopic() {
    const stats = getState().sessionStats;
    if (
      stats.total > 0 &&
      stats.forgot === 0 &&
      typeof confetti === "function"
    ) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
      setTimeout(
        () => confetti({ particleCount: 80, spread: 95, origin: { y: 0.6 } }),
        180,
      );
    }
  }

  async function maybeGenerateContextStory() {
    const stats = getState().sessionStats;
    if (!aiController.canUseAi()) {
      dom.storyBox.textContent =
        "Enable AI features to generate a context story.";
      return;
    }

    if (!stats.learnedWords.length) {
      dom.storyBox.textContent =
        "Remember some cards to generate a context story.";
      return;
    }

    renderers.renderMessage(dom.storyBox, "Generating context story...", true);
    const result = await aiController.fetchContextStory(stats.learnedWords);
    renderers.renderMessage(
      dom.storyBox,
      result.ok ? result.text : result.error,
      false,
    );
  }

  function showSummary() {
    const stats = getState().sessionStats;
    dom.flashcardContainer.style.display = "none";
    dom.markButtons.classList.remove("visible");
    dom.summaryTotal.textContent = String(stats.total);
    dom.summaryRemembered.textContent = String(stats.remembered);
    dom.summaryForgot.textContent = String(stats.forgot);
    dom.progressEl.textContent = `Completed ${stats.total} / ${stats.total}`;
    dom.sessionSummary.style.display = "block";

    recordSessionIfNeeded();
    maybeCelebratePerfectTopic();
    maybeGenerateContextStory();
  }

  function hideSummary() {
    dom.sessionSummary.style.display = "none";
    dom.flashcardContainer.style.display = "block";
    dom.storyBox.textContent = "Context story will appear here.";
    dom.storyBox.classList.remove("loading");
  }

  function restartSession() {
    dom.reviewBadge.style.display = "none";
    setState({ isRevengeMode: false });
    rebuildCards();
  }

  function ensureAiEnabled() {
    if (!aiController.canUseAi()) {
      renderers.renderMessage(
        dom.aiResult,
        "AI is disabled. Enable AI Learning Features first.",
      );
      return false;
    }
    return true;
  }

  async function handleExampleSentence() {
    const card = getCurrentCard();
    if (!card || !ensureAiEnabled()) return;
    renderers.renderMessage(
      dom.aiResult,
      "Generating example sentence...",
      true,
    );
    const result = await aiController.fetchExampleSentence(card);
    renderers.renderMessage(
      dom.aiResult,
      result.ok ? result.text : result.error,
      false,
    );
  }

  async function handleMnemonic() {
    const card = getCurrentCard();
    if (!card || !ensureAiEnabled()) return;
    renderers.renderMessage(dom.aiResult, "Creating mnemonic...", true);
    const result = await aiController.fetchMnemonic(card);
    renderers.renderMessage(
      dom.aiResult,
      result.ok ? result.text : result.error,
      false,
    );
  }

  function openSmartQuiz() {
    const state = getState();
    const deck = getSelectedCards(state.selectedTopics, state.vocabData);
    const generated = quizGenerator.generateQuiz(deck, 8);
    if (!generated.ok) {
      renderers.renderMessage(dom.aiResult, generated.error);
      return;
    }

    setState({
      quiz: {
        active: true,
        questions: generated.questions,
        index: 0,
        score: 0,
        locked: false,
      },
    });

    dom.quizPanel.style.display = "flex";
    renderQuizQuestion();
  }

  function closeSmartQuiz() {
    const quiz = getState().quiz;
    setState({
      quiz: {
        ...quiz,
        active: false,
      },
    });
    dom.quizPanel.style.display = "none";
    dom.quizChoices.innerHTML = "";
    dom.quizFeedback.textContent = "";
  }

  function renderQuizQuestion() {
    const quiz = getState().quiz;
    if (!quiz.active) return;

    if (quiz.index >= quiz.questions.length) {
      dom.quizProgress.textContent = `Finished ${quiz.score} / ${quiz.questions.length}`;
      dom.quizQuestion.textContent = "Quiz complete";
      dom.quizChoices.innerHTML = "";
      dom.quizFeedback.textContent = "Great work!";
      renderers.renderMessage(
        dom.aiResult,
        `Smart Quiz score: ${quiz.score} / ${quiz.questions.length}`,
      );
      return;
    }

    const question = quiz.questions[quiz.index];
    dom.quizProgress.textContent = `Question ${quiz.index + 1} / ${quiz.questions.length}`;
    dom.quizQuestion.textContent = `${question.prompt} (${question.promptKana})`;
    dom.quizFeedback.textContent = "Choose the best meaning.";
    dom.quizChoices.innerHTML = "";

    question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.className = "quiz-choice";
      button.textContent = choice.text;
      button.addEventListener("click", () =>
        answerQuiz(choice.correct, button),
      );
      dom.quizChoices.appendChild(button);
    });
  }

  function answerQuiz(isCorrect, button) {
    const quiz = getState().quiz;
    if (!quiz.active || quiz.locked) return;

    const question = quiz.questions[quiz.index];
    const allButtons = Array.from(
      dom.quizChoices.querySelectorAll(".quiz-choice"),
    );
    allButtons.forEach((btn) => {
      if (btn.textContent === question.correctMeaning)
        btn.classList.add("correct");
    });

    const nextQuiz = { ...quiz, locked: true };
    if (isCorrect) {
      nextQuiz.score += 1;
      button.classList.add("correct");
      dom.quizFeedback.textContent = "Correct!";
      playRememberedFeedback();
    } else {
      button.classList.add("wrong");
      dom.quizFeedback.textContent = "Not quite. Keep going!";
      playForgotFeedback();
    }

    setState({ quiz: nextQuiz });

    setTimeout(() => {
      const updated = getState().quiz;
      setState({
        quiz: {
          ...updated,
          index: updated.index + 1,
          locked: false,
        },
      });
      renderQuizQuestion();
    }, 650);
  }

  function startRevengeDeck() {
    const state = getState();
    const selectedCards = getSelectedCards(
      state.selectedTopics,
      state.vocabData,
    );
    const history = revengeMode.loadSessionHistory();
    const deck = revengeMode.buildRevengeDeck(
      selectedCards,
      history,
      getCardKey,
    );

    if (!deck.length) {
      renderers.renderMessage(
        dom.aiResult,
        "No forgotten cards found in the last 3 sessions.",
      );
      return;
    }

    const cards = dom.randomMode.checked ? shuffleArray(deck) : deck;
    setState({
      isRevengeMode: true,
      currentCards: cards,
      currentCardIndex: 0,
      isFlipped: false,
      isTransitioning: false,
      sessionStats: sessionController.createInitialSessionStats(cards.length),
    });

    dom.reviewBadge.textContent =
      "Revenge Deck: forgotten cards from last 3 sessions";
    dom.reviewBadge.style.display = "block";

    closeSmartQuiz();
    hideSummary();
    renderCurrentCard();
  }

  function resetProgress() {
    if (!confirm("Reset all progress? This action cannot be undone.")) return;
    progressService.clearAll();
    setState({ isRevengeMode: false });
    dom.reviewBadge.style.display = "none";
    rebuildCards();
    updateStats();
    renderers.renderMessage(dom.aiResult, "Progress reset complete.");
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowRight":
          nextCard();
          break;
        case "ArrowLeft":
          prevCard();
          break;
        case "ArrowUp":
          flipCard();
          break;
        case " ":
          event.preventDefault();
          flipCard();
          break;
        case "s":
        case "S":
          shuffleCards();
          break;
      }
    });
  }

  function exposeActions() {
    window.prevCard = prevCard;
    window.flipCard = flipCard;
    window.shuffleCards = shuffleCards;
    window.nextCard = nextCard;
    window.markCard = markCard;
    window.toggleMode = toggleMode;
    window.toggleVietnameseFrontMode = toggleVietnameseFrontMode;
    window.resetProgress = resetProgress;
    window.restartSession = restartSession;
    window.handleExampleSentence = handleExampleSentence;
    window.handleMnemonic = handleMnemonic;
    window.openSmartQuiz = openSmartQuiz;
    window.closeSmartQuiz = closeSmartQuiz;
    window.startRevengeDeck = startRevengeDeck;
    window.saveAiSettings = saveAiSettings;
  }

  async function start() {
    exposeActions();
    await initialize();
  }

  return {
    start,
  };
})();

window.app = app;
