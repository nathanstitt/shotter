# Shotter

iOS Simulator automation tool that uses Claude AI with vision to navigate apps and take screenshots across multiple devices.

## Project Structure

```
src/
├── index.ts              # CLI entry point, loads .env
├── types/                # TypeScript interfaces
│   ├── workflow.ts       # YAML schema types (WorkflowConfig, WorkflowStep, DeviceResult)
│   └── mcp.ts            # MCP tool input/output types
├── mcp/                  # Model Context Protocol integration
│   ├── client.ts         # Spawns ios-simulator-mcp subprocess
│   └── tools.ts          # Tool definitions passed to Claude API
├── agent/                # Claude AI agent
│   ├── executor.ts       # Agentic loop (vision → action → verify)
│   └── prompts.ts        # System and step prompts
├── workflow/             # Workflow orchestration
│   ├── parser.ts         # YAML parsing and validation
│   └── runner.ts         # Loops through devices, executes steps
└── utils/
    └── simulator.ts      # Simulator device management (boot, find, shutdown)
```

## YAML Workflow Format

```yaml
name: "My Workflow"
description: "Optional description"

bundleId: "com.example.myapp"    # App to launch on each device

devices:                          # List of simulator devices
  - "iPhone 16 Pro"
  - "iPad Pro 13-inch (M4)"

runBefore: "cd ~/code/myapp && npm run setup"  # Optional: runs with $DEVICE and $DEVICE_UDID env vars

maxIterations: 20                 # Max Claude iterations per step
outputDir: "./screenshots"        # Base output directory

steps:
  - goal: "Navigate to settings"
    hints:
      - "Look for a gear icon"
    screenshot: "settings.png"
```

Screenshots are saved per-device: `./screenshots/iphone-16-pro/settings.png`

Environment variables from `.env` can be used in YAML with `${VAR_NAME}` syntax:
```yaml
hints:
  - "Enter email: ${TEST_USER_EMAIL}"
  - "Enter password: ${TEST_USER_PASSWORD}"
```

## Key Concepts

- **Multi-device**: Loops through each device, booting simulator and launching app
- **Agentic loop**: Claude calls `ui_view` to see the screen, decides on an action (tap/swipe/type), executes it via MCP, then verifies the result
- **Skip existing**: If screenshots already exist for a device, those steps are skipped
- **MCP tools**: Defined in `src/mcp/tools.ts`, forwarded to ios-simulator-mcp with device udid
- **Virtual tool**: `step_complete` signals goal achievement (handled in executor, not MCP)

## Commands

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm start <yaml> # Run a workflow
```

## Environment

Requires `ANTHROPIC_API_KEY` in `.env` or environment.

## Dependencies

- `@anthropic-ai/sdk` - Claude API client
- `@modelcontextprotocol/sdk` - MCP client for spawning ios-simulator-mcp
- `yaml` - YAML parsing
- `dotenv` - Environment variable loading
