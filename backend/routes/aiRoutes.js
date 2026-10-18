const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

let customOpenAiClient = null;
router.__setMockClient = (client) => {
    customOpenAiClient = client;
};

// In-memory rate limiting map: max 1 request per task (or title session) per minute (60,000 ms)
const rateLimitMap = new Map();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of rateLimitMap.entries()) {
        if (now - timestamp > 60000) {
            rateLimitMap.delete(key);
        }
    }
}, 300000).unref();

/**
 * POST /api/ai/generate-description
 * Generates an actionable task description based on the provided task title.
 * Enforces per-task rate limiting and provides graceful fallback on provider errors.
 */
router.post("/generate-description", async (req, res) => {
    try {
        const { title, taskId } = req.body;

        // 1. Title Validation
        if (!title || typeof title !== "string" || title.trim().length === 0) {
            return res.status(400).json({
                message: "Task title is required and cannot be empty.",
                fallback: true
            });
        }

        const cleanTitle = title.trim();

        if (cleanTitle.length < 3) {
            return res.status(400).json({
                message: "Task title must be at least 3 characters long.",
                fallback: true
            });
        }

        if (cleanTitle.length > 200) {
            return res.status(400).json({
                message: "Task title cannot exceed 200 characters.",
                fallback: true
            });
        }

        // 2. Per-task / Per-session Rate Limiting (1 request per minute)
        const rateLimitKey = taskId
            ? `task_${taskId}`
            : `client_${req.ip || "local"}_${cleanTitle.toLowerCase().slice(0, 50)}`;

        const now = Date.now();
        const lastRequestTime = rateLimitMap.get(rateLimitKey);

        if (lastRequestTime && (now - lastRequestTime < 60000)) {
            const remainingSeconds = Math.ceil((60000 - (now - lastRequestTime)) / 1000);
            return res.status(429).json({
                message: `Rate limit reached. Please wait ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"} before requesting another AI description for this task.`,
                retryAfter: remainingSeconds,
                fallback: true
            });
        }

        // Record request timestamp for rate limiting
        rateLimitMap.set(rateLimitKey, now);

        // 3. Check for API Keys
        const geminiKey = process.env.GEMINI_API_KEY;
        const openAiKey = process.env.OPENAI_API_KEY;

        const isPlaceholderKey = (key) => !key || key.includes("your_") || key.trim() === "";

        // If no keys are provided or only placeholders exist, return graceful fallback
        if (!customOpenAiClient && isPlaceholderKey(geminiKey) && isPlaceholderKey(openAiKey)) {
            return res.status(200).json({
                description: "",
                fallback: true,
                message: "AI suggestions are temporarily unavailable (API key not configured). Please write the description manually."
            });
        }

        // 4. If custom mock client is active (test mode), return mocked response immediately
        if (customOpenAiClient) {
            try {
                const completion = await customOpenAiClient.chat.completions.create({
                    messages: [{ role: "user", content: cleanTitle }]
                });
                const description = completion.choices[0]?.message?.content?.trim() || "";
                if (description) {
                    return res.status(200).json({
                        description,
                        fallback: false
                    });
                }
            } catch (mockError) {
                console.error("[AI Service] Mock error:", mockError.message);
                return res.status(200).json({
                    description: "",
                    fallback: true,
                    message: "AI suggestions are temporarily unavailable. Please write the description manually."
                });
            }
        }

        // 5. Try Gemini as primary provider
        if (!isPlaceholderKey(geminiKey)) {
            try {
                const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
                const geminiRes = await fetch(geminiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Write a short, concise 1-2 sentence task description for: "${cleanTitle}". Output only the plain text description.`
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            maxOutputTokens: 120,
                            temperature: 0.7
                        }
                    }),
                    signal: AbortSignal.timeout(25000)
                });

                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
                    if (text) {
                        return res.status(200).json({
                            description: text,
                            fallback: false
                        });
                    }
                }
                console.error("[AI Service] Gemini returned status:", geminiRes.status);
            } catch (geminiError) {
                console.error("[AI Service] Gemini error:", geminiError.message);
            }
        }

        // 6. Optional OpenAI fallback if key is configured
        if (!isPlaceholderKey(openAiKey)) {
            try {
                const openai = new OpenAI({
                    apiKey: openAiKey,
                    timeout: 10000
                });

                const completion = await openai.chat.completions.create({
                    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful assistant that writes clear, practical, and concise 1-2 sentence descriptions for task management applications based only on the task title. Do not output markdown headers or quotation marks. Output only the description text."
                        },
                        {
                            role: "user",
                            content: `Write a short task description for: ${cleanTitle}`
                        }
                    ],
                    max_tokens: 120,
                    temperature: 0.7
                });

                const description = completion.choices[0]?.message?.content?.trim() || "";

                if (description) {
                    return res.status(200).json({
                        description,
                        fallback: false
                    });
                }
            } catch (openAiError) {
                console.error("[AI Service] OpenAI provider error:", openAiError.message);
            }
        }

        // 6. Graceful Degradation Fallback
        return res.status(200).json({
            description: "",
            fallback: true,
            message: "AI suggestions are temporarily unavailable. Please write the description manually."
        });

    } catch (error) {
        console.error("[AI Service Error]", error.message);
        return res.status(200).json({
            description: "",
            fallback: true,
            message: "AI suggestions are temporarily unavailable. Please write the description manually."
        });
    }
});

// Helper for testing: reset rate limits
router.post("/reset-rate-limit", (req, res) => {
    rateLimitMap.clear();
    res.status(200).json({ message: "AI rate limit cache reset successfully." });
});

module.exports = router;
