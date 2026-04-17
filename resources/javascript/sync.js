// # CLOUD SYNC FOR EXERCISE PROGRESS #
// Syncs localStorage data to JSONBin.io for cross-device access.
// Single-user setup: configure your JSONBin credentials below.
(function (window) {
  "use strict";

  // ========== CONFIGURATION ==========
  // 1. Create a free account at https://jsonbin.io
  // 2. Create a new bin with content: {"Results":"{}"}
  // 3. Paste your API key and Bin ID below
  var CONFIG = {
    JSONBIN_API_KEY:
      "$2a$10$rAp7SnqrO0NpRFgvFVX4ouPxP/yD5b.3p7rxOZG8JMw5HiMKTxMye", // Your JSONBin X-Master-Key
    JSONBIN_BIN_ID: "69e0f27136566621a8bdcbee", // Your Bin ID
  };
  // ====================================

  // Keys to sync across devices
  var SYNC_KEYS = [
    "Results",
    "GenkiEdition",
    "genkiLang",
    "darkMode",
    "feedbackMode",
    "furiganaVisible",
    "vocabHorizontal",
    "genkiFontSize",
    "genkiPageWidth",
    "genkiTheme",
    "spoilerMode",
    "genkiSkipExType",
    "genkiJishoLookUp",
    "strokeOrderVisible",
    "tracingGuideVisible",
    "timerAutoPause",
    "genkiRandomExercise",
    "genkiCustomCSS",
  ];

  // Skip if localStorage is not available or not configured
  if (!window.storageOK) return;
  if (CONFIG.JSONBIN_API_KEY === "$2a$10$YOUR_API_KEY_HERE") {
    console.log(
      "[Sync] Not configured. Edit sync.js with your JSONBin credentials.",
    );
    return;
  }

  var API_URL = "https://api.jsonbin.io/v3/b/" + CONFIG.JSONBIN_BIN_ID;
  var isSyncing = false;

  // Merge remote Results with local Results, keeping the higher score per exercise
  function mergeResults(local, remote) {
    if (!remote) return local;
    if (!local) return remote;

    try {
      var localObj = typeof local === "string" ? JSON.parse(local) : local;
      var remoteObj = typeof remote === "string" ? JSON.parse(remote) : remote;

      var editions = ["2nd", "3rd"];
      for (var e = 0; e < editions.length; e++) {
        var ed = editions[e];
        if (!remoteObj[ed]) continue;
        if (!localObj[ed]) localObj[ed] = {};

        for (var lesson in remoteObj[ed]) {
          if (remoteObj[ed].hasOwnProperty(lesson)) {
            var remoteScore = parseInt(remoteObj[ed][lesson]);
            var localScore = localObj[ed][lesson]
              ? parseInt(localObj[ed][lesson])
              : -1;
            if (remoteScore > localScore) {
              localObj[ed][lesson] = remoteScore;
            }
          }
        }
      }

      return JSON.stringify(localObj);
    } catch (err) {
      console.warn("[Sync] Merge error:", err);
      return local || remote;
    }
  }

  // Fetch remote data and merge with local
  function pullFromCloud(callback) {
    if (isSyncing) return;
    isSyncing = true;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", API_URL + "/latest", true);
    xhr.setRequestHeader("X-Master-Key", CONFIG.JSONBIN_API_KEY);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      isSyncing = false;

      if (xhr.status === 200) {
        try {
          var response = JSON.parse(xhr.responseText);
          var remoteData = response.record || {};

          // Merge each synced key
          for (var i = 0; i < SYNC_KEYS.length; i++) {
            var key = SYNC_KEYS[i];
            var remoteVal = remoteData[key];
            var localVal = localStorage[key];

            if (key === "Results") {
              // Special merge for Results: keep highest scores
              var merged = mergeResults(localVal, remoteVal);
              if (merged) localStorage.Results = merged;
            } else if (remoteVal !== undefined && !localVal) {
              // For other keys, only pull if local is not set
              localStorage[key] = remoteVal;
            }
          }

          console.log("[Sync] Pulled from cloud successfully.");
        } catch (err) {
          console.warn("[Sync] Pull parse error:", err);
        }
      } else {
        console.warn("[Sync] Pull failed:", xhr.status);
      }

      if (callback) callback();
    };
    xhr.send();
  }

  // Push local data to cloud
  function pushToCloud() {
    if (isSyncing) return;
    isSyncing = true;

    var data = {};
    for (var i = 0; i < SYNC_KEYS.length; i++) {
      var key = SYNC_KEYS[i];
      if (localStorage[key] !== undefined) {
        data[key] = localStorage[key];
      }
    }

    var xhr = new XMLHttpRequest();
    xhr.open("PUT", API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("X-Master-Key", CONFIG.JSONBIN_API_KEY);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      isSyncing = false;

      if (xhr.status === 200) {
        console.log("[Sync] Pushed to cloud successfully.");
      } else {
        console.warn("[Sync] Push failed:", xhr.status);
      }
    };
    xhr.send(JSON.stringify(data));
  }

  // Expose sync functions globally so genki.js can call pushToCloud after saving results
  window.GenkiSync = {
    push: pushToCloud,
    pull: pullFromCloud,
  };

  // Pull on page load, then push merged data back
  pullFromCloud(function () {
    pushToCloud();
  });
})(window);
