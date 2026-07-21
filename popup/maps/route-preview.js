import { decodePolyline, projectPoint, unprojectPoint } from "./geometry.js";
import { createRouteLayer } from "./route-layer.js";

const MAP_WIDTH = 620;
const MAP_HEIGHT = 260;
const ROUTE_PADDING = 22;
const CANVAS_PADDING = 256;

function findRouteZoom(points) {
  for (let zoom = 16; zoom > 0; zoom -= 1) {
    const projectedPoints = points.map((point) => projectPoint(point, zoom));
    const xValues = projectedPoints.map(([x]) => x);
    const yValues = projectedPoints.map(([, y]) => y);
    if (Math.max(...xValues) - Math.min(...xValues) <= MAP_WIDTH - ROUTE_PADDING * 2 && Math.max(...yValues) - Math.min(...yValues) <= MAP_HEIGHT - ROUTE_PADDING * 2) return zoom;
  }
  return 0;
}

function createMapBounds(projectedPoints, viewCenter, zoom) {
  const xValues = projectedPoints.map(([x]) => x);
  const yValues = projectedPoints.map(([, y]) => y);
  const left = viewCenter[0] - MAP_WIDTH / 2;
  const top = viewCenter[1] - MAP_HEIGHT / 2;
  const canvasLeft = Math.min(left, Math.min(...xValues)) - CANVAS_PADDING;
  const canvasTop = Math.min(top, Math.min(...yValues)) - CANVAS_PADDING;
  const canvasRight = Math.max(left + MAP_WIDTH, Math.max(...xValues)) + CANVAS_PADDING;
  const canvasBottom = Math.max(top + MAP_HEIGHT, Math.max(...yValues)) + CANVAS_PADDING;
  return { zoom, canvasLeft, canvasTop, canvasWidth: canvasRight - canvasLeft, canvasHeight: canvasBottom - canvasTop };
}

function createMapLink(mapLayer, mapsUrl) {
  const mapLink = document.createElement("a");
  mapLink.href = mapsUrl || "#";
  mapLink.target = "_blank";
  mapLink.rel = "noopener";
  mapLink.setAttribute("aria-label", "Open this route in Google Maps");
  mapLink.title = "Open this route in Google Maps";
  mapLink.append(mapLayer);
  return mapLink;
}

export function createRoutePreview({ routePreview, routeMap, getGoogleMapsUrl }) {
  let route = null;
  let zoomOffset = 0;
  let mapState = null;
  let requestedCenter = null;

  function getCurrentCenter() {
    const viewport = routeMap.querySelector(".osm-scroll-map");
    if (!viewport || !mapState) return null;
    return unprojectPoint([
      mapState.canvasLeft + viewport.scrollLeft + viewport.clientWidth / 2,
      mapState.canvasTop + viewport.scrollTop + viewport.clientHeight / 2
    ], mapState.zoom);
  }

  function render(nextRoute) {
    if (!nextRoute?.encodedPolyline) {
      routePreview.hidden = true;
      return;
    }
    if (nextRoute !== route) {
      route = nextRoute;
      zoomOffset = 0;
      requestedCenter = null;
    }

    const points = decodePolyline(nextRoute.encodedPolyline);
    if (points.length < 2) return;
    const zoom = Math.max(0, Math.min(19, findRouteZoom(points) + zoomOffset));
    const projectedPoints = points.map((point) => projectPoint(point, zoom));
    const xValues = projectedPoints.map(([x]) => x);
    const yValues = projectedPoints.map(([, y]) => y);
    const routeCenter = [(Math.min(...xValues) + Math.max(...xValues)) / 2, (Math.min(...yValues) + Math.max(...yValues)) / 2];
    const viewCenter = requestedCenter ? projectPoint(requestedCenter, zoom) : routeCenter;
    const bounds = createMapBounds(projectedPoints, viewCenter, zoom);
    const viewport = document.createElement("div");
    viewport.className = "osm-scroll-map";
    viewport.append(createMapLink(createRouteLayer(projectedPoints, bounds), getGoogleMapsUrl()));
    const hint = document.createElement("span");
    hint.className = "map-open-hint";
    hint.textContent = "Open in Google Maps ↗";
    routeMap.replaceChildren(viewport, hint);

    const centerViewport = () => {
      const viewportWidth = viewport.clientWidth || MAP_WIDTH;
      const viewportHeight = viewport.clientHeight || MAP_HEIGHT;
      viewport.scrollLeft = Math.max(0, Math.min(bounds.canvasWidth - viewportWidth, viewCenter[0] - bounds.canvasLeft - viewportWidth / 2));
      viewport.scrollTop = Math.max(0, Math.min(bounds.canvasHeight - viewportHeight, viewCenter[1] - bounds.canvasTop - viewportHeight / 2));
    };
    centerViewport();
    requestAnimationFrame(centerViewport);

    mapState = bounds;
    requestedCenter = null;
    const attribution = document.createElement("p");
    attribution.className = "muted";
    attribution.innerHTML = 'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
    routeMap.append(attribution);
    routePreview.hidden = false;
  }

  return {
    render,
    recenter() {
      if (!route) return;
      requestedCenter = null;
      render(route);
    },
    zoomBy(amount) {
      if (!route) return;
      requestedCenter = getCurrentCenter();
      zoomOffset += amount;
      render(route);
    }
  };
}
