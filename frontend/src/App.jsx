import { useEffect, useState, useCallback } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const TASKS_URL = `${API_BASE}/tasks`;

function App() {
  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem("task_auth_token") || "");
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("task_auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [authTab, setAuthTab] = useState("login"); // "login" | "register"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // AI Description Generator state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDisclaimer, setAiDisclaimer] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  // Generate task description using backend AI endpoint
  const handleGenerateDescription = async () => {
    setAiError("");
    setAiNotice("");

    if (!title.trim()) {
      setAiError("Please enter a task title first to generate an AI description.");
      return;
    }

    if (title.trim().length < 3) {
      setAiError("Task title must be at least 3 characters long.");
      return;
    }

    if (description.trim()) {
      const confirmOverwrite = window.confirm(
        "A description already exists. Do you want to replace it with an AI-generated suggestion?"
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    try {
      setAiLoading(true);

      const response = await fetch(`${API_BASE}/api/ai/generate-description`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim()
        })
      });

      const data = await response.json();

      if (response.status === 429) {
        setAiError(data.message || "Rate limit reached. Please wait a moment before trying again.");
        return;
      }

      if (!response.ok) {
        setAiError(data.message || "Failed to generate AI description.");
        return;
      }

      if (data.fallback) {
        setAiNotice(data.message || "AI suggestions are temporarily unavailable. Please enter a description manually.");
        setAiDisclaimer(false);
      } else if (data.description) {
        setDescription(data.description);
        setAiDisclaimer(true);
        setAiNotice("AI suggestion generated! Review and edit as needed before adding.");
      }
    } catch {
      setAiError("Unable to connect to AI generation service. You can write the description manually.");
      setAiDisclaimer(false);
    } finally {
      setAiLoading(false);
    }
  };

  // Logout handler
  const handleLogout = useCallback((customMsg = "") => {
    localStorage.removeItem("task_auth_token");
    localStorage.removeItem("task_auth_user");
    setToken("");
    setUser(null);
    setTasks([]);
    setError("");
    setMessage("");
    setAuthError("");
    setAuthMessage(customMsg || "Logged out successfully");
  }, []);

  // Helper for authenticated requests that catches 401 and expires session
  const authFetch = useCallback(
    async (url, options = {}) => {
      const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      };

      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        handleLogout("Your session has expired or is invalid. Please log in again.");
        throw new Error("Session expired. Please log in again.");
      }

      return response;
    },
    [token, handleLogout]
  );

  // Verify session on initial load or token change
  useEffect(() => {
    if (!token) return;

    const verifySession = async () => {
      try {
        const response = await fetch(`${API_BASE}/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          handleLogout("Session expired. Please log in again.");
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          localStorage.setItem("task_auth_user", JSON.stringify(data.user));
        }
      } catch {
        // Network error - do not forcibly logout if backend temporarily down
      }
    };

    verifySession();
  }, [token, handleLogout]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");
      const response = await authFetch(TASKS_URL);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch tasks");
      }

      const data = await response.json();
      setTasks(data);
    } catch (err) {
      if (err.message !== "Session expired. Please log in again.") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, authFetch]);

  // Load tasks whenever token is valid
  useEffect(() => {
    if (token) {
      fetchTasks();
    }
  }, [token, fetchTasks]);

  // Registration handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Email and password are required");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long");
      return;
    }

    try {
      setAuthLoading(true);
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setAuthMessage("Registration successful! You can now log in.");
      setAuthTab("login");
      setAuthPassword("");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Email and password are required");
      return;
    }

    try {
      setAuthLoading(true);
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("task_auth_token", data.token);
      localStorage.setItem("task_auth_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setAuthPassword("");
      setMessage("Welcome back!");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Add Task
  const addTask = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    const taskTitle = title.trim();
    const taskDescription = description.trim();

    const temporaryTask = {
      _id: "temp-" + Date.now(),
      title: taskTitle,
      description: taskDescription,
      completed: false
    };

    setTasks((prev) => [temporaryTask, ...prev]);
    setTitle("");
    setDescription("");
    setError("");
    setMessage("");
    setAiDisclaimer(false);
    setAiNotice("");
    setAiError("");

    try {
      setLoading(true);

      const response = await authFetch(TASKS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          completed: false
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create task");
      }

      const data = await response.json();

      setTasks((prev) =>
        prev.map((task) => (task._id === temporaryTask._id ? data.task : task))
      );

      setMessage("Task created successfully");
    } catch (err) {
      setTasks((prev) =>
        prev.filter((task) => task._id !== temporaryTask._id)
      );
      if (err.message !== "Session expired. Please log in again.") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle complete
  const toggleComplete = async (task) => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await authFetch(`${TASKS_URL}/${task._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          completed: !task.completed
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update task status");
      }

      const data = await response.json();

      setTasks((prev) =>
        prev.map((item) => (item._id === task._id ? data.task : item))
      );

      setMessage("Task updated successfully");
    } catch (err) {
      if (err.message !== "Session expired. Please log in again.") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update Task (Title & Description)
  const updateTask = async (task) => {
    const newTitle = window.prompt("Enter new task title:", task.title);

    if (newTitle === null) {
      return;
    }

    if (!newTitle.trim()) {
      setError("Task title cannot be empty");
      return;
    }

    const newDescription = window.prompt(
      "Enter new description:",
      task.description || ""
    );

    if (newDescription === null) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await authFetch(`${TASKS_URL}/${task._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          completed: task.completed
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update task");
      }

      const data = await response.json();

      setTasks((prev) =>
        prev.map((item) => (item._id === task._id ? data.task : item))
      );

      setMessage("Task updated successfully");
    } catch (err) {
      if (err.message !== "Session expired. Please log in again.") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Delete Task
  const deleteTask = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this task?");

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await authFetch(`${TASKS_URL}/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete task");
      }

      setTasks((prev) => prev.filter((task) => task._id !== id));
      setMessage("Task deleted successfully");
    } catch (err) {
      if (err.message !== "Session expired. Please log in again.") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // If user is not authenticated, display login / register view
  if (!token) {
    return (
      <div className="page">
        <div className="auth-container">
          <div className="auth-header">
            <p className="eyebrow">Practical 7</p>
            <h1>Task Manager</h1>
            <p className="subtitle">Secure Authentication & Middleware</p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authTab === "login" ? "active" : ""}`}
              onClick={() => {
                setAuthTab("login");
                setAuthError("");
                setAuthMessage("");
              }}
            >
              Log In
            </button>
            <button
              type="button"
              className={`auth-tab ${authTab === "register" ? "active" : ""}`}
              onClick={() => {
                setAuthTab("register");
                setAuthError("");
                setAuthMessage("");
              }}
            >
              Register
            </button>
          </div>

          {authLoading && <p className="info">Processing request...</p>}
          {authError && <p className="error">{authError}</p>}
          {authMessage && <p className="success">{authMessage}</p>}

          {authTab === "login" ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={authLoading}
              >
                {authLoading ? "Logging in..." : "Log In"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="register-email">Email Address</label>
                <input
                  id="register-email"
                  type="email"
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="register-password">Password</label>
                <input
                  id="register-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
                <span className="password-hint">
                  Password must be at least 6 characters.
                </span>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={authLoading}
              >
                {authLoading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Authenticated Task Manager View
  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div>
            <p className="eyebrow">Practical 13</p>
            <h1>Task Manager</h1>
            <p className="subtitle">
              Node.js + Express + MongoDB + AI Integration (OpenAI / Gemini)
            </p>
          </div>

          <div className="header-right">
            {user && (
              <div className="user-badge" title="Logged in user">
                <span>👤</span>
                <span>{user.email}</span>
              </div>
            )}
            <div className="header-actions">
              <button className="refresh-btn" onClick={fetchTasks} title="Refresh tasks">
                Refresh
              </button>
              <button
                className="logout-btn"
                onClick={() => handleLogout()}
                title="Log out of your account"
              >
                Log Out
              </button>
            </div>
          </div>
        </header>

        {loading && <p className="info">Loading...</p>}
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <form className="task-form" onSubmit={addTask}>
          <div className="form-group-task">
            <label htmlFor="task-title" className="task-field-label">Task Title</label>
            <input
              id="task-title"
              type="text"
              placeholder="e.g. Prepare Practical 13 report"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (aiError) setAiError("");
              }}
              required
            />
          </div>

          <div className="description-container">
            <div className="description-header">
              <label htmlFor="task-description" className="task-field-label">Task Description</label>
              <button
                type="button"
                className={`btn-ai-generate ${aiLoading ? "loading" : ""}`}
                onClick={handleGenerateDescription}
                disabled={aiLoading}
                title="Auto-generate description from title using AI"
              >
                {aiLoading ? (
                  <>
                    <span className="spinner-icon">⏳</span> Generating description...
                  </>
                ) : (
                  <>
                    <span className="sparkle-icon">✨</span> Generate description
                  </>
                )}
              </button>
            </div>

            <textarea
              id="task-description"
              className="task-textarea"
              placeholder="Enter a task description, or click 'Generate description' above for an AI suggestion"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (aiDisclaimer) setAiDisclaimer(false);
              }}
              rows={3}
            />

            {aiDisclaimer && (
              <div className="ai-disclaimer" role="alert">
                <span className="ai-badge">AI</span>
                <span>AI-generated suggestion — please review and edit before saving.</span>
              </div>
            )}

            {aiNotice && !aiDisclaimer && (
              <div className="ai-notice">
                <span>💡</span>
                <span>{aiNotice}</span>
              </div>
            )}

            {aiError && (
              <div className="ai-error-banner" role="alert">
                <span>⚠️</span>
                <span>{aiError}</span>
              </div>
            )}
          </div>

          <button type="submit" className="btn-add-task" disabled={loading}>
            {loading ? "Adding..." : "Add Task"}
          </button>
        </form>

        <section>
          <div className="section-title">
            <h2>Your Tasks</h2>
            <span>
              {tasks.length} task{tasks.length === 1 ? "" : "s"}
            </span>
          </div>

          {tasks.length === 0 && !loading && (
            <div className="empty">
              No tasks available. Add your first task.
            </div>
          )}

          <div className="task-list">
            {tasks.map((task) => (
              <article className="task" key={task._id}>
                <div className="task-content">
                  <h3>{task.title}</h3>
                  <p>{task.description || "No description"}</p>

                  <span
                    className={
                      task.completed ? "status completed" : "status pending"
                    }
                  >
                    {task.completed ? "Completed" : "Pending"}
                  </span>
                </div>

                <div className="task-actions">
                  <button
                    className="toggle-btn"
                    onClick={() => toggleComplete(task)}
                    title="Toggle task completion status"
                  >
                    {task.completed ? "Mark Pending" : "Mark Done"}
                  </button>

                  <button onClick={() => updateTask(task)}>
                    Update
                  </button>

                  <button
                    className="delete"
                    onClick={() => deleteTask(task._id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
