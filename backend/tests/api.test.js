const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Task = require("../models/Task");
const taskEvents = require("../events");
const { resetStats } = require("../config/cache");

const JWT_SECRET = process.env.JWT_SECRET || "p7_task_manager_secure_jwt_secret_key_2026_charusat";
const mockUserId = "650000000000000000000001";
const validToken = jwt.sign(
    { id: mockUserId, email: "student24cs018@charusat.edu.in" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

describe("Task Management API - CI/CD Automated Test Suite", () => {
    beforeEach(() => {
        resetStats();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe("1. Health & Server Info Endpoints", () => {
        test("GET / returns 200 with student ID and active status", async () => {
            const res = await request(app).get("/");
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("status", "active");
            expect(res.body).toHaveProperty("studentId", "24CS018");
            expect(res.body.message).toMatch(/Practical 13/i);
        });

        test("GET /debug/cache-stats returns 200 with cache metrics (Practical 9)", async () => {
            const res = await request(app).get("/debug/cache-stats");
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("hits");
            expect(res.body).toHaveProperty("misses");
            expect(res.body).toHaveProperty("totalRequests");
            expect(res.body).toHaveProperty("hitRate");
        });
    });

    describe("2. Authentication & Authorization Enforcement", () => {
        test("GET /tasks returns 401 when no token is provided", async () => {
            const res = await request(app).get("/tasks");
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toMatch(/access denied/i);
        });

        test("GET /tasks returns 401 when token format is invalid", async () => {
            const res = await request(app)
                .get("/tasks")
                .set("Authorization", "Basic invalidcredentials");
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toMatch(/bearer/i);
        });
    });

    describe("3. Task Retrieval & In-Memory Caching (Practical 9)", () => {
        test("GET /tasks returns 200 with task list when authenticated", async () => {
            const mockTasks = [
                {
                    _id: "650000000000000000000010",
                    title: "Setup CI/CD Pipeline",
                    description: "GitHub Actions workflow for ITUE301 Practical 12",
                    completed: false,
                    userId: mockUserId
                }
            ];

            jest.spyOn(Task, "find").mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockTasks)
                })
            });

            const res = await request(app)
                .get("/tasks")
                .set("Authorization", `Bearer ${validToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe("Setup CI/CD Pipeline");
        });
    });

    describe("4. Task Creation, Validation & Events (Practicals 7 & 10)", () => {
        test("POST /tasks returns 400 when title is missing or empty", async () => {
            const res = await request(app)
                .post("/tasks")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ description: "Missing title field" });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty("message");
            expect(res.body.message).toMatch(/title is required/i);
        });

        test("POST /tasks returns 201 and emits task-created event when valid", async () => {
            const createdTask = {
                _id: "650000000000000000000020",
                title: "Complete GitHub Actions Workflow",
                description: "Automate test and linting steps",
                completed: false,
                userId: mockUserId,
                toObject: () => ({
                    _id: "650000000000000000000020",
                    title: "Complete GitHub Actions Workflow",
                    description: "Automate test and linting steps",
                    completed: false,
                    userId: mockUserId
                })
            };

            jest.spyOn(Task.prototype, "save").mockResolvedValue(createdTask);
            const emitSpy = jest.spyOn(taskEvents, "emit").mockImplementation(() => true);

            const res = await request(app)
                .post("/tasks")
                .set("Authorization", `Bearer ${validToken}`)
                .send({
                    title: "Complete GitHub Actions Workflow",
                    description: "Automate test and linting steps"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty("message", "Task created successfully");
            expect(res.body.task.title).toBe("Complete GitHub Actions Workflow");
            expect(emitSpy).toHaveBeenCalledWith("task-created", expect.anything());
        });
    });

    describe("5. Resource Lookup & Error Handling", () => {
        test("GET /tasks/:id returns 400 for invalid ObjectId format", async () => {
            const res = await request(app)
                .get("/tasks/non-hex-invalid-id")
                .set("Authorization", `Bearer ${validToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/invalid task id format/i);
        });

        test("GET /tasks/:id returns 404 when task does not exist", async () => {
            jest.spyOn(Task, "findOne").mockReturnValue({
                lean: jest.fn().mockResolvedValue(null)
            });

            const res = await request(app)
                .get("/tasks/650000000000000000000999")
                .set("Authorization", `Bearer ${validToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toMatch(/task not found/i);
        });

        test("GET /nonexistent-route returns 404 route not found", async () => {
            const res = await request(app).get("/api/nonexistent-route");
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe("Route not found");
        });
    });

    describe("6. AI Task Description Integration (Practical 13)", () => {
        beforeEach(async () => {
            await request(app).post("/api/ai/reset-rate-limit");
        });

        test("POST /api/ai/generate-description returns 400 when title is missing", async () => {
            const res = await request(app)
                .post("/api/ai/generate-description")
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/title is required/i);
            expect(res.body.fallback).toBe(true);
        });

        test("POST /api/ai/generate-description returns 400 when title is too short", async () => {
            const res = await request(app)
                .post("/api/ai/generate-description")
                .send({ title: "ab" });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/at least 3 characters/i);
        });

        test("POST /api/ai/generate-description returns 400 when title exceeds 200 chars", async () => {
            const res = await request(app)
                .post("/api/ai/generate-description")
                .send({ title: "a".repeat(201) });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/cannot exceed 200/i);
        });

        test("POST /api/ai/generate-description returns graceful fallback when no API key configured", async () => {
            const originalOpenAiKey = process.env.OPENAI_API_KEY;
            const originalGeminiKey = process.env.GEMINI_API_KEY;
            delete process.env.OPENAI_API_KEY;
            delete process.env.GEMINI_API_KEY;

            const res = await request(app)
                .post("/api/ai/generate-description")
                .send({ title: "Complete AI integration practical" });

            process.env.OPENAI_API_KEY = originalOpenAiKey;
            process.env.GEMINI_API_KEY = originalGeminiKey;

            expect(res.statusCode).toBe(200);
            expect(res.body.fallback).toBe(true);
            expect(res.body.description).toBe("");
            expect(res.body.message).toMatch(/unavailable/i);
        });

        afterEach(() => {
            const aiRoutes = require("../routes/aiRoutes");
            aiRoutes.__setMockClient(null);
        });

        test("POST /api/ai/generate-description returns 200 with generated description when AI provider succeeds", async () => {
            const aiRoutes = require("../routes/aiRoutes");
            aiRoutes.__setMockClient({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [
                                {
                                    message: {
                                        content: "Review the practical requirements, implement the AI integration, and verify tests."
                                    }
                                }
                            ]
                        })
                    }
                }
            });

            const res = await request(app)
                .post("/api/ai/generate-description")
                .send({ title: "Prepare Practical 13 report" });

            expect(res.statusCode).toBe(200);
            expect(res.body.fallback).toBe(false);
            expect(res.body.description).toBe(
                "Review the practical requirements, implement the AI integration, and verify tests."
            );
        });

        test("POST /api/ai/generate-description returns 429 when rate limit is exceeded on same task", async () => {
            const aiRoutes = require("../routes/aiRoutes");
            aiRoutes.__setMockClient({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: "Mocked description" } }]
                        })
                    }
                }
            });

            const res1 = await request(app)
                .post("/api/ai/generate-description")
                .send({ taskId: "task-12345", title: "Rate limiting test task" });

            expect([200, 429]).toContain(res1.statusCode);

            const res2 = await request(app)
                .post("/api/ai/generate-description")
                .send({ taskId: "task-12345", title: "Rate limiting test task" });

            expect(res2.statusCode).toBe(429);
            expect(res2.body.message).toMatch(/rate limit/i);
            expect(res2.body).toHaveProperty("retryAfter");
        });

        test("POST /api/ai/generate-description degrades gracefully on AI provider error", async () => {
            const aiRoutes = require("../routes/aiRoutes");
            aiRoutes.__setMockClient({
                chat: {
                    completions: {
                        create: jest.fn().mockRejectedValue(
                            new Error("401 Incorrect API key provided")
                        )
                    }
                }
            });

            const res = await request(app)
                .post("/api/ai/generate-description")
                .send({ title: "Trigger provider error" });

            expect(res.statusCode).toBe(200);
            expect(res.body.fallback).toBe(true);
            expect(res.body.description).toBe("");
            expect(res.body.message).toMatch(/unavailable/i);
        });
    });
});
