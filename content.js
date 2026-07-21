function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function firstTextFromNodes(nodes) {
  for (const node of nodes) {
    const value = cleanText(node?.innerText || node?.textContent);
    if (value) return value;
  }
  return "";
}

function getLinkedInDetailHeader() {
  const titleNode = [...document.querySelectorAll("h1")]
    .find((node) => !/^search jobs$/i.test(cleanText(node.textContent)));
  const positionName = cleanText(titleNode?.innerText || titleNode?.textContent);

  let companyLink = null;
  let container = titleNode?.parentElement;
  for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) {
    companyLink = container.querySelector('a[href*="/company/"]');
    if (companyLink) break;
  }

  const companyName = cleanText(companyLink?.innerText || companyLink?.textContent);
  const companyRow = companyLink?.closest("div");
  const companyRowText = cleanText(companyRow?.innerText || companyRow?.textContent);
  const workLocation = cleanText(
    companyRowText
      .replace(companyName, "")
      .split(/[·•]/)[0]
  );

  return { positionName, companyName, workLocation };
}

// LinkedIn's generated classes change. Its job and company URLs, however,
// describe the relationship we need to extract a result card.
function getLinkedInSearchCard(jobLink) {
  let node = jobLink?.parentElement;
  while (node && node !== document.body) {
    const hasCompany = node.querySelector('a[href*="/company/"]');
    const hasJobLink = node.querySelector('a[href*="/jobs/view/"]');
    if (hasCompany && hasJobLink) return node;
    node = node.parentElement;
  }
  return jobLink?.parentElement || null;
}

function extractLinkedInSearchResult() {
  const jobLink = document.querySelector('a[href*="/jobs/view/"]');
  if (!jobLink) return null;

  const card = getLinkedInSearchCard(jobLink);
  if (!card) return null;

  const companyLink = card.querySelector('a[href*="/company/"]');
  const companyName = firstTextFromNodes([companyLink]);
  const paragraphs = [...card.querySelectorAll("p")]
    .map((node) => cleanText(node.innerText || node.textContent))
    .filter(Boolean);

  const metadata = paragraphs.find((value) =>
    /\b(?:ago|today|yesterday)\b/i.test(value) && value.includes("·")
  ) || "";
  const titleParagraph = [...card.querySelectorAll("p")].find((node) => {
    const value = cleanText(node.innerText || node.textContent);
    return value && value !== companyName && value !== metadata &&
      !/promoted by|responses managed/i.test(value) &&
      (node.querySelector('[aria-label="Verified job"]') ||
        (node.parentElement?.querySelector('a[href*="/company/"]') && !value.includes("·")));
  });
  const fallbackTitle = paragraphs.find((value, index) => {
    const afterCompany = !companyName || index > paragraphs.indexOf(companyName);
    return afterCompany && value !== metadata &&
      !/promoted by|responses managed|people clicked apply/i.test(value) &&
      !value.includes("·");
  });
  const positionName = cleanText(
    titleParagraph?.innerText || titleParagraph?.textContent || fallbackTitle
  );
  const location = metadata.split("·")[0]?.trim() || "";
  const jobUrl = jobLink.href || jobLink.getAttribute("href") || "";

  return {
    source: "linkedin",
    jobUrl,
    positionName,
    companyName,
    workLocation: location,
    // A search result card does not contain the full description. The detail
    // page extraction remains responsible for supplying it.
    jobDescription: "",
    extractedAt: new Date().toISOString()
  };
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
  // LinkedIn's generated classes and data attributes change frequently. The
  // section heading is the stable semantic marker for the description.
  const heading = [...document.querySelectorAll("h2, h3, [role='heading']")]
    .find((node) => /^about the job$/i.test(cleanText(node.textContent)));
  if (!heading) return "";

  // Use the smallest ancestor that contains meaningful content after the
  // heading, stopping at the next divider before other job-page sections.
  let container = heading.parentElement;
  while (container && container !== document.body) {
    const range = document.createRange();
    range.setStartBefore(heading);

    const divider = [...container.querySelectorAll("hr")].find((node) =>
      Boolean(heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    if (divider) range.setEndBefore(divider);
    else if (container.lastChild) range.setEndAfter(container.lastChild);

    const fragment = range.cloneContents();
    const wrapper = document.createElement("div");
    wrapper.append(fragment);
    const value = htmlToMarkdown(wrapper.innerHTML);
    if (value.length >= 80) return value;

    container = container.parentElement;
  }

  return "";
}

function extractLinkedInJob() {
  const searchResult = extractLinkedInSearchResult();
  const header = getLinkedInDetailHeader();
  const detailResult = {
    source: "linkedin",
    jobUrl: window.location.href,
    positionName: header.positionName,
    companyName: header.companyName,
    workLocation: header.workLocation,
    jobDescription: getJobDescription(),
    extractedAt: new Date().toISOString()
  };

  // A description can be present while the header is incomplete. Fill each
  // field independently from the search result when available.
  return {
    ...searchResult,
    ...detailResult,
    jobUrl: detailResult.jobUrl || searchResult?.jobUrl || "",
    positionName: detailResult.positionName || header.positionName || searchResult?.positionName || "",
    companyName: detailResult.companyName || header.companyName || searchResult?.companyName || "",
    workLocation: detailResult.workLocation || header.workLocation || searchResult?.workLocation || "",
    jobDescription: detailResult.jobDescription || searchResult?.jobDescription || ""
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
