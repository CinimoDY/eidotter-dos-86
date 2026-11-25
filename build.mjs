#!/usr/bin/env node
// Turns tokens/dos-86.tokens.json into one file per target, in dist/,
// and writes the effect values into the constants of dos-86.hlsl.
// No dependencies. Run: node build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(root, 'tokens/dos-86.tokens.json'), 'utf8'));
const NAME = 'eiDotter DOS-86';

function lookup(path) {
  const node = path.split('.').reduce((n, key) => n?.[key], tokens);
  if (!node || node.$value === undefined) throw new Error(`Unknown token: ${path}`);
  return resolve(node.$value);
}

function resolve(value) {
  const ref = typeof value === 'string' && value.match(/^\{(.+)\}$/);
  return ref ? lookup(ref[1]) : value;
}

// { key: resolved value } for every token directly inside a group.
function group(path) {
  const node = path.split('.').reduce((n, key) => n[key], tokens);
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key, t]) => !key.startsWith('$') && t.$value !== undefined)
      .map(([key, t]) => [key, resolve(t.$value)])
  );
}

const ansi = group('ansi');
const role = group('role');
const signal = group('color.signal');
const ANSI_ORDER = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
  'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
];

// WCAG 2 contrast ratio between two #rrggbb colours.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const out = {};

// Windows Terminal calls magenta "purple".
const wt = (slot) => ({ magenta: 'purple', brightMagenta: 'brightPurple' })[slot] ?? slot;
out['windows-terminal.scheme.json'] = JSON.stringify(
  {
    name: NAME,
    background: role.screen,
    foreground: role.text,
    cursorColor: role.cursor,
    selectionBackground: role.selection,
    ...Object.fromEntries(ANSI_ORDER.map((slot) => [wt(slot), ansi[slot]])),
  },
  null,
  2
) + '\n';

out['claude-code.theme.json'] = JSON.stringify(
  {
    name: NAME,
    base: 'dark',
    overrides: {
      claude: role.text,
      text: role.text,
      inactive: role.textDim,
      subtle: role.decoration,
      promptBorder: role.decoration,
      permission: role.prompt,
      planMode: role.info,
      success: role.success,
      error: role.error,
      warning: role.warning,
      diffAdded: role.addedFill,
      diffRemoved: role.removedFill,
      userMessageBackground: role.raised,
      // Text drawn on an amber fill (badges, highlights) takes the screen colour.
      inverseText: role.screen,
      rate_limit_fill: role.text,
      // Session and subagent colours (the names /color offers).
      red_FOR_SUBAGENTS_ONLY: signal.red,
      green_FOR_SUBAGENTS_ONLY: signal.greenBright,
      yellow_FOR_SUBAGENTS_ONLY: signal.yellow,
      blue_FOR_SUBAGENTS_ONLY: signal.blueBright,
      purple_FOR_SUBAGENTS_ONLY: signal.magenta,
      pink_FOR_SUBAGENTS_ONLY: signal.magentaBright,
      cyan_FOR_SUBAGENTS_ONLY: signal.cyanBright,
      orange_FOR_SUBAGENTS_ONLY: role.text,
    },
  },
  null,
  2
) + '\n';

out['ghostty.theme'] = [
  ...ANSI_ORDER.map((slot, i) => `palette = ${i}=${ansi[slot]}`),
  `background = ${role.screen}`,
  `foreground = ${role.text}`,
  `cursor-color = ${role.cursor}`,
  `cursor-text = ${role.screen}`,
  `selection-background = ${role.selection}`,
  `selection-foreground = ${role.screen}`,
  '',
].join('\n');

out['kitty.conf'] = [
  `# ${NAME}`,
  `foreground ${role.text}`,
  `background ${role.screen}`,
  `cursor ${role.cursor}`,
  `selection_background ${role.selection}`,
  `selection_foreground ${role.screen}`,
  ...ANSI_ORDER.map((slot, i) => `color${i} ${ansi[slot]}`),
  '',
].join('\n');

const tomlBlock = (slots) =>
  slots.map((s) => `${s.replace('bright', '').toLowerCase()} = "${ansi[s]}"`).join('\n');
