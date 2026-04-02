// ==UserScript==
// @name         ArrActivityQueueSearch
// @namespace    arr-activity-queue-search
// @version      0.1.3
// @description  Adds a search button for unlinked queue rows in Radarr and Sonarr
// @match        http://localhost:7878/*
// @match        http://localhost:8989/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// NOTE: To setup go to the `Tamplermonkey Dashboard` --> `Installed Userscripts` and edit the script.
// Open the scripts `Settings` tab and add `Includes/Excludes` --> `User matches`:
// IP:Port/* your Sonarr and Radarr instances are reachable at (eg. `192.168.200.50:7878/*` means, the
// script will be injected on any page that matches this address).

(function () {
    "use strict";

    const isSonarr = location.port === "9602";
    const appName = isSonarr ? "Sonarr" : "Radarr";

    let queueObserver = null;
    let routeWatcherStarted = false;

    init();

    // Starts the userscript and hooks into SPA navigation.
    function init() {
        injectStyles();
        watchRouteChanges();
        handleRouteChange();
    }

    // Returns true only on the queue page.
    function isQueuePage() {
        return location.pathname === "/activity/queue";
    }

    // Starts queue-specific DOM watching.
    function startQueueObserver() {
        if (queueObserver) return;

        scanRows();

        queueObserver = new MutationObserver(() => {
            if (!isQueuePage()) return;
            scanRows();
        });

        queueObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    // Stops queue-specific DOM watching when leaving the queue page.
    function stopQueueObserver() {
        if (!queueObserver) return;
        queueObserver.disconnect();
        queueObserver = null;
    }

    // Enables or disables queue features depending on the current route.
    function handleRouteChange() {
        if (isQueuePage()) {
            startQueueObserver();
            scanRows();
        } else {
            stopQueueObserver();
        }
    }

    // Hooks into pushState/replaceState/popstate so route changes inside the SPA are detected.
    function watchRouteChanges() {
        if (routeWatcherStarted) return;
        routeWatcherStarted = true;

        const notify = () => {
            setTimeout(handleRouteChange, 0);
        };

        const originalPushState = history.pushState;
        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            notify();
            return result;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            notify();
            return result;
        };

        window.addEventListener("popstate", notify);

        // Fallback for apps that mutate the DOM before/without history hooks being obvious.
        let lastPath = location.pathname;
        setInterval(() => {
            if (location.pathname !== lastPath) {
                lastPath = location.pathname;
                handleRouteChange();
            }
        }, 500);
    }

    // Injects the CSS used by the status/tool icon groups.
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

        .tm-queue-tool-group {
            display: inline-flex;
            align-items: center;
            flex-wrap: nowrap;
            white-space: nowrap;
            margin-left: 6px; /* gap between status icon and tools */
            gap: 2px;         /* gap between user and search */
        }

        .tm-queue-search-icon-btn,
        .tm-queue-moved-user-btn {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            min-width: 0 !important;
            height: 18px;
            border: none;
            background: transparent;
            color: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
            line-height: 1;
            opacity: 0.85;
            flex: 0 0 auto;
            transition: color 120ms ease, opacity 120ms ease;
        }

        .tm-queue-search-icon-btn:hover,
        .tm-queue-moved-user-btn:hover {
            color: var(--defaultLinkHoverColor, #fff);
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

    // Ensures there is a subgroup for tool icons so they stay visually grouped together.
    function ensureToolGroup(iconGroup) {
        let toolGroup = iconGroup.querySelector(".tm-queue-tool-group");
        if (toolGroup) return toolGroup;

        toolGroup = document.createElement("span");
        toolGroup.className = "tm-queue-tool-group";
        iconGroup.appendChild(toolGroup);

        return toolGroup;
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
        button.className = "IconButton-button-t4C5V Link-link-RInnp tm-queue-search-icon-btn";
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

    // Finds the existing user button in the actions cell and moves it into the tool group.
    function moveUserButtonToIconGroup(row, toolGroup) {
        if (!toolGroup) return;
        if (toolGroup.querySelector(".tm-queue-moved-user-btn")) return;

        const cells = row.querySelectorAll("td");
        if (!cells.length) return;

        const actionsCell = cells[cells.length - 1];
        if (!actionsCell) return;

        const userIcon = actionsCell.querySelector('svg[data-icon="user"]');
        const userButton = userIcon ? userIcon.closest("button") : null;
        if (!userButton) return;

        userButton.classList.add("tm-queue-moved-user-btn");
        toolGroup.appendChild(userButton);
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

            const iconGroup = ensureIconGroup(statusCell);
            if (!iconGroup) continue;

            const toolGroup = ensureToolGroup(iconGroup);

            // Always move the user button, regardless of whether the title is linked.
            moveUserButtonToIconGroup(row, toolGroup);

            // If title is already a link, do not add a search button.
            if (titleCell.querySelector("a")) continue;

            const rawTitle = titleCell.textContent.trim();
            if (!rawTitle) continue;

            if (!toolGroup.querySelector(".tm-queue-search-icon-btn")) {
                const searchTerm = normalizeSearchTerm(rawTitle);
                if (!searchTerm) continue;

                const button = createSearchButton(searchTerm);
                toolGroup.appendChild(button);
            }
        }
    }
})();