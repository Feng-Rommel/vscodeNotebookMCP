"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const bridgeServer_1 = require("./bridgeServer");
let apiBridge;
function activate(context) {
    console.log('VS Code Notebook MCP extension activated');
    // 启动 API Bridge 服务器
    apiBridge = new bridgeServer_1.VSCodeAPIBridge(37652);
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
        apiBridge = new bridgeServer_1.VSCodeAPIBridge(37652);
        await apiBridge.start();
        vscode.window.showInformationMessage('VS Code API Bridge restarted');
    });
    context.subscriptions.push(restartBridgeDisposable);
}
function deactivate() {
    apiBridge?.stop();
}
//# sourceMappingURL=extension.js.map