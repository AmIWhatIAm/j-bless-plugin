import { createRoutePreview } from "./popup/maps/route-preview.js";
import {
  renderHistory,
  renderRequirements,
  renderResults,
} from "./popup/views/job-renderers.js";
import { computeCommute, createGoogleMapsUrl } from "./route-service.js";
import { formatDate, getJobLabel, isLinkedInJobsUrl } from "./popup/utils/job-utils.js";

const $ = (id) => document.getElementById(id);
const elements = {
  dashboardView: $("dashboard-view"),
  profileView: $("profile-view"),
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
  routePreview: $("route-preview"),
  routeMap: $("route-map"),
  routeRecenter: $("route-recenter"),
  routeZoomOut: $("route-zoom-out"),
  routeZoomIn: $("route-zoom-in"),
  requirementsPreview: $("requirements-preview"),
  requirementsList: $("requirements-list"),
  resumeFileEl: $("resume-file"),
  resumeTextEl: $("resume-text"),
  generateApplicationButton: $("generate-application"),
  applicationPreview: $("application-preview"),
  coverLetterOutput: $("cover-letter-output"),
  resumeLatexOutput: $("resume-latex-output"),
  copyCoverLetter: $("copy-cover-letter"),
  copyTailoredResume: $("copy-tailored-resume"),
  saveGeneratedChanges: $("save-generated-changes"),
  generatedOutputStatus: $("generated-output-status"),
  profileForm: $("profile-form"),
  defaultOrigin: $("default-origin"),
  defaultResumeText: $("default-resume-text"),
  profileStatus: $("profile-status"),
  defaultOriginNotice: $("default-origin-notice"),
  defaultResumeNotice: $("default-resume-notice"),
  defaultDataActions: $("default-data-actions"),
  clearDefaultData: $("clear-default-data"),
  refillDefaultData: $("refill-default-data"),
};
const DRAFT_STORAGE_KEY = "jobDraft";
const PROFILE_STORAGE_KEY = "userProfile";
const isHomepage =
  new URLSearchParams(window.location.search).get("homepage") === "1";
const state = {
  jobHistory: [],
  selectedJobId: null,
  importedJobData: {},
  extractedJob: null,
  activePageUrl: "",
  commute: null,
  processingResult: null,
  profile: { origin: "", resumeText: "" },
  profileReturnView: "dashboard",
};

function getGoogleMapsUrl() {
  if (state.commute?.googleMapsUrl) return state.commute.googleMapsUrl;
  const origin = elements.origin.value.trim();
  const destination = [
    elements.companyName.value.trim(),
    (
      elements.workLocation.value ||
      state.extractedJob?.workLocation ||
      ""
    ).trim(),
  ]
    .filter(Boolean)
    .join(", ");
  return origin && destination
    ? createGoogleMapsUrl({
        origin,
        destination,
        mode: elements.commuteMode.value,
      })
    : "";
}

const routePreview = createRoutePreview({ ...elements, getGoogleMapsUrl });
const renderOutput = (job) => renderResults(elements.resultsBody, job, state);
const renderRequirementList = () =>
  renderRequirements(
    elements.requirementsPreview,
    elements.requirementsList,
    state.processingResult?.requirementsAnalysis,
  );

function currentDraft() {
  return {
    selectedJobId: state.selectedJobId,
    jobUrl: elements.jobUrl.value,
    origin: elements.origin.value,
    commuteMode: elements.commuteMode.value,
    positionName: elements.positionName.value,
    companyName: elements.companyName.value,
    workLocation: elements.workLocation.value,
    jobDescription: elements.jobDescription.value,
    resumeText: elements.resumeText.value,
    importedJobData: state.importedJobData,
    extractedJob: state.extractedJob,
    commute: state.commute,
    processingResult: state.processingResult,
  };
}

function saveDraft() {
  if (!elements.detailView.hidden)
    chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: currentDraft() });
}

function clearDraft() {
  chrome.storage.local.remove(DRAFT_STORAGE_KEY);
}

