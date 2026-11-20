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
      rate_limit_fill: role.text,
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
out['vscode-terminal.settings.json'] = JSON.stringify(
  {
    'workbench.colorCustomizations': {
      'terminal.background': role.screen,
      'terminal.foreground': role.text,
      'terminalCursor.foreground': role.cursor,
      'terminalCursor.background': role.screen,
      'terminal.selectionBackground': role.selection,
      ...Object.fromEntries(ANSI_ORDER.map((slot) => [`terminal.ansi${cap(slot)}`, ansi[slot]])),
    },
  },
  null,
  2
) + '\n';

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
    if (t.hlsl) hlsl.push([t.hlsl, t.$value]);
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
for (const [file, content] of Object.entries(out)) writeFileSync(join(root, 'dist', file), content);

// Shader constants: replace the value in each `const float NAME = ...;` line of both shaders.
const shaders = ['dos-86.hlsl', 'dos-86.glsl'];
for (const file of shaders) {
  const shaderPath = join(root, file);
  let shader = readFileSync(shaderPath, 'utf8');
  for (const [constant, value] of hlsl) {
    const literal = Number.isInteger(value) ? value.toFixed(1) : String(value);
    const pattern = new RegExp(`(const float ${constant}\\s*=\\s*)[0-9.]+(;)`);
    if (!pattern.test(shader)) throw new Error(`Constant ${constant} not found in ${file}`);
    shader = shader.replace(pattern, `$1${literal}$2`);
  }
  writeFileSync(shaderPath, shader);
}

console.log(`Wrote ${Object.keys(out).length} files to dist/ and ${hlsl.length} constants to ${shaders.join(' and ')}`);
