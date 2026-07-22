# J*bless Plugin

Chrome extension for turning a job posting and a resume into an application package: a tailored LaTeX resume, cover letter, requirements analysis, and commute preview.

## Demo

[![Watch the demo](https://img.youtube.com/vi/G9FSSoM0lu0/maxresdefault.jpg)](https://youtu.be/G9FSSoM0lu0)

Watch the demo on YouTube.

## Features

- Import the current LinkedIn job posting, or enter job details manually.
- Keep a reusable profile with a default commute origin and resume text.
- Read ATS-friendly PDF, LaTeX (`.tex`), and plain-text resumes in the extension.
- Generate an evidence-based tailored LaTeX resume, cover letter, and requirement-by-requirement analysis.
- Calculate driving or public-transport commute time, distance, route geometry, and a Google Maps link.
- Save application contexts locally, edit generated text, copy it, and open a standalone output preview.

## How it works

```text
LinkedIn job page / manual entry ─┐
                                  ├─ Chrome extension ── Cloudflare Worker ── Groq API
Resume text or supported file ────┘          │
                                             ├─ Google Routes API
                                             └─ chrome.storage.local
```

The extension extracts LinkedIn job details in the active tab. Job and resume data submitted for generation are sent to the configured Cloudflare Worker, which calls the Groq API. Commute calculations use Google Maps Routes API; the route preview displays OpenStreetMap tiles.

## Local setup

1. Run `npm install`.
2. Copy `config.example.js` to `config.js` and set `GOOGLE_MAPS_API_KEY` to a restricted Google Maps API key with the Routes API enabled.
3. Open `chrome://extensions`, enable **Developer mode**, then select **Load unpacked**.
4. Choose this repository folder and click the extension icon.
5. Select **New job**, import the open LinkedIn listing or complete the form manually, then generate the application package or calculate the commute.

`config.js` is ignored by Git. Reload the extension from `chrome://extensions` after changing it.

## Generation service

The extension currently sends generation requests to the endpoint configured in `background.js`:

```text
https://j-bless-api.wenkee-4140.workers.dev/api/generate-application
```

The Worker implementation is in `src/worker.js`. It requires the `GROQ_API_KEY` secret and supports an optional `GROQ_MODEL` variable. When deploying your own Worker, set `ALLOWED_EXTENSION_ORIGIN` to `chrome-extension://<your-extension-id>` so the Worker permits requests from your installed extension. Deploy the Worker, then update `GENERATION_ENDPOINT` in `background.js` and the matching host permission in `manifest.json` if its URL changes.

The service instructs the model to use only information present in the supplied resume. Review every generated document before use.

## Data and privacy

The extension stores the following in `chrome.storage.local` on the current browser profile:

- `jobHistory`: saved job details, commute result, and generated application package.
- `userProfile`: default commute origin and default resume text.
- `jobDraft`: the in-progress form state.

Resume files themselves are not retained in job history; their extracted text may be saved if it is used as the profile default or included in a draft. Generation sends the job description and resume text to the configured Cloudflare Worker, which forwards them to Groq. Commute requests send origin and destination to Google Maps Routes API, and route-map tiles are fetched from OpenStreetMap. Clear extension storage or remove the extension to remove local records.

## Supported input

- LinkedIn job pages at `https://www.linkedin.com/jobs/view/*` can be imported directly.
- Any job posting URL can be recorded manually, along with the position, company, location, and job description.
- Commute modes: `driving` and `public_transport`.
- Resume inputs: selectable-text PDF, LaTeX source, plain-text file, or pasted text. Scanned PDFs without selectable text are not supported.

## Generated output

The generation API returns:

- `tailoredResumeLatex`
- `coverLetter`
- `missingRequirements`
- `requirementsAnalysis.requirements`, each with `requirement`, `met`, and `evidence`

The extension combines this with the saved job context and optional commute result. Generated cover letters and LaTeX resumes can be edited before saving or copying.

## Project layout

- `manifest.json` — Manifest V3 extension configuration and permissions.
- `popup.html` / `popup.js` / `popup.css` — dashboard, profile, job form, and results UI.
- `background.js` — job storage, generic active-page extraction, and generation API requests.
- `content.js` — LinkedIn-specific job extraction.
- `route-service.js` — Google Routes API client and Google Maps deep-link builder.
- `popup/maps/` — route-preview map rendering.
- `output-preview.html` / `output-preview.js` — saved application-package preview.
- `src/worker.js` / `wrangler.jsonc` — Cloudflare Worker that proxies structured generation to Groq.
- `processing.js` — local, deterministic processing utilities and sample generation logic used by tests.

## Checks

Run the available unit tests with:

```sh
node --test processing.test.js route-service.test.js
```

Use [sample-processing-input.json](sample-processing-input.json) with the local processing utilities, and [sample-resume.tex](sample-resume.tex) as a resume example.
