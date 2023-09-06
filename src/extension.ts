import * as vscode from "vscode";

// Define a cache to store symbols and their timestamps for each file
const symbolCache: {
  [key: string]: { symbols: vscode.SymbolInformation[]; timestamp: number };
} = {};

const symbolResultCache: vscode.SymbolInformation[] = [];
let symbolLocationsCache: { [key: string]: vscode.Location } = {};
const config = vscode.workspace.getConfiguration("reduxBundlerExtension");

// Access the user's configuration values
const directoriesToSearch = config.get<string[]>("bundlePaths", ["src"]);
const ignorePattern = config.get<string>("ignorePattern", "**/*.spec.js");
const modulesToInclude = config.get<string[]>("modulesToInclude", []);

console.log({ directoriesToSearch, ignorePattern, modulesToInclude });

export class MyDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition> {
    // Custom logic to determine the definition location based on the selected string.
    const targetLocation = findDefinitionLocation(document, position);

    if (targetLocation) {
      return new vscode.Location(targetLocation.uri, targetLocation.range);
    } else {
      return null;
    }
  }
}

function findDefinitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Location | undefined {
  // Custom logic to identify the target location based on the selected string.
  // You may search for comments or metadata in the text document.
  // Return a Location object if a valid target is found.
  // Otherwise, return undefined.
  const range = document.getWordRangeAtPosition(
    position,
    /(\b(select|do|react)[A-Z]\w+\b)/
  );
  if (range) {
    const text = document.getText(range);
    console.log(symbolLocationsCache[Object.keys(symbolLocationsCache)[0]]);
    console.log(symbolLocationsCache[text]);
    return symbolLocationsCache[text];
  }
  return;
}

async function findWorkspaceFiles(folder: vscode.WorkspaceFolder) {
  let files: any[] = [];

  for (const directoryToSearch of directoriesToSearch) {
    files = files.concat(
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, directoryToSearch + "/**/*.js"),
        ignorePattern
      )
    );
  }

  for (const module of modulesToInclude) {
    files = files.concat(
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, `node_modules/${module}/**/*.js`),
        ignorePattern
      )
    );
  }
  console.log(
    "Searching in",
    files.length,
    "files from",
    folder.name,
    directoriesToSearch,
    modulesToInclude
  );
  return files;
}

const rebuildSymbolResultCache = () => {
  symbolResultCache.length = 0;
  symbolLocationsCache = {};
  for (const key in symbolCache) {
    symbolResultCache.push(...symbolCache[key].symbols);
    symbolCache[key].symbols.forEach((symbol) => {
      symbolLocationsCache[symbol.name] = symbol.location;
    });
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

  const myDefinitionProvider = new MyDefinitionProvider();

  // Register the definition provider for a specific language (e.g., JavaScript).
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { scheme: "file", language: "javascript" },
      myDefinitionProvider
    )
  );

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
