// The exporter bookmarklet (ORC-66). Run it on the Dungeon Master's Vault
// site while logged in. It fetches every character and custom magic item of
// the user, and downloads them as dmv-export.json for Alchemy 5e to import.
// It does not read the EDN: each list goes into the bundle as the raw
// response text. Plain browser JavaScript, with no dependencies.
(function () {
  var overlay = document.getElementById("dmv-exporter");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "dmv-exporter";
    overlay.style.cssText =
      "position:fixed;top:16px;right:16px;z-index:2147483647;max-width:320px;padding:12px 16px;" +
      "background:#fff;color:#000;border:2px solid #000;font:14px/1.4 sans-serif;";
    document.body.appendChild(overlay);
  }
  function show(text) {
    overlay.textContent = "Alchemy 5e exporter: " + text;
  }

  // The old app keeps the logged-in user as EDN in localStorage; the JWT is its :token.
  var match = /:token\s+"([^"]+)"/.exec(localStorage.getItem("user") || "");
  if (!match) {
    show("Log in to Dungeon Master's Vault first, then run the exporter again.");
    return;
  }
  var headers = { Authorization: "Token " + match[1] };

  function get(path) {
    return fetch(path, { headers: headers, credentials: "same-origin" }).then(function (response) {
      if (response.status === 401) throw new Error("Your login has expired. Log in again, then run the exporter again.");
      if (!response.ok) throw new Error("The server answered " + path + " with status " + response.status + ".");
      return response.text();
    });
  }

  var bundle = { format: "dmv-export", version: 1, exportedFrom: location.origin, characters: [], magicItems: [] };
  show("Fetching characters…");
  get("/dnd/5e/characters")
    .then(function (text) {
      bundle.characters.push(text);
      show("Fetching magic items…");
      return get("/dnd/5e/items");
    })
    .then(function (text) {
      bundle.magicItems.push(text);
      var blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "dmv-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      show("Downloaded dmv-export.json. Import it in Alchemy 5e.");
    })
    .catch(function (e) {
      show("Export failed. " + e.message);
    });
})();