out['alacritty.toml'] = [
  `# ${NAME}`,
  '[colors.primary]',
  `background = "${role.screen}"`,
  `foreground = "${role.text}"`,
  '',
  '[colors.cursor]',
  `cursor = "${role.cursor}"`,
  `text = "${role.screen}"`,
  '',
  '[colors.selection]',
  `background = "${role.selection}"`,
  `text = "${role.screen}"`,
  '',
  '[colors.normal]',
  tomlBlock(ANSI_ORDER.slice(0, 8)),
  '',
  '[colors.bright]',
  tomlBlock(ANSI_ORDER.slice(8)),
  '',
].join('\n');

// iTerm2 colour preset: an XML property list, components as 0..1 reals in sRGB.
const plistColor = (key, hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(6));
  return [
    `\t<key>${key}</key>`,
    '\t<dict>',
    '\t\t<key>Alpha Component</key><real>1</real>',
    `\t\t<key>Blue Component</key><real>${b}</real>`,
    '\t\t<key>Color Space</key><string>sRGB</string>',
    `\t\t<key>Green Component</key><real>${g}</real>`,
    `\t\t<key>Red Component</key><real>${r}</real>`,
    '\t</dict>',
  ].join('\n');
};
out['iterm2.itermcolors'] = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
  '<plist version="1.0">',
  '<dict>',
  ...ANSI_ORDER.map((slot, i) => plistColor(`Ansi ${i} Color`, ansi[slot])),
  plistColor('Background Color', role.screen),
  plistColor('Bold Color', role.textStrong),
  plistColor('Cursor Color', role.cursor),
  plistColor('Cursor Text Color', role.screen),
  plistColor('Foreground Color', role.text),
  plistColor('Link Color', role.prompt),
  plistColor('Selected Text Color', role.screen),
  plistColor('Selection Color', role.selection),
  '</dict>',
  '</plist>',
  '',
].join('\n');

// VS Code and its forks (Cursor, Antigravity): integrated-terminal colours as a settings snippet.
const cap = (slot) => slot[0].toUpperCase() + slot.slice(1);
// Shared with the full theme below.
const vscodeTerminalColors = {
  'terminal.background': role.screen,
  'terminal.foreground': role.text,
  'terminalCursor.foreground': role.cursor,
  'terminalCursor.background': role.screen,
  'terminal.selectionBackground': role.selection,
  'terminal.selectionForeground': role.screen,
  ...Object.fromEntries(ANSI_ORDER.map((slot) => [`terminal.ansi${cap(slot)}`, ansi[slot]])),
};
out['vscode-terminal.settings.json'] = JSON.stringify(
  { 'workbench.colorCustomizations': vscodeTerminalColors },
  null,
  2
) + '\n';

