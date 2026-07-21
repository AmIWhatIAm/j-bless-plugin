export function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([latitude / 1e5, longitude / 1e5]);
  }

  return points;
}

export function projectPoint([latitude, longitude], zoom) {
  const scale = 256 * 2 ** zoom;
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180;
  return [
    scale * (longitude + 180) / 360,
    scale * (1 - Math.asinh(Math.tan(clampedLatitude)) / Math.PI) / 2
  ];
}

export function unprojectPoint([worldX, worldY], zoom) {
  const scale = 256 * 2 ** zoom;
  return [
    Math.atan(Math.sinh(Math.PI - 2 * Math.PI * worldY / scale)) * 180 / Math.PI,
    worldX / scale * 360 - 180
  ];
}
