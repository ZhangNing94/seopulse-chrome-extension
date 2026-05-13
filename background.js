// SEOPulse - Background Service Worker (MV3)
chrome.action.onClicked.addListener((tab) => {
  // Popup handles everything; this is a fallback
  // User can click the icon to open the popup
});

// Keyboard shortcut handler (if added later)
chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'run-audit') {
    chrome.action.openPopup();
  }
});