// VS Code and its forks (Antigravity, Cursor): a full colour-theme extension, written to vscode/.
// Surfaces and text stay in the phosphor; signal colours appear only where they carry meaning.
const alpha = (hex, a) => hex + a;
const vscodeColors = {
  // Base
  foreground: role.text,
  descriptionForeground: role.textDim,
  disabledForeground: role.decoration,
  errorForeground: role.error,
  focusBorder: role.decoration,
  'icon.foreground': role.text,
  'widget.shadow': '#00000000',
  'selection.background': role.selection,
  'textLink.foreground': role.prompt,
  'textLink.activeForeground': signal.cyanBright,
  'textPreformat.foreground': role.textStrong,
  'textBlockQuote.background': role.raised,
  'textBlockQuote.border': role.decoration,
  'textCodeBlock.background': role.raised,
  'textSeparator.foreground': role.decoration,

  // Window chrome
  'titleBar.activeBackground': role.screen,
  'titleBar.activeForeground': role.text,
  'titleBar.inactiveBackground': role.screen,
  'titleBar.inactiveForeground': role.textDim,
  'titleBar.border': role.decoration,
  'activityBar.background': role.screen,
  'activityBar.foreground': role.text,
  'activityBar.inactiveForeground': role.textDim,
  'activityBar.border': role.decoration,
  'activityBar.activeBorder': role.text,
  'activityBarBadge.background': role.text,
  'activityBarBadge.foreground': role.screen,
  'sideBar.background': role.screen,
  'sideBar.foreground': role.text,
  'sideBar.border': role.decoration,
  'sideBarTitle.foreground': role.textStrong,
  'sideBarSectionHeader.background': role.raised,
  'sideBarSectionHeader.foreground': role.text,
  'sideBarSectionHeader.border': role.decoration,
  'statusBar.background': role.screen,
  'statusBar.foreground': role.text,
  'statusBar.border': role.decoration,
  'statusBar.noFolderBackground': role.screen,
  'statusBar.debuggingBackground': role.text,
  'statusBar.debuggingForeground': role.screen,
  'statusBarItem.hoverBackground': role.raised,
  'statusBarItem.remoteBackground': role.text,
  'statusBarItem.remoteForeground': role.screen,
  'statusBarItem.errorBackground': role.removedFill,
  'statusBarItem.errorForeground': role.error,
  'statusBarItem.warningBackground': role.raised,
  'statusBarItem.warningForeground': role.warning,
  'panel.background': role.screen,
  'panel.border': role.decoration,
  'panelTitle.activeForeground': role.textStrong,
  'panelTitle.activeBorder': role.text,
  'panelTitle.inactiveForeground': role.textDim,

  // Tabs
  'editorGroupHeader.tabsBackground': role.screen,
  'editorGroupHeader.tabsBorder': role.decoration,
  'editorGroup.border': role.decoration,
  'tab.activeBackground': role.raised,
  'tab.activeForeground': role.textStrong,
  'tab.activeBorderTop': role.text,
  'tab.inactiveBackground': role.screen,
  'tab.inactiveForeground': role.textDim,
  'tab.border': role.decoration,
  'tab.hoverBackground': role.raised,
  'breadcrumb.foreground': role.textDim,
  'breadcrumb.focusForeground': role.text,
  'breadcrumb.activeSelectionForeground': role.textStrong,

  // Editor
  'editor.background': role.screen,
  'editor.foreground': role.text,
  'editorLineNumber.foreground': role.textDim,
  'editorLineNumber.activeForeground': role.textStrong,
  'editorCursor.foreground': role.cursor,
  'editorCursor.background': role.screen,
  'editor.lineHighlightBackground': role.raised,
  'editor.lineHighlightBorder': '#00000000',
  // VS Code keeps syntax colours on selected text, so the selection is a translucent
  // dim amber (amber text stays 7.7:1 on it) rather than the terminals' solid fill.
  'editor.selectionBackground': alpha(role.selection, '66'),
  'editor.inactiveSelectionBackground': alpha(role.selection, '44'),
  'editor.selectionHighlightBackground': alpha(role.selection, '33'),
  'editor.wordHighlightBackground': alpha(role.selection, '33'),
  'editor.wordHighlightStrongBackground': alpha(role.selection, '55'),
  'editor.findMatchBackground': alpha(role.warning, '55'),
  'editor.findMatchBorder': role.warning,
  'editor.findMatchHighlightBackground': alpha(role.selection, '66'),
  'editor.rangeHighlightBackground': alpha(role.raised, 'CC'),
  'editorWhitespace.foreground': alpha(role.decoration, '88'),
  'editorIndentGuide.background1': alpha(role.decoration, '55'),
  'editorIndentGuide.activeBackground1': role.decoration,
  'editorRuler.foreground': alpha(role.decoration, '88'),
  'editorBracketMatch.background': alpha(role.selection, '55'),
  'editorBracketMatch.border': role.decoration,
  'editorLink.activeForeground': role.prompt,
  'editorCodeLens.foreground': role.textDim,
  'editorInlayHint.background': role.raised,
  'editorInlayHint.foreground': role.textDim,
  'editorGhostText.foreground': role.decoration,
  'editorError.foreground': role.error,
  'editorWarning.foreground': role.warning,
  'editorInfo.foreground': role.info,
  'editorHint.foreground': role.info,
  'editorGutter.addedBackground': role.success,
  'editorGutter.deletedBackground': role.error,
  'editorGutter.modifiedBackground': role.info,
  'editorOverviewRuler.border': role.decoration,
  'editorOverviewRuler.errorForeground': role.error,
  'editorOverviewRuler.warningForeground': role.warning,
  'editorOverviewRuler.infoForeground': role.info,
  'editorOverviewRuler.addedForeground': role.success,
  'editorOverviewRuler.deletedForeground': role.error,
  'editorOverviewRuler.modifiedForeground': role.info,
  'minimap.errorHighlight': role.error,
  'minimap.warningHighlight': role.warning,
  'minimap.selectionHighlight': role.selection,
  'minimapGutter.addedBackground': role.success,
  'minimapGutter.deletedBackground': role.error,
  'minimapGutter.modifiedBackground': role.info,

  // Widgets: hover, suggest, find, peek
  'editorWidget.background': role.raised,
  'editorWidget.foreground': role.text,
  'editorWidget.border': role.decoration,
  'editorHoverWidget.background': role.raised,
  'editorHoverWidget.border': role.decoration,
  'editorSuggestWidget.background': role.raised,
  'editorSuggestWidget.border': role.decoration,
  'editorSuggestWidget.foreground': role.text,
  'editorSuggestWidget.highlightForeground': role.textStrong,
  'editorSuggestWidget.selectedBackground': role.text,
  'editorSuggestWidget.selectedForeground': role.screen,
  'peekView.border': role.decoration,
  'peekViewEditor.background': role.raised,
  'peekViewResult.background': role.screen,
  'peekViewTitle.background': role.raised,
  'peekViewTitleLabel.foreground': role.textStrong,
  'peekViewTitleDescription.foreground': role.textDim,
  'peekViewEditor.matchHighlightBackground': alpha(role.warning, '44'),
  'peekViewResult.matchHighlightBackground': alpha(role.warning, '44'),

  // Lists and trees. A focused row is a full amber bar with screen-coloured text (11:1).
  'list.activeSelectionBackground': role.text,
  'list.activeSelectionForeground': role.screen,
  'list.activeSelectionIconForeground': role.screen,
  'list.inactiveSelectionBackground': role.raised,
  'list.inactiveSelectionForeground': role.textStrong,
  'list.hoverBackground': role.raised,
  'list.hoverForeground': role.textStrong,
  'list.focusOutline': role.decoration,
  'list.highlightForeground': role.textStrong,
  'list.errorForeground': role.error,
  'list.warningForeground': role.warning,
  'tree.indentGuidesStroke': role.decoration,

  // Inputs and buttons
  'input.background': role.raised,
  'input.foreground': role.text,
  'input.border': role.decoration,
  'input.placeholderForeground': role.textDim,
  'inputOption.activeBorder': role.text,
  'inputOption.activeBackground': alpha(role.selection, '66'),
  'inputValidation.errorBackground': role.removedFill,
  'inputValidation.errorBorder': role.error,
  'inputValidation.warningBackground': role.raised,
  'inputValidation.warningBorder': role.warning,
  'inputValidation.infoBackground': role.raised,
  'inputValidation.infoBorder': role.info,
  'dropdown.background': role.raised,
  'dropdown.foreground': role.text,
  'dropdown.border': role.decoration,
  'checkbox.background': role.raised,
  'checkbox.border': role.decoration,
  'button.background': role.text,
  'button.foreground': role.screen,
  'button.hoverBackground': role.textStrong,
  'button.secondaryBackground': role.raised,
  'button.secondaryForeground': role.text,
  'button.secondaryHoverBackground': alpha(role.selection, '66'),
  'badge.background': role.text,
  'badge.foreground': role.screen,
  'progressBar.background': role.text,
  'scrollbar.shadow': '#00000000',
  'scrollbarSlider.background': alpha(role.decoration, '55'),
  'scrollbarSlider.hoverBackground': alpha(role.decoration, '88'),
  'scrollbarSlider.activeBackground': role.decoration,

  // Quick input, menus, notifications
  'quickInput.background': role.raised,
  'quickInput.foreground': role.text,
  'quickInputList.focusBackground': role.text,
  'quickInputList.focusForeground': role.screen,
  'pickerGroup.foreground': role.textStrong,
  'pickerGroup.border': role.decoration,
  'menu.background': role.raised,
  'menu.foreground': role.text,
  'menu.border': role.decoration,
  'menu.selectionBackground': role.text,
  'menu.selectionForeground': role.screen,
  'menu.separatorBackground': role.decoration,
  'notifications.background': role.raised,
  'notifications.foreground': role.text,
  'notifications.border': role.decoration,
  'notificationCenterHeader.background': role.raised,
  'notificationsErrorIcon.foreground': role.error,
  'notificationsWarningIcon.foreground': role.warning,
  'notificationsInfoIcon.foreground': role.info,

  // Diff
  'diffEditor.insertedLineBackground': role.addedFill,
  'diffEditor.removedLineBackground': role.removedFill,
  'diffEditor.insertedTextBackground': alpha(role.success, '33'),
  'diffEditor.removedTextBackground': alpha(role.error, '44'),
  'diffEditor.border': role.decoration,

  // Git and problems
  'gitDecoration.addedResourceForeground': role.success,
  'gitDecoration.untrackedResourceForeground': role.success,
  'gitDecoration.modifiedResourceForeground': role.info,
  'gitDecoration.deletedResourceForeground': role.error,
  'gitDecoration.conflictingResourceForeground': role.warning,
  'gitDecoration.ignoredResourceForeground': role.decoration,
  'problemsErrorIcon.foreground': role.error,
  'problemsWarningIcon.foreground': role.warning,
  'problemsInfoIcon.foreground': role.info,

  // Terminal: the same values as dist/vscode-terminal.settings.json
  ...vscodeTerminalColors,
  'terminal.border': role.decoration,
};

