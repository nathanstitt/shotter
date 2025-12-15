import { z } from "zod";

// Device management tool schemas
export const listDevicesSchema = z.object({
  filter: z.string().optional().describe("Filter devices by name (case-insensitive partial match)"),
});

export const selectDeviceSchema = z.object({
  device: z.string().describe("Device name or pattern to match (e.g., 'iPhone 16 Pro', 'iPad')"),
});

export const launchAppSchema = z.object({
  bundle_id: z.string().describe("App bundle identifier (e.g., com.apple.Preferences)"),
  terminate_running: z.boolean().optional().describe("Kill existing instance before launch (default: false)"),
});

// UI interaction tool schemas (proxied to ios-simulator-mcp)
export const uiTapSchema = z.object({
  x: z.number().describe("X coordinate to tap"),
  y: z.number().describe("Y coordinate to tap"),
  duration: z.string().optional().describe("Press duration in seconds (e.g., '0.5' for long press)"),
});

export const uiSwipeSchema = z.object({
  x_start: z.number().describe("Starting X coordinate"),
  y_start: z.number().describe("Starting Y coordinate"),
  x_end: z.number().describe("Ending X coordinate"),
  y_end: z.number().describe("Ending Y coordinate"),
  duration: z.string().optional().describe("Swipe duration in seconds (default: 0.5)"),
});

export const uiTypeSchema = z.object({
  text: z.string().describe("Text to type (ASCII printable characters only)"),
});

export const screenshotSchema = z.object({
  output_path: z.string().describe("File path to save the screenshot"),
  type: z.enum(["png", "jpeg", "tiff", "bmp", "gif"]).optional().describe("Image format (default: png)"),
});

// Workflow tool schemas
export const loadWorkflowSchema = z.object({
  workflow_path: z.string().describe("Path to the workflow YAML file"),
});

export const listWorkflowsSchema = z.object({
  directory: z.string().optional().describe("Directory to search for workflow files (default: ./workflows)"),
});

// Tool descriptions for registration
export const toolDefinitions = {
  // Device management
  list_devices: {
    description: "List available iOS simulator devices. Returns device names, UDIDs, states, and iOS versions.",
    schema: listDevicesSchema,
  },
  select_device: {
    description: "Boot an iOS simulator and set it as the active device for subsequent UI commands. Uses fuzzy matching for device names.",
    schema: selectDeviceSchema,
  },
  launch_app: {
    description: "Launch an app by its bundle identifier on the active device. Must call select_device first.",
    schema: launchAppSchema,
  },

  // UI interaction (proxied)
  ui_view: {
    description: "Capture a screenshot of the current simulator screen for visual analysis. Returns an image. Must have an active device.",
    schema: z.object({}),
  },
  ui_describe_all: {
    description: "Get accessibility information for all visible UI elements. Returns element labels, types, and coordinates for precise tapping.",
    schema: z.object({}),
  },
  ui_tap: {
    description: "Tap on the screen at specific coordinates. Use ui_view first to see the screen, then tap buttons or interactive elements.",
    schema: uiTapSchema,
  },
  ui_swipe: {
    description: "Perform a swipe gesture. For scrolling: swipe up (y_start > y_end) to scroll down, swipe down (y_start < y_end) to scroll up.",
    schema: uiSwipeSchema,
  },
  ui_type: {
    description: "Type text into the focused field. The text field must already be focused via ui_tap first.",
    schema: uiTypeSchema,
  },
  screenshot: {
    description: "Save a high-quality screenshot to a file. Use this when you need to save a screenshot for the user.",
    schema: screenshotSchema,
  },

  // Workflow
  load_workflow: {
    description: "Load and parse a workflow YAML file. Returns the workflow configuration including steps, devices, and bundle ID.",
    schema: loadWorkflowSchema,
  },
  list_workflows: {
    description: "List available workflow YAML files in a directory.",
    schema: listWorkflowsSchema,
  },
} as const;
