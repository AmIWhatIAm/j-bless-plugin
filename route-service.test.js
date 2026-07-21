import test from "node:test";
import assert from "node:assert/strict";
import { computeCommute } from "./route-service.js";

test("computes and formats a driving commute from the Routes API response", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, options) => {
    request = options;
    return new Response(JSON.stringify({
      routes: [{ duration: "3672s", distanceMeters: 12340, polyline: { encodedPolyline: "abc" } }]
    }), { status: 200 });
  };
  try {
    const commute = await computeCommute({ origin: "A", destination: "B", mode: "driving", apiKey: "test-key" });
    assert.equal(commute.durationText, "1 hr 1 min");
    assert.equal(commute.distanceText, "12.3 km");
    assert.equal(commute.encodedPolyline, "abc");
    assert.match(commute.googleMapsUrl, /origin=A/);
    assert.match(commute.googleMapsUrl, /destination=B/);
    assert.match(commute.googleMapsUrl, /travelmode=driving/);
    assert.match(request.headers["X-Goog-FieldMask"], /encodedPolyline/);
    assert.equal(JSON.parse(request.body).travelMode, "DRIVE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses transit mode for public transport", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, options) => {
    request = options;
    return new Response(JSON.stringify({ routes: [{ duration: "600s", polyline: {} }] }), { status: 200 });
  };
  try {
    const commute = await computeCommute({ origin: "A", destination: "B", mode: "public_transport", apiKey: "test-key" });
    assert.equal(JSON.parse(request.body).travelMode, "TRANSIT");
    assert.match(commute.googleMapsUrl, /travelmode=transit/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
