// ==UserScript==
// @name         Pixiv Current Artwork Downloader
// @namespace    local.codex.pixiv
// @version      1.4.2
// @description  Download all images from the current Pixiv artwork page with custom folder and filename templates.
// @author       pixiv-current-artwork-downloader contributors
// @license      MIT
// @match        https://www.pixiv.net/*
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @connect      www.pixiv.net
// @connect      i.pximg.net
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const API_LANG = "zh";
  const PANEL_ID = "codex-pixiv-download-panel";
  const BUTTON_ID = "codex-pixiv-download-current-artwork";
  const STOP_BUTTON_ID = "codex-pixiv-stop-download";
  const CLEAR_RECORD_BUTTON_ID = "codex-pixiv-clear-record";
  const FOLDER_INPUT_ID = "codex-pixiv-folder";
  const TEMPLATE_INPUT_ID = "codex-pixiv-template";
  const SAVE_AS_INPUT_ID = "codex-pixiv-save-as";
  const DELAY_INPUT_ID = "codex-pixiv-delay";
  const CONCURRENCY_INPUT_ID = "codex-pixiv-concurrency";
  const RETRIES_INPUT_ID = "codex-pixiv-retries";

  const DEFAULT_FOLDER = "Pixiv/{author}";
  const DEFAULT_TEMPLATE = "{id}_p{page}.{ext}";
  const DEFAULT_DELAY_MS = 250;
  const DEFAULT_CONCURRENCY = 3;
  const DEFAULT_RETRIES = 2;
  const RECORD_PREFIX = "downloadRecord:";

  let isDownloading = false;
  let cancelRequested = false;
  let routeWatcher = null;

  function getArtworkId() {
    const match = location.pathname.match(/\/artworks\/(\d+)/);
    return match ? match[1] : null;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getStoredValue(key, fallback) {
    if (typeof GM_getValue !== "function") {
      return fallback;
    }
    return GM_getValue(key, fallback);
  }

  function setStoredValue(key, value) {
    if (typeof GM_setValue === "function") {
      GM_setValue(key, value);
    }
  }

  function deleteStoredValue(key) {
    if (typeof GM_deleteValue === "function") {
      GM_deleteValue(key);
    } else {
      setStoredValue(key, {});
    }
  }

  function shouldAutoShowPanel() {
    return Boolean(getArtworkId()) && !getStoredValue("panelHidden", false);
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sanitizePathPart(value, fallback) {
    const text = String(value || fallback || "pixiv")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 80) || fallback || "pixiv";
  }

  function sanitizeRelativeFolder(value) {
    return String(value || "")
      .replace(/^[a-zA-Z]:/, "")
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => sanitizePathPart(part, ""))
      .filter(Boolean)
      .join("/");
  }

  function sanitizeTemplate(value) {
    return String(value || DEFAULT_TEMPLATE)
      .replace(/^[\\/]+/, "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim() || DEFAULT_TEMPLATE;
  }

  function getExtension(url) {
    const match = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : "jpg";
  }

  function fillTemplate(template, tokens) {
    return template.replace(/\{(author|title|id|page|page0|ext)\}/g, (_, key) => tokens[key]);
  }

  function buildDownloadName(settings, tokens) {
    const folder = sanitizeRelativeFolder(fillTemplate(settings.folder, tokens));
    const fileName = sanitizeTemplate(fillTemplate(settings.template, tokens));
    return folder ? `${folder}/${fileName}` : fileName;
  }

  function getRecordKey(artworkId) {
    return `${RECORD_PREFIX}${artworkId}`;
  }

  function loadDownloadRecord(artworkId) {
    const record = getStoredValue(getRecordKey(artworkId), {});
    return record && typeof record === "object" && !Array.isArray(record) ? record : {};
  }

  function saveDownloadRecord(artworkId, record) {
    setStoredValue(getRecordKey(artworkId), record);
  }

  function getTaskRecordId(artworkId, pageIndex, imageUrl) {
    return `${artworkId}:${pageIndex}:${imageUrl}`;
  }

  function markTaskCompleted(task) {
    const record = loadDownloadRecord(task.artworkId);
    record[task.recordId] = {
      fileName: task.fileName,
      page: task.page,
      completedAt: new Date().toISOString(),
    };
    saveDownloadRecord(task.artworkId, record);
  }

  async function listStoredKeys() {
    if (typeof GM_listValues !== "function") {
      throw new Error("GM_listValues is not available. Please update Tampermonkey.");
    }
    return Promise.resolve(GM_listValues());
  }

  async function clearAllDownloadRecords() {
    let keys = [];

    try {
      keys = await listStoredKeys();
    } catch (error) {
      console.error("[Pixiv downloader]", error);
      setStatus(`Failed to list records: ${error.message || error}`, "error");
      return;
    }

    const recordKeys = keys.filter((key) => String(key).startsWith(RECORD_PREFIX));

    for (const key of recordKeys) {
      deleteStoredValue(key);
    }

    setStatus(`Cleared ${recordKeys.length} artwork download records.`, "success");
    notify("Pixiv records cleared", `Cleared ${recordKeys.length} artwork download records.`);
  }

  function readSettings() {
    const folder = document.getElementById(FOLDER_INPUT_ID)?.value || DEFAULT_FOLDER;
    const template = document.getElementById(TEMPLATE_INPUT_ID)?.value || DEFAULT_TEMPLATE;
    const saveAs = Boolean(document.getElementById(SAVE_AS_INPUT_ID)?.checked);
    const delayMs = Math.max(
      0,
      Math.min(5000, Number.parseInt(document.getElementById(DELAY_INPUT_ID)?.value || DEFAULT_DELAY_MS, 10) || 0)
    );
    const concurrency = Math.max(
      1,
      Math.min(
        8,
        Number.parseInt(document.getElementById(CONCURRENCY_INPUT_ID)?.value || DEFAULT_CONCURRENCY, 10) || 1
      )
    );
    const retries = Math.max(
      0,
      Math.min(5, Number.parseInt(document.getElementById(RETRIES_INPUT_ID)?.value || DEFAULT_RETRIES, 10) || 0)
    );

    setStoredValue("folder", folder);
    setStoredValue("template", template);
    setStoredValue("saveAs", saveAs);
    setStoredValue("delayMs", delayMs);
    setStoredValue("concurrency", concurrency);
    setStoredValue("retries", retries);

    return { folder, template, saveAs, delayMs, concurrency, retries };
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      throw new Error(`Pixiv API request failed: ${response.status}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.message || "Pixiv API returned an error.");
    }
    return payload.body;
  }

  async function loadArtwork(artworkId) {
    const detailUrl = `https://www.pixiv.net/ajax/illust/${artworkId}?lang=${API_LANG}`;
    const pagesUrl = `https://www.pixiv.net/ajax/illust/${artworkId}/pages?lang=${API_LANG}`;
    const [detail, pages] = await Promise.all([fetchJson(detailUrl), fetchJson(pagesUrl)]);

    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("No downloadable pages were found for this artwork.");
    }

    return {
      id: artworkId,
      title: detail.title || `artwork_${artworkId}`,
      userName: detail.userName || detail.userId || "pixiv",
      pages,
    };
  }

  function gmDownload(url, name, referer, saveAs) {
    return new Promise((resolve, reject) => {
      if (typeof GM_download !== "function") {
        reject(new Error("GM_download is not available. Please enable Tampermonkey download permission."));
        return;
      }

      GM_download({
        url,
        name,
        headers: {
          Referer: referer,
        },
        saveAs,
        onload: resolve,
        onerror: (error) => {
          const reason = error && (error.error || error.details || error.message);
          reject(new Error(reason ? `GM_download failed: ${reason}` : "GM_download failed."));
        },
        ontimeout: () => reject(new Error("Download timed out.")),
      });
    });
  }

  async function downloadImage(url, name, referer, saveAs) {
    await gmDownload(url, name, referer, saveAs);
  }

  async function downloadImageWithRetry(task, settings, referer) {
    let lastError = null;

    for (let attempt = 0; attempt <= settings.retries; attempt += 1) {
      if (cancelRequested) {
        throw new Error("Download cancelled.");
      }

      try {
        await downloadImage(task.url, task.fileName, referer, settings.saveAs);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < settings.retries) {
          setStatus(
            `Retrying ${task.fileName} (${attempt + 1}/${settings.retries}) after ${error.message || error}`,
            "info"
          );
          await sleep(Math.max(500, settings.delayMs));
        }
      }
    }

    throw lastError || new Error("Download failed.");
  }

  async function runDownloadQueue(tasks, settings, referer) {
    let nextIndex = 0;
    let completed = 0;
    let failed = 0;

    async function worker(workerId) {
      while (!cancelRequested) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= tasks.length) {
          return;
        }

        const task = tasks[index];
        setStatus(`Downloading ${completed + failed + 1}/${tasks.length}: ${task.fileName}`, "info");

        try {
          await downloadImageWithRetry(task, settings, referer);
          markTaskCompleted(task);
          completed += 1;
        } catch (error) {
          failed += 1;
          setStatus(`Failed ${task.fileName}: ${error.message || error}`, "error");
          console.error(`[Pixiv downloader] Download failed in worker ${workerId}.`, error, task);
        }

        if (!cancelRequested && settings.delayMs > 0 && index < tasks.length - 1) {
          await sleep(settings.delayMs);
        }
      }
    }

    const workerCount = Math.min(settings.concurrency, tasks.length);
    await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index + 1)));

    return {
      completed,
      failed,
      stopped: cancelRequested,
    };
  }

  function setStatus(message, level) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      return;
    }

    panel.dataset.level = level || "info";
    panel.querySelector(".codex-pixiv-status").textContent = message;
  }

  function notify(title, text) {
    if (typeof GM_notification === "function") {
      GM_notification({ title, text, timeout: 5000 });
    }
  }

  function setDownloadingState(active) {
    isDownloading = active;
    const button = document.getElementById(BUTTON_ID);
    const stopButton = document.getElementById(STOP_BUTTON_ID);

    if (button) {
      button.disabled = active;
    }

    if (stopButton) {
      stopButton.disabled = !active;
    }
  }

  function requestStop() {
    if (!isDownloading) {
      setStatus("No active download queue.", "info");
      return;
    }

    cancelRequested = true;
    setStatus("Stopping after the current image finishes...", "info");
  }

  async function handleDownload() {
    if (isDownloading) {
      setStatus("A download queue is already running.", "info");
      return;
    }

    const artworkId = getArtworkId();
    if (!artworkId) {
      setStatus("Open a Pixiv artwork page first.", "error");
      return;
    }

    cancelRequested = false;
    setDownloadingState(true);

    try {
      const settings = readSettings();
      setStatus("Loading artwork images...", "info");
      const artwork = await loadArtwork(artworkId);
      const safeAuthor = sanitizePathPart(artwork.userName, "pixiv");
      const safeTitle = sanitizePathPart(artwork.title, `artwork_${artwork.id}`);
      const referer = `https://www.pixiv.net/artworks/${artwork.id}`;
      const tasks = [];
      const downloadRecord = loadDownloadRecord(artwork.id);
      let skipped = 0;

      for (const [index, page] of artwork.pages.entries()) {
        const originalUrl =
          page.urls && (page.urls.original || page.urls.regular || page.urls.small || page.urls.thumb_mini);

        if (!originalUrl) {
          console.warn("[Pixiv downloader] Page has no image URL.", page);
          continue;
        }

        const extension = getExtension(originalUrl);
        const recordId = getTaskRecordId(artwork.id, index, originalUrl);
        const fileName = buildDownloadName(settings, {
          author: safeAuthor,
          title: safeTitle,
          id: artwork.id,
          page: String(index + 1),
          page0: String(index),
          ext: extension,
        });

        if (downloadRecord[recordId]) {
          skipped += 1;
          continue;
        }

        tasks.push({
          artworkId: artwork.id,
          page: index + 1,
          recordId,
          url: originalUrl,
          fileName,
        });
      }

      if (tasks.length === 0) {
        setStatus(`Nothing to download: ${skipped}/${artwork.pages.length} images already completed.`, "success");
        notify("Pixiv download skipped", `${skipped}/${artwork.pages.length} images already completed.`);
        return;
      }

      setStatus(
        `Starting ${tasks.length} downloads with concurrency ${settings.concurrency}; skipped ${skipped}.`,
        "info"
      );
      const result = await runDownloadQueue(tasks, settings, referer);
      const summary = `${result.completed}/${tasks.length} completed, ${result.failed} failed, ${skipped} skipped`;

      if (result.stopped) {
        setStatus(`Stopped: ${summary}.`, "success");
        notify("Pixiv download stopped", summary);
      } else {
        setStatus(`Done: ${summary}.`, result.failed > 0 ? "error" : "success");
        notify("Pixiv download complete", summary);
      }
    } catch (error) {
      console.error("[Pixiv downloader]", error);
      setStatus(`Failed: ${error.message || error}`, "error");
      notify("Pixiv download failed", error.message || String(error));
    } finally {
      cancelRequested = false;
      setDownloadingState(false);
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) {
      return;
    }

    if (!document.body) {
      return;
    }

    const style = document.createElement("style");
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: min(390px, calc(100vw - 36px));
        padding: 12px;
        box-sizing: border-box;
        border: 1px solid rgba(0, 0, 0, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.97);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        color: #1f2328;
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${PANEL_ID}.codex-pixiv-hidden {
        display: none;
      }
      #${PANEL_ID}[data-level="success"] {
        border-color: rgba(31, 136, 61, 0.4);
      }
      #${PANEL_ID}[data-level="error"] {
        border-color: rgba(207, 34, 46, 0.45);
      }
      #${PANEL_ID} label {
        display: block;
        margin: 0 0 8px;
        font-weight: 700;
      }
      #${PANEL_ID} input[type="text"] {
        width: 100%;
        min-height: 32px;
        margin-top: 4px;
        padding: 5px 7px;
        box-sizing: border-box;
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        font: inherit;
      }
      #${PANEL_ID} input[type="number"] {
        width: 100%;
        min-height: 32px;
        margin-top: 4px;
        padding: 5px 7px;
        box-sizing: border-box;
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        font: inherit;
      }
      #${PANEL_ID} .codex-pixiv-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 0 10px;
      }
      #${PANEL_ID} .codex-pixiv-help {
        margin: 0 0 10px;
        color: #57606a;
        font-size: 12px;
      }
      #${PANEL_ID} .codex-pixiv-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 0 8px;
        font-weight: 800;
      }
      #${PANEL_ID} .codex-pixiv-close {
        width: 26px;
        height: 26px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #57606a;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }
      #${PANEL_ID} .codex-pixiv-actions {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      #${BUTTON_ID},
      #${STOP_BUTTON_ID},
      #${CLEAR_RECORD_BUTTON_ID} {
        width: 100%;
        min-height: 36px;
        border: 0;
        border-radius: 6px;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      #${BUTTON_ID} {
        background: #0096fa;
      }
      #${STOP_BUTTON_ID} {
        min-width: 72px;
        background: #cf222e;
      }
      #${CLEAR_RECORD_BUTTON_ID} {
        margin-top: 8px;
        background: #57606a;
      }
      #${BUTTON_ID}:disabled,
      #${STOP_BUTTON_ID}:disabled,
      #${CLEAR_RECORD_BUTTON_ID}:disabled {
        cursor: wait;
        opacity: 0.66;
      }
      #${PANEL_ID} .codex-pixiv-status {
        margin-top: 8px;
        overflow-wrap: anywhere;
      }
    `;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.dataset.level = "info";
    const storedFolder = escapeAttribute(getStoredValue("folder", DEFAULT_FOLDER));
    const storedTemplate = escapeAttribute(getStoredValue("template", DEFAULT_TEMPLATE));
    const storedSaveAs = getStoredValue("saveAs", false) ? "checked" : "";
    const storedDelayMs = escapeAttribute(getStoredValue("delayMs", DEFAULT_DELAY_MS));
    const storedConcurrency = escapeAttribute(getStoredValue("concurrency", DEFAULT_CONCURRENCY));
    const storedRetries = escapeAttribute(getStoredValue("retries", DEFAULT_RETRIES));
    panel.innerHTML = `
      <div class="codex-pixiv-title">
        <span>Pixiv downloader</span>
        <button class="codex-pixiv-close" type="button" title="Hide">x</button>
      </div>
      <label>
        Save folder under Chrome downloads
        <input id="${FOLDER_INPUT_ID}" type="text" value="${storedFolder}">
      </label>
      <label>
        File name template
        <input id="${TEMPLATE_INPUT_ID}" type="text" value="${storedTemplate}">
      </label>
      <p class="codex-pixiv-help">Tokens: {author}, {title}, {id}, {page}, {page0}, {ext}. Example: Pixiv/{author} + {title}_{id}_p{page}.{ext}</p>
      <label>
        Delay between images (ms)
        <input id="${DELAY_INPUT_ID}" type="number" min="0" max="5000" step="50" value="${storedDelayMs}">
      </label>
      <label>
        Concurrent downloads
        <input id="${CONCURRENCY_INPUT_ID}" type="number" min="1" max="8" step="1" value="${storedConcurrency}">
      </label>
      <label>
        Retries per image
        <input id="${RETRIES_INPUT_ID}" type="number" min="0" max="5" step="1" value="${storedRetries}">
      </label>
      <label class="codex-pixiv-row">
        <input id="${SAVE_AS_INPUT_ID}" type="checkbox" ${storedSaveAs}>
        Ask where to save each image
      </label>
      <div class="codex-pixiv-actions">
        <button id="${BUTTON_ID}" type="button">Download current artwork images</button>
        <button id="${STOP_BUTTON_ID}" type="button" disabled>Stop</button>
      </div>
      <button id="${CLEAR_RECORD_BUTTON_ID}" type="button">Clear all download records</button>
      <div class="codex-pixiv-status">Open a Pixiv artwork page, adjust options, then click download.</div>
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(panel);
    if (!shouldAutoShowPanel()) {
      panel.style.display = "none";
      panel.classList.add("codex-pixiv-hidden");
    }
    document.getElementById(BUTTON_ID).addEventListener("click", handleDownload);
    document.getElementById(STOP_BUTTON_ID).addEventListener("click", requestStop);
    document.getElementById(CLEAR_RECORD_BUTTON_ID).addEventListener("click", clearAllDownloadRecords);
    panel.querySelector(".codex-pixiv-close").addEventListener("click", () => {
      panel.classList.add("codex-pixiv-hidden");
      panel.style.display = "none";
      setStoredValue("panelHidden", true);
    });
  }

  function showPanel() {
    createPanel();
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.classList.remove("codex-pixiv-hidden");
      panel.style.display = "block";
      setStoredValue("panelHidden", false);
    }
  }

  function init() {
    createPanel();
    let lastArtworkId = getArtworkId();

    if (routeWatcher) {
      clearInterval(routeWatcher);
    }

    routeWatcher = setInterval(() => {
      if (!document.getElementById(PANEL_ID)) {
        createPanel();
      }

      const currentArtworkId = getArtworkId();
      if (currentArtworkId !== lastArtworkId) {
        lastArtworkId = currentArtworkId;
        if (currentArtworkId && shouldAutoShowPanel()) {
          showPanel();
        }
        setStatus(
          currentArtworkId
            ? "Open a Pixiv artwork page, adjust options, then click download."
            : "Open a Pixiv artwork page first.",
          "info"
        );
      }
    }, 1000);
  }

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("Show Pixiv downloader", showPanel);
    GM_registerMenuCommand("Download current artwork images", handleDownload);
    GM_registerMenuCommand("Stop Pixiv download queue", requestStop);
    GM_registerMenuCommand("Clear all download records", clearAllDownloadRecords);
  }

  if (document.body) {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
