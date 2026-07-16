const dashboardView = document.getElementById("dashboard-view");
const detailView = document.getElementById("detail-view");
const historyBody = document.getElementById("history-body");
const form = document.getElementById("job-form");
const statusEl = document.getElementById("status");
const detailTitle = document.getElementById("detail-title");
const jobUrlEl = document.getElementById("job-url");
const originEl = document.getElementById("origin");
const commuteModeEl = document.getElementById("commute-mode");
const resultsBody = document.getElementById("results-body");
const extractActiveJobButton = document.getElementById("extract-active-job");
const calculateCommuteButton = document.getElementById("calculate-commute");
const routesApiKeyEl = document.getElementById("routes-api-key");
const routePreview = document.getElementById("route-preview");
const routeMap = document.getElementById("route-map");
const requirementsPreview = document.getElementById("requirements-preview");
const requirementsList = document.getElementById("requirements-list");

let jobHistory = [];
let selectedJobId = null;
let extractedJob = null;
let activePageUrl = "";
let commute = null;
let processingResult = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";

  try {
    return new URL(rawUrl).toString();
  } catch {
    return rawUrl.trim();
  }
}

function getJobLabel(jobUrl) {
  try {
    return new URL(jobUrl).hostname.replace(/^www\./, "");
  } catch {
    return jobUrl || "Untitled job";
  }
}

function formatCommuteMode(mode) {
  return mode === "public_transport" ? "Public transport" : "Driving";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function renderHistory() {
  if (!jobHistory.length) {
    historyBody.innerHTML =
      '<tr><td colspan="4" class="empty">No processed jobs yet. Select “New job” to add one.</td></tr>';
    return;
  }

  historyBody.innerHTML = jobHistory
    .map(
      (job) => `
        <tr>
          <td><button class="history-row" type="button" data-job-id="${escapeHtml(job.id)}">
            <span>${escapeHtml(getJobLabel(job.jobUrl))}</span>
            <small>${escapeHtml(normalizeUrl(job.jobUrl))}</small>
          </button></td>
          <td>${escapeHtml(job.origin || "—")}</td>
          <td>${escapeHtml(formatCommuteMode(job.commuteMode))}</td>
          <td>${escapeHtml(formatDate(job.updatedAt))}</td>
        </tr>`
    )
    .join("");
}

function renderResults(job) {
  if (!job) {
    resultsBody.innerHTML =
      '<tr><td colspan="2" class="empty">Save the job to see its processed output.</td></tr>';
    return;
  }

  const rows = [
    ["Job posting", normalizeUrl(job.jobUrl)],
    ["Job portal", getJobLabel(job.jobUrl)],
    ["Starting point", (job.origin || "").trim()],
    ["Commute mode", formatCommuteMode(job.commuteMode)],
    ["Processed", formatDate(job.updatedAt)]
  ];

  if (job.extractedJob) {
    rows.splice(2, 0,
      ["Company", job.extractedJob.companyName],
      ["Position", job.extractedJob.positionName],
      ["Work location", job.extractedJob.workLocation],
      ["Job description", job.extractedJob.jobDescription]
    );
  }
  if (job.commute) {
    rows.splice(-1, 0, ["Commute duration", job.commute.durationText], ["Commute distance", job.commute.distanceText]);
  }

  resultsBody.innerHTML = rows
    .map(
      ([field, output]) => `
        <tr>
          <td>${escapeHtml(field)}</td>
          <td class="muted">${escapeHtml(output || "—")}</td>
        </tr>`
    )
    .join("");
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0, latitude = 0, longitude = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([latitude / 1e5, longitude / 1e5]);
  }
  return points;
}

