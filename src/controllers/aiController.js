const aiController = (() => {
  function canUseAi() {
    return window.aiService.getAiEnabled();
  }

  function saveAiSettings(enabled, apiKey) {
    window.aiService.setAiEnabled(enabled);
    if (apiKey && apiKey.trim()) {
      window.aiService.setApiKey(apiKey.trim());
    }
  }

  async function fetchExampleSentence(card) {
    return window.aiService.fetchExampleSentence(card);
  }

  async function fetchMnemonic(card) {
    return window.aiService.fetchMnemonic(card);
  }

  async function fetchContextStory(words) {
    return window.aiService.fetchContextStory(words);
  }

  return {
    canUseAi,
    saveAiSettings,
    fetchExampleSentence,
    fetchMnemonic,
    fetchContextStory,
  };
})();

window.aiController = aiController;
