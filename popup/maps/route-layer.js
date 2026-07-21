function appendMapTiles(mapLayer, { zoom, canvasLeft, canvasTop, canvasWidth, canvasHeight }) {
  const maxTile = 2 ** zoom;
  const firstTileX = Math.floor(canvasLeft / 256);
  const lastTileX = Math.floor((canvasLeft + canvasWidth) / 256);
  const firstTileY = Math.floor(canvasTop / 256);
  const lastTileY = Math.floor((canvasTop + canvasHeight) / 256);

  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      if (tileY < 0 || tileY >= maxTile) continue;
      const tile = document.createElement("img");
      tile.className = "osm-tile";
      tile.alt = "";
      tile.src = `https://tile.openstreetmap.org/${zoom}/${(tileX % maxTile + maxTile) % maxTile}/${tileY}.png`;
      tile.style.left = `${tileX * 256 - canvasLeft}px`;
      tile.style.top = `${tileY * 256 - canvasTop}px`;
      mapLayer.append(tile);
    }
  }
}

function appendRouteLine(mapLayer, projectedPoints, { canvasLeft, canvasTop, canvasWidth, canvasHeight }) {
  const routeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  routeSvg.classList.add("osm-route");
  routeSvg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  const points = projectedPoints.map(([x, y]) => `${(x - canvasLeft).toFixed(1)},${(y - canvasTop).toFixed(1)}`).join(" ");
  const [startX, startY] = projectedPoints[0];
  const [endX, endY] = projectedPoints.at(-1);
  routeSvg.innerHTML = `<polyline points="${points}" fill="none" stroke="#176b4d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${(startX - canvasLeft).toFixed(1)}" cy="${(startY - canvasTop).toFixed(1)}" r="8" fill="#2e6de0"/><circle cx="${(endX - canvasLeft).toFixed(1)}" cy="${(endY - canvasTop).toFixed(1)}" r="8" fill="#d94545"/>`;
  mapLayer.append(routeSvg);
}

export function createRouteLayer(projectedPoints, bounds) {
  const mapLayer = document.createElement("div");
  mapLayer.className = "osm-static-map";
  mapLayer.style.width = `${bounds.canvasWidth}px`;
  mapLayer.style.height = `${bounds.canvasHeight}px`;
  appendMapTiles(mapLayer, bounds);
  appendRouteLine(mapLayer, projectedPoints, bounds);
  return mapLayer;
}