function renderRouteMap(route) {
  if (!route?.encodedPolyline) {
    routePreview.hidden = true;
    return;
  }
  const points = decodePolyline(route.encodedPolyline);
  if (points.length < 2) return;
  const latitudes = points.map(([lat]) => lat);
  const longitudes = points.map(([, lng]) => lng);
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
  const width = 620, height = 260, padding = 22;
  const x = (lng) => padding + ((lng - minLng) / (maxLng - minLng || 1)) * (width - padding * 2);
  const y = (lat) => height - padding - ((lat - minLat) / (maxLat - minLat || 1)) * (height - padding * 2);
  const line = points.map(([lat, lng]) => `${x(lng).toFixed(1)},${y(lat).toFixed(1)}`).join(" ");
  const [startLat, startLng] = points[0];
  const [endLat, endLng] = points.at(-1);
  routeMap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect width="100%" height="100%" fill="#eef4ee"/><polyline points="${line}" fill="none" stroke="#176b4d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(startLng)}" cy="${y(startLat)}" r="8" fill="#2e6de0"/><circle cx="${x(endLng)}" cy="${y(endLat)}" r="8" fill="#d94545"/></svg><p><span class="route-start">●</span> Start &nbsp; <span class="route-end">●</span> Work location</p>`;
  routePreview.hidden = false;
}

function renderRequirements(analysis) {
  const requirements = analysis?.requirements ?? [];
  requirementsPreview.hidden = requirements.length === 0;
  requirementsList.innerHTML = requirements
    .map(({ requirement, met }) => `<li class="requirement ${met ? "met" : "missing"}"><span aria-hidden="true">${met ? "✓" : "✕"}</span>${escapeHtml(requirement)}</li>`)
    .join("");
}

function showDashboard() {
  selectedJobId = null;
  detailView.hidden = true;
  dashboardView.hidden = false;
  renderHistory();
}

function showJobDetail(job = null) {
  selectedJobId = job?.id ?? null;
  dashboardView.hidden = true;
  detailView.hidden = false;
  detailTitle.textContent = job ? "Job details" : "New job";
  statusEl.textContent = job ? `Last processed: ${formatDate(job.updatedAt)}` : "";
  jobUrlEl.value = job?.jobUrl ?? activePageUrl;
  originEl.value = job?.origin ?? "";
  commuteModeEl.value = job?.commuteMode ?? "driving";
  extractedJob = job?.extractedJob ?? null;
  commute = job?.commute ?? null;
  processingResult = job?.processingResult ?? null;
  renderResults(job);
  renderRouteMap(commute);
  renderRequirements(processingResult?.requirementsAnalysis);
}

function loadActivePageUrl() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
    const url = tab?.url ?? "";
    activePageUrl = /^https?:\/\//i.test(url) ? url : "";
  });
}

function loadHistory() {
  chrome.storage.local.get(["jobHistory", "jobContext"], (stored) => {
    jobHistory = Array.isArray(stored.jobHistory) ? stored.jobHistory : [];

    // Preserve the single saved context from previous versions as the first history item.
    if (!jobHistory.length && stored.jobContext) {
      jobHistory = [{ id: crypto.randomUUID(), ...stored.jobContext }];
      chrome.storage.local.set({ jobHistory });
    }

    showDashboard();
  });
}

document.getElementById("new-job").addEventListener("click", () => showJobDetail());
document.getElementById("back-to-dashboard").addEventListener("click", showDashboard);

extractActiveJobButton.addEventListener("click", () => {
  statusEl.textContent = "Extracting the active page…";
  chrome.runtime.sendMessage({ type: "EXTRACT_ACTIVE_JOB" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      statusEl.textContent = response?.error || "Could not extract this page.";
      return;
    }
    extractedJob = response.job;
    jobUrlEl.value = response.job.sourceUrl || jobUrlEl.value;
    statusEl.textContent = `Extracted ${response.job.positionName || "job details"}. Save this job to keep the test result.`;
    renderResults({
      jobUrl: jobUrlEl.value,
      origin: originEl.value,
      commuteMode: commuteModeEl.value,
      updatedAt: response.job.extractedAt,
      extractedJob,
      commute
    });
  });
});

calculateCommuteButton.addEventListener("click", () => {
  statusEl.textContent = "Calculating live commute…";
  chrome.runtime.sendMessage({
    type: "COMPUTE_COMMUTE",
    payload: { origin: originEl.value, destination: extractedJob?.workLocation, mode: commuteModeEl.value, apiKey: routesApiKeyEl.value }
  }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      statusEl.textContent = response?.error || "Could not calculate the commute.";
      return;
    }
    commute = response.commute;
    statusEl.textContent = `Live commute: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`;
    renderResults({ jobUrl: jobUrlEl.value, origin: originEl.value, commuteMode: commuteModeEl.value, updatedAt: new Date().toISOString(), extractedJob, commute });
    renderRouteMap(commute);
  });
});

historyBody.addEventListener("click", (event) => {
  const rowButton = event.target.closest("[data-job-id]");
  if (!rowButton) return;

  const job = jobHistory.find((entry) => entry.id === rowButton.dataset.jobId);
  if (job) showJobDetail(job);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  chrome.runtime.sendMessage(
    {
      type: "SAVE_JOB_ENTRY",
      id: selectedJobId,
      jobUrl: jobUrlEl.value.trim(),
      origin: originEl.value.trim(),
      commuteMode: commuteModeEl.value,
      extractedJob,
      commute,
      processingResult
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        statusEl.textContent = "Could not save this job.";
        return;
      }

      jobHistory = response.jobHistory;
      showDashboard();
    }
  );
});

loadActivePageUrl();
loadHistory();
