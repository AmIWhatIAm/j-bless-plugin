import { computeCommute } from "./route-service.js";

const dashboardView = document.getElementById("dashboard-view");
const detailView = document.getElementById("detail-view");
const historyBody = document.getElementById("history-body");
const form = document.getElementById("job-form");
const statusEl = document.getElementById("status");
const detailTitle = document.getElementById("detail-title");
const jobUrlEl = document.getElementById("job-url");
const originEl = document.getElementById("origin");
const commuteModeEl = document.getElementById("commute-mode");
const positionNameEl = document.getElementById("position-name");
const companyNameEl = document.getElementById("company-name");
const workLocationEl = document.getElementById("work-location");
const jobDescriptionEl = document.getElementById("job-description");
const resultsBody = document.getElementById("results-body");
const importCurrentPageEl = document.getElementById("import-current-page");
const importStatusEl = document.getElementById("import-status");
const extractActiveJobButton = document.getElementById("extract-active-job");
const calculateCommuteButton = document.getElementById("calculate-commute");
const routePreview = document.getElementById("route-preview");
const routeMap = document.getElementById("route-map");
const routeRecenterButton = document.getElementById("route-recenter");
const routeZoomOutButton = document.getElementById("route-zoom-out");
const routeZoomInButton = document.getElementById("route-zoom-in");
const requirementsPreview = document.getElementById("requirements-preview");
const requirementsList = document.getElementById("requirements-list");

let jobHistory = [];
let selectedJobId = null;
let importedJobData = {};
let extractedJob = null;
let activePageUrl = "";
let commute = null;
let processingResult = null;
let previewRoute = null;
let routeZoomOffset = 0;
let previewMapState = null;
let requestedMapCenter = null;
const isHomepage = new URLSearchParams(window.location.search).get("homepage") === "1";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  try { return new URL(rawUrl).toString(); } catch { return rawUrl.trim(); }
}

function getJobLabel(job) {
  if (job?.positionName || job?.companyName) return [job.positionName, job.companyName].filter(Boolean).join(" at ");
  const rawUrl = typeof job === "string" ? job : job?.jobUrl;
  try { return new URL(rawUrl).hostname.replace(/^www\./, ""); } catch { return rawUrl || "Untitled job"; }
}

function formatCommuteMode(mode) { return mode === "public_transport" ? "Public transport" : "Driving"; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : "-"; }

function isLinkedInJobsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.linkedin.com" && /^\/jobs\/view\/\d+\/?/.test(parsed.pathname);
  } catch { return false; }
}

function renderHistory() {
  if (!jobHistory.length) {
    historyBody.innerHTML = '<tr><td colspan="4" class="empty">No processed jobs yet. Select "New job" to add one.</td></tr>';
    return;
  }
  historyBody.innerHTML = jobHistory.map((job) => `
    <tr><td><button class="history-row" type="button" data-job-id="${escapeHtml(job.id)}"><span>${escapeHtml(getJobLabel(job))}</span><small>${escapeHtml(normalizeUrl(job.jobUrl))}</small></button></td>
    <td>${escapeHtml(job.origin || "-")}</td><td>${escapeHtml(formatCommuteMode(job.commuteMode))}</td><td>${escapeHtml(formatDate(job.updatedAt))}</td></tr>`).join("");
}

function renderResults(job) {
  if (!job) {
    resultsBody.innerHTML = '<tr><td colspan="2" class="empty">Save the job to see its processed output.</td></tr>';
    return;
  }
  const extracted = job.extractedJob || extractedJob;
  const rows = [
    ["Job posting", normalizeUrl(job.jobUrl)], ["Job portal", getJobLabel(job)],
    ["Position", job.positionName || extracted?.positionName], ["Company", job.companyName || extracted?.companyName],
    ["Work location", job.workLocation || extracted?.workLocation], ["Starting point", (job.origin || "").trim()],
    ["Commute mode", formatCommuteMode(job.commuteMode)], ["Job description", job.jobDescription || extracted?.jobDescription]
  ];
  if (job.commute || commute) {
    const route = job.commute || commute;
    rows.push(["Commute duration", route.durationText], ["Commute distance", route.distanceText]);
  }
  rows.push(["Extracted", formatDate(job.extractedAt)], ["Processed", formatDate(job.updatedAt)]);
  resultsBody.innerHTML = rows.map(([field, output]) => `<tr><td>${escapeHtml(field)}</td><td class="muted">${escapeHtml(output || "-")}</td></tr>`).join("");
}

