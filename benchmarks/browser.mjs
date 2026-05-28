#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const resultsDir = resolve(__dirname, "results");
const browserDir = resolve(resultsDir, "browser");
const iterations = Number(process.env.BROWSER_BENCHMARK_ITERATIONS ?? 250);

await mkdir(browserDir, { recursive: true });
await buildBrowserFixture();

const server = await startServer(browserDir);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });

  await page.goto(`${server.url}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__rockzyBrowserBenchmarksReady === true);

  const browserReport = await page.evaluate(
    (count) => window.runRockzyBrowserBenchmarks(count),
    iterations
  );

  const report = {
    generatedAt: new Date().toISOString(),
    browserName: browser.browserType().name(),
    iterations,
    ...browserReport
  };

  await writeFile(
    resolve(resultsDir, "browser-benchmark-results.json"),
    JSON.stringify(report, null, 2)
  );
  await writeFile(resolve(resultsDir, "browser-benchmark-results.md"), toMarkdown(report));

  console.log(toMarkdown(report));
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function buildBrowserFixture() {
  await writeFile(resolve(browserDir, "index.html"), htmlFixture());

  await build({
    stdin: {
      contents: browserEntry(),
      resolveDir: projectRoot,
      loader: "tsx",
      sourcefile: "browser-benchmark-entry.tsx"
    },
    bundle: true,
    format: "iife",
    globalName: "RockzyBrowserBenchmark",
    outfile: resolve(browserDir, "app.js"),
    sourcemap: false,
    minify: true,
    jsx: "automatic",
    platform: "browser",
    target: "es2022",
    define: {
      "process.env.NODE_ENV": '"production"'
    }
  });
}

function htmlFixture() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>rockzy-link browser benchmark</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; }
      nav { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; padding: 16px; }
      a, button { border: 1px solid #ccc; background: white; color: #111; padding: 8px; text-decoration: none; }
      main { padding: 16px; min-height: 240px; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <div id="hydrate-root"><div id="hydrated-app"><a href="/hydrated/initial">Hydrated route</a><main data-route-root="true">Hydrated /hydrated/initial</main></div></div>
    <script src="/app.js"></script>
  </body>
</html>`;
}

