import { spawnSync } from "node:child_process";
import os from "node:os";

export function getPrimaryIPv4Interfaces(): ReturnType<typeof os.networkInterfaces> {
  const tryNetworkInterfaces = (): ReturnType<typeof os.networkInterfaces> | null => {
    try {
      return os.networkInterfaces();
    } catch (error) {
      return null;
    }
  };

  const tryCommandLookup = (): Record<string, os.NetworkInterfaceInfo[]> => {
    const result: Record<string, os.NetworkInterfaceInfo[]> = {};
    const platform = os.platform();
    let command: string;
    let args: string[];

    if (platform === "win32") {
      command = "ipconfig";
      args = [];
    } else {
      command = "ifconfig";
      args = [];
    }

    try {
      const res = spawnSync(command, args, {
        encoding: "utf-8",
        timeout: 5000,
      });

      if (res.stdout && typeof res.stdout === "string") {
        const output = res.stdout;
        const ipv4Pattern = /inet\s+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/g;
        const matches = [...output.matchAll(ipv4Pattern)];
        const uniqueIPs = [...new Set(matches.map((m) => m[1]))].filter(
          (ip) => {
            const parts = ip.split(".");
            return (
              parts.length === 4 &&
              parts.every((p) => parseInt(p) >= 0 && parseInt(p) <= 255) &&
              !ip.startsWith("127.") &&
              !ip.startsWith("0.") &&
              !ip.startsWith("255.") &&
              !ip.endsWith(".255")
            );
          },
        );

        for (const ip of uniqueIPs) {
          const interfaceName = "eth0";
          result[interfaceName] = [
            {
              address: ip,
              netmask: "255.255.255.0",
              family: "IPv4" as const,
              mac: "00:00:00:00:00:00",
              internal: false,
              cidr: `${ip}/24`,
            },
          ];
        }
      }
    } catch (error) {}

    return result;
  };

  const nets = tryNetworkInterfaces();
  if (nets) {
    return nets;
  }

  return tryCommandLookup();
}
