import { execSync } from "child_process";

export interface SimulatorDevice {
  name: string;
  udid: string;
  state: string;
  runtime: string;
}

export function listDevices(): SimulatorDevice[] {
  const output = execSync("xcrun simctl list devices --json", {
    encoding: "utf-8",
  });
  const data = JSON.parse(output);
  const devices: SimulatorDevice[] = [];

  for (const [runtime, runtimeDevices] of Object.entries(data.devices)) {
    if (!runtime.includes("iOS")) continue;
    for (const device of runtimeDevices as any[]) {
      if (device.isAvailable) {
        devices.push({
          name: device.name,
          udid: device.udid,
          state: device.state,
          runtime: runtime.replace("com.apple.CoreSimulator.SimRuntime.", ""),
        });
      }
    }
  }

  return devices;
}

export function findDevice(namePattern: string): SimulatorDevice | undefined {
  const devices = listDevices();
  const pattern = namePattern.toLowerCase();

  // Try exact match first
  let device = devices.find((d) => d.name.toLowerCase() === pattern);
  if (device) return device;

  // Try partial match
  device = devices.find((d) => d.name.toLowerCase().includes(pattern));
  if (device) return device;

  // Try fuzzy match (e.g., "iphone 15 pro" matches "iPhone 15 Pro")
  const words = pattern.split(/\s+/);
  device = devices.find((d) => {
    const name = d.name.toLowerCase();
    return words.every((word) => name.includes(word));
  });

  return device;
}

export function bootDevice(udid: string): void {
  const devices = listDevices();
  const device = devices.find((d) => d.udid === udid);

  if (device?.state === "Booted") {
    console.log(`    Device already booted`);
    return;
  }

  console.log(`    Booting simulator...`);
  execSync(`xcrun simctl boot ${udid}`, { encoding: "utf-8" });

  // Wait for boot to complete
  let attempts = 0;
  while (attempts < 30) {
    const updated = listDevices().find((d) => d.udid === udid);
    if (updated?.state === "Booted") {
      break;
    }
    execSync("sleep 1");
    attempts++;
  }
}

export function shutdownDevice(udid: string): void {
  try {
    execSync(`xcrun simctl shutdown ${udid}`, { encoding: "utf-8" });
  } catch {
    // Ignore errors if already shut down
  }
}

export function openSimulatorApp(): void {
  execSync("open -a Simulator", { encoding: "utf-8" });
  // Give it a moment to open
  execSync("sleep 2");
}
