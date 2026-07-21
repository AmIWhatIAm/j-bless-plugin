export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    return new URL(rawUrl).toString();
  } catch {
    return rawUrl.trim();
  }
}

export function getJobLabel(job) {
  if (job?.positionName || job?.companyName) return [job.positionName, job.companyName].filter(Boolean).join(" at ");
  const rawUrl = typeof job === "string" ? job : job?.jobUrl;
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl || "Untitled job";
  }
}

export function formatCommuteMode(mode) {
  return mode === "public_transport" ? "Public transport" : "Driving";
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

export function isLinkedInJobsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.linkedin.com" && /^\/jobs\/view\/\d+\/?/.test(parsed.pathname);
  } catch {
    return false;
  }
}
