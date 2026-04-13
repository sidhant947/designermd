# designermd

AI-powered CLI tool that analyzes any website URL and generates a comprehensive **DESIGN.md** file with 11 standard design system sections.

## Features

- **Interactive terminal UI** with ASCII art banner
- **Automatic CSS & HTML analysis** — fetches all stylesheets, inline styles, and font resources
- **CSS framework detection** — identifies Tailwind, Bootstrap, Bulma, Chakra, Material UI, Ant Design
- **Smart color extraction** — semantic role mapping with gradient detection, harmony analysis, and WCAG contrast scoring
- **Typography hierarchy** — font families, weight usage, text transforms, letter-spacing, line-height scale
- **Component style analysis** — buttons, inputs, cards, navigation, badges, modals, tooltips, dropdowns, tables, avatars, toggles
- **Layout intelligence** — spacing scale via GCD analysis, border-radius scale, grid system detection (Flexbox vs CSS Grid)
- **Elevation/shadow system** — shadow hierarchy, border-depth detection, glass/blur effect identification
- **Motion analysis** — transitions, keyframe animations, duration scale, easing functions, reduced-motion support
- **Accessibility audit** — focus indicators, skip links, ARIA landmarks, screen reader utilities, outline reset detection
- **Design pattern detection** — layout pattern, navigation pattern, hero style, card style, component density, visual style
- **Responsive breakpoint detection** — media queries, fluid typography (clamp), container queries, mobile-first detection
- **Auto-generated do's and don'ts** — context-aware rules based on actual design characteristics
- **Agent prompt guide** — ready-to-use component prompts, page templates, and design system commands for AI agents

## Installation

```bash
npm install -g designermd
```

Or install locally and link:

```bash
cd designermd
npm install
npm link
```

## Usage

```bash
designermd
```

You'll be prompted to enter a website URL. The tool will:

1. Fetch the website, its stylesheets, and font resources
2. Analyze the complete design system (colors, typography, components, motion, accessibility)
3. Generate a `DESIGN.md` file in your current working directory

### Example

```
$ designermd

       _           _                                     _ 
   __| | ___  ___(_) __ _ _ __   ___ _ __ _ __ ___   __| |
  / _` |/ _ \/ __| |/ _` | '_ \ / _ \ '__| '_ ` _ \ / _` |
 | (_| |  __/\__ \ | (_| | | | |  __/ |  | | | | | | (_| |
  \__,_|\___||___/_|\__, |_| |_|\___|_|  |_| |_| |_|\__,_|
                    |___/                                 
  AI-powered design analyzer & DESIGN.md generator
  Analyzes CSS, HTML, fonts, and structure

? Enter website URL to analyze: https://linear.app

→ Fetching https://linear.app...
✓ Website fetched successfully
  Found 16 stylesheet(s), 1 inline style block(s), 0 font resource(s)
  CSS framework: Custom
  Site title: Linear – The system for product development

→ Analyzing design system...
✓ Design analysis complete

  Design Summary:
  ─────────────────────────────────────
  Colors:    9 semantic roles | 5 accent(s) | 0 neutral(s)
  Typography: 7 levels | 33 font(s) | 7 weight(s)
  Components: 3 detected
  Layout:     CSS Grid | base unit: 4px | max-width: 640px
  Motion:     playful | 5 transition(s) | 5 animation(s)
  A11y:       3/4 checks passed | contrast: AAA (excellent)
  Patterns:   layout: grid | nav: sidebar | cards: shadowed
  Responsive: 4 breakpoints | fluid type: yes | container queries: yes
  ─────────────────────────────────────

→ Generating DESIGN.md...

✓ DESIGN.md generated successfully!
  Saved to: /your/project/DESIGN.md
  Size: 9.3 KB | 290 lines
```

## Output: DESIGN.md Structure

The generated file contains 11 comprehensive sections:

1. **Visual theme and atmosphere** — Brand philosophy, design patterns, detected components
2. **Color palette and roles** — Semantic colors with tokens, gradients, accent colors, harmony analysis, contrast scoring
3. **Typography rules** — Font families, code fonts, weight usage, text transforms, type scale, letter-spacing, line-heights
4. **Component styles** — All detected components with properties and hover/focus/disabled states
5. **Layout principles** — Spacing scale, border-radius scale, grid system, container padding, max content width
6. **Depth and elevation** — 5-level shadow hierarchy, border-depth, glass/blur effects
7. **Motion and animation** — Transitions, keyframe animations, durations, easing, reduced-motion support
8. **Do's and don'ts** — Context-aware design boundaries and anti-patterns
9. **Responsive behavior** — Breakpoints, touch targets, fluid typography, container queries, mobile-first detection
10. **Accessibility** — Focus indicators, skip links, ARIA landmarks, screen reader utilities audit table
11. **Agent prompt guide** — Quick palette reference, component prompts, page templates, design system commands

## How It Works

1. **Fetcher** — Downloads HTML, extracts all `<link rel="stylesheet">` URLs, inline `<style>` tags, font resources, meta tags, and detects CSS frameworks from class patterns
2. **Analyzer** — Parses all CSS to extract colors (with semantic mapping), typography, components, layout, shadows, motion, accessibility features, and design patterns
3. **Generator** — Formats everything into a comprehensive DESIGN.md with tables, code blocks, and actionable insights

## Programmatic Usage

```javascript
const { fetchWebsite } = require('./src/fetcher');
const { analyzeDesign } = require('./src/analyzer');
const { generateDesignMD } = require('./src/generator');

const { html, cssUrls, inlineStyles, fontUrls, meta, cssFramework, structureHints } =
  await fetchWebsite('https://example.com');

const designData = await analyzeDesign(
  html, cssUrls, 'https://example.com',
  inlineStyles, meta, cssFramework, structureHints, fontUrls
);

const markdown = generateDesignMD(designData);
```

## License

MIT
