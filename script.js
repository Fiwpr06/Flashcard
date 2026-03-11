// === DỮ LIỆU TỪ VỰNG (tự động đọc từ Data.txt) ===
let vocabData = {};

function parseDataTxt(text) {
  const data = {};
  let currentTopic = null;
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const topicMatch = trimmed.match(/^===\s*Chủ đề:\s*(.+?)\s*===$/);
    if (topicMatch) {
      currentTopic = topicMatch[1];
      data[currentTopic] = [];
      continue;
    }
    if (currentTopic) {
      const parts = trimmed.split(" - ");
      if (parts.length >= 3) {
        const kana = parts[0].trim();
        const romaji = parts[1].trim();
        const meaning = parts.slice(2).join(" - ").trim();
        data[currentTopic].push({ kana, romaji, meaning });
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
let currentCards = [];
let currentIndex = 0;
let isFlipped = false;
let isReviewMode = false;

// === DOM ===
const topicCheckboxes = document.getElementById("topicCheckboxes");
const flashcard = document.getElementById("flashcard");
const flashcardContainer = document.getElementById("flashcard-container");
const kanaEl = document.getElementById("kana");
const romajiEl = document.getElementById("romaji");
const meaningEl = document.getElementById("meaning");
const progressEl = document.getElementById("progress");
const randomCheckbox = document.getElementById("randomMode");
const markButtonsEl = document.getElementById("markButtons");
const reviewBadge = document.getElementById("reviewBadge");
const selectAllBtn = document.getElementById("selectAllBtn");

// Stats
const statTotal = document.getElementById("statTotal");
const statKnown = document.getElementById("statKnown");
const statUnknown = document.getElementById("statUnknown");
const statPercent = document.getElementById("statPercent");

// === INIT ===
async function init() {
  await loadVocabData();
  buildTopicCheckboxes();
  // Default: select all topics
  const topics = Object.keys(vocabData);
  topics.forEach((t) => selectedTopics.add(t));
  updateCheckboxUI();
  rebuildCards();
  updateStats();
}

function buildTopicCheckboxes() {
  const topics = Object.keys(vocabData);
  topicCheckboxes.innerHTML = "";
  topics.forEach((topic) => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = topic;
    cb.checked = true;
    cb.addEventListener("change", onTopicCheck);
    const count = vocabData[topic].length;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(topic + " (" + count + ")"));
    label.classList.add("checked");
    topicCheckboxes.appendChild(label);
  });
}

function onTopicCheck(e) {
  const topic = e.target.value;
  if (e.target.checked) {
    selectedTopics.add(topic);
    e.target.parentElement.classList.add("checked");
  } else {
    selectedTopics.delete(topic);
    e.target.parentElement.classList.remove("checked");
  }
  isReviewMode = false;
  reviewBadge.style.display = "none";
  rebuildCards();
  updateStats();
}

function toggleSelectAll() {
  const topics = Object.keys(vocabData);
  const allSelected = selectedTopics.size === topics.length;

  if (allSelected) {
    // Deselect all
    selectedTopics.clear();
  } else {
    // Select all
    topics.forEach((t) => selectedTopics.add(t));
  }
  updateCheckboxUI();
  isReviewMode = false;
  reviewBadge.style.display = "none";
  rebuildCards();
  updateStats();
}

function updateCheckboxUI() {
  const labels = topicCheckboxes.querySelectorAll("label");
  labels.forEach((label) => {
    const cb = label.querySelector("input");
    cb.checked = selectedTopics.has(cb.value);
    label.classList.toggle("checked", cb.checked);
  });
  // Update button text
  const topics = Object.keys(vocabData);
  selectAllBtn.textContent =
    selectedTopics.size === topics.length ? "Bỏ chọn tất cả" : "Chọn tất cả";
}

// === BUILD CARDS FROM SELECTED TOPICS ===
function rebuildCards() {
  currentCards = [];
  selectedTopics.forEach((topic) => {
    if (vocabData[topic]) {
      currentCards = currentCards.concat(vocabData[topic]);
    }
  });

  if (randomCheckbox.checked) {
    shuffle(currentCards);
  }

  currentIndex = 0;
  isFlipped = false;
  showCard();
  updateSelectAllBtn();
}

function updateSelectAllBtn() {
  const topics = Object.keys(vocabData);
  selectAllBtn.textContent =
    selectedTopics.size === topics.length ? "Bỏ chọn tất cả" : "Chọn tất cả";
}

// === DISPLAY ===
function showCard() {
  // Hide mark buttons
  markButtonsEl.classList.remove("visible");

  if (currentCards.length === 0) {
    kanaEl.textContent = "—";
    romajiEl.textContent = "Chọn chủ đề để bắt đầu";
    meaningEl.textContent = "—";
    progressEl.textContent = "Card 0 / 0";
    flashcard.classList.remove("flipped");
    isFlipped = false;
    return;
  }

  // Unflip
  isFlipped = false;
  flashcard.classList.remove("flipped");

  const card = currentCards[currentIndex];
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
  selectedTopics.forEach((topic) => {
    if (vocabData[topic]) {
      vocabData[topic].forEach((card) => {
        total++;
        const status = progress[cardKey(card)];
        if (status === "known") known++;
        else if (status === "unknown") unknown++;
      });
    }
  });

  statTotal.textContent = total;
  statKnown.textContent = known;
  statUnknown.textContent = unknown;
  const percent = total > 0 ? Math.round((known / total) * 100) : 0;
  statPercent.textContent = percent + "%";
}

// === RESET ===
function resetProgress() {
  if (!confirm("Xóa toàn bộ tiến độ học? Hành động này không thể hoàn tác."))
    return;
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
