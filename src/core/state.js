const appState = (() => {
  let state = {
    vocabData: {},
    selectedTopics: [],
    activeUnit: "all",
    currentCards: [],
    currentCardIndex: 0,
    isVietnameseFront: false,
    isFlipped: false,
    isTransitioning: false,
    isRevengeMode: false,
    sessionStats: {
      total: 0,
      remembered: 0,
      forgot: 0,
      rememberedKeys: [],
      forgottenKeys: [],
      learnedWords: [],
      recorded: false,
    },
    quiz: {
      active: false,
      questions: [],
      index: 0,
      score: 0,
      locked: false,
    },
  };

  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    state = {
      ...state,
      ...patch,
    };
    listeners.forEach((listener) => listener(state));
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState,
    setState,
    subscribe,
  };
})();

window.appState = appState;
