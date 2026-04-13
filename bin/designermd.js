#!/usr/bin/env node

const figlet = require('figlet');
const chalk = require('chalk');
const prompts = require('prompts');
const path = require('path');
const fs = require('fs');
const { fetchWebsite } = require('../src/fetcher');
const { analyzeDesign } = require('../src/analyzer');
const { generateDesignMD } = require('../src/generator');

async function main() {
  // Display banner
  console.log(
    chalk.cyan(
      figlet.textSync('designermd', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      })
    )
  );

  console.log(chalk.gray('  AI-powered design analyzer & DESIGN.md generator'));
  console.log(chalk.gray('  Analyzes CSS, HTML, fonts, and structure\n'));

  // Prompt for URL
  const response = await prompts({
    type: 'text',
    name: 'url',
    message: 'Enter website URL to analyze:',
    initial: '',
    validate: (value) => {
      if (!value) return 'URL is required';
      try {
        new URL(value.startsWith('http') ? value : `https://${value}`);
        return true;
      } catch {
        return 'Please enter a valid URL';
      }
    },
  });

  if (!response.url) {
    console.log(chalk.yellow('\nCancelled. No URL provided.'));
    process.exit(0);
  }

  // Normalize URL
  let url = response.url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  console.log(chalk.bold.cyan(`\n→ Fetching ${url}...`));

  try {
    // Step 1: Fetch website
    const { html, cssUrls, inlineStyles, fontUrls, meta, cssFramework, structureHints } =
      await fetchWebsite(url);

    console.log(chalk.green('✓ Website fetched successfully'));
    console.log(
      chalk.gray(
        `  Found ${cssUrls.length} stylesheet(s), ${inlineStyles.length} inline style block(s), ${fontUrls.length} font resource(s)`
      )
    );
    if (cssFramework.name !== 'Custom') {
      console.log(chalk.gray(`  CSS framework: ${cssFramework.name} (confidence: ${cssFramework.confidence})`));
    }
    if (meta.title) {
      console.log(chalk.gray(`  Site title: ${meta.title}`));
    }

    // Step 2: Analyze design
    console.log(chalk.bold.cyan('\n→ Analyzing design system...'));

    const designData = await analyzeDesign(
      html,
      cssUrls,
      url,
      inlineStyles,
      meta,
      cssFramework,
      structureHints,
      fontUrls
    );

    console.log(chalk.green('✓ Design analysis complete'));

    // Print summary
    console.log(chalk.bold.cyan('\n  Design Summary:'));
    console.log(chalk.gray('  ─────────────────────────────────────'));

    // Colors
    const colorCount = Object.keys(designData.colorPalette.semantic).length;
    console.log(
      chalk.gray('  Colors:    ') +
        chalk.white(`${colorCount} semantic roles`) +
        chalk.gray(
          ` | ${designData.colorPalette.accents.length} accent(s)` +
            ` | ${designData.colorPalette.neutrals.length} neutral(s)`
        )
    );

    // Typography
    console.log(
      chalk.gray('  Typography: ') +
        chalk.white(`${designData.typography.hierarchy.length} levels`) +
        chalk.gray(` | ${designData.typography.fonts.length} font(s)`) +
        chalk.gray(` | ${designData.typography.fontWeights.length} weight(s)`)
    );

    // Components
    const componentCount = Object.keys(designData.components).length;
    console.log(
      chalk.gray('  Components: ') + chalk.white(`${componentCount} detected`)
    );

    // Layout
    console.log(
      chalk.gray('  Layout:     ') +
        chalk.white(designData.layout.gridSystem) +
        chalk.gray(` | base unit: ${designData.layout.baseUnit}`) +
        chalk.gray(` | max-width: ${designData.layout.maxContentWidth}`)
    );

    // Motion
    console.log(
      chalk.gray('  Motion:     ') +
        chalk.white(designData.motion.motionStyle) +
        chalk.gray(
          ` | ${designData.motion.transitions.length} transition(s)` +
            ` | ${designData.motion.animations.length} animation(s)`
        )
    );

    // Accessibility
    const a11yScore = [
      designData.accessibility.focusStyles,
      designData.accessibility.skipLinks,
      designData.accessibility.reducedMotionSupport,
      designData.accessibility.srOnlyClass,
    ].filter(Boolean).length;
    console.log(
      chalk.gray('  A11y:       ') +
        chalk.white(`${a11yScore}/4 checks passed`) +
        chalk.gray(` | contrast: ${designData.colorPalette.contrast}`)
    );

    // Patterns
    console.log(
      chalk.gray('  Patterns:   ') +
        chalk.white(`layout: ${designData.designPatterns.layoutPattern}`) +
        chalk.gray(` | nav: ${designData.designPatterns.navigationPattern}`) +
        chalk.gray(` | cards: ${designData.designPatterns.cardStyle}`)
    );

    // Responsive
    console.log(
      chalk.gray('  Responsive: ') +
        chalk.white(`${designData.responsive.breakpoints.length} breakpoints`) +
        chalk.gray(
          ` | fluid type: ${designData.responsive.fluidTypography ? 'yes' : 'no'}` +
            ` | container queries: ${designData.responsive.containerQueries ? 'yes' : 'no'}`
        )
    );

    console.log(chalk.gray('  ─────────────────────────────────────\n'));

    // Step 3: Generate DESIGN.md
    console.log(chalk.bold.cyan('→ Generating DESIGN.md...'));

    const designMD = generateDesignMD(designData);

    // Write to current working directory
    const outputPath = path.join(process.cwd(), 'DESIGN.md');
    fs.writeFileSync(outputPath, designMD, 'utf8');

    // File stats
    const stats = fs.statSync(outputPath);
    const lines = designMD.split('\n').length;
    const fileSizeKB = (stats.size / 1024).toFixed(1);

    console.log(chalk.green(`\n✓ DESIGN.md generated successfully!`));
    console.log(chalk.gray(`  Saved to: ${outputPath}`));
    console.log(chalk.gray(`  Size: ${fileSizeKB} KB | ${lines} lines`));
    console.log(chalk.cyan('\nYou can now use this file as a design reference for AI agents.\n'));
  } catch (error) {
    console.error(chalk.red(`\n✗ Error: ${error.message}`));
    process.exit(1);
  }
}

main();
