#!/usr/bin/env node
import "dotenv/config";
import { parseWorkflow } from "./workflow/parser.js";
import { WorkflowRunner } from "./workflow/runner.js";
import path from "path";

async function main() {
  const workflowPath = process.argv[2];

  if (!workflowPath) {
    console.error("Usage: npx shotter <workflow.yaml>");
    console.error("\nExample:");
    console.error("  npx shotter workflows/jobtime.yaml");
    process.exit(1);
  }

  const resolvedPath = path.resolve(workflowPath);

  try {
    console.log(`Loading workflow: ${resolvedPath}`);
    const config = parseWorkflow(resolvedPath);

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Workflow: ${config.name}`);
    if (config.description) {
      console.log(`Description: ${config.description}`);
    }
    console.log(`Bundle ID: ${config.bundleId}`);
    console.log(`Devices: ${config.devices.join(", ")}`);
    console.log(`Steps: ${config.steps.length}`);
    console.log(`Max iterations per step: ${config.maxIterations}`);
    console.log(`Output directory: ${config.outputDir}`);
    console.log("=".repeat(50));

    const runner = new WorkflowRunner(config);
    const result = await runner.run();

    // Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log(`WORKFLOW ${result.success ? "COMPLETED" : "FAILED"}`);
    console.log(`Total time: ${(result.totalDuration / 1000).toFixed(1)}s`);
    console.log("=".repeat(50));

    // Per-device summary
    console.log("\nResults by device:");
    for (const deviceResult of result.devices) {
      const successCount = deviceResult.steps.filter((s) => s.success).length;
      const totalSteps = config.steps.length;
      const status = deviceResult.success ? "✓" : "✗";
      console.log(
        `  ${status} ${deviceResult.device}: ${successCount}/${totalSteps} steps (${(deviceResult.duration / 1000).toFixed(1)}s)`
      );

      // List screenshots for this device
      const screenshots = deviceResult.steps
        .filter((s) => s.screenshotPath)
        .map((s) => s.screenshotPath);
      for (const screenshot of screenshots) {
        console.log(`      📸 ${screenshot}`);
      }
    }

    if (!result.success) {
      // Show first failure
      for (const deviceResult of result.devices) {
        if (!deviceResult.success) {
          const failedStep = deviceResult.steps.find((s) => !s.success);
          if (failedStep) {
            console.error(`\nFirst failure on ${deviceResult.device}:`);
            console.error(`  Step: ${failedStep.step.goal}`);
            console.error(`  Error: ${failedStep.error}`);
            break;
          }
        }
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
