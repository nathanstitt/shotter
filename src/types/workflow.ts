export interface WorkflowConfig {
  name: string;
  description?: string;
  bundleId: string;
  devices: string[];
  runBefore?: string;
  maxIterations?: number;
  stepTimeout?: number;
  outputDir?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  goal: string;
  hints?: string[];
  screenshot?: string;
}

export interface StepResult {
  step: WorkflowStep;
  success: boolean;
  screenshotPath?: string;
  error?: string;
  iterations: number;
  toolsUsed: string[];
}

export interface DeviceResult {
  device: string;
  udid: string;
  success: boolean;
  steps: StepResult[];
  duration: number;
}

export interface WorkflowResult {
  workflow: string;
  success: boolean;
  devices: DeviceResult[];
  totalDuration: number;
}
