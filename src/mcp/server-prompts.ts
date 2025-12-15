import { z } from "zod";

// Prompt schemas
export const workflowStepSchema = z.object({
  goal: z.string().describe("The goal to achieve in this step"),
  hints: z.array(z.string()).optional().describe("Optional hints to help achieve the goal"),
});

// Prompt definitions
export const promptDefinitions = {
  navigate: {
    description: "System prompt with iOS Simulator navigation strategies. Use this to understand how to navigate the simulator effectively.",
    schema: z.object({}),
  },
  "workflow-step": {
    description: "Format a workflow step with goal and hints for execution. Use after loading a workflow to get guidance on each step.",
    schema: workflowStepSchema,
  },
} as const;

// Prompt content generators
export function getNavigatePrompt(): string {
  return `# iOS Simulator Navigation Guide

You are navigating an iOS Simulator. Use the available tools to achieve navigation goals by analyzing the screen and performing UI actions.

## Available Tools
- **ui_view**: Capture a screenshot to see the current screen state
- **ui_describe_all**: Get accessibility information with exact coordinates for UI elements
- **ui_tap**: Tap at specific coordinates (x, y)
- **ui_swipe**: Swipe gesture for scrolling or navigation
- **ui_type**: Type text (field must be focused first via tap)
- **screenshot**: Save a high-quality screenshot to a file

## Navigation Strategy
1. First, use **ui_view** to see the current screen
2. Analyze the image to understand what's visible
3. If you need precise coordinates, use **ui_describe_all** for accessibility info
4. Perform the necessary action (tap, swipe, type)
5. Use **ui_view** again to verify the action succeeded
6. Repeat until the goal is achieved

## Important Tips
- **Always verify**: Check the screen after each action to confirm it worked
- **Use accessibility info**: When visual estimation isn't precise enough, ui_describe_all gives exact coordinates
- **Scroll when needed**: If an element isn't visible, use ui_swipe to scroll (swipe up to scroll down)
- **Be precise**: Aim for the center of buttons and elements
- **Try alternatives**: If an action doesn't work, try a different approach

## Screen Coordinate System
- Origin (0,0) is at the **top-left** corner
- X increases to the **right**
- Y increases **downward**
- Common iPhone sizes: 390x844 (iPhone 14), 393x852 (iPhone 14 Pro), 430x932 (iPhone 14 Pro Max)
- Common iPad sizes vary by model`;
}

export function getWorkflowStepPrompt(goal: string, hints?: string[]): string {
  let prompt = `# Current Navigation Goal

**Goal**: ${goal}
`;

  if (hints && hints.length > 0) {
    prompt += `
## Hints
${hints.map((h) => `- ${h}`).join("\n")}
`;
  }

  prompt += `
## Instructions
1. Use **ui_view** to see the current screen state
2. Work toward achieving the goal above
3. Verify each action succeeded before proceeding
4. When the goal is complete, inform the user`;

  return prompt;
}
