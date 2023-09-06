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
function activate(context) {
    const workspaceSymbolProvider = vscode.languages.registerWorkspaceSymbolProvider({
        provideWorkspaceSymbols(query) {
            return __awaiter(this, void 0, void 0, function* () {
                const symbols = [];
                // Get all workspace folders
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    for (const folder of workspaceFolders) {
                        const files = yield vscode.workspace.findFiles(new vscode.RelativePattern(folder, "src/bundles/**/*.js"));
                        for (const file of files) {
                            const document = yield vscode.workspace.openTextDocument(file);
                            console.log(document.fileName);
                            const regex = /(\b(select|do)\w+\b)\s*:/g;
                            for (let i = 0; i < document.lineCount; i++) {
                                const line = document.lineAt(i);
                                const matches = line.text.match(regex);
                                if (matches) {
                                    console.log(matches);
                                    // @ts-ignore
                                    matches.forEach((match) => {
                                        // Extract the symbol name from the matched text
                                        const symbolName = match.replace(/(\b(select|do)[A-Z]\w+\b)\s*:/, "$1");
                                        // Create a SymbolInformation for the matched symbol
                                        const symbol = new vscode.SymbolInformation(symbolName, vscode.SymbolKind.Method, "", new vscode.Location(document.uri, line.range));
                                        symbols.push(symbol);
                                    });
                                }
                            }
                        }
                    }
                }
                return symbols;
            });
        },
    });
    context.subscriptions.push(workspaceSymbolProvider);
}
exports.activate = activate;
