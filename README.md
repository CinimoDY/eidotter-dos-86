# eidotter-dos-86

"eiDotter DOS-86": an amber monochrome monitor for the terminal, with the colours that carry meaning (red, green, yellow, blue, cyan) left honest. Built for Claude Code in Windows Terminal. Started 2026-11-20 as an experiment; not part of eidotter yet.

Design notes with the reasoning, palette and comparison to eidotter: `docs/design.html`.

## Layout

| Path | What it is |
|---|---|
| `tokens/dos-86.tokens.json` | The single source: colours, roles, the 16 ANSI slots, effect values. Each token names the eidotter token or value it came from |
| `build.mjs` | Generates `dist/` and writes the effect values into the shader's constants. No dependencies |
| `dos-86.hlsl` | Pixel shader for Windows Terminal: phosphor glow and halation, scanlines, a faint aperture grille, vignette |
| `dist/` | Generated, one file per target |
| `docs/design.html` | Design notes (page fragment, published as an artifact) |
| `windows-terminal-settings.backup-2026-11-20.json` | Windows Terminal settings before any of this was added |

## Changing a value

Edit `tokens/dos-86.tokens.json`, then:

```bash
node build.mjs
```

`dist/` is rewritten and the constants in `dos-86.hlsl` are updated. Then install what changed (below).

## Targets

| File in `dist/` | Target | Install |
|---|---|---|
| `windows-terminal.scheme.json` | Windows Terminal | Paste into `schemes` in the terminal's `settings.json`, set `"colorScheme": "eiDotter DOS-86"` on a profile |
| `claude-code.theme.json` | Claude Code | `cp dist/claude-code.theme.json ~/.claude/themes/dos-86.json`, then `/theme` |
| `ghostty.theme` | Ghostty | Copy to `~/.config/ghostty/themes/`. Not yet tried |
| `kitty.conf` | kitty | `include` from `kitty.conf`. Not yet tried |
| `alacritty.toml` | Alacritty | `import` from `alacritty.toml`. Not yet tried |
| `dos-86.css` | Web, or any system that reads CSS custom properties | Import the file |
| `contrast.json` | Reference | WCAG contrast of every colour against the screen colour |

The shader is set per profile in Windows Terminal with `"experimental.pixelShaderPath": "D:\\Coding\\eidotter-dos-86\\dos-86.hlsl"`. Windows Terminal reloads it when its settings file is saved.

To add another target, add one block to `build.mjs` that maps from `role` and `ansi`. Map from roles, not from raw colours.

## How it works with Claude Code

There are two ways, and either is enough:

- Theme `dark-ansi` draws the interface with the terminal's 16 colours, so the terminal scheme decides every colour.
- The custom theme `eiDotter DOS-86` sets the same colours as fixed values, for terminals without the scheme.

The status line (`~/.claude/statusline-command.sh`) uses amber, bright amber and soft amber from the same palette; it is not generated.

## What is installed on this machine

- Windows Terminal: scheme "DOS-86"; the default Arch profile uses it with the shader.
- Claude Code: `~/.claude/themes/dos-86.json`.

To undo in Windows Terminal: set the Arch profile's `colorScheme` back to `CGA` and delete its `experimental.pixelShaderPath` line, or restore the backup file.

## Not done, and why

- **Phosphor persistence** (the trail a real tube leaves): a Windows Terminal shader sees only the current frame.
- **Flicker**: left out on purpose.
- **Screen curvature**: it would move the picture away from where mouse clicks land.

## Open

- Whether this becomes an eidotter theme, a Claude Code plugin, or both. Claude Code plugins can ship themes (marked experimental in the docs); the shader would stay a separate download.
- A bitmap font option (Perfect DOS VGA 437 is not installed in Windows; Flexi IBM VGA is).
- The Ghostty, kitty and Alacritty files are generated and unverified.
