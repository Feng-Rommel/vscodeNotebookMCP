# VS Code Notebook MCP Server

一个强大的MCP服务器，让AI Agent可以通过MCP协议直接操作VS Code中的Jupyter Notebook。

## ✨ 特性

- 📊 **完整的Notebook操作** - 打开、保存、读取notebook
- 📝 **单元格管理** - 插入、删除、修改单元格
- 🚀 **代码执行** - 执行单个单元格、执行所有、重启内核
- 🔒 **安全设计** - Bridge Server只绑定到localhost
- 🤖 **Agent友好** - 完美支持CodeBuddy等AI Agent

## 🏗️ 架构

```
AI Agent (如 CodeBuddy)
    ↓ MCP (stdio)
MCP Server (mcp/)
    ↓ HTTP (localhost only)
VS Code Extension (plugin/)
    ↓ VS Code API
VS Code Notebooks
```

**三层架构设计：**
1. **MCP Server** - 实现MCP协议，提供工具接口
2. **Bridge Server** - HTTP服务器，桥接MCP和VS Code API
3. **VS Code Extension** - 原生扩展，直接操作notebook

## 📦 安装与配置

### 第一步：克隆项目

```bash
git clone https://github.com/Feng-Rommel/vscode-notebook-mcp.git
cd vscode-notebook-mcp
```

### 第二步：安装VS Code扩展

在 `plugin/` 目录下：
#### 已经编译打包完成，下方代码可以不执行
```bash
cd plugin
npm install
npm run compile
npm run package
```

这会生成 `vscode-notebook-mcp-0.1.0.vsix` 文件。

安装扩展：

```bash
# 命令行安装
code --install-extension vscode-notebook-mcp-0.1.0.vsix --force

# 或者在 VS Code 中：
Extensions -> 面板右上角三个点 -> Install from VSIX... -> 选择生成的 .vsix 文件
```

安装后，在 VS Code 中打开任意 Jupyter Notebook，扩展会自动启动 Bridge Server。

### 第三步：安装MCP服务器依赖

在 `mcp/` 目录下：
#### 必须运行nmp install安装依赖包，因为node_modules太大所以没有上传github，npm run compile可以不运行
```bash
cd mcp
npm install
npm run compile
```

这会生成 `mcp/out/standaloneServer.js` 文件。

### 第四步：配置MCP服务器

找到 CodeBuddy 的 MCP 配置文件，通常位于：

- Windows: `C:\Users\你的用户名\.codebuddy\mcp.json`
- macOS: `~/.codebuddy/mcp.json`
- Linux: `~/.codebuddy/mcp.json`

添加以下配置（**注意修改路径为你自己的实际路径**）：

```json
{
  "mcpServers": {
    "VS Code Notebook MCP": {
      "timeout": 60000,
      "command": "node",
      "args": [
        "path/to/vscode-notebook-mcp/mcp/out/standaloneServer.js"
      ],
      "type": "stdio",
      "disabled": false
    }
  }
}
```

**重要：**
- 将 `"path/to/vscode-notebook-mcp/mcp/out/standaloneServer.js"` 替换为你的项目实际路径
- Windows 路径可以使用 `/` 或 `\\`，不要混用
- 路径必须指向 `standaloneServer.js` 文件，而不是目录

### 第五步：测试连接

1. 确保已安装 VS Code 插件
2. 在 VS Code 中打开一个 Jupyter Notebook
3. 重启 CodeBuddy（或重新加载窗口）
4. CodeBuddy 会自动加载 MCP 服务器
5. 如果配置正确，MCP 日志应该显示连接成功

如果看到 "MCP error -32000: Connection closed" 错误：
- 检查路径是否正确
- 确认已在 `mcp/` 目录运行了 `npm install`
- 确认已运行了 `npm run compile`

## 🎯 使用方法

配置成功后，打开一个notebook文件，你就可以在 CodeBuddy 中使用以下工具操作 VS Code Notebook：
### 测试
```
你可以看到有哪些MCP可以使用吗?
```

```
测试一下这些功能。
```

### 基础操作
**获取当前Notebook信息**
```
当前打开的是什么notebook？
```

**读取Notebook完整内容**
```
读取当前notebook的所有内容
```

**保存Notebook**
```
保存当前的notebook
```

