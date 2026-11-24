// Build a single offline-capable HTML file from local, named-export ES modules.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();
const moduleId = (path) => relative(root, path).replaceAll("\\", "/");
function compile(path) {
  if (modules.has(path)) return;
  let source = readFileSync(path, "utf8");
  source = source.replace(
    /^import\s*\{([^}]+)\}\s*from\s*["'](\.\/[^"']+)["'];?\s*$/gm,
    (_, names, spec) => {
      const dep = resolve(dirname(path), spec);
      compile(dep);
      return (
        "const {" + names + "}=modules[" + JSON.stringify(moduleId(dep)) + "];"
      );
    },
  );
  const names = [];
  source = source.replace(
    /^export (const|function|class) (\w+)/gm,
    (_, kind, name) => {
      names.push(name);
      return kind + " " + name;
    },
  );
  if (/^(import|export)\s/m.test(source))
    throw new Error("Unsupported module syntax: " + path);
  modules.set(
    path,
    "modules[" +
      JSON.stringify(moduleId(path)) +
      "]=(()=>{\n" +
      source +
      "\nreturn {" +
      names.join(",") +
      "};\n})();",
  );
}
compile(resolve(root, "src/app.mjs"));
const script =
  '(()=>{"use strict";const modules=Object.create(null);\n' +
  [...modules.values()].join("\n") +
  "\n})();";
const hash = createHash("sha256").update(script).digest("base64");
const html = readFileSync(resolve(root, "src/shell.html"), "utf8")
  .replace("__HASH__", () => hash)
  .replace("__CSS__", () => readFileSync(resolve(root, "styles.css"), "utf8"))
  .replace("__SCRIPT__", () => script);
if (process.argv.includes("--check")) {
  if (readFileSync(resolve(root, "index.html"), "utf8") !== html)
    throw new Error("Run npm run build to update index.html.");
} else writeFileSync(resolve(root, "index.html"), html);