function populateDetail(job = null) {
  state.selectedJobId = job?.id ?? null;
  elements.dashboardView.hidden = true;
  elements.detailView.hidden = false;
  elements.detailTitle.textContent = job ? "Job details" : "New job";
  elements.status.textContent = job
    ? `Last processed: ${formatDate(job.updatedAt)}`
    : "";
  elements.importStatus.textContent = "";
  elements.jobUrl.value = job?.jobUrl ?? state.activePageUrl;
  const usesDefaultOrigin = !job && Boolean(state.profile.origin);
  const usesDefaultResume = !job && Boolean(state.profile.resumeText);
  elements.origin.value = job?.origin ?? (usesDefaultOrigin ? state.profile.origin : "");
  elements.commuteMode.value = job?.commuteMode ?? "driving";
  elements.positionName.value =
    job?.positionName ?? job?.extractedJob?.positionName ?? "";
  elements.companyName.value =
    job?.companyName ?? job?.extractedJob?.companyName ?? "";
  elements.workLocation.value =
    job?.workLocation ?? job?.extractedJob?.workLocation ?? "";
  elements.jobDescription.value =
    job?.jobDescription ?? job?.extractedJob?.jobDescription ?? "";
  elements.resumeText.value = job?.resumeText ?? (usesDefaultResume ? state.profile.resumeText : "");
  elements.defaultOriginNotice.hidden = !usesDefaultOrigin;
  elements.defaultResumeNotice.hidden = !usesDefaultResume;
  elements.defaultDataActions.hidden = Boolean(job);
  state.importedJobData = {
    source: job?.source ?? job?.extractedJob?.source ?? "",
    extractedAt: job?.extractedAt ?? job?.extractedJob?.extractedAt ?? "",
  };
  state.extractedJob =
    job?.extractedJob ??
    (job?.positionName
      ? {
          positionName: job.positionName,
          companyName: job.companyName,
          workLocation: job.workLocation,
          jobDescription: job.jobDescription,
        }
      : null);
  state.commute = job?.commute ?? null;
  state.processingResult = job?.processingResult ?? null;
  renderOutput(job);
  routePreview.render(state.commute);
  renderRequirementList();
  renderApplicationPreview(state.processingResult);
}

function restoreDraft(draft) {
  populateDetail();
  state.selectedJobId = draft.selectedJobId ?? null;
  elements.detailTitle.textContent = state.selectedJobId
    ? "Job details"
    : "New job";
  elements.status.textContent = "Restored unsaved draft.";
  const fields = {
    jobUrl: elements.jobUrl,
    origin: elements.origin,
    commuteMode: elements.commuteMode,
    positionName: elements.positionName,
    companyName: elements.companyName,
    workLocation: elements.workLocation,
    jobDescription: elements.jobDescription,
    resumeText: elements.resumeText,
  };
  for (const [key, element] of Object.entries(fields)) {
    const fallback =
      key === "jobUrl"
        ? state.activePageUrl
        : key === "commuteMode"
          ? "driving"
          : "";
    element.value = draft[key] ?? fallback;
  }
  state.importedJobData = draft.importedJobData ?? {};
  state.extractedJob = draft.extractedJob ?? null;
  state.commute = draft.commute ?? null;
  state.processingResult = draft.processingResult ?? null;
  renderOutput({ ...currentDraft(), updatedAt: new Date().toISOString() });
  routePreview.render(state.commute);
  renderRequirementList();
  renderApplicationPreview(state.processingResult);
}

function showDashboard() {
  Object.assign(state, {
    selectedJobId: null,
    importedJobData: {},
    extractedJob: null,
    commute: null,
    processingResult: null,
  });
  elements.detailView.hidden = true;
  elements.profileView.hidden = true;
  elements.dashboardView.hidden = false;
  renderHistory(elements.historyBody, state.jobHistory);
}

function clearFormDefaults() {
  elements.origin.value = "";
  elements.resumeText.value = "";
  elements.defaultOriginNotice.hidden = true;
  elements.defaultResumeNotice.hidden = true;
  elements.status.textContent = "Profile defaults cleared from this form.";
  saveDraft();
}

function refillFormDefaults() {
  elements.origin.value = state.profile.origin;
  elements.resumeText.value = state.profile.resumeText;
  elements.defaultOriginNotice.hidden = !state.profile.origin;
  elements.defaultResumeNotice.hidden = !state.profile.resumeText;
  elements.status.textContent = state.profile.origin || state.profile.resumeText
    ? "Profile defaults added to this form."
    : "No profile defaults are saved yet.";
  saveDraft();
}