// Syntax: brightness levels of the one phosphor, as in the PowerShell colours below.
const scope = (name, scopes, foreground, fontStyle) => ({
  name,
  scope: scopes,
  settings: fontStyle === undefined ? { foreground } : { foreground, fontStyle },
});
const vscodeTokenColors = [
  scope('Comment', ['comment', 'punctuation.definition.comment'], role.textDim, 'italic'),
  scope('Keyword, storage', ['keyword', 'storage', 'storage.type', 'storage.modifier'], role.text),
  scope('Operator', ['keyword.operator'], role.text),
  scope('Type', ['entity.name.type', 'support.type', 'support.class', 'entity.other.inherited-class'], role.text),
  scope('String', ['string', 'string.quoted', 'string.template'], role.textStrong),
  scope('Number, constant', ['constant.numeric', 'constant.language', 'constant.other', 'support.constant'], role.textStrong),
  scope('Function, class name', ['entity.name.function', 'support.function', 'entity.name.class', 'meta.function-call entity.name.function'], role.textStrong),
  scope('Variable, property', ['variable', 'variable.other', 'variable.parameter', 'meta.object-literal.key', 'support.variable.property'], role.text),
  scope('Tag', ['entity.name.tag'], role.textStrong),
  scope('Attribute', ['entity.other.attribute-name'], role.text),
  scope('Punctuation', ['punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'], role.textDim),
  scope('String delimiters', ['punctuation.definition.string'], role.textStrong),
  scope('Escape, regex', ['constant.character.escape', 'string.regexp', 'constant.other.placeholder'], signal.magenta),
  scope('Invalid', ['invalid', 'invalid.illegal'], role.error),
  scope('Deprecated', ['invalid.deprecated'], role.warning),
  scope('Diff inserted', ['markup.inserted', 'meta.diff.header.to-file'], role.success),
  scope('Diff deleted', ['markup.deleted', 'meta.diff.header.from-file'], role.error),
  scope('Diff changed', ['markup.changed', 'meta.diff.range'], role.info),
  scope('Markdown heading', ['markup.heading', 'entity.name.section'], role.textStrong, 'bold'),
  scope('Markdown bold', ['markup.bold'], role.textStrong, 'bold'),
  scope('Markdown italic', ['markup.italic'], role.text, 'italic'),
  scope('Markdown link', ['markup.underline.link', 'string.other.link'], role.prompt),
  scope('Markdown code', ['markup.inline.raw', 'markup.fenced_code', 'markup.raw'], role.textStrong),
  scope('Markdown quote', ['markup.quote'], role.textDim, 'italic'),
];
const vscodeSemanticTokenColors = {
  comment: { foreground: role.textDim, italic: true },
  keyword: role.text,
  type: role.text,
  class: role.textStrong,
  interface: role.text,
  enum: role.text,
  function: role.textStrong,
  method: role.textStrong,
  string: role.textStrong,
  number: role.textStrong,
  regexp: signal.magenta,
  variable: role.text,
  'variable.readonly': role.textStrong,
  parameter: role.text,
  property: role.text,
  'property.readonly': role.textStrong,
  enumMember: role.textStrong,
  '*.deprecated': { strikethrough: true },
};

