const content = document.getElementById("preview-content");
const subtitle = document.getElementById("preview-subtitle");
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatDate = (value) => value ? new Date(value).toLocaleString() : "-";
const valueOrDash = (value) => escapeHtml(value || "-");
const jobId = new URLSearchParams(location.search).get("jobId");

function render(job) {
  const extracted = job.extractedJob || {};
  const processing = job.processingResult || {};
  const commute = job.commute || {};
  const requirements = processing.requirementsAnalysis?.requirements || [];
  subtitle.textContent = [job.positionName || extracted.positionName, job.companyName || extracted.companyName].filter(Boolean).join(" at ") || "Saved processed job";
  content.innerHTML = `
    <section class="results"><h2>Job details</h2><div class="table-responsive"><table class="table"><tbody>
      <tr><th>Job posting</th><td><a href="${escapeHtml(job.jobUrl)}" target="_blank" rel="noreferrer">${valueOrDash(job.jobUrl)}</a></td></tr>
      <tr><th>Position</th><td>${valueOrDash(job.positionName || extracted.positionName)}</td></tr>
      <tr><th>Company</th><td>${valueOrDash(job.companyName || extracted.companyName)}</td></tr>
      <tr><th>Work location</th><td>${valueOrDash(job.workLocation || extracted.workLocation)}</td></tr>
      <tr><th>Job description</th><td><pre>${valueOrDash(job.jobDescription || extracted.jobDescription)}</pre></td></tr>
      <tr><th>Processed</th><td>${valueOrDash(formatDate(job.updatedAt))}</td></tr>
    </tbody></table></div></section>
    <section class="results"><h2>Commute</h2><div class="table-responsive"><table class="table"><tbody>
      <tr><th>Starting point</th><td>${valueOrDash(job.origin)}</td></tr><tr><th>Mode</th><td>${valueOrDash(job.commuteMode === "public_transport" ? "Public transport" : "Driving")}</td></tr>
      <tr><th>Duration</th><td>${valueOrDash(commute.durationText)}</td></tr><tr><th>Distance</th><td>${valueOrDash(commute.distanceText)}</td></tr>
      ${commute.googleMapsUrl ? `<tr><th>Route</th><td><a href="${escapeHtml(commute.googleMapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a></td></tr>` : ""}
    </tbody></table></div></section>
    ${requirements.length ? `<section class="results"><h2>Requirements</h2><ul class="requirements-list">${requirements.map((item) => `<li class="requirement ${item.met ? "met" : "missing"}">${item.met ? "✓" : "✕"} ${escapeHtml(item.requirement)}</li>`).join("")}</ul></section>` : ""}
    ${processing.coverLetter ? `<section class="results"><h2>Cover letter</h2><pre>${valueOrDash(processing.coverLetter)}</pre></section>` : ""}
    ${processing.tailoredResumeLatex ? `<section class="results"><h2>Tailored resume (LaTeX)</h2><pre>${valueOrDash(processing.tailoredResumeLatex)}</pre></section>` : ""}`;
}

document.getElementById("back-homepage").addEventListener("click", () => {
  location.href = `${chrome.runtime.getURL("popup.html")}?homepage=1`;
});

if (!jobId) {
  subtitle.textContent = "No job was selected.";
  content.innerHTML = '<p class="empty">Open a processed job from the homepage to view its output.</p>';
} else {
  chrome.storage.local.get(["jobHistory"], ({ jobHistory }) => {
    const job = (Array.isArray(jobHistory) ? jobHistory : []).find((entry) => entry.id === jobId);
    if (job) render(job);
    else {
      subtitle.textContent = "Job not found.";
      content.innerHTML = '<p class="empty">This saved job is no longer available.</p>';
    }
  });
}
