(function () {
  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var widgetKey = script.getAttribute("data-widget-key");
  if (!widgetKey) {
    console.error("[LeadOne widget] Missing data-widget-key attribute on the embed script tag.");
    return;
  }

  var origin = new URL(script.src).origin;
  var BUBBLE_SIZE = 72;

  var container = document.createElement("div");
  container.id = "leadone-widget-container";
  container.style.position = "fixed";
  container.style.bottom = "16px";
  container.style.right = "16px";
  container.style.width = BUBBLE_SIZE + "px";
  container.style.height = BUBBLE_SIZE + "px";
  container.style.zIndex = "2147483647";
  container.style.border = "none";
  container.style.background = "transparent";
  container.style.colorScheme = "normal";
  container.style.transition = "width 0.15s ease, height 0.15s ease";

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/widget/" + encodeURIComponent(widgetKey);
  iframe.title = "Chat widget";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  iframe.style.colorScheme = "normal";
  iframe.setAttribute("allow", "clipboard-write");

  container.appendChild(iframe);

  function mount() {
    document.body.appendChild(container);
  }
  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.source !== "leadone-widget") return;
    if (typeof data.width === "number" && typeof data.height === "number") {
      container.style.width = data.width + "px";
      container.style.height = data.height + "px";
    }
  });
})();
