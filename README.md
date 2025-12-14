# Shotter

iOS Simulator automation tool that uses Claude AI with vision to navigate apps and capture screenshots across multiple devices.

## Features

- **Multi-device support**: Run workflows on iPhone, iPad, or any iOS Simulator device
- **AI-powered navigation**: Claude analyzes screenshots to find and interact with UI elements
- **Environment variable expansion**: Use `.env` values in workflow hints for credentials
- **Pre-step scripts**: Run custom scripts before workflow steps (e.g., build and deploy your app)
- **Skip existing**: Automatically skips steps if screenshots already exist

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=your-api-key-here

# Optional: credentials for app login
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=your-password
```

## Usage

```bash
npm start <workflow.yaml>
```

## Workflow Format

```yaml
name: "My App Screenshots"
description: "Capture key screens from my app"

bundleId: "com.example.myapp"

devices:
  - "iPhone Pro"
  - "iPad"

# Optional: script to run before steps (receives $DEVICE and $DEVICE_UDID env vars)
# Script runs until it outputs "Opening.*{bundleId}", then workflow continues
runBefore: "cd ~/code/myapp && ./scripts/run-on-simulator"

maxIterations: 20
outputDir: "./screenshots"

steps:
  - goal: "Login if needed"
    hints:
      - "If already logged in, this step is complete"
      - "Enter email: ${TEST_USER_EMAIL}"
      - "Enter password: ${TEST_USER_PASSWORD}"

  - goal: "Navigate to settings"
    hints:
      - "Look for a gear icon or Settings tab"
    screenshot: "settings.png"

  - goal: "Open the profile screen"
    screenshot: "profile.png"
```

## YAML Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Workflow name |
| `description` | No | Workflow description |
| `bundleId` | Yes | App bundle identifier |
| `devices` | Yes | List of simulator device names (fuzzy matched) |
| `runBefore` | No | Script to run before steps for each device |
| `maxIterations` | No | Max Claude iterations per step (default: 20) |
| `outputDir` | No | Screenshot output directory (default: ./screenshots) |
| `steps` | Yes | List of navigation steps |

### Step Fields

| Field | Required | Description |
|-------|----------|-------------|
| `goal` | Yes | What to accomplish in this step |
| `hints` | No | List of hints to help Claude navigate |
| `screenshot` | No | Filename to save screenshot after step completes |

## Environment Variables

Use `${VAR_NAME}` syntax in YAML to reference `.env` values:

```yaml
hints:
  - "Enter email: ${TEST_USER_EMAIL}"
```

## Output Structure

Screenshots are organized by device:

```
screenshots/
├── iphone-pro/
│   ├── settings.png
│   └── profile.png
└── ipad/
    ├── settings.png
    └── profile.png
```

## Requirements

- macOS with Xcode installed
- iOS Simulator
- Node.js 18+
- [Facebook IDB](https://fbidb.io/) (`brew install idb-companion`)
- Anthropic API key

## How It Works

1. For each device in the workflow:
   - Boots the iOS Simulator with that device
   - Runs the optional `runBefore` script (waits for ready signal)
   - Launches the app via bundle ID
   - Executes each step using Claude's vision to navigate
   - Captures screenshots where specified
   - Sends SIGINT to stop the `runBefore` script

2. Claude uses these MCP tools to interact with the simulator:
   - `ui_view` - Capture screenshot for analysis
   - `ui_tap` - Tap at coordinates
   - `ui_swipe` - Swipe gestures
   - `ui_type` - Enter text
   - `ui_describe_all` - Get accessibility info

## License

ISC
