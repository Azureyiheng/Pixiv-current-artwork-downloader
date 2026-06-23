# Pixiv Current Artwork Downloader

一个用于 Pixiv 作品页的 Tampermonkey 用户脚本。它会在 Pixiv 作品页右下角添加一个下载面板，可以一键下载当前作品的全部图片，并支持自定义保存子目录和图片命名格式。

A Tampermonkey userscript for Pixiv artwork pages. It adds a small downloader panel to the lower-right corner of Pixiv artwork pages, downloads all images from the current artwork, and supports custom download subfolders and filename templates.

本脚本只会下载你当前 Pixiv 账号在浏览器中正常有权限访问的图片。它不会绕过登录、权限控制、付费限制、私密作品或 Pixiv 的访问控制。

This script only downloads images your current Pixiv account can normally access in the browser. It does not bypass login, permissions, paid access, private works, or Pixiv access controls.

## 功能 / Features

- 下载当前 Pixiv 作品的全部分页图片。 / Download all pages from the current Pixiv artwork.
- 使用浏览器中已有的 Pixiv 登录状态。 / Use your existing Pixiv browser session.
- 自定义 Chrome 默认下载目录下的保存子文件夹。 / Customize the subfolder under Chrome's default download directory.
- 使用模板变量自定义文件名。 / Customize filenames with template variables.
- 自定义每张图片之间的下载间隔和并发下载数量。 / Configure delay and concurrent download count.
- 单张图片下载失败时自动重试。 / Retry failed image downloads.
- 记录已成功下载的图片，再次启动时自动跳过已完成项，只继续下载未完成项。 / Record completed images and skip them on the next run so only unfinished images are retried.
- 下载队列运行时可以点击 `Stop`，在当前图片完成后停止后续下载。 / Use `Stop` to stop the queue after the current image finishes.
- 支持 Pixiv 站内跳转到作品页时自动显示面板，无需手动刷新。 / Automatically show the panel after Pixiv single-page-app navigation to artwork pages.
- 可以从 Tampermonkey 菜单显示或隐藏右下角悬浮面板。 / Show or hide the floating panel from the Tampermonkey menu.

## 安装 / Install

### 从源码安装 / From source

1. 在 Chrome 或其他支持的浏览器中安装 Tampermonkey。 / Install Tampermonkey in Chrome or another supported browser.
2. 打开 `pixiv-current-artwork-downloader.user.js`。 / Open `pixiv-current-artwork-downloader.user.js`.
3. 复制整个文件内容。 / Copy the whole file.
4. 在 Tampermonkey 中选择 `添加新脚本`。 / In Tampermonkey, choose `Add a new script`.
5. 删除默认内容，粘贴脚本并保存。 / Replace the default content, paste the script, and save.
6. 打开一个 Pixiv 作品页并刷新页面。 / Open a Pixiv artwork page and refresh it.

### 从 Greasy Fork 安装 / From Greasy Fork

https://greasyfork.org/zh-CN/scripts/583972-pixiv%E5%9B%BE%E7%89%87%E4%B8%80%E9%94%AE%E4%B8%8B%E8%BD%BD-pixiv-current-artwork-downloader

## 使用方法 / Usage

1. 打开 Pixiv 作品页，例如 `https://www.pixiv.net/artworks/12345678`。 / Open a Pixiv artwork page, for example `https://www.pixiv.net/artworks/12345678`.
2. 使用页面右下角的 `Pixiv downloader` 面板。 / Use the `Pixiv downloader` panel in the lower-right corner.
3. 设置保存子目录和文件名模板。 / Set the download subfolder and filename template.
4. 按需调整 `Delay between images (ms)`、`Concurrent downloads` 和 `Retries per image`。默认延迟是 `250`，默认并发数是 `3`，默认每张图片重试 `2` 次。 / Adjust `Delay between images (ms)`, `Concurrent downloads`, and `Retries per image` as needed. The defaults are `250`, `3`, and `2`.
5. 点击 `Download current artwork images` 开始下载。 / Click `Download current artwork images` to start.
6. 如果想停止队列，点击 `Stop`。脚本会在当前图片处理完成后停止，不再继续下载后续图片。 / Click `Stop` to stop after the current image finishes.

如果面板被隐藏了，可以在 Pixiv 页面点击 Tampermonkey 图标，然后选择 `Show Pixiv downloader` 重新显示。

