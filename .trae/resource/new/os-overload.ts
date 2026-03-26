import os from "node:os";
import { getPrimaryIPv4Interfaces } from "./network-interfaces.js";

const originalNetworkInterfaces = os.networkInterfaces;

export function overloadOsNetworkInterfaces(): void {
  os.networkInterfaces = function (this: typeof os): ReturnType<typeof os.networkInterfaces> {
    try {
      return originalNetworkInterfaces.call(this);
    } catch {
      return getPrimaryIPv4Interfaces();
    }
  } as typeof originalNetworkInterfaces;

  console.log("[openclaw-termux] os.networkInterfaces() method has been overloaded");
}

export function restoreOsNetworkInterfaces(): void {
  os.networkInterfaces = originalNetworkInterfaces;
  console.log("[openclaw-termux] os.networkInterfaces() method has been restored to its original implementation");
}
