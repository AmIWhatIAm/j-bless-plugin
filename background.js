import { processApplication } from "./processing.js";

function extractJobFromPage() {
  const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const content = (selector) => text(document.querySelector(selector)?.content);
  const firstText = (selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = text(node?.innerText || node?.textContent);
      if (value) return value;
    }
    return "";
  };
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((script) => {
      try {
        const data = JSON.parse(script.textContent);
        return Array.isArray(data) ? data : [data, ...(data["@graph"] || [])];
      } catch { return []; }
    })
    .find((item) => item?.["@type"] === "JobPosting" || item?.["@type"]?.includes?.("JobPosting"));
  const address = jsonLd?.jobLocation?.address;
  const locationText = typeof address === "object"
    ? [address.streetAddress, address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(", ")
    : text(jsonLd?.jobLocation);

  return {
    companyName: text(jsonLd?.hiringOrganization?.name || firstText(["[data-company-name]", ".company-name", ".job-company", "[class*='company']"]) || content('meta[property="og:site_name"]')),
    positionName: text(jsonLd?.title || firstText(["h1", "[data-job-title]", ".job-title", "[class*='job-title']"]) || document.title),
    workLocation: text(locationText || firstText(["[data-job-location]", ".job-location", "[class*='location']"])),
    jobDescription: text(jsonLd?.description || content('meta[name="description"]') || firstText(["[data-job-description]", ".job-description", "#job-description", "[class*='description']", "main"])),
    sourceUrl: location.href,
    extractedAt: new Date().toISOString()
  };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("J Bless Plugin installed");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true, message: "J Bless Plugin is ready" });
    return true;
  }

  if (message?.type === "EXTRACT_ACTIVE_JOB") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      if (!tab?.id) return sendResponse({ ok: false, error: "No active tab is available." });
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobFromPage })
        .then(([result]) => {
          const job = result?.result;
          if (!job?.jobDescription) throw new Error("No job description was found on this page.");
          sendResponse({ ok: true, job });
        })
        .catch((error) => sendResponse({ ok: false, error: error.message || "This page cannot be extracted." }));
    });
    return true;
  }

  if (message?.type === "SAVE_JOB_ENTRY") {
    chrome.storage.local.get(["jobHistory"], ({ jobHistory }) => {
      const savedHistory = Array.isArray(jobHistory) ? jobHistory : [];
      const job = {
        id: message.id || crypto.randomUUID(),
        jobUrl: message.jobUrl ?? "",
        origin: message.origin ?? "",
        commuteMode: message.commuteMode ?? "driving",
        source: message.source ?? message.extractedJob?.source ?? "",
        positionName: message.positionName ?? message.extractedJob?.positionName ?? "",
        companyName: message.companyName ?? message.extractedJob?.companyName ?? "",
        workLocation: message.workLocation ?? message.extractedJob?.workLocation ?? "",
        jobDescription: message.jobDescription ?? message.extractedJob?.jobDescription ?? "",
        extractedAt: message.extractedAt ?? message.extractedJob?.extractedAt ?? "",
        extractedJob: message.extractedJob ?? null,
        commute: message.commute ?? null,
        processingResult: message.processingResult ?? null,
        updatedAt: new Date().toISOString()
      };
      const existingIndex = savedHistory.findIndex((entry) => entry.id === job.id);
      const nextHistory = [...savedHistory];
      if (existingIndex >= 0) nextHistory[existingIndex] = job;
      else nextHistory.unshift(job);
      chrome.storage.local.set({ jobHistory: nextHistory }, () => sendResponse({ ok: true, jobHistory: nextHistory }));
    });
    return true;
  }

  if (message?.type === "PROCESS_APPLICATION") {
    try {
      sendResponse({ ok: true, result: processApplication(message.payload ?? {}) });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  }

  return false;
});
