let feeds = [];

async function loadFeeds() {
  chromeFeeds = await chrome.storage.sync.get("feeds");
  feeds = JSON.parse(chromeFeeds.feeds || "[]");
}

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

function getValueByTag(xml, tag) {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function getFeedDate(xmlText) {
  let updated = new Date(getValueByTag(xmlText, "pubDate") || getValueByTag(xmlText, "updated"));
  return updated;
}

async function runTask() {
    await loadFeeds();
    let updatedFeeds = 0;
	for (let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        const xmlText = await fetchRss(feed.url);
        if (getFeedDate(xmlText) > new Date(feed.updated)) {
            updatedFeeds++;
        }
    }
    if (updatedFeeds > 0) {
        chrome.action.setBadgeText({ text: updatedFeeds.toLocaleString() });
    } else {
        chrome.action.setBadgeText({ text: null });
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('twoHourAlarm', { periodInMinutes: 120 });
    runTask(); // Run the task immediately on installation
});

chrome.runtime.onStartup.addListener(() => {
	chrome.alarms.create('twoHourAlarm', { periodInMinutes: 120 });
    runTask(); // Run the task immediately on startup
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm && alarm.name === 'twoHourAlarm') {
		runTask();
	}
});
