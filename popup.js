const dashboardView = document.getElementById("dashboard-view");
const detailView = document.getElementById("detail-view");
const historyBody = document.getElementById("history-body");
const form = document.getElementById("job-form");
const statusEl = document.getElementById("status");
const detailTitle = document.getElementById("detail-title");
const jobUrlEl = document.getElementById("job-url");
const originEl = document.getElementById("origin");
const commuteModeEl = document.getElementById("commute-mode");
const routesApiKeyEl = document.getElementById("routes-api-key");
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
const requirementsPreview = document.getElementById("requirements-preview");
const requirementsList = document.getElementById("requirements-list");

let jobHistory = [];
let selectedJobId = null;
let importedJobData = {};
let extractedJob = null;
let activePageUrl = "";
let commute = null;
let processingResult = null;
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
  const points = decodePolyline(route.encodedPolyline); if (points.length < 2) return;
  const lats = points.map(([lat]) => lat); const lngs = points.map(([, lng]) => lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const width = 620, height = 260, padding = 22;
  const x = (lng) => padding + ((lng - minLng) / (maxLng - minLng || 1)) * (width - padding * 2);
  const y = (lat) => height - padding - ((lat - minLat) / (maxLat - minLat || 1)) * (height - padding * 2);
  const line = points.map(([lat, lng]) => `${x(lng).toFixed(1)},${y(lat).toFixed(1)}`).join(" ");
  const [startLat, startLng] = points[0]; const [endLat, endLng] = points.at(-1);
  routeMap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect width="100%" height="100%" fill="#eef4ee"/><polyline points="${line}" fill="none" stroke="#176b4d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(startLng)}" cy="${y(startLat)}" r="8" fill="#2e6de0"/><circle cx="${x(endLng)}" cy="${y(endLat)}" r="8" fill="#d94545"/></svg><p><span class="route-start">●</span> Start &nbsp; <span class="route-end">●</span> Work location</p>`;
  routePreview.hidden = false;
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
  chrome.runtime.sendMessage({ type: "COMPUTE_COMMUTE", payload: { origin: originEl.value, destination: workLocationEl.value || extractedJob?.workLocation, mode: commuteModeEl.value, apiKey: routesApiKeyEl.value } }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) { statusEl.textContent = response?.error || "Could not calculate the commute."; return; }
    commute = response.commute; statusEl.textContent = `Live commute: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`; renderResults({ jobUrl: jobUrlEl.value, origin: originEl.value, commuteMode: commuteModeEl.value, updatedAt: new Date().toISOString(), positionName: positionNameEl.value, companyName: companyNameEl.value, workLocation: workLocationEl.value, jobDescription: jobDescriptionEl.value, extractedJob, commute }); renderRouteMap(commute);
  });
});

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
