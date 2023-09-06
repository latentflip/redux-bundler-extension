"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
// Define a cache to store symbols and their timestamps for each file
const symbolCache = {};
const symbolResultCache = [];
const config = vscode.workspace.getConfiguration("reduxBundlerExtension");
// Access the user's configuration values
const directoryToSearch = config.get("bundlesPath", "src/bundles");
const ignorePattern = config.get("ignorePattern", "**/*.spec.js");
const modulesToInclude = config.get("modulesToInclude", []);
function findWorkspaceFiles(folder) {
    return __awaiter(this, void 0, void 0, function* () {
        let files = yield vscode.workspace.findFiles(new vscode.RelativePattern(folder, directoryToSearch + "/**/*.js"), ignorePattern);
        for (const module of modulesToInclude) {
            files = files.concat(yield vscode.workspace.findFiles(new vscode.RelativePattern(folder, `node_modules/${module}/**/*.js`), ignorePattern));
        }
        return files;
    });
}
const rebuildSymbolResultCache = () => {
    symbolResultCache.length = 0;
    for (const key in symbolCache) {
        symbolResultCache.push(...symbolCache[key].symbols);
    }
};
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Preload symbols when the extension is activated
        yield preloadSymbols();
        const workspaceSymbolProvider = vscode.languages.registerWorkspaceSymbolProvider({
            provideWorkspaceSymbols(query) {
                return __awaiter(this, void 0, void 0, function* () {
                    return symbolResultCache;
                });
            },
        });
        // Register a listener for the "onDidSaveTextDocument" event
        vscode.workspace.onDidSaveTextDocument((document) => __awaiter(this, void 0, void 0, function* () {
            console.log("Saved:", document.uri.fsPath);
            const cacheEntry = symbolCache[document.uri.fsPath];
            if (cacheEntry) {
                console.log("Reprocessing cached:", document.uri.fsPath);
                const fileSymbols = processFileSymbols(document);
                // Update the cached symbols
                cacheEntry.symbols = fileSymbols;
                // Update the timestamp with the file's modification time (mtime)
                // @ts-ignore
                const stats = yield vscode.workspace.fs.stat(document.uri);
                cacheEntry.timestamp = stats.mtime;
            }
            else {
                console.log("Not cached:", document.uri.fsPath);
            }
            rebuildSymbolResultCache();
        }));
        context.subscriptions.push(workspaceSymbolProvider);
    });
}
exports.activate = activate;
function preloadSymbols() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Preloading symbols...");
        // Preload symbols for all JavaScript files in the workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const files = yield findWorkspaceFiles(folder);
                for (const file of files) {
                    const document = yield vscode.workspace.openTextDocument(file);
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
    });
}
function hasFileBeenModified(file, cachedTimestamp) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if the file's modification timestamp has changed since caching
        // @ts-ignore
        const stats = yield vscode.workspace.fs.stat(file);
        const fileModificationTime = stats.mtime;
        // Compare the file's modification timestamp with the cached timestamp
        return fileModificationTime > cachedTimestamp;
    });
}
function processFileSymbols(document) {
    const symbols = [];
    const regex = /(\b(select|do|react)[A-Z]\w+\b)\s*:/g;
    const workspaceName = vscode.workspace.name;
    const documentBasename = document.fileName.split("/").pop();
    const noExt = documentBasename === null || documentBasename === void 0 ? void 0 : documentBasename.replace(".js", "");
    const containerName = `${noExt} (${workspaceName})`;
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const matches = line.text.match(regex);
        if (matches) {
            matches.forEach((match) => {
                // Extract the symbol name from the matched text
                const symbolName = match.replace(/(\b(select|do|react)[A-Z]\w+\b)\s*:/, "$1");
                // Create a SymbolInformation for the matched symbol
                const symbol = new vscode.SymbolInformation(symbolName, vscode.SymbolKind.Event, containerName, new vscode.Location(document.uri, line.range));
                symbols.push(symbol);
            });
        }
    }
    return symbols;
}
