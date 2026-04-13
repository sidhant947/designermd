const cheerio = require('cheerio');
const { fetchCssFiles, fetchFontFamilies } = require('./fetcher');

/**
 * Analyze the design of a website from HTML and CSS
 * @param {string} html - HTML content
 * @param {string[]} cssUrls - Array of CSS URLs
 * @param {string} url - Original URL
 * @param {string[]} inlineStyles - Array of inline CSS strings
 * @param {Object} meta - Meta tag data
 * @param {Object} cssFramework - Detected CSS framework
 * @param {Object} structureHints - HTML structure hints
 * @param {string[]} fontUrls - Font URLs
 * @returns {Promise<Object>} Comprehensive design analysis data
 */
async function analyzeDesign(html, cssUrls, url, inlineStyles = [], meta = {}, cssFramework = {}, structureHints = {}, fontUrls = []) {
  const $ = cheerio.load(html);

  // Fetch all CSS files + font families
  const [cssContents, fontFamilies] = await Promise.all([
    fetchCssFiles(cssUrls),
    fetchFontFamilies(fontUrls),
  ]);

  const externalCss = cssContents.map((c) => c.content).join('\n');
  const cssStrings = inlineStyles.join('\n');

  // Combine all CSS
  const allCss = externalCss + '\n' + cssStrings;

  // Run all analysis modules
  const colorPalette = extractColors(allCss, html);
  const typography = extractTypography(allCss, html, fontFamilies, $);
  const components = extractComponents(allCss, $, structureHints);
  const layout = extractLayout(allCss, html, $);
  const elevation = extractElevation(allCss);
  const motion = extractMotion(allCss);
  const accessibility = analyzeAccessibility(allCss, $);
  const designPatterns = detectDesignPatterns(allCss, html, $, structureHints);
  const responsive = extractResponsive(allCss, $);
  const visualTheme = inferVisualTheme(colorPalette, typography, layout, motion, designPatterns, meta, cssFramework);
  const dosAndDonts = generateDosAndDonts(colorPalette, typography, components, layout, elevation, motion, accessibility);
  const agentPrompts = generateAgentPrompts(colorPalette, typography, components, layout, designPatterns);

  return {
    url,
    visualTheme,
    colorPalette,
    typography,
    components,
    layout,
    elevation,
    motion,
    accessibility,
    designPatterns,
    responsive,
    agentPrompts,
    cssFramework,
    meta,
    structureHints,
    dosAndDonts,
  };
}

// ============================================================================
// COLOR EXTRACTION
// ============================================================================

/**
 * Extract comprehensive color palette from CSS
 */
function extractColors(css, html) {
  const colors = {
    semantic: {},
    gradients: [],
    surfaces: [],
    accents: [],
    neutrals: [],
    harmony: '',
    contrast: 'unknown',
  };

  // Extract all CSS color variables
  const tokenMap = {};
  const colorVarPatterns = [
    /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g,
    /--([\w-]+)\s*:\s*(rgb\([^)]+\))/g,
    /--([\w-]+)\s*:\s*(rgba\([^)]+\))/g,
    /--([\w-]+)\s*:\s*(hsl\([^)]+\))/g,
  ];

  for (const pattern of colorVarPatterns) {
    let match;
    while ((match = pattern.exec(css)) !== null) {
      const [, name, value] = match;
      const normalized = normalizeColor(value);
      if (normalized && normalized !== 'transparent') {
        tokenMap[name] = normalized;
      }
    }
  }

  // Also extract non-variable color declarations
  const allColorDecls = [];
  const colorDeclPattern = /(?:color|background|border-color|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g;
  let match;
  while ((match = colorDeclPattern.exec(css)) !== null) {
    const normalized = normalizeColor(match[1]);
    if (normalized) {
      allColorDecls.push(normalized);
    }
  }

  // Detect gradients
  const gradientPattern = /(linear-gradient|radial-gradient|conic-gradient)\s*\([^)]+\)/g;
  while ((match = gradientPattern.exec(css)) !== null) {
    colors.gradients.push(match[0].substring(0, 80));
  }

  // Semantic role mapping with smart scoring
  colors.semantic = mapSemanticColors(tokenMap);

  // Collect surfaces (light bg colors)
  const surfaceTokens = Object.entries(tokenMap)
    .filter(([name]) => name.match(/surface|bg|background|panel|card/))
    .filter(([_, val]) => isLightColor(val))
    .map(([name, val]) => ({ token: name, value: val }));
  colors.surfaces = surfaceTokens.slice(0, 5);

  // Collect accents
  const accentTokens = Object.entries(tokenMap)
    .filter(([name]) => name.match(/accent|brand|primary|link|interactive/))
    .map(([name, val]) => ({ token: name, value: val }));
  colors.accents = accentTokens.slice(0, 5);

  // Collect neutrals (grays)
  const neutralTokens = Object.entries(tokenMap)
    .filter(([name]) => name.match(/neutral|gray|grey|muted|subtle/))
    .map(([name, val]) => ({ token: name, value: val }));
  colors.neutrals = neutralTokens.slice(0, 8);

  // Determine color harmony
  colors.harmony = determineColorHarmony(Object.values(tokenMap));

  // Estimate contrast quality
  colors.contrast = estimateContrast(colors.semantic);

  return colors;
}

/**
 * Map CSS variable tokens to semantic roles with smart scoring
 */
