// background.js

const extensionViewerUrl = chrome.runtime.getURL('viewer/viewer.html');

// Listener for HTTP/HTTPS PDFs (where Content-Type is reliable)
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    console.groupCollapsed('onHeadersReceived (Web) fired for:', details.url);
    console.log('URL:', details.url, 'Type:', details.type, 'Tab ID:', details.tabId);

    // Only proceed if it's a main_frame navigation and not already our viewer
    if (details.type === 'main_frame' && details.tabId !== -1 && !details.url.startsWith(extensionViewerUrl)) {
      const contentTypeHeader = details.responseHeaders.find(
        header => header.name.toLowerCase() === 'content-type'
      );
      const isPdfByContentType = contentTypeHeader && contentTypeHeader.value.toLowerCase().includes('application/pdf');

      console.log('Response Headers (Web):', details.responseHeaders);
      console.log('Is PDF by Content-Type (application/pdf):', isPdfByContentType);

      if (isPdfByContentType) {
        console.log('✅ PDF detected by Content-Type (Web):', details.url);
        const viewerUrl = extensionViewerUrl + '?file=' + encodeURIComponent(details.url);
        chrome.tabs.update(details.tabId, { url: viewerUrl })
          .then(() => console.log(`➡️ Successfully initiated redirect (Web) of tab ${details.tabId} to ${viewerUrl}`))
          .catch(error => console.error(`❌ Error redirecting (Web) tab ${details.tabId}:`, error));
      } else {
        console.log('ℹ️ Not identified as a PDF by Content-Type (Web).');
      }
    } else {
      console.log('➡️ Skipping (Web) (Not main_frame, no tab ID, or already viewer URL).');
    }
    console.groupEnd();
  },
  {
    urls: ["http://*/*", "https://*/*"], // Only listen for HTTP/HTTPS
    types: ["main_frame"]
  },
  ["responseHeaders"] // We need these headers to check content-type
);


// --- NEW LISTENER FOR FILE URLs ---
chrome.webRequest.onBeforeRequest.addListener( // <-- Using onBeforeRequest
  function(details) {
    console.groupCollapsed('onBeforeRequest (File) fired for:', details.url);
    console.log('URL:', details.url, 'Type:', details.type, 'Tab ID:', details.tabId);

    // Only proceed if it's a main_frame navigation and not already our viewer
    if (details.type === 'main_frame' && details.tabId !== -1 && !details.url.startsWith(extensionViewerUrl)) {
      const isPdfByUrlExtension = details.url.toLowerCase().endsWith('.pdf');

      console.log('Is PDF by URL Extension (.pdf) (File):', isPdfByUrlExtension);

      if (isPdfByUrlExtension) {
        console.log('✅ PDF detected by URL Extension (File):', details.url);
        const viewerUrl = extensionViewerUrl + '?file=' + encodeURIComponent(details.url);
        chrome.tabs.update(details.tabId, { url: viewerUrl })
          .then(() => console.log(`➡️ Successfully initiated redirect (File) of tab ${details.tabId} to ${viewerUrl}`))
          .catch(error => console.error(`❌ Error redirecting (File) tab ${details.tabId}:`, error));
      } else {
        console.log('ℹ️ Not identified as a PDF by URL Extension (File).');
      }
    } else {
      console.log('➡️ Skipping (File) (Not main_frame, no tab ID, or already viewer URL).');
    }
    console.groupEnd();
  },
  {
    urls: ["file://*/*.pdf"], // Specifically listen for .pdf files in file:// scheme
    types: ["main_frame"]
  },
  [] // No extraInfoSpec needed for onBeforeRequest unless using "blocking"
);
// --- END NEW LISTENER ---


console.log('Background service worker running. Initialized listeners.');

// Listener for messages from other parts of the extension (e.g., options page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSettings") {
    chrome.storage.sync.get(['warmColor', 'contrastLevel', 'blueLightFilter', 'blueLightIntensity', 'scope', 'siteList'], function(settings) {
      sendResponse(settings);
    });
    return true; // Indicate that sendResponse will be called asynchronously
  }
});

// Listen for messages from the options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if the message is indicating a settings change
    if (message.action === "settingsChanged") {
        // Forward the message to any open viewer tabs
        chrome.tabs.query({ url: chrome.runtime.getURL("viewer/viewer.html") + "*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: "settingsChanged" });
            });
        });
    }
});

// Open the PDF in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'viewer/viewer.html' });
});