function decodePolyline(encoded) {
  const points = []; let index = 0; let latitude = 0; let longitude = 0;
  while (index < encoded.length) {
    let shift = 0; let result = 0; let byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    latitude += result & 1 ? ~(result >> 1) : result >> 1; shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    longitude += result & 1 ? ~(result >> 1) : result >> 1; points.push([latitude / 1e5, longitude / 1e5]);
  }
  return points;
}

function renderRouteMap(route) {
  if (!route?.encodedPolyline) { routePreview.hidden = true; return; }
  if (route !== previewRoute) { previewRoute = route; routeZoomOffset = 0; previewMapState = null; requestedMapCenter = null; }
  const points = decodePolyline(route.encodedPolyline); if (points.length < 2) return;
  const lats = points.map(([lat]) => lat); const lngs = points.map(([, lng]) => lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const width = 620, height = 260, padding = 22;
  const x = (lng) => padding + ((lng - minLng) / (maxLng - minLng || 1)) * (width - padding * 2);
  const y = (lat) => height - padding - ((lat - minLat) / (maxLat - minLat || 1)) * (height - padding * 2);
  const line = points.map(([lat, lng]) => `${x(lng).toFixed(1)},${y(lat).toFixed(1)}`).join(" ");
  const [startLat, startLng] = points[0]; const [endLat, endLng] = points.at(-1);
  routeMap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect width="100%" height="100%" fill="#eef4ee"/><polyline points="${line}" fill="none" stroke="#176b4d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(startLng)}" cy="${y(startLat)}" r="8" fill="#2e6de0"/><circle cx="${x(endLng)}" cy="${y(endLat)}" r="8" fill="#d94545"/></svg><p><span class="route-start">●</span> Start &nbsp; <span class="route-end">●</span> Work location</p>`;
  const mapsUrl = getGoogleMapsUrl();
  const project = ([lat, lng], zoom) => {
    const scale = 256 * 2 ** zoom;
    const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
    return [scale * (lng + 180) / 360, scale * (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2];
  };
  let zoom = 16;
  for (; zoom > 0; zoom -= 1) {
    const projected = points.map((point) => project(point, zoom));
    const xs = projected.map(([pointX]) => pointX), ys = projected.map(([, pointY]) => pointY);
    if (Math.max(...xs) - Math.min(...xs) <= width - padding * 2 && Math.max(...ys) - Math.min(...ys) <= height - padding * 2) break;
  }
  zoom = Math.max(0, Math.min(19, zoom + routeZoomOffset));
  const projected = points.map((point) => project(point, zoom));
  const xs = projected.map(([pointX]) => pointX), ys = projected.map(([, pointY]) => pointY);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2, centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const [viewCenterX, viewCenterY] = requestedMapCenter ? project(requestedMapCenter, zoom) : [centerX, centerY];
  const left = viewCenterX - width / 2, top = viewCenterY - height / 2;
  const canvasPadding = 256;
  const canvasLeft = Math.min(left, Math.min(...xs)) - canvasPadding;
  const canvasTop = Math.min(top, Math.min(...ys)) - canvasPadding;
  const canvasRight = Math.max(left + width, Math.max(...xs)) + canvasPadding;
  const canvasBottom = Math.max(top + height, Math.max(...ys)) + canvasPadding;
  const canvasWidth = canvasRight - canvasLeft, canvasHeight = canvasBottom - canvasTop;
  const mapLayer = document.createElement("div"); mapLayer.className = "osm-static-map";
  mapLayer.style.width = `${canvasWidth}px`; mapLayer.style.height = `${canvasHeight}px`;
  const maxTile = 2 ** zoom;
  for (let tileY = Math.floor(canvasTop / 256); tileY <= Math.floor((canvasTop + canvasHeight) / 256); tileY += 1) {
    for (let tileX = Math.floor(canvasLeft / 256); tileX <= Math.floor((canvasLeft + canvasWidth) / 256); tileX += 1) {
      if (tileY < 0 || tileY >= maxTile) continue;
      const tile = document.createElement("img"); tile.className = "osm-tile"; tile.alt = "";
      tile.src = `https://tile.openstreetmap.org/${zoom}/${(tileX % maxTile + maxTile) % maxTile}/${tileY}.png`;
      tile.style.left = `${tileX * 256 - canvasLeft}px`; tile.style.top = `${tileY * 256 - canvasTop}px`;
      mapLayer.append(tile);
    }
  }
  const routeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); routeSvg.classList.add("osm-route"); routeSvg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  routeSvg.innerHTML = `<polyline points="${projected.map(([pointX, pointY]) => `${(pointX - canvasLeft).toFixed(1)},${(pointY - canvasTop).toFixed(1)}`).join(" ")}" fill="none" stroke="#176b4d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${(projected[0][0] - canvasLeft).toFixed(1)}" cy="${(projected[0][1] - canvasTop).toFixed(1)}" r="8" fill="#2e6de0"/><circle cx="${(projected.at(-1)[0] - canvasLeft).toFixed(1)}" cy="${(projected.at(-1)[1] - canvasTop).toFixed(1)}" r="8" fill="#d94545"/>`;
  mapLayer.append(routeSvg);
  const mapLink = document.createElement("a"); mapLink.href = mapsUrl || "#"; mapLink.target = "_blank"; mapLink.rel = "noopener";
  mapLink.setAttribute("aria-label", "Open this route in Google Maps"); mapLink.title = "Open this route in Google Maps"; mapLink.append(mapLayer);
  const mapViewport = document.createElement("div"); mapViewport.className = "osm-scroll-map";
  const mapHint = document.createElement("span"); mapHint.className = "map-open-hint"; mapHint.textContent = "Open in Google Maps ↗";
  mapViewport.append(mapLink); routeMap.replaceChildren(mapViewport, mapHint);
  const centerViewport = () => {
    const viewportWidth = mapViewport.clientWidth || width, viewportHeight = mapViewport.clientHeight || height;
    mapViewport.scrollLeft = Math.max(0, Math.min(canvasWidth - viewportWidth, viewCenterX - canvasLeft - viewportWidth / 2));
    mapViewport.scrollTop = Math.max(0, Math.min(canvasHeight - viewportHeight, viewCenterY - canvasTop - viewportHeight / 2));
  };
  centerViewport(); requestAnimationFrame(centerViewport);
  previewMapState = { zoom, canvasLeft, canvasTop };
  requestedMapCenter = null;
  const attribution = document.createElement("p"); attribution.className = "muted";
  attribution.innerHTML = 'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
  routeMap.append(attribution);
  routePreview.hidden = false;
}