function mapSemanticColors(tokenMap) {
  const semantic = {};

  const semanticMappings = {
    'background': 'Background',
    'bg': 'Background',
    'bg-primary': 'Background',
    'color-bg': 'Background',
    'surface': 'Surface',
    'bg-surface': 'Surface',
    'surface-bg': 'Surface',
    'bg-secondary': 'Surface',
    'accent': 'Brand accent',
    'accent-primary': 'Brand accent',
    'color-accent': 'Brand accent',
    'brand': 'Brand accent',
    'primary': 'Brand accent',
    'color-primary': 'Brand accent',
    'danger': 'Destructive',
    'color-danger': 'Destructive',
    'error': 'Destructive',
    'color-error': 'Destructive',
    'text': 'Text primary',
    'text-primary': 'Text primary',
    'color-text': 'Text primary',
    'text-color': 'Text primary',
    'foreground': 'Text primary',
    'border': 'Border default',
    'border-default': 'Border default',
    'color-border': 'Border default',
    'border-color': 'Border default',
    'success': 'Success',
    'color-success': 'Success',
    'warning': 'Warning',
    'color-warning': 'Warning',
    'info': 'Info',
    'color-info': 'Info',
  };

  // Scoring helper
  function isOpaqueEnough(hex) {
    if (hex.length === 9) {
      return parseInt(hex.slice(7, 9), 16) > 128;
    }
    if (hex.length === 5) {
      return parseInt(hex.slice(3, 4).repeat(2), 16) > 128;
    }
    return true;
  }

  // First pass: exact matches
  for (const [token, role] of Object.entries(semanticMappings)) {
    const val = tokenMap[token];
    if (val && /^#[0-9a-fA-F]{3,8}$/.test(val) && isOpaqueEnough(val)) {
      if (!semantic[role]) {
        semantic[role] = { token: `--${token}`, value: val };
      }
    }
  }

  // Second pass: best partial match (shortest name wins)
  for (const [token, role] of Object.entries(semanticMappings)) {
    if (!semantic[role]) {
      let bestMatch = null;
      for (const [name, value] of Object.entries(tokenMap)) {
        if (name.includes(token) && /^#[0-9a-fA-F]{3,8}$/.test(value) && isOpaqueEnough(value)) {
          if (!bestMatch || name.length < bestMatch.name.length) {
            bestMatch = { name, value };
          }
        }
      }
      if (bestMatch) {
        semantic[role] = { token: `--${bestMatch.name}`, value: bestMatch.value };
      }
    }
  }

  // Defaults for missing roles
  if (!semantic['Background']) semantic['Background'] = { token: '--bg-primary', value: '#ffffff' };
  if (!semantic['Surface']) semantic['Surface'] = { token: '--bg-surface', value: '#f8f9fa' };
  if (!semantic['Brand accent']) semantic['Brand accent'] = { token: '--accent-primary', value: '#3b82f6' };
  if (!semantic['Text primary']) semantic['Text primary'] = { token: '--text-primary', value: '#111827' };
  if (!semantic['Border default']) semantic['Border default'] = { token: '--border-default', value: '#e5e7eb' };
  if (!semantic['Destructive']) semantic['Destructive'] = { token: '--color-danger', value: '#ef4444' };
  if (!semantic['Success']) semantic['Success'] = { token: '--color-success', value: '#22c55e' };
  if (!semantic['Warning']) semantic['Warning'] = { token: '--color-warning', value: '#f59e0b' };
  if (!semantic['Info']) semantic['Info'] = { token: '--color-info', value: '#3b82f6' };

  return semantic;
}

// ============================================================================
// TYPOGRAPHY EXTRACTION
// ============================================================================

/**
 * Helper: extract a CSS property value, stopping at both ; and }
 * Returns null if not found or invalid
 */
function extractCssValue(css, prop) {
  // Stop at both ; and } — this is the critical fix
  const regex = new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'gi');
  const match = regex.exec(css);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Helper: extract ALL values for a CSS property, strictly validated
 * Filters out var(), CSS junk, and values that contain { or }
 */
function extractAllCssValues(css, prop, maxLen = 30) {
  const regex = new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'gi');
  const values = [];
  let match;
  while ((match = regex.exec(css)) !== null) {
    const val = match[1].trim();
    if (!val.includes('var(') && !val.includes('{') && !val.includes('}') &&
        val.length <= maxLen && val.length > 0) {
      values.push(val);
    }
  }
  return [...new Set(values)];
}

// ============================================================================
// TYPOGRAPHY EXTRACTION
// ============================================================================

/**
 * Extract comprehensive typography rules from CSS
 */
