# ⚡ CodeSense AI — Real-Time AI Code Reviewer & Interactive IDE

<p align="center">
  <img src="https://img.shields.io/badge/CodeSense-AI-6C5CE7?style=for-the-badge&logo=openai&logoColor=white" alt="CodeSense AI" />
  <img src="https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Monaco_Editor-VS_Code_Core-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Monaco" />
  <img src="https://img.shields.io/badge/Vercel-Serverless_Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/License-MIT-F1C40F?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <b>A full-stack, cloud-native developer environment combining real-time LLM code review, an authentic VS Code interactive terminal, polyglot remote code execution, and seamless workspace management.</b>
</p>

<p align="center">
  <a href="https://shubhamcodeai.vercel.app"><strong>🌐 Explore Live Application »</strong></a>
  <br />
  <br />
  <a href="#-key-features">Key Features</a> •
  <a href="#-architecture--data-flow">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-api-reference">API Docs</a> •
  <a href="#-author">Author</a>
</p>

---

## 🌐 Live Production Deployment
* **Live URL:** [https://shubhamcodeai.vercel.app](https://shubhamcodeai.vercel.app)
* **Status:** 🟢 Online & High Availability (Vercel Edge & Serverless Python)

---

## 📸 Workspace Overview

<p align="center">
  <img width="100%" alt="CodeSense AI Interface" src="https://github.com/user-attachments/assets/f6ab7dc0-c4a1-48af-9a35-25d166520de5" style="border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

## ✨ Key Features

### 1. 🧠 Real-Time Streaming AI Assistant
* **Token-by-Token SSE:** Streaming responses via Server-Sent Events for near-instant latency without buffering.
* **xKiro AI Engine with Fallback:** Powered primarily by **Qwen 3.8 Omni Flash** via xKiro API, with automatic graceful fallback to **Meta Llama 3.1 8B** on NVIDIA NIM.
* **Context-Aware Review:** Analyzes editor code, selected language, and syntax trees to highlight bugs, security vulnerabilities, edge cases, and time/space complexity optimizations.
* **Automated YouTube Video Recommendations:** Whenever relevant coding topics or algorithms are discussed, relevant educational lecture videos are dynamically fetched and embedded directly inside the chat feed.

### 2. ⚡ AI Logo "New Chat" & Chat History Management
* **Instant Session Reset:** Click the glowing **AI Logo button** directly above the decorator toolbar to instantly initialize a clean chat session with pre-configured suggestion chips (*Explain Code, Find Bugs, Optimize, Security*).
* **Overlay Chat History:** Click **Old Chats** to open a full slide-in drawer showing previous conversation threads with timestamps and message counts.
* **Granular Chat Deletion (`🗑️`):** Remove individual sessions with a single click, keeping both guest and authenticated storage clutter-free.

### 3. 💻 Authentic VS Code Interactive Terminal
* **Zero Clutter:** Replaced cumbersome static STDIN input forms with an integrated, authentic VS Code terminal experience (`>_ TERMINAL`).
* **Smart Input Detection & Inline Prompt:** Automatically parses incoming code for input operations (`cin >>`, `scanf`, `input()`, `Scanner`) and prompts with an inline cursor (`PS C:\workspace> █`).
* **Live Echo Execution:** Enter input values directly into the console prompt, hitting `Enter` to freeze the input and immediately stream remote compiler execution outputs.

### 4. ⚙️ Polyglot Remote Execution Engine
* **Cloud Sandboxing:** Executes **C++, Python, Java, and JavaScript** via the **Judge0 API**.
* **Base64 & Unicode Normalization:** Employs an internal string normalizer to convert mathematical Unicode symbols (e.g., `≤`, `≥`, `≠`, non-standard quotes) into strict ASCII prior to Base64 transmission, eliminating HTTP 400 submission errors.

### 5. 💾 Workspace File Manager & Hot-Reload
* **File Persistence:** Save, tag, and organize custom source code snippets across multiple languages.
* **Two-Way Sync:** Load any saved code directly into the editor with automatic language switching and syntax re-highlighting.
* **Persistent User State:** Stores files safely with support for signed-in user profiles and local guest workspaces.

### 6. 🔐 Stateless HMAC Authentication
* **Zero Cold-Start Lag:** Engineered with cryptographically signed tokens (`django.core.signing`) to operate statelessly across serverless lambdas.
* **No Database Locking:** Eliminates database latency and connection pool exhaustion during sudden spikes on Vercel.

### 7. 🛡️ Sliding-Window IP Rate Limiter & Abuse Shield
* **Automated Spam Mitigation:** Enforces a sliding-window rate limiting policy allowing a maximum of **7 messages per 60 seconds** per client IP.
* **Real IP Edge Detection:** Extracts genuine user IP addresses behind Vercel edge reverse proxies (`HTTP_X_FORWARDED_FOR`) with fallback handling.
* **Zero AI Token Waste:** Throttled requests are blocked immediately at the Django gateway with **HTTP 429** (`Too Many Requests`), protecting API keys and upstream LLM quotas.
* **Live UI Cooldown Countdown:** The chat Send button turns into a dynamic countdown (`Wait 22s...`), temporarily disabling input until the cooldown window slides.

---

## 🏗️ Architecture & Data Flow

```text
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                            CLIENT BROWSER                               │
 │                                                                         │
 │   ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
 │   │ Monaco Code Editor   │  │ VS Code Console │  │ AI Assistant UI  │  │
 │   │ (Syntax & Completion)│  │ (Inline Prompts)│  │ (SSE + Cooldown) │  │
 │   └──────────┬───────────┘  └────────┬────────┘  └────────┬─────────┘  │
 └──────────────┼───────────────────────┼────────────────────┼─────────────┘
                │                       │                    │
                ▼                       ▼                    ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                       DJANGO REST API (VERCEL)                          │
 │                                                                         │
 │   ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
 │   │ /api/run-code        │  │ 7-Msg/Min Shield│  │ /api/auth/*      │  │
 │   │ (Code Execution)     │  │ (Rate Limiter)  │  │ (Stateless HMAC) │  │
 │   └──────────┬───────────┘  └────────┬────────┘  └──────────────────┘  │
 │              │                       ▼                                 │
 │              │              ┌─────────────────┐                        │
 │              │              │ /api/chat-stream│                        │
 │              │              │ (SSE Streaming) │                        │
 │              │              └────────┬────────┘                        │
 └──────────────┼───────────────────────┼──────────────────────────────────┘
                │                       │
         ┌──────┴──────┐         ┌──────┴──────────────────────────┐
         ▼             ▼         ▼                                 ▼
   ┌──────────┐  ┌──────────┐ ┌──────────────────────┐  ┌──────────────────┐
   │ Judge0   │  │ Base64   │ │ Primary Provider     │  │ Fallback NIM     │
   │ Sandbox  │  │ Engine   │ │ xKiro (Qwen 3.8 Omni)│  │ (Llama 3.1 8B)   │
   └──────────┘  └──────────┘ └──────────────────────┘  └──────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | Vanilla ES6+ JavaScript, Semantic HTML5, Custom CSS3 Design System |
| **Code Editor** | Monaco Editor (VS Code core engine) |
| **Backend Framework** | Django 6.0, Django REST Framework, Python 3.10+ |
| **Rate Limiting & Security** | Sliding-Window IP Throttler (7 msgs/60s via Django Memory Cache) |
| **AI LLM Inference** | xKiro API (Qwen 3.8 Omni Flash:free), NVIDIA NIM (Llama 3.1 8B) |
| **Code Execution** | Judge0 CE (Dockerized remote compiler engine) |
| **Streaming Protocol** | Server-Sent Events (SSE) via `StreamingHttpResponse` |
| **Authentication** | Cryptographic HMAC Token Signing (`django.core.signing`) |
| **Static Assets** | WhiteNoise Static Asset Compression & Caching |
| **Hosting & CI/CD** | Vercel Serverless Functions + GitHub Actions Auto-Deploy |

---

## ⌨️ Productivity Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>F5</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> | **Run Code / Compile** | Global Editor |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | **Quick Save Workspace** | Global Editor |
| <kbd>Enter</kbd> (in terminal) | **Submit Input Value** | Active Terminal Prompt |
| <kbd>Enter</kbd> (in chat) | **Send Message to AI** | Chat Input Box |
| <kbd>Escape</kbd> | **Close Any Active Popup / Dropdown** | Global Window |

---

## 🚀 Getting Started Locally

### 📋 Prerequisites
* **Python 3.10+**
* **Git**
* Free API key from [xKiro](https://xkiro.com) or [NVIDIA Build](https://build.nvidia.com)

---

### 📥 Step 1: Clone the Repository
```bash
git clone https://github.com/shubhamjrd4559-sudo/CodeSenseAI.git
cd CodeSenseAI
```

---

### 🐍 Step 2: Set Up Virtual Environment

#### On Windows (PowerShell / CMD):
```powershell
python -m venv venv
venv\Scripts\activate
```

#### On macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

---

### 📦 Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

---

### ⚙️ Step 4: Configure Environment Variables

Create a `.env` file in the root directory:
```env
# Django Settings
DEBUG=True
SECRET_KEY=your-secure-django-secret-key-here

# Primary AI Model (xKiro)
XKIRO_API_KEY=your-xkiro-api-key-here
XKIRO_MODEL=qwen/qwen3.8-omni-flash:free

# Secondary Fallback Model (NVIDIA NIM)
NVIDIA_API_KEY=nvapi-your-nvidia-key-here
LLM_MODEL=meta/llama-3.1-8b-instruct

# Execution Engine (Judge0)
RAPIDAPI_KEY=your-rapidapi-key-here  # Optional if using public endpoint
```

---

### 🏃‍♂️ Step 5: Run Database Migrations & Start Server
```bash
python manage.py migrate
python manage.py runserver
```

Open your browser and navigate to:
```text
http://127.0.0.1:8000
```

---

## 📡 API Reference

### 1. Execute Code
* **Endpoint:** `POST /api/run-code/`
* **Payload:**
```json
{
  "code": "#include <iostream>\nint main() { std::cout << \"Hello World\"; return 0; }",
  "language": "cpp",
  "stdin": ""
}
```
* **Response:**
```json
{
  "success": true,
  "output": "Hello World",
  "exit_code": 0,
  "execution_time": "0.045s",
  "memory": "1420 KB"
}
```

---

### 2. Stream AI Assistant Response
* **Endpoint:** `POST /api/chat-stream/`
* **Headers:** `Accept: text/event-stream`
* **Payload:**
```json
{
  "message": "Explain the time complexity of this binary search",
  "code": "def binary_search(arr, x): ...",
  "language": "python"
}
```
* **Response:** Tokens streamed via SSE chunk format (`data: {"token": "..."}\n\n`).
* **Rate Limit Reached (HTTP 429):**
```json
{
  "success": false,
  "error": "⏳ Rate limit reached: 1 minute me maximum 7 messages allow hain. Kripya 22s wait karein!",
  "wait_seconds": 22
}
```

---

## ☁️ Deployment on Vercel

This repository is optimized for deployment on Vercel:

1. Fork or push your changes to your GitHub repository.
2. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Select `CodeSenseAI` and set Framework Preset to **Other** (handled automatically by `vercel.json`).
4. In **Environment Variables**, add:
   * `XKIRO_API_KEY`: Your xKiro API key
   * `SECRET_KEY`: A random 50-character string
5. Click **Deploy**. Vercel will build and deploy the application in under 60 seconds!

---

## 🗺️ Future Roadmap

- [x] **Sliding-Window IP Rate Limiter:** 7 messages / 60s abuse shield with live UI cooldown countdown.
- [ ] **RAG (Retrieval-Augmented Generation) Pipeline:** Integrating vector embeddings (Pinecone) with a curated DSA & algorithmic pattern library for zero-hallucination code reviews.
- [ ] **Upstash Redis Caching:** Low-latency caching for frequent code queries and cross-region rate limiting.
- [ ] **Multi-Tab File Editor:** Support simultaneous multi-file workspaces and tabs.
- [ ] **Real-Time Collaborative Coding:** WebRTC / WebSocket powered peer-to-peer live pair programming.

---

## 🤝 Contributing

Contributions are what make the open-source community an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License
Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👨‍💻 Author

### **Shubham Kumar**
* **GitHub:** [@shubhamjrd4559-sudo](https://github.com/shubhamjrd4559-sudo)
* **Live Project:** [https://shubhamcodeai.vercel.app](https://shubhamcodeai.vercel.app)
* **Project Repository:** [CodeSenseAI](https://github.com/shubhamjrd4559-sudo/CodeSenseAI)

<p align="right">(<a href="#-codesense-ai--real-time-ai-code-reviewer--interactive-ide">back to top ↑</a>)</p>
