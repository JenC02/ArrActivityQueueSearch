# ArrActivityQueueSearch

Adds a search button for unlinked activity queue elements in **Radarr** and **Sonarr**.

## What it does

For queue rows that are not matched cleanly, the script will:

- add a **search** button next to the row status icon
- move the existing **user/details** button next to the status icon
- Clicking the search icon will:
    - parses the movie/ tv show name from the filename
    - replaces `.`, `_`, and `-` with spaces
    - replaces `ae`, `oe`, `ue` with `ä`, `ö`, `ü`
    - removes season and episode information like `S01`, `S01E02` or `Season 1`
    - trims everything after the first detected year
    - opens the normalized term in the Radarr/ Sonarr add/search page

## Installation

### 1. Install Tampermonkey

Install the Tampermonkey browser extension.

### 2. Install the script

For automatic installation open [ArrActivityQueueSearch.user.js](./ArrActivityQueueSearch.user.js) and click the `[RAW]` button at the top. Tampermonkey should open its install screen. Confirm the installation.

Alternatively copy the code, open the Tampermonkey dashboard, click the `[+]` button to create a new script, delete the default content, paste the code and and save the file.

## Configuration

This script is intentionally configured with safe default `@match` entries for localhost and the default ports.

If your Radarr/Sonarr instances are reachable on different IPs, hostnames, or ports, configure Tampermonkey so the script is injected on those URLs too:

- Open the `Tamplermonkey Dashboard` → `Installed Userscripts` and edit the script.
- Open the scripts `Settings` tab and add `Includes/Excludes` → `User matches`: `IP:Port` your Sonarr and Radarr instances are reachable at. 

Examples:

- `192.168.200.50:7878/*`
- `http://192.168.200.50:8989/*`
- `radarr.local:7878/*`
- `http://sonarr.local:8989/*`

You can also edit the script header and add extra `@match` lines manually but those will be overridden when the script is updated.