function showProfile() {
  state.profileReturnView = elements.detailView.hidden ? "dashboard" : "detail";
  elements.dashboardView.hidden = true;
  elements.detailView.hidden = true;
  elements.profileView.hidden = false;
  elements.defaultOrigin.value = state.profile.origin;
  elements.defaultResumeText.value = state.profile.resumeText;
  elements.profileStatus.textContent = "";
}

function closeProfile() {
  if (state.profileReturnView === "detail") {
    elements.profileView.hidden = true;
    elements.detailView.hidden = false;
    return;
  }
  showDashboard();
}

function saveProfile(event) {
  event.preventDefault();
  state.profile = {
    origin: elements.defaultOrigin.value.trim(),
    resumeText: elements.defaultResumeText.value.trim(),
  };
  chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: state.profile }, () => {
    elements.profileStatus.textContent = chrome.runtime.lastError
      ? "Could not save your profile."
      : "Profile saved locally. New job forms will use this default data.";
  });
}

function persistCurrentJob({ clearSavedDraft = false, onSaved } = {}) {
  const draft = currentDraft();
  chrome.runtime.sendMessage(
    {
      type: "SAVE_JOB_ENTRY",
      id: state.selectedJobId,
      ...draft,
      source: state.importedJobData.source,
      extractedAt: state.importedJobData.extractedAt,
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        elements.status.textContent = "Could not save this job.";
        return;
      }
      state.jobHistory = response.jobHistory;
      state.selectedJobId =
        response.jobHistory.find(
          (entry) =>
            entry.id === (state.selectedJobId || response.jobHistory[0]?.id),
        )?.id ?? state.selectedJobId;
      if (clearSavedDraft) clearDraft();
      onSaved?.();
    },
  );
}

function importCurrentJob() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id || !isLinkedInJobsUrl(tab.url)) {
      elements.importStatus.textContent =
        "Open a LinkedIn job page, then try import again.";
      return;
    }
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ["content.js"] },
      () => {
        if (chrome.runtime.lastError) {
          elements.importStatus.textContent =
            "Could not access this LinkedIn page.";
          return;
        }
        chrome.tabs.sendMessage(
          tab.id,
          { type: "EXTRACT_LINKEDIN_JOB" },
          (response) => {
            if (chrome.runtime.lastError || !response?.ok) {
              elements.importStatus.textContent =
                "Could not extract job details from this page.";
              return;
            }
            const job = response.job;
            state.extractedJob = job;
            state.importedJobData = {
              source: job.source,
              extractedAt: job.extractedAt,
            };
            elements.jobUrl.value = job.jobUrl || tab.url || "";
            elements.positionName.value = job.positionName || "";
            elements.companyName.value = job.companyName || "";
            elements.workLocation.value = job.workLocation || "";
            elements.jobDescription.value = job.jobDescription || "";
            elements.importStatus.textContent =
              "Imported LinkedIn job details.";
            saveDraft();
          },
        );
      },
    );
  });
}

function calculateCommute() {
  elements.status.textContent = "Calculating live commute…";
  const destination = [
    elements.companyName.value.trim(),
    (
      elements.workLocation.value ||
      state.extractedJob?.workLocation ||
      ""
    ).trim(),
  ]
    .filter(Boolean)
    .join(", ");
  computeCommute({
    origin: elements.origin.value,
    destination,
    mode: elements.commuteMode.value,
  })
    .then((commute) => {
      state.commute = commute;
      elements.status.textContent = `Live commute: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`;
      renderOutput({ ...currentDraft(), updatedAt: new Date().toISOString() });
      routePreview.render(commute);
      saveDraft();
      if (elements.jobUrl.value.trim() && elements.origin.value.trim())
        persistCurrentJob({
          onSaved: () => {
            elements.status.textContent = `Commute saved: ${commute.durationText}${commute.distanceText ? ` (${commute.distanceText})` : ""}.`;
          },
        });
    })
    .catch((error) => {
      elements.status.textContent =
        error.message || "Could not calculate the commute.";
    });
}

