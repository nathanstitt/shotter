export interface UiTapInput {
  x: number;
  y: number;
  duration?: string;
  udid?: string;
}

export interface UiSwipeInput {
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;
  duration?: string;
  delta?: number;
  udid?: string;
}

export interface UiTypeInput {
  text: string;
  udid?: string;
}

export interface UiDescribeAllInput {
  udid?: string;
}

export interface UiViewInput {
  udid?: string;
}

export interface ScreenshotInput {
  output_path: string;
  type?: "png" | "tiff" | "bmp" | "gif" | "jpeg";
  display?: "internal" | "external";
  mask?: "ignored" | "alpha" | "black";
  udid?: string;
}

export interface LaunchAppInput {
  bundle_id: string;
  terminate_running?: boolean;
  udid?: string;
}

export interface MCPToolResult {
  content: Array<{
    type: "text" | "image";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface ToolExecutionResult {
  toolName: string;
  input: Record<string, unknown>;
  output: MCPToolResult;
  success: boolean;
}
