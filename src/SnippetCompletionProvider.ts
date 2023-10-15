import * as vscode from 'vscode';
import { APIClient } from './contants';

export class SnippetCompletionProvider implements vscode.CompletionItemProvider {
    public snippets: vscode.CompletionItem[] = [];

    constructor(private token: string) {
        this.loadSnippets();
    }

    public async loadSnippets() {
        const apiSnippets = await fetchSnippetsFromApi(this.token);
        this.snippets = apiSnippets.map((apiSnippet:any) => this.convertSnippet(apiSnippet));
    }

    public async refreshSnippets() {
        await this.loadSnippets();
    }

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        return this.snippets;
    }

    public async resolveCompletionItem(
        item: vscode.CompletionItem,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem> {
        // Set the item's kind property based on some condition
        item.kind = vscode.CompletionItemKind.Function;
        return item;
    }

    private convertSnippet(apiSnippet: any): vscode.CompletionItem {
        const completionItem = new vscode.CompletionItem(apiSnippet.shortcut, vscode.CompletionItemKind.Snippet);
        completionItem.detail = apiSnippet.description;
        completionItem.insertText = new vscode.SnippetString(apiSnippet.snippetCode);
        return completionItem;
    }
}

export class SnippetTreeDataProvider implements vscode.TreeDataProvider<SnippetItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SnippetItem | undefined> = new vscode.EventEmitter<SnippetItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<SnippetItem | undefined> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: SnippetItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SnippetItem): Promise<SnippetItem[]> {
        const token = this.context.globalState.get<string>('token');
        if (!token) {
            return [];
        }
        const apiSnippets = await fetchSnippetsFromApi(token);
        return apiSnippets.map((snippet: any) => new SnippetItem(snippet.shortcut, {
            command: 'lazyweb.openSnippet', 
            title: "",
            arguments: [snippet]
        }));
    }
}

class SnippetItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly command?: vscode.Command
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }

    contextValue = 'snippet';
}


async function fetchSnippetsFromApi(token: string) {
    const {data} = await APIClient.get('snippets/me', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if(!data.success){
        return [];
    }

    const snippets = data.snippets;

    return snippets;
}
