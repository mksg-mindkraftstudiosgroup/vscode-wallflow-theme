# Wallflow Theme

A **dynamic VS Code theme** that automatically updates to match your wallpaper colors using [wallflow](https://github.com/MKSG-MugunthKumar/wallflow).

## Features

- Real-time color updates when your wallpaper changes
- Two variants: borderless and bordered
- Works automatically with wallflow - no manual configuration needed

## Requirements

This extension requires [wallflow](https://github.com/MKSG-MugunthKumar/wallflow) to be installed and running. The extension reads colors from `~/.cache/wallflow/colors.json`.

### Quick Setup

1. Install wallflow (CLI or macOS app)
2. Install this extension
3. Select "Wallflow" or "Wallflow Bordered" as your color theme
4. Run wallflow to set a wallpaper - VS Code will update automatically

## Commands

- `Wallflow Theme: Update` - Manually update the theme colors

## Settings

- `wallflowTheme.autoUpdate` - Enable/disable automatic theme updates (default: true)

## Troubleshooting

If the extension doesn't update automatically:
1. Run the manual update command: `Wallflow Theme: Update`
2. Reload the VS Code window
3. Ensure wallflow has generated colors in `~/.cache/wallflow/`

---

## Credits

Forked from [Wal Theme](https://github.com/dlasagno/vscode-wal-theme) by Daniele Lasagno.
