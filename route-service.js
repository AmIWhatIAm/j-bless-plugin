const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

function formatDuration(duration) {
  const seconds = Math.round(Number.parseFloat(String(duration).replace(/s$/, "")) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min` : `${minutes} min`;
}

export async function computeCommute({ origin, destination, mode = "driving", apiKey }) {
  if (!apiKey?.trim()) throw new Error("Enter a Google Routes API key to calculate the commute.");
  if (!origin?.trim() || !destination?.trim()) throw new Error("Both commute locations are required.");
  const travelMode = mode === "public_transport" ? "TRANSIT" : "DRIVE";
  const request = { origin: { address: origin.trim() }, destination: { address: destination.trim() }, travelMode, languageCode: "en", units: "METRIC" };
  if (travelMode === "DRIVE") request.routingPreference = "TRAFFIC_AWARE";

  const response = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey.trim(), "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" },
    body: JSON.stringify(request)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || "Google Routes API could not calculate this commute.");
  const route = body.routes?.[0];
  if (!route) throw new Error("No route was found for these locations.");
  return { mode, origin: origin.trim(), destination: destination.trim(), durationText: formatDuration(route.duration), distanceText: route.distanceMeters ? `${(route.distanceMeters / 1000).toFixed(1)} km` : "", encodedPolyline: route.polyline?.encodedPolyline ?? "" };
}
