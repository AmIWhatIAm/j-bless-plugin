import { createRoutePreview } from "./popup/maps/route-preview.js";

const content = document.getElementById("preview-content");
const subtitle = document.getElementById("preview-subtitle");
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatDate = (value) => value ? new Date(value).toLocaleString() : "-";
const valueOrDash = (value) => escapeHtml(value || "-");
const jobId = new URLSearchParams(location.search).get("jobId");

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(source) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`); paragraph = []; };
  const flushList = () => { if (list) { blocks.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`); list = null; } };
  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); const level = heading[1].length; blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); }
    else if (unordered || ordered) { flushParagraph(); const type = unordered ? "ul" : "ol"; if (!list || list.type !== type) { flushList(); list = { type, items: [] }; } list.items.push((unordered || ordered)[1]); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line.trim()); }
  }
  flushParagraph(); flushList();
  return blocks.join("") || "<p>-</p>";
}

function detail(label, value) { return `<div><dt>${label}</dt><dd>${value}</dd></div>`; }
function previewCard(title, body, classes = "", action = "") { return `<section class="preview-card ${classes}"><div class="preview-card__header"><h2 class="preview-card__heading">${title}</h2>${action}</div>${body}</section>`; }
async function copyToClipboard(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const temporary = document.createElement("textarea");
  temporary.value = value;
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.append(temporary);
  temporary.select();
  document.execCommand("copy");
  temporary.remove();
}

function render(job) {
  const extracted = job.extractedJob || {};
  const processing = job.processingResult || {};
  const commute = job.commute || {};
  const requirements = processing.requirementsAnalysis?.requirements || [];
  subtitle.textContent = [job.positionName || extracted.positionName, job.companyName || extracted.companyName].filter(Boolean).join(" at ") || "Saved processed job";
  const description = job.jobDescription || extracted.jobDescription;
  content.innerHTML = `<div class="preview-grid">
    ${previewCard("Job details", `<dl class="detail-list">${detail("Position", valueOrDash(job.positionName || extracted.positionName))}${detail("Company", valueOrDash(job.companyName || extracted.companyName))}${detail("Work location", valueOrDash(job.workLocation || extracted.workLocation))}${detail("Job posting", job.jobUrl ? `<a href="${escapeHtml(job.jobUrl)}" target="_blank" rel="noreferrer">View original posting</a>` : "-")}${detail("Processed", valueOrDash(formatDate(job.updatedAt)))}</dl>`)}
    ${previewCard("Commute", `<dl class="detail-list">${detail("Starting point", valueOrDash(job.origin))}${detail("Mode", valueOrDash(job.commuteMode === "public_transport" ? "Public transport" : "Driving"))}${detail("Duration", valueOrDash(commute.durationText))}${detail("Distance", valueOrDash(commute.distanceText))}${commute.googleMapsUrl ? detail("Route", `<a href="${escapeHtml(commute.googleMapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>`) : ""}</dl>`)}
    ${commute.encodedPolyline ? previewCard("Route map", `<div id="route-map" role="img" aria-label="Map preview of the saved commute route"></div>`, "preview-card--wide") : ""}
    ${previewCard("Job description", `<div class="markdown-content">${markdownToHtml(description)}</div>`, "preview-card--wide")}
    ${requirements.length ? previewCard("Requirements", `<ul class="requirements-list">${requirements.map((item) => `<li class="requirement ${item.met ? "met" : "missing"}"><span>${item.met ? "✓" : "×"}</span>${escapeHtml(item.requirement)}</li>`).join("")}</ul>`, "preview-card--wide requirements-card") : ""}
    ${processing.coverLetter ? previewCard("Cover letter", `<pre class="output-copy">${valueOrDash(processing.coverLetter)}</pre>`, "preview-card--wide", '<button class="btn btn-outline-info copy-output" type="button" data-copy-output="cover-letter">Copy</button>') : ""}
    ${processing.tailoredResumeLatex ? previewCard("Tailored resume", `<pre class="output-copy">${valueOrDash(processing.tailoredResumeLatex)}</pre>`, "preview-card--wide", '<button class="btn btn-outline-info copy-output" type="button" data-copy-output="tailored-resume">Copy</button>') : ""}
  </div>`;
  if (commute.encodedPolyline) {
    const routePreview = createRoutePreview({
      routePreview: content.querySelector("#route-map").closest(".preview-card"),
      routeMap: content.querySelector("#route-map"),
      getGoogleMapsUrl: () => commute.googleMapsUrl,
    });
    routePreview.render(commute);
  }
  const copyText = {
    "cover-letter": processing.coverLetter,
    "tailored-resume": processing.tailoredResumeLatex,
  };
  content.querySelectorAll("[data-copy-output]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await copyToClipboard(copyText[button.dataset.copyOutput] || "");
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = "Copy"; }, 1600);
      } catch {
        button.textContent = "Copy failed";
        setTimeout(() => { button.textContent = "Copy"; }, 1600);
      }
    });
  });
}

document.getElementById("back-homepage").addEventListener("click", () => { location.href = `${chrome.runtime.getURL("popup.html")}?homepage=1`; });
if (!jobId) { subtitle.textContent = "No job was selected."; content.innerHTML = '<p class="empty">Open a processed job from the homepage to view its output.</p>'; }
else { chrome.storage.local.get(["jobHistory"], ({ jobHistory }) => { const job = (Array.isArray(jobHistory) ? jobHistory : []).find((entry) => entry.id === jobId); if (job) render(job); else { subtitle.textContent = "Job not found."; content.innerHTML = '<p class="empty">This saved job is no longer available.</p>'; } }); }
