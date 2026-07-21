function corsHeaders(env) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (env.ALLOWED_EXTENSION_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = env.ALLOWED_EXTENSION_ORIGIN;
  }

  return headers;
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname !== "/api/generate-application") {
      return jsonResponse({ error: "Not found." }, 404, headers);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, headers);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400, headers);
    }

    const { job, resumeText } = payload ?? {};
    if (!job?.jobDescription || !resumeText?.trim()) {
      return jsonResponse(
        { error: "A job description and resume text are required." },
        400,
        headers,
      );
    }

    try {
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: env.GROQ_MODEL || "openai/gpt-oss-20b",
            temperature: 0.2,
            // Keep the prompt plus completion inside Groq's 8,000 TPM limit on
            // the free on-demand tier while leaving room for a complete resume.
            max_completion_tokens: 5000,
            reasoning_effort: "low",
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "application_package",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    tailoredResumeLatex: { type: "string" },
                    coverLetter: { type: "string" },
                    missingRequirements: {
                      type: "array",
                      items: { type: "string" },
                    },
                    requirementsAnalysis: {
                      type: "object",
                      properties: {
                        requirements: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              requirement: { type: "string" },
                              met: { type: "boolean" },
                              evidence: { type: "string" },
                            },
                            required: ["requirement", "met", "evidence"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["requirements"],
                      additionalProperties: false,
                    },
                  },
                  required: [
                    "tailoredResumeLatex",
                    "coverLetter",
                    "missingRequirements",
                    "requirementsAnalysis",
                  ],
                  additionalProperties: false,
                },
              },
            },
            messages: [
              {
                role: "system",
                content: [
                  "You create truthful job-application material.",
                  "Use only information explicitly supported by the supplied resume.",
                  "Never invent experience, skills, qualifications, dates, employers, education, certifications, or measurable achievements.",
                  "Keep the LaTeX resume concise: use a compact preamble and include only role-relevant, supported information.",
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
        return jsonResponse({ error: "Groq generation failed." }, 502, headers);
      }

      const completion = await groqResponse.json();
      const content = completion.choices?.[0]?.message?.content;
      return jsonResponse(JSON.parse(content), 200, headers);
    } catch (error) {
      console.error("Generation error:", error);
      return jsonResponse(
        { error: "Could not generate the application package." },
        500,
        headers,
      );
    }
  },
};