function extractTypography(css, html, fontFamilies, $) {
  const typography = {
    fonts: [],
    fontWeights: [],
    hierarchy: [],
    textTransforms: {},
    letterSpacingScale: [],
    lineHeightScale: [],
    codeFont: '',
  };

  // Extract font families
  const fontSet = new Set();
  const fontFamilyRegex = /font-family\s*:\s*([^;}]+)/g;
  let match;
  while ((match = fontFamilyRegex.exec(css)) !== null) {
    const raw = match[1].trim();
    if (raw.includes('var(') || raw.includes('{') || raw.includes('}')) continue;
    const fonts = raw.split(',').map((f) => f.trim().replace(/['"]/g, ''));
    fonts.forEach((f) => {
      if (!f.startsWith('var(') && f.length < 30) {
        fontSet.add(f);
      }
    });
  }

  // Add detected font families from imports
  fontFamilies.forEach((f) => fontSet.add(f));

  typography.fonts = Array.from(fontSet);

  // Detect code font
  const codeFontPattern = /font-family\s*:\s*[^;}]*(JetBrains|Fira Code|Source Code|Consolas|Monaco|Menlo|monospace)[^;}]*/;
  const codeMatch = css.match(codeFontPattern);
  if (codeMatch) {
    typography.codeFont = codeMatch[1];
  }

  // Extract font weights actually used
  const weightSet = new Set();
  const weightRegex = /font-weight\s*:\s*(\d+)/g;
  while ((match = weightRegex.exec(css)) !== null) {
    weightSet.add(parseInt(match[1]));
  }
  typography.fontWeights = Array.from(weightSet).sort((a, b) => a - b);

  // Extract text transforms
  const transformRegex = /text-transform\s*:\s*(uppercase|lowercase|capitalize)/g;
  while ((match = transformRegex.exec(css)) !== null) {
    typography.textTransforms[match[1]] = (typography.textTransforms[match[1]] || 0) + 1;
  }

  // Extract letter spacing — STRICT validation
  typography.letterSpacingScale = extractAllCssValues(css, 'letter-spacing', 20);

  // Extract line heights — STRICT validation
  typography.lineHeightScale = extractAllCssValues(css, 'line-height', 20);

  // Extract font sizes and build hierarchy (9-72px range only) — stop at both ; and }
  const sizeRegex = /font-size\s*:\s*(\d+(?:\.\d+)?px)/g;
  const sizes = new Set();
  while ((match = sizeRegex.exec(css)) !== null) {
    const num = parseFloat(match[1]);
    if (num >= 9 && num <= 72) {
      sizes.add(match[1]);
    }
  }

  // Extract from HTML element computed styles
  const elements = [
    { tag: 'h1', level: 'Heading 1' },
    { tag: 'h2', level: 'Heading 2' },
    { tag: 'h3', level: 'Heading 3' },
    { tag: 'p', level: 'Body' },
    { tag: 'small', level: 'Caption' },
  ];

  for (const el of elements) {
    const $el = $(el.tag);
    if ($el.length) {
      const fontSize = $el.css('font-size');
      if (fontSize && fontSize.endsWith('px')) {
        const num = parseFloat(fontSize);
        if (num >= 9 && num <= 72) {
          sizes.add(fontSize);
        }
      }
    }
  }

  // Build hierarchy - top 7 most distinct sizes
  const sortedSizes = Array.from(sizes)
    .map((s) => ({ size: s, num: parseFloat(s) }))
    .sort((a, b) => b.num - a.num)
    .slice(0, 7);

  const levels = ['Display', 'Heading 1', 'Heading 2', 'Heading 3', 'Body', 'Caption', 'Small'];
  const defaultWeights = [500, 500, 500, 500, 400, 400, 400];
  const defaultLineHeights = [1.1, 1.2, 1.3, 1.4, 1.6, 1.4, 1.4];
  const defaultLetterSpacing = ['-2.4px', '-1.2px', '-0.8px', '-0.4px', '-0.1px', '0', '0'];

  sortedSizes.forEach((s, i) => {
    typography.hierarchy.push({
      level: levels[i] || `Level ${i + 1}`,
      size: s.size,
      weight: defaultWeights[i] || 400,
      lineHeight: defaultLineHeights[i] || 1.5,
      letterSpacing: defaultLetterSpacing[i] || '0',
    });
  });

  if (typography.hierarchy.length === 0) {
    typography.hierarchy = [
      { level: 'Body', size: '16px', weight: 400, lineHeight: 1.6, letterSpacing: '0' },
    ];
  }

  return typography;
}

// ============================================================================
// COMPONENT EXTRACTION
// ============================================================================

/**
 * Extract comprehensive component styles from CSS
 */
function extractComponents(css, $, structureHints) {
  const components = {};

  // Component definitions with selectors
  const componentDefs = [
    {
      name: 'Button (primary)',
      selectors: ['.btn-primary', 'button[type="submit"]', '.btn', 'button', '.button-primary', '.primary-btn'],
    },
    {
      name: 'Button (secondary)',
      selectors: ['.btn-secondary', '.btn-outline', '.button-secondary', '.secondary-btn'],
    },
    {
      name: 'Button (ghost)',
      selectors: ['.btn-ghost', '.btn-text', '.button-ghost', '.text-btn'],
    },
    {
      name: 'Input',
      selectors: ['input[type="text"]', 'input[type="email"]', '.input', '.form-input', 'input:not([type])', '.text-field'],
    },
    {
      name: 'Card',
      selectors: ['.card', '.panel', '.box', '.tile', '.surface'],
    },
    {
      name: 'Navigation',
      selectors: ['.nav', '.navbar', '.sidebar', '.topbar', '.header', 'nav'],
    },
    {
      name: 'Badge',
      selectors: ['.badge', '.tag', '.chip', '.pill', '.label'],
    },
    {
      name: 'Modal',
      selectors: ['.modal', '.dialog', '.overlay', '[role="dialog"]'],
    },
    {
      name: 'Tooltip',
      selectors: ['.tooltip', '[data-tooltip]', '.popover'],
    },
    {
      name: 'Dropdown',
      selectors: ['.dropdown-menu', '.dropdown', '.menu', '[role="menu"]'],
    },
    {
      name: 'Table',
      selectors: ['table', '.table', '[role="table"]', '.data-table'],
    },
    {
      name: 'Avatar',
      selectors: ['.avatar', '.profile-img', '.user-avatar'],
    },
    {
      name: 'Toggle/Switch',
      selectors: ['.toggle', '.switch', '[role="switch"]'],
    },
  ];

  for (const def of componentDefs) {
    const style = extractComponentStyle(css, def.selectors);
    if (Object.keys(style).length > 0) {
      components[def.name] = style;
    }
  }

  // If no components found, add sensible defaults
  if (Object.keys(components).length === 0) {
    components['Button (primary)'] = {
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: 500,
    };
    components['Input'] = {
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '14px',
    };
    components['Card'] = {
      padding: '16px',
      borderRadius: '8px',
    };
  }

  return components;
}

/**
 * Extract style properties for a component selector — STRICT validation
 */
