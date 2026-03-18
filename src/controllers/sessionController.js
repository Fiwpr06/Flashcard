const sessionController = (() => {
  function createInitialSessionStats(total = 0) {
    return {
      total,
      remembered: 0,
      forgot: 0,
      rememberedKeys: [],
      forgottenKeys: [],
      learnedWords: [],
      recorded: false,
    };
  }

  function finalizeSession(stats) {
    return {
      ...stats,
      recorded: true,
    };
  }

  return {
    createInitialSessionStats,
    finalizeSession,
  };
})();

window.sessionController = sessionController;
