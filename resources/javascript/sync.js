// # CLOUD SYNC FOR EXERCISE PROGRESS #
// Syncs localStorage data to JSONBin.io for cross-device access.
// Single-user setup: configure your JSONBin credentials below.
(function (window) {
  "use strict";

  // ========== CONFIGURATION ==========
  var CONFIG = {
    JSONBIN_API_KEY:
      "$2a$10$6yO9LUvjhlftAiEdWkB5o.IYNUIrGJwhLHpeBo2YaUcP8RHEx1Fja",
    JSONBIN_BIN_ID: "69e0f27136566621a8bdcbee",
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

  if (!window.storageOK) return;
  if (CONFIG.JSONBIN_API_KEY === "$2a$10$YOUR_API_KEY_HERE") {
    console.log("[Sync] Not configured.");
    return;
  }

  var API_URL = "https://api.jsonbin.io/v3/b/" + CONFIG.JSONBIN_BIN_ID;
  var isSyncing = false;

  // Merge remote Results with local Results, keeping the higher score per exercise
  function mergeResults(local, remote) {
    if (!remote) return { data: local, changed: false };
    if (!local) return { data: remote, changed: true };

    try {
      var localObj = typeof local === "string" ? JSON.parse(local) : local;
      var remoteObj = typeof remote === "string" ? JSON.parse(remote) : remote;
      var changed = false;

      var editions = ["2nd", "3rd"];
      for (var e = 0; e < editions.length; e++) {
        var ed = editions[e];
        if (!remoteObj[ed]) continue;
        if (!localObj[ed]) {
          localObj[ed] = {};
          changed = true;
        }

        for (var lesson in remoteObj[ed]) {
          if (remoteObj[ed].hasOwnProperty(lesson)) {
            var remoteScore = parseInt(remoteObj[ed][lesson]);
            var localScore = localObj[ed][lesson]
              ? parseInt(localObj[ed][lesson])
              : -1;
            if (remoteScore > localScore) {
              localObj[ed][lesson] = remoteScore;
              changed = true;
            }
          }
        }
      }

      return { data: JSON.stringify(localObj), changed: changed };
    } catch (err) {
      console.warn("[Sync] Merge error:", err);
      return { data: local || remote, changed: false };
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

      var hasNewData = false;

      if (xhr.status === 200) {
        try {
          var response = JSON.parse(xhr.responseText);
          var remoteData = response.record || {};

          for (var i = 0; i < SYNC_KEYS.length; i++) {
            var key = SYNC_KEYS[i];
            var remoteVal = remoteData[key];
            var localVal = localStorage[key];

            if (key === "Results") {
              var result = mergeResults(localVal, remoteVal);
              if (result.data) localStorage.Results = result.data;
              if (result.changed) hasNewData = true;
            } else if (remoteVal !== undefined && !localVal) {
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

      if (callback) callback(hasNewData);
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

  window.GenkiSync = {
    push: pushToCloud,
    pull: pullFromCloud,
  };

  // Pull on page load. If new data was merged, reload so the page renders with updated scores.
  // Use a flag to prevent infinite reload loops.
  var reloadFlag = "genkiSyncReloaded";
  pullFromCloud(function (hasNewData) {
    if (hasNewData && !sessionStorage[reloadFlag]) {
      sessionStorage[reloadFlag] = "1";
      window.location.reload();
    } else {
      // Clear the flag so the next navigation can trigger a reload if needed
      sessionStorage.removeItem(reloadFlag);
      pushToCloud();
    }
  });
})(window);
