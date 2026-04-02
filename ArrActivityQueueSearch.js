// ==UserScript==
// @name         ArrActivityQueueSearch
// @namespace    arr-activity-queue-search
// @version      0.0.5
// @description  Adds a search button for unlinked queue rows in Radarr and Sonarr
// @match        http://192.168.12.2:9603/activity/queue*
// @match        http://192.168.12.2:9602/activity/queue*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const isSonarr = location.port === "9602";
  const appName = isSonarr ? "Sonarr" : "Radarr";

  injectStyles();
  scanRows();

  const observer = new MutationObserver(() => {
    scanRows();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Injects the CSS used by the search icon button, moved user button, and the no-wrap icon group.
  function injectStyles() {
    if (document.getElementById("tm-queue-search-style")) return;

    const style = document.createElement("style");
    style.id = "tm-queue-search-style";
    style.textContent = `
        .tm-queue-search-icon-group {
            display: inline-flex;
            align-items: center;
            flex-wrap: nowrap;
            white-space: nowrap;
        }

        .tm-queue-search-icon-btn,
        .tm-queue-moved-user-btn {
            margin-left: 6px;
            padding: 0;
            width: 18px;
            height: 18px;
            border: none;
            background: transparent;
            color: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
            opacity: 0.85;
            flex: 0 0 auto;
        }

        .tm-queue-search-icon-btn:hover,
        .tm-queue-moved-user-btn:hover {
            opacity: 1;
        }

        .tm-queue-search-icon-btn svg,
        .tm-queue-moved-user-btn svg {
            width: 13px;
            height: 13px;
            display: block;
        }
    `;
    document.head.appendChild(style);
  }

  // Replaces German digraphs in a title so ae/oe/ue become ä/ö/ü.
  function replaceGermanDigraphs(text) {
    return text
      .replace(/AE/g, "Ä")
      .replace(/OE/g, "Ö")
      .replace(/UE/g, "Ü")
      .replace(/Ae/g, "Ä")
      .replace(/Oe/g, "Ö")
      .replace(/Ue/g, "Ü")
      .replace(/ae/g, "ä")
      .replace(/oe/g, "ö")
      .replace(/ue/g, "ü");
  }

  // Normalizes a filename into a cleaner search term for Radarr or Sonarr.
  function normalizeSearchTerm(filename) {
    let text = (filename || "").trim();

    // remove file extension
    text = text.replace(/\.[a-z0-9]{2,5}$/i, "");

    // dots / underscores / hyphens to spaces
    text = text.replace(/[._-]+/g, " ");

    // Sonarr: remove season/episode marker and everything after it
    if (isSonarr) {
      text = text.replace(/\bS\d{1,2}(?:E\d{1,2})*(?:\b|$).*$/i, "");
      text = text.replace(/\bSeason\s+\d+\b.*$/i, "");
    }

    // keep only up to and including the year, if present
    const yearMatch = text.match(/^(.*?\b(?:19|20)\d{2}\b)/);
    if (yearMatch) {
      text = yearMatch[1];
    }

    text = replaceGermanDigraphs(text);
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }

  // Builds the add/new search URL for the current app instance.
  function buildSearchUrl(term) {
    return `${location.origin}/add/new?term=${encodeURIComponent(term)}`;
  }

  // Creates the clickable search icon button that opens the normalized search.
  function createSearchButton(term) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tm-queue-search-icon-btn";
    button.title = `Search in ${appName}: ${term}`;
    button.setAttribute("aria-label", `Search in ${appName}: ${term}`);

    button.innerHTML = `
        <svg aria-hidden="true" viewBox="0 0 512 512">
            <path fill="currentColor" d="M416 208c0 45.9-14.9 88.3-40 122.7l123.6 123.6c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376C296.3 401.1 253.9 416 208 416 93.1 416 0 322.9 0 208S93.1 0 208 0s208 93.1 208 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"></path>
        </svg>
    `;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.open(buildSearchUrl(term), "_blank");
    });

    return button;
  }

  // Wraps the existing status icon and the new icons into a single no-wrap container.
  function ensureIconGroup(statusCell) {
    let group = statusCell.querySelector(".tm-queue-search-icon-group");
    if (group) return group;

    const existingIcon = statusCell.querySelector("span");
    if (!existingIcon) return null;

    group = document.createElement("span");
    group.className = "tm-queue-search-icon-group";

    existingIcon.parentNode.insertBefore(group, existingIcon);
    group.appendChild(existingIcon);

    return group;
  }

  // Finds the existing user button in the actions cell and moves it next to the search button.
  function moveUserButtonToIconGroup(row, group) {
    if (!group) return;

    if (group.querySelector(".tm-queue-moved-user-btn")) return;

    const cells = row.querySelectorAll("td");
    if (!cells.length) return;

    const actionsCell = cells[cells.length - 1];
    if (!actionsCell) return;

    const userIcon = actionsCell.querySelector('svg[data-icon="user"]');
    const userButton = userIcon ? userIcon.closest("button") : null;

    if (!userButton) return;

    userButton.classList.add("tm-queue-moved-user-btn");
    group.appendChild(userButton);
  }

  // Scans queue rows, always moves the user button, and only adds a search icon for plain-text titles.
  function scanRows() {
    const rows = document.querySelectorAll("tr");

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue;

      const statusCell = cells[1];
      const titleCell = cells[2];

      if (!statusCell || !titleCell) continue;

      const group = ensureIconGroup(statusCell);
      if (!group) continue;

      // Always move the user button, regardless of whether the title is linked.
      moveUserButtonToIconGroup(row, group);

      // If title is already a link, do not add a search button.
      if (titleCell.querySelector("a")) continue;

      const rawTitle = titleCell.textContent.trim();
      if (!rawTitle) continue;

      // Only add the search button once.
      if (!statusCell.querySelector(".tm-queue-search-icon-btn")) {
        const searchTerm = normalizeSearchTerm(rawTitle);
        if (!searchTerm) continue;

        const button = createSearchButton(searchTerm);
        group.appendChild(button);
      }
    }
  }
})();