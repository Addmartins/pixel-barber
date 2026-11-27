import { spawn } from "node:child_process";
import { cp, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const staging = await mkdtemp(join(tmpdir(), "pixel-barber-mobile-"));
const api = resolve(project, "src/app/api");

try {
  await cp(join(project, "src"), join(staging, "src"), {
    recursive: true,
    filter: (path) => resolve(path) !== api,
  });
  const downloads = resolve(project, "public/downloads");
  await cp(join(project, "public"), join(staging, "public"), {
    recursive: true,
    filter: (path) => resolve(path) !== downloads,
  });
  const config = ["package.json", "tsconfig.json", "postcss.config.mjs", "tailwind.config.ts"];
  const envFiles = (await readdir(project)).filter((name) =>
    [".env", ".env.local", ".env.production", ".env.production.local"].includes(name));
  for (const file of config) await cp(join(project, file), join(staging, file));
  // Only public configuration is needed in the isolated static build.
  for (const name of [".env", ".env.production", ".env.local", ".env.production.local"]) {
    if (envFiles.includes(name)) {
      const { readFile } = await import("node:fs/promises");
      const lines = (await readFile(join(project, name), "utf8")).split(/\r?\n/)
        .filter((line) => /^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)\s*=/.test(line));
      await writeFile(join(staging, name), lines.join("\n"));
    }
  }
  await symlink(join(project, "node_modules"), join(staging, "node_modules"), "junction");
  await writeFile(join(staging, "next.config.mjs"), 'export default { output: "export", experimental: { useTypeScriptCli: false }, images: { unoptimized: true } };\n');

  const origin = new URL(process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "https://pixel-barber.vercel.app");
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("NEXT_PUBLIC_BACKEND_ORIGIN deve ser uma origem HTTPS, sem caminho.");
  }
  const child = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
    cwd: staging,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_BACKEND_ORIGIN: origin.origin },
  });
  await new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? accept() : reject(new Error(`Build mobile falhou (${code}).`)));
  });

  // Replace only generated output and only after the new export succeeded.
  await rm(join(project, "out"), { recursive: true, force: true });
  await cp(join(staging, "out"), join(project, "out"), { recursive: true });
} finally {
  await rm(staging, { recursive: true, force: true });
}
