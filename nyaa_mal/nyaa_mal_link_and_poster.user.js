// ==UserScript==
// @name         Nyaa MAL Link & Poster
// @namespace    https://github.com/nyaa-mal-userscript
// @version      1.1.1
// @description  Display MyAnimeList (MAL) links, anime poster, score, and metadata directly on Nyaa torrent pages.
// @author       homura
// @match        *://nyaa.si/view/*
// @match        *://*.nyaa.si/view/*
// @match        *://sukebei.nyaa.si/view/*
// @icon         https://nyaa.si/static/favicon.png
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @connect      api.jikan.moe
// @connect      myanimelist.net
// @connect      cdn.myanimelist.net
// @run-at       document-body
// ==/UserScript==

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const CACHE_PREFIX = 'nyaa_mal_cache_v1_';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // --- Styles Injection ---
  const styles = `
    /* Layout styles */
    .nyaa-mal-flex-wrapper {
      display: flex;
      flex-direction: column;
    }
    @media (min-width: 992px) {
      .nyaa-mal-flex-wrapper {
        flex-direction: row;
        align-items: flex-start;
        gap: 20px;
      }
      .nyaa-mal-meta-col {
        flex: 1 1 auto;
        min-width: 0;
      }
      .nyaa-mal-poster-col {
        flex: 0 0 190px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
    }
    @media (max-width: 991px) {
      .nyaa-mal-poster-col {
        margin: 15px auto 5px auto;
        text-align: center;
        max-width: 220px;
      }
    }

    /* Poster Card */
    .nyaa-mal-poster-card {
      background: #ffffff;
      border: 1px solid #dcdcdc;
      border-radius: 6px;
      padding: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      position: relative;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      width: 100%;
    }
    .nyaa-mal-poster-card:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
      transform: translateY(-2px);
    }
    .nyaa-mal-poster-link {
      display: block;
      position: relative;
      overflow: hidden;
      border-radius: 4px;
    }
    .nyaa-mal-poster-img {
      width: 100%;
      height: auto;
      max-height: 270px;
      object-fit: cover;
      display: block;
      border-radius: 4px;
      background: #e9ecef;
    }
    .nyaa-mal-poster-zoom-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
      cursor: pointer;
      text-decoration: none !important;
    }
    .nyaa-mal-poster-card:hover .nyaa-mal-poster-zoom-btn {
      opacity: 1;
    }
    .nyaa-mal-poster-zoom-btn:hover {
      background: rgba(46, 81, 162, 0.9);
      color: #fff;
    }
    .nyaa-mal-btn-mal {
      display: inline-block;
      margin-top: 7px;
      background: #2e51a2;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      text-decoration: none !important;
      transition: background 0.2s;
    }
    .nyaa-mal-btn-mal:hover {
      background: #1c3773;
    }

    /* Dedicated MAL Metadata Row */
    .nyaa-mal-row {
      display: flex !important;
      align-items: baseline;
      flex-wrap: wrap;
      padding: 3px 15px;
      margin-left: -15px;
      margin-right: -15px;
      margin-top: 4px;
      border-top: 1px dashed rgba(0, 0, 0, 0.08);
      padding-top: 6px;
    }
    .nyaa-mal-label {
      flex: 0 0 auto;
      min-width: 105px;
      color: inherit;
      padding: 0;
      margin: 0;
      white-space: nowrap;
    }
    .nyaa-mal-value {
      flex: 1 1 auto;
      min-width: 0;
      padding-left: 10px;
      margin: 0;
    }
    body.dark .nyaa-mal-row {
      border-top-color: rgba(255, 255, 255, 0.1);
    }

    /* Metadata row enhancements */
    .nyaa-mal-score-badge {
      background-color: #f59e0b;
      color: #ffffff;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      margin-left: 6px;
      display: inline-block;
      vertical-align: middle;
    }
    .nyaa-mal-type-badge {
      background-color: #6b7280;
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      margin-left: 4px;
      display: inline-block;
      vertical-align: middle;
    }
    .nyaa-mal-edit-btn {
      cursor: pointer;
      color: #337ab7;
      margin-left: 8px;
      font-size: 12px;
      text-decoration: none !important;
    }
    .nyaa-mal-edit-btn:hover {
      color: #23527c;
    }

    /* Custom Query Box */
    .nyaa-mal-search-box {
      margin-top: 6px;
      display: flex;
      gap: 6px;
      max-width: 380px;
    }
    .nyaa-mal-search-box input {
      height: 28px;
      padding: 3px 8px;
      font-size: 12px;
    }
    .nyaa-mal-search-box button {
      padding: 2px 10px;
      font-size: 11px;
      height: 28px;
    }

    /* Lightbox Modal */
    .nyaa-mal-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.82);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      cursor: zoom-out;
      animation: nyaaMalFadeIn 0.2s ease-out;
    }
    .nyaa-mal-modal-content {
      max-width: 90vw;
      max-height: 90vh;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      cursor: default;
    }
    @keyframes nyaaMalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Dark Mode Theme overrides */
    body.dark .nyaa-mal-poster-card {
      background: #2b2b2b;
      border-color: #444444;
    }
    body.dark .nyaa-mal-poster-img {
      background: #1f1f1f;
    }
    body.dark .nyaa-mal-edit-btn {
      color: #63a4ff;
    }
    body.dark .nyaa-mal-edit-btn:hover {
      color: #90caf9;
    }
  `;

  function injectStyles() {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(styles);
    } else {
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }
  }

  // --- Network Request Helper ---
  function fetchJson(url, customHeaders = {}) {
    return new Promise((resolve, reject) => {
      const gmFetch = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                      (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

      if (gmFetch) {
        gmFetch({
          method: 'GET',
          url: url,
          headers: {
            'Accept': 'application/json, text/plain, */*',
            ...customHeaders
          },
          timeout: 4000,
          onload: function (res) {
            if (res.status >= 200 && res.status < 300) {
              try {
                const data = JSON.parse(res.responseText);
                resolve(data);
              } catch (e) {
                reject(new Error('Malformed JSON response'));
              }
            } else {
              reject(new Error(`HTTP status ${res.status}`));
            }
          },
          ontimeout: function () {
            reject(new Error('Request timed out'));
          },
          onerror: function (err) {
            reject(err || new Error('Network error'));
          }
        });
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        fetch(url, { headers: customHeaders, signal: controller.signal })
          .then(res => {
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
          })
          .then(resolve)
          .catch(reject);
      }
    });
  }

  // --- Title Cleaning Logic ---
  function cleanAnimeTitle(rawTitle) {
    if (!rawTitle) return '';
    let title = rawTitle.trim();

    // 1. Remove file extensions (.mkv, .mp4, etc.)
    title = title.replace(/\.(mkv|mp4|avi|flv|wmv|ts|m4v|webm)$/i, '');

    // 2. Remove leading release group tags: e.g. [SubsPlease], (Ohys-Raws)
    title = title.replace(/^(\[[^\]]+\]|\([^\)]+\))\s*/g, '');

    // 3. Remove checksums like [629EC3D9] or (629EC3D9)
    title = title.replace(/[\[\(][0-9a-fA-F]{8}[\]\)]/g, '');

    // 4. Remove standard video/audio/release tags inside brackets or parentheses
    const bracketKeywords = (
      '1080p|720p|480p|2160p|4k|bd(?:rip)?|dvd(?:rip)?|bluray|blu-ray|web-?dl|webrip|hevc|x264|x265|av1|' +
      'h\\.?264|h\\.?265|10-?bit|8-?bit|flac|aac|opus|dual audio|multi-?audio|' +
      'multiple subtitle|batch|remux|uncensored|censored|funi|cr|funidual|' +
      'v\\d+|re-?upload|raw|sub(?:bed|s)?|dub(?:bed)?|(?:19|20)\\d{2}'
    );
    const bracketRegex = new RegExp(`[\\[\\(](?:${bracketKeywords})[^\\]\\)]*[\\]\\)]`, 'gi');
    title = title.replace(bracketRegex, '');

    // 5. Remove unbracketed quality/audio tags commonly at the end
    title = title.replace(/(?:[-_\s]+(?:1080p|720p|480p|2160p|4k|bdrip|web-?dl|hevc|x264|x265|batch|dual[- ]audio))+(?:.*)$/i, '');

    // 6. Remove episode indicators (e.g., " - 01", " - 01v2", " - S01E02", " Episode 15")
    let hadHyphenEp = false;
    if (/\s+-\s+(?:S\d+\s*)?(?:E|EP|Episode\s*)?\d+(?:\.\d+)?(?:v\d+)?(?:\s*-\s*\d+)?(?:\s|$)/i.test(title)) {
      title = title.replace(/\s+-\s+(?:S\d+\s*)?(?:E|EP|Episode\s*)?\d+(?:\.\d+)?(?:v\d+)?(?:\s*-\s*\d+)?.*$/i, '');
      hadHyphenEp = true;
    } else if (/\s+(?:#|EP|Episode)\s*\.?\s*\d+\b/i.test(title)) {
      title = title.replace(/\s+(?:#|EP|Episode)\s*\.?\s*\d+.*$/i, '');
      hadHyphenEp = true;
    }

    // 7. Normalize standalone season abbreviation (e.g. S01 -> Season 1)
    title = title.replace(/\bS0?(\d+)\b/g, 'Season $1');

    // 8. Clean any remaining bracketed tags at the end
    while (/(\[[^\]]*\]|\([^\)]*\))\s*$/.test(title)) {
      title = title.replace(/(\[[^\]]*\]|\([^\)]*\))\s*$/, '').trim();
    }

    // 9. If no hyphenated episode was found and title ends in a standalone number (e.g. "Title 01")
    // Keep it if preceded by Season, Part, Cour, Act, Vol
    if (!hadHyphenEp) {
      title = title.replace(/(?<!\bSeason)(?<!\bPart)(?<!\bAct)(?<!\bCour)(?<!\bVol)(?<!\bVolume)\s+\d{1,3}(?:v\d+)?$/i, '');
    }

    // 10. Clean trailing delimiters
    title = title.replace(/[\s\-_.:]+$/, '');

    // Replace underscores if no space exists
    if (!title.includes(' ') && title.includes('_')) {
      title = title.replace(/_/g, ' ');
    }

    return title.trim();
  }

  // --- Cache Helpers ---
  function getCachedResult(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    } catch (e) {
      // Ignore cache parse error
    }
    return null;
  }

  function setCachedResult(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {
      // Ignore storage error
    }
  }

  // --- MyAnimeList Query Services ---
  async function queryJikan(query, type) {
    const url = `https://api.jikan.moe/v4/${type}?q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetchJson(url);
    if (response && response.data && response.data.length > 0) {
      const item = response.data[0];
      return {
        id: item.mal_id,
        url: item.url,
        title: item.title_english || item.title,
        originalTitle: item.title,
        poster: item.images?.jpg?.large_image_url || item.images?.webp?.large_image_url || item.images?.jpg?.image_url,
        score: item.score || null,
        type: item.type || null,
        episodes: item.episodes || null,
        status: item.status || null
      };
    }
    return null;
  }

  async function queryMalPrefix(query, type) {
    const url = `https://myanimelist.net/search/prefix.json?type=${type}&keyword=${encodeURIComponent(query)}`;
    const response = await fetchJson(url, {
      'Referer': 'https://myanimelist.net/',
      'X-Requested-With': 'XMLHttpRequest'
    });
    if (response && response.categories) {
      for (const cat of response.categories) {
        if (cat.items && cat.items.length > 0) {
          const item = cat.items[0];
          // Upgrade thumbnail to full resolution by removing the resize segment (/r/100x140) and query parameters
          let poster = item.image_url || '';
          if (poster && poster.includes('/r/')) {
            poster = poster.replace(/\/r\/\d+x\d+/, '').split('?')[0];
          }
          return {
            id: item.id,
            url: item.url,
            title: item.name,
            originalTitle: item.name,
            poster: poster,
            score: item.payload?.score ? parseFloat(item.payload.score) : null,
            type: item.payload?.media_type || null,
            episodes: null,
            status: item.payload?.status || null
          };
        }
      }
    }
    return null;
  }

  async function searchMAL(query, type = 'anime') {
    // 1. Primary: Direct MAL search suggestions (typically responds in 50-150ms)
    try {
      const malResult = await queryMalPrefix(query, type);
      if (malResult) return malResult;
    } catch (e) {
      console.warn('[Nyaa MAL] MAL prefix search failed:', e);
    }

    // 2. If query contains subtitle separator (e.g., "-"), try base title with MAL prefix
    if (query.includes('-')) {
      const baseQuery = query.split('-')[0].trim();
      if (baseQuery && baseQuery.length > 2 && baseQuery !== query) {
        try {
          const fallbackResult = await queryMalPrefix(baseQuery, type);
          if (fallbackResult) return fallbackResult;
        } catch (e) {
          // ignore
        }
      }
    }

    // 3. Fallback: Jikan API v4 (if MAL prefix had no match or was blocked)
    try {
      const jikanResult = await queryJikan(query, type);
      if (jikanResult) return jikanResult;
    } catch (e) {
      console.warn('[Nyaa MAL] Jikan fallback failed:', e);
    }

    // 4. Secondary fallback on Jikan with base title
    if (query.includes('-')) {
      const baseQuery = query.split('-')[0].trim();
      if (baseQuery && baseQuery.length > 2 && baseQuery !== query) {
        try {
          const fallbackResult = await queryJikan(baseQuery, type);
          if (fallbackResult) return fallbackResult;
        } catch (e) {
          // ignore
        }
      }
    }

    return null;
  }

  // --- Modal Lightbox for Poster ---
  function openPosterLightbox(imgUrl, title) {
    const existing = document.querySelector('.nyaa-mal-modal-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'nyaa-mal-modal-backdrop';

    const img = document.createElement('img');
    img.className = 'nyaa-mal-modal-content';
    img.src = imgUrl;
    img.alt = title || 'Anime Poster';

    backdrop.appendChild(img);
    backdrop.addEventListener('click', () => backdrop.remove());

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        backdrop.remove();
        window.removeEventListener('keydown', onKeyDown);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    document.body.appendChild(backdrop);
  }

  // --- UI Injection ---
  function init() {
    // 1. Extract Torrent Title from panel
    const titleEl = document.querySelector('.panel .panel-heading .panel-title');
    if (!titleEl) return;

    const rawTitle = titleEl.textContent.trim();
    const torrentId = window.location.pathname.replace(/\/view\/(\d+).*/, '$1');
    const cleanedTitle = cleanAnimeTitle(rawTitle);

    // 2. Identify Category (Anime vs Literature/Manga)
    const categoryLinks = Array.from(document.querySelectorAll('.panel .panel-body a[href*="?c="]'));
    const isLiterature = categoryLinks.some(a => a.textContent.toLowerCase().includes('literature'));
    const mediaType = isLiterature ? 'manga' : 'anime';

    // 3. Setup Layout Container in panel-body
    const panelBody = document.querySelector('.panel .panel-body');
    if (!panelBody) return;

    // Check if already modified
    if (panelBody.querySelector('.nyaa-mal-flex-wrapper')) return;

    // Move existing rows into a metadata column wrapper
    const rows = Array.from(panelBody.children);
    const flexWrapper = document.createElement('div');
    flexWrapper.className = 'nyaa-mal-flex-wrapper';

    const metaCol = document.createElement('div');
    metaCol.className = 'nyaa-mal-meta-col';

    rows.forEach(r => metaCol.appendChild(r));
    flexWrapper.appendChild(metaCol);

    // Poster Column
    const posterCol = document.createElement('div');
    posterCol.className = 'nyaa-mal-poster-col';
    flexWrapper.appendChild(posterCol);

    panelBody.appendChild(flexWrapper);

    // 4. Inject dedicated MAL metadata row into the metadata table
    const malRow = document.createElement('div');
    malRow.className = 'row nyaa-mal-row';

    const malLabelContainer = document.createElement('div');
    malLabelContainer.className = 'nyaa-mal-label';
    malLabelContainer.textContent = 'MyAnimeList:';

    const malValueContainer = document.createElement('div');
    malValueContainer.className = 'nyaa-mal-value';

    malRow.appendChild(malLabelContainer);
    malRow.appendChild(malValueContainer);
    metaCol.appendChild(malRow);

    // Set Initial Loading State
    malValueContainer.innerHTML = `
      <span class="text-muted"><i class="fa fa-spinner fa-spin"></i> Searching MAL for <em>"${escapeHtml(cleanedTitle)}"</em>...</span>
    `;

    // 5. Function to Render Anime Information
    function renderAnimeData(animeData, queryUsed) {
      if (!animeData) {
        const manualSearchUrl = `https://myanimelist.net/${mediaType}.php?q=${encodeURIComponent(queryUsed)}`;
        malValueContainer.innerHTML = `
          <span class="text-muted">Not found automatically.</span>
          <a href="${manualSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-link" style="margin-left:5px;">Search MAL manually</a>
          <a class="nyaa-mal-edit-btn" title="Edit search query"><i class="fa fa-pencil"></i></a>
        `;
        posterCol.innerHTML = `
          <div class="nyaa-mal-poster-card" style="opacity: 0.7;">
            <div style="padding: 30px 10px; color: #888; font-size: 12px;">
              <i class="fa fa-picture-o fa-2x" style="margin-bottom: 8px;"></i>
              <div>No poster found</div>
            </div>
            <a href="${manualSearchUrl}" target="_blank" rel="noopener noreferrer" class="nyaa-mal-btn-mal">
              <i class="fa fa-search"></i> Search MAL
            </a>
          </div>
        `;
        setupEditButton(queryUsed);
        return;
      }

      // Render Metadata Link & Badges
      let badgesHtml = '';
      if (animeData.score) {
        badgesHtml += `<span class="nyaa-mal-score-badge" title="MAL Score">★ ${animeData.score.toFixed(2)}</span>`;
      }
      const typeInfo = [animeData.type, animeData.episodes ? `${animeData.episodes} eps` : null].filter(Boolean).join(', ');
      if (typeInfo) {
        badgesHtml += `<span class="nyaa-mal-type-badge">${escapeHtml(typeInfo)}</span>`;
      }

      malValueContainer.innerHTML = `
        <a href="${escapeHtml(animeData.url)}" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">
          ${escapeHtml(animeData.title)}
        </a>
        ${badgesHtml}
        <a class="nyaa-mal-edit-btn" title="Change linked anime"><i class="fa fa-pencil"></i></a>
      `;

      // Render Poster Card
      const posterUrl = animeData.poster || 'https://myanimelist.net/images/qm_50.gif';
      posterCol.innerHTML = `
        <div class="nyaa-mal-poster-card">
          <div class="nyaa-mal-poster-link" title="${escapeHtml(animeData.title)}">
            <a href="${escapeHtml(animeData.url)}" target="_blank" rel="noopener noreferrer">
              <img class="nyaa-mal-poster-img" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(animeData.title)} Poster" onerror="this.src='https://myanimelist.net/images/qm_50.gif'">
            </a>
            <button type="button" class="nyaa-mal-poster-zoom-btn" title="Enlarge Poster">
              <i class="fa fa-search-plus"></i>
            </button>
          </div>
          <a href="${escapeHtml(animeData.url)}" target="_blank" rel="noopener noreferrer" class="nyaa-mal-btn-mal">
            <i class="fa fa-external-link"></i> MyAnimeList
          </a>
        </div>
      `;

      // Attach zoom handler
      const zoomBtn = posterCol.querySelector('.nyaa-mal-poster-zoom-btn');
      if (zoomBtn) {
        zoomBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openPosterLightbox(posterUrl, animeData.title);
        });
      }

      setupEditButton(queryUsed);
    }

    // Setup Edit Query Input
    function setupEditButton(currentQuery) {
      const editBtn = malValueContainer.querySelector('.nyaa-mal-edit-btn');
      if (!editBtn) return;

      editBtn.addEventListener('click', () => {
        const existingForm = malValueContainer.querySelector('.nyaa-mal-search-box');
        if (existingForm) {
          existingForm.remove();
          return;
        }

        const form = document.createElement('div');
        form.className = 'nyaa-mal-search-box';
        form.innerHTML = `
          <input type="text" class="form-control" value="${escapeHtml(currentQuery)}" placeholder="Search MAL...">
          <button type="button" class="btn btn-primary btn-sm btn-search">Go</button>
          <button type="button" class="btn btn-default btn-sm btn-cancel">Cancel</button>
        `;

        const input = form.querySelector('input');
        const searchBtn = form.querySelector('.btn-search');
        const cancelBtn = form.querySelector('.btn-cancel');

        const executeCustomSearch = () => {
          const newQuery = input.value.trim();
          if (newQuery) {
            malValueContainer.innerHTML = `<span class="text-muted"><i class="fa fa-spinner fa-spin"></i> Searching MAL for <em>"${escapeHtml(newQuery)}"</em>...</span>`;
            performSearch(newQuery, true);
          }
        };

        searchBtn.addEventListener('click', executeCustomSearch);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') executeCustomSearch();
          if (e.key === 'Escape') form.remove();
        });
        cancelBtn.addEventListener('click', () => form.remove());

        malValueContainer.appendChild(form);
        input.focus();
        input.select();
      });
    }

    // 6. Perform Search with Caching
    async function performSearch(query, forceRefresh = false) {
      const cacheKey = `${torrentId}_${query}`;
      if (!forceRefresh) {
        const cached = getCachedResult(cacheKey);
        if (cached) {
          renderAnimeData(cached, query);
          return;
        }
      }

      try {
        const animeData = await searchMAL(query, mediaType);
        if (animeData) {
          setCachedResult(cacheKey, animeData);
        }
        renderAnimeData(animeData, query);
      } catch (err) {
        console.error('[Nyaa MAL] Search failed:', err);
        renderAnimeData(null, query);
      }
    }

    // Run initial search
    performSearch(cleanedTitle);
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Bootstrap ---
  injectStyles();

  function tryInit() {
    if (document.querySelector('.panel .panel-heading .panel-title')) {
      init();
      return true;
    }
    return false;
  }

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => {
      tryInit();
      observer.disconnect();
    });
  }
})();
