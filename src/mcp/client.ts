import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPToolResult } from "../types/mcp.js";

export class SimulatorMCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;

  constructor() {
    this.client = new Client({
      name: "shotter-agent",
      version: "1.0.0",
    });
  }

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "ios-simulator-mcp"],
    });

    await this.client.connect(this.transport);
    this.connected = true;
    console.log("Connected to ios-simulator-mcp");
  }

  async listTools(): Promise<
    Array<{ name: string; description?: string; inputSchema: unknown }>
  > {
    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const result = await this.client.callTool({ name, arguments: args });
    return result as unknown as MCPToolResult;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      console.log("Disconnected from ios-simulator-mcp");
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
