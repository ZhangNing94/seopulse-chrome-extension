// SEOPulse Background Service Worker (MV3)
// Pro system: 3 free audits/day, $4.99 lifetime unlock

const FREE_LIMIT = 3;
const GUMROAD_URL = 'https://5330159977060.gumroad.com/l/xhzru';

// License validation — simple local format check
// Valid format: SXLP-XXXX-XXXX (4-prefix + 2 groups of 4 alphanumeric chars)
const LICENSE_REGEX = /^SXLP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function verifyLicenseCode(code) {
  return LICENSE_REGEX.test(code.trim().toUpperCase());
}

async function getUsageForToday() {
  return new Promise(resolve => {
    chrome.storage.local.get(['usageDate', 'usageCount'], data => {
      const today = new Date().toDateString();
      if (data.usageDate !== today) resolve(0);
      else resolve(data.usageCount || 0);
    });
  });
}

async function incrementUsage() {
  const today = new Date().toDateString();
  return new Promise(resolve => {
    chrome.storage.local.get(['usageDate', 'usageCount'], data => {
      if (data.usageDate !== today) {
        chrome.storage.local.set({ usageDate: today, usageCount: 1 });
        resolve(1);
      } else {
        const count = (data.usageCount || 0) + 1;
        chrome.storage.local.set({ usageCount: count });
        resolve(count);
      }
    });
  });
}

async function checkProStatus() {
  return new Promise(resolve => {
    chrome.storage.local.get('isPro', data => resolve(!!data.isPro));
  });
}

async function canAudit() {
  const isPro = await checkProStatus();
  if (isPro) return true;
  const usage = await getUsageForToday();
  return usage < FREE_LIMIT;
}

// Message Handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUsage') {
    getUsageForToday().then(count => {
      checkProStatus().then(isPro => {
        sendResponse({ usage: count, limit: FREE_LIMIT, isPro });
      });
    });
    return true;
  }
  if (request.action === 'verifyLicense') {
    const code = request.code;
    const valid = verifyLicenseCode(code);
    if (valid) {
      chrome.storage.local.set({ isPro: true }, () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Invalid license code. Expected format: SXLP-XXXX-XXXX' });
    }
    return true;
  }
  if (request.action === 'getGumroadUrl') {
    sendResponse({ url: GUMROAD_URL });
    return false;
  }
  if (request.action === 'checkCanAudit') {
    canAudit().then(ok => {
      if (!ok) {
        incrementUsage(); // increment anyway, then check result
        getUsageForToday().then(count => {
          sendResponse({ canAudit: false, usage: count, limit: FREE_LIMIT, error: 'FREE_LIMIT' });
        });
      } else {
        incrementUsage().then(count => {
          sendResponse({ canAudit: true, usage: count, limit: FREE_LIMIT });
        });
      }
    });
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  // Popup handles everything
});

chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'run-audit') {
    chrome.action.openPopup();
  }
});