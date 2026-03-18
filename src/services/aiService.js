const aiService = (() => {
  const { storageKeys } = window.appConfig;

  function getAiEnabled() {
    return localStorage.getItem(storageKeys.aiEnabled) === "true";
  }

  function setAiEnabled(enabled) {
    localStorage.setItem(storageKeys.aiEnabled, enabled ? "true" : "false");
  }

  function getApiKey() {
    return localStorage.getItem(storageKeys.aiApiKey) || "";
  }

  function setApiKey(apiKey) {
    localStorage.setItem(storageKeys.aiApiKey, apiKey.trim());
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(storageKeys.aiCache);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveCache(cache) {
    localStorage.setItem(storageKeys.aiCache, JSON.stringify(cache));
  }

  function buildGeminiUrl(apiKey) {
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  async function callGemini(prompt, cacheKey) {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        ok: false,
        error: "Missing Gemini API key. Please set it in AI settings.",
      };
    }

    const cache = loadCache();
    if (cache[cacheKey]?.text) {
      return { ok: true, text: cache[cacheKey].text, cached: true };
    }

    try {
      const response = await fetch(buildGeminiUrl(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        return { ok: false, error: `Gemini API error: ${response.status}` };
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter(Boolean)
          .join("\n") || "";

      if (!text) {
        return { ok: false, error: "Gemini returned empty content." };
      }

      cache[cacheKey] = { text, ts: Date.now() };
      saveCache(cache);
      return { ok: true, text, cached: false };
    } catch (error) {
      return { ok: false, error: `Network error: ${error.message}` };
    }
  }

  function fetchExampleSentence(card) {
    const word = card.kanji || card.kana;
    const prompt = `Create a simple Japanese sentence using the word ${word} with meaning ${card.meaning}. Include translation.`;
    return callGemini(prompt, `example:${card.kana}|${card.meaning}`);
  }

  function fetchMnemonic(card) {
    const word = card.kanji || card.kana;
    const prompt = `Create a short mnemonic to remember the word ${word} meaning ${card.meaning}.`;
    return callGemini(prompt, `mnemonic:${card.kana}|${card.meaning}`);
  }

  function fetchContextStory(words) {
    const selected = words.slice(0, 5);
    const prompt = `Write exactly 3 Japanese sentences using these words: ${selected.join(", ")}. Add Vietnamese translation.`;
    return callGemini(prompt, `story:${selected.join("|")}`);
  }

  return {
    getAiEnabled,
    setAiEnabled,
    getApiKey,
    setApiKey,
    fetchExampleSentence,
    fetchMnemonic,
    fetchContextStory,
  };
})();

window.aiService = aiService;