function extractComponentStyle(css, selectors) {
  const style = {};

  for (const selector of selectors) {
    const escapedSelector = selector.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`, 'g');
    const match = regex.exec(css);
    if (match) {
      const rules = match[1];

      // Extract all relevant CSS properties using the strict helper approach
      const extractProp = (prop, propName) => {
        const propRegex = new RegExp(`${prop}\\s*:\\s*([^;}]*)`, 'i');
        const m = rules.match(propRegex);
        if (m) {
          const val = m[1].trim();
          // Only accept clean values (no var refs, no CSS junk)
          if (!val.includes('var(') && !val.includes('{') && val.length < 50) {
            style[propName] = val;
          }
        }
      };

      extractProp('padding', 'padding');
      extractProp('background-color', 'backgroundColor');
      // Don't extract 'background' if it's a gradient or complex
      const bgMatch = rules.match(/background\s*:\s*([^;}]*)/i);
      if (bgMatch) {
        const val = bgMatch[1].trim();
        if (!val.includes('var(') && !val.includes('url(') && !val.includes('{') && val.length < 40 &&
            /^(#[0-9a-fA-F]+|rgb\([^)]+\)|rgba\([^)]+\)|transparent|none)$/i.test(val)) {
          style.background = val;
        }
      }
      extractProp('border', 'border');
      extractProp('border-radius', 'borderRadius');
      extractProp('font-size', 'fontSize');
      extractProp('font-weight', 'fontWeight');
      extractProp('color', 'color');
      extractProp('box-shadow', 'boxShadow');
      extractProp('height', 'height');
      extractProp('min-height', 'minHeight');
      extractProp('gap', 'gap');
      extractProp('text-transform', 'textTransform');

      // Parse fontWeight if it's a string
      if (style.fontWeight) {
        const num = parseInt(style.fontWeight);
        if (!isNaN(num) && num >= 100 && num <= 900) {
          style.fontWeight = num;
        } else {
          delete style.fontWeight;
        }
      }

      // Height validation — reject 0px for components that should have content
      if (style.height && style.height === '0px') {
        delete style.height;
      }

      // Check for hover/focus states
      const stateRegex = new RegExp(`${escapedSelector}:(hover|focus|active|disabled)\\s*\\{([^}]+)\\}`, 'gi');
      let stateMatch;
      while ((stateMatch = stateRegex.exec(css)) !== null) {
        const state = stateMatch[1];
        const stateRules = stateMatch[2].trim();
        if (state === 'hover' && !style.hover) {
          style.hover = stateRules.length < 60 ? stateRules : stateRules.substring(0, 57) + '...';
        }
        if (state === 'focus' && !style.focus) {
          style.focus = stateRules.length < 60 ? stateRules : stateRules.substring(0, 57) + '...';
        }
        if (state === 'disabled' && !style.disabled) {
          style.disabled = stateRules.length < 60 ? stateRules : stateRules.substring(0, 57) + '...';
        }
      }

      // Only return if we found meaningful properties
      if (Object.keys(style).length > 0) {
        break;
      }
    }
  }

  return style;
}

// ============================================================================
// LAYOUT EXTRACTION
// ============================================================================

/**
 * Extract layout principles from CSS
 */
function extractLayout(css, html, $) {
  const layout = {
    baseUnit: '4px',
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
    maxContentWidth: '1080px',
    sectionGap: '48-64px',
    borderRadiusScale: {
      badge: '4px',
      button: '6px',
      card: '8px',
      input: '6px',
      modal: '12px',
      popover: '8px',
    },
    gridSystem: 'Flexbox',
    containerPadding: '',
  };

  // Detect spacing patterns
  const spacingRegex = /(?:gap|margin|padding)\s*:\s*(\d+)px/g;
  let match;
  const spacingValues = [];
  while ((match = spacingRegex.exec(css)) !== null) {
    const val = parseInt(match[1]);
    if (val >= 4 && val <= 128 && val % 4 === 0) {
      spacingValues.push(val);
    }
  }

  if (spacingValues.length > 0) {
    const uniqueValues = [...new Set(spacingValues)].sort((a, b) => a - b);
    const baseUnit = uniqueValues.reduce((a, b) => gcd(a, b));
    layout.baseUnit = `${baseUnit}px`;
    // Cap to most common scale (8 values)
    layout.spacingScale = uniqueValues.slice(0, 8);
  }

  // Detect max-width patterns — stop at both ; and }
  const maxWidthRegex = /max-width\s*:\s*(\d+(?:px|rem))/g;
  const maxWidths = [];
  while ((match = maxWidthRegex.exec(css)) !== null) {
    maxWidths.push(match[1]);
  }
  if (maxWidths.length > 0) {
    // Most common max-width
    const counts = {};
    maxWidths.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
    layout.maxContentWidth = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Detect border radius scale from CSS — STRICT validation
  const radiusRegex = /border-radius\s*:\s*([^;}]+)/g;
  const radii = [];
  while ((match = radiusRegex.exec(css)) !== null) {
    const val = match[1].trim();
    // Only clean radius values: must be valid CSS (numbers with units, or 0)
    // Reject: var(), {, }, values > 50px (implausible for UI), multi-value percentages
    if (!val.includes('var(') && !val.includes('{') && !val.includes('}') &&
        val.length < 20) {
      // Must be a simple value: single px, rem, em, %, or 0
      if (/^0$|^\d+(\.\d+)?(px|rem|em|%)$/.test(val)) {
        const numVal = parseFloat(val);
        // Reject implausible values (> 50px is almost certainly wrong)
        if (val.endsWith('px') && numVal > 50) continue;
        radii.push(val);
      } else if (/^calc\(/.test(val)) {
        continue; // Skip calc() values
      } else if (val.includes(' ')) {
        // Multi-value like "10px 20px" — skip (too complex for a single radius)
        continue;
      }
    }
  }
  if (radii.length > 0) {
    const uniqueRadii = [...new Set(radii)];
    if (uniqueRadii.length >= 1) layout.borderRadiusScale.badge = uniqueRadii[0];
    if (uniqueRadii.length >= 2) layout.borderRadiusScale.button = uniqueRadii[Math.min(1, uniqueRadii.length - 1)];
    if (uniqueRadii.length >= 3) layout.borderRadiusScale.card = uniqueRadii[Math.min(2, uniqueRadii.length - 1)];
    if (uniqueRadii.length >= 4) layout.borderRadiusScale.modal = uniqueRadii[uniqueRadii.length - 1];
  }

  // Detect grid system
  if (css.includes('display: grid') || css.includes('display:grid')) {
    layout.gridSystem = 'CSS Grid';
  } else if (css.includes('display: flex') || css.includes('display:flex')) {
    layout.gridSystem = 'Flexbox';
  }

  // Detect container padding
  const containerPaddingMatch = css.match(/(?:padding|padding-left|padding-right)\s*:\s*(\d+)px/);
  if (containerPaddingMatch) {
    layout.containerPadding = `${containerPaddingMatch[1]}px`;
  }

  return layout;
}

/**
 * Calculate GCD of two numbers
 */
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// ============================================================================
// ELEVATION EXTRACTION
// ============================================================================

/**
 * Extract elevation/shadow system from CSS
 */
function extractElevation(css) {
  const elevation = {
    levels: [
      { level: 'Level 0', usage: 'Page bg', shadow: 'none' },
      { level: 'Level 1', usage: 'Card, panel', shadow: '0 1px 2px rgba(0,0,0,0.05)' },
      { level: 'Level 2', usage: 'Dropdown', shadow: '0 4px 12px rgba(0,0,0,0.1)' },
      { level: 'Level 3', usage: 'Modal, dialog', shadow: '0 8px 24px rgba(0,0,0,0.15)' },
      { level: 'Level 4', usage: 'Toast, snackbar', shadow: '0 12px 32px rgba(0,0,0,0.2)' },
    ],
    borderDepth: false,
    glassEffects: false,
    blurEffects: false,
  };

  // Extract clean box-shadows — stop at both ; and }
  const shadowRegex = /box-shadow\s*:\s*([^;}]+)/g;
  let match;
  const shadows = [];
  while ((match = shadowRegex.exec(css)) !== null) {
    const shadow = match[1].trim();
    // Strict validation: no var(), no {, no }, no CSS selectors, reasonable length
    if (!shadow.includes('var(') && !shadow.includes('{') && !shadow.includes('}') &&
        !shadow.includes('!important') && shadow.length < 80 &&
        /^[0-9\s\-,.rgba()%]+$/.test(shadow)) {
      shadows.push(shadow);
    }
  }

  if (shadows.length > 0) {
    const uniqueShadows = [...new Set(shadows)].slice(0, 4);
    uniqueShadows.forEach((shadow, i) => {
      if (elevation.levels[i + 1]) {
        elevation.levels[i + 1].shadow = shadow;
      }
    });
  }

  // Detect border-based depth (flat design)
  const borderCount = (css.match(/border\s*:\s*1px/g) || []).length;
  const shadowCount = (css.match(/box-shadow/g) || []).length;
  if (borderCount > shadowCount * 2) {
    elevation.borderDepth = true;
  }

  // Detect glass/blur effects
  if (css.includes('backdrop-filter: blur') || css.includes('backdrop-filter:blur')) {
    elevation.glassEffects = true;
    elevation.blurEffects = true;
  }

  return elevation;
}

// ============================================================================
// MOTION EXTRACTION
// ============================================================================

/**
 * Extract motion/animation system from CSS
 */
function extractMotion(css) {
  const motion = {
    transitions: [],
    animations: [],
    durationScale: [],
    easingScale: [],
    motionStyle: 'subtle',
    hasReducedMotion: false,
  };

  // Extract transitions — stop at both ; and }, strict validation
  const transitionRegex = /transition\s*:\s*([^;}]+)/g;
  let match;
  const transitions = [];
  while ((match = transitionRegex.exec(css)) !== null) {
    const val = match[1].trim();
    // Only accept clean transitions (no CSS variable refs, no obfuscated selectors, no curly braces)
    if (!val.includes('var(') && !val.includes('{') && !val.includes('}') &&
        !val.includes('not(') && val.length < 50 && /^[a-z\-0-9\s,.#()]+$/i.test(val)) {
      transitions.push(val);
    }
  }
  motion.transitions = [...new Set(transitions)].slice(0, 5);

  // Extract @keyframes animations
  const keyframeRegex = /@keyframes\s+([\w-]+)/g;
  const animations = [];
  while ((match = keyframeRegex.exec(css)) !== null) {
    animations.push(match[1]);
  }
  motion.animations = animations.slice(0, 5);

  // Extract animation durations — stop at both ; and }, strict validation
  const durationRegex = /(?:animation-duration|transition-duration)\s*:\s*([^;}]+)/g;
  const durations = [];
  while ((match = durationRegex.exec(css)) !== null) {
    const val = match[1].trim();
    // Only clean duration values (no variable refs, no obfuscated selectors)
    if (!val.includes('var(') && !val.includes('{') && !val.includes('}') &&
        !val.includes('not(') && val.length < 15) {
      durations.push(val);
    }
  }
  motion.durationScale = [...new Set(durations)].slice(0, 5);

  // Extract easing functions — stop at both ; and }, strict validation
  const easingRegex = /(?:transition-timing|animation-timing)-function\s*:\s*([^;}]+)/g;
  const easings = [];
  while ((match = easingRegex.exec(css)) !== null) {
    const val = match[1].trim();
    // Only clean easing values
    if (!val.includes('var(') && !val.includes('{') && !val.includes('}') &&
        !val.includes('not(') && val.length < 35) {
      easings.push(val);
    }
  }
  motion.easingScale = [...new Set(easings)].slice(0, 5);

  // Detect prefers-reduced-motion support
  if (css.includes('prefers-reduced-motion')) {
    motion.hasReducedMotion = true;
  }

  // Determine motion style
  if (motion.animations.length === 0 && motion.transitions.length === 0) {
    motion.motionStyle = 'static';
  } else if (motion.animations.length > 2) {
    motion.motionStyle = 'playful';
  } else if (motion.durationScale.some((d) => parseFloat(d) > 500)) {
    motion.motionStyle = 'dramatic';
  } else {
    motion.motionStyle = 'subtle';
  }

  return motion;
}

// ============================================================================
// ACCESSIBILITY ANALYSIS
// ============================================================================

/**
 * Analyze accessibility features
 */
function analyzeAccessibility(css, $) {
  const a11y = {
    focusStyles: false,
    skipLinks: false,
    ariaLandmarks: false,
    reducedMotionSupport: false,
    highContrastSupport: false,
    srOnlyClass: false,
    outlineReset: false,
    touchTargetCompliance: 'unknown',
  };

  // Check for focus styles
  if (css.includes(':focus') && (css.includes('outline') || css.includes('box-shadow'))) {
    a11y.focusStyles = true;
  }

  // Check for outline reset (bad practice)
  if (css.includes('outline: none') || css.includes('outline:0')) {
    a11y.outlineReset = true;
  }

  // Check for skip navigation
  const html = $.html();
  if (html.includes('skip') && (html.includes('nav') || html.includes('content'))) {
    a11y.skipLinks = true;
  }

  // Check for ARIA landmarks
  if (css.includes('[role=') || css.includes('aria-')) {
    a11y.ariaLandmarks = true;
  }

  // Check for prefers-reduced-motion
  if (css.includes('prefers-reduced-motion')) {
    a11y.reducedMotionSupport = true;
  }

  // Check for prefers-contrast
  if (css.includes('prefers-contrast')) {
    a11y.highContrastSupport = true;
  }

  // Check for screen-reader only class
  if (css.includes('sr-only') || css.includes('visually-hidden') || css.includes('screen-reader')) {
    a11y.srOnlyClass = true;
  }

  return a11y;
}

// ============================================================================
// DESIGN PATTERN DETECTION
// ============================================================================

/**
 * Detect common design patterns
 */
function detectDesignPatterns(css, html, $, structureHints) {
  const patterns = {
    layoutPattern: 'freeform',
    navigationPattern: 'topbar',
    heroStyle: 'none',
    cardStyle: 'bordered',
    dataDisplay: 'table',
    componentDensity: 'comfortable',
    visualStyle: 'clean',
    designLanguage: 'modern',
  };

  // Layout pattern
  if (css.includes('display: grid') || css.includes('display:grid')) {
    patterns.layoutPattern = 'grid';
  } else if (css.includes('display: flex') || css.includes('display:flex')) {
    patterns.layoutPattern = 'flexbox';
  }

  // Navigation pattern
  if (css.includes('.sidebar') || css.includes('aside')) {
    patterns.navigationPattern = 'sidebar';
  } else if (css.includes('.navbar') || css.includes('header')) {
    patterns.navigationPattern = 'topbar';
  } else if (css.includes('.bottom-nav') || css.includes('bottom-nav')) {
    patterns.navigationPattern = 'bottom-nav';
  }

  // Hero style
  if (css.includes('background-image') || css.includes('gradient')) {
    patterns.heroStyle = 'gradient';
  }
  if (css.includes('background-size: cover') || css.includes('background-size:cover')) {
    patterns.heroStyle = 'full-bleed';
  }

  // Card style
  if (css.includes('box-shadow') && css.includes('.card')) {
    patterns.cardStyle = 'shadowed';
  } else if (css.includes('border') && css.includes('.card')) {
    patterns.cardStyle = 'bordered';
  } else if (css.includes('border-radius') && css.includes('.card')) {
    patterns.cardStyle = 'elevated';
  }

  // Data display
  if (structureHints.hasTable) {
    patterns.dataDisplay = 'table';
  } else if (structureHints.hasCards) {
    patterns.dataDisplay = 'card-grid';
  } else if (structureHints.hasGrid) {
    patterns.dataDisplay = 'masonry';
  }

  // Component density
  if (css.includes('padding: 4px') || css.includes('padding:4px') || css.includes('padding: 8px') || css.includes('padding:8px')) {
    patterns.componentDensity = 'compact';
  }

  // Visual style
  if (css.includes('border-radius: 0') || css.includes('border-radius:0')) {
    patterns.visualStyle = 'brutalist';
  } else if (css.includes('border-radius: 9999px') || css.includes('border-radius:9999px') || css.includes('border-radius: 50%')) {
    patterns.visualStyle = 'rounded';
  }

  // Design language
  if (css.includes('--tw-') || css.includes('tailwind')) {
    patterns.designLanguage = 'utility-first';
  } else if (css.includes('@emotion') || css.includes('css-')) {
    patterns.designLanguage = 'css-in-js';
  }

  return patterns;
}

// ============================================================================
// RESPONSIVE EXTRACTION
// ============================================================================

/**
 * Extract responsive breakpoints from CSS
 */
function extractResponsive(css, $) {
  const responsive = {
    breakpoints: [
      { name: 'Mobile', width: '< 640px', behavior: 'Single column, stacked layout, bottom nav' },
      { name: 'Tablet', width: '< 1024px', behavior: '2-column grid, sidebar collapses to overlay' },
      { name: 'Desktop', width: '>= 1024px', behavior: 'Full layout with persistent sidebar' },
      { name: 'Wide', width: '>= 1440px', behavior: 'Extended content width, multi-column' },
    ],
    touchTarget: '44x44px',
    mobileMinFontSize: '13px',
    fluidTypography: false,
    containerQueries: false,
    mobileFirst: false,
  };

  // Extract media queries
  const minWidthRegex = /@media\s*\([^)]*min-width:\s*(\d+)px[^)]*\)/g;
  const maxWidthRegex = /@media\s*\([^)]*max-width:\s*(\d+)px[^)]*\)/g;
  let match;
  const minBreakpoints = [];
  const maxBreakpoints = [];

  while ((match = minWidthRegex.exec(css)) !== null) {
    minBreakpoints.push(parseInt(match[1]));
  }
  while ((match = maxWidthRegex.exec(css)) !== null) {
    maxBreakpoints.push(parseInt(match[1]));
  }

  const allBreakpoints = [...new Set([...minBreakpoints, ...maxBreakpoints])].sort((a, b) => a - b);

  if (allBreakpoints.length > 0) {
    if (allBreakpoints[0]) responsive.breakpoints[0].width = `< ${allBreakpoints[0]}px`;
    if (allBreakpoints[1]) responsive.breakpoints[1].width = `< ${allBreakpoints[1]}px`;
    if (allBreakpoints.length >= 2) {
      responsive.breakpoints[2].width = `>= ${allBreakpoints[1]}px`;
    }
    if (allBreakpoints[2]) {
      responsive.breakpoints[3].width = `>= ${allBreakpoints[2]}px`;
    } else if (allBreakpoints.length < 4) {
      responsive.breakpoints.pop();
    }
  }

  // Detect fluid typography
  if (css.includes('clamp(')) {
    responsive.fluidTypography = true;
  }

  // Detect container queries
  if (css.includes('@container')) {
    responsive.containerQueries = true;
  }

  // Detect mobile-first approach
  if (minBreakpoints.length > maxBreakpoints.length) {
    responsive.mobileFirst = true;
  }

  return responsive;
}

// ============================================================================
// VISUAL THEME INFERENCE
// ============================================================================

/**
 * Infer visual theme from comprehensive design characteristics
 */
function inferVisualTheme(colors, typography, layout, motion, patterns, meta, cssFramework) {
  const theme = {
    atmosphere: '',
    mood: '',
    density: '',
    personality: '',
    framework: '',
    summary: '',
  };

  const bgIsDark = isDarkColor(colors.semantic['Background']?.value);
  const isMinimal = layout.spacingScale[0] <= 8;
  const hasManyColors = Object.keys(colors.semantic).length > 6;
  const hasAnimations = motion.animations.length > 0;
  const isPlayful = motion.motionStyle === 'playful';
  const isStatic = motion.motionStyle === 'static';

  // Atmosphere
  if (bgIsDark) {
    theme.atmosphere = 'dark mode';
    if (isMinimal) {
      theme.atmosphere += ', developer-focused';
    }
  } else {
    theme.atmosphere = 'light mode';
    if (isMinimal) {
      theme.atmosphere += ', clean and airy';
    }
  }

  // Mood
  if (colors.accents.length > 0) {
    const accentColor = colors.accents[0].value;
    if (isWarmColor(accentColor)) {
      theme.mood = 'warm and energetic';
    } else if (isCoolColor(accentColor)) {
      theme.mood = 'cool and professional';
    } else {
      theme.mood = 'neutral and balanced';
    }
  }

  // Density
  if (patterns.componentDensity === 'compact') {
    theme.density = 'information-dense';
  } else if (patterns.componentDensity === 'comfortable') {
    theme.density = 'comfortable spacing';
  }

  // Personality
  if (isPlayful) {
    theme.personality = 'playful and expressive';
  } else if (isStatic) {
    theme.personality = 'serious and functional';
  } else {
    theme.personality = 'subtle and refined';
  }

  // Framework note
  if (cssFramework.name !== 'Custom') {
    theme.framework = `Built with ${cssFramework.name}`;
  }

  // Build summary
  const summaryParts = [];
  const title = meta.title || 'This website';
  summaryParts.push(`The interface of "${title}" embodies`);

  if (bgIsDark) {
    summaryParts.push('"opinionated calm" with a dark surface');
  } else {
    summaryParts.push('"clean clarity" with a light surface');
  }

  if (typography.fonts.includes('Inter') || typography.fonts.includes('system-ui')) {
    summaryParts.push('and uses modern system fonts for a native feel');
  }

  if (hasAnimations) {
    summaryParts.push('. Subtle animations enhance the experience');
  }

  if (patterns.cardStyle === 'bordered') {
    summaryParts.push('. Cards use borders for separation instead of shadows');
  }

  theme.summary = summaryParts.join('');

  return theme;
}

// ============================================================================
// DO'S AND DON'TS GENERATION
// ============================================================================

/**
 * Generate context-aware do's and don'ts
 */
function generateDosAndDonts(colors, typography, components, layout, elevation, motion, accessibility) {
  const dos = [];
  const donts = [];

  const bgIsDark = isDarkColor(colors.semantic['Background']?.value);

  // Color-based rules
  if (bgIsDark) {
    dos.push('Use light text (WCAG AA compliant) on dark backgrounds');
    dos.push('Use subtle borders or color shifts for depth instead of shadows');
    donts.push('Don\'t use dark text on dark backgrounds');
    donts.push('Don\'t use pure white (#fff) text on pure black (#000) — causes eye strain');
  } else {
    dos.push('Use dark text with sufficient contrast (4.5:1 minimum) on light backgrounds');
    donts.push('Don\'t use light gray text on white backgrounds');
  }

  // Typography-based rules
  const hasNegativeTracking = typography.hierarchy.some((h) => h.letterSpacing.startsWith('-'));
  if (hasNegativeTracking) {
    dos.push('Keep letter-spacing tight on headings (negative tracking for large text)');
    donts.push('Don\'t use negative letter-spacing on body text');
  }

  if (typography.fontWeights.length <= 3) {
    dos.push(`Limit font weights to ${typography.fontWeights.length} weights for visual harmony`);
  } else {
    donts.push(`Don't exceed 3 font weights — currently using ${typography.fontWeights.length}`);
  }

  // Layout-based rules
  if (layout.spacingScale.length > 0) {
    dos.push(`Use the ${layout.baseUnit} base unit spacing scale consistently`);
  }

  // Elevation-based rules
  if (elevation.borderDepth) {
    dos.push('Use borders for depth separation, not shadows');
    donts.push('Don\'t mix border-based and shadow-based depth systems');
  }

  if (elevation.glassEffects) {
    dos.push('Use backdrop blur sparingly for overlay surfaces');
    donts.push('Don\'t use glass effects on small elements');
  }

  // Motion-based rules
  if (motion.hasReducedMotion || motion.motionStyle === 'subtle') {
    dos.push('Keep transitions under 200ms for interactive elements');
  }

  if (motion.motionStyle === 'static') {
    dos.push('Use hover state changes (color, brightness) instead of animations for feedback');
  }

  // Accessibility-based rules
  if (accessibility.outlineReset) {
    donts.push('Don\'t remove focus outlines without providing custom focus styles');
  }

  if (accessibility.focusStyles) {
    dos.push('Maintain visible focus indicators for all interactive elements');
  }

  if (!accessibility.srOnlyClass) {
    donts.push('Don\'t hide content with display:none — use visually-hidden class for screen readers');
  }

  // General rules
  donts.push('Don\'t mix warm and cool grays in the same surface');
  donts.push('Don\'t use more than 2 accent colors');

  // Component-specific rules
  if (components['Button (primary)']) {
    dos.push('Maintain consistent button sizing and border-radius across the app');
    donts.push('Don\'t mix different button border radii in the same interface');
  }

  return { dos, donts };
}

