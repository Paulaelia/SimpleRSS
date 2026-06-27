const elements = {};
let feeds = [];

window.addEventListener("DOMContentLoaded", () => {
  console.log("popup.js loaded successfully");
  elements.urlInput = document.getElementById("rss-url");
  elements.loadButton = document.getElementById("load-feed");
  elements.clearButton = document.getElementById("clear-feeds");
  elements.refreshButton = document.getElementById("refresh-page");
  elements.results = document.getElementById("accordion");
  elements.spinner = document.getElementById("loading-spinner");
  hideSpinner();
  console.log("Spinner loaded");
  elements.error = document.getElementById("error-message");
  hideError();
  console.log("error box hidden");
  displayFeeds();

  elements.loadButton.addEventListener("click", loadFeed);
  elements.clearButton.addEventListener("click", clearFeeds);
  elements.refreshButton.addEventListener("click", displayFeeds);
  console.log("Elements loaded and event listeners attached", elements);

  
});

// #region Spinner Functions
function showSpinner() {
  elements.spinner.style.display = "block";
  elements.results.innerHTML = "";
}

function hideSpinner() {
  elements.spinner.style.display = "none";
}
// #endregion

// #region Error Functions
function showError(message) {
  elements.error.innerHTML += "<p>" + message + "</p>";
  elements.error.style.display = "block";
}

function hideError() {
  elements.error.innerHTML = "";
  elements.error.style.display = "none";
}
// #endregion

// #region Refresh Functions
function enableRefreshButton() {
    elements.refreshButton.disabled = false;
}

function disableRefreshButton() {
    elements.refreshButton.disabled = true;
}
// #endregion

// #region Add Feed Functions
function enableAddButton() {
    elements.loadButton.disabled = false;
}

function disableAddButton() {
    elements.loadButton.disabled = true;
}
// #endregion

// #region Update Functions
async function updateFeed(event) {
  const id = event.target.id.split("-")[1];
  const feed = feeds[id];

  try {
    const xmlText = await fetchRss(feed.url);
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) {
      showError("Update Feed: Feed XML is invalid or could not be parsed.");
    }
    const channel = doc.querySelector("channel");
    const updated = new Date(channel?.querySelector("pubDate")?.textContent?.trim() || doc.querySelector("feed > updated")?.textContent?.trim() || Date.now());

    feed.updated = updated;

    await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
    displayFeeds();
  } catch (error) {
    showError(error.message);
  }
}
// #endregion

// #region Display Feed Functions
async function loadFeeds() {
  chromeFeeds = await chrome.storage.sync.get("feeds");
  feeds = JSON.parse(chromeFeeds.feeds || "[]");
}

function getFeedDate(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    showError("Feed Date: Feed XML is invalid or could not be parsed.");
  }
  const channel = doc.querySelector("channel");
  const updated = new Date(channel?.querySelector("pubDate")?.textContent?.trim() || doc.querySelector("feed > updated")?.textContent?.trim() || Date.now());
  return updated;
}

async function displayFeeds() {
  disableRefreshButton();
  disableAddButton();
  hideError();
  showSpinner();
  await loadFeeds();
  updatedFeeds = 0;
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    const xmlText = await fetchRss(feed.url);
    const rssText = await parseRss(xmlText);
    let imageUrl = "/images/rss.png";
    if (feed.url.startsWith("https://forums.sufficientvelocity.com/")) {
      imageUrl = "/images/sv.png";
    }
    else if (feed.url.startsWith("https://forums.spacebattles.com/")) {
      imageUrl = "/images/sb.png";
    }

    let htmlResult = "";
    if (getFeedDate(xmlText) > new Date(feed.updated)) {
      // NEW FEED UPDATE
      htmlResult += '<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse' + i + '" aria-expanded="false" aria-controls="collapse' + i + '">' +
        '<span><img src="' + imageUrl + '" alt="RSS" class="favicon"></span>' + feed.title + '<span class="badge rounded-pill text-bg-danger">NEW</span></button></h2>' +
        '<div id="collapse' + i + '" class="accordion-collapse collapse" data-bs-parent="#accordion"><div class="accordion-body"><p>' +
        '<button id="update-' + i + '" class="btn btn-outline-primary">Mark Read</button>';
      updatedFeeds++;
    } else {
      htmlResult += '<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse' + i + '" aria-expanded="false" aria-controls="collapse' + i + '">' +
        '<span><img src="' + imageUrl + '" alt="RSS" class="favicon"></span>' + feed.title + '</button></h2>' +
        '<div id="collapse' + i + '" class="accordion-collapse collapse" data-bs-parent="#accordion"><div class="accordion-body"><p>';
    }
    htmlResult += '<button id="remove-' + i + '" class="btn btn-outline-danger">Remove</button>';
    if (i > 0) {
      htmlResult += '<button id="moveTop-' + i + '" class="btn btn-outline-success">Move to Top</button>';
    }
    if (i < feeds.length - 1) {
      htmlResult += '<button id="moveBottom-' + i + '" class="btn btn-outline-info">Move to Bottom</button>';
    }
    htmlResult += '</p>' +
      '<p><b>Last Updated:</b> <i>' + new Date(feed.updated).toLocaleString() + '</i></p>' +
      renderFeed(rssText) +
      '</div></div></div>';
    elements.results.innerHTML += htmlResult;
  }
  if (updatedFeeds > 0) {
    chrome.action.setBadgeText({ text: updatedFeeds.toLocaleString() });
  } else {
    chrome.action.setBadgeText({ text: null });
  }
  document.querySelectorAll(".btn-outline-danger").forEach((button) => {
    button.addEventListener("click", removeFeed);
  });
  document.querySelectorAll(".btn-outline-primary").forEach((button) => {
    button.addEventListener("click", updateFeed);
  });
  document.querySelectorAll(".btn-outline-success").forEach((button) => {
    button.addEventListener("click", moveFeedToTop);
  });
  document.querySelectorAll(".btn-outline-info").forEach((button) => {
    button.addEventListener("click", moveFeedToBottom);
  });
  hideSpinner();
  enableRefreshButton();
  enableAddButton();
}

