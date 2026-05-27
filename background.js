// SEOPulse Background Service Worker (MV3)
// Gumroad License verification: 5 free trials, then activate

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
const PRODUCT_PERMALINK = 'wjlumn';
const TRIAL_LIMIT = 5;

// ─── License storage keys (same as license-manager.js) ───
const LM = {
  TRIAL_COUNT: 'lm_trial_count',
  LICENSE_KEY: 'lm_license_key',
  ACTIVATED:   'lm_activated',
  LAST_VERIFY: 'lm_last_verify'
};

async function isLicenseActivated() {
  const data = await chrome.storage.local.get(LM.ACTIVATED);
  return data[LM.ACTIVATED] === 'true';
}

async function getLicenseTrialCount() {
  const data = await chrome.storage.local.get(LM.TRIAL_COUNT);
  return data[LM.TRIAL_COUNT] !== undefined ? parseInt(data[LM.TRIAL_COUNT], 10) : 0;
}

async function incrementLicenseTrial() {
  const count = await getLicenseTrialCount();
  await chrome.storage.local.set({ [LM.TRIAL_COUNT]: String(count + 1) });
  return count + 1;
}

async function canAudit() {
  if (await isLicenseActivated()) return { allowed: true, reason: 'activated' };
  const used = await getLicenseTrialCount();
  const limit = TRIAL_LIMIT;
  if (used < limit) return { allowed: true, reason: 'trial', used, limit, remaining: limit - used };
  return { allowed: false, reason: 'trial_exhausted', used, limit, remaining: 0 };
}

// ─── Gumroad License Verification ───
async function verifyLicenseKey(key) {
  try {
    const body = `product_permalink=${encodeURIComponent(PRODUCT_PERMALINK)}&license_key=${encodeURIComponent(key.trim())}`;
    const resp = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await resp.json();
    if (!data.success) return { valid: false, error: 'Invalid license key.' };
    if (data.purchase && (data.purchase.refunded || data.purchase.disputed || data.purchase.chargebacked)) {
      return { valid: false, error: 'License refunded or canceled.' };
    }
    if (data.uses !== undefined && data.uses >= 2) {
      return { valid: false, error: 'License used on too many devices.' };
    }
    // Increment uses
    try {
      await fetch(GUMROAD_VERIFY_URL.replace('/verify', '/increment_uses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
    } catch (e) {}
    await chrome.storage.local.set({
      [LM.LICENSE_KEY]: key.trim(),
      [LM.ACTIVATED]: 'true',
      [LM.LAST_VERIFY]: String(Date.now())
    });
    return { valid: true, email: data.purchase?.email };
  } catch (e) {
    return { valid: false, error: 'Network error. Check your connection.' };
  }
}

// ─── Message Handlers ───
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUsage') {
    (async () => {
      const activated = await isLicenseActivated();
      const used = await getLicenseTrialCount();
      const limit = TRIAL_LIMIT;
      sendResponse({ usage: used, limit, isPro: activated, remaining: Math.max(0, limit - used) });
    })();
    return true;
  }
  if (request.action === 'verifyLicense') {
    verifyLicenseKey(request.code).then(result => {
      sendResponse(result.valid ? { success: true } : { success: false, error: result.error });
    });
    return true;
  }
  if (request.action === 'getGumroadUrl') {
    sendResponse({ url: `https://5330159977060.gumroad.com/l/${PRODUCT_PERMALINK}` });
    return false;
  }
  if (request.action === 'checkCanAudit') {
    canAudit().then(status => {
      if (status.allowed) {
        if (status.reason === 'trial') {
          incrementLicenseTrial().then(n => {
            sendResponse({ canAudit: true, usage: n, limit: TRIAL_LIMIT, reason: 'trial' });
          });
        } else {
          sendResponse({ canAudit: true, reason: 'activated' });
        }
      } else {
        sendResponse({ canAudit: false, usage: status.used, limit: TRIAL_LIMIT, error: 'TRIAL_EXHAUSTED' });
      }
    });
    return true;
  }
});

chrome.action.onClicked.addListener(() => {});
chrome.commands?.onCommand?.addListener((cmd) => {
  if (cmd === 'run-audit') chrome.action.openPopup();
});