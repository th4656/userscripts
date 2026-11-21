// ==UserScript==
// @name         BookWalker Viewer Force Black Background
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Intercepts BookWalker two-page split fills and sets background to pitch black
// @match        https://viewer-subscription.bookwalker.jp/*/viewer.html*
// @match        https://viewer.bookwalker.jp/*/viewer.html*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // 1. Force outer container styles to black
  const style = document.createElement("style");
  style.textContent = `
        html, body, #root, #viewer, #renderer,
        #viewport0, #viewport1, #viewportW, #canvasCluster,
        .loading, #trackingImageArea, canvas {
            background-color: #000000 !important;
            background: #000000 !important;
        }
    `;
  (document.head || document.documentElement).appendChild(style);

  // 2. Patch 2D Canvas context directly in the page environment
  const origFillRect = CanvasRenderingContext2D.prototype.fillRect;

  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    // Match BookWalker's white half-screen splits (w >= 40% of canvas) or full bottom bars
    const isWhite =
      this.fillStyle === "#ffffff" ||
      this.fillStyle === "#fff" ||
      this.fillStyle === "rgb(255, 255, 255)" ||
      this.fillStyle === "white";

    if (isWhite) {
      const isHalfOrFullScreen = w >= this.canvas.width * 0.4 && h >= this.canvas.height * 0.8;
      const isBottomTrackerBar = y >= this.canvas.height - 5;

      if (isHalfOrFullScreen || isBottomTrackerBar) {
        const prev = this.fillStyle;
        this.fillStyle = "#000000";
        const result = origFillRect.call(this, x, y, w, h);
        this.fillStyle = prev;
        return result;
      }
    }

    return origFillRect.apply(this, arguments);
  };
})();
