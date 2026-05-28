module.exports = [
  {
    name: "core entry",
    path: "dist/index.js",
    limit: "2 KB"
  },
  {
    name: "react link component",
    path: "dist/link.js",
    limit: "16 KB"
  },
  {
    name: "navigation runtime",
    path: "dist/runtime/link-runtime.js",
    limit: "16 KB"
  },
  {
    name: "prefetch scheduler",
    path: "dist/prefetch/scheduler.js",
    limit: "24 KB"
  }
];
