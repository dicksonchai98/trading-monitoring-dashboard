import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CandlestickChartIcon } from "lucide-react";

const FAVICON_REL_SELECTOR = "link[rel='icon']";

export function applyCandlestickFavicon(): void {
  if (typeof document === "undefined") {
    return;
  }

  const svg = renderToStaticMarkup(
    createElement(CandlestickChartIcon, {
      size: 32,
      color: "#111827",
      strokeWidth: 2.25,
    }),
  );
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  let iconLink = document.querySelector(FAVICON_REL_SELECTOR) as HTMLLinkElement | null;
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    document.head.appendChild(iconLink);
  }

  iconLink.type = "image/svg+xml";
  iconLink.href = href;
}
