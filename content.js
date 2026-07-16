function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) return value.replace(/\s+/g, " ");
  }

  return "";
}

function htmlToMarkdown(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const render = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\s+/g, " ");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return Array.from(node.childNodes ?? []).map(render).join("");
    }

    const tag = node.tagName.toLowerCase();
    const content = Array.from(node.childNodes).map(render).join("");
    const trimmed = content.trim();

    if (tag === "br") return "\n";
    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(Number(tag[1]))} ${trimmed}\n\n`;
    if (tag === "p" || tag === "div") return `\n${trimmed}\n\n`;
    if (tag === "strong" || tag === "b") return trimmed ? `**${trimmed}**` : "";
    if (tag === "em" || tag === "i") return trimmed ? `*${trimmed}*` : "";
    if (tag === "a") {
      const href = node.getAttribute("href");
      return href && trimmed ? `[${trimmed}](${href})` : trimmed;
    }
    if (tag === "li") return `\n- ${trimmed}`;
    if (tag === "ul" || tag === "ol") return `\n${trimmed}\n\n`;

    return content;
  };

  return render(template.content)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/(?:\.\.\.|…)\s*more\s*$/i, "")
    .trim();
}

function getJobDescription() {
  const container = document.querySelector(
    ".jobs-description__content, #job-details, .jobs-box__html-content, ._44926d75.f5089735._662f01e9"
  );
  return container ? htmlToMarkdown(container.innerHTML) : "";
}

function extractLinkedInJob() {
  return {
    source: "linkedin",
    jobUrl: window.location.href,
    positionName: textFromSelectors([
      "._206505cb._80e2a3ab._250280be._7971c787.d3489b62.cdb37f94.c75f0c38.a516de55._535d44b1.e3c7b86f",
      ".job-details-jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title",
      "h1"
    ]),
    companyName: textFromSelectors([
      ".a516de55._790840a3.ad15b8ba._1070cc76",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".jobs-company__name"
    ]),
    workLocation: textFromSelectors([
      ".aafc18e8._662f01e9",
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__bullet",
      ".jobs-unified-top-card__workplace-type"
    ]),
    jobDescription: getJobDescription(),
    extractedAt: new Date().toISOString()
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_LINKEDIN_JOB") return false;

  sendResponse({
    ok: true,
    job: extractLinkedInJob()
  });

  return true;
});
