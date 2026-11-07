import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const output = join(root, "originals");
const packages = join(here, "node_modules");
const { dependencies } = readJson(join(here, "package.json"));
const lock = readJson(join(here, "package-lock.json")).packages;
const index = { version: 1, themes: [] };

const bootstrap = {
  "3.2.0": { npm: "bootstrap32", url: "https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.2.0/css/bootstrap.min.css" },
  "3.3.6": { npm: "bootstrap336", url: "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" },
  "3.3.7": { npm: "bootstrap337", url: "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" },
};

const configurations = {
  pro: { name: "Pro", intl: "regions", monorepo: true },
  "academic-cv-lite": { name: "Academic CV Lite", intl: "month-year", monorepo: true },
  "executive-slate": { name: "Executive Slate", intl: "month-year", monorepo: true },
  colophon: { name: "Colophon" },
  elegant: { name: "Elegant", bootstrap: "3.3.6", assets: ["assets/css/theme.css"] },
  even: { name: "Even", intl: "regions-and-lists" },
  flat: { name: "Flat (npm)", bootstrap: "3.2.0", assets: ["style.css", "resume.template"] },
  kendall: { name: "Kendall", bootstrap: "3.3.7", assets: ["style.css", "print.css", "resume.template"] },
  lucide: {
    name: "Lucide",
    assets: ["theme/.config/styles/style.css", "resume.hbs", "theme/partials/"],
  },
  macchiato: { name: "Macchiato", assets: ["src/style.css", "src/resume.hbs", "src/partials/"] },
  minyma: { name: "Minyma" },
  "paper-plus-plus": {
    name: "Paper Plus Plus",
    assets: ["resume.template", "css/print.css", "css/style.css", "css/screen.css"],
  },
  pumpkin: { name: "Pumpkin", bootstrap: "3.2.0", assets: ["style.css", "resume.hbs"] },
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function packagedFiles(directory, paths) {
  const files = {};
  for (const path of paths) {
    const absolute = join(directory, path);
    if (path.endsWith("/")) {
      for (const child of readdirSync(absolute).sort()) {
        if (child.endsWith(".hbs")) files[path + child] = readFileSync(join(absolute, child), "utf8");
      }
    } else {
      files[path] = readFileSync(absolute, "utf8");
    }
  }
  return files;
}

function staticThemeFiles(themeRoot, slug, files) {
  return {
    name: "original-theme-static-files",
    setup(builder) {
      builder.onResolve({ filter: /^(?:node:)?(?:fs|path|stream)$|^handlebars-wax$/ }, ({ path }) => ({
        path: path.replace(/^node:/, ""),
        namespace: "theme-static",
      }));
      // SSR uses static markup. Fail closed if a dependency tries streaming.
      builder.onLoad({ filter: /^stream$/, namespace: "theme-static" }, () => ({
        contents: 'export class Transform { constructor() { throw new Error("Streaming is unavailable"); } }',
      }));
      builder.onResolve({ filter: /^react-dom\/server$/ }, () => ({
        path: join(packages, "react-dom/cjs/react-dom-server-legacy.browser.production.js"),
      }));
      builder.onLoad({ filter: /^path$/, namespace: "theme-static" }, () => ({
        contents: `export const join = (...parts) => parts.join("/").replace(/(?:^|\\/)\\.\\//g, "").replace(/\\/+/g, "/");`,
      }));
      builder.onLoad({ filter: /^fs$/, namespace: "theme-static" }, () => ({
        contents: `const files = ${JSON.stringify(files)};
          const key = path => path.replace(/^\\.\\//, "");
          export function readFileSync(path) {
            if (!Object.hasOwn(files, key(path))) throw new Error("Unbundled theme asset");
            return files[key(path)];
          }
          export function readdirSync(path) {
            const parent = key(path).replace(/\\/$/, "") + "/";
            return Object.keys(files).filter(file => file.startsWith(parent)).map(file => file.slice(parent.length));
          }`,
      }));
      if (slug === "lucide") {
        // The upstream entry loads six JS helpers using dynamic require(join()).
        // Resolve those fixed imports ahead of time so no host loader is needed.
        builder.onLoad({ filter: /[/\\]jsonresume-theme-lucide[/\\]index\.js$/ }, ({ path }) => ({
          contents: readFileSync(path, "utf8")
            .replace(/^const HELPERS = .*;\r?$/m, "")
            .replace(/require\(join\(HELPERS, '([a-z-]+\.js)'\)\)/g, "require('./theme/hbs-helpers/$1')"),
          resolveDir: themeRoot,
        }));
      }
      if (slug === "macchiato") {
        const partials = Object.fromEntries(Object.entries(files)
          .filter(([path]) => path.startsWith("src/partials/"))
          .map(([path, text]) => [path.split("/").pop().slice(0, -4), text]));
        builder.onLoad({ filter: /^handlebars-wax$/, namespace: "theme-static" }, () => ({
          contents: `module.exports = function (handlebars) {
            return { partials() {
              for (const [name, source] of Object.entries(${JSON.stringify(partials)})) {
                handlebars.registerPartial(name, source);
              }
            }, compile: handlebars.compile.bind(handlebars) };
          }`,
        }));
      }
    },
  };
}

function notices(inputs, themeRoot, theme, locked, cssRoot, monorepo) {
  const roots = new Set([themeRoot, ...(cssRoot ? [cssRoot] : [])]);
  for (const input of Object.keys(inputs)) {
    let dir = dirname(resolve(here, input));
    while (dir.startsWith(packages + "/")) {
      const manifest = join(dir, "package.json");
      if (existsSync(manifest) && readJson(manifest).name) {
        roots.add(dir);
        break;
      }
      dir = dirname(dir);
    }
  }
  const headings = [
    `${theme.name} — original JSON Resume renderer`,
    theme.upstream,
    `npm integrity: ${locked.integrity}`,
    "Bundling resolves module imports and packages required static files.",
    "",
  ];
  for (const dir of [...roots].sort()) {
    const metadata = readJson(join(dir, "package.json"));
    headings.push(`--- ${metadata.name}@${metadata.version} | ${metadata.license ?? "See upstream"} ---`);
    const files = readdirSync(dir).filter(name => /^(licen[sc]es?|copying|notice)(?:\.|$)/i.test(name)).sort();
    for (const file of files) {
      const path = join(dir, file);
      if (readdirSync(dir, { withFileTypes: true }).find(entry => entry.name === file)?.isFile()) {
        headings.push(readFileSync(path, "utf8").trim());
      }
    }
    if (dir === themeRoot && monorepo && !files.length) {
      headings.push(readFileSync(join(packages, "@jsonresume/core/LICENSE"), "utf8").trim());
    }
    const fontNotice = join(dir, "fonts/LICENSE.md");
    if (existsSync(fontNotice)) headings.push(readFileSync(fontNotice, "utf8").trim());
    if (!files.length) {
      const author = typeof metadata.author === "string" ? metadata.author : metadata.author?.name;
      if (author) headings.push(`Author: ${author}`);
      headings.push(`https://www.npmjs.com/package/${metadata.name}/v/${metadata.version}`);
    }
    headings.push("");
  }
  return headings.join("\n").replace(/\r\n/g, "\n");
}

mkdirSync(output, { recursive: true });
mkdirSync(join(output, "notices"), { recursive: true });
for (const [slug, { name, assets = [], bootstrap: bootstrapVersion, intl, monorepo }] of Object.entries(configurations)) {
  const npmPackage = `jsonresume-theme-${slug}`;
  const themeRoot = join(packages, npmPackage);
  const installed = readJson(join(themeRoot, "package.json"));
  const pinned = lock[relative(here, themeRoot)];
  if (installed.version !== dependencies[npmPackage] || !pinned.integrity?.startsWith("sha512-")) {
    throw new Error(`Invalid pinned package ${npmPackage}`);
  }
  const files = packagedFiles(themeRoot, assets);
  const intlSources = intl === "month-year" ? 'import "./legacy-date.mjs";' : intl ? `
    import "@formatjs/intl-getcanonicallocales/polyfill-force.js";
    import "@formatjs/intl-locale/polyfill-force.js";
    import "@formatjs/intl-displaynames/polyfill-force.js";
    import "@formatjs/intl-displaynames/locale-data/en.js";
    ${intl === "regions-and-lists" ? `
      import "@formatjs/intl-listformat/polyfill-force.js";
      import "@formatjs/intl-listformat/locale-data/en.js";
    ` : ""}
  ` : "";
  const css = bootstrap[bootstrapVersion];
  const cssRoot = css && join(packages, css.npm);
  const stylesheets = css && { [css.url]: readFileSync(join(cssRoot, "dist/css/bootstrap.min.css"), "utf8") };
  const { outputFiles, metafile } = await build({
    absWorkingDir: here,
    stdin: {
      contents: `${intlSources} import * as theme from ${JSON.stringify(npmPackage)};
        globalThis.__resumeOneTheme = typeof theme.render === "function" ? theme : theme.default;`,
      resolveDir: here,
    },
    conditions: ["browser", "production"],
    banner: intl ? { js: "globalThis.Intl ??= {};" } : undefined,
    logOverride: { "import-is-undefined": "silent" },
    bundle: true, write: false, metafile: true, minify: true,
    format: "iife", platform: "browser", target: "es2022", legalComments: "inline",
    define: { "__dirname": '"."', "process.env.NODE_ENV": '"production"' },
    plugins: [staticThemeFiles(themeRoot, slug, files)],
  });
  const author = typeof installed.author === "string" ? installed.author : installed.author?.name;
  const theme = {
    kind: "json-resume-original", formatVersion: 1, id: `original-${slug}`, name,
    package: npmPackage, version: installed.version, license: installed.license,
    author: author?.replace(/\s*<[^>]*>/g, "") || (monorepo ? "JSON Resume contributors" : npmPackage),
    upstream: `https://www.npmjs.com/package/${npmPackage}/v/${installed.version}`,
    script: outputFiles[0].text,
    ...(stylesheets && { stylesheets }),
  };
  const manifest = `${slug}.original.theme.json`;
  const bytes = JSON.stringify(theme) + "\n";
  if (Buffer.byteLength(bytes) > 1_048_576) throw new Error(`${slug} exceeds the theme package size limit`);
  writeFileSync(join(output, manifest), bytes);
  writeFileSync(join(output, "notices", `${slug}.txt`), notices(metafile.inputs, themeRoot, theme, pinned, cssRoot, monorepo));
  index.themes.push({ id: theme.id, name, manifest, sha256: hash(bytes) });
  console.log(`${slug}: ${Buffer.byteLength(bytes)} bytes`);
}
writeFileSync(join(output, "index.json"), JSON.stringify(index, null, 2) + "\n");
