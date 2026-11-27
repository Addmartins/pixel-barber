import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

function sourceBuildId() {
  const hash = createHash("sha256");
  const read = (directory) => {
    const entries = readdirSync(new URL(directory, import.meta.url), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = directory + entry.name;
      if (entry.isDirectory()) read(path + "/");
      else if (!path.endsWith(".apk")) hash.update(path).update(readFileSync(fileURLToPath(new URL(path, import.meta.url))));
    }
  };
  read("./src/");
  read("./public/");
  hash.update(readFileSync(new URL("./package-lock.json", import.meta.url)));
  return hash.digest("hex").slice(0, 20);
}

export default {
  experimental: { useTypeScriptCli: false },
  env: {
    NEXT_PUBLIC_PIXEL_BARBER_BUILD: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || sourceBuildId(),
  },
};
