# Nyaa MAL Link & Poster Userscript

A sleek, lightweight userscript for [Nyaa.si](https://nyaa.si) and [Sukebei](https://sukebei.nyaa.si) that automatically extracts anime titles from torrent releases, queries **MyAnimeList (MAL)**, displays the anime's official poster, links directly to the MAL entry, and shows the rating score and series information.

---

## Features

- **Automatic Title Extraction:** Intelligent regex cleaner strips release groups (`[SubsPlease]`, `[Erai-raws]`, etc.), resolutions (`1080p`, `720p`), audio/video tags, CRC hashes, and episode numbers to find the true anime title.
- **Official Anime Poster:** Renders the anime poster card directly inside the torrent information panel.
- **Lightbox Zoom:** Click the magnifying glass icon or hover to view the high-resolution poster in a full-screen lightbox overlay.
- **Direct MAL Link & Badges:** Adds a native-looking `MyAnimeList:` row with a direct link, score badge (e.g. `★ 7.82`), and format details (`TV, 12 eps`).
- **Resilient Fallback Search:**
  1. Primary query using **Jikan API v4** (`api.jikan.moe`).
  2. Automatic secondary fallback using **MyAnimeList Search Suggestions** (`myanimelist.net/search/prefix.json`).
  3. Automatic base-title simplification if subtitled entries fail.
- **Manual Query Editor:** Click the pencil icon (`✏️`) next to the MAL link to edit or type a custom search query directly on the page without reloading.
- **Instant Caching:** Caches search results in `localStorage` for 7 days for instant loads on subsequent visits and zero API spam.
- **Light & Dark Mode Support:** Seamlessly adapts to Nyaa's default theme and dark mode.

---

## Installation

1. Install a userscript manager in your browser:
   - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
   - [Tampermonkey](https://www.tampermonkey.net/)
2. Open your userscript manager and create a new script.
3. Copy and paste the contents of [`nyaa_mal_link_and_poster.user.js`](./nyaa_mal_link_and_poster.user.js) into the editor.
4. Save the script.
5. Visit any torrent page on Nyaa, such as [`https://nyaa.si/view/2169193`](https://nyaa.si/view/2169193).

---

## Supported Domains

- `https://nyaa.si/view/*`
- `https://*.nyaa.si/view/*`
- `https://sukebei.nyaa.si/view/*`
