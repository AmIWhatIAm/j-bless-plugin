import { createRoutePreview } from "./popup/maps/route-preview.js";
import { renderHistory, renderRequirements, renderResults } from "./popup/views/job-renderers.js";
import { computeCommute, createGoogleMapsUrl } from "./route-service.js";
import { formatDate, isLinkedInJobsUrl } from "./popup/utils/job-utils.js";

const $ = (id) => document.getElementById(id);
const elements = {
  dashboardView: $("dashboard-view"),
  detailView: $("detail-view"),
  historyBody: $("history-body"),
  form: $("job-form"),
  status: $("status"),
  detailTitle: $("detail-title"),
  jobUrl: $("job-url"),
  origin: $("origin"),
  commuteMode: $("commute-mode"),
  positionName: $("position-name"),
  companyName: $("company-name"),
  workLocation: $("work-location"),
  jobDescription: $("job-description"),
  resumeText: $("resume-text"),
  resultsBody: $("results-body"),
  importCurrentPage: $("import-current-page"),
  importStatus: $("import-status"),
  calculateCommute: $("calculate-commute"),
  processApplication: $("process-application"),
  routePreview: $("route-preview"),
  routeMap: $("route-map"),
  routeRecenter: $("route-recenter"),
  routeZoomOut: $("route-zoom-out"),
  routeZoomIn: $("route-zoom-in"),
  requirementsPreview: $("requirements-preview"), requirementsList: $("requirements-list")
};
const DRAFT_STORAGE_KEY = "jobDraft";
const isHomepage = new URLSearchParams(window.location.search).get("homepage") === "1";
const state = {
  jobHistory: [],
  selectedJobId: null,
  importedJobData: {},
  extractedJob: null,
  activePageUrl: "",
  commute: null,
  processingResult: null
};

function getGoogleMapsUrl() {
  if (state.commute?.googleMapsUrl) return state.commute.googleMapsUrl;
  const origin = elements.origin.value.trim();
  const destination = [elements.companyName.value.trim(), (elements.workLocation.value || state.extractedJob?.workLocation || "").trim()].filter(Boolean).join(", ");
  return origin && destination ? createGoogleMapsUrl({ origin, destination, mode: elements.commuteMode.value }) : "";
}

const routePreview = createRoutePreview({ ...elements, getGoogleMapsUrl });
const renderOutput = (job) => renderResults(elements.resultsBody, job, state);
const renderRequirementList = () => renderRequirements(elements.requirementsPreview, elements.requirementsList, state.processingResult?.requirementsAnalysis);

function currentDraft() {
  return {
    selectedJobId: state.selectedJobId, jobUrl: elements.jobUrl.value, origin: elements.origin.value, commuteMode: elements.commuteMode.value,
    positionName: elements.positionName.value, companyName: elements.companyName.value, workLocation: elements.workLocation.value,
    jobDescription: elements.jobDescription.value, resumeText: elements.resumeText.value, importedJobData: state.importedJobData,
    extractedJob: state.extractedJob, commute: state.commute, processingResult: state.processingResult
  };
}

function saveDraft() {
  if (!elements.detailView.hidden) chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: currentDraft() });
}

function clearDraft() {
  chrome.storage.local.remove(DRAFT_STORAGE_KEY);
}

function populateDetail(job = null) {
  state.selectedJobId = job?.id ?? null;
  elements.dashboardView.hidden = true;
  elements.detailView.hidden = false;
  elements.detailTitle.textContent = job ? "Job details" : "New job";
  elements.status.textContent = job ? `Last processed: ${formatDate(job.updatedAt)}` : "";
  elements.importStatus.textContent = "";
  elements.jobUrl.value = job?.jobUrl ?? state.activePageUrl;
  elements.origin.value = job?.origin ?? "";
  elements.commuteMode.value = job?.commuteMode ?? "driving";
  elements.positionName.value = job?.positionName ?? job?.extractedJob?.positionName ?? "";
  elements.companyName.value = job?.companyName ?? job?.extractedJob?.companyName ?? "";
  elements.workLocation.value = job?.workLocation ?? job?.extractedJob?.workLocation ?? "";
  elements.jobDescription.value = job?.jobDescription ?? job?.extractedJob?.jobDescription ?? "";
  elements.resumeText.value = "";
  state.importedJobData = { source: job?.source ?? job?.extractedJob?.source ?? "", extractedAt: job?.extractedAt ?? job?.extractedJob?.extractedAt ?? "" };
  state.extractedJob = job?.extractedJob ?? (job?.positionName ? { positionName: job.positionName, companyName: job.companyName, workLocation: job.workLocation, jobDescription: job.jobDescription } : null);
  state.commute = job?.commute ?? null;
  state.processingResult = job?.processingResult ?? null;
  renderOutput(job);
  routePreview.render(state.commute);
  renderRequirementList();
}

