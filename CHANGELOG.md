# Changelog

All notable changes to this project are documented here.

## 1.4.2 - 2026-06-23

- Changed record clearing from current-artwork-only to all saved download records.
- Added `GM_listValues` and `GM_deleteValue` permissions to enumerate and remove saved resume records.
- Updated the panel and Tampermonkey menu text to `Clear all download records`.
- Rewrote `README.md` as a bilingual Chinese/English document.

## 1.4.1 - 2026-06-23

- Broadened the userscript match rule to all Pixiv pages.
- Improved panel activation after Pixiv single-page-app navigation to artwork pages.
- Kept the panel hidden on non-artwork pages unless opened manually.
- Documented where resume records are stored and when users should clear them.

## 1.4.0 - 2026-06-22

- Added per-artwork resume records for completed image downloads.
- Skips already completed images when starting the downloader again.
- Added `Clear record for this artwork` button and Tampermonkey menu command.
- Documented the browser limitation that local files cannot be scanned reliably.

## 1.3.1 - 2026-06-22

- Added configurable retries per image.
- Improved `GM_download` error messages.
- Kept the queue running when individual images fail after retries.
- Documented common causes of generic `GM_download failed` errors.

## 1.3.0 - 2026-06-22

- Added configurable concurrent downloads.
- Changed the download queue from strictly serial downloads to a worker-based queue.
- Documented speed tuning guidance for concurrency and delay settings.

## 1.2.1 - 2026-06-22

- Reduced the default delay between image downloads from 900ms to 250ms.
- Added a configurable `Delay between images (ms)` setting.
- Removed silent blob fallback downloads to preserve subfolder paths reliably.
- Removed the no-longer-needed `GM_xmlhttpRequest` permission.
- Documented the strict `GM_download` behavior and browser path limitation.

## 1.2.0 - 2026-06-22

- Added publish-ready metadata, including MIT license information.
- Added a stop button for the active download queue.
- Fixed panel hiding so the close button works and the hidden state is remembered.
- Added Tampermonkey menu commands to show the panel, start a download, and stop the queue.
- Added configurable download folder and file name templates.

## 1.1.0 - 2026-06-22

- Added settings for download subfolder and file name format.
- Added persistent settings using Tampermonkey storage.
- Added optional browser `save as` prompts for each image.

## 1.0.0 - 2026-06-22

- Initial one-click Pixiv artwork downloader.
- Added support for multi-page Pixiv artworks.
