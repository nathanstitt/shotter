import Anthropic from "@anthropic-ai/sdk";
import { SimulatorMCPClient } from "../mcp/client.js";
import { simulatorTools } from "../mcp/tools.js";
import { buildSystemPrompt, buildStepPrompt } from "./prompts.js";
import { ToolExecutionResult, MCPToolResult } from "../types/mcp.js";
import { WorkflowStep, StepResult } from "../types/workflow.js";
import path from "path";

interface AgentState {
  currentGoal: string;
  hints: string[];
  iterationCount: number;
  maxIterations: number;
  conversationHistory: Anthropic.MessageParam[];
  completed: boolean;
  success: boolean;
  error?: string;
}

export class AgentExecutor {
  private anthropic: Anthropic;
  private mcpClient: SimulatorMCPClient;
  private outputDir: string;
  private udid: string | undefined;

  constructor(outputDir: string = "./screenshots") {
    this.anthropic = new Anthropic();
    this.mcpClient = new SimulatorMCPClient();
    this.outputDir = outputDir;
  }

  async initialize(): Promise<void> {
    await this.mcpClient.connect();
  }

  setUdid(udid: string): void {
    this.udid = udid;
  }

  setOutputDir(outputDir: string): void {
    this.outputDir = outputDir;
  }

  async launchApp(bundleId: string): Promise<boolean> {
    try {
      const args: Record<string, unknown> = {
        bundle_id: bundleId,
        terminate_running: true,
      };
      if (this.udid) {
        args.udid = this.udid;
      }
      const result = await this.mcpClient.callTool("launch_app", args);
      return !result.isError;
    } catch (error) {
      console.error(`Failed to launch app: ${error}`);
      return false;
    }
  }

  async executeStep(
    step: WorkflowStep,
    maxIterations: number
  ): Promise<StepResult> {
    const state: AgentState = {
      currentGoal: step.goal,
      hints: step.hints || [],
      iterationCount: 0,
      maxIterations,
      conversationHistory: [],
      completed: false,
      success: false,
    };

    const toolsUsed: string[] = [];

    state.conversationHistory.push({
      role: "user",
      content: buildStepPrompt(step.goal, step.hints || []),
    });

    while (!state.completed && state.iterationCount < maxIterations) {
      state.iterationCount++;
      console.log(`    Iteration ${state.iterationCount}/${maxIterations}`);

      try {
        const response = await this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: buildSystemPrompt(),
          messages: state.conversationHistory,
          tools: simulatorTools,
        });

        state.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });

        if (response.stop_reason === "end_turn") {
          state.conversationHistory.push({
            role: "user",
            content:
              "Please continue working toward the goal. Use ui_view to check the current state, or call step_complete if you're done.",
          });
          continue;
        }

        if (response.stop_reason === "tool_use") {
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type === "tool_use") {
              console.log(`      Tool: ${block.name}`);
              toolsUsed.push(block.name);

              if (block.name === "step_complete") {
                const input = block.input as {
                  success: boolean;
                  summary: string;
                };
                state.completed = true;
                state.success = input.success;
                if (!input.success) {
                  state.error = input.summary;
                }
                console.log(
                  `      ${input.success ? "✓" : "✗"} ${input.summary}`
                );
                break;
              }

              const result = await this.executeTool(
                block.name,
                block.input as Record<string, unknown>
              );
              toolResults.push(this.buildToolResult(block.id, result));
            }
          }

          if (!state.completed && toolResults.length > 0) {
            state.conversationHistory.push({
              role: "user",
              content: toolResults,
            });
          }
        }
      } catch (error) {
        console.error(`      Error: ${error}`);
        state.error = String(error);
        break;
      }
    }

    if (!state.completed) {
      state.error = state.error || "Max iterations reached without completing goal";
    }

    let screenshotPath: string | undefined;
    if (step.screenshot && state.success) {
      // Use absolute path for ios-simulator-mcp
      screenshotPath = path.resolve(this.outputDir, step.screenshot);
      try {
        const screenshotArgs: Record<string, unknown> = {
          output_path: screenshotPath,
          type: "png",
        };
        if (this.udid) {
          screenshotArgs.udid = this.udid;
        }
        const result = await this.mcpClient.callTool("screenshot", screenshotArgs);
        if (result.isError) {
          console.error(`      Failed to save screenshot: ${JSON.stringify(result.content)}`);
        } else {
          console.log(`      📸 Saved: ${screenshotPath}`);
        }
      } catch (error) {
        console.error(`      Failed to save screenshot: ${error}`);
      }
    }

    return {
      step,
      success: state.success,
      screenshotPath,
      error: state.error,
      iterations: state.iterationCount,
      toolsUsed: [...new Set(toolsUsed)],
    };
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    if (name === "step_complete") {
      return {
        toolName: name,
        input,
        output: {
          content: [{ type: "text", text: "Step completion acknowledged" }],
        },
        success: true,
      };
    }

    // Inject udid into MCP tool calls if set
    const toolInput = { ...input };
    if (this.udid && !toolInput.udid) {
      toolInput.udid = this.udid;
    }

    try {
      const output = await this.mcpClient.callTool(name, toolInput);
      return { toolName: name, input: toolInput, output, success: !output.isError };
    } catch (error) {
      return {
        toolName: name,
        input: toolInput,
        output: {
          content: [{ type: "text", text: String(error) }],
          isError: true,
        },
        success: false,
      };
    }
  }

  private buildToolResult(
    toolUseId: string,
    result: ToolExecutionResult
  ): Anthropic.ToolResultBlockParam {
    const content: Array<
      Anthropic.TextBlockParam | Anthropic.ImageBlockParam
    > = [];

    for (const item of result.output.content) {
      if (item.type === "text" && item.text) {
        content.push({ type: "text", text: item.text });
      } else if (item.type === "image" && item.data) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type:
              (item.mimeType as
                | "image/png"
                | "image/jpeg"
                | "image/gif"
                | "image/webp") || "image/png",
            data: item.data,
          },
        });
      }
    }

    return {
      type: "tool_result",
      tool_use_id: toolUseId,
      content:
        content.length > 0
          ? content
          : [{ type: "text", text: "Tool executed successfully" }],
      is_error: result.output.isError,
    };
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
  }
}