const pluginManifest = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
const THEME_FILE = 'eidotter-dos-86-color-theme.json';
const vscode = {};
vscode[`themes/${THEME_FILE}`] = JSON.stringify(
  {
    $schema: 'vscode://schemas/color-theme',
    name: NAME,
    type: 'dark',
    semanticHighlighting: true,
    colors: vscodeColors,
    tokenColors: vscodeTokenColors,
    semanticTokenColors: vscodeSemanticTokenColors,
  },
  null,
  2
) + '\n';
vscode['package.json'] = JSON.stringify(
  {
    name: 'eidotter-dos-86',
    displayName: NAME,
    description: 'An amber phosphor colour theme, with red, green and yellow left honest. For VS Code, Antigravity and Cursor.',
    version: pluginManifest.version,
    publisher: 'cinimody',
    license: 'MIT',
    repository: { type: 'git', url: 'https://github.com/CinimoDY/eidotter-dos-86' },
    engines: { vscode: '^1.70.0' },
    categories: ['Themes'],
    keywords: ['theme', 'amber', 'phosphor', 'retro', 'terminal', 'dark'],
    contributes: {
      themes: [{ label: NAME, uiTheme: 'vs-dark', path: `./themes/${THEME_FILE}` }],
    },
  },
  null,
  2
) + '\n';
vscode['README.md'] = [
  `# ${NAME}`,
  '',
  'An amber monochrome monitor for the editor: one phosphor at four brightness levels on a warm black, with the colours that carry meaning (errors, warnings, diffs, git status, links) left in their own colour.',
  '',
  'Generated from `tokens/dos-86.tokens.json` by `node build.mjs` in the [eiDotter DOS-86 repository](https://github.com/CinimoDY/eidotter-dos-86). Do not edit these files by hand.',
  '',
  '## Install (Antigravity, Cursor, VS Code)',
  '',
  '1. In this folder: `npx @vscode/vsce package`',
  '2. Command palette: **Extensions: Install from VSIX…**, pick the `.vsix`',
  `3. Command palette: **Preferences: Color Theme**, pick **${NAME}**`,
  '',
].join('\n');
vscode['LICENSE'] = readFileSync(join(root, 'LICENSE'), 'utf8');