function processApplication() {
  const job = {
    companyName: elements.companyName.value.trim(),
    positionName: elements.positionName.value.trim(),
    workLocation: elements.workLocation.value.trim(),
    jobDescription: elements.jobDescription.value.trim(),
  };
  const resumeText = elements.resumeText.value.trim();
  if (!job.jobDescription) {
    elements.status.textContent = "Add a job description before generating the CV.";
    return;
  }
  if (!resumeText) {
    elements.status.textContent =
      "Upload a resume file or paste your resume text before generating the CV.";
    return;
  }
  elements.generateApplicationButton.disabled = true;
  elements.generateApplicationButton.textContent = "Generating…";
  elements.status.textContent = "Generating application outputs…";
  chrome.runtime.sendMessage(
    {
      type: "PROCESS_APPLICATION",
      payload: {
        job,
        resumeText,
        origin: elements.origin.value,
        commuteMode: elements.commuteMode.value,
      },
    },
    (response) => {
      elements.generateApplicationButton.disabled = false;
      elements.generateApplicationButton.textContent = "Generate CV and cover letter";
      if (chrome.runtime.lastError || !response?.ok) {
        elements.status.textContent =
          response?.error || "Could not generate the application outputs.";
        return;
      }
      state.processingResult = response.result;
      if (!state.commute && state.processingResult.commute)
        state.commute = state.processingResult.commute;
      elements.status.textContent =
        "Application outputs generated. Save this job to keep them in history.";
      renderOutput({
        ...currentDraft(),
        ...job,
        updatedAt: new Date().toISOString(),
      });
      routePreview.render(state.commute);
      renderRequirementList();
      renderApplicationPreview(state.processingResult);
      saveDraft();
    },
  );
}

async function extractResumeText(file) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    const resumeText = await file.text();
    if (!resumeText.trim()) throw new Error("The resume file is empty.");
    return resumeText;
  }

  const pdfjsLib = await import("./node_modules/pdfjs-dist/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "node_modules/pdfjs-dist/build/pdf.worker.mjs",
  );
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  const resumeText = pages.join("\n").trim();
  if (!resumeText) {
    throw new Error(
      "No selectable text was found in this PDF. Upload an ATS-friendly PDF or paste the resume text."
    );
  }
  return resumeText;
}

function renderApplicationPreview(application) {
  const hasApplication = Boolean(
    application?.coverLetter || application?.tailoredResumeLatex
  );
  elements.applicationPreview.hidden = !hasApplication;
  elements.coverLetterOutput.value = application?.coverLetter || "";
  elements.resumeLatexOutput.value = application?.tailoredResumeLatex || "";
  elements.generatedOutputStatus.textContent = "";
}

async function copyGeneratedOutput(element, label) {
  const text = element.value;
  if (!text) {
    elements.generatedOutputStatus.textContent = `There is no ${label.toLowerCase()} to copy.`;
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    elements.generatedOutputStatus.textContent = `${label} copied to your clipboard.`;
  } catch {
    element.focus();
    element.select();
    const copied = document.execCommand("copy");
    elements.generatedOutputStatus.textContent = copied
      ? `${label} copied to your clipboard.`
      : `Could not copy the ${label.toLowerCase()}. Select it and copy manually.`;
  }
}

function saveEditedApplication() {
  if (!state.processingResult) return;
  state.processingResult.coverLetter = elements.coverLetterOutput.value;
  state.processingResult.tailoredResumeLatex = elements.resumeLatexOutput.value;
  saveDraft();
}

function saveGeneratedChanges() {
  saveEditedApplication();
  chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: currentDraft() }, () => {
    elements.generatedOutputStatus.textContent = chrome.runtime.lastError
      ? "Could not save your generated changes."
      : "Generated changes saved locally.";
  });
}

function openHomepage() {
  const url = `${chrome.runtime.getURL("popup.html")}?homepage=1`;
  chrome.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) window.location.assign(url);
  });
}

