/**
 * Processing utilities for a completed job extraction.
 *
 * This module deliberately does not fetch or scrape job pages. The extraction
 * layer should pass its result to `processApplication` once it has job data.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
  "is", "of", "on", "or", "our", "the", "to", "with", "you", "your"
]);

const SKILL_PATTERNS = [
  "javascript", "typescript", "python", "java", "c++", "c#", "sql", "html", "css",
  "react", "angular", "vue", "node.js", "node", "express", "django", "flask",
  "aws", "azure", "gcp", "docker", "kubernetes", "git", "linux", "figma",
  "excel", "power bi", "tableau", "machine learning", "data analysis", "agile",
  "scrum", "project management", "communication", "leadership"
];

function normaliseText(value) {
  return String(value ?? "")
    .replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, " $1 ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeLatex(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/\n/g, " ");
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function extractSkills(text) {
  const lowerText = normaliseText(text).toLowerCase();
  return SKILL_PATTERNS.filter((skill) => {
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9+#])${escapedSkill}(?:$|[^a-z0-9+#])`, "i").test(lowerText);
  });
}

export function extractRequirements(jobDescription) {
  const sentences = normaliseText(jobDescription)
    .split(/(?<=[.!?;])\s+|\s*[•\-]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const skills = extractSkills(jobDescription);
  const requirementSentences = sentences.filter((sentence) =>
    /\b(require|requirement|must|qualif|proficien|experience|ability|responsib)/i.test(sentence)
  );

  return unique([...skills, ...requirementSentences]).slice(0, 12);
}

export function parseResume(resumeText) {
  const text = normaliseText(resumeText);
  const lines = String(resumeText ?? "")
    .split(/\r?\n/)
    .map((line) => normaliseText(line))
    .filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0] ?? "";
  const name = lines.find((line) => !/@|\d{3,}|resume|curriculum vitae/i.test(line)) ?? "Candidate";

  return { text, name: name.slice(0, 80), email, phone, skills: extractSkills(text) };
}

export function analyseRequirements(jobDescription, resumeText) {
  const resume = parseResume(resumeText);
  const requirements = extractRequirements(jobDescription);
  const resumeLower = resume.text.toLowerCase();
  const supportedRequirements = [];
  const missingRequirements = [];

  for (const requirement of requirements) {
    const normalisedRequirement = normaliseText(requirement).toLowerCase();
    const requirementSkills = extractSkills(requirement);
    const isSupported = requirementSkills.length
      ? requirementSkills.some((skill) => resume.skills.includes(skill))
      : normalisedRequirement
          .split(/\W+/)
          .filter((word) => word.length > 4 && !STOP_WORDS.has(word))
          .some((word) => resumeLower.includes(word));

    (isSupported ? supportedRequirements : missingRequirements).push(requirement);
  }

  return { resume, requirements, supportedRequirements, missingRequirements };
}

export function createGoogleMapsUrl({ origin, destination, mode }) {
  const travelmode = mode === "public_transport" ? "transit" : "driving";
  const parameters = new URLSearchParams({ api: "1", origin, destination, travelmode });
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

export function createTailoredResumeLatex({ job, resume, supportedRequirements }) {
  const role = job.positionName || "Target Position";
  const company = job.companyName || "the company";
  const skills = unique([...resume.skills, ...supportedRequirements.flatMap(extractSkills)]).slice(0, 12);
  const summary = `Candidate targeting the ${role} role at ${company}, with experience relevant to ${skills.slice(0, 4).join(", ") || "the role requirements"}.`;

  return `\\documentclass[11pt]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage[T1]{fontenc}
\\begin{document}
\\begin{center}\\Large\\textbf{${escapeLatex(resume.name)}}\\end{center}
${resume.email ? `${escapeLatex(resume.email)}\\\\
` : ""}${resume.phone ? `${escapeLatex(resume.phone)}\\\\
` : ""}
\\section*{Professional Summary}
${escapeLatex(summary)}
\\section*{Relevant Skills}
${skills.length ? `\\begin{itemize}\n${skills.map((skill) => `\\item ${escapeLatex(titleCase(skill))}`).join("\n")}\n\\end{itemize}` : "Add verified skills from your experience here."}
\\section*{Experience}
Use your original resume experience here. Prioritise achievements that demonstrate the relevant skills above, and keep every claim accurate.
\\end{document}`;
}

export function createCoverLetter({ job, resume, supportedRequirements }) {
  const role = job.positionName || "the advertised position";
  const company = job.companyName || "your organisation";
  const strengths = supportedRequirements.slice(0, 3).join(", ") || resume.skills.slice(0, 3).join(", ") || "relevant transferable skills";

  return `Dear Hiring Team,\n\nI am writing to apply for ${role} at ${company}. My background demonstrates experience with ${strengths}, and I am keen to apply these strengths to the needs described in the job posting.\n\nI have tailored my application around the role requirements while keeping every statement grounded in my existing experience. I would welcome the opportunity to discuss how my skills and motivation could contribute to your team.\n\nThank you for your consideration.\n\nSincerely,\n${resume.name}`;
}

export function processApplication({ job, resumeText, origin, commuteMode = "driving" }) {
  if (!job?.jobDescription) throw new Error("A job description is required before processing.");
  if (!resumeText?.trim()) throw new Error("Resume text or LaTeX source is required before processing.");

  const analysis = analyseRequirements(job.jobDescription, resumeText);
  const destination = job.workLocation?.trim() || "";

  return {
    job: {
      companyName: job.companyName?.trim() || "",
      positionName: job.positionName?.trim() || "",
      workLocation: destination,
      jobDescription: job.jobDescription.trim()
    },
    tailoredResumeLatex: createTailoredResumeLatex({ job, ...analysis }),
    missingRequirements: analysis.missingRequirements,
    requirementsAnalysis: {
      requirements: analysis.requirements.map((requirement) => ({
        requirement,
        met: analysis.supportedRequirements.includes(requirement)
      }))
    },
    commute: {
      mode: commuteMode,
      origin: origin?.trim() || "",
      destination,
      durationText: "Open in Google Maps for live route duration.",
      googleMapsUrl: origin?.trim() && destination
        ? createGoogleMapsUrl({ origin: origin.trim(), destination, mode: commuteMode })
        : ""
    },
    coverLetter: createCoverLetter({ job, ...analysis })
  };
}
