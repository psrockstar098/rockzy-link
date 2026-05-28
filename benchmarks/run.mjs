#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Bench } from "tinybench";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const resultsDir = resolve(__dirname, "results");
const args = new Set(process.argv.slice(2));
const ci = args.has("--ci") || process.env.CI === "true";
const updateBaseline = args.has("--update-baseline");
const benchmarkTimeMs = Number(process.env.BENCHMARK_TIME_MS ?? (ci ? 1000 : 500));
const regressionThreshold = Number(process.env.BENCHMARK_REGRESSION_THRESHOLD ?? 0.35);

const modules = [
  "./route-cache.mjs",
  "./prefetch-scheduler.mjs",
  "./navigation-runtime.mjs",
  "./comparisons.mjs",
  "./cache-scenarios.mjs"
];

const bench = new Bench({
  name: "rockzy-link",
  throws: true,
  time: benchmarkTimeMs,
  warmup: true,
  warmupTime: Math.min(250, benchmarkTimeMs / 2)
});

for (const modulePath of modules) {
  const module = await import(modulePath);
  await module.setup(bench);
}

await bench.run();

const results = bench.tasks.map(toResult);
const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci,
  benchmarkTimeMs,
  results
};

await mkdir(resultsDir, { recursive: true });
await writeFile(
  resolve(resultsDir, "benchmark-results.json"),
  JSON.stringify(report, null, 2)
);
await writeFile(resolve(resultsDir, "benchmark-results.md"), toMarkdown(report));

console.log(toMarkdown(report));

if (updateBaseline) {
  await writeFile(
    resolve(__dirname, "baseline.json"),
    JSON.stringify(
      {
        threshold: regressionThreshold,
        checks: Object.fromEntries(
          results.map((result) => [result.name, { minHz: Math.floor(result.hz) }])
        )
      },
      null,
      2
    ) + "\n"
  );
  console.log("Updated benchmarks/baseline.json");
} else {
  const failures = await compareWithBaseline(results);
  if (failures.length > 0) {
    console.error("\nBenchmark regression detected:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

function toResult(task) {
  const result = task.result;
  const latency = "latency" in result ? result.latency : undefined;
  const throughput = "throughput" in result ? result.throughput : undefined;
  const periodMs = "period" in result ? result.period : latency?.mean ?? 0;
  const hz = throughput?.mean ?? (periodMs > 0 ? 1000 / periodMs : 0);

  return {
    name: task.name,
    hz,
    periodMs,
    latencyMeanMs: latency?.mean ?? periodMs,
    latencyP99Ms: latency?.p99 ?? 0,
    rme: throughput?.rme ?? latency?.rme ?? 0,
    samples: throughput?.samplesCount ?? latency?.samplesCount ?? 0,
    runs: task.runs,
    state: result.state
  };
}

async function compareWithBaseline(results) {
  const baselinePath = resolve(__dirname, "baseline.json");
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const threshold = Number(
    process.env.BENCHMARK_REGRESSION_THRESHOLD ??
      baseline.threshold ??
      regressionThreshold
  );
  const failures = [];

  for (const result of results) {
    const check = baseline.checks?.[result.name];
    if (!check?.minHz) continue;

    const minimumAllowedHz = check.minHz * (1 - threshold);
    if (result.hz < minimumAllowedHz) {
      failures.push(
        `${result.name}: ${formatNumber(result.hz)} ops/sec is below ${formatNumber(
          minimumAllowedHz
        )} ops/sec`
      );
    }
  }

  return failures;
}

function toMarkdown(report) {
  const lines = [
    "# rockzy-link benchmark results",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Node: ${report.node}`,
    `- Platform: ${report.platform}/${report.arch}`,
    `- Time per task: ${report.benchmarkTimeMs}ms`,
    "",
    "| Benchmark | ops/sec | period (ms) | p99 latency (ms) | RME | Samples |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.name} | ${formatNumber(result.hz)} | ${formatNumber(
        result.periodMs
      )} | ${formatNumber(result.latencyP99Ms)} | ${formatNumber(
        result.rme
      )}% | ${result.samples} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatNumber(value) {
  return Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 100 ? 0 : 4
  }).format(value);
}
