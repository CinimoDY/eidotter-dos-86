# eiDotter DOS-86

An amber monochrome monitor for the terminal, with the colours that carry meaning (red, green, yellow, blue, cyan) left honest. One token file is the source; a build turns it into a file for each application.

Part of the eiDotter design system's family. Design notes with the reasoning, the palette and a comparison to eiDotter: `docs/design.html`.

## Install

| Application | How | Monitor effect | Tried |
|---|---|---|---|
| Claude Code | `/plugin install eidotter-dos-86 --marketplace CinimoDY/eidotter-dos-86`, then `/theme` and pick eiDotter DOS-86. Or keep the theme on `dark-ansi` and let the terminal's scheme decide | from the terminal | theme file yes, plugin install no |
| Windows Terminal | Paste `dist/windows-terminal.scheme.json` into `schemes` in `settings.json`; on a profile set `"colorScheme": "eiDotter DOS-86"` and `"experimental.pixelShaderPath"` to the full path of `dos-86.hlsl` | yes | yes |
| PowerShell | The Windows Terminal scheme covers the colours. For matching syntax colours while typing, dot-source `dist/powershell-profile.ps1` from `$PROFILE` | from the terminal | no |
| iTerm2 | Settings → Profiles → Colors → Color Presets → Import `dist/iterm2.itermcolors` | no (iTerm2 has no custom shaders) | no |
| Ghostty | Copy `dist/ghostty.theme` to `~/.config/ghostty/themes/eidotter-dos-86`; in the config set `theme = eidotter-dos-86` and `custom-shader = /full/path/to/dos-86.glsl` | yes | no |
| Omarchy | Menu: Install → Style → Theme, paste this repo's URL. Omarchy reads `colors.toml` from the repo root and themes its terminal and desktop from it | no | no |
| Foot | Include `dist/foot.ini` from `foot.ini` | no | no |
| kitty | `include` `dist/kitty.conf` | no | no |
| Alacritty | `import` `dist/alacritty.toml` | no | no |
| VS Code, Cursor, Antigravity | Merge `dist/vscode-terminal.settings.json` into user settings. Themes the integrated terminal only, not the editor | no | no |
| Web | `dist/dos-86.css`: every value as a CSS custom property | no | no |

"Tried: no" means the file is generated in the documented format and has not been loaded in that application yet.

A shader that fails to compile is ignored by both terminals; Ghostty reports it only in its log.

## Change a value

Edit `tokens/dos-86.tokens.json`, then run:

```bash
node build.mjs
```

This rewrites `dist/`, `themes/`, `colors.toml`, and the constants at the top of both shaders. No dependencies.

To add an application, add one block to `build.mjs` that maps from `role` and `ansi`. Map from roles, not from raw colours.

## Layout

| Path | What it is |
|---|---|
| `tokens/dos-86.tokens.json` | The source: colours, roles, the 16 ANSI slots, effect values. Each token names the eiDotter token or value it came from |
| `build.mjs` | The build |
| `dos-86.hlsl`, `dos-86.glsl` | The monitor: phosphor glow and halation, scanlines, a faint aperture grille, vignette. HLSL for Windows Terminal, GLSL for Ghostty |
| `dist/` | Generated, one file per application |
| `themes/`, `.claude-plugin/` | The Claude Code plugin and its marketplace entry |
| `colors.toml` | The Omarchy theme (generated) |
| `docs/design.html` | Design notes |

## Not in the monitor, and why

- **Phosphor persistence** (the trail a real tube leaves): the shader sees only the current frame.
- **Flicker**: left out on purpose.
- **Screen curvature**: it would move the picture away from where mouse clicks land.

## Open

- No licence yet. eiDotter itself is CC BY-NC 4.0.
- A bitmap font option.
