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

let jobHistory = [];
let selectedJobId = null;

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
  jobUrlEl.value = job?.jobUrl ?? "";
  originEl.value = job?.origin ?? "";
  commuteModeEl.value = job?.commuteMode ?? "driving";
  renderResults(job);
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
      commuteMode: commuteModeEl.value
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

loadHistory();