### 单元格操作

**插入单元格**
```
在末尾插入一个代码单元格：print('Hello from MCP!')
```

**删除单元格**
```
删除最后一个单元格
```

**修改单元格内容**
```
将第5个单元格的内容改为：x = 42\nprint(x)
```

### 执行操作

**执行指定单元格**
```
执行第0个单元格
```

**插入并执行单元格**
```
在末尾插入并执行：import pandas as pd\ndf = pd.DataFrame({'a': [1,2,3]})
```

**执行所有单元格**
```
执行notebook中的所有单元格
```

**重启内核**
```
重启notebook内核
```

## 📋 可用工具列表

### Notebook 操作
- `get_active_notebook` - 获取当前活动的notebook信息
- `list_notebooks` - 列出所有打开的notebooks
- `read_notebook` - 读取notebook完整内容
- `open_notebook` - 打开或创建notebook
- `save_notebook` - 保存notebook

### 单元格操作
- `insert_cell` - 插入新单元格
- `delete_cell` - 删除单元格
- `overwrite_cell` - 修改单元格内容

### 执行操作
- `execute_cell` - 执行指定单元格
- `insert_and_execute_cell` - 插入并执行单元格
- `execute_all_cells` - 执行所有单元格
- `restart_kernel` - 重启内核

## 🔧 开发

### 项目结构

```
vscode-notebook-mcp/
├── plugin/              # VS Code扩展
│   ├── src/
│   │   ├── extension.ts         # VS Code扩展入口
│   │   └── bridgeServer.ts      # Bridge Server
│   ├── out/                     # 编译输出
│   ├── package.json
│   └── tsconfig.json
├── mcp/                 # MCP服务器
│   ├── src/
│   │   └── standaloneServer.ts  # MCP服务器
│   ├── out/                     # 编译输出
│   ├── package.json
│   └── tsconfig.json
├── README.md
└── .gitignore
```

### 编译

```bash
# 编译插件
cd plugin
npm run compile

# 编译MCP服务器
cd mcp
npm run compile
```

### 打包

```bash
# 打包VS Code扩展
cd plugin
npm run package
```

### 重新编译后更新MCP服务器

如果你修改了代码并重新编译了MCP服务器，不需要修改配置，CodeBuddy会在下次启动时自动使用新版本。

## 📝 配置说明

### Bridge Server配置

Bridge Server运行在端口 `37652`，只绑定到 `127.0.0.1`（localhost）以确保安全。

如果需要修改端口，可以在 `plugin/src/extension.ts` 中修改：

```typescript
apiBridge = new VSCodeAPIBridge(37652); // 修改为你想要的端口
```

### MCP配置路径说明

MCP配置文件中的路径需要：
- 指向编译后的 `.js` 文件，不是 `.ts` 文件
- 使用绝对路径
- 路径分隔符保持一致（全部用 `/` 或全部用 `\\`）

示例（Windows）：
```json
{
  "args": [
    "d:/开发/vscodeNotebookMCP/mcp/out/standaloneServer.js"
  ]
}
```

或：
```json
{
  "args": [
    "d:\\开发\\vscodeNotebookMCP\\mcp\\out\\standaloneServer.js"
  ]
}
```

## 🔒 安全性

- ✅ Bridge Server只绑定到localhost，防止局域网访问
- ✅ 所有API调用都经过VS Code扩展验证
- ✅ 没有暴露任何敏感信息

## ❓ 常见问题

### Q: MCP报错 "Connection closed"

A: 检查以下几点：
1. 确认已在 `mcp/` 目录运行了 `npm install`
2. 确认已运行了 `npm run compile`
3. 确认 mcp.json 中的路径是正确的绝对路径
4. 确认路径指向的是 `standaloneServer.js` 而不是目录

### Q: VS Code扩展没有响应

A: 确保：
1. 已正确安装 VS Code 扩展
2. 在 VS Code 中打开了一个 Jupyter Notebook
3. 扩展已启用（在 VS Code Extensions 面板中查看）

### Q: 可以不安装VS Code扩展吗？

A: 不可以。Bridge Server 是连接 MCP 和 VS Code Notebook 的桥梁，必须通过 VS Code 扩展实现。

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP协议
- [VS Code API](https://code.visualstudio.com/api) - VS Code扩展API
