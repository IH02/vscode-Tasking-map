import * as vscode from 'vscode';
import { TaskingMapParser, Symbol, MemoryRegion } from './mapParser';
import * as path from 'path';

let currentMapParser: TaskingMapParser | null = null;
let mapFileUri: vscode.Uri | null = null;
function isUriInWorkspace(uri: vscode.Uri): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  for (const folder of folders) {
    const rel = path.relative(folder.uri.fsPath, uri.fsPath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return true;
    }
    if (rel === '') {
      return true;
    }
  }
  return false;
}

async function setCurrentMapFromUri(uri: vscode.Uri, allowExternal = false): Promise<void> {
  if (!allowExternal && !isUriInWorkspace(uri)) return;
  const document = await vscode.workspace.openTextDocument(uri);
  mapFileUri = uri;
  currentMapParser = new TaskingMapParser(document.getText());
}

async function collectMapFilesFromFolder(folder: vscode.Uri, results: vscode.Uri[]): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(folder);
  for (const [name, type] of entries) {
    if (name === 'node_modules' || name === '.git') continue;
    const child = vscode.Uri.joinPath(folder, name);
    if (type === vscode.FileType.Directory) {
      await collectMapFilesFromFolder(child, results);
      continue;
    }
    if (type === vscode.FileType.File && isMapFileName(name)) {
      results.push(child);
    }
  }
}

async function listWorkspaceMapFiles(): Promise<vscode.Uri[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const results: vscode.Uri[] = [];
  for (const folder of folders) {
    await collectMapFilesFromFolder(folder.uri, results);
  }
  return results;
}

async function ensureMapSelected(showPicker: boolean): Promise<boolean> {
  if (currentMapParser && mapFileUri) {
    if (isUriInWorkspace(mapFileUri)) return true;
    currentMapParser = null;
    mapFileUri = null;
  }
  const workspaceMaps = await listWorkspaceMapFiles();
  const openMaps = vscode.workspace.textDocuments
    .filter(d => isMapFilePath(d.uri.fsPath))
    .map(d => d.uri);

  const byPath = new Map<string, vscode.Uri>();
  for (const u of workspaceMaps) byPath.set(u.fsPath, u);
  for (const u of openMaps) byPath.set(u.fsPath, u);

  const candidates = [...byPath.values()];
  if (candidates.length === 0) return false;

  if (candidates.length === 1) {
    const allowExternal = !isUriInWorkspace(candidates[0]);
    await setCurrentMapFromUri(candidates[0], allowExternal);
    return true;
  }

  if (!showPicker) return false;

  const items = candidates.map(u => ({
    label: path.basename(u.fsPath),
    description: vscode.workspace.asRelativePath(u.fsPath),
    uri: u,
    allowExternal: !isUriInWorkspace(u)
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a MAP file",
    matchOnDescription: true
  });

  if (!picked) return false;

  await setCurrentMapFromUri(picked.uri, picked.allowExternal);
  return true;
}

async function autoSelectSingleMap(): Promise<void> {
  const workspaceMaps = await listWorkspaceMapFiles();
  if (workspaceMaps.length !== 1) return;
  await setCurrentMapFromUri(workspaceMaps[0]);
}

function isMapFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.map') || lower.endsWith('.xmap');
}

function isMapFilePath(filePath: string): boolean {
  return isMapFileName(path.basename(filePath));
}

class SymbolTreeItem extends vscode.TreeItem {
  constructor(
    public readonly symbol: Symbol,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(symbol.name, collapsibleState);
    this.description = symbol.address;
    this.tooltip = `${symbol.name}
Address: ${symbol.address}
Space: ${symbol.space}`;
    this.contextValue = 'symbol';
  }
}

class MemoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly region: MemoryRegion,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(region.name, collapsibleState);
    
    const usedBytes = region.code + region.data + region.reserved;
    const usedPercent = ((usedBytes / region.total) * 100).toFixed(1);
    
    this.description = `${usedPercent}% (${this.formatBytes(usedBytes)} / ${this.formatBytes(region.total)})`;
    this.tooltip = this.buildTooltip(region);
    this.contextValue = 'memoryRegion';
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  private buildTooltip(region: MemoryRegion): string {
    return `${region.name}
Code: ${this.formatBytes(region.code)}
Data: ${this.formatBytes(region.data)}
Reserved: ${this.formatBytes(region.reserved)}
Free: ${this.formatBytes(region.free)}
Total: ${this.formatBytes(region.total)}`;
  }
}

class SymbolProvider implements vscode.TreeDataProvider<SymbolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SymbolTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private symbols: Symbol[] = [];

  refresh(symbols: Symbol[]): void {
    this.symbols = symbols;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SymbolTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SymbolTreeItem): Thenable<SymbolTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      this.symbols.map(symbol => 
        new SymbolTreeItem(symbol, vscode.TreeItemCollapsibleState.None)
      )
    );
  }
}

class MemoryProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MemoryTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private regions: MemoryRegion[] = [];

  refresh(regions: MemoryRegion[]): void {
    this.regions = regions;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MemoryTreeItem): Thenable<MemoryTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      this.regions.map(region => 
        new MemoryTreeItem(region, vscode.TreeItemCollapsibleState.None)
      )
    );
  }
}

function parseActiveMapFile(): TaskingMapParser | null {
  return currentMapParser;
}

async function findMapFileInWorkspace(showPicker: boolean): Promise<vscode.Uri | null> {
  if (mapFileUri) return mapFileUri;
  const ok = await ensureMapSelected(showPicker);
  return ok ? mapFileUri : null;
}

class CFileDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location | null> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return null;

    const word = document.getText(range);
    
    if (!currentMapParser) {
      await findMapFileInWorkspace(false);
    }
    
    if (!currentMapParser || !mapFileUri) return null;

    const symbol = currentMapParser.findSymbol(word);
    if (!symbol) return null;

    const mapDocument = await vscode.workspace.openTextDocument(mapFileUri);
    const mapText = mapDocument.getText();
    
    const searchPattern = new RegExp(`\\|\\s+${word}\\s+\\|\\s+${symbol.address}`, 'g');
    const match = searchPattern.exec(mapText);
    
    if (match) {
      const offset = match.index;
      const pos = mapDocument.positionAt(offset);
      return new vscode.Location(mapFileUri, pos);
    }

    return null;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function sliceSection(text: string, startMarker: string, endMarker?: string): { section: string; sectionOffset: number } {
  const start = text.indexOf(startMarker);
  if (start < 0) return { section: "", sectionOffset: 0 };

  let end = text.length;
  if (endMarker) {
    const idx = text.indexOf(endMarker, start + startMarker.length);
    if (idx >= 0) end = idx;
  }
  return { section: text.substring(start, end), sectionOffset: start };
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('TASKING Map Viewer activated');

  const config = vscode.workspace.getConfiguration("taskingMap");
  const highlightOnly = config.get<boolean>("highlightOnly", false);

  const symbolProvider = new SymbolProvider();
  const memoryProvider = new MemoryProvider();

  const updateViews = () => {
    if (highlightOnly) return;
    const parser = parseActiveMapFile();
    if (parser) {
      symbolProvider.refresh(parser.parseSymbols());
      memoryProvider.refresh(parser.parseMemoryUsage());
    }
  };

  if (!highlightOnly) {
    await autoSelectSingleMap();
    updateViews();

    const mapWatcher = vscode.workspace.createFileSystemWatcher('**/*.{map,xmap}');
    context.subscriptions.push(mapWatcher);

    mapWatcher.onDidChange(async uri => {
      if (!mapFileUri || uri.fsPath.toLowerCase() !== mapFileUri.fsPath.toLowerCase()) return;
      await setCurrentMapFromUri(uri);
      updateViews();
    });

    mapWatcher.onDidCreate(async uri => {
      if (!mapFileUri || uri.fsPath.toLowerCase() !== mapFileUri.fsPath.toLowerCase()) return;
      await setCurrentMapFromUri(uri);
      updateViews();
    });

    mapWatcher.onDidDelete(uri => {
      if (!mapFileUri || uri.fsPath.toLowerCase() !== mapFileUri.fsPath.toLowerCase()) return;
      mapFileUri = null;
      currentMapParser = null;
      updateViews();
    });

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(updateViews),
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document === vscode.window.activeTextEditor?.document) {
          updateViews();
        }
      })
    );
  }

  context.subscriptions.push(
  vscode.commands.registerCommand('taskingMap.goToSymbol', async (symbolName?: string) => {
    if (highlightOnly) return;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selText = editor.document.getText(editor.selection).trim();
      if (selText) {
        symbolName = selText;
      } else {
        const range = editor.document.getWordRangeAtPosition(
          editor.selection.active,
          /[A-Za-z_]\w*/
        );
        if (range) symbolName = editor.document.getText(range);
      }
    }

    if (!symbolName) {
      vscode.window.showErrorMessage('No symbol selected');
      return;
    }

    if (!mapFileUri || !currentMapParser) {
      await findMapFileInWorkspace(true);
    }

    if (!mapFileUri) {
      vscode.window.showErrorMessage('No MAP file selected. Run "Map File Viewer: Select MAP File".');
      return;
    }

    const symbol = currentMapParser?.findSymbol(symbolName);
    if (!symbol) {
      vscode.window.showErrorMessage(`Symbol '${symbolName}' not found in MAP file`);
      return;
    }

    const document = await vscode.workspace.openTextDocument(mapFileUri);
    const mapEditor = await vscode.window.showTextDocument(document);

    const text = document.getText();
    const escapedName = escapeRegex(symbolName);

    const { section: addrSection, sectionOffset } = sliceSection(
      text,
      "* Symbols (sorted on address)",
      "* Locate Rules"
    );

    const haystack = addrSection || text;
    const baseOffset = addrSection ? sectionOffset : 0;

    const pAddrName = new RegExp(`^\\|\\s*${symbol.address}\\s*\\|\\s*${escapedName}\\b`, "m");
    const pNameAddr = new RegExp(`^\\|\\s*${escapedName}\\b\\s*\\|\\s*${symbol.address}\\b`, "m");

    const match = pAddrName.exec(haystack) ?? pNameAddr.exec(haystack);

    if (match) {
      const absoluteIndex = baseOffset + (match.index ?? 0);
      const position = document.positionAt(absoluteIndex);

      mapEditor.selection = new vscode.Selection(position, position);
      mapEditor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } else {
      vscode.window.showErrorMessage(
        `Symbol '${symbolName}' found (addr=${symbol.address}) but its row wasn't found in the MAP section`
      );
    }
  })
);

  context.subscriptions.push(
    vscode.commands.registerCommand('taskingMap.selectMapFile', async () => {
      if (highlightOnly) return;
      const ok = await ensureMapSelected(true);
      if (!ok) {
        vscode.window.showErrorMessage('No MAP files found');
        return;
      }
      if (mapFileUri) {
        vscode.window.showInformationMessage(`Using MAP file: ${path.basename(mapFileUri.fsPath)}`);
        updateViews();
      }
    })
  );
  if (!highlightOnly) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        [{ language: "c" }, { language: "cpp" }],
        {
          async provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
            if (!range) return;

            const symbolName = document.getText(range);

            if (!currentMapParser) {
              await autoSelectSingleMap();
              if (!currentMapParser) return;
            }

            const parser = currentMapParser;
            if (!parser) return;

            const addr = parser.getSymbolAddress(symbolName);
            if (!addr) return;

            return new vscode.Hover(
              new vscode.MarkdownString(`**MAP Address**: \`${addr}\``),
              range
            );
          }
        }
      )
    );
  }
}

export function deactivate() {}
