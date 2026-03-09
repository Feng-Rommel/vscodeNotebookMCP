"use strict";
/**
 * VS Code API Bridge Server
 * 作为 VS Code 扩展的一部分，提供 HTTP 接口让 MCP 服务器调用 VS Code API
 */
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
exports.VSCodeAPIBridge = void 0;
const vscode = __importStar(require("vscode"));
const express = require('express');
class VSCodeAPIBridge {
    server;
    port;
    app;
    constructor(port = 37652) {
        this.port = port;
        this.app = express();
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.use(express.json());
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', vscode: 'connected' });
        });
        // ===== Notebook Operations =====
        // 获取活动 notebook
        this.app.get('/notebook/active', (req, res) => {
            const notebook = vscode.window.activeNotebookEditor?.notebook;
            if (!notebook) {
                return res.status(404).json({ error: 'No active notebook' });
            }
            // 获取选中的单元格索引
            const selectedCell = vscode.window.activeNotebookEditor?.selections?.[0]?.start;
            const selectedCellIndex = selectedCell !== undefined ? selectedCell : -1;
            res.json({
                uri: notebook.uri.toString(),
                notebookType: notebook.notebookType,
                cellCount: notebook.cellCount,
                isDirty: notebook.isDirty,
                selectedCellIndex,
                cells: notebook.getCells().map((cell, index) => ({
                    index,
                    type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
                    language: cell.document.languageId,
                    source: cell.document.getText().slice(0, 200),
                }))
            });
        });
        // 列出所有 notebooks
        this.app.get('/notebooks', (req, res) => {
            const notebooks = vscode.workspace.notebookDocuments.map(doc => ({
                uri: doc.uri.toString(),
                notebookType: doc.notebookType,
                cellCount: doc.cellCount,
                isDirty: doc.isDirty,
            }));
            res.json({ notebooks, count: notebooks.length });
        });
        // 读取 notebook 内容
        this.app.get('/notebook/read', async (req, res) => {
            const { uri } = req.query;
            let notebook;
            if (uri) {
                try {
                    const docUri = vscode.Uri.parse(uri);
                    notebook = await vscode.workspace.openNotebookDocument(docUri);
                }
                catch (e) {
                    return res.status(400).json({ error: 'Invalid URI' });
                }
            }
            else {
                notebook = vscode.window.activeNotebookEditor?.notebook;
            }
            if (!notebook) {
                return res.status(404).json({ error: 'Notebook not found' });
            }
            const cells = notebook.getCells().map((cell, index) => ({
                index,
                type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
                language: cell.document.languageId,
                source: cell.document.getText(),
                metadata: cell.metadata,
                executionSummary: cell.executionSummary,
                outputs: cell.outputs.map(o => ({
                    items: o.items.map(item => ({
                        mime: item.mime,
                        data: item.data,
                    })),
                })),
            }));
            res.json({
                uri: notebook.uri.toString(),
                cellCount: cells.length,
                cells,
            });
        });
        // 打开/创建 notebook
        this.app.post('/notebook/open', async (req, res) => {
            const { path, create } = req.body;
            if (!path) {
                return res.status(400).json({ error: 'Path is required' });
            }
            try {
                const uri = vscode.Uri.file(path);
                let doc;
                try {
                    doc = await vscode.workspace.openNotebookDocument(uri);
                }
                catch {
                    if (create) {
                        // 创建新 notebook - 通过写入文件实现
                        const fs = await import('fs/promises');
                        const notebookData = {
                            nbformat: 4,
                            nbformat_minor: 4,
                            metadata: {
                                kernelspec: {
                                    display_name: 'Python 3',
                                    language: 'python',
                                    name: 'python3',
                                },
                            },
                            cells: []
                        };
                        await fs.writeFile(path, JSON.stringify(notebookData, null, 2), 'utf-8');
                        doc = await vscode.workspace.openNotebookDocument(uri);
                    }
                    else {
                        return res.status(404).json({ error: 'Notebook not found' });
                    }
                }
                await vscode.window.showNotebookDocument(doc);
                res.json({ success: true, uri: doc.uri.toString() });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // 保存 notebook
        this.app.post('/notebook/save', async (req, res) => {
            const { uri } = req.body;
            let notebook;
            if (uri) {
                try {
                    const uriObj = vscode.Uri.parse(uri);
                    notebook = await vscode.workspace.openNotebookDocument(uriObj);
                }
                catch {
                    return res.status(400).json({ error: 'Invalid URI' });
                }
            }
            else {
                notebook = vscode.window.activeNotebookEditor?.notebook;
            }
            if (!notebook) {
                return res.status(404).json({ error: 'No notebook to save' });
            }
            // 使用 workbench 命令保存，这会触发完整的保存流程
            try {
                await vscode.commands.executeCommand('workbench.action.files.save');
                // 等待一小段时间让保存操作完成
                await new Promise(resolve => setTimeout(resolve, 1000));
                res.json({
                    success: true,
                    uri: notebook.uri.toString(),
                    isDirty: notebook.isDirty,
                    cellCount: notebook.cellCount
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // ===== Cell Operations =====
        // 插入单元格
        this.app.post('/cell/insert', async (req, res) => {
            const { index, type, source } = req.body;
            const notebook = vscode.window.activeNotebookEditor?.notebook;
            if (!notebook) {
                return res.status(404).json({ error: 'No active notebook' });
            }
            const cellType = type === 'code'
                ? vscode.NotebookCellKind.Code
                : vscode.NotebookCellKind.Markup;
            // 自动检测当前 notebook 使用的语言
            let language = type === 'code' ? 'python' : 'markdown';
            if (notebook.cellCount > 0) {
                // 查找第一个代码单元格，使用其语言
                for (const cell of notebook.getCells()) {
                    if (cell.kind === vscode.NotebookCellKind.Code) {
                        language = cell.document.languageId;
                        break;
                    }
                }
            }
            const cell = new vscode.NotebookCellData(cellType, source, language);
            const insertIndex = index === -1 || index === undefined
                ? notebook.cellCount
                : index;
            const edit = new vscode.WorkspaceEdit();
            edit.set(notebook.uri, [vscode.NotebookEdit.insertCells(insertIndex, [cell])]);
            const success = await vscode.workspace.applyEdit(edit);
            res.json({ success, insertedAt: insertIndex });
        });
        // 删除单元格
        this.app.post('/cell/delete', async (req, res) => {
            const { index } = req.body;
            const notebook = vscode.window.activeNotebookEditor?.notebook;
            if (!notebook) {
                return res.status(404).json({ error: 'No active notebook' });
            }
            const deleteIndex = index === -1 || index === undefined
                ? notebook.cellCount - 1
                : index;
            const edit = new vscode.WorkspaceEdit();
            edit.set(notebook.uri, [
                vscode.NotebookEdit.deleteCells(new vscode.NotebookRange(deleteIndex, deleteIndex + 1))
            ]);
            const success = await vscode.workspace.applyEdit(edit);
            res.json({ success, deletedAt: deleteIndex });
        });
        // 修改单元格内容
        this.app.post('/cell/overwrite', async (req, res) => {
            const { index, source } = req.body;
            const notebook = vscode.window.activeNotebookEditor?.notebook;
            if (!notebook) {
                return res.status(404).json({ error: 'No active notebook' });
            }
            const cell = notebook.cellAt(index);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(cell.document.positionAt(0), cell.document.positionAt(cell.document.getText().length));
            edit.replace(cell.document.uri, fullRange, source);
            const success = await vscode.workspace.applyEdit(edit);
            res.json({ success, index, newLength: source.length });
        });
        // ===== Execution =====
        // 执行单元格
        this.app.post('/cell/execute', async (req, res) => {
            const { index, timeout = 60 } = req.body;
            const notebook = vscode.window.activeNotebookEditor?.notebook;
            if (!notebook) {
                return res.status(404).json({ error: 'No active notebook' });
            }
            const execIndex = index === -1 || index === undefined
                ? notebook.cellCount - 1
                : index;
            // 执行单元格
            (async () => {
                try {
                    const cell = notebook.cellAt(execIndex);
                    // 直接尝试执行命令
                    let executed = false;
                    const commands = [
                        'notebook.execute',
                        'notebook.cell.execute',
                        'jupyter.runCell',
                        'jupyter.notebookeditor.runselectedcell'
                    ];
                    for (const cmd of commands) {
                        try {
                            await vscode.commands.executeCommand(cmd);
                            executed = true;
                            break;
                        }
                        catch (e) {
                            // 继续尝试下一个命令
                            continue;
                        }
                    }
                    if (!executed) {
                        throw new Error('No execution command succeeded');
                    }
                    // 等待执行完成
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    res.json({
                        executed: execIndex,
                        success: cell.executionSummary?.success,
                        executionOrder: cell.executionSummary?.executionOrder,
                        outputs: cell.outputs?.map((o) => ({
                            items: o.items.map((item) => ({
                                mime: item.mime,
                                data: typeof item.data === 'object' ? '[Object]' : String(item.data).slice(0, 500)
                            })),
                        })) || [],
                    });
                }
                catch (err) {
                    res.status(500).json({ error: err.message });
                }
            })();
        });
        // 插入并执行单元格
        this.app.post('/cell/insert-execute', async (req, res) => {
            const { position, source } = req.body;
            // 先插入
            const notebook = vscode.window.activeNotebookEditor?.notebook;
            if (!notebook) {
                return res.status(404).json({ error: 'No active notebook' });
            }
            // 自动检测当前 notebook 使用的语言
            let language = 'python';
            if (notebook.cellCount > 0) {
                // 查找第一个代码单元格，使用其语言
                for (const cell of notebook.getCells()) {
                    if (cell.kind === vscode.NotebookCellKind.Code) {
                        language = cell.document.languageId;
                        break;
                    }
                }
            }
            const cell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, source, language);
            const insertIndex = position === -1 || position === undefined
                ? notebook.cellCount
                : position;
            const edit = new vscode.WorkspaceEdit();
            edit.set(notebook.uri, [vscode.NotebookEdit.insertCells(insertIndex, [cell])]);
            const success = await vscode.workspace.applyEdit(edit);
            if (!success) {
                return res.status(500).json({ error: 'Failed to insert cell' });
            }
            // 再执行
            const execIndex = position === -1 || position === undefined
                ? insertIndex
                : position;
            (async () => {
                try {
                    const cell = notebook.cellAt(execIndex);
                    // 尝试通过命令执行
                    let executed = false;
                    const commands = [
                        'notebook.execute',
                        'notebook.cell.execute',
                        'jupyter.runCell',
                        'jupyter.notebookeditor.runselectedcell'
                    ];
                    for (const cmd of commands) {
                        try {
                            await vscode.commands.executeCommand(cmd);
                            executed = true;
                            break;
                        }
                        catch (e) {
                            continue;
                        }
                    }
                    if (!executed) {
                        throw new Error('No execution command succeeded');
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    res.json({
                        inserted: { success, insertedAt: insertIndex },
                        executed: {
                            executed: execIndex,
                            success: cell.executionSummary?.success,
                            executionOrder: cell.executionSummary?.executionOrder,
                            outputs: cell.outputs.map(o => ({
                                items: o.items.map(item => ({
                                    mime: item.mime,
                                    data: typeof item.data === 'object' ? '[Object]' : String(item.data).slice(0, 500)
                                })),
                            })),
                        }
                    });
                }
                catch (err) {
                    res.status(500).json({ error: err.message });
                }
            })();
        });
        // 重启内核
        this.app.post('/kernel/restart', async (req, res) => {
            vscode.commands.executeCommand('notebook.kernel.restart');
            res.json({ success: true, message: 'Kernel restarted' });
        });
        // 执行所有单元格
        this.app.post('/notebook/execute-all', async (req, res) => {
            vscode.commands.executeCommand('notebook.executeAll');
            res.json({ success: true, message: 'Executing all cells' });
        });
    }
    // ===== Start Server =====
    start() {
        return new Promise((resolve, reject) => {
            try {
                // 只绑定到 localhost，防止局域网访问
                this.server = this.app.listen(this.port, '127.0.0.1', () => {
                    console.log(`VS Code API Bridge server running on port ${this.port} (localhost only)`);
                    resolve();
                });
                this.server.on('error', (err) => {
                    console.error('Bridge server error:', err);
                    reject(err);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    stop() {
        if (this.server) {
            this.server.close();
            console.log('VS Code API Bridge server stopped');
        }
    }
}
exports.VSCodeAPIBridge = VSCodeAPIBridge;
//# sourceMappingURL=bridgeServer.js.map