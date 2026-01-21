# TASKING Map File Viewer

VSCode extension for viewing and analyzing TASKING VX-toolset linker map files.

## Features

### 1. Syntax Highlighting
- Color-coded MAP file sections
- Highlighted memory addresses and regions
- Distinguished file types and sections

### 2. C/C++ Integration
- **Hover** over symbols to see memory info
- **Go to Symbol** jumps to MAP file location

## Usage

1. Open a `.map` file from TASKING compiler
2. Use **Map File Viewer: Select MAP File** if multiple maps exist
3. Open C/C++ files and hover over functions/variables
4. Use **Map File Viewer: Go to Symbol in MAP** to jump to the MAP row

## Commands

- `Map File Viewer: Go to Symbol in MAP` - Jump to symbol row in MAP file
- `Map File Viewer: Select MAP File` - Choose which MAP file to use
- Default keybinding: `Ctrl+Alt+M` for Go to Symbol

## Settings

- `taskingMap.hover.enabled` - Enable or disable hover in C/C++

## Installation

1. Install from the VS Code Marketplace
2. Or package with `vsce package` and install the `.vsix` file

## Requirements

- VSCode 1.80.0 or higher
- TASKING VX-toolset generated .map files