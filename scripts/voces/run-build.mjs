// Corre build.ts con el alias "@" → src (el mismo de tsconfig/vitest).
import { createJiti } from "jiti";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } });
await jiti.import("./build.ts");
