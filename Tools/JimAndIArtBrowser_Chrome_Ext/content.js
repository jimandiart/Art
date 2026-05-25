// ==========================================
// Jim & I Art Browser by Tardigradia
// ==========================================

let historyLinks = [];
let currentIndex = 0;
let skipAmount = 1;

let autoDownloadEnabled = false;
let isRunning = false;
let runDirection = 1;
let minWaitSeconds = 5;

// SPA specific locks
let isExecutingCycle = false;
const STORAGE_KEY = 'jimandiart_history_data';

// ==========================================
// Utility & State Functions
// ==========================================
function saveState(callback) {
    const data = { 
        links: historyLinks, index: currentIndex,
        autoDownload: autoDownloadEnabled, running: isRunning, direction: runDirection,
        waitTimer: minWaitSeconds
    };
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        if (callback) callback();
    });
}

function extractLinks() {
    const linkNodes = document.querySelectorAll('a[href^="/app/"]');
    const extracted = [];
    linkNodes.forEach(node => {
        const url = node.href;
        if (url.length > 30 && !extracted.includes(url)) extracted.push(url);
    });

    if (extracted.length === 0) {
        alert("No links found! Please ensure you have scrolled down in the history tab.");
        return;
    }

    historyLinks = extracted; currentIndex = 0;
    saveState(() => {
        alert(`Extracted ${historyLinks.length} conversation links.`);
        updateUI();
    });
}

function navigateToCurrent() {
    if (historyLinks.length === 0) return;
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= historyLinks.length) currentIndex = historyLinks.length - 1;
    saveState(() => { 
        // Force the browser to assign the new URL
        window.location.assign(historyLinks[currentIndex]); 
    });
}

function forceStopAndReload() {
    isRunning = false;
    isExecutingCycle = false;
    chrome.runtime.sendMessage({ action: "clearTopic" });
    saveState(() => { window.location.reload(); });
}

