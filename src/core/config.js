const appConfig = {
  dataFilePath: "Data.txt",
  storageKeys: {
    progress: "jp_flashcard_progress",
    aiEnabled: "jp_ai_enabled",
    aiApiKey: "jp_gemini_api_key",
    aiCache: "jp_ai_cache",
    revengeHistory: "jp_session_history",
  },
  status: {
    new: "new",
    remembered: "remembered",
    forgot: "forgot",
  },
  swipe: {
    horizontalThreshold: 110,
    verticalThreshold: 95,
  },
};

window.appConfig = appConfig;
