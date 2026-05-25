let currentTopic = "";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "setTopic") {
        currentTopic = request.topic;
        sendResponse({ success: true });
    } else if (request.action === "clearTopic") {
        currentTopic = "";
        sendResponse({ success: true });
    } else if (request.action === "checkDownloads") {
        // Query Chrome for any actively downloading files
        chrome.downloads.search({ state: "in_progress" }, (results) => {
            sendResponse({ active: results.length });
        });
        return true; 
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    if (currentTopic) {
        const extensionMatch = item.filename.match(/\.[0-9a-z]+$/i);
        const ext = extensionMatch ? extensionMatch[0] : "";
        const safeTopic = currentTopic.replace(/[^a-zA-Z0-9-_]/g, '_');
        const randomId = Math.floor(Math.random() * 10000); 
        suggest({ filename: `JimAndI_Art/${safeTopic}_${randomId}${ext}` });
    } else {
        suggest(); 
    }
});