// ============================================================================
// AGENT PROMPT GENERATION
// ============================================================================

/**
 * Generate ready-to-use agent prompts
 */
function generateAgentPrompts(colors, typography, components, layout, patterns) {
  const paletteSummary = Object.entries(colors.semantic)
    .slice(0, 6)
    .map(([role, data]) => `${role.toLowerCase()}=${data.value}`)
    .join(', ');

  const prompts = {
    quickPalette: paletteSummary,
    componentPrompts: [],
    pagePrompts: [],
  };

  // Component-specific prompts
  if (components['Button (primary)']) {
    const btn = components['Button (primary)'];
    prompts.componentPrompts.push(
      `Create a primary button: ${btn.padding ? `${btn.padding} padding` : 'standard padding'}, ${btn.borderRadius ? `${btn.borderRadius} border-radius` : '6px border-radius'}, using the brand accent color for background with contrasting text. Include hover (brightness increase), focus (ring), and disabled (reduced opacity) states.`
    );
  }

  if (components['Input']) {
    const inp = components['Input'];
    prompts.componentPrompts.push(
      `Create a text input: ${inp.padding ? `${inp.padding} padding` : '8px 12px padding'}, ${inp.borderRadius ? `${inp.borderRadius} border-radius` : '6px border-radius'}, with a subtle border. Include focus state with accent color border and optional ring. Show error state with destructive color.`
    );
  }

  if (components['Card']) {
    const card = components['Card'];
    prompts.componentPrompts.push(
      `Create a card component: ${card.padding ? `${card.padding} padding` : '16px padding'}, ${card.borderRadius ? `${card.borderRadius} border-radius` : '8px border-radius'}, using surface background. ${patterns.cardStyle === 'shadowed' ? 'Add subtle shadow for elevation.' : 'Use border for separation.'}`
    );
  }

  // Page-level prompts
  prompts.pagePrompts.push(
    `"Create a dashboard page" → Use ${patterns.dataDisplay === 'card-grid' ? 'card grid layout' : 'data table'}, ${layout.spacingScale[0] ? `${layout.spacingScale[0]}px base gap` : '16px gap'}, accent color for key metrics. Section headers use ${typography.hierarchy[1]?.size || '24px'} font size.`
  );

  prompts.pagePrompts.push(
    `"Create a settings page" → Grouped sections with subtle borders, toggle switches using accent color, ${typography.hierarchy[4]?.size || '14px'} body text, surface background for grouped cards.`
  );

  prompts.pagePrompts.push(
    `"Build a data table" → Compact rows, ${patterns.dataDisplay === 'table' ? 'sticky header' : 'grid layout'}, hover row highlight at 4% overlay, monospaced numbers if present.`
  );

  return prompts;
}

