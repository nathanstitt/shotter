import Anthropic from "@anthropic-ai/sdk";

export const simulatorTools: Anthropic.Tool[] = [
  {
    name: "ui_tap",
    description:
      "Tap on the screen at specific coordinates in the iOS Simulator. Use this to tap buttons, icons, or any interactive element.",
    input_schema: {
      type: "object" as const,
      properties: {
        x: { type: "number", description: "X coordinate to tap" },
        y: { type: "number", description: "Y coordinate to tap" },
        duration: {
          type: "string",
          description: "Optional press duration in seconds (e.g., '0.5' for long press)",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "ui_swipe",
    description:
      "Perform a swipe gesture on the iOS Simulator screen. Use this to scroll content or perform swipe actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        x_start: { type: "number", description: "Starting X coordinate" },
        y_start: { type: "number", description: "Starting Y coordinate" },
        x_end: { type: "number", description: "Ending X coordinate" },
        y_end: { type: "number", description: "Ending Y coordinate" },
        duration: {
          type: "string",
          description: "Swipe duration in seconds (default: 0.5)",
        },
      },
      required: ["x_start", "y_start", "x_end", "y_end"],
    },
  },
  {
    name: "ui_type",
    description:
      "Type text into the iOS Simulator. The text field must already be focused. Only supports ASCII printable characters.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "Text to type (ASCII printable characters only)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "ui_describe_all",
    description:
      "Get accessibility information for all UI elements currently visible on screen. Returns element labels, types, and coordinates. Useful for finding exact tap coordinates.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "ui_view",
    description:
      "Capture a compressed screenshot of the current simulator screen for visual analysis. Use this to see what's on screen and verify actions succeeded.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "screenshot",
    description:
      "Save a high-quality screenshot to a file. Use this when you need to save a screenshot for the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        output_path: {
          type: "string",
          description: "File path to save the screenshot",
        },
        type: {
          type: "string",
          enum: ["png", "jpeg", "tiff", "bmp", "gif"],
          description: "Image format (default: png)",
        },
      },
      required: ["output_path"],
    },
  },
  {
    name: "open_simulator",
    description:
      "Open the iOS Simulator application. Use this if the simulator is not already running.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "launch_app",
    description: "Launch an app by its bundle identifier.",
    input_schema: {
      type: "object" as const,
      properties: {
        bundle_id: {
          type: "string",
          description:
            "App bundle identifier (e.g., com.apple.Preferences, com.apple.mobilesafari)",
        },
        terminate_running: {
          type: "boolean",
          description: "Kill existing instance before launch (default: false)",
        },
      },
      required: ["bundle_id"],
    },
  },
  {
    name: "step_complete",
    description:
      "Signal that the current navigation step goal has been achieved. Call this when you have successfully completed the goal, or when you determine the goal cannot be achieved.",
    input_schema: {
      type: "object" as const,
      properties: {
        success: {
          type: "boolean",
          description: "Whether the goal was successfully achieved",
        },
        summary: {
          type: "string",
          description: "Brief description of what was accomplished or why it failed",
        },
      },
      required: ["success", "summary"],
    },
  },
];
