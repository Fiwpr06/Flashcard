// === DỮ LIỆU TỪ VỰNG (tự động đọc từ Data.txt) ===
// vocabData = { "Unit 1": { "Trường học": [...], ... }, "Unit 2": { ... } }
let vocabData = {};

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
    if (currentUnit && currentTopic) {
      const parts = trimmed.split(" - ");
      if (parts.length >= 3) {
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
    }
  }
  return data;
}

async function loadVocabData() {
  const response = await fetch("Data.txt");
  const text = await response.text();
  vocabData = parseDataTxt(text);
}

// Helper: get all unique topic keys "unit|topic"
function allTopicKeys() {
  const keys = [];
  for (const unit of Object.keys(vocabData)) {
    for (const topic of Object.keys(vocabData[unit])) {
      keys.push(unit + "|" + topic);
    }
  }
  return keys;
}

// Helper: get cards for a topic key
function getCardsForKey(key) {
  const [unit, topic] = key.split("|");
  return vocabData[unit] && vocabData[unit][topic]
    ? vocabData[unit][topic]
    : [];
}

// === UNIQUE KEY for each card ===
function cardKey(card) {
  return card.kana + "|" + card.romaji;
}

// === LOCAL STORAGE ===
const STORAGE_KEY = "jp_flashcard_progress";

function loadProgress() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function getCardStatus(card) {
  const progress = loadProgress();
  return progress[cardKey(card)] || null; // null = not reviewed, "known", "unknown"
}

function setCardStatus(card, status) {
  const progress = loadProgress();
  progress[cardKey(card)] = status;
  saveProgress(progress);
}

// === STATE ===
let selectedTopics = new Set();
let activeUnit = "all"; // "all" or a unit name
let currentCards = [];
let currentIndex = 0;
let isFlipped = false;
let isReviewMode = false;

// === DOM ===
const unitTabsEl = document.getElementById("unitTabs");
const topicChipsEl = document.getElementById("topicChips");
const flashcard = document.getElementById("flashcard");
const flashcardContainer = document.getElementById("flashcard-container");
const kanjiEl = document.getElementById("kanji");
const kanaEl = document.getElementById("kana");
const romajiEl = document.getElementById("romaji");
const meaningEl = document.getElementById("meaning");
const progressEl = document.getElementById("progress");
const randomCheckbox = document.getElementById("randomMode");
const markButtonsEl = document.getElementById("markButtons");
const reviewBadge = document.getElementById("reviewBadge");

// Stats
const statTotal = document.getElementById("statTotal");
const statKnown = document.getElementById("statKnown");
const statUnknown = document.getElementById("statUnknown");
const statPercent = document.getElementById("statPercent");

// === INIT ===
async function init() {
  await loadVocabData();
  buildNav();
  selectUnit("all");
  updateStats();
}

// === NAVIGATION ===
function buildNav() {
  // Unit tabs
  unitTabsEl.innerHTML = "";
  const allTab = document.createElement("button");
  allTab.className = "unit-tab active";
  allTab.textContent = "All";
  allTab.addEventListener("click", () => selectUnit("all"));
  unitTabsEl.appendChild(allTab);

  for (const unit of Object.keys(vocabData)) {
    const tab = document.createElement("button");
    tab.className = "unit-tab";
    tab.textContent = unit;
    tab.addEventListener("click", () => selectUnit(unit));
    unitTabsEl.appendChild(tab);
  }
}

function selectUnit(unit) {
  activeUnit = unit;

  // Update active tab
  unitTabsEl.querySelectorAll(".unit-tab").forEach((t) => {
    t.classList.toggle(
      "active",
      (unit === "all" && t.textContent === "All") || t.textContent === unit,
    );
  });

  // Select all topics for this unit
  selectedTopics.clear();
  if (unit === "all") {
    allTopicKeys().forEach((k) => selectedTopics.add(k));
  } else {
    for (const topic of Object.keys(vocabData[unit])) {
      selectedTopics.add(unit + "|" + topic);
    }
  }

  buildTopicChips();
  isReviewMode = false;
  reviewBadge.style.display = "none";
  rebuildCards();
  updateStats();
}

function buildTopicChips() {
  topicChipsEl.innerHTML = "";
  const units = activeUnit === "all" ? Object.keys(vocabData) : [activeUnit];

  if (activeUnit === "all") {
    // Merge same-name topics across units
    const merged = {};
    for (const unit of units) {
      for (const topic of Object.keys(vocabData[unit])) {
        if (!merged[topic]) merged[topic] = [];
        merged[topic].push(unit + "|" + topic);
      }
    }
    for (const topic of Object.keys(merged)) {
      const keys = merged[topic];
      const count = keys.reduce((s, k) => s + getCardsForKey(k).length, 0);
      const chip = document.createElement("button");
      chip.textContent = topic + " (" + count + ")";
      chip.className = "topic-chip active";
      chip.dataset.keys = JSON.stringify(keys);
      chip.addEventListener("click", () => toggleMergedTopic(keys, chip));
      topicChipsEl.appendChild(chip);
    }
  } else {
    for (const topic of Object.keys(vocabData[activeUnit])) {
      const key = activeUnit + "|" + topic;
      const count = vocabData[activeUnit][topic].length;
      const chip = document.createElement("button");
      chip.textContent = topic + " (" + count + ")";
      chip.className = "topic-chip active";
      chip.dataset.keys = JSON.stringify([key]);
      chip.addEventListener("click", () => toggleMergedTopic([key], chip));
      topicChipsEl.appendChild(chip);
    }
  }
}

