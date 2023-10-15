import * as vscode from 'vscode';
import { SnippetCompletionProvider, SnippetTreeDataProvider } from './SnippetCompletionProvider';
import { APIClient } from './contants';

let snippetDataProvider: SnippetTreeDataProvider | undefined;
let completionProviderDisposable: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const token = context.globalState.get<string>('token');

    loadSnippetsIfTokenExists(context);

    context.subscriptions.push(vscode.commands.registerCommand('lazyweb.loginSnippet', async () => {
        await authenticateAndSaveToken(context);
        loadSnippetsIfTokenExists(context);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('lazyweb.refreshSnippets', () => {
        loadSnippetsIfTokenExists(context);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('lazyweb.logoutSnippet', () => {
        context.globalState.update('token', undefined);
        vscode.window.showInformationMessage('Logged out!');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('lazyweb.sendSelectedCode', async () => {
        sendSelectedCodeToBackend(context);
    }));

    if (token && await verifyUser(token)) {
        snippetDataProvider = new SnippetTreeDataProvider(context);
        vscode.window.createTreeView('lazyweb.snippets', {
            treeDataProvider: snippetDataProvider
        });

        // Register the command to handle snippet click
        context.subscriptions.push(vscode.commands.registerCommand('lazyweb.openSnippet', async (snippet: any) => {
            // Open the snippet in a new text editor
            const newDocument = await vscode.workspace.openTextDocument({ content: snippet.snippetCode });
            vscode.window.showTextDocument(newDocument);
        }));
    } else {
        vscode.window.showErrorMessage('Authentication failed. Please login to access snippets.');
    }
    

}

async function authenticateAndSaveToken(context: vscode.ExtensionContext) {
    const email = await vscode.window.showInputBox({ prompt: 'Enter your email for authentication' });
    if (!email) {
        return;
    }

    try {
        const { data } = await APIClient.post('/auth/login-ext', { email });
        
        // If authentication is successful
        if (data && data.success) {
            // Show a message with a button to enter the token
            const enterTokenButton = { title: 'Enter Token' };
            const message = await vscode.window.showInformationMessage('Authentication successful. Enter the token sent to your email.', enterTokenButton);

            if (message === enterTokenButton) {
                const token = await vscode.window.showInputBox({ prompt: 'Enter the token sent to your email' });
                if (token) {
                    await context.globalState.update('token', token);
                } else {
                    vscode.window.showErrorMessage('Token was not entered');
                }
            }
        } else {
            vscode.window.showErrorMessage('Authentication failed');
            return;
        }
    } catch (error: any) {
        vscode.window.showErrorMessage('An error occurred: ' + (error.message || 'Unknown error'));
    }
}



async function loadSnippetsIfTokenExists(context: vscode.ExtensionContext) {
    const token = context.globalState.get<string>('token');
    if (token) {
        // Verify the user
        const verified = await verifyUser(token);

        // If the user is not verified, show an error and exit
        if (!verified) {
            vscode.window.showErrorMessage('Authentication failed. Please login again.');
            return;
        }

        // If there's an existing completion provider, dispose of it to prevent duplicates
        if (completionProviderDisposable) {
            completionProviderDisposable.dispose();
        }

        const provider = new SnippetCompletionProvider(token);
        // Specify a document selector for both file and untitled schemes
        const documentSelector: vscode.DocumentSelector = [
            { scheme: 'file' },
            { scheme: 'untitled' }
        ];

        // Store the new completion provider's disposable to allow for clean-up later
        completionProviderDisposable = vscode.languages.registerCompletionItemProvider(documentSelector, provider);
        context.subscriptions.push(completionProviderDisposable);

        vscode.window.showInformationMessage('Snippets loaded!');

        if (snippetDataProvider) {
            snippetDataProvider.refresh();
        }
    } else {
        vscode.window.showWarningMessage('No token found. Please login to load snippets.');
    }
}

async function sendSelectedCodeToBackend(context: vscode.ExtensionContext) {
    const token = context.globalState.get<string>('token');

    // If no token is found, show an error and exit
    if (!token) {
        vscode.window.showErrorMessage('No token found. Please login to send snippets.');
        return;
    }

    // Verify the user
    const verified = await verifyUser(token);

    // If the user is not verified, show an error and exit
    if (!verified) {
        vscode.window.showErrorMessage('Authentication failed. Please login again.');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No editor is active, cannot find any text to send.');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    const language = editor.document.languageId;  // Get the language ID

    if (!selectedText) {
        vscode.window.showErrorMessage('No text selected to send.');
        return;
    }

    // Ask the user for the snippet shortcut
    const snippetShortcut = await vscode.window.showInputBox({ prompt: 'Enter a shortcut for your snippet:' });

    // If no shortcut is entered, show an error and exit
    if (!snippetShortcut) {
        vscode.window.showErrorMessage('No snippet shortcut provided.');
        return;
    }

    try {
        // Send the selectedText, the language, and the snippetShortcut to the backend
        const response = await APIClient.post('/snippets/create-ai', { snippetCode: selectedText, language: language, shortcut: snippetShortcut }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response && response.data && response.data.success) {
            vscode.window.showInformationMessage('Code sent successfully!');
            loadSnippetsIfTokenExists(context);
        } else {
            vscode.window.showErrorMessage('Failed to send code to the backend.');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage('An error occurred: ' + (error.message || 'Unknown error'));
    }
}

async function verifyUser(token:string){
    try {
        const response = await APIClient.get('/auth/verify', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response && response.data && response.data.success) {
            return true;
        } else {
            return false;
        }
    } catch (error: any) {
        return false;
    }
}




