chrome.runtime.onInstalled.addListener(() => {
  console.log("J Bless Plugin installed");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true, message: "J Bless Plugin is ready" });
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
        source: message.source ?? "",
        positionName: message.positionName ?? "",
        companyName: message.companyName ?? "",
        workLocation: message.workLocation ?? "",
        jobDescription: message.jobDescription ?? "",
        extractedAt: message.extractedAt ?? "",
        updatedAt: new Date().toISOString()
      };
      const existingIndex = savedHistory.findIndex((entry) => entry.id === job.id);
      const nextHistory = [...savedHistory];

      if (existingIndex >= 0) {
        nextHistory[existingIndex] = job;
      } else {
        nextHistory.unshift(job);
      }

      chrome.storage.local.set({ jobHistory: nextHistory }, () => {
        sendResponse({ ok: true, jobHistory: nextHistory });
      });
    });
    return true;
  }

  return false;
});