function renderFeed(feed) {
  const list = document.createElement("div");

  if (feed.items.length === 0) {
    list.innerHTML = "<p>No items found in this feed.</p>";
  } else {
    feed.items.slice(0, 15).forEach((item) => {
      const itemCard = document.createElement("article");
      itemCard.className = "feed-item";

      const itemTitle = document.createElement("a");
      itemTitle.href = item.link || "#";
      itemTitle.target = "_blank";
      itemTitle.rel = "noopener noreferrer";
      itemTitle.textContent = item.title;
      itemTitle.className = "feed-item-title";

      const itemMeta = document.createElement("div");
      itemMeta.className = "feed-item-meta";
      itemMeta.textContent = item.pubDate;

      const itemDescription = document.createElement("p");
      itemDescription.textContent = item.description;
      itemDescription.className = "feed-item-description";

      itemCard.append(itemTitle, itemMeta, itemDescription);
      list.appendChild(itemCard);
    });
  }
  return list.innerHTML;
}
// #endregion

// #region Move Feed Functions
async function moveFeedToTop(event) {
  const id = event.target.id.split("-")[1];
  if (id === -1) return;
  feedToMove = feeds.splice(id, 1);
  feeds.unshift(feedToMove[0]);
  await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
  displayFeeds();
}

async function moveFeedToBottom(event) {
  const id = event.target.id.split("-")[1];
  if (id === -1) return;
  feedToMove = feeds.splice(id, 1);
  feeds.push(feedToMove[0]);
  await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
  displayFeeds();
}
// #endregion

// #region Remove Feed Functions
async function removeFeed(event) {
  const id = event.target.id.split("-")[1];
  feeds.splice(id, 1);
  await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
  displayFeeds();
}

async function clearFeeds() {
   await chrome.storage.sync.set({ "feeds": JSON.stringify([])});
   displayFeeds();
}
// #endregion

// #region Save New Feed Functions
async function loadFeed() {
  const feedUrl = elements.urlInput.value.trim();
  disableAddButton();
  disableRefreshButton();
  hideError();
  showSpinner();
  if (!feedUrl) {
    hideSpinner();
    enableAddButton();
    enableRefreshButton();
    showError("Please enter a feed URL.");
    return;
  }

  try {
    await loadFeeds();

    const newItem = {};
    const xmlText = await fetchRss(feedUrl);
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) {
      showError("Load Feed: Feed XML is invalid or could not be parsed.");
    }
    const channel = doc.querySelector("channel");
    const title = channel?.querySelector("title")?.textContent?.trim() || doc.querySelector("feed > title")?.textContent?.trim() || "Untitled feed";
    const updated = new Date(channel?.querySelector("pubDate")?.textContent?.trim() || doc.querySelector("feed > updated")?.textContent?.trim() || Date.now());

    newItem.url = feedUrl;
    newItem.title = title;
    newItem.updated = updated;

    //const feed = parseRss(xmlText);
    //renderFeed(feed);

    feeds.unshift(newItem);
    await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
    elements.urlInput.value = "";
    displayFeeds();
  } catch (error) {
    hideSpinner();
    enableAddButton();
    enableRefreshButton();
    showError(error.message);
  }
}
// #endregion

// #region Fetch RSS Functions
async function fetchRss(feedUrl) {
  try {
    return await fetchText(feedUrl);
  } catch (error) {
    showError(`Error fetching RSS Feed '${feedUrl}' - ${error.message}`);
  }
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    showError(`Unable to fetch feed '${url}' (Status: ${response.status})`);
  }
  return await response.text();
}

function parseRss(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    showError("Feed XML is invalid or could not be parsed.");
  }

  const channel = doc.querySelector("channel");
  const title = channel?.querySelector("title")?.textContent?.trim() || doc.querySelector("feed > title")?.textContent?.trim() || "Untitled feed";
  const itemNodes = channel ? Array.from(channel.querySelectorAll("item")) : Array.from(doc.querySelectorAll("entry"));

  const items = itemNodes.map((item) => {
    const linkNode = item.querySelector("link");
    const link = linkNode?.getAttribute("href") || linkNode?.textContent || "";

    return {
      title: item.querySelector("title")?.textContent?.trim() || "Untitled item",
      link: link.trim(),
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("updated")?.textContent?.trim() || "",
      description:
        item.querySelector("description")?.textContent?.trim() ||
        item.querySelector("summary")?.textContent?.trim() ||
        item.querySelector("content")?.textContent?.trim() ||
        "",
    };
  });

  return { title, items };
}
// #endregion
