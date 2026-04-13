const fetch = require('node-fetch');
const cheerio = require('cheerio');
const url = require('url');

/**
 * Fetch a website and extract comprehensive design data
 * @param {string} targetUrl - The URL to fetch
 * @returns {Promise<Object>} Rich design extraction data
 */
async function fetchWebsite(targetUrl) {
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 15000,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const baseUrl = new URL(targetUrl);

  // Extract stylesheet links
  const cssUrls = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const resolved = new URL(href, baseUrl).href;
        cssUrls.push(resolved);
      } catch {
        // Skip invalid URLs
      }
    }
  });

  // Extract inline styles from <style> tags
  const inlineStyles = [];
  $('style').each((_, el) => {
    const content = $(el).html();
    if (content && content.trim().length > 10) {
      inlineStyles.push(content);
    }
  });

  // Extract font imports from <link> tags
  const fontUrls = [];
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"], link[href*="typekit"], link[href*="fontawesome"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        fontUrls.push(new URL(href, baseUrl).href);
      } catch {
        // Skip
      }
    }
  });

  // Extract meta tags for context
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const twitterTitle = $('meta[name="twitter:title"]').attr('content') || '';
  const rawTitle = ogTitle || twitterTitle || $('title').text() || '';
  const meta = {
    title: rawTitle.trim().substring(0, 100).replace(/\s+/g, ' '),
    description: $('meta[name="description"]').attr('content') || '',
    themeColor: $('meta[name="theme-color"]').attr('content') || '',
    viewport: $('meta[name="viewport"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || '',
    generator: $('meta[name="generator"]').attr('content') || '',
  };

  // Detect CSS framework signatures from classes
  const bodyHtml = $.html();
  const cssFramework = detectCssFramework(bodyHtml);

  // Extract HTML structure hints
  const structureHints = extractStructureHints($);

  return {
    html,
    cssUrls,
    inlineStyles,
    fontUrls,
    meta,
    cssFramework,
    structureHints,
  };
}

/**
 * Fetch CSS content from URLs
 * @param {string[]} cssUrls - Array of CSS URLs
 * @returns {Promise<string[]>} Array of CSS content strings
 */
async function fetchCssFiles(cssUrls) {
  const cssContents = [];

  for (const cssUrl of cssUrls) {
    try {
      const response = await fetch(cssUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 10000,
      });

      if (response.ok) {
        const css = await response.text();
        cssContents.push({ url: cssUrl, content: css });
      }
    } catch {
      // Skip failed CSS fetches
    }
  }

  return cssContents;
}

/**
 * Fetch font CSS files to extract font family names
 * @param {string[]} fontUrls - Array of font URLs
 * @returns {Promise<string[]>} Array of font family names
 */
async function fetchFontFamilies(fontUrls) {
  const families = [];

  for (const fontUrl of fontUrls) {
    try {
      const response = await fetch(fontUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 5000,
      });

      if (response.ok) {
        const css = await response.text();
        // Extract font-family names from @font-face rules
        const fontFaceRegex = /font-family\s*:\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = fontFaceRegex.exec(css)) !== null) {
          if (!families.includes(match[1])) {
            families.push(match[1]);
          }
        }
        // Also extract from Google Fonts URL parameters
        const familyMatch = fontUrl.match(/family=([^&]+)/);
        if (familyMatch) {
          const fontNames = decodeURIComponent(familyMatch[1]).split('|');
          fontNames.forEach((name) => {
            const cleanName = name.split(':')[0].replace(/\+/g, ' ');
            if (!families.includes(cleanName)) {
              families.push(cleanName);
            }
          });
        }
      }
    } catch {
      // Skip
    }
  }

  return families;
}

/**
 * Detect CSS framework from class names and patterns
 */
