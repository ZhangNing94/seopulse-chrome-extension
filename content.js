// SEOPulse - Content Script for DOM Analysis
// Injected via chrome.scripting.executeScript from popup.js

(function() {
  const results = {};

  // 1. Title
  const titleEl = document.querySelector('title');
  const title = titleEl ? titleEl.textContent.trim() : '';
  results.title = {
    value: title,
    status: title.length === 0 ? 'error' : title.length < 10 ? 'warn' : title.length > 70 ? 'warn' : 'ok',
    message: title.length === 0 ? 'Missing title tag' : title.length < 10 ? 'Too short (<10 chars)' : title.length > 70 ? 'Too long (>70 chars)' : `OK (${title.length} chars)`,
  };

  // 2. Meta Description
  const metaDesc = document.querySelector('meta[name="description"]');
  const desc = metaDesc ? metaDesc.getAttribute('content') || '' : '';
  results.metaDescription = {
    value: desc,
    status: !desc ? 'error' : desc.length < 50 ? 'warn' : desc.length > 160 ? 'warn' : 'ok',
    message: !desc ? 'Missing meta description' : desc.length < 50 ? 'Too short (<50 chars)' : desc.length > 160 ? 'Too long (>160 chars)' : `OK (${desc.length} chars)`,
  };

  // 3. Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  results.canonical = {
    value: canonical ? canonical.getAttribute('href') || '' : '',
    status: canonical ? 'ok' : 'warn',
    message: canonical ? 'Present' : 'Missing canonical URL',
  };

  // 4. H1
  const h1s = document.querySelectorAll('h1');
  results.h1 = {
    value: Array.from(h1s).map(h => h.textContent.trim()).filter(Boolean),
    count: h1s.length,
    status: h1s.length === 0 ? 'error' : h1s.length > 1 ? 'warn' : 'ok',
    message: h1s.length === 0 ? 'Missing H1' : h1s.length > 1 ? `Multiple H1s (${h1s.length})` : 'OK',
  };

  // 5. H2-H6 Hierarchy
  const h2s = document.querySelectorAll('h2');
  const h3s = document.querySelectorAll('h3');
  const h4s = document.querySelectorAll('h4');
  const h5s = document.querySelectorAll('h5');
  const h6s = document.querySelectorAll('h6');
  results.headings = {
    h2: h2s.length, h3: h3s.length, h4: h4s.length, h5: h5s.length, h6: h6s.length,
    total: h2s.length + h3s.length + h4s.length + h5s.length + h6s.length,
  };

  // 6. Image Alt Text
  const imgs = document.querySelectorAll('img');
  const imgTotal = imgs.length;
  const imgNoAlt = Array.from(imgs).filter(img => !img.getAttribute('alt') || img.getAttribute('alt').trim() === '').length;
  results.images = {
    total: imgTotal,
    missingAlt: imgNoAlt,
    status: imgTotal === 0 ? 'warn' : imgNoAlt === 0 ? 'ok' : imgNoAlt > imgTotal * 0.3 ? 'error' : 'warn',
    message: imgTotal === 0 ? 'No images found' : imgNoAlt === 0 ? 'All images have alt text' : `${imgNoAlt}/${imgTotal} missing alt text`,
  };

  // 7. Open Graph
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  const ogType = document.querySelector('meta[property="og:type"]');
  const ogSite = document.querySelector('meta[property="og:site_name"]');
  results.openGraph = {
    title: ogTitle ? ogTitle.getAttribute('content') || '' : '',
    description: ogDesc ? ogDesc.getAttribute('content') || '' : '',
    image: ogImage ? ogImage.getAttribute('content') || '' : '',
    url: ogUrl ? ogUrl.getAttribute('content') || '' : '',
    type: ogType ? ogType.getAttribute('content') || '' : '',
    siteName: ogSite ? ogSite.getAttribute('content') || '' : '',
    count: [ogTitle, ogDesc, ogImage, ogUrl].filter(Boolean).length,
    status: ogTitle && ogDesc && ogImage ? 'ok' : ogTitle || ogDesc ? 'warn' : 'error',
    message: ogTitle && ogDesc && ogImage ? 'Complete' : ogTitle || ogDesc ? 'Partial OG tags' : 'Missing OG tags',
  };

  // 8. Twitter Card
  const twCard = document.querySelector('meta[name="twitter:card"]');
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  const twImage = document.querySelector('meta[name="twitter:image"]');
  results.twitterCard = {
    card: twCard ? twCard.getAttribute('content') || '' : '',
    title: twTitle ? twTitle.getAttribute('content') || '' : '',
    description: twDesc ? twDesc.getAttribute('content') || '' : '',
    image: twImage ? twImage.getAttribute('content') || '' : '',
    count: [twCard, twTitle, twDesc, twImage].filter(Boolean).length,
    status: twCard ? 'ok' : 'error',
    message: twCard ? 'Present' : 'Missing Twitter Card',
  };

  // 9. Schema.org (JSON-LD)
  const schemas = document.querySelectorAll('script[type="application/ld+json"]');
  results.schema = {
    count: schemas.length,
    types: [],
    status: schemas.length > 0 ? 'ok' : 'warn',
    message: schemas.length > 0 ? `${schemas.length} schema(s) found` : 'No structured data',
  };
  schemas.forEach(s => {
    try {
      const data = JSON.parse(s.textContent);
      const type = data['@type'] || (Array.isArray(data) ? data[0]?.['@type'] : 'Unknown');
      results.schema.types.push(type);
    } catch(e) { /* ignore parse errors */ }
  });

  // 10. Robots Meta
  const robots = document.querySelector('meta[name="robots"]');
  results.robots = {
    value: robots ? robots.getAttribute('content') || '' : '',
    status: robots ? 'ok' : 'warn',
    message: robots ? robots.getAttribute('content') : 'Missing robots meta',
  };
  if (robots) {
    const content = robots.getAttribute('content').toLowerCase();
    if (content.includes('noindex')) results.robots.warning = 'Page has noindex';
    if (content.includes('nofollow')) results.robots.warning = (results.robots.warning || '') + ' nofollow';
  }

  // 11. Viewport
  const viewport = document.querySelector('meta[name="viewport"]');
  results.viewport = {
    status: viewport ? 'ok' : 'warn',
    message: viewport ? 'Present' : 'Missing viewport meta',
  };

  // 12. Language
  results.language = {
    value: document.documentElement.lang || '',
    status: document.documentElement.lang ? 'ok' : 'warn',
    message: document.documentElement.lang ? document.documentElement.lang : 'Missing lang attribute',
  };

  // 13. Favicon
  const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  results.favicon = {
    status: favicon ? 'ok' : 'warn',
    message: favicon ? 'Present' : 'Missing favicon',
  };

  // 14. Word count
  const bodyText = document.body ? document.body.innerText || '' : '';
  const words = bodyText.trim().split(/\s+/).filter(w => w.length > 0);
  results.wordCount = {
    value: words.length,
    status: words.length < 100 ? 'warn' : 'ok',
    message: words.length < 100 ? `Low content (${words.length} words)` : `${words.length} words`,
  };

  // 15. HTTPS
  results.https = {
    status: window.location.protocol === 'https:' ? 'ok' : 'error',
    message: window.location.protocol === 'https:' ? 'HTTPS' : 'Not HTTPS!',
  };

  // 16. Page load speed (approximate)
  const navTiming = performance.getEntriesByType('navigation')[0];
  if (navTiming) {
    results.loadTime = {
      value: Math.round(navTiming.domContentLoadedEventEnd - navTiming.fetchStart),
      status: 'ok',
      message: `~${Math.round(navTiming.domContentLoadedEventEnd - navTiming.fetchStart)}ms`,
    };
  }

  // 17. Internal/External Links
  const links = document.querySelectorAll('a[href]');
  let internal = 0, external = 0;
  const hostname = window.location.hostname;
  links.forEach(a => {
    try {
      const url = new URL(a.href, window.location.origin);
      if (url.hostname === hostname || url.hostname === '') internal++;
      else external++;
    } catch(e) { internal++; }
  });
  results.links = { internal, external, total: internal + external };

  // Overall Score
  const checks = [
    results.title, results.metaDescription, results.h1,
    results.canonical, results.openGraph, results.twitterCard,
    results.schema, results.robots, results.viewport, results.language
  ];
  const errors = checks.filter(c => c.status === 'error').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const oks = checks.filter(c => c.status === 'ok').length;
  results.score = {
    total: checks.length,
    ok: oks,
    warn: warnings,
    error: errors,
    percentage: Math.round((oks / checks.length) * 100),
  };

  return results;
})();