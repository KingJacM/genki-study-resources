// # CLOUD SYNC FOR EXERCISE PROGRESS #
// Syncs localStorage data to JSONBin.io for cross-device access.
(function (window) {
  "use strict";

  var CONFIG = {
    JSONBIN_API_KEY:
      "$2a$10$6yO9LUvjhlftAiEdWkB5o.IYNUIrGJwhLHpeBo2YaUcP8RHEx1Fja",
    JSONBIN_BIN_ID: "69e0f27136566621a8bdcbee",
  };

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
  if (CONFIG.JSONBIN_API_KEY === "$2a$10$YOUR_API_KEY_HERE") return;

  var API_URL = "https://api.jsonbin.io/v3/b/" + CONFIG.JSONBIN_BIN_ID;

  // Merge Results: keep highest score per exercise
  function mergeResultObjects(localStr, remoteStr) {
    var localObj, remoteObj;
    try { localObj = localStr ? JSON.parse(localStr) : {}; } catch (e) { localObj = {}; }
    try { remoteObj = remoteStr ? JSON.parse(remoteStr) : {}; } catch (e) { remoteObj = {}; }

    var changed = false;
    var editions = ["2nd", "3rd"];
    for (var e = 0; e < editions.length; e++) {
      var ed = editions[e];

      // Merge remote into local
      if (remoteObj[ed]) {
        if (!localObj[ed]) { localObj[ed] = {}; changed = true; }
        for (var lesson in remoteObj[ed]) {
          if (remoteObj[ed].hasOwnProperty(lesson)) {
            var rs = parseInt(remoteObj[ed][lesson]);
            var ls = localObj[ed][lesson] ? parseInt(localObj[ed][lesson]) : -1;
            if (rs > ls) { localObj[ed][lesson] = rs; changed = true; }
          }
        }
      }

      // Ensure local-only data is preserved (local has scores remote doesn't)
      // This is already handled since we start from localObj
    }

    return { data: JSON.stringify(localObj), changed: changed };
  }

  // Merge all sync keys: combine local + remote, preferring newest/best
  function mergeAllData(localData, remoteData) {
    var merged = {};
    var hasNewData = false;

    for (var i = 0; i < SYNC_KEYS.length; i++) {
      var key = SYNC_KEYS[i];
      var localVal = localData[key];
      var remoteVal = remoteData[key];

      if (key === "Results") {
        var result = mergeResultObjects(localVal, remoteVal);
        merged[key] = result.data;
        if (result.changed) hasNewData = true;
      } else {
        // For settings: local wins if set, otherwise use remote
        merged[key] = localVal !== undefined ? localVal : remoteVal;
      }
    }

    return { data: merged, hasNewData: hasNewData };
  }

  function fetchRemote(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", API_URL + "/latest", true);
    xhr.setRequestHeader("X-Master-Key", CONFIG.JSONBIN_API_KEY);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var response = JSON.parse(xhr.responseText);
          callback(response.record || {});
        } catch (err) {
          console.warn("[Sync] Parse error:", err);
          callback({});
        }
      } else {
        console.warn("[Sync] Pull failed:", xhr.status, xhr.responseText);
        callback(null);
      }
    };
    xhr.send();
  }

  function pushMerged(data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("X-Master-Key", CONFIG.JSONBIN_API_KEY);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        console.log("[Sync] Pushed to cloud.");
      } else {
        console.warn("[Sync] Push failed:", xhr.status);
      }
      if (callback) callback();
    };
    xhr.send(JSON.stringify(data));
  }

  // Main sync: pull remote, merge with local, save locally, push merged back
  function sync(callback) {
    fetchRemote(function (remoteData) {
      if (remoteData === null) { if (callback) callback(false); return; }

      // Gather local data
      var localData = {};
      for (var i = 0; i < SYNC_KEYS.length; i++) {
        var key = SYNC_KEYS[i];
        if (localStorage[key] !== undefined) {
          localData[key] = localStorage[key];
        }
      }

      // Merge
      var result = mergeAllData(localData, remoteData);

      // Save merged data to localStorage
      for (var j = 0; j < SYNC_KEYS.length; j++) {
        var k = SYNC_KEYS[j];
        if (result.data[k] !== undefined) {
          localStorage[k] = result.data[k];
        }
      }

      console.log("[Sync] Pulled and merged. New data:", result.hasNewData);

      // Push merged data back to cloud (so both local and remote are in sync)
      pushMerged(result.data, function () {
        if (callback) callback(result.hasNewData);
      });
    });
  }

  // Expose for genki.js to call after quiz completion
  window.GenkiSync = {
    push: function () { sync(); },
    pull: function (cb) { sync(cb); },
  };

  // Sync on page load. Reload once if new data arrived so scores render.
  var reloadFlag = "genkiSyncReloaded";
  sync(function (hasNewData) {
    if (hasNewData && !sessionStorage[reloadFlag]) {
      sessionStorage[reloadFlag] = "1";
      window.location.reload();
    } else {
      sessionStorage.removeItem(reloadFlag);
    }
  });
})(window);
