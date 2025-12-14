import * as fs from "fs";
import * as yaml from "yaml";
import { WorkflowConfig, WorkflowStep } from "../types/workflow.js";

function expandEnvVars(content: string): string {
  // Replace ${VAR_NAME} with environment variable value
  return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = process.env[varName];
    if (value === undefined) {
      console.warn(`Warning: Environment variable ${varName} is not set`);
      return match;
    }
    return value;
  });
}

export function parseWorkflow(filePath: string): WorkflowConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workflow file not found: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, "utf-8");
  const content = expandEnvVars(rawContent);
  const parsed = yaml.parse(content);

  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Workflow must have a 'name' field");
  }

  if (!parsed.bundleId || typeof parsed.bundleId !== "string") {
    throw new Error("Workflow must have a 'bundleId' field");
  }

  if (!Array.isArray(parsed.devices) || parsed.devices.length === 0) {
    throw new Error("Workflow must have a 'devices' array with at least one device");
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Workflow must have at least one step");
  }

  for (let i = 0; i < parsed.steps.length; i++) {
    const step = parsed.steps[i];
    if (!step.goal || typeof step.goal !== "string") {
      throw new Error(`Step ${i + 1} must have a 'goal' field`);
    }

    if (step.hints && !Array.isArray(step.hints)) {
      throw new Error(`Step ${i + 1} 'hints' must be an array`);
    }

    if (step.screenshot && typeof step.screenshot !== "string") {
      throw new Error(`Step ${i + 1} screenshot must be a filename string`);
    }
  }

  return {
    name: parsed.name,
    description: parsed.description,
    bundleId: parsed.bundleId,
    devices: parsed.devices as string[],
    runBefore: parsed.runBefore,
    maxIterations: parsed.maxIterations ?? 20,
    stepTimeout: parsed.stepTimeout ?? 30000,
    outputDir: parsed.outputDir ?? "./screenshots",
    steps: parsed.steps as WorkflowStep[],
  };
}
