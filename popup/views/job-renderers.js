import { escapeHtml, formatCommuteMode, formatDate, getJobLabel, normalizeUrl } from "../utils/job-utils.js";

export function renderHistory(historyBody, jobHistory) {
  if (!jobHistory.length) {
    historyBody.innerHTML = '<tr><td colspan="5" class="empty">No processed jobs yet. Select "New job" to add one.</td></tr>';
    return;
  }
  historyBody.innerHTML = jobHistory.map((job) => `
    <tr><td><button class="history-row" type="button" data-job-id="${escapeHtml(job.id)}"><span>${escapeHtml(getJobLabel(job))}</span><small>${escapeHtml(normalizeUrl(job.jobUrl))}</small></button></td>
    <td>${escapeHtml(job.origin || "-")}</td><td>${escapeHtml(formatCommuteMode(job.commuteMode))}</td><td>${job.processingResult ? `<button class="btn btn-link" type="button" data-open-output="${escapeHtml(job.id)}">View output</button>` : "Not generated"}</td><td>${escapeHtml(formatDate(job.updatedAt))}</td></tr>`).join("");
}

export function renderResults(resultsBody, job, fallback = {}) {
  if (!job) {
    resultsBody.innerHTML = '<tr><td colspan="2" class="empty">Save the job to see its processed output.</td></tr>';
    return;
  }
  const extracted = job.extractedJob || fallback.extractedJob;
  const route = job.commute || fallback.commute;
  const output = job.processingResult || fallback.processingResult;
  const rows = [
    ["Job posting", normalizeUrl(job.jobUrl)], ["Job portal", getJobLabel(job)],
    ["Position", job.positionName || extracted?.positionName], ["Company", job.companyName || extracted?.companyName],
    ["Work location", job.workLocation || extracted?.workLocation], ["Starting point", (job.origin || "").trim()],
    ["Commute mode", formatCommuteMode(job.commuteMode)], ["Job description", job.jobDescription || extracted?.jobDescription]
  ];
  if (route) {
    rows.push(["Commute duration", route.durationText], ["Commute distance", route.distanceText]);
    if (route.googleMapsUrl) rows.push(["Route", `<a href="${escapeHtml(route.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`]);
  }
  if (output) rows.push(["Missing requirements", output.missingRequirements?.join(", ") || "None identified"]);
  rows.push(["Extracted", formatDate(job.extractedAt)], ["Processed", formatDate(job.updatedAt)]);
  resultsBody.innerHTML = rows.map(([field, value]) => `<tr><td>${escapeHtml(field)}</td><td class="muted">${field === "Route" ? value : escapeHtml(value || "-")}</td></tr>`).join("");
}

export function renderRequirements(requirementsPreview, requirementsList, analysis) {
  const requirements = analysis?.requirements ?? [];
  requirementsPreview.hidden = requirements.length === 0;
  requirementsList.innerHTML = requirements.map(({ requirement, met }) => `<li class="requirement ${met ? "met" : "missing"}"><span aria-hidden="true">${met ? "✓" : "✕"}</span>${escapeHtml(requirement)}</li>`).join("");
}
