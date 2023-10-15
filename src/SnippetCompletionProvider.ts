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
