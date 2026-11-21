// ==UserScript==
// @name         HN Parent Comment Preview
// @namespace    https://github.com/homura/userscripts
// @version      1.0.0
// @description  Show a popup preview of the parent comment when hovering or focusing "parent" links on Hacker News.
// @author       homura
// @match        https://news.ycombinator.com/item*
// @match        https://news.ycombinator.com/threads*
// @icon         https://news.ycombinator.com/y18.svg
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const POPUP_ID = 'hn-parent-preview';
  const ANCHOR_CLASS = 'hn-parent-anchor';
  const SHOW_DELAY_MS = 150;
  const HIDE_DELAY_MS = 150;

  const supportsPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
  const supportsAnchor =
    typeof CSS !== 'undefined' &&
    CSS.supports('position-area: block-end') &&
    CSS.supports('anchor-name: --a');

  const style = document.createElement('style');
  style.textContent = `
    .${ANCHOR_CLASS} {
      anchor-name: --hn-parent-trigger;
    }

    #${POPUP_ID} {
      box-sizing: border-box;
      width: max-content;
      max-width: min(680px, calc(100vw - 24px));
      max-height: min(60vh, 480px);
      overflow-y: auto;
      padding: 8px 12px;
      background: #f6f6ef;
      color: #000;
      border: 1px solid #ff6600;
      border-left: 3px solid #ff6600;
      border-radius: 3px;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
      text-align: left;
      opacity: 0;
    }

    #${POPUP_ID}:is(:popover-open, .hn-open) {
      opacity: 1;
    }

    #${POPUP_ID}:not([popover]) {
      display: none;
      position: fixed;
      z-index: 9999;
    }

    #${POPUP_ID}:not([popover]).hn-open {
      display: block;
    }

    @supports (position-area: block-end) and (anchor-name: --a) {
      #${POPUP_ID} {
        position-anchor: --hn-parent-trigger;
        inset: auto;
        margin: 6px 0;
        position-area: block-end span-inline-end;
        position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
      }
    }

    @starting-style {
      #${POPUP_ID}:is(:popover-open, .hn-open) {
        opacity: 0;
        transform: translateY(-4px);
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      #${POPUP_ID} {
        transition: opacity 0.12s ease, transform 0.12s ease, display 0.12s ease, overlay 0.12s ease;
        transition-behavior: allow-discrete;
      }
    }

    #${POPUP_ID} .hn-parent-head {
      margin-bottom: 6px;
    }

    #${POPUP_ID} .commtext {
      word-break: break-word;
    }
  `;
  document.head.appendChild(style);

  const popup = document.createElement('div');
  popup.id = POPUP_ID;
  popup.setAttribute('role', 'tooltip');
  if (supportsPopover) {
    // Use attribute (not IDL property) per popover guidance; falls back to "manual" where "hint" is unsupported.
    popup.setAttribute('popover', 'hint');
  }
  document.body.appendChild(popup);

  let activeLink = null;
  let showTimer = null;
  let hideTimer = null;

  const clearTimers = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
  };

  const isOpen = () =>
    supportsPopover ? popup.matches(':popover-open') : popup.classList.contains('hn-open');

  // ponytail: only handles in-page #id parents; fetch item?id= if off-page previews on /newcomments or permalinks are wanted.
  const getParentLink = (target) => {
    const link = target?.closest?.('.navs a[href^="#"]');
    return link && link.textContent.trim() === 'parent' ? link : null;
  };

  const buildContent = (parentRow) => {
    const frag = document.createDocumentFragment();

    const comhead = parentRow.querySelector('.comhead');
    if (comhead) {
      const headClone = comhead.cloneNode(true);
      headClone.querySelector('.navs')?.remove();
      headClone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      const headWrap = document.createElement('div');
      headWrap.className = 'hn-parent-head';
      headWrap.appendChild(headClone);
      frag.appendChild(headWrap);
    }

    const body = parentRow.querySelector('.commtext') || parentRow.querySelector('.comment');
    if (body) {
      const bodyClone = body.cloneNode(true);
      bodyClone.classList.remove('noshow');
      bodyClone.querySelector('.reply')?.remove();
      bodyClone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      const defaultWrap = document.createElement('div');
      defaultWrap.className = 'default';
      const commentWrap = document.createElement('div');
      commentWrap.className = 'comment';
      commentWrap.appendChild(bodyClone);
      defaultWrap.appendChild(commentWrap);
      frag.appendChild(defaultWrap);
    }

    return frag;
  };

  const positionFallback = (link) => {
    const rect = link.getBoundingClientRect();
    const pop = popup.getBoundingClientRect();
    const gap = 6;
    const pad = 12;

    const left = Math.max(pad, Math.min(rect.left, window.innerWidth - pop.width - pad));
    const below = rect.bottom + gap;
    const above = rect.top - pop.height - gap;
    const top =
      below + pop.height <= window.innerHeight - pad || above < pad
        ? Math.min(below, Math.max(pad, window.innerHeight - pop.height - pad))
        : above;

    popup.style.inset = 'auto';
    popup.style.margin = '0';
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };

  const setActiveLink = (link) => {
    if (activeLink && activeLink !== link) {
      activeLink.classList.remove(ANCHOR_CLASS);
      if (activeLink.getAttribute('aria-describedby') === POPUP_ID) {
        activeLink.removeAttribute('aria-describedby');
      }
    }
    activeLink = link;
    if (link) {
      link.classList.add(ANCHOR_CLASS);
      if (!link.hasAttribute('aria-describedby')) {
        link.setAttribute('aria-describedby', POPUP_ID);
      }
    }
  };

  const show = (link) => {
    const parentId = link.getAttribute('href').slice(1);
    const parentRow = parentId && document.getElementById(parentId);
    if (!parentRow) return;

    const content = buildContent(parentRow);
    if (!content.childNodes.length) return;

    setActiveLink(link);
    popup.replaceChildren(content);
    popup.scrollTop = 0;

    if (!isOpen()) {
      if (supportsPopover) {
        popup.showPopover();
      } else {
        popup.classList.add('hn-open');
      }
    }

    if (!supportsAnchor) {
      positionFallback(link);
    }
  };

  const hide = () => {
    clearTimers();
    if (isOpen()) {
      if (supportsPopover) {
        popup.hidePopover();
      } else {
        popup.classList.remove('hn-open');
      }
    }
    setActiveLink(null);
  };

  const scheduleShow = (link) => {
    clearTimers();
    const delay = isOpen() ? 0 : SHOW_DELAY_MS;
    if (delay === 0) {
      show(link);
    } else {
      showTimer = setTimeout(() => show(link), delay);
    }
  };

  const scheduleHide = () => {
    clearTimeout(showTimer);
    showTimer = null;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
  };

  document.addEventListener('mouseover', (e) => {
    const link = getParentLink(e.target);
    if (link) scheduleShow(link);
  });

  document.addEventListener('mouseout', (e) => {
    const link = getParentLink(e.target);
    if (link && !link.contains(e.relatedTarget)) scheduleHide();
  });

  document.addEventListener('focusin', (e) => {
    const link = getParentLink(e.target);
    if (link) scheduleShow(link);
  });

  document.addEventListener('focusout', (e) => {
    if (activeLink && !popup.contains(e.relatedTarget) && e.relatedTarget !== activeLink) {
      scheduleHide();
    }
  });

  document.addEventListener('click', (e) => {
    if (getParentLink(e.target)) hide();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) hide();
  });

  popup.addEventListener('mouseenter', clearTimers);
  popup.addEventListener('mouseleave', scheduleHide);
  popup.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') setActiveLink(null);
  });
})();