$("new-job").addEventListener("click", () => {
  populateDetail();
  clearDraft();
});
$("open-profile").addEventListener("click", showProfile);
$("open-profile-detail").addEventListener("click", showProfile);
$("back-from-profile").addEventListener("click", closeProfile);
elements.profileForm.addEventListener("submit", saveProfile);
$("open-homepage").addEventListener("click", openHomepage);
$("open-homepage-detail").addEventListener("click", openHomepage);
$("back-to-dashboard").addEventListener("click", showDashboard);
if (!isHomepage) $("back-to-dashboard").hidden = true;
elements.importCurrentPage.addEventListener("click", importCurrentJob);
elements.clearDefaultData.addEventListener("click", clearFormDefaults);
elements.refillDefaultData.addEventListener("click", refillFormDefaults);
elements.calculateCommute.addEventListener("click", calculateCommute);
elements.resumeFileEl.addEventListener("change", async () => {
  const [file] = elements.resumeFileEl.files;
  if (!file) return;
  try {
    elements.status.textContent = `Reading ${file.name}…`;
    elements.resumeText.value = await extractResumeText(file);
    elements.status.textContent = `Resume text extracted from ${file.name}.`;
    saveDraft();
  } catch (error) {
    elements.resumeText.value = "";
    elements.status.textContent = error.message || "Could not read this resume file.";
  }
});
elements.generateApplicationButton.addEventListener("click", processApplication);
elements.copyCoverLetter.addEventListener("click", () =>
  copyGeneratedOutput(elements.coverLetterOutput, "Cover letter"),
);
elements.copyTailoredResume.addEventListener("click", () =>
  copyGeneratedOutput(elements.resumeLatexOutput, "Tailored resume"),
);
elements.saveGeneratedChanges.addEventListener("click", saveGeneratedChanges);
elements.coverLetterOutput.addEventListener("input", saveEditedApplication);
elements.resumeLatexOutput.addEventListener("input", saveEditedApplication);
elements.routeRecenter.addEventListener("click", () => routePreview.recenter());
elements.routeZoomOut.addEventListener("click", () => routePreview.zoomBy(-1));
elements.routeZoomIn.addEventListener("click", () => routePreview.zoomBy(1));
elements.historyBody.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-job]");
  if (deleteButton) {
    const job = state.jobHistory.find((entry) => entry.id === deleteButton.dataset.deleteJob);
    if (!job || !window.confirm(`Delete ${getJobLabel(job)} from your saved jobs?`)) return;
    const nextHistory = state.jobHistory.filter((entry) => entry.id !== job.id);
    chrome.storage.local.set({ jobHistory: nextHistory }, () => {
      if (chrome.runtime.lastError) return;
      const renderUpdatedHistory = () => {
        state.jobHistory = nextHistory;
        renderHistory(elements.historyBody, state.jobHistory);
      };
      if (!nextHistory.length) chrome.storage.local.remove("jobContext", renderUpdatedHistory);
      else renderUpdatedHistory();
    });
    return;
  }
  const outputButton = event.target.closest("[data-open-output]");
  if (outputButton)
    return chrome.tabs.create({
      url: `${chrome.runtime.getURL("output-preview.html")}?jobId=${encodeURIComponent(outputButton.dataset.openOutput)}`,
    });
  const rowButton = event.target.closest("[data-job-id]");
  const job = state.jobHistory.find(
    (entry) => entry.id === rowButton?.dataset.jobId,
  );
  if (job) populateDetail(job);
});
[
  elements.jobUrl,
  elements.origin,
  elements.commuteMode,
  elements.positionName,
  elements.companyName,
  elements.workLocation,
  elements.jobDescription,
  elements.resumeText,
].forEach((field) => {
  field.addEventListener("input", saveDraft);
  field.addEventListener("change", saveDraft);
});
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistCurrentJob({
    clearSavedDraft: true,
    onSaved: () =>
      isHomepage
        ? showDashboard()
        : populateDetail(
            state.jobHistory.find((entry) => entry.id === state.selectedJobId),
          ),
  });
});

chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
  state.activePageUrl = /^https?:\/\//i.test(tab?.url ?? "") ? tab.url : "";
});
chrome.storage.local.get(
  ["jobHistory", "jobContext", DRAFT_STORAGE_KEY, PROFILE_STORAGE_KEY],
  (stored) => {
    state.jobHistory = Array.isArray(stored.jobHistory)
      ? stored.jobHistory
      : [];
    if (!state.jobHistory.length && stored.jobContext) {
      state.jobHistory = [{ id: crypto.randomUUID(), ...stored.jobContext }];
      chrome.storage.local.set({ jobHistory: state.jobHistory });
    }
    state.profile = {
      origin: stored[PROFILE_STORAGE_KEY]?.origin ?? "",
      resumeText: stored[PROFILE_STORAGE_KEY]?.resumeText ?? "",
    };
    if (isHomepage) showDashboard();
    else if (stored[DRAFT_STORAGE_KEY]) restoreDraft(stored[DRAFT_STORAGE_KEY]);
    else populateDetail();
  },
);
