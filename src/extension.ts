import * as vscode from "vscode";

// Define a cache to store symbols and their timestamps for each file
const symbolCache: {
  [key: string]: { symbols: vscode.SymbolInformation[]; timestamp: number };
} = {};

const symbolResultCache: vscode.SymbolInformation[] = [];

const config = vscode.workspace.getConfiguration("reduxBundlerExtension");

// Access the user's configuration values
const directoryToSearch = config.get<string>("bundlesPath", "src/bundles");
const ignorePattern = config.get<string>("ignorePattern", "**/*.spec.js");
const modulesToInclude = config.get<string[]>("modulesToInclude", []);

async function findWorkspaceFiles(folder: vscode.WorkspaceFolder) {
  let files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folder, directoryToSearch + "/**/*.js"),
    ignorePattern
  );

  for (const module of modulesToInclude) {
    files = files.concat(
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, `node_modules/${module}/**/*.js`),
        ignorePattern
      )
    );
  }
  return files;
}

const rebuildSymbolResultCache = () => {
  symbolResultCache.length = 0;
  for (const key in symbolCache) {
    symbolResultCache.push(...symbolCache[key].symbols);
  }
};

export async function activate(context: vscode.ExtensionContext) {
  // Preload symbols when the extension is activated
  await preloadSymbols();

  const workspaceSymbolProvider =
    vscode.languages.registerWorkspaceSymbolProvider({
      async provideWorkspaceSymbols(
        query: string
      ): Promise<vscode.SymbolInformation[]> {
        return symbolResultCache;
      },
    });

  // Register a listener for the "onDidSaveTextDocument" event
  vscode.workspace.onDidSaveTextDocument(async (document) => {
    console.log("Saved:", document.uri.fsPath);
    const cacheEntry = symbolCache[document.uri.fsPath];

    if (cacheEntry) {
      console.log("Reprocessing cached:", document.uri.fsPath);
      const fileSymbols = processFileSymbols(document);

      // Update the cached symbols
      cacheEntry.symbols = fileSymbols;

      // Update the timestamp with the file's modification time (mtime)
      // @ts-ignore
      const stats = await vscode.workspace.fs.stat(document.uri);
      cacheEntry.timestamp = stats.mtime;
    } else {
      console.log("Not cached:", document.uri.fsPath);
    }
    rebuildSymbolResultCache();
  });

  context.subscriptions.push(workspaceSymbolProvider);
}

async function preloadSymbols() {
  console.log("Preloading symbols...");
  // Preload symbols for all JavaScript files in the workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const files = await findWorkspaceFiles(folder);

      for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        const fileSymbols = processFileSymbols(document);
        symbolCache[file.fsPath] = {
          symbols: fileSymbols,
          timestamp: Date.now(),
        };
      }
    }
  }
  rebuildSymbolResultCache();
  console.log("Preloaded", symbolResultCache.length, "symbols");
}

async function hasFileBeenModified(
  file: vscode.Uri,
  cachedTimestamp: number
): Promise<boolean> {
  // Check if the file's modification timestamp has changed since caching
  // @ts-ignore
  const stats = await vscode.workspace.fs.stat(file);
  const fileModificationTime = stats.mtime;

  // Compare the file's modification timestamp with the cached timestamp
  return fileModificationTime > cachedTimestamp;
}

function processFileSymbols(
  document: vscode.TextDocument
): vscode.SymbolInformation[] {
  const symbols: vscode.SymbolInformation[] = [];
  const regex = /(\b(select|do|react)[A-Z]\w+\b)\s*:/g;

  const workspaceName = vscode.workspace.name;
  const documentBasename = document.fileName.split("/").pop();
  const noExt = documentBasename?.replace(".js", "");

  const containerName = `${noExt} (${workspaceName})`;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const matches = line.text.match(regex);

    if (matches) {
      matches.forEach((match) => {
        // Extract the symbol name from the matched text
        const symbolName = match.replace(
          /(\b(select|do|react)[A-Z]\w+\b)\s*:/,
          "$1"
        );

        // Create a SymbolInformation for the matched symbol
        const symbol = new vscode.SymbolInformation(
          symbolName,
          vscode.SymbolKind.Event,
          containerName,
          new vscode.Location(document.uri, line.range)
        );

        symbols.push(symbol);
      });
    }
  }

  return symbols;
}
