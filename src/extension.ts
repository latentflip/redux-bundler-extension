import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const workspaceSymbolProvider =
    vscode.languages.registerWorkspaceSymbolProvider({
      async provideWorkspaceSymbols(
        query: string
      ): Promise<vscode.SymbolInformation[]> {
        const symbols: vscode.SymbolInformation[] = [];

        // Get all workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders) {
          for (const folder of workspaceFolders) {
            const files = await vscode.workspace.findFiles(
              new vscode.RelativePattern(folder, "src/bundles/**/*.js")
            );

            for (const file of files) {
              const document = await vscode.workspace.openTextDocument(file);
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
                    const symbolName = match.replace(
                      /(\b(select|do)[A-Z]\w+\b)\s*:/,
                      "$1"
                    );

                    // Create a SymbolInformation for the matched symbol
                    const symbol = new vscode.SymbolInformation(
                      symbolName,
                      vscode.SymbolKind.Method,
                      "",
                      new vscode.Location(document.uri, line.range)
                    );

                    symbols.push(symbol);
                  });
                }
              }
            }
          }
        }

        return symbols;
      },
    });
  context.subscriptions.push(workspaceSymbolProvider);
}
