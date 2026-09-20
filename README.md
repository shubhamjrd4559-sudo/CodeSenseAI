# 🚀 CodeSense AI — Real-time AI Programming Assistant & Code Runner

<p align="center">
  <img src="https://img.shields.io/badge/CodeSense-AI-6C5CE7?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python" />
  <img src="https://img.shields.io/badge/Vercel-Serverless-black?style=for-the-badge&logo=vercel" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" />
</p>

<p align="center">
  <b>A real-time AI programming assistant and code runner. Chat with an AI teacher, run C++/Python/Java code instantly with standard inputs, and debug in a professional dark-themed editor workspace.</b>
</p>

---

## 🌐 Live Site
🔗 https://shubhamcodeai.vercel.app

---

# ✨ Features

* ⚡ **ChatGPT-Style AI Assistant (Streaming)**
  Ask follow-up questions, request explanations, or debug errors. Responses stream token-by-token in real-time, powered by the fast **Llama 3.1 8B** model on Nvidia NIM.

* 👨‍🏫 **Encouraging AI Teacher Persona**
  The AI chatbot acts like a supportive, direct coding teacher using helpful emojis (👨‍🏫, 💡, 🚀) to make concepts fun and easy to read.

* 🔑 **Stateless HMAC Authentication**
  Complete registration and login system with client-side token verification, fully compatible with Vercel's Serverless environment (no database cold starts or instance sync issues).

* 💻 **VS Code Style Terminal & Editor**
  * Integrated **Monaco Editor** with syntax highlighting and auto-completion.
  * Professional dark-themed terminal console (`#111216`) with high-contrast text rendering.
  * Intelligent stdin warning banner alerting you if your code uses inputs (like `cin >>` or `input()`).

* ⚙️ **Code Execution with Stdin Support**
  Compile and execute Python, JavaScript, Java, and C++ code remotely via **Judge0 API**. Stdin echoes naturally on newlines during output generation.

* ☁️ **Vercel Serverless Ready**
  Fully configured for lightweight, serverless deployment on Vercel.

* 💾 **Save Workspace & History Management**
  Save your current editor code and files into your workspace with custom filenames. View saved files (sorted in chronological queue order) and recent AI assistant chats directly in the Save dropdown panel, and reload any saved file instantly into the editor.

---

# 🛠️ Tech Stack

| Category       | Technology                     |
| -------------- | ------------------------------ |
| Backend        | Django 6.0, Python             |
| Frontend       | Vanilla JS, CSS, Monaco Editor |
| AI Model       | Llama 3.1 8B                   |
| AI API         | Nvidia NIM API (SSE Streaming) |
| Code Execution | Judge0 CE API                  |
| Authentication | Stateless HMAC (Django Signing)|
| Deployment     | Vercel                         |
| Static Files   | WhiteNoise                     |

---

# 🏗️ System Architecture

```text
                ┌─────────────────┐
                │     Frontend    │
                │ Monaco Editor UI│
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   Django API    │
                └──────┬──────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌─────────────────┐         ┌─────────────────┐
│ Nvidia NIM API  │         │   Judge0 API    │
│  Streaming AI   │         │ Code Execution  │
└─────────────────┘         └─────────────────┘
```

---

# 📸 UI Mockup
<img width="1919" height="912" alt="Screenshot 2026-05-27 142500" src="https://github.com/user-attachments/assets/f6ab7dc0-c4a1-48af-9a35-25d166520de5" />

---

# 🚀 Getting Started

## 📋 Prerequisites

* Python 3.10+
* Git
* Nvidia API Key

Get your free Nvidia API key from build.nvidia:
👉 https://build.nvidia.com

---

# ⚙️ Installation

## 1️⃣ Clone Repository
```bash
git clone https://github.com/shubhamjrd4559-sudo/CodeSenseAI.git
cd CodeSenseAI
```

## 2️⃣ Create Virtual Environment
### Linux / Mac
```bash
python -m venv venv
source venv/bin/activate
```
### Windows
```bash
venv\Scripts\activate
```

## 3️⃣ Install Dependencies
```bash
pip install -r requirements.txt
```

---

# 🔑 Environment Variables

Create a `.env` file in the project root:
```env
# xKiro AI (Recommended)
XKIRO_API_KEY="your-xkiro-api-key-here"
XKIRO_MODEL="openai/gpt-5.6-sol"

# Fallback AI Provider (NVIDIA NIM)
NVIDIA_API_KEY="nvapi-your-key-here"
LLM_MODEL="meta/llama-3.1-8b-instruct"
```

---

# ▶️ Run the Project

```bash
python manage.py runserver
```

Open:
```text
http://localhost:8000
```

---

# ☁️ Deployment on Vercel

This project is pre-configured for serverless deployment using `vercel.json`.

## Deployment Steps
1. Push your project to GitHub
2. Import the repository into Vercel
3. Add environment variables:
   * `XKIRO_API_KEY` (and optionally `XKIRO_MODEL`)
   * Or `NVIDIA_API_KEY` (if using NVIDIA)
4. Click **Deploy**

Done ✅

---

# 🎮 Usage

1. Write your code in the Monaco editor.
2. Select your language from the dropdown menu (e.g. Python, C++).
3. If your code needs stdin input, type it in the **Program Input** text box (each value on a new line).
4. Click **Run** (or press `F5` / `Ctrl + Shift + Enter`) to compile and run your code.
5. Ask follow-up questions, debug errors, or request explanations in the **AI Assistant** chat panel.
6. Click **Save** in the header toolbar to toggle the workspace panel. Type a filename and click **Save** to add it to your saved workspace list.
7. Click any file inside your **Saved Workspace** to instantly load it back into the editor, or delete files you no longer need.

---

# 🤝 Contributing

Contributions are welcome!
```bash
git checkout -b feature-name
git commit -m "Added new feature"
git push origin feature-name
```
Then open a Pull Request 🚀

---

# 📝 License
This project is licensed under the **MIT License**.

---

# 👨‍💻 Author

## Shubham Kumar
* GitHub: https://github.com/shubhamjrd4559-sudo
* Live Project: https://shubhamcodeai.vercel.app