function detectCssFramework(html) {
  const frameworks = {
    tailwind: {
      patterns: ['class="container mx-auto', 'class="flex items-center', 'class="px-4 py-2', 'class="text-sm font-medium', 'class="rounded-lg'],
      name: 'Tailwind CSS',
      score: 0,
    },
    bootstrap: {
      patterns: ['class="container', 'class="row', 'class="col-', 'class="btn btn-', 'class="navbar', 'class="card'],
      name: 'Bootstrap',
      score: 0,
    },
    bulma: {
      patterns: ['class="columns', 'class="column is-', 'class="button is-', 'class="card', 'class="navbar', 'class="hero'],
      name: 'Bulma',
      score: 0,
    },
    chakra: {
      patterns: ['class="chakra-', 'css-', '@emotion'],
      name: 'Chakra UI / Emotion',
      score: 0,
    },
    material: {
      patterns: ['class="mdc-', 'class="mat-', 'class="mui-', 'class="Mui'],
      name: 'Material UI',
      score: 0,
    },
    antd: {
      patterns: ['class="ant-', 'ant-btn', 'ant-card'],
      name: 'Ant Design',
      score: 0,
    },
  };

  for (const [key, fw] of Object.entries(frameworks)) {
    for (const pattern of fw.patterns) {
      if (html.includes(pattern)) {
        fw.score++;
      }
    }
  }

  const detected = Object.entries(frameworks)
    .filter(([_, fw]) => fw.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (detected.length > 0) {
    return { name: detected[0][1].name, confidence: detected[0][1].score };
  }

  return { name: 'Custom', confidence: 0 };
}

/**
 * Extract HTML structure hints for design analysis
 */
function extractStructureHints($) {
  const hints = {
    hasNavigation: $('nav, .nav, .navbar, .sidebar, header[role="navigation"]').length > 0,
    hasHero: $('[class*="hero"], [class*="banner"], [class*="jumbotron"], section:first-of-type').length > 0,
    hasGrid: $('[class*="grid"], [class*="masonry"]').length > 0,
    hasCards: $('[class*="card"], [class*="tile"], [class*="box"]').length > 0,
    hasFooter: $('footer, [class*="footer"]').length > 0,
    hasSidebar: $('[class*="sidebar"], aside').length > 0,
    hasForm: $('form, [class*="form"]').length > 0,
    hasModal: $('[class*="modal"], [class*="dialog"], [class*="overlay"]').length > 0,
    hasTable: $('table, [class*="table"]').length > 0,
    hasBadge: $('[class*="badge"], [class*="tag"], [class*="chip"], [class*="pill"]').length > 0,
    hasAvatar: $('[class*="avatar"], [class*="profile-img"], [class*="user-img"]').length > 0,
    hasTooltip: $('[class*="tooltip"], [class*="popover"], [class*="hint"]').length > 0,
    hasBreadcrumb: $('[class*="breadcrumb"], [class*="breadcrumb"]').length > 0,
    hasPagination: $('[class*="pagination"], [class*="pager"]').length > 0,
    hasTabs: $('[class*="tab"], [role="tablist"]').length > 0,
    hasAccordion: $('[class*="accordion"], [class*="collapsible"]').length > 0,
    hasDropdown: $('[class*="dropdown"], [class*="menu"]').length > 0,
    hasProgress: $('[class*="progress"], [class*="bar"], [role="progressbar"]').length > 0,
    hasToggle: $('[class*="toggle"], [class*="switch"], [type="checkbox"]').length > 0,
    hasSlider: $('[class*="slider"], [class*="range"], [type="range"]').length > 0,
    hasNotification: $('[class*="alert"], [class*="notification"], [class*="toast"]').length > 0,
    hasSearch: $('[class*="search"], [type="search"]').length > 0,
    sectionCount: $('section, [class*="section"]').length,
    headingCount: $('h1, h2, h3, h4, h5, h6').length,
    paragraphCount: $('p').length,
    imageCount: $('img').length,
    linkCount: $('a').length,
    buttonCount: $('button, [role="button"], input[type="submit"], input[type="button"]').length,
    inputCount: $('input, textarea, select').length,
  };

  return hints;
}

module.exports = { fetchWebsite, fetchCssFiles, fetchFontFamilies };
