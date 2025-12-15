#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { SimulatorMCPClient } from "./mcp/client.js";
import {
  listDevices,
  findDevice,
  bootDevice,
  openSimulatorApp,
} from "./utils/simulator.js";
import { parseWorkflow } from "./workflow/parser.js";
import { getNavigatePrompt, getWorkflowStepPrompt } from "./mcp/server-prompts.js";

// Server state
let activeDeviceUdid: string | null = null;
let mcpClient: SimulatorMCPClient | null = null;

// Initialize MCP client for proxying to ios-simulator-mcp
async function ensureMCPClient(): Promise<SimulatorMCPClient> {
  if (!mcpClient) {
    mcpClient = new SimulatorMCPClient();
    await mcpClient.connect();
  }
  return mcpClient;
}

// Helper to create text content response
function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// Helper to call ios-simulator-mcp tool
async function callSimulatorTool(name: string, args: Record<string, unknown>) {
  if (!activeDeviceUdid) {
    return textResult("Error: No device selected. Use select_device first.");
  }

  const client = await ensureMCPClient();
  const argsWithUdid = { ...args, udid: activeDeviceUdid };

  try {
    const result = await client.callTool(name, argsWithUdid);
    const content = result.content.map((item) => {
      if (item.type === "image" && item.data && item.mimeType) {
        return { type: "image" as const, data: item.data, mimeType: item.mimeType };
      }
      return { type: "text" as const, text: item.text || "" };
    });
    return { content };
  } catch (error) {
    return textResult(`Error calling ${name}: ${error}`);
  }
}

// Tool definitions
const tools = [
  {
    name: "list_devices",
    description: "List available iOS simulator devices. Returns device names, UDIDs, states, and iOS versions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Filter devices by name (case-insensitive partial match)" },
      },
    },
  },
  {
    name: "select_device",
    description: "Boot an iOS simulator and set it as the active device. Uses fuzzy matching for device names.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device: { type: "string", description: "Device name or pattern (e.g., 'iPhone 16 Pro', 'iPad')" },
      },
      required: ["device"],
    },
  },
  {
    name: "launch_app",
    description: "Launch an app by bundle ID on the active device. Must call select_device first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundle_id: { type: "string", description: "App bundle identifier (e.g., com.apple.Preferences)" },
        terminate_running: { type: "boolean", description: "Kill existing instance before launch" },
      },
      required: ["bundle_id"],
    },
  },
  {
    name: "ui_view",
    description: "Capture a screenshot for visual analysis. Must have an active device.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "ui_describe_all",
    description: "Get accessibility information for visible UI elements with coordinates.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "ui_tap",
    description: "Tap on the screen at specific coordinates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        x: { type: "number", description: "X coordinate to tap" },
        y: { type: "number", description: "Y coordinate to tap" },
        duration: { type: "string", description: "Press duration in seconds (e.g., '0.5' for long press)" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "ui_swipe",
    description: "Swipe gesture. For scrolling: swipe up (y_start > y_end) to scroll down.",
    inputSchema: {
      type: "object" as const,
      properties: {
        x_start: { type: "number", description: "Starting X coordinate" },
        y_start: { type: "number", description: "Starting Y coordinate" },
        x_end: { type: "number", description: "Ending X coordinate" },
        y_end: { type: "number", description: "Ending Y coordinate" },
        duration: { type: "string", description: "Swipe duration in seconds" },
      },
      required: ["x_start", "y_start", "x_end", "y_end"],
    },
  },
  {
    name: "ui_type",
    description: "Type text into the focused field. Must tap to focus first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text to type" },
      },
      required: ["text"],
    },
  },
  {
    name: "screenshot",
    description: "Save a high-quality screenshot to a file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        output_path: { type: "string", description: "File path to save the screenshot" },
        type: { type: "string", enum: ["png", "jpeg", "tiff", "bmp", "gif"], description: "Image format" },
      },
      required: ["output_path"],
    },
  },
  {
    name: "load_workflow",
    description: "Load and parse a workflow YAML file. Returns steps, devices, and configuration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflow_path: { type: "string", description: "Path to the workflow YAML file" },
      },
      required: ["workflow_path"],
    },
  },
  {
    name: "list_workflows",
    description: "List available workflow YAML files in a directory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        directory: { type: "string", description: "Directory to search (default: ./workflows)" },
      },
    },
  },
];