function getGoogleMapsUrl() {
  const origin = originEl.value.trim();
  const destination = [companyNameEl.value.trim(), (workLocationEl.value || extractedJob?.workLocation || "").trim()].filter(Boolean).join(", ");
  if (!origin || !destination) return "";
  const travelmode = commuteModeEl.value === "public_transport" ? "transit" : "driving";
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", origin, destination, travelmode })}`;
}

function getCurrentMapCenter() {
  const viewport = routeMap.querySelector(".osm-scroll-map");
  if (!viewport || !previewMapState) return null;
  const scale = 256 * 2 ** previewMapState.zoom;
  const worldX = previewMapState.canvasLeft + viewport.scrollLeft + viewport.clientWidth / 2;
  const worldY = previewMapState.canvasTop + viewport.scrollTop + viewport.clientHeight / 2;
  const longitude = worldX / scale * 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI - 2 * Math.PI * worldY / scale)) * 180 / Math.PI;
  return [latitude, longitude];
}

function renderRequirements(analysis) {
  const requirements = analysis?.requirements ?? [];
  requirementsPreview.hidden = requirements.length === 0;
  requirementsList.innerHTML = requirements.map(({ requirement, met }) => `<li class="requirement ${met ? "met" : "missing"}"><span aria-hidden="true">${met ? "✓" : "✕"}</span>${escapeHtml(requirement)}</li>`).join("");
}