function restoreDraft(draft) {
  populateDetail();
  state.selectedJobId = draft.selectedJobId ?? null;
  elements.detailTitle.textContent = state.selectedJobId ? "Job details" : "New job";
  elements.status.textContent = "Restored unsaved draft.";
  const fields = {
    jobUrl: elements.jobUrl,
    origin: elements.origin,
    commuteMode: elements.commuteMode,
    positionName: elements.positionName,
    companyName: elements.companyName,
    workLocation: elements.workLocation,
    jobDescription: elements.jobDescription,
    resumeText: elements.resumeText
  };
  for (const [key, element] of Object.entries(fields)) {
    const fallback = key === "jobUrl" ? state.activePageUrl : key === "commuteMode" ? "driving" : "";
    element.value = draft[key] ?? fallback;
  }
  state.importedJobData = draft.importedJobData ?? {};
  state.extractedJob = draft.extractedJob ?? null;
  state.commute = draft.commute ?? null;
  state.processingResult = draft.processingResult ?? null;
  renderOutput({ ...currentDraft(), updatedAt: new Date().toISOString() });
  routePreview.render(state.commute);
  renderRequirementList();
}

function showDashboard() {
  Object.assign(state, { selectedJobId: null, importedJobData: {}, extractedJob: null, commute: null, processingResult: null });
  elements.detailView.hidden = true;
  elements.dashboardView.hidden = false;
  renderHistory(elements.historyBody, state.jobHistory);
}

function persistCurrentJob({ clearSavedDraft = false, onSaved } = {}) {
  const draft = currentDraft();
  chrome.runtime.sendMessage({ type: "SAVE_JOB_ENTRY", id: state.selectedJobId, ...draft, source: state.importedJobData.source, extractedAt: state.importedJobData.extractedAt }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      elements.status.textContent = "Could not save this job.";
      return;
    }
    state.jobHistory = response.jobHistory;
    state.selectedJobId = response.jobHistory.find((entry) => entry.id === (state.selectedJobId || response.jobHistory[0]?.id))?.id ?? state.selectedJobId;
    if (clearSavedDraft) clearDraft();
    onSaved?.();
  });
}

function importCurrentJob() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id || !isLinkedInJobsUrl(tab.url)) {
      elements.importStatus.textContent = "Open a LinkedIn job page, then try import again.";
      return;
    }
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
      if (chrome.runtime.lastError) {
        elements.importStatus.textContent = "Could not access this LinkedIn page.";
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_LINKEDIN_JOB" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          elements.importStatus.textContent = "Could not extract job details from this page.";
          return;
        }
        const job = response.job;
        state.extractedJob = job;
        state.importedJobData = { source: job.source, extractedAt: job.extractedAt };
        elements.jobUrl.value = job.jobUrl || tab.url || "";
        elements.positionName.value = job.positionName || "";
        elements.companyName.value = job.companyName || "";
        elements.workLocation.value = job.workLocation || "";
        elements.jobDescription.value = job.jobDescription || "";
        elements.importStatus.textContent = "Imported LinkedIn job details.";
        saveDraft();
      });
    });
  });
}