// Prompt definitions
const prompts = [
  {
    name: "navigate",
    description: "System prompt with iOS Simulator navigation strategies.",
    arguments: [],
  },
  {
    name: "workflow-step",
    description: "Format a workflow step with goal and hints for execution.",
    arguments: [
      { name: "goal", description: "The goal to achieve", required: true },
      { name: "hints", description: "Optional hints (comma-separated)", required: false },
    ],
  },
];

// Create server
const server = new Server(
  { name: "shotter", version: "1.0.0" },
  { capabilities: { tools: {}, prompts: {} } }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "list_devices": {
      const devices = listDevices();
      const filter = (args.filter as string)?.toLowerCase();
      const filtered = filter
        ? devices.filter((d) => d.name.toLowerCase().includes(filter))
        : devices;

      if (filtered.length === 0) {
        return textResult(filter
          ? `No devices found matching "${args.filter}"`
          : "No iOS simulators found."
        );
      }

      const deviceList = filtered
        .map((d) => `- ${d.name} (${d.runtime}) [${d.state}]\n  UDID: ${d.udid}`)
        .join("\n");
      return textResult(`Available iOS Simulators:\n${deviceList}`);
    }

    case "select_device": {
      const device = findDevice(args.device as string);
      if (!device) {
        const devices = listDevices();
        const names = devices.map((d) => d.name).join(", ");
        return textResult(`Device not found: "${args.device}"\nAvailable: ${names}`);
      }

      bootDevice(device.udid);
      openSimulatorApp();
      activeDeviceUdid = device.udid;
      await ensureMCPClient();

      return textResult(`Selected and booted: ${device.name} (${device.runtime})\nUDID: ${device.udid}`);
    }

    case "launch_app":
      return callSimulatorTool("launch_app", {
        bundle_id: args.bundle_id,
        terminate_running: args.terminate_running,
      });

    case "ui_view":
      return callSimulatorTool("ui_view", {});

    case "ui_describe_all":
      return callSimulatorTool("ui_describe_all", {});

    case "ui_tap":
      return callSimulatorTool("ui_tap", { x: args.x, y: args.y, duration: args.duration });

    case "ui_swipe":
      return callSimulatorTool("ui_swipe", {
        x_start: args.x_start,
        y_start: args.y_start,
        x_end: args.x_end,
        y_end: args.y_end,
        duration: args.duration,
      });

    case "ui_type":
      return callSimulatorTool("ui_type", { text: args.text });

    case "screenshot":
      return callSimulatorTool("screenshot", {
        output_path: args.output_path,
        type: args.type,
      });

    case "load_workflow": {
      try {
        const resolvedPath = path.resolve(args.workflow_path as string);
        const config = parseWorkflow(resolvedPath);

        const stepsDescription = config.steps
          .map((s, i) => `${i + 1}. ${s.goal}${s.screenshot ? ` -> ${s.screenshot}` : ""}`)
          .join("\n");

        return textResult(`Workflow: ${config.name}
${config.description ? `Description: ${config.description}\n` : ""}
Bundle ID: ${config.bundleId}
Devices: ${config.devices.join(", ")}
Output Directory: ${config.outputDir}

Steps:
${stepsDescription}`);
      } catch (error) {
        return textResult(`Error loading workflow: ${error}`);
      }
    }

    case "list_workflows": {
      const dir = (args.directory as string) || "./workflows";
      const resolvedDir = path.resolve(dir);

      if (!fs.existsSync(resolvedDir)) {
        return textResult(`Directory not found: ${resolvedDir}`);
      }

      const files = fs.readdirSync(resolvedDir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

      if (files.length === 0) {
        return textResult(`No workflow files found in ${resolvedDir}`);
      }

      const workflows: string[] = [];
      for (const file of files) {
        try {
          const config = parseWorkflow(path.join(resolvedDir, file));
          workflows.push(`- ${file}: ${config.name} (${config.devices.length} device(s), ${config.steps.length} step(s))`);
        } catch {
          workflows.push(`- ${file}: (parse error)`);
        }
      }

      return textResult(`Workflows in ${dir}:\n${workflows.join("\n")}`);
    }

    default:
      return textResult(`Unknown tool: ${name}`);
  }
});

// List prompts handler
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts };
});

// Get prompt handler
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "navigate":
      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: getNavigatePrompt() } },
        ],
      };

    case "workflow-step": {
      const goal = args.goal as string;
      const hintsStr = args.hints as string | undefined;
      const hints = hintsStr ? hintsStr.split(",").map((h) => h.trim()) : undefined;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: getWorkflowStepPrompt(goal, hints) } },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