function showDashboard() {
  selectedJobId = null; importedJobData = {}; extractedJob = null; commute = null; processingResult = null;
  detailView.hidden = true; dashboardView.hidden = false; renderHistory();
}

function showJobDetail(job = null) {
  selectedJobId = job?.id ?? null; dashboardView.hidden = true; detailView.hidden = false;
  detailTitle.textContent = job ? "Job details" : "New job"; statusEl.textContent = job ? `Last processed: ${formatDate(job.updatedAt)}` : ""; importStatusEl.textContent = "";
  jobUrlEl.value = job?.jobUrl ?? activePageUrl; originEl.value = job?.origin ?? ""; commuteModeEl.value = job?.commuteMode ?? "driving";
  positionNameEl.value = job?.positionName ?? job?.extractedJob?.positionName ?? ""; companyNameEl.value = job?.companyName ?? job?.extractedJob?.companyName ?? "";
  workLocationEl.value = job?.workLocation ?? job?.extractedJob?.workLocation ?? ""; jobDescriptionEl.value = job?.jobDescription ?? job?.extractedJob?.jobDescription ?? "";
  importedJobData = { source: job?.source ?? job?.extractedJob?.source ?? "", extractedAt: job?.extractedAt ?? job?.extractedJob?.extractedAt ?? "" };
  extractedJob = job?.extractedJob ?? (job?.positionName ? { positionName: job.positionName, companyName: job.companyName, workLocation: job.workLocation, jobDescription: job.jobDescription } : null);
  commute = job?.commute ?? null; processingResult = job?.processingResult ?? null;
  renderResults(job); renderRouteMap(commute); renderRequirements(processingResult?.requirementsAnalysis);
}

function loadActivePageUrl() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => { activePageUrl = /^https?:\/\//i.test(tab?.url ?? "") ? tab.url : ""; });
}

function loadHistory() {
  chrome.storage.local.get(["jobHistory", "jobContext"], (stored) => {
    jobHistory = Array.isArray(stored.jobHistory) ? stored.jobHistory : [];
    if (!jobHistory.length && stored.jobContext) { jobHistory = [{ id: crypto.randomUUID(), ...stored.jobContext }]; chrome.storage.local.set({ jobHistory }); }
    isHomepage ? showDashboard() : showJobDetail();
  });
}

document.getElementById("new-job").addEventListener("click", () => showJobDetail());
const openHomepage = () => chrome.tabs.create({ url: `${chrome.runtime.getURL("popup.html")}?homepage=1` });
document.getElementById("open-homepage").addEventListener("click", openHomepage);
document.getElementById("open-homepage-detail").addEventListener("click", openHomepage);
document.getElementById("back-to-dashboard").addEventListener("click", showDashboard);
if (!isHomepage) document.getElementById("back-to-dashboard").hidden = true;

importCurrentPageEl.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id || !isLinkedInJobsUrl(tab.url)) { importStatusEl.textContent = "Open a LinkedIn job page, then try import again."; return; }
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
      if (chrome.runtime.lastError) { importStatusEl.textContent = "Could not access this LinkedIn page."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_LINKEDIN_JOB" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) { importStatusEl.textContent = "Could not extract job details from this page."; return; }
        const job = response.job; extractedJob = job; importedJobData = { source: job.source, extractedAt: job.extractedAt };
        jobUrlEl.value = job.jobUrl || tab.url || ""; positionNameEl.value = job.positionName || ""; companyNameEl.value = job.companyName || ""; workLocationEl.value = job.workLocation || ""; jobDescriptionEl.value = job.jobDescription || "";
        importStatusEl.textContent = "Imported LinkedIn job details.";
      });
    });
  });
});

