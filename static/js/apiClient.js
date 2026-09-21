/**
 * API Client for CodeSense AI.
 * Handles all communication with the Django backend.
 */
const ApiClient = (() => {
  const BASE_URL = '';  // Same origin
  const TOKEN_KEY = 'codesense-auth-token';
  const USER_KEY = 'codesense-auth-user';

  async function post(endpoint, data) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok && !result.success) {
      throw new Error(result.error || `Request failed (${response.status})`);
    }

    return result;
  }

  async function login(email, password) {
    // Also send the stored token (if any) so backend can verify this
    // password matches the one used at registration
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const result = await post('login', { email, password, stored_token: storedToken || '' });
    if (result.success && result.access_token) {
      localStorage.setItem(TOKEN_KEY, result.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user || { email }));
    }
    return result;
  }

  async function register(email, password, confirm_password) {
    const result = await post('register', { email, password, confirm_password });
    if (result.success && result.access_token) {
      localStorage.setItem(TOKEN_KEY, result.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user || { email }));
    }
    return result;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function isAuthenticated() { return Boolean(getToken()); }

  async function reviewCode(code, language, reviewMode) {
    return post('review-code', { code, language, reviewMode });
  }

  async function chat(message, code = '', reviewContext = '', language = '') {
    return post('chat', { message, code, reviewContext, language });
  }

  async function chatStream(message, code = '', reviewContext = '', language = '', onChunk, onDone, onError) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, code, reviewContext, language, stream: true }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const err = new Error(errJson.error || `Request failed (${response.status})`);
        err.status = response.status;
        err.wait_seconds = errJson.wait_seconds;
        throw err;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.error) {
                onError(new Error(parsed.error));
                return;
              }
              if (parsed.t) {
                onChunk(parsed.t);
              }
            } catch (err) {
              console.error('Error parsing stream chunk:', err);
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.t) onChunk(parsed.t);
        } catch (err) {}
      }

      onDone();
    } catch (error) {
      onError(error);
    }
  }


  async function runCode(code, language, stdin = '') {
    return post('run-code', { code, language, stdin });
  }

  return { login, register, logout, getToken, getUser, isAuthenticated, reviewCode, chat, chatStream, runCode };
})();
