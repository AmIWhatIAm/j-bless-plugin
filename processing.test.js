import test from "node:test";
import assert from "node:assert/strict";
import { processApplication } from "./processing.js";

test("processing returns the documented application package without scraping", () => {
  const result = processApplication({
    job: {
      companyName: "Acme",
      positionName: "Frontend Engineer",
      workLocation: "Kuala Lumpur",
      jobDescription: "Requirements: JavaScript, React, and Docker. Experience with agile delivery is required."
    },
    resumeText: "Ada Lovelace\nada@example.com\nBuilt React and JavaScript applications using Git.",
    origin: "Petaling Jaya",
    commuteMode: "public_transport"
  });

  assert.equal(result.job.companyName, "Acme");
  assert.match(result.tailoredResumeLatex, /Frontend Engineer/);
  assert.ok(result.missingRequirements.includes("docker"));
  assert.deepEqual(result.requirementsAnalysis.requirements.find((item) => item.requirement === "react"), {
    requirement: "react",
    met: true
  });
  assert.deepEqual(result.requirementsAnalysis.requirements.find((item) => item.requirement === "docker"), {
    requirement: "docker",
    met: false
  });
  assert.match(result.commute.googleMapsUrl, /travelmode=transit/);
  assert.match(result.coverLetter, /Ada Lovelace/);
});

test("processing requires extracted job content and resume text", () => {
  assert.throws(() => processApplication({ job: {}, resumeText: "resume" }), /job description/i);
  assert.throws(() => processApplication({ job: { jobDescription: "JavaScript" } }), /resume text/i);
});
