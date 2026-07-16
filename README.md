# j-bless-plugin

Chromium extension scaffold for job seekers that turns a job posting URL and a user profile into a complete application package and commute plan.

## Current state

This repo now contains a Manifest V3 extension starter:

- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`
- `popup.js`
- `popup.css`

The extension popup opens directly to the job form, including the LinkedIn import button. Use **Open homepage** to open the full dashboard in a normal tab; each saved context becomes a history row, and selecting a row shows its input form and processed output table. The data is stored locally in `chrome.storage.local`.

LinkedIn job pages are the first supported parser. Open a page like `https://www.linkedin.com/jobs/view/4440598909/...`, click the extension, choose **New job**, then use **Import current LinkedIn job** to pull the position, company, location, and job description into the form before saving it.

## Local storage data

Saved jobs are kept only in the browser's extension storage (`chrome.storage.local`). The main key is `jobHistory`, an array of saved job records:

```json
{
  "id": "unique-record-id",
  "jobUrl": "https://www.linkedin.com/jobs/view/4440598909/",
  "origin": "Commute starting point",
  "commuteMode": "driving",
  "source": "linkedin",
  "positionName": "Job title",
  "companyName": "Company name",
  "workLocation": "Work location",
  "jobDescription": "Markdown-formatted job description",
  "extractedAt": "2026-07-16T00:00:00.000Z",
  "updatedAt": "2026-07-16T00:00:00.000Z"
}
```

No job data is sent to a server by this scaffold. To remove saved records, clear the extension's storage from its Chrome extension details page or remove the extension and load it again.

## Supported input

The plugin accepts:

1. A job portal job page URL (used to extract company name, work location, position name, and job description).
2. Commute starting point.
3. Commute mode (`driving` or `public_transport`).
4. Resume file (preferred formats: LaTeX source or ATS-friendly PDF).

## Workflow

1. Parse the provided job page and extract:
   - Company name
   - Work location
   - Position name
   - Job description (JD)
2. Parse the user resume.
3. Compare resume content against JD requirements to identify potential gaps.
4. Generate a tailored resume/CV in LaTeX for the target position.
5. Generate a tailored cover letter based on JD + resume.
6. Compute an optimal commute route and duration from the user starting point to work site.
7. Return a Google Maps deep link with route parameters so the user can open it directly.

## Plugin output contract

The plugin should return a structured response with:

- `job`: extracted job metadata (`companyName`, `positionName`, `workLocation`, `jobDescription`).
- `tailoredResumeLatex`: LaTeX resume/CV tailored to the role.
- `missingRequirements`: list of JD requirements not strongly supported by the resume.
- `commute`: route summary including `mode`, `origin`, `destination`, `durationText`, and `googleMapsUrl`.
- `coverLetter`: generated cover letter tailored to the position and user background.

## Load locally

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this repository folder.
5. Click the extension icon to open the job form. Use **Open homepage**, or visit `chrome-extension://oknmhapelhdgfpndmlbljakcmbkbdcgj/popup.html?homepage=1`, to view the dashboard history.