extractActiveJobButton.addEventListener("click", () => {
  statusEl.textContent = "Extracting the active page…";
  chrome.runtime.sendMessage({ type: "EXTRACT_ACTIVE_JOB" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) { statusEl.textContent = response?.error || "Could not extract this page."; return; }
    extractedJob = response.job; jobUrlEl.value = response.job.sourceUrl || jobUrlEl.value; positionNameEl.value = response.job.positionName || ""; companyNameEl.value = response.job.companyName || ""; workLocationEl.value = response.job.workLocation || ""; jobDescriptionEl.value = response.job.jobDescription || "";
    statusEl.textContent = `Extracted ${response.job.positionName || "job details"}. Save this job to keep the test result.`;
    renderResults({ jobUrl: jobUrlEl.value, origin: originEl.value, commuteMode: commuteModeEl.value, updatedAt: response.job.extractedAt, extractedJob, commute });
  });
});

calculateCommuteButton.addEventListener("click", () => {
  statusEl.textContent = "Calculating live commute…";
  const destination = [companyNameEl.value.trim(), (workLocationEl.value || extractedJob?.workLocation || "").trim()].filter(Boolean).join(", ");
  chrome.storage.local.get(["routesApiKey"], ({ routesApiKey }) => {
    computeCommute({ origin: originEl.value, destination, mode: commuteModeEl.value, apiKey: routesApiKey })
      .then((calculatedCommute) => {
        commute = calculatedCommute;
        statusEl.textContent = `Live commute: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`;
        renderResults({ jobUrl: jobUrlEl.value, origin: originEl.value, commuteMode: commuteModeEl.value, updatedAt: new Date().toISOString(), positionName: positionNameEl.value, companyName: companyNameEl.value, workLocation: workLocationEl.value, jobDescription: jobDescriptionEl.value, extractedJob, commute });
        renderRouteMap(commute);
      })
      .catch((error) => { statusEl.textContent = error.message || "Could not calculate the commute."; });
  });
});

routeRecenterButton.addEventListener("click", () => { if (!previewRoute) return; requestedMapCenter = null; renderRouteMap(previewRoute); });
routeZoomOutButton.addEventListener("click", () => { if (!previewRoute) return; requestedMapCenter = getCurrentMapCenter(); routeZoomOffset -= 1; renderRouteMap(previewRoute); });
routeZoomInButton.addEventListener("click", () => { if (!previewRoute) return; requestedMapCenter = getCurrentMapCenter(); routeZoomOffset += 1; renderRouteMap(previewRoute); });

historyBody.addEventListener("click", (event) => { const rowButton = event.target.closest("[data-job-id]"); if (!rowButton) return; const job = jobHistory.find((entry) => entry.id === rowButton.dataset.jobId); if (job) showJobDetail(job); });

form.addEventListener("submit", (event) => {
  event.preventDefault();
  chrome.runtime.sendMessage({ type: "SAVE_JOB_ENTRY", id: selectedJobId, jobUrl: jobUrlEl.value.trim(), origin: originEl.value.trim(), commuteMode: commuteModeEl.value, source: importedJobData.source, positionName: positionNameEl.value.trim(), companyName: companyNameEl.value.trim(), workLocation: workLocationEl.value.trim(), jobDescription: jobDescriptionEl.value.trim(), extractedAt: importedJobData.extractedAt, extractedJob, commute, processingResult }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) { statusEl.textContent = "Could not save this job."; return; }
    jobHistory = response.jobHistory;
    if (isHomepage) showDashboard(); else showJobDetail(jobHistory.find((entry) => entry.id === (selectedJobId || jobHistory[0]?.id)));
  });
});

loadActivePageUrl();
loadHistory();
