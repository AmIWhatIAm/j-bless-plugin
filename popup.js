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

let jobHistory = [];
let selectedJobId = null;
let importedJobData = {};
const isHomepage = new URLSearchParams(window.location.search).get("homepage") === "1";

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

function getJobLabel(job) {
  if (job?.positionName || job?.companyName) {
    return [job.positionName, job.companyName].filter(Boolean).join(" at ");
  }

  try {
    return new URL(job.jobUrl).hostname.replace(/^www\./, "");
  } catch {
    return job?.jobUrl || "Untitled job";
  }
}

function formatCommuteMode(mode) {
  return mode === "public_transport" ? "Public transport" : "Driving";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function isLinkedInJobsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.linkedin.com" && /^\/jobs\/view\/\d+\/?/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function renderHistory() {
  if (!jobHistory.length) {
    historyBody.innerHTML =
      '<tr><td colspan="4" class="empty">No processed jobs yet. Select "New job" to add one.</td></tr>';
    return;
  }

  historyBody.innerHTML = jobHistory
    .map(
      (job) => `
        <tr>
          <td><button class="history-row" type="button" data-job-id="${escapeHtml(job.id)}">
            <span>${escapeHtml(getJobLabel(job))}</span>
            <small>${escapeHtml(normalizeUrl(job.jobUrl))}</small>
          </button></td>
          <td>${escapeHtml(job.origin || "-")}</td>
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
    ["Job portal", getJobLabel(job)],
    ["Position", job.positionName],
    ["Company", job.companyName],
    ["Work location", job.workLocation],
    ["Starting point", (job.origin || "").trim()],
    ["Commute mode", formatCommuteMode(job.commuteMode)],
    ["Job description", job.jobDescription],
    ["Extracted", formatDate(job.extractedAt)],
    ["Processed", formatDate(job.updatedAt)]
  ];

  resultsBody.innerHTML = rows
    .map(
      ([field, output]) => `
        <tr>
          <td>${escapeHtml(field)}</td>
          <td class="muted">${escapeHtml(output || "-")}</td>
        </tr>`
    )
    .join("");
}

function showDashboard() {
  selectedJobId = null;
  importedJobData = {};
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
  importStatusEl.textContent = "";
  jobUrlEl.value = job?.jobUrl ?? "";
  originEl.value = job?.origin ?? "";
  commuteModeEl.value = job?.commuteMode ?? "driving";
  positionNameEl.value = job?.positionName ?? "";
  companyNameEl.value = job?.companyName ?? "";
  workLocationEl.value = job?.workLocation ?? "";
  jobDescriptionEl.value = job?.jobDescription ?? "";
  importedJobData = {
    source: job?.source ?? "",
    extractedAt: job?.extractedAt ?? ""
  };
  renderResults(job);
}

function loadHistory() {
  chrome.storage.local.get(["jobHistory", "jobContext"], (stored) => {
    jobHistory = Array.isArray(stored.jobHistory) ? stored.jobHistory : [];

    if (!jobHistory.length && stored.jobContext) {
      jobHistory = [{ id: crypto.randomUUID(), ...stored.jobContext }];
      chrome.storage.local.set({ jobHistory });
    }

    if (isHomepage) {
      showDashboard();
    } else {
      showJobDetail();
    }
  });
}

document.getElementById("new-job").addEventListener("click", () => showJobDetail());
document.getElementById("open-homepage").addEventListener("click", () => {
  chrome.tabs.create({ url: `${chrome.runtime.getURL("popup.html")}?homepage=1` });
});
document.getElementById("open-homepage-detail").addEventListener("click", () => {
  chrome.tabs.create({ url: `${chrome.runtime.getURL("popup.html")}?homepage=1` });
});
document.getElementById("back-to-dashboard").addEventListener("click", showDashboard);

if (!isHomepage) {
  document.getElementById("back-to-dashboard").hidden = true;
}

importCurrentPageEl.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id || !isLinkedInJobsUrl(tab.url)) {
      importStatusEl.textContent = "Open a LinkedIn job page, then try import again.";
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["content.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          importStatusEl.textContent = "Could not access this LinkedIn page.";
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_LINKEDIN_JOB" }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            importStatusEl.textContent = "Could not extract job details from this page.";
            return;
          }

          const job = response.job;
          importedJobData = {
            source: job.source,
            extractedAt: job.extractedAt
          };
          jobUrlEl.value = job.jobUrl || tab.url || "";
          positionNameEl.value = job.positionName || "";
          companyNameEl.value = job.companyName || "";
          workLocationEl.value = job.workLocation || "";
          jobDescriptionEl.value = job.jobDescription || "";
          importStatusEl.textContent = "Imported LinkedIn job details.";
        });
      }
    );
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
      source: importedJobData.source,
      positionName: positionNameEl.value.trim(),
      companyName: companyNameEl.value.trim(),
      workLocation: workLocationEl.value.trim(),
      jobDescription: jobDescriptionEl.value.trim(),
      extractedAt: importedJobData.extractedAt
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        statusEl.textContent = "Could not save this job.";
        return;
      }

      jobHistory = response.jobHistory;
      if (isHomepage) {
        showDashboard();
      } else {
        const savedJob = jobHistory.find((entry) => entry.id === (selectedJobId || jobHistory[0]?.id));
        showJobDetail(savedJob);
      }
    }
  );
});

loadHistory();