function toggleMergedTopic(keys, chip) {
  const allActive = keys.every((k) => selectedTopics.has(k));
  if (allActive) {
    keys.forEach((k) => selectedTopics.delete(k));
    chip.classList.remove("active");
  } else {
    keys.forEach((k) => selectedTopics.add(k));
    chip.classList.add("active");
  }
  isReviewMode = false;
  reviewBadge.style.display = "none";
  rebuildCards();
  updateStats();
}

// === BUILD CARDS FROM SELECTED TOPICS ===
function rebuildCards() {
  currentCards = [];
  selectedTopics.forEach((key) => {
    const cards = getCardsForKey(key);
    currentCards = currentCards.concat(cards);
  });

  if (randomCheckbox.checked) {
    shuffle(currentCards);
  }

  currentIndex = 0;
  isFlipped = false;
  showCard();
}

// === DISPLAY ===
function showCard() {
  // Hide mark buttons
  markButtonsEl.classList.remove("visible");

  if (currentCards.length === 0) {
    kanjiEl.textContent = "";
    kanaEl.textContent = "—";
    romajiEl.textContent = "";
    meaningEl.textContent = "Select a topic to start";
    progressEl.textContent = "Card 0 / 0";
    flashcard.classList.remove("flipped");
    isFlipped = false;
    return;
  }

  // Unflip
  isFlipped = false;
  flashcard.classList.remove("flipped");

  const card = currentCards[currentIndex];
  kanjiEl.textContent = card.kanji || "";
  kanjiEl.style.display = card.kanji ? "" : "none";
  kanaEl.textContent = card.kana;
  romajiEl.textContent = card.romaji;
  meaningEl.textContent = card.meaning;

  // Show status badge on front
  const status = getCardStatus(card);
  updateCardBadge(status);

  progressEl.textContent = `Card ${currentIndex + 1} / ${currentCards.length}`;

  // Animate
  flashcardContainer.classList.remove("animate");
  void flashcardContainer.offsetWidth;
  flashcardContainer.classList.add("animate");
}

function updateCardBadge(status) {
  // Remove existing badges
  document.querySelectorAll(".card-status-badge").forEach((b) => b.remove());

  if (status) {
    const badge = document.createElement("div");
    badge.className = "card-status-badge";
    badge.textContent = status === "known" ? "✅" : "❌";

    const frontFace = document.getElementById("card-front");
    frontFace.appendChild(badge);

    const backFace = document.getElementById("card-back");
    const badge2 = badge.cloneNode(true);
    backFace.appendChild(badge2);
  }
}

// === CONTROLS ===
function flipCard() {
  if (currentCards.length === 0) return;
  isFlipped = !isFlipped;
  flashcard.classList.toggle("flipped");

  // Show mark buttons when flipped
  if (isFlipped) {
    markButtonsEl.classList.add("visible");
  } else {
    markButtonsEl.classList.remove("visible");
  }
}

function nextCard() {
  if (currentCards.length === 0) return;

  // Check if we reached the end
  if (currentIndex === currentCards.length - 1) {
    // Check for unknown cards to start review
    const unknownCards = currentCards.filter(
      (c) => getCardStatus(c) === "unknown",
    );
    if (unknownCards.length > 0 && !isReviewMode) {
      startReviewMode(unknownCards);
      return;
    } else if (isReviewMode) {
      // Check again in review mode
      const stillUnknown = currentCards.filter(
        (c) => getCardStatus(c) === "unknown",
      );
      if (stillUnknown.length > 0) {
        startReviewMode(stillUnknown);
        return;
      } else {
        // All learned!
        isReviewMode = false;
        reviewBadge.style.display = "none";
      }
    }
  }

  currentIndex = (currentIndex + 1) % currentCards.length;
  showCard();
}

function prevCard() {
  if (currentCards.length === 0) return;
  currentIndex = (currentIndex - 1 + currentCards.length) % currentCards.length;
  showCard();
}

function shuffleCards() {
  shuffle(currentCards);
  currentIndex = 0;
  showCard();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function toggleMode() {
  if (randomCheckbox.checked) {
    shuffle(currentCards);
    currentIndex = 0;
    showCard();
  } else {
    rebuildCards();
  }
}

// === MARK CARD ===
function markCard(status) {
  if (currentCards.length === 0) return;
  const card = currentCards[currentIndex];
  setCardStatus(card, status);
  updateCardBadge(status);
  updateStats();

  // Auto advance after marking
  setTimeout(() => {
    nextCard();
  }, 300);
}

// === REVIEW MODE ===
function startReviewMode(unknownCards) {
  isReviewMode = true;
  currentCards = [...unknownCards];
  if (randomCheckbox.checked) {
    shuffle(currentCards);
  }
  currentIndex = 0;
  reviewBadge.style.display = "block";
  showCard();
}

// === STATS ===
function updateStats() {
  const progress = loadProgress();
  let total = 0;
  let known = 0;
  let unknown = 0;

  // Count only from selected topics
  selectedTopics.forEach((key) => {
    const cards = getCardsForKey(key);
    cards.forEach((card) => {
      total++;
      const status = progress[cardKey(card)];
      if (status === "known") known++;
      else if (status === "unknown") unknown++;
    });
  });

  statTotal.textContent = total;
  statKnown.textContent = known;
  statUnknown.textContent = unknown;
  const percent = total > 0 ? Math.round((known / total) * 100) : 0;
  statPercent.textContent = percent + "%";
}

// === RESET ===
function resetProgress() {
  if (!confirm("Reset all progress? This action cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEY);
  isReviewMode = false;
  reviewBadge.style.display = "none";
  rebuildCards();
  updateStats();
}

// === KEYBOARD SHORTCUTS ===
document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowRight":
      nextCard();
      break;
    case "ArrowLeft":
      prevCard();
      break;
    case " ":
      e.preventDefault();
      flipCard();
      break;
    case "s":
    case "S":
      shuffleCards();
      break;
  }
});

// === START ===
init();