// ==========================================
// The Floating UI
// ==========================================
function injectBubble() {
    if (document.getElementById('jimandiart-bubble')) {
        document.getElementById('jimandiart-bubble').remove();
    }

    const bubble = document.createElement('div');
    bubble.id = 'jimandiart-bubble';
    
    // FIX 2: Moved to far right, down 25px, with 5px padding inside the body
    Object.assign(bubble.style, {
        position: 'fixed', top: '25px', right: '0px', left: 'auto', zIndex: '2147483647',
        backgroundColor: isRunning ? '#ffebee' : '#ffffff',
        border: isRunning ? '2px solid #d32f2f' : '1px solid #777',
        padding: '0', margin: '0', fontFamily: 'system-ui, sans-serif',
        width: '320px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-2px 4px 12px rgba(0,0,0,0.1)'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
        backgroundColor: isRunning ? '#ef9a9a' : '#e0e0e0',
        padding: '2px 4px', cursor: 'grab', fontWeight: 'bold', fontSize: '11px',
        color: '#000', borderBottom: '1px solid #777', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center'
    });
    header.innerHTML = `<span>↕️ <a href="https://www.jimandi.art" target="_blank" style="color:#000; text-decoration:underline;">Jim & I Art</a> Browser by Tardigradia</span>`;
    header.querySelector('a').addEventListener('mousedown', (e) => e.stopPropagation());

    let isDragging = false, startX, startY, initialRight, initialTop;
    header.addEventListener('mousedown', (e) => {
        isDragging = true; header.style.cursor = 'grabbing';
        startX = e.clientX; startY = e.clientY;
        const rect = bubble.getBoundingClientRect();
        // Calculate right distance from window width
        initialRight = window.innerWidth - rect.right; 
        initialTop = rect.top;
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        bubble.style.right = `${initialRight - (e.clientX - startX)}px`;
        bubble.style.top = `${initialTop + (e.clientY - startY)}px`;
    });
    document.addEventListener('mouseup', () => { isDragging = false; header.style.cursor = 'grab'; });

    const body = document.createElement('div');
    // FIX 2: 5px Padding
    Object.assign(body.style, { padding: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }); 

    if (isRunning) {
        const stopBtn = createButton('🛑 FORCE STOP & RELOAD', '#d32f2f', '#fff');
        Object.assign(stopBtn.style, { padding: '8px', fontWeight: 'bold', fontSize: '14px' });
        stopBtn.onclick = forceStopAndReload;
        
        const statusLbl = document.createElement('div');
        statusLbl.id = 'ghn-auto-status';
        statusLbl.innerText = `Auto-Processing: ${currentIndex + 1} / ${historyLinks.length}`;
        Object.assign(statusLbl.style, { fontSize: '11px', textAlign: 'center', fontWeight: 'bold', padding: '4px' });

        body.appendChild(statusLbl);
        body.appendChild(stopBtn);
    } else {
        const jumpRow = document.createElement('div');
        jumpRow.style.display = 'flex'; jumpRow.style.gap = '2px'; jumpRow.style.alignItems = 'center';
        const startBtn = createButton('⏮ Start', '#f1f3f4', '#000');
        startBtn.onclick = () => { currentIndex = 0; navigateToCurrent(); };
        const currentInput = document.createElement('input');
        currentInput.id = 'ghn-current-index'; currentInput.type = 'number'; currentInput.min = '1';
        Object.assign(currentInput.style, { flex: '0.8', padding: '0', margin: '0', textAlign: 'center', border: '1px solid #aaa', fontSize: '11px', fontWeight: 'bold' });
        currentInput.onchange = (e) => { 
            let val = parseInt(e.target.value) - 1;
            if (!isNaN(val)) { currentIndex = Math.max(0, Math.min(historyLinks.length - 1, val)); navigateToCurrent(); }
        };
        const endBtn = createButton('End ⏭', '#f1f3f4', '#000');
        endBtn.onclick = () => { currentIndex = Math.max(0, historyLinks.length - 1); navigateToCurrent(); };
        jumpRow.appendChild(startBtn); jumpRow.appendChild(currentInput); jumpRow.appendChild(endBtn);

        const extractRow = document.createElement('div');
        extractRow.style.display = 'flex'; extractRow.style.gap = '2px';
        const extractBtn = createButton('Extract Search Links', '#1a73e8', '#fff');
        extractBtn.style.flex = '1.5'; extractBtn.onclick = extractLinks;
        const statusText = document.createElement('div'); statusText.id = 'ghn-status';
        Object.assign(statusText.style, { flex: '1', fontSize: '9px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', border: '1px solid #ccc' });
        extractRow.appendChild(extractBtn); extractRow.appendChild(statusText);

        const autoRow = document.createElement('div');
        autoRow.style.display = 'flex'; autoRow.style.alignItems = 'center'; autoRow.style.justifyContent = 'center';
        autoRow.style.gap = '4px'; autoRow.style.padding = '2px 0'; autoRow.style.backgroundColor = '#fff3e0'; autoRow.style.border = '1px solid #ffcc80';
        
        const autoCheck = document.createElement('input');
        autoCheck.type = 'checkbox'; autoCheck.id = 'ghn-auto-check'; autoCheck.checked = autoDownloadEnabled;
        autoCheck.onchange = (e) => { autoDownloadEnabled = e.target.checked; saveState(); };
        
        const autoLabel = document.createElement('label');
        autoLabel.htmlFor = 'ghn-auto-check'; autoLabel.innerText = 'Auto-DL';
        Object.assign(autoLabel.style, { fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', color: '#e65100' });
        
        const waitLabel = document.createElement('span');
        waitLabel.innerText = 'Wait(s):';
        Object.assign(waitLabel.style, { fontSize: '9px', fontWeight: 'bold', color: '#000', marginLeft: '4px' });
        
        const waitInput = document.createElement('input');
        waitInput.type = 'number'; waitInput.min = '0'; waitInput.value = minWaitSeconds;
        Object.assign(waitInput.style, { width: '35px', fontSize: '10px', textAlign: 'center', border: '1px solid #aaa' });
        waitInput.onchange = (e) => { minWaitSeconds = parseInt(e.target.value) || 0; saveState(); };

        autoRow.appendChild(autoCheck); autoRow.appendChild(autoLabel);
        autoRow.appendChild(waitLabel); autoRow.appendChild(waitInput);

        const skipRow = document.createElement('div');
        skipRow.style.display = 'flex'; skipRow.style.gap = '2px';
        const prevBtn = createButton('◀ Skip Back', '#f1f3f4', '#000');
        prevBtn.onclick = () => { handleSkip(-1); };
        const skipInput = document.createElement('input');
        skipInput.type = 'number'; skipInput.value = skipAmount; skipInput.min = '1';
        Object.assign(skipInput.style, { width: '35px', padding: '0', margin: '0', textAlign: 'center', border: '1px solid #aaa', fontSize: '11px' });
        skipInput.onchange = (e) => { skipAmount = parseInt(e.target.value) || 1; };
        const nextBtn = createButton('Skip Fwd ▶', '#f1f3f4', '#000');
        nextBtn.onclick = () => { handleSkip(1); };
        skipRow.appendChild(prevBtn); skipRow.appendChild(skipInput); skipRow.appendChild(nextBtn);

        // NEW FEATURE: Manual Download All Button
        const manualDLRow = document.createElement('div');
        manualDLRow.style.display = 'flex';
        const manualDLBtn = createButton('⬇️ Download All Content on this Page', '#4caf50', '#fff');
        Object.assign(manualDLBtn.style, { padding: '4px', fontWeight: 'bold' });
        manualDLBtn.onclick = manualDownloadAll;
        manualDLRow.appendChild(manualDLBtn);

        const bottomRow = document.createElement('div');
        bottomRow.style.display = 'flex'; bottomRow.style.gap = '2px'; bottomRow.style.alignItems = 'center';
        const linkLabel = document.createElement('span'); linkLabel.innerText = 'Link:'; 
        Object.assign(linkLabel.style, { fontSize: '10px', fontWeight: 'bold', paddingLeft: '2px' });
        const linkInput = document.createElement('input'); linkInput.id = 'ghn-link'; linkInput.type = 'text'; linkInput.readOnly = true;
        Object.assign(linkInput.style, { flex: '1', padding: '1px 2px', margin: '0', fontSize: '10px', border: '1px solid #aaa', cursor: 'copy', backgroundColor: '#fff' });
        linkInput.onclick = () => {
            linkInput.select(); document.execCommand('copy');
            linkInput.style.backgroundColor = '#e6f4ea'; setTimeout(() => linkInput.style.backgroundColor = '#fff', 300);
        };
        const resetBtn = createButton('🔄', '#ff9800', '#fff'); 
        resetBtn.title = "Force Reload Page"; resetBtn.style.flex = '0.2'; resetBtn.onclick = forceStopAndReload;
        bottomRow.appendChild(linkLabel); bottomRow.appendChild(linkInput); bottomRow.appendChild(resetBtn);

        const creditsRow = document.createElement('div');
        creditsRow.innerHTML = 'Credits: Jason Brodsky | <a href="https://www.jimandi.art" target="_blank" style="color:#1a73e8; text-decoration:none;">www.JimandI.art</a> | <a href="https://www.tardigradia.com" target="_blank" style="color:#1a73e8; text-decoration:none;">www.tardigradia.com</a>';
        Object.assign(creditsRow.style, { fontSize: '8px', textAlign: 'center', marginTop: '2px', borderTop: '1px solid #ccc', paddingTop: '2px', color: '#555' });

        body.appendChild(jumpRow); body.appendChild(extractRow); body.appendChild(autoRow);
        body.appendChild(skipRow); body.appendChild(manualDLRow); body.appendChild(bottomRow); body.appendChild(creditsRow);
    }
    
    bubble.appendChild(header); bubble.appendChild(body); document.body.appendChild(bubble);
    updateUI();
}

function createButton(text, bg, color) {
    const btn = document.createElement('button'); btn.innerText = text;
    Object.assign(btn.style, { flex: '1', padding: '2px 4px', margin: '0', border: '1px solid #aaa', backgroundColor: bg, color: color, cursor: 'pointer', fontSize: '11px', fontWeight: '500' });
    btn.onmouseover = () => btn.style.backgroundColor = '#ddd';
    btn.onmouseout = () => btn.style.backgroundColor = bg;
    return btn;
}

function updateUI() {
    if (isRunning) return; 
    const statusText = document.getElementById('ghn-status');
    const linkInput = document.getElementById('ghn-link');
    const currentInput = document.getElementById('ghn-current-index');
    if (!statusText || !linkInput || !currentInput) return;

    if (historyLinks.length === 0) {
        statusText.innerText = "DB Empty"; linkInput.value = "N/A";
        currentInput.value = "0"; currentInput.max = "0";
    } else {
        statusText.innerText = `Total: ${historyLinks.length}`;
        currentInput.value = (currentIndex + 1).toString();
        currentInput.max = historyLinks.length.toString();
        linkInput.value = historyLinks[currentIndex] || "";
    }
}

// ==========================================
// Automation Logic
// ==========================================
function updateAutoStatus(text) {
    const lbl = document.getElementById('ghn-auto-status');
    if (lbl) lbl.innerText = `Processing: ${currentIndex + 1}/${historyLinks.length} - ${text}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function handleSkip(direction) {
    if (autoDownloadEnabled) {
        isRunning = true; runDirection = direction;
        saveState(() => { injectBubble(); executeAutomationCycle(); });
    } else {
        currentIndex += (direction * skipAmount);
        navigateToCurrent();
    }
}

async function waitForPageLoad() {
    let attempts = 0;
    while (document.readyState !== 'complete' && attempts < 20) {
        await sleep(500); attempts++;
    }
    
    await sleep(2000);

    attempts = 0;
    while (attempts < 15) {
        const imgs = Array.from(document.querySelectorAll('img'));
        const allImagesLoaded = imgs.length > 0 && imgs.every(img => img.complete && img.naturalHeight !== 0);
        if (allImagesLoaded) break; 
        await sleep(1000);
        attempts++;
    }
    await sleep(1000); 
}

async function waitForDownloads() {
    await sleep(2000);
    return new Promise(resolve => {
        let timeoutAttempts = 0;
        const maxAttempts = 120;
        const check = () => {
            chrome.runtime.sendMessage({ action: "checkDownloads" }, (response) => {
                timeoutAttempts++;
                if ((response && response.active === 0) || timeoutAttempts >= maxAttempts) {
                    resolve();
                } else {
                    setTimeout(check, 1000); 
                }
            });
        };
        check();
    });
}

// FIX 1: Lock system to prevent double execution during URL shifts
async function executeAutomationCycle() {
    if (!isRunning || isExecutingCycle) return;
    isExecutingCycle = true;

    try {
        updateAutoStatus("Waiting for page & images to load...");
        await waitForPageLoad();
        if (!isRunning) return;

        let topic = document.title.replace(' - Gemini', '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
        if (!topic || topic.includes('Gemini')) topic = `Search_ID_${currentIndex + 1}`;
        chrome.runtime.sendMessage({ action: "setTopic", topic: topic });

        updateAutoStatus("Scanning for images...");
        const potentialButtons = Array.from(document.querySelectorAll('button, a'));
        const downloadTargets = potentialButtons.filter(el => {
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const tooltip = (el.title || '').toLowerCase();
            return el.hasAttribute('download') || aria.includes('download') || tooltip.includes('download');
        });

        if (downloadTargets.length > 0) {
            updateAutoStatus(`Starting ${downloadTargets.length} downloads...`);
            for (let i = 0; i < downloadTargets.length; i++) {
                if (!isRunning) break;
                downloadTargets[i].click();
                await sleep(1000); 
            }
            
            updateAutoStatus("Waiting for downloads to finish...");
            await waitForDownloads(); 
        } else {
            updateAutoStatus("No images found.");
        }

        if (!isRunning) return;
        chrome.runtime.sendMessage({ action: "clearTopic" });

        let elapsedWait = 0;
        while (elapsedWait < minWaitSeconds && isRunning) {
            updateAutoStatus(`Custom Wait: ${minWaitSeconds - elapsedWait}s remaining...`);
            await sleep(1000);
            elapsedWait++;
        }
        
        if (!isRunning) return;

        currentIndex += (runDirection * skipAmount);
        if (currentIndex >= historyLinks.length || currentIndex < 0) {
            isRunning = false;
            saveState(() => {
                alert("Automation finished: Reached the end of the history array.");
                injectBubble();
            });
        } else {
            navigateToCurrent();
        }
    } finally {
        isExecutingCycle = false;
    }
}

// UPDATE 3: Manual Download Logic
async function manualDownloadAll() {
    const statusText = document.getElementById('ghn-status');
    const origText = statusText ? statusText.innerText : '';
    const setStatus = (text) => { if (statusText) statusText.innerText = text; };
    
    setStatus("Manual DL: Scanning...");
    
    let topic = document.title.replace(' - Gemini', '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    if (!topic || topic.includes('Gemini')) topic = `Manual_DL`;
    chrome.runtime.sendMessage({ action: "setTopic", topic: topic });

    const potentialButtons = Array.from(document.querySelectorAll('button, a'));
    const downloadTargets = potentialButtons.filter(el => {
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const tooltip = (el.title || '').toLowerCase();
        return el.hasAttribute('download') || aria.includes('download') || tooltip.includes('download');
    });

    if (downloadTargets.length > 0) {
        setStatus(`Manual DL: Starting ${downloadTargets.length}...`);
        for (let i = 0; i < downloadTargets.length; i++) {
            downloadTargets[i].click();
            await sleep(1000); 
        }
        setStatus("Manual DL: Waiting...");
        await waitForDownloads(); 
        setStatus("Manual DL: Finished!");
    } else {
        setStatus("Manual DL: No images.");
    }
    
    chrome.runtime.sendMessage({ action: "clearTopic" });
    setTimeout(() => setStatus(origText), 3000);
}


// ==========================================
// Initialization & Observers
// ==========================================
function init() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
            historyLinks = result[STORAGE_KEY].links || [];
            currentIndex = result[STORAGE_KEY].index || 0;
            autoDownloadEnabled = result[STORAGE_KEY].autoDownload || false;
            isRunning = result[STORAGE_KEY].running || false;
            runDirection = result[STORAGE_KEY].direction || 1;
            minWaitSeconds = result[STORAGE_KEY].waitTimer !== undefined ? result[STORAGE_KEY].waitTimer : 5;
        }
        
        injectBubble();
        if (isRunning && !isExecutingCycle) {
            executeAutomationCycle();
        }
    });
}

// FIX 1 (SPA Nav Catch): Background observer that forces cycle restart if URL changes invisibly
let lastKnownUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== lastKnownUrl) {
        lastKnownUrl = window.location.href;
        if (isRunning && !isExecutingCycle) {
            // Give the SPA a brief moment to render before restarting cycle
            setTimeout(executeAutomationCycle, 2000);
        }
    }
}, 1000);

const observer = new MutationObserver(() => {
    if (!document.getElementById('jimandiart-bubble')) injectBubble();
});
observer.observe(document.body, { childList: true, subtree: true });

init();