import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import { WorkflowConfig, WorkflowResult, StepResult, DeviceResult } from "../types/workflow.js";
import { AgentExecutor } from "../agent/executor.js";
import {
  findDevice,
  bootDevice,
  openSimulatorApp,
  shutdownDevice,
  SimulatorDevice,
} from "../utils/simulator.js";

export class WorkflowRunner {
  private config: WorkflowConfig;
  private executor: AgentExecutor;
  private runBeforeProcess: ChildProcess | null = null;

  constructor(config: WorkflowConfig) {
    this.config = config;
    this.executor = new AgentExecutor(config.outputDir);
  }

  private killRunBeforeProcess(): void {
    if (this.runBeforeProcess) {
      console.log("  Stopping runBefore process (SIGINT)...");
      this.runBeforeProcess.kill("SIGINT");
      this.runBeforeProcess = null;
    }
  }

  private async runBeforeScript(device: SimulatorDevice): Promise<boolean> {
    if (!this.config.runBefore) {
      return true;
    }

    console.log(`  Running: ${this.config.runBefore}`);
    console.log(`  DEVICE=${device.name}`);
    console.log(`  DEVICE_UDID=${device.udid}`);
    console.log(`  Waiting for: Opening.*${this.config.bundleId}`);
    console.log("  ---");

    return new Promise((resolve) => {
      const readyPattern = new RegExp(`Opening.*${this.config.bundleId.replace(/\./g, "\\.")}`);

      this.runBeforeProcess = spawn(this.config.runBefore!, {
        shell: "/bin/bash",
        env: {
          ...process.env,
          DEVICE: device.name,
          DEVICE_UDID: device.udid,
        },
      });

      let resolved = false;

      this.runBeforeProcess.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        process.stdout.write(text);

        if (!resolved && readyPattern.test(text)) {
          console.log("  --- runBefore ready signal detected");
          resolved = true;
          resolve(true);
        }
      });

      this.runBeforeProcess.stderr?.on("data", (data: Buffer) => {
        process.stderr.write(data.toString());
      });

      this.runBeforeProcess.on("error", (error) => {
        console.error(`  runBefore process error: ${error.message}`);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });

      this.runBeforeProcess.on("exit", (code) => {
        if (!resolved) {
          console.error(`  runBefore process exited with code ${code} before ready signal`);
          resolved = true;
          resolve(false);
        }
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!resolved) {
          console.error("  runBefore timed out waiting for ready signal");
          this.killRunBeforeProcess();
          resolved = true;
          resolve(false);
        }
      }, 5 * 60 * 1000);
    });
  }

  private getDeviceOutputDir(deviceName: string): string {
    // Sanitize device name for directory
    const safeName = deviceName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    return path.resolve(this.config.outputDir || "./screenshots", safeName);
  }

  private findStartIndex(outputDir: string): number {
    let startIndex = 0;

    for (let i = 0; i < this.config.steps.length; i++) {
      const step = this.config.steps[i];
      if (step.screenshot) {
        const screenshotPath = path.resolve(outputDir, step.screenshot);
        if (fs.existsSync(screenshotPath)) {
          startIndex = i + 1;
        } else {
          break;
        }
      }
    }

    return startIndex;
  }

  private async runForDevice(device: SimulatorDevice): Promise<DeviceResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    const deviceOutputDir = this.getDeviceOutputDir(device.name);

    fs.mkdirSync(deviceOutputDir, { recursive: true });

    // Configure executor for this device
    this.executor.setUdid(device.udid);
    this.executor.setOutputDir(deviceOutputDir);

    // Check for existing screenshots
    const startIndex = this.findStartIndex(deviceOutputDir);

    if (startIndex > 0) {
      console.log(`  Skipping ${startIndex} step(s) - screenshots already exist`);
      for (let i = 0; i < startIndex; i++) {
        const step = this.config.steps[i];
        stepResults.push({
          step,
          success: true,
          screenshotPath: step.screenshot
            ? path.resolve(deviceOutputDir, step.screenshot)
            : undefined,
          iterations: 0,
          toolsUsed: [],
        });
      }
    }

    if (startIndex >= this.config.steps.length) {
      console.log("  All screenshots already exist, skipping device");
      return {
        device: device.name,
        udid: device.udid,
        success: true,
        steps: stepResults,
        duration: Date.now() - startTime,
      };
    }

    // Boot the simulator
    console.log(`  Booting ${device.name} (${device.udid})...`);
    bootDevice(device.udid);
    openSimulatorApp();

    // Give simulator time to fully boot
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Launch the app
    console.log(`  Launching ${this.config.bundleId}...`);
    const launched = await this.executor.launchApp(this.config.bundleId);
    if (!launched) {
      console.error(`  Failed to launch app ${this.config.bundleId}`);
      return {
        device: device.name,
        udid: device.udid,
        success: false,
        steps: stepResults,
        duration: Date.now() - startTime,
      };
    }

    // Give app time to launch
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Run pre-step script if configured
    const scriptReady = await this.runBeforeScript(device);
    if (!scriptReady) {
      this.killRunBeforeProcess();
      return {
        device: device.name,
        udid: device.udid,
        success: false,
        steps: stepResults,
        duration: Date.now() - startTime,
      };
    }
    // Give app time to fully launch after ready signal
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Execute steps
    for (let i = startIndex; i < this.config.steps.length; i++) {
      const step = this.config.steps[i];
      console.log(`  [Step ${i + 1}/${this.config.steps.length}] ${step.goal}`);

      const result = await this.executor.executeStep(
        step,
        this.config.maxIterations ?? 20
      );

      stepResults.push(result);

      if (!result.success) {
        console.error(`    ✗ Step failed: ${result.error}`);
        break;
      }

      console.log(`    ✓ Completed in ${result.iterations} iterations`);
      if (result.screenshotPath) {
        console.log(`    📸 Screenshot: ${result.screenshotPath}`);
      }
    }

    // Kill the runBefore process before moving to next device
    this.killRunBeforeProcess();

    const allSuccess =
      stepResults.length === this.config.steps.length &&
      stepResults.every((r) => r.success);

    return {
      device: device.name,
      udid: device.udid,
      success: allSuccess,
      steps: stepResults,
      duration: Date.now() - startTime,
    };
  }

  async run(): Promise<WorkflowResult> {
    const startTime = Date.now();
    const deviceResults: DeviceResult[] = [];

    // Resolve device names to actual devices
    const devices: SimulatorDevice[] = [];
    for (const deviceName of this.config.devices) {
      const device = findDevice(deviceName);
      if (!device) {
        console.error(`Device not found: ${deviceName}`);
        console.error("Available devices can be listed with: xcrun simctl list devices");
        continue;
      }
      devices.push(device);
    }

    if (devices.length === 0) {
      console.error("No valid devices found");
      return {
        workflow: this.config.name,
        success: false,
        devices: [],
        totalDuration: Date.now() - startTime,
      };
    }

    console.log(`\nFound ${devices.length} device(s):`);
    for (const device of devices) {
      console.log(`  - ${device.name} (${device.runtime})`);
    }

    try {
      await this.executor.initialize();

      for (const device of devices) {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`Device: ${device.name}`);
        console.log("=".repeat(50));

        const result = await this.runForDevice(device);
        deviceResults.push(result);

        // Shutdown device after running (optional, can be removed)
        // shutdownDevice(device.udid);
      }
    } finally {
      await this.executor.cleanup();
    }

    const allSuccess = deviceResults.every((r) => r.success);

    return {
      workflow: this.config.name,
      success: allSuccess,
      devices: deviceResults,
      totalDuration: Date.now() - startTime,
    };
  }
}