function calculateCommute() {
  elements.status.textContent = "Calculating live commute…";
  const destination = [elements.companyName.value.trim(), (elements.workLocation.value || state.extractedJob?.workLocation || "").trim()].filter(Boolean).join(", ");
  computeCommute({ origin: elements.origin.value, destination, mode: elements.commuteMode.value })
    .then((commute) => {
      state.commute = commute;
      elements.status.textContent = `Live commute: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`;
      renderOutput({ ...currentDraft(), updatedAt: new Date().toISOString() });
      routePreview.render(commute);
      saveDraft();
      if (elements.jobUrl.value.trim() && elements.origin.value.trim()) persistCurrentJob({ onSaved: () => { elements.status.textContent = `Commute saved: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`; } });
    })
    .catch((error) => { elements.status.textContent = error.message || "Could not calculate the commute."; });
}

function processApplication() {
  elements.status.textContent = "Generating application outputs…";
  const job = { companyName: elements.companyName.value.trim(), positionName: elements.positionName.value.trim(), workLocation: elements.workLocation.value.trim(), jobDescription: elements.jobDescription.value.trim() };
  chrome.runtime.sendMessage({ type: "PROCESS_APPLICATION", payload: { job, resumeText: elements.resumeText.value, origin: elements.origin.value, commuteMode: elements.commuteMode.value } }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      elements.status.textContent = response?.error || "Could not generate the application outputs.";
      return;
    }
    state.processingResult = response.result;
    if (!state.commute && state.processingResult.commute) state.commute = state.processingResult.commute;
    elements.status.textContent = "Application outputs generated. Save this job to keep them in history.";
    renderOutput({ ...currentDraft(), ...job, updatedAt: new Date().toISOString() });
    routePreview.render(state.commute);
    renderRequirementList();
    saveDraft();
  });
}

function openHomepage() {
  const url = `${chrome.runtime.getURL("popup.html")}?homepage=1`;
  chrome.tabs.create({ url }, () => { if (chrome.runtime.lastError) window.location.assign(url); });
}

$("new-job").addEventListener("click", () => { populateDetail(); clearDraft(); });
$("open-homepage").addEventListener("click", openHomepage);
$("open-homepage-detail").addEventListener("click", openHomepage);
$("back-to-dashboard").addEventListener("click", showDashboard);
if (!isHomepage) $("back-to-dashboard").hidden = true;
elements.importCurrentPage.addEventListener("click", importCurrentJob);
elements.calculateCommute.addEventListener("click", calculateCommute);
elements.processApplication.addEventListener("click", processApplication);
elements.routeRecenter.addEventListener("click", () => routePreview.recenter());
elements.routeZoomOut.addEventListener("click", () => routePreview.zoomBy(-1));
elements.routeZoomIn.addEventListener("click", () => routePreview.zoomBy(1));
elements.historyBody.addEventListener("click", (event) => {
  const outputButton = event.target.closest("[data-open-output]");
  if (outputButton) return chrome.tabs.create({ url: `${chrome.runtime.getURL("output-preview.html")}?jobId=${encodeURIComponent(outputButton.dataset.openOutput)}` });
  const rowButton = event.target.closest("[data-job-id]");
  const job = state.jobHistory.find((entry) => entry.id === rowButton?.dataset.jobId);
  if (job) populateDetail(job);
});
[elements.jobUrl, elements.origin, elements.commuteMode, elements.positionName, elements.companyName, elements.workLocation, elements.jobDescription, elements.resumeText].forEach((field) => {
  field.addEventListener("input", saveDraft);
  field.addEventListener("change", saveDraft);
});
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistCurrentJob({ clearSavedDraft: true, onSaved: () => isHomepage ? showDashboard() : populateDetail(state.jobHistory.find((entry) => entry.id === state.selectedJobId)) });
});

chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => { state.activePageUrl = /^https?:\/\//i.test(tab?.url ?? "") ? tab.url : ""; });
chrome.storage.local.get(["jobHistory", "jobContext", DRAFT_STORAGE_KEY], (stored) => {
  state.jobHistory = Array.isArray(stored.jobHistory) ? stored.jobHistory : [];
  if (!state.jobHistory.length && stored.jobContext) {
    state.jobHistory = [{ id: crypto.randomUUID(), ...stored.jobContext }];
    chrome.storage.local.set({ jobHistory: state.jobHistory });
  }
  if (isHomepage) showDashboard();
  else if (stored[DRAFT_STORAGE_KEY]) restoreDraft(stored[DRAFT_STORAGE_KEY]);
  else populateDetail();
});