// PowerShell: PSReadLine syntax colours, as 24-bit escape sequences (works in 5.1 and 7).
const esc = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `"$([char]27)[38;2;${r};${g};${b}m"`;
};
const psColors = {
  Default: role.text, Command: role.textStrong, Parameter: role.textDim, Operator: role.textDim,
  String: role.textStrong, Number: role.textStrong, Variable: role.textStrong, Keyword: role.text,
  Type: role.text, Member: role.text, Comment: role.textDim, ContinuationPrompt: role.textDim,
  InlinePrediction: role.decoration, Emphasis: role.warning, Error: role.error,
};
out['powershell-profile.ps1'] = [
  `# ${NAME}: PSReadLine colours. Dot-source this file from $PROFILE.`,
  'Set-PSReadLineOption -Colors @{',
  ...Object.entries(psColors).map(([key, hex]) => `  ${key} = ${esc(hex)}`),
  '}',
  '',
].join('\n');

// Omarchy: one colors.toml; Omarchy generates its per-app configs from it.
// Written to the repo root as well, so this repo can be installed as an Omarchy theme.
const omarchy = [
  `# ${NAME}`,
  `accent = "${role.text}"`,
  `cursor = "${role.cursor}"`,
  `foreground = "${role.text}"`,
  `background = "${role.screen}"`,
  `selection_foreground = "${role.screen}"`,
  `selection_background = "${role.selection}"`,
  ...ANSI_ORDER.map((slot, i) => `color${i} = "${ansi[slot]}"`),
  '',
].join('\n');
out['omarchy.colors.toml'] = omarchy;

