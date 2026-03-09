/**
 * VS Code Notebook MCP Server (With VS Code API Bridge)
 * 通过 HTTP 调用 VS Code Extension 的 API 来操作 notebooks
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

export class VSCodeNotebookMCPServer {
  private server: Server;
  private transport: StdioServerTransport;
  private bridgeUrl: string;
  private http: any;

  constructor(bridgeUrl: string = 'http://localhost:37652') {
    this.bridgeUrl = bridgeUrl;
    this.server = new Server(
      {
        name: 'vscode-notebook-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.transport = new StdioServerTransport();
    this.setupToolHandlers();
  }

  private async getHttp() {
    if (!this.http) {
      const nodeFetch = await import('node-fetch');
      this.http = nodeFetch.default;
    }
    return this.http;
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ===== Notebook Operations =====
        {
          name: 'get_active_notebook',
          description: 'Get information about currently active notebook in VS Code',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_notebooks',
          description: 'List all open notebooks in VS Code',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'read_notebook',
          description: 'Read notebook content with all cells',
          inputSchema: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description: 'Notebook URI (optional, defaults to active)',
              },
            },
          },
        },
        {
          name: 'open_notebook',
          description: 'Open or create a notebook in VS Code',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to notebook',
              },
              create: {
                type: 'boolean',
                description: 'Create if not exists',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'save_notebook',
          description: 'Save notebook',
          inputSchema: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description: 'Notebook URI (optional, defaults to active)',
              },
            },
          },
        },

        // ===== Cell Operations =====
        {
          name: 'insert_cell',
          description: 'Insert a new cell into active notebook',
          inputSchema: {
            type: 'object',
            properties: {
              index: {
                type: 'number',
                description: 'Position to insert (-1 for end)',
              },
              type: {
                type: 'string',
                enum: ['code', 'markdown'],
                description: 'Cell type',
              },
              source: {
                type: 'string',
                description: 'Cell content',
              },
            },
            required: ['source'],
          },
        },
        {
          name: 'delete_cell',
          description: 'Delete a cell from active notebook',
          inputSchema: {
            type: 'object',
            properties: {
              index: {
                type: 'number',
                description: 'Cell index to delete (-1 for last)',
              },
            },
            required: ['index'],
          },
        },
        {
          name: 'overwrite_cell',
          description: 'Overwrite content of a cell',
          inputSchema: {
            type: 'object',
            properties: {
              index: {
                type: 'number',
                description: 'Cell index',
              },
              source: {
                type: 'string',
                description: 'New cell content',
              },
            },
            required: ['index', 'source'],
          },
        },

        // ===== Execution =====
        {
          name: 'execute_cell',
          description: 'Execute a cell and return its output',
          inputSchema: {
            type: 'object',
            properties: {
              index: {
                type: 'number',
                description: 'Cell index (-1 for last)',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in seconds',
              },
            },
            required: ['index'],
          },
        },
        {
          name: 'insert_and_execute_cell',
          description: 'Insert a cell and immediately execute it',
          inputSchema: {
            type: 'object',
            properties: {
              position: {
                type: 'number',
                description: 'Position to insert (-1 for end)',
              },
              source: {
                type: 'string',
                description: 'Code to execute',
              },
            },
            required: ['source'],
          },
        },
        {
          name: 'execute_all_cells',
          description: 'Execute all cells in notebook',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'restart_kernel',
          description: 'Restart notebook kernel',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.executeTool(name, args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async callBridge(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
    const http = await this.getHttp();
    const url = `${this.bridgeUrl}${endpoint}`;

    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await http(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Bridge connection failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      // ===== Notebook Operations =====
      case 'get_active_notebook':
        return this.callBridge('/notebook/active');

      case 'list_notebooks':
        return this.callBridge('/notebooks');

      case 'read_notebook':
        return this.callBridge(`/notebook/read?uri=${encodeURIComponent(args.uri || '')}`);

      case 'open_notebook':
        return this.callBridge('/notebook/open', 'POST', {
          path: args.path,
          create: args.create || false,
        });

      case 'save_notebook':
        return this.callBridge('/notebook/save', 'POST', { uri: args.uri });

      // ===== Cell Operations =====
      case 'insert_cell':
        return this.callBridge('/cell/insert', 'POST', {
          index: args.index || -1,
          type: args.type || 'code',
          source: args.source,
        });

      case 'delete_cell':
        return this.callBridge('/cell/delete', 'POST', { index: args.index });

      case 'overwrite_cell':
        return this.callBridge('/cell/overwrite', 'POST', {
          index: args.index,
          source: args.source,
        });

      // ===== Execution =====
      case 'execute_cell':
        return this.callBridge('/cell/execute', 'POST', {
          index: args.index,
          timeout: args.timeout || 60,
        });

      case 'insert_and_execute_cell':
        return this.callBridge('/cell/insert-execute', 'POST', {
          position: args.position,
          source: args.source,
        });

      case 'execute_all_cells':
        return this.callBridge('/notebook/execute-all', 'POST', {});

      case 'restart_kernel':
        return this.callBridge('/kernel/restart', 'POST', {});

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async start(): Promise<void> {
    await this.server.connect(this.transport);
    console.error('VS Code Notebook MCP Server started (with VS Code API Bridge)');
  }

  async stop(): Promise<void> {
    await this.transport.close();
    console.error('VS Code Notebook MCP Server stopped');
  }
}

// Main entry point for standalone execution
const isMainModule = require.main === module;
if (isMainModule) {
  const server = new VSCodeNotebookMCPServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default VSCodeNotebookMCPServer;