If the panel is hidden, open the Tampermonkey menu on the Pixiv page and choose `Show Pixiv downloader`.

Pixiv 是单页应用，从站内列表页跳转到作品页时页面通常不会完整刷新。本脚本会在 Pixiv 全站注入，并在 URL 进入作品页时自动显示面板。

Pixiv is a single-page application. Navigation from a list page to an artwork page often does not fully reload the browser page. This script runs on Pixiv pages and automatically shows the panel when the URL enters an artwork page.

## 断点续下 / Resume Downloads

脚本会为每个 Pixiv 作品记录已经成功下载的图片。某次下载中如果有图片失败，下次再次点击 `Download current artwork images` 时，脚本会自动跳过已经成功的图片，只继续下载未完成的图片。

The script records successfully downloaded images for each Pixiv artwork. If some images fail, clicking `Download current artwork images` again will skip completed images and retry only unfinished ones.

这些记录保存在 Tampermonkey 给本脚本分配的本地脚本存储中，使用的是 `GM_setValue` / `GM_getValue`。记录不会保存到你的图片下载目录，也不会自动随图片文件删除。通常它会一直保留，直到你清除当前作品记录、删除本脚本、清空 Tampermonkey/浏览器扩展数据，或重置浏览器配置。

These records are stored in Tampermonkey's local script storage for this script via `GM_setValue` / `GM_getValue`. They are not saved in your image download directory and are not automatically deleted when image files are deleted. They usually remain until you clear records, remove the script, clear Tampermonkey/browser extension data, or reset the browser profile.

如果不清除记录，同一个作品后续下载会继续跳过已标记成功的图片。这对断点续下很有用，但也意味着：如果你手动删除了本地图片，脚本仍然会认为这些图片已经下载过。

If records are not cleared, future downloads for the same artwork will continue to skip images marked as completed. This is useful for resuming, but it also means the script may still treat manually deleted local files as already downloaded.

面板中的 `Clear all download records` 会清除本脚本保存的所有作品下载完成记录。它只清理 `downloadRecord:*` 这类断点续下记录，不会删除已经下载到硬盘上的图片，也不会清除保存目录、命名模板、并发数、重试次数等脚本设置。

The `Clear all download records` button clears all saved completed-download records for this script. It only removes `downloadRecord:*` resume records. It does not delete downloaded image files or clear settings such as folder, filename template, concurrency, or retry count.

以下情况建议清除记录后重新下载：

Consider clearing records before downloading again when:

- 你手动删除了本地已下载图片。 / You manually deleted local downloaded images.
- 你修改了保存目录或文件名模板，并希望重新生成一套文件。 / You changed the save folder or filename template and want to generate a new file set.
- 你想完整重新下载之前下载过的作品。 / You want to fully re-download previously downloaded artworks.
- 你想清理 Tampermonkey 中保存的全部断点续下记录。 / You want to clear all resume records stored in Tampermonkey.

由于浏览器安全限制，Tampermonkey 用户脚本不能可靠读取你的本地下载目录。因此“断点续下”依据的是脚本保存的成功下载记录，而不是实际扫描硬盘上的文件。

Because of browser security restrictions, Tampermonkey userscripts cannot reliably read your local download directory. Resume behavior is based on the script's saved success records, not on scanning files on disk.

## 保存目录与命名模板 / Folder And Filename Templates

保存目录是相对于浏览器默认下载目录的子路径。浏览器不允许用户脚本静默写入任意绝对路径，例如 `D:\Pixiv`。

The save folder is relative to the browser's default download directory. Browsers do not allow userscripts to silently write to arbitrary absolute paths such as `D:\Pixiv`.

默认保存目录 / Default folder:

```text
Pixiv/{author}
```

默认文件名 / Default filename:

```text
{id}_p{page}.{ext}
```

可用模板变量 / Available template variables:

- `{author}`：Pixiv 作者名。 / Pixiv author name.
- `{title}`：作品标题。 / Artwork title.
- `{id}`：作品 ID。 / Artwork ID.
- `{page}`：从 1 开始的页码。 / One-based page number.
- `{page0}`：从 0 开始的页码。 / Zero-based page number.
- `{ext}`：图片文件扩展名。 / Image file extension.

示例 / Example:

```text
Folder: Pixiv/{author}
File:   {title}_{id}_p{page}.{ext}
```

保存结果类似 / This saves files like:

```text
Downloads/Pixiv/Author Name/Artwork Title_12345678_p1.jpg
```