// ============================================================================
// COLOR UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize color value to hex
 */
function normalizeColor(value) {
  if (!value) return null;

  // Already hex
  if (value.startsWith('#')) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    if (value.length === 5) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}${value[4]}${value[4]}`;
    }
    if (value.length === 7 || value.length === 9) {
      return value;
    }
    return value;
  }

  // RGB/RGBA
  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  // HSL - basic approximation (just flag it)
  const hslMatch = value.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
  if (hslMatch) {
    return hslToHex(parseInt(hslMatch[1]), parseInt(hslMatch[2]), parseInt(hslMatch[3]));
  }

  // Named colors
  const namedColors = {
    white: '#ffffff',
    black: '#000000',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    transparent: 'transparent',
    currentcolor: 'currentColor',
    inherit: 'inherit',
  };

  const lower = value.toLowerCase().trim();
  return namedColors[lower] || null;
}

/**
 * Convert HSL to Hex
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Check if a color is dark
 */
function isDarkColor(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.length === 9 ? hex.slice(0, 7) : hex;
  if (cleanHex.length < 7) return false;
  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Check if a color is light
 */
function isLightColor(hex) {
  return !isDarkColor(hex);
}

/**
 * Check if a color is warm (reds, oranges, yellows)
 */
function isWarmColor(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.length === 9 ? hex.slice(0, 7) : hex;
  if (cleanHex.length < 7) return false;
  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);
  return r > g && r > b;
}

/**
 * Check if a color is cool (blues, greens, purples)
 */
function isCoolColor(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.length === 9 ? hex.slice(0, 7) : hex;
  if (cleanHex.length < 7) return false;
  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);
  return b > r || g > r;
}

/**
 * Determine color harmony from palette
 */
function determineColorHarmony(colors) {
  if (colors.length < 2) return 'monochromatic';

  // Simple heuristic based on hue differences
  const hues = [];
  for (const color of colors) {
    if (color.startsWith('#') && color.length >= 7) {
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h;
      if (max === min) {
        h = 0;
      } else if (max === r) {
        h = (60 * (g - b) / (max - min) + 360) % 360;
      } else if (max === g) {
        h = (60 * (b - r) / (max - min) + 120) % 360;
      } else {
        h = (60 * (r - g) / (max - min) + 240) % 360;
      }
      hues.push(h);
    }
  }

  if (hues.length < 2) return 'monochromatic';

  const maxDiff = Math.max(...hues) - Math.min(...hues);
  if (maxDiff < 30) return 'monochromatic';
  if (maxDiff < 60) return 'analogous';
  if (maxDiff > 150 && maxDiff < 210) return 'complementary';
  return 'polychromatic';
}

/**
 * Estimate contrast quality
 */
function estimateContrast(semantic) {
  if (!semantic['Background'] || !semantic['Text primary']) return 'unknown';
  const bg = semantic['Background'].value;
  const text = semantic['Text primary'].value;
  if (!bg.startsWith('#') || !text.startsWith('#')) return 'unknown';

  const bgLum = getRelativeLuminance(bg);
  const textLum = getRelativeLuminance(text);
  const contrastRatio = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

  if (contrastRatio >= 7) return 'AAA (excellent)';
  if (contrastRatio >= 4.5) return 'AA (good)';
  if (contrastRatio >= 3) return 'AA Large (acceptable)';
  return 'Fail (poor)';
}

/**
 * Get relative luminance of a color (WCAG 2.1)
 */
function getRelativeLuminance(hex) {
  const cleanHex = hex.length === 9 ? hex.slice(0, 7) : hex;
  if (cleanHex.length < 7) return 0;

  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(cleanHex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

module.exports = { analyzeDesign };
