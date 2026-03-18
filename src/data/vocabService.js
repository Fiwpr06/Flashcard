const vocabService = (() => {
  function parseDataTxt(text) {
    const data = {};
    let currentUnit = null;
    let currentTopic = null;
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const unitMatch = trimmed.match(/^\+{1,3}\s*(.+?)\s*\+{1,3}$/);
      if (unitMatch) {
        currentUnit = unitMatch[1].trim();
        if (!data[currentUnit]) data[currentUnit] = {};
        currentTopic = null;
        continue;
      }

      const topicMatch = trimmed.match(/^===\s*Chủ đề:\s*(.+?)\s*===$/);
      if (topicMatch) {
        currentTopic = topicMatch[1];
        if (!currentUnit) {
          currentUnit = "Khác";
          if (!data[currentUnit]) data[currentUnit] = {};
        }
        if (!data[currentUnit][currentTopic])
          data[currentUnit][currentTopic] = [];
        continue;
      }

      if (!currentUnit || !currentTopic) continue;

      const parts = trimmed.split(" - ");
      if (parts.length < 3) continue;

      const raw = parts[0].trim();
      let kanji = "";
      let kana = raw;
      if (raw.includes(" / ")) {
        const split = raw.split(" / ");
        kanji = split[0].trim();
        kana = split[1].trim();
      }

      const romaji = parts[1].trim();
      const meaning = parts.slice(2).join(" - ").trim();
      data[currentUnit][currentTopic].push({ kanji, kana, romaji, meaning });
    }

    return data;
  }

  async function fetchVocabData(path) {
    const response = await fetch(path);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseDataTxt(text);
  }

  function allTopicKeys(vocabData) {
    const keys = [];
    for (const unit of Object.keys(vocabData)) {
      for (const topic of Object.keys(vocabData[unit])) {
        keys.push(`${unit}|${topic}`);
      }
    }
    return keys;
  }

  function getCardsForKey(vocabData, key) {
    const [unit, topic] = key.split("|");
    return vocabData[unit] && vocabData[unit][topic]
      ? vocabData[unit][topic]
      : [];
  }

  return {
    parseDataTxt,
    fetchVocabData,
    allTopicKeys,
    getCardsForKey,
  };
})();

window.vocabService = vocabService;
