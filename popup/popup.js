const elements = {};

window.addEventListener("DOMContentLoaded", () => {
  elements.urlInput = document.getElementById("rss-url");
  elements.loadButton = document.getElementById("load-feed");
  elements.clearButton = document.getElementById("clear-feeds");
  elements.refreshButton = document.getElementById("refresh-page");
  elements.results = document.getElementById("accordion");
  elements.error = document.getElementById("error-message");
  elements.error.style.display = "none";

  elements.loadButton.addEventListener("click", () => loadFeed);
  elements.clearButton.addEventListener("click", () => clearFeeds);
  elements.refreshButton.addEventListener("click", () => displayFeeds);

  displayFeeds();
});

async function displayFeeds() {
  elements.results.innerHTML = "";
  chromeFeeds = await chrome.storage.sync.get("feeds");
  feeds = JSON.parse(chromeFeeds.feeds || "[]");
  for (const feed of feeds) {
    const xmlText = await parseRss(await fetchRss(feed.url));
    elements.results.innerHTML += '<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse' + feed.id + '" aria-expanded="false" aria-controls="collapse' + feed.id + '">' +
      feed.id + ': ' + feed.title + '</button></h2>' +
      '<div id="collapse' + feed.id + '" class="accordion-collapse collapse" data-bs-parent="#accordionExample"><div class="accordion-body">' +
      '<p><b>Last Updated:</b> <i>' + new Date(feed.updated).toLocaleString() + '</i><button id="remove-' + feed.id + '" class="btn btn-outline-danger float-end">Remove</button></p>' +
      renderFeed(xmlText) +
      '</div></div></div>';
    document.getElementById("remove-" + feed.id).addEventListener("click", () => removeFeed(feed.id));
  }
}

async function removeFeed(id) {
  chromeFeeds = await chrome.storage.sync.get("feeds");
  feeds = JSON.parse(chromeFeeds.feeds || "[]");
  feeds = feeds.filter((feed) => feed.id !== id);
  await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
  displayFeeds();
}

async function loadFeed() {
  const feedUrl = elements.urlInput.value.trim();
  elements.error.textContent = "";
  elements.error.style.display = "none";

  if (!feedUrl) {
    elements.error.textContent = "Please enter a feed URL.";
    elements.error.style.display = "block";
    return;
  }

  try {
    chromeFeeds = await chrome.storage.sync.get("feeds");
    feeds = JSON.parse(chromeFeeds.feeds || "[]");

    const newItem = {};
    const xmlText = await fetchRss(feedUrl);
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("Feed XML is invalid or could not be parsed.");
    }
    const channel = doc.querySelector("channel");
    const title = channel?.querySelector("title")?.textContent?.trim() || doc.querySelector("feed > title")?.textContent?.trim() || "Untitled feed";
    const updated = new Date(channel?.querySelector("pubDate")?.textContent?.trim() || doc.querySelector("feed > updated")?.textContent?.trim() || Date.now());

    newItem.id = feeds.length;
    newItem.url = feedUrl;
    newItem.title = title;
    newItem.updated = updated;

    //const feed = parseRss(xmlText);
    //renderFeed(feed);

    feeds.push(newItem);
    await chrome.storage.sync.set({ "feeds": JSON.stringify(feeds)});
    displayFeeds();
  } catch (error) {
    elements.error.textContent = error.message;
    //elements.results.innerHTML = "";
  }
}

async function clearFeeds() {
   await chrome.storage.sync.set({ "feeds": JSON.stringify([])});
   displayFeeds();
}

async function fetchRss(feedUrl) {
  try {
    return await fetchText(feedUrl);
  } catch (error) {
    //console.warn("Direct fetch failed, retrying with proxy:", error);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    return await fetchText(proxyUrl);
  }
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch feed (status ${response.status})`);
  }
  return await response.text();
}

function parseRss(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Feed XML is invalid or could not be parsed.");
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