## 浏览器下载限制 / Browser Download Limitations

Tampermonkey 使用的是浏览器下载能力。普通模式下，文件会保存到浏览器默认下载目录之下。若要保存到其他位置，可以修改浏览器默认下载位置，或者启用 `Ask where to save each image`。

Tampermonkey uses the browser download API. In normal mode, files are saved under the browser's default download directory. To save elsewhere, change the browser's default download location or enable `Ask where to save each image`.

`Ask where to save each image` 可以让浏览器逐张弹出另存为窗口，从而手动选择保存位置。但对于多图作品来说，每张图片都会询问一次，可能不太方便。

`Ask where to save each image` lets the browser ask for a save location for each image. This can be inconvenient for multi-page artworks because the browser prompts once per image.

为了稳定保留保存子目录，本脚本默认严格使用 `GM_download`。如果 Tampermonkey 或浏览器拒绝某次下载，脚本会报错而不是自动降级到普通网页下载，因为普通网页下载无法可靠保留 `Pixiv/{author}` 这类子文件夹路径。

To preserve subfolder paths reliably, this script uses `GM_download` strictly. If Tampermonkey or the browser rejects a download, the script reports an error instead of silently falling back to normal page downloads, because normal page downloads cannot reliably preserve subfolder paths such as `Pixiv/{author}`.

下载速度受网络、Pixiv 图片服务器、浏览器下载调度和脚本设置共同影响。脚本默认同时下载 `3` 张图片；如果网络条件较好，可以把 `Concurrent downloads` 调到 `4` 到 `6`。如果出现失败、卡顿或被浏览器限制，可以调回 `1` 到 `3`，并适当增大延迟。

Download speed depends on your network, Pixiv image servers, browser download scheduling, and script settings. The default concurrency is `3`. If your network is stable, try `4` to `6`. If failures, stalls, or browser limits occur, reduce it to `1` to `3` and increase the delay.

如果状态栏出现类似 `GM_download failed: failed`，通常表示 Tampermonkey 或浏览器下载接口只返回了通用失败码。常见原因包括网络波动、Pixiv 图片服务器响应失败、并发数过高、浏览器下载限制，或页面运行环境被关闭。可以降低 `Concurrent downloads`、增大 `Delay between images (ms)`，或提高 `Retries per image` 后再试。

If the status shows something like `GM_download failed: failed`, Tampermonkey or the browser download API likely returned only a generic failure code. Common causes include network fluctuation, Pixiv image server failure, too much concurrency, browser download limits, or the page environment being closed. Try lowering `Concurrent downloads`, increasing `Delay between images (ms)`, or increasing `Retries per image`.

## 权限说明 / Permissions

本脚本请求以下权限：

This userscript requests:

- `GM_download`：触发浏览器下载。 / Request browser downloads.
- `GM_notification`：显示完成或失败提示。 / Show completion or failure notifications.
- `GM_getValue`、`GM_setValue`、`GM_listValues` 和 `GM_deleteValue`：保存面板设置，并管理断点续下记录。 / Save panel settings and manage resume records.
- `GM_registerMenuCommand`：添加 Tampermonkey 菜单命令。 / Add Tampermonkey menu commands.
- `@connect www.pixiv.net` 和 `@connect i.pximg.net`：访问 Pixiv 作品信息和图片地址。 / Access Pixiv artwork metadata and image URLs.

## 负责任使用 / Responsible Use

请只将本脚本用于保存你有权访问和保存的作品。不要用它转载、倒卖、批量抓取未授权数据集，或以其他方式侵犯作者权益、违反 Pixiv 条款或当地法律。

Use this script only for artworks you are allowed to access and save. Do not use it to redistribute, resell, scrape unauthorized datasets, infringe artist rights, violate Pixiv terms, or break local laws.

## 开发 / Development

可以用 Node.js 做语法检查：

Run a syntax check with Node.js:

```bash
node --check pixiv-current-artwork-downloader.user.js
```

发布到 Greasy Fork 前，请确认脚本头部元信息中的 `@name`、`@namespace`、`@version`、`@description`、`@license`、`@match`、`@grant` 和 `@connect` 都是正确的。

Before publishing to Greasy Fork, make sure the metadata block has correct `@name`, `@namespace`, `@version`, `@description`, `@license`, `@match`, `@grant`, and `@connect` entries.

## 许可证 / License

MIT。详见 `LICENSE`。

MIT. See `LICENSE`.
