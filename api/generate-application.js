const extensionOrigin = process.env.ALLOWED_EXTENSION_ORIGIN;

export default async function handler(req, res) {
  if (extensionOrigin) {
    res.setHeader("Access-Control-Allow-Origin", extensionOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { job, resumeText } = req.body ?? {};

  if (!job?.jobDescription || !resumeText?.trim()) {
    return res.status(400).json({
      error: "A job description and resume text are required.",
    });
  }

  try {
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: [
                "You create truthful job-application material.",
                "Use only information explicitly supported by the supplied resume.",
                "Never invent experience, skills, qualifications, dates, employers, education, certifications, or measurable achievements.",
                "Respond with JSON only in this shape:",
                '{"tailoredResumeLatex":"string","coverLetter":"string","missingRequirements":["string"],"requirementsAnalysis":{"requirements":[{"requirement":"string","met":true,"evidence":"string"}]}}',
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify({ job, resumeText }),
            },
          ],
        }),
      },
    );

    if (!groqResponse.ok) {
      const details = await groqResponse.text();
      console.error("Groq error:", groqResponse.status, details);
      return res.status(502).json({ error: "Groq generation failed." });
    }

    const completion = await groqResponse.json();
    const content = completion.choices?.[0]?.message?.content;

    return res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("Generation error:", error);
    return res.status(500).json({ error: "Could not generate the application package." });
  }
}
