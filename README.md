# j-bless-plugin

Plugin for job seekers that turns a job posting URL and a user profile into a complete application package and commute plan.

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
