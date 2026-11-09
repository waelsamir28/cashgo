import os from "node:os";

export function lanAddresses(): string[] {
  const result: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const item of interfaces[name] ?? []) {
      if (item.family === "IPv4" && !item.internal) result.push(item.address);
    }
  }
  return Array.from(new Set(result));
}

export function scanInfo() {
  const port = Number(process.env.PORT || process.env.ALGAMAL_PORT || 3210);
  const addresses = lanAddresses();
  return {
    port,
    addresses,
    mobileUrl: addresses.length ? `http://${addresses[0]}:${port}/scan` : null,
    customerUrl: `http://127.0.0.1:${port}/price-check?display=1`,
    note: "يجب أن يكون الموبايل والكمبيوتر على نفس شبكة الواي فاي، مع السماح بالمنفذ في جدار الحماية.",
  };
}