// Foot: hex without the leading #.
const bare = (hex) => hex.slice(1);
out['foot.ini'] = [
  `# ${NAME}`,
  '[colors-dark]',
  `foreground=${bare(role.text)}`,
  `background=${bare(role.screen)}`,
  `selection-foreground=${bare(role.screen)}`,
  `selection-background=${bare(role.selection)}`,
  `cursor=${bare(role.screen)} ${bare(role.cursor)}`,
  ...ANSI_ORDER.slice(0, 8).map((slot, i) => `regular${i}=${bare(ansi[slot])}`),
  ...ANSI_ORDER.slice(8).map((slot, i) => `bright${i}=${bare(ansi[slot])}`),
  '',
].join('\n');

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const cssVars = [];
for (const family of ['phosphor', 'signal', 'surface']) {
  for (const [key, value] of Object.entries(group(`color.${family}`))) {
    cssVars.push(`  --dos86-color-${kebab(family === 'phosphor' ? key : `${family}-${key}`)}: ${value};`);
  }
}
for (const [key, value] of Object.entries(role)) cssVars.push(`  --dos86-role-${kebab(key)}: ${value};`);
const hlsl = [];
for (const [family, node] of Object.entries(tokens.effect)) {
  if (family.startsWith('$')) continue;
  for (const [key, t] of Object.entries(node)) {
    cssVars.push(`  --dos86-effect-${kebab(family)}-${kebab(key)}: ${t.$value};`);
    if (t.hlsl) hlsl.push([t.hlsl, t.$value, t.shaders]);
  }
}
out['dos-86.css'] = `/* ${NAME}: generated from tokens/dos-86.tokens.json */\n:root {\n${cssVars.join('\n')}\n}\n`;

out['contrast.json'] = JSON.stringify(
  Object.fromEntries(
    [...Object.entries(group('color.phosphor')), ...Object.entries(group('color.signal'))]
      .filter(([, hex]) => hex !== role.screen)
      .map(([key, hex]) => [key, { hex, onScreen: contrast(hex, role.screen) }])
  ),
  null,
  2
) + '\n';

mkdirSync(join(root, 'dist'), { recursive: true });
// The Claude Code plugin reads themes/ at the repo root.
mkdirSync(join(root, 'themes'), { recursive: true });
writeFileSync(join(root, 'themes', 'eidotter-dos-86.json'), out['claude-code.theme.json']);
writeFileSync(join(root, 'colors.toml'), omarchy);
for (const [file, content] of Object.entries(out)) writeFileSync(join(root, 'dist', file), content);
// The VS Code extension is a folder of its own, so it can be packaged as it stands.
for (const [file, content] of Object.entries(vscode)) {
  mkdirSync(dirname(join(root, 'vscode', file)), { recursive: true });
  writeFileSync(join(root, 'vscode', file), content);
}

// Shader constants: replace the value in each `const float NAME = ...;` line of both shaders.
// A token with `shaders: ["glsl"]` goes only into the shaders with those extensions.
const shaders = ['dos-86.hlsl', 'dos-86.glsl'];
for (const file of shaders) {
  const shaderPath = join(root, file);
  let shader = readFileSync(shaderPath, 'utf8');
  const ext = file.split('.').pop();
  for (const [constant, value, only] of hlsl) {
    if (only && !only.includes(ext)) continue;
    const literal = Number.isInteger(value) ? value.toFixed(1) : String(value);
    const pattern = new RegExp(`(const float ${constant}\\s*=\\s*)[0-9.]+(;)`);
    if (!pattern.test(shader)) throw new Error(`Constant ${constant} not found in ${file}`);
    shader = shader.replace(pattern, `$1${literal}$2`);
  }
  writeFileSync(shaderPath, shader);
}

console.log(`Wrote ${Object.keys(out).length} files to dist/, ${Object.keys(vscode).length} to vscode/, and ${hlsl.length} constants to ${shaders.join(' and ')}`);
