import { JSDOM } from "jsdom";

export function installBenchmarkDom(url = "https://rockzy-link.test/") {
  if (globalThis.window?.document) return () => undefined;

  const dom = new JSDOM(
    "<!doctype html><html><head></head><body><main id=\"root\" data-route-root></main></body></html>",
    {
      pretendToBeVisual: true,
      url
    }
  );

  defineGlobal("window", dom.window);
  defineGlobal("document", dom.window.document);
  defineGlobal("navigator", dom.window.navigator);
  defineGlobal("location", dom.window.location);
  defineGlobal("history", dom.window.history);
  defineGlobal("CustomEvent", dom.window.CustomEvent);
  defineGlobal("Event", dom.window.Event);
  defineGlobal("HTMLElement", dom.window.HTMLElement);
  defineGlobal("PopStateEvent", dom.window.PopStateEvent);
  defineGlobal("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));

  Object.defineProperty(dom.window.navigator, "onLine", {
    configurable: true,
    value: true
  });

  Object.defineProperty(dom.window.document, "visibilityState", {
    configurable: true,
    value: "visible"
  });

  dom.window.scrollTo = () => undefined;
  dom.window.requestAnimationFrame = (callback) =>
    dom.window.setTimeout(() => callback(performance.now()), 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);

  return () => {
    dom.window.close();
  };
}

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value
  });
}
