# TASKING Map File Viewer

VSCode extension for viewing and analyzing TASKING VX-toolset linker map files.

## Features

### 1. Syntax Highlighting
- Color-coded MAP file sections
- Highlighted memory addresses and regions
- Distinguished file types and sections

### 2. Memory Usage View
- Real-time memory statistics in sidebar
- Per-region breakdown
- Percentage and absolute values

### 3. Symbol Browser
- Complete symbol table in sidebar
- Shows addresses and memory spaces
- Quick symbol search

### 4. C/C++ Integration
- **Hover** over symbols to see memory info
- **F12 (Go to Definition)** jumps to MAP file
- **CodeLens** shows memory info inline

## Usage

1. Open a `.map` file from TASKING compiler
2. View memory usage and symbols in Explorer sidebar
3. Open C/C++ files and hover over functions/variables
4. Press F12 on symbols to jump to MAP file

## Commands

- `TASKING: Show Memory Usage` - Display memory statistics
- `TASKING: Show Symbols` - Quick pick symbol list
- `TASKING: Select MAP File` - Choose which MAP file to use

## Installation

1. Press F5 to run in development mode
2. Or package with `vsce package` and install the .vsix file

## Requirements

- VSCode 1.80.0 or higher
- TASKING VX-toolset generated .map files

## Development
```bash
npm install
npm run compile
# Press F5 to test
```

## License

MIT