function browserEntry() {
  return `
import React, { useMemo, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Link, LinkRuntimeProvider } from "./dist/link.js";
import { createLinkRuntime } from "./dist/runtime/link-runtime.js";

const routeCount = 64;
const routes = Array.from({ length: routeCount }, (_, index) => "/browser/route-" + index);

function RockzyApp() {
  const [route, setRoute] = useState("/browser/route-0");
  const runtime = useMemo(
    () =>
      createLinkRuntime({
        a11y: { announce: false, restoreFocus: false },
        offline: { enabled: false },
        prefetch: {
          adaptive: false,
          crossTabDedupe: false,
          fetcher: () => new Response("<main>prefetched</main>")
        }
      }),
    []
  );
  const router = useMemo(
    () => ({
      push: (href) => {
        window.history.pushState({}, "", href);
        setRoute(href);
      },
      prefetch: () => undefined
    }),
    []
  );

  return (
    <LinkRuntimeProvider runtime={runtime}>
      <nav aria-label="rockzy-link routes">
        {routes.map((href, index) => (
          <Link
            key={href}
            href={href}
            data-rockzy-link={index}
            router={router}
            prefetch={index % 2 === 0 ? "hover" : "viewport"}
            scroll={false}
            announce={false}
            focus={false}
          >
            Route {index}
          </Link>
        ))}
      </nav>
      <main data-route-root>Rockzy route {route}</main>
    </LinkRuntimeProvider>
  );
}

function ReactControlledApp() {
  const [route, setRoute] = useState("/react/route-0");
  return (
    <>
      <nav aria-label="react controlled routes">
        {routes.map((_, index) => {
          const href = "/react/route-" + index;
          return (
            <a
              key={href}
              href={href}
              data-react-link={index}
              onClick={(event) => {
                event.preventDefault();
                window.history.pushState({}, "", href);
                setRoute(href);
              }}
            >
              Route {index}
            </a>
          );
        })}
      </nav>
      <main data-route-root>React route {route}</main>
    </>
  );
}

function HydrationApp() {
  return (
    <div id="hydrated-app">
      <a href="/hydrated/initial">Hydrated route</a>
      <main data-route-root>Hydrated /hydrated/initial</main>
    </div>
  );
}

const appRoot = createRoot(document.getElementById("app"));
appRoot.render(
  <div>
    <section id="rockzy-section"><RockzyApp /></section>
    <section id="react-section"><ReactControlledApp /></section>
  </div>
);

window.__rockzyBrowserBenchmarksReady = false;
requestAnimationFrame(() => {
  window.__rockzyBrowserBenchmarksReady = true;
});

window.runRockzyBrowserBenchmarks = async (iterations) => {
  const results = [];

  results.push(await runClickBenchmark({
    name: "browser: rockzy-link React click-to-render",
    selector: "[data-rockzy-link]",
    iterations
  }));

  results.push(await runClickBenchmark({
    name: "browser: React controlled anchor click-to-render",
    selector: "[data-react-link]",
    iterations
  }));

  results.push(await runHistoryBenchmark(iterations));
  results.push(await runHydrationBenchmark(iterations));

  return {
    results,
    skippedRealIntegrations: [
      {
        name: "React Router",
        reason: "react-router is not installed in this workspace"
      },
      {
        name: "Next Link",
        reason: "next is not installed in this workspace and requires an app router fixture"
      },
      {
        name: "TanStack Router",
        reason: "@tanstack/react-router is not installed in this workspace"
      }
    ]
  };
};

async function runClickBenchmark({ name, selector, iterations }) {
  const links = Array.from(document.querySelectorAll(selector));
  const samples = [];

  for (let index = 0; index < iterations; index += 1) {
    const link = links[index % links.length];
    const start = performance.now();
    link.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await nextFrame();
    samples.push(performance.now() - start);
  }

  return summarize(name, samples);
}

async function runHistoryBenchmark(iterations) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    window.history.pushState({}, "", "/history/route-" + index);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    samples.push(performance.now() - start);
  }
  return summarize("browser: native history pushState", samples);
}

async function runHydrationBenchmark(iterations) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const host = document.createElement("div");
    host.innerHTML = '<div id="hydrated-app"><a href="/hydrated/initial">Hydrated route</a><main data-route-root="true">Hydrated /hydrated/initial</main></div>';
    document.body.appendChild(host);
    const start = performance.now();
    const root = hydrateRoot(host, <HydrationApp />);
    await nextFrame();
    samples.push(performance.now() - start);
    root.unmount();
    host.remove();
  }
  return summarize("browser: React hydrate route shell", samples);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function summarize(name, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    name,
    samples: samples.length,
    meanMs: total / samples.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1]
  };
}

function percentile(sorted, ratio) {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index] ?? 0;
}
`;
}

async function startServer(rootDir) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolve(rootDir, `.${pathname}`);

    if (!filePath.startsWith(rootDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      await readFile(filePath);
      response.writeHead(200, { "content-type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start browser benchmark server");
  }

  return Object.assign(server, {
    url: `http://127.0.0.1:${address.port}`
  });
}

function contentType(filePath) {
  const extension = extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function toMarkdown(report) {
  const lines = [
    "# rockzy-link browser benchmark results",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Browser: ${report.browserName}`,
    `- Iterations per scenario: ${report.iterations}`,
    "",
    "| Benchmark | mean (ms) | median (ms) | p95 (ms) | p99 (ms) | min (ms) | max (ms) | Samples |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.name} | ${formatNumber(result.meanMs)} | ${formatNumber(
        result.medianMs
      )} | ${formatNumber(result.p95Ms)} | ${formatNumber(
        result.p99Ms
      )} | ${formatNumber(result.minMs)} | ${formatNumber(result.maxMs)} | ${
        result.samples
      } |`
    );
  }

  if (report.skippedRealIntegrations?.length) {
    lines.push("", "## Skipped Real Integrations", "");
    for (const skipped of report.skippedRealIntegrations) {
      lines.push(`- **${skipped.name}**: ${skipped.reason}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatNumber(value) {
  return Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 10 ? 2 : 4
  }).format(value);
}
