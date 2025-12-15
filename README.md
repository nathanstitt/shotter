# Shotter

MCP (Model Context Protocol) server for iOS Simulator automation. Provides tools for AI assistants to navigate iOS apps, interact with UI elements, and capture screenshots.

## Features

- **MCP Integration**: Works with Claude Desktop, Claude Code, and other MCP-compatible clients
- **Device Management**: List, select, and boot iOS Simulator devices
- **UI Automation**: Tap, swipe, type, and navigate iOS apps
- **Screenshot Capture**: Visual analysis and high-quality screenshot saving
- **Workflow Support**: Load and execute YAML-defined navigation workflows

## Installation

```bash
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "shotter": {
      "command": "node",
      "args": ["/path/to/shotter/dist/server.js"]
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json` or global settings:

```json
{
  "mcpServers": {
    "shotter": {
      "command": "node",
      "args": ["/path/to/shotter/dist/server.js"]
    }
  }
}
```

## Available Tools

### Device Management

| Tool | Description |
|------|-------------|
| `list_devices` | List available iOS simulators with names, UDIDs, and states |
| `select_device` | Boot a simulator and set it as active (fuzzy name matching) |
| `launch_app` | Launch an app by bundle ID on the active device |

### UI Interaction

| Tool | Description |
|------|-------------|
| `ui_view` | Capture screenshot for visual analysis |
| `ui_describe_all` | Get accessibility info with coordinates for all UI elements |
| `ui_tap` | Tap at specific coordinates |
| `ui_swipe` | Swipe gesture (for scrolling and navigation) |
| `ui_type` | Type text into focused field |
| `screenshot` | Save high-quality screenshot to a file |

### Workflow

| Tool | Description |
|------|-------------|
| `load_workflow` | Load and parse a workflow YAML file |
| `list_workflows` | List available workflow files in a directory |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `navigate` | System prompt with iOS Simulator navigation strategies |
| `workflow-step` | Format a workflow step with goal and hints for execution |

## Usage Examples

Once configured, ask your AI assistant to:

```
"Select iPhone 16 Pro and launch the Settings app"

"Take a screenshot of the current screen"

"Tap on the Wi-Fi option in Settings"

"Navigate to Privacy settings and take a screenshot"
```

## Workflow Format

Workflows define multi-step navigation sequences:

```yaml
name: "My App Screenshots"
description: "Capture key screens from my app"

bundleId: "com.example.myapp"

devices:
  - "iPhone 16 Pro"
  - "iPad Pro"

maxIterations: 20
outputDir: "./screenshots"

steps:
  - goal: "Navigate to settings"
    hints:
      - "Look for a gear icon or Settings tab"
    screenshot: "settings.png"

  - goal: "Open the profile screen"
    screenshot: "profile.png"
```

### YAML Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Workflow name |
| `description` | No | Workflow description |
| `bundleId` | Yes | App bundle identifier |
| `devices` | Yes | List of simulator device names (fuzzy matched) |
| `runBefore` | No | Script to run before steps for each device |
| `maxIterations` | No | Max iterations per step (default: 20) |
| `outputDir` | No | Screenshot output directory (default: ./screenshots) |
| `steps` | Yes | List of navigation steps |

### Step Fields

| Field | Required | Description |
|-------|----------|-------------|
| `goal` | Yes | What to accomplish |
| `hints` | No | Hints to help navigate |
| `screenshot` | No | Filename to save screenshot after step completes |

## Requirements

- macOS with Xcode installed
- iOS Simulator
- Node.js 18+
- [Facebook IDB](https://fbidb.io/) (`brew install idb-companion`)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Compile TypeScript
```

## How It Works

Shotter acts as an MCP server that:

1. Manages iOS Simulator device lifecycle (boot, select)
2. Proxies UI commands to `ios-simulator-mcp` for screen interaction
3. Provides navigation prompts optimized for AI assistants
4. Supports workflow files for repeatable multi-step automation

The AI assistant uses `ui_view` to see the screen, makes decisions about what to tap or type, and verifies actions succeeded before continuing.

## License

ISC
