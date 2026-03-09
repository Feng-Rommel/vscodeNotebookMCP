import * as vscode from 'vscode';
import { VSCodeAPIBridge } from './bridgeServer';

let apiBridge: VSCodeAPIBridge | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('VS Code Notebook MCP extension activated');

  // 启动 API Bridge 服务器
  apiBridge = new VSCodeAPIBridge(37652);
  apiBridge.start().then(() => {
    vscode.window.showInformationMessage('VS Code API Bridge server started on port 37652');
  }).catch(err => {
    vscode.window.showErrorMessage(`Failed to start API Bridge: ${err.message}`);
  });

  // 注册重启 Bridge 命令
  let restartBridgeDisposable = vscode.commands.registerCommand('notebookMcp.restartBridge', async () => {
    if (apiBridge) {
      apiBridge.stop();
    }
    apiBridge = new VSCodeAPIBridge(37652);
    await apiBridge.start();
    vscode.window.showInformationMessage('VS Code API Bridge restarted');
  });

  context.subscriptions.push(restartBridgeDisposable);
}

export function deactivate() {
  apiBridge?.stop();
}
