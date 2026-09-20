/**
 * Main Application Controller for CodeSense AI.
 * Orchestrates review, execution, chat context, and account UI.
 */
const App = (() => {
  let lastReviewContext = '';
  let isReviewing = false;
  let isRunning = false;

  const reviewButtonHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><span>Review</span>';
  const runButtonHtml = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>Run</span>';

  function getLastReviewContext() {
    return lastReviewContext;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setStatus(text, state = 'ready') {
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const statusBar = document.getElementById('status-bar');

    if (statusText) statusText.textContent = text;
    if (statusDot) {
      statusDot.className = 'status-dot';
      if (state === 'loading') statusDot.classList.add('loading');
      else if (state === 'error') statusDot.classList.add('disconnected');
    }
    if (statusBar) statusBar.classList.toggle('active', state === 'loading');
  }

  function renderReviewResult(data) {
    const contentEl = document.getElementById('review-content');
    const badgeEl = document.getElementById('risk-badge');
    if (!contentEl) return;

    let html = '';

    if (badgeEl && data.riskLevel) {
      const level = data.riskLevel.toLowerCase();
      const cls = level === 'high' ? 'risk-high' : level === 'medium' ? 'risk-medium' : level === 'low' ? 'risk-low' : 'risk-unknown';
      badgeEl.innerHTML = `<span class="risk-badge ${cls}">${escapeHtml(data.riskLevel)}</span>`;
    }

    if (data.summary) {
      html += `<div class="review-summary"><h3>Summary</h3><p>${escapeHtml(data.summary)}</p></div>`;
    }

    if (data.issues && data.issues.length > 0) {
      html += '<div class="review-section"><h4>Issues Found</h4>';
      data.issues.forEach((issue) => {
        const typeCls = `issue-type-${(issue.type || 'bug').toLowerCase()}`;
        html += `
          <div class="issue-card">
            <div class="issue-header">
              <span class="issue-type ${typeCls}">${escapeHtml(issue.type || 'Issue')}</span>
              ${issue.line ? `<span class="issue-line">Line ${escapeHtml(String(issue.line))}</span>` : ''}
              <span class="issue-severity">${escapeHtml(issue.severity || '')}</span>
            </div>
            <div class="issue-description">${escapeHtml(issue.description || '')}</div>
            ${issue.suggestion ? `<div class="issue-suggestion">${escapeHtml(issue.suggestion)}</div>` : ''}
            ${issue.fixedCode ? `<pre class="issue-fixed-code"><code>${escapeHtml(issue.fixedCode)}</code></pre>` : ''}
          </div>`;
      });
      html += '</div>';
    }

    if (data.suggestions && data.suggestions.length > 0) {
      html += '<div class="review-section"><h4>Suggestions</h4><ul class="review-list">';
      data.suggestions.forEach((suggestion) => { html += `<li>${escapeHtml(suggestion)}</li>`; });
      html += '</ul></div>';
    }

    if (data.positives && data.positives.length > 0) {
      html += '<div class="review-section"><h4>Positives</h4><ul class="review-list positives">';
      data.positives.forEach((positive) => { html += `<li>${escapeHtml(positive)}</li>`; });
      html += '</ul></div>';
    }

    if (data.rawResponse) {
      html += `<div class="review-section"><h4>Full Response</h4><div class="raw-response">${escapeHtml(data.rawResponse)}</div></div>`;
    }

    contentEl.innerHTML = html || '<div class="review-empty"><p>No issues found. Your code looks good.</p></div>';
  }

  function showReviewLoading() {
    const contentEl = document.getElementById('review-content');
    const badgeEl = document.getElementById('risk-badge');
    if (contentEl) {
      contentEl.innerHTML = '<div class="loading-overlay"><div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div><span>Analyzing your code<span class="loading-dots"></span></span></div>';
    }
    if (badgeEl) badgeEl.innerHTML = '';
  }

  function showReviewError(message) {
    const contentEl = document.getElementById('review-content');
    if (contentEl) {
      contentEl.innerHTML = `<div class="review-empty"><div class="review-empty-icon">!</div><p>${escapeHtml(message)}</p></div>`;
    }
  }

  async function handleReview() {
    if (isReviewing) return;

    const code = Editor.getCode().trim();
    if (!code) {
      showReviewError('Please enter some code to review.');
      return;
    }

    const language = document.getElementById('language-select')?.value || 'python';
    const reviewMode = document.getElementById('review-mode-select')?.value || 'general';
    const reviewBtn = document.getElementById('review-btn');

    isReviewing = true;
    if (reviewBtn) {
      reviewBtn.disabled = true;
      reviewBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span><span>Reviewing</span>';
    }
    showReviewLoading();
    setStatus('Analyzing code...', 'loading');

    try {
      const result = await ApiClient.reviewCode(code, language, reviewMode);
      if (result.success) {
        renderReviewResult(result);
        lastReviewContext = result.summary || '';
        setStatus('Review complete', 'ready');
      } else {
        showReviewError(result.error || 'Review failed.');
        setStatus('Review failed', 'error');
      }
    } catch (error) {
      showReviewError(error.message);
      setStatus('Error', 'error');
    } finally {
      isReviewing = false;
      if (reviewBtn) {
        reviewBtn.disabled = false;
        reviewBtn.innerHTML = reviewButtonHtml;
      }
    }
  }

  /**
   * VS Code Interactive Terminal Implementation
   */
  function getTerminalCommand(language) {
    switch ((language || '').toLowerCase()) {
      case 'cpp':
        return 'g++ -O3 main.cpp -o main && ./main';
      case 'c':
        return 'gcc main.c -o main && ./main';
      case 'python':
        return 'python main.py';
      case 'javascript':
        return 'node main.js';
      case 'typescript':
        return 'ts-node main.ts';
      case 'java':
        return 'javac Main.java && java Main';
      case 'csharp':
        return 'dotnet run';
      case 'go':
        return 'go run main.go';
      case 'rust':
        return 'rustc main.rs && ./main';
      case 'bash':
        return 'bash script.sh';
      default:
        return './program';
    }
  }

  function detectInputPrompt(code) {
    if (!code) return null;

    // 1. C/C++: cout << "prompt" before cin / scanf
    const cppCout = /cout\s*<<\s*["']([^"'\n]+)["']/i.exec(code);
    const hasCin = /\bcin\s*>>|\bscanf\s*\(|\bgetline\s*\(/i.test(code);
    if (cppCout && hasCin) return cppCout[1];

    const cPrintf = /printf\s*\(\s*["']([^"'\n%]+)["']/i.exec(code);
    if (cPrintf && hasCin) return cPrintf[1];

    // 2. Python: input("prompt")
    const pyInput = /input\s*\(\s*["']([^"'\n]+)["']\s*\)/i.exec(code);
    if (pyInput) return pyInput[1];
    if (/\binput\s*\(/i.test(code)) return 'Enter input: ';

    // 3. Java: System.out.print("prompt") with Scanner
    const javaPrint = /System\.out\.print(?:ln)?\s*\(\s*["']([^"'\n]+)["']\s*\)/i.exec(code);
    const hasScanner = /\bScanner\b|\bBufferedReader\b/i.test(code);
    if (javaPrint && hasScanner) return javaPrint[1];

    // 4. C#: Console.Write("prompt") with Console.Read
    const csWrite = /Console\.Write(?:Line)?\s*\(\s*["']([^"'\n]+)["']\s*\)/i.exec(code);
    const hasConsoleRead = /\bConsole\.Read/i.test(code);
    if (csWrite && hasConsoleRead) return csWrite[1];

    // Generic fallback if input keyword exists without literal prompt string
    if (hasCin || hasScanner || hasConsoleRead) {
      return 'Enter input: ';
    }

    return null;
  }

  async function executeAndRenderTerminal(code, language, stdin, cmd, promptText = '') {
    const runBtn = document.getElementById('run-btn');
    const outputEl = document.getElementById('output-content');
    const statusEl = document.getElementById('output-status');

    isRunning = true;
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span><span>Running</span>';
    }
    if (statusEl) statusEl.textContent = 'Running...';
    setStatus('Running in terminal...', 'loading');

    // Add loader line
    const loadingId = 'term-loading-' + Date.now();
    if (outputEl) {
      const loader = document.createElement('div');
      loader.id = loadingId;
      loader.className = 'terminal-line';
      loader.style.color = '#ffeaa7';
      loader.innerHTML = '<span class="loading-spinner" style="width:11px;height:11px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>Executing...';
      outputEl.appendChild(loader);
      outputEl.scrollTop = outputEl.scrollHeight;
    }

    try {
      const result = await ApiClient.runCode(code, language, stdin);

      // Remove loader
      document.getElementById(loadingId)?.remove();

      let stdout = (result.stdout || '').trimEnd();

      // Avoid repeating the prompt if stdout echoes it back
      if (promptText && stdout) {
        const pTrimmed = promptText.trim();
        if (stdout.startsWith(pTrimmed)) {
          stdout = stdout.substring(pTrimmed.length).replace(/^[\s:]+/, '');
        }
      }

      let html = '';
      if (stdout) {
        html += `<div class="output-stdout">${escapeHtml(stdout)}</div>`;
      }

      if (result.stderr && result.stderr.trim()) {
        html += `<div class="output-stderr">${escapeHtml(result.stderr.trim())}</div>`;
      }

      // Exit code status badge
      if (result.timed_out) {
        html += `<div class="output-exit-code timeout">⏱ Timed Out (Execution took too long)</div>`;
      } else if (!result.success && result.error && !result.stdout && !result.stderr) {
        html += `<div class="output-stderr">${escapeHtml(result.error)}</div>`;
      } else if (result.exit_code === 0) {
        html += `<div class="output-exit-code success">✓ [Process completed - exit code 0]</div>`;
      } else if (result.exit_code !== undefined && result.exit_code !== null) {
        html += `<div class="output-exit-code error">✗ [Process exited with code ${result.exit_code}]</div>`;
      }

      // New prompt line for next command
      html += `<div class="terminal-command-line" style="margin-top: 10px;"><span class="terminal-prompt">PS C:\\workspace&gt;</span> <span class="terminal-cursor">█</span></div>`;

      if (outputEl) {
        const resultContainer = document.createElement('div');
        resultContainer.innerHTML = html;
        outputEl.appendChild(resultContainer);
        outputEl.scrollTop = outputEl.scrollHeight;
      }

      if (statusEl) statusEl.textContent = result.success ? 'Done' : 'Error';
      setStatus(result.success ? 'Execution complete' : 'Execution failed', result.success ? 'ready' : 'error');

    } catch (err) {
      document.getElementById(loadingId)?.remove();
      if (outputEl) {
        const errDiv = document.createElement('div');
        errDiv.innerHTML = `<div class="output-stderr">${escapeHtml(err.message || 'Execution error')}</div><div class="terminal-command-line" style="margin-top: 10px;"><span class="terminal-prompt">PS C:\\workspace&gt;</span> <span class="terminal-cursor">█</span></div>`;
        outputEl.appendChild(errDiv);
        outputEl.scrollTop = outputEl.scrollHeight;
      }
      if (statusEl) statusEl.textContent = 'Error';
      setStatus('Execution failed', 'error');
    } finally {
      isRunning = false;
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = runButtonHtml;
      }
    }
  }

  async function handleRunCode() {
    if (isRunning) return;

    const code = Editor.getCode().trim();
    const outputEl = document.getElementById('output-content');
    const panel = document.getElementById('output-panel');

    if (panel) panel.classList.remove('collapsed');

    if (!code) {
      if (outputEl) {
        outputEl.innerHTML = '<span class="output-stderr">No code to run. Write code in the editor first.</span><div class="terminal-command-line" style="margin-top: 8px;"><span class="terminal-prompt">PS C:\\workspace&gt;</span> <span class="terminal-cursor">█</span></div>';
      }
      return;
    }

    const language = document.getElementById('language-select')?.value || 'python';
    const cmd = getTerminalCommand(language);
    const promptText = detectInputPrompt(code);

    if (promptText) {
      // INTERACTIVE MODE: Render prompt line with inline input & wait for Enter!
      outputEl.innerHTML = `
        <div class="terminal-command-line">
          <span class="terminal-prompt">PS C:\\workspace&gt;</span> <span class="terminal-command-text">${escapeHtml(cmd)}</span>
        </div>
        <div class="terminal-input-line" id="term-active-input-row">
          <span class="terminal-input-prompt">${escapeHtml(promptText)}</span>
          <input type="text" class="terminal-inline-input" id="term-inline-input" autofocus autocomplete="off" spellcheck="false" placeholder="type value and press Enter..." />
        </div>
      `;

      const inputEl = document.getElementById('term-inline-input');
      if (inputEl) {
        // Immediate focus
        setTimeout(() => inputEl.focus(), 50);

        inputEl.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = inputEl.value;
            // Freeze input row as typed text
            const row = document.getElementById('term-active-input-row');
            if (row) {
              row.className = 'terminal-line';
              row.innerHTML = `<span class="terminal-input-prompt">${escapeHtml(promptText)}</span><span class="output-stdin-echo">${escapeHtml(val)}</span>`;
            }
            await executeAndRenderTerminal(code, language, val, cmd, promptText);
          }
        });
      }
    } else {
      // NON-INTERACTIVE MODE: Run immediately
      outputEl.innerHTML = `
        <div class="terminal-command-line">
          <span class="terminal-prompt">PS C:\\workspace&gt;</span> <span class="terminal-command-text">${escapeHtml(cmd)}</span>
        </div>
      `;
      await executeAndRenderTerminal(code, language, '', cmd, '');
    }
  }

  function checkStdinWarning() {
    // Smart inline terminal handles input prompts interactively
  }

  function initAuthControls() {
    const modal     = document.getElementById('login-modal');
    const openBtn   = document.getElementById('login-open-btn');
    const closeBtn  = document.getElementById('login-close-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userChip  = document.getElementById('user-chip');
    const userName  = document.getElementById('user-name');
    const userAvatar= document.getElementById('user-avatar');
    const authStatus= document.getElementById('auth-status');

    // Tabs
    const tabSignIn  = document.getElementById('tab-signin');
    const tabSignUp  = document.getElementById('tab-signup');
    const panelSignIn= document.getElementById('panel-signin');
    const panelSignUp= document.getElementById('panel-signup');

    // Sign-in form elements
    const siForm   = document.getElementById('signin-form');
    const siEmail  = document.getElementById('si-email');
    const siPwd    = document.getElementById('si-password');
    const siBtn    = document.getElementById('signin-btn');
    const siBtnTxt = document.getElementById('signin-btn-text');
    const siEmailErr = document.getElementById('si-email-err');
    const siPwdErr   = document.getElementById('si-password-err');
    const siError    = document.getElementById('signin-error');

    // Sign-up form elements
    const suForm    = document.getElementById('signup-form');
    const suEmail   = document.getElementById('su-email');
    const suPwd     = document.getElementById('su-password');
    const suConfirm = document.getElementById('su-confirm');
    const suBtn     = document.getElementById('signup-btn');
    const suBtnTxt  = document.getElementById('signup-btn-text');
    const suEmailErr  = document.getElementById('su-email-err');
    const suPwdErr    = document.getElementById('su-password-err');
    const suConfirmErr= document.getElementById('su-confirm-err');
    const suError     = document.getElementById('signup-error');
    const strengthBar = document.getElementById('pwd-strength-bar');

    // ── Helpers ─────────────────────────────────────────────────
    const EYE_OPEN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_SHUT  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    const EMAIL_RE  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

    function clearFieldErr(errEl) { if (errEl) errEl.textContent = ''; }
    function setFieldErr(errEl, msg) { if (errEl) errEl.textContent = msg; }

    function initials(name) {
      return String(name || 'CS').trim().slice(0, 2).toUpperCase() || 'CS';
    }

    // ── Tab switching ──────────────────────────────────────────
    function switchTab(toSignUp) {
      tabSignIn.classList.toggle('active', !toSignUp);
      tabSignUp.classList.toggle('active', toSignUp);
      tabSignIn.setAttribute('aria-selected', String(!toSignUp));
      tabSignUp.setAttribute('aria-selected', String(toSignUp));
      panelSignIn.hidden = toSignUp;
      panelSignUp.hidden = !toSignUp;
      setTimeout(() => (toSignUp ? suEmail : siEmail)?.focus(), 60);
    }

    tabSignIn?.addEventListener('click', () => switchTab(false));
    tabSignUp?.addEventListener('click', () => switchTab(true));
    document.getElementById('goto-signup')?.addEventListener('click', () => switchTab(true));
    document.getElementById('goto-signin')?.addEventListener('click', () => switchTab(false));

    // ── Password toggles (using data-target) ──────────────────
    document.querySelectorAll('.pwd-toggle[data-target]').forEach(btn => {
      btn.innerHTML = EYE_OPEN;
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        if (!inp) return;
        const isText = inp.type === 'text';
        inp.type = isText ? 'password' : 'text';
        btn.innerHTML = isText ? EYE_OPEN : EYE_SHUT;
      });
    });

    // ── Password strength bar ──────────────────────────────────
    suPwd?.addEventListener('input', () => {
      const v = suPwd.value;
      let score = 0;
      if (v.length >= 6) score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v) && /[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      if (strengthBar) {
        strengthBar.className = 'pwd-strength-bar' + (score ? ` s${score}` : '');
      }
      // live confirm check
      if (suConfirm?.value) {
        if (suConfirm.value !== v) setFieldErr(suConfirmErr, 'Passwords do not match.');
        else clearFieldErr(suConfirmErr);
      }
    });
    suConfirm?.addEventListener('input', () => {
      if (suConfirm.value && suPwd?.value !== suConfirm.value)
        setFieldErr(suConfirmErr, 'Passwords do not match.');
      else clearFieldErr(suConfirmErr);
    });

    // ── Modal open / close ─────────────────────────────────────
    function showModal(startTab = 'signin') {
      if (!modal) return;
      modal.hidden = false;
      switchTab(startTab === 'signup');
      if (siError) siError.textContent = '';
      if (suError) suError.textContent = '';
    }
    window._showLoginModal = () => showModal('signin');

    function hideModal() {
      if (modal) modal.hidden = true;
      siForm?.reset();
      suForm?.reset();
      if (strengthBar) strengthBar.className = 'pwd-strength-bar';
      [siEmailErr, siPwdErr, siError, suEmailErr, suPwdErr, suConfirmErr, suError]
        .forEach(el => { if (el) el.textContent = ''; });
    }

    openBtn?.addEventListener('click', () => showModal('signin'));
    closeBtn?.addEventListener('click', hideModal);
    modal?.addEventListener('click', e => { if (e.target === modal) hideModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (modal && !modal.hidden) hideModal();
        if (savePopover && !savePopover.hidden) closeSavePopover();
        if (profileDropdown && !profileDropdown.hidden) closeDropdown();
      }
    });

    // Active workspace file state
    let activeFileId = null;
    let activeFileName = '';

    const profileDropdown = document.getElementById('profile-dropdown');
    const savedFilesList   = document.getElementById('saved-files-list');

    const saveHeaderBtn = document.getElementById('save-header-btn');
    const savePopover = document.getElementById('save-popover');
    const saveFilenameInpPopover = document.getElementById('save-filename-input-popover');
    const saveDescriptionInpPopover = document.getElementById('save-description-input-popover');
    const saveCancelBtnPopover = document.getElementById('save-cancel-btn-popover');
    const saveConfirmBtnPopover = document.getElementById('save-confirm-btn-popover');

    const activeFileBadge = document.getElementById('active-file-badge');
    const activeFilenameDisplay = document.getElementById('active-filename-display');
    const activeFileSection = document.getElementById('active-file-section');
    const activeFileDivider = document.querySelector('.active-file-divider');
    const activeFileNameEl = document.getElementById('active-file-name');
    const activeFileLangEl = document.getElementById('active-file-lang');
    const activeFileTimeEl = document.getElementById('active-file-time');
    const saveAsBtn = document.getElementById('save-as-btn');
    const newFileBtn = document.getElementById('new-file-btn');

    let closeDropdownTimeout = null;
    let closePopoverTimeout = null;

    function updateProfileDropdown(user) {
      const dropdownUsername = document.getElementById('dropdown-username');
      const dropdownEmail = document.getElementById('dropdown-email');
      const dropdownAvatar = document.getElementById('dropdown-avatar');
      if (dropdownUsername) dropdownUsername.textContent = user.username || 'User';
      if (dropdownEmail) dropdownEmail.textContent = user.email || '';
      if (dropdownAvatar) dropdownAvatar.textContent = initials(user.username || user.email);
    }

    const dropdownBackdrop = document.getElementById('dropdown-backdrop');

    function isDropdownVisible() {
      if (!profileDropdown) return false;
      return !profileDropdown.hidden && profileDropdown.style.display !== 'none';
    }

    function openDropdown(triggerBtn) {
      if (!profileDropdown) return;
      if (closeDropdownTimeout) {
        clearTimeout(closeDropdownTimeout);
        closeDropdownTimeout = null;
      }
      profileDropdown.hidden = false;
      profileDropdown.style.display = 'flex';
      const btnRect = (triggerBtn || saveHeaderBtn)?.getBoundingClientRect();
      if (btnRect) {
        profileDropdown.style.top  = (btnRect.bottom + 8) + 'px';
        // Clamp left so dropdown never overflows right edge of viewport
        const dropW = profileDropdown.offsetWidth || 300;
        const maxLeft = window.innerWidth - dropW - 8;
        profileDropdown.style.left = Math.min(btnRect.left, maxLeft) + 'px';
      }
      profileDropdown.offsetHeight;
      profileDropdown.classList.add('open');
      if (dropdownBackdrop) {
        dropdownBackdrop.hidden = false;
        dropdownBackdrop.style.display = 'block';
      }
    }

    function closeDropdown() {
      if (!profileDropdown) return;
      profileDropdown.classList.remove('open');
      profileDropdown.hidden = true;
      profileDropdown.style.display = 'none';
      if (dropdownBackdrop) {
        dropdownBackdrop.hidden = true;
        dropdownBackdrop.style.display = 'none';
      }
      if (closeDropdownTimeout) clearTimeout(closeDropdownTimeout);
    }

    // Backdrop click → close dropdown
    document.getElementById('dropdown-backdrop')?.addEventListener('click', () => closeDropdown());
    // X button → close dropdown
    document.getElementById('dropdown-close-btn')?.addEventListener('click', () => closeDropdown());

    function openSavePopover() {
      if (!savePopover) return;
      if (closePopoverTimeout) {
        clearTimeout(closePopoverTimeout);
        closePopoverTimeout = null;
      }
      
      if (saveFilenameInpPopover) {
        const language = document.getElementById('language-select')?.value || 'other';
        const ext = getExtensionForLanguage(language);
        saveFilenameInpPopover.value = activeFileName || `main${ext}`;
      }
      if (saveDescriptionInpPopover) {
        const user = ApiClient.getUser();
        if (user && activeFileId) {
          const key = `codesense_saved_files_${user.email}`;
          try {
            const saved = JSON.parse(localStorage.getItem(key) || '[]');
            const file = saved.find(f => f.id === activeFileId);
            saveDescriptionInpPopover.value = file?.description || '';
          } catch(err) {
            saveDescriptionInpPopover.value = '';
          }
        } else {
          saveDescriptionInpPopover.value = '';
        }
      }
      
      savePopover.hidden = false;
      savePopover.offsetHeight; // force reflow
      savePopover.classList.add('open');
      setTimeout(() => saveFilenameInpPopover?.focus(), 60);
    }

    function closeSavePopover() {
      if (!savePopover) return;
      savePopover.classList.remove('open');
      if (closePopoverTimeout) clearTimeout(closePopoverTimeout);
      closePopoverTimeout = setTimeout(() => {
        if (!savePopover.classList.contains('open')) {
          savePopover.hidden = true;
        }
      }, 250);
    }

    function updateActiveFileUI(file) {
      if (file) {
        activeFileId = file.id;
        activeFileName = file.name;
        if (activeFileBadge) activeFileBadge.style.display = 'inline-flex';
        if (activeFilenameDisplay) activeFilenameDisplay.textContent = file.name;
        if (activeFileSection) activeFileSection.style.display = 'block';
        if (activeFileDivider) activeFileDivider.style.display = 'block';
        if (activeFileNameEl) activeFileNameEl.textContent = file.name;
        if (activeFileLangEl) activeFileLangEl.textContent = file.language.toUpperCase();
        if (activeFileTimeEl) activeFileTimeEl.textContent = file.timestamp;
      } else {
        activeFileId = null;
        activeFileName = '';
        if (activeFileBadge) activeFileBadge.style.display = 'none';
        if (activeFilenameDisplay) activeFilenameDisplay.textContent = '';
        if (activeFileSection) activeFileSection.style.display = 'none';
        if (activeFileDivider) activeFileDivider.style.display = 'none';
        if (activeFileNameEl) activeFileNameEl.textContent = '-';
        if (activeFileLangEl) activeFileLangEl.textContent = '-';
        if (activeFileTimeEl) activeFileTimeEl.textContent = '-';
      }
    }

    function getExtensionForLanguage(lang) {
      const extensions = {
        python: '.py',
        javascript: '.js',
        typescript: '.ts',
        java: '.java',
        cpp: '.cpp',
        csharp: '.cs',
        go: '.go',
        rust: '.rs',
        ruby: '.rb',
        php: '.php',
        sql: '.sql',
        html: '.html',
        css: '.css',
        bash: '.sh'
      };
      return extensions[lang.toLowerCase()] || '.txt';
    }

    function performPopoverSave() {
      const user = ApiClient.getUser();
      if (!user) return;
      
      const filenameEl = document.getElementById('save-filename-input-popover');
      const confirmBtn = document.getElementById('save-confirm-btn-popover');
      const filename = filenameEl?.value.trim();
      
      if (!filename) {
        alert('Please enter a filename.');
        return;
      }
      
      const code = typeof Editor !== 'undefined' ? Editor.getCode() : '';
      const language = document.getElementById('language-select')?.value || 'other';
      
      const originalText = confirmBtn?.textContent || 'Save';
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Saving...'; }
      
      setTimeout(() => {
        const key = `codesense_saved_files_${user.email}`;
        let saved = [];
        try {
          saved = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (err) {}
        
        let fileId = activeFileId;
        const existingIdx = fileId 
          ? saved.findIndex(f => f.id === fileId)
          : saved.findIndex(f => f.name.toLowerCase() === filename.toLowerCase());
          
        const fileObj = {
          id: existingIdx >= 0 ? saved[existingIdx].id : (fileId || Date.now().toString()),
          name: filename,
          description: '',
          code: code,
          language: language,
          timestamp: new Date().toLocaleString()
        };
        
        if (existingIdx >= 0) {
          saved[existingIdx] = fileObj;
        } else {
          saved.push(fileObj);
        }
        
        localStorage.setItem(key, JSON.stringify(saved));
        updateActiveFileUI(fileObj);
        
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = originalText; }
        
        setStatus(`Saved "${filename}" successfully`, 'ready');
        renderSavedCodes();  // refresh list
        closeDropdown();     // hide panel after save
        
        if (typeof Editor !== 'undefined' && typeof Editor.focus === 'function') {
          Editor.focus();
        }
      }, 400);
    }

    // User chip is now display-only — no click handler needed

    saveHeaderBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = ApiClient.getUser();
      if (!user) {
        if (typeof window._showLoginModal === 'function') {
          window._showLoginModal();
        }
        return;
      }

      if (isDropdownVisible()) {
        closeDropdown();
      } else {
        openDropdown(saveHeaderBtn);
        renderSavedCodes();
        if (typeof Chat !== 'undefined' && Chat.renderChatSessions) {
          Chat.renderChatSessions();
        }
        updateProfileDropdown(user);
      }
    });

    userChip?.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = ApiClient.getUser();
      if (!user) {
        if (typeof window._showLoginModal === 'function') {
          window._showLoginModal();
        }
        return;
      }
      if (isDropdownVisible()) {
        closeDropdown();
      } else {
        openDropdown(userChip);
        renderSavedCodes();
        if (typeof Chat !== 'undefined' && Chat.renderChatSessions) {
          Chat.renderChatSessions();
        }
        updateProfileDropdown(user);
      }
    });

    // Outside-click handled by backdrop — no document listener needed

    saveCancelBtnPopover?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSavePopover();
      if (typeof Editor !== 'undefined' && typeof Editor.focus === 'function') {
        Editor.focus();
      }
    });

    saveConfirmBtnPopover?.addEventListener('click', (e) => {
      e.stopPropagation();
      performPopoverSave();
    });

    saveFilenameInpPopover?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performPopoverSave();
      }
    });

    saveAsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = ApiClient.getUser();
      if (!user) return;
      
      const language = document.getElementById('language-select')?.value || 'other';
      const ext = getExtensionForLanguage(language);
      const defaultName = activeFileName ? `copy_of_${activeFileName}` : `main${ext}`;
      const newName = prompt("Save code under a new filename:", defaultName);
      if (newName === null) return;
      const trimmedName = newName.trim();
      if (!trimmedName) {
        alert("A valid filename is required.");
        return;
      }
      
      activeFileId = null;
      activeFileName = trimmedName;
      
      // Open Save Popover to allow review/confirm with description
      closeDropdown();
      openSavePopover();
    });

    newFileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm("Are you sure you want to start a fresh file? Unsaved changes in the editor will be lost.")) {
        if (typeof Editor !== 'undefined') {
          Editor.setCode('');
        }
        updateActiveFileUI(null);
        closeDropdown();
        setStatus("Created fresh file workspace", "ready");
      }
    });

    function renderSavedCodes() {
      if (!savedFilesList) return;
      const user = ApiClient.getUser();
      if (!user) {
        savedFilesList.innerHTML = '<div class="empty-list-msg">Please sign in.</div>';
        return;
      }
      const key = `codesense_saved_files_${user.email}`;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(key) || '[]');
      } catch (err) {}
      if (saved.length === 0) {
        savedFilesList.innerHTML = '<div class="empty-list-msg">No codes saved yet.</div>';
        return;
      }
      savedFilesList.innerHTML = saved.map(file => `
        <div class="workspace-item" data-id="${file.id}">
          <div class="workspace-item-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" style="color: var(--accent-cyan);"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="workspace-item-title" title="${file.name}">${file.name}</span>
            <span class="workspace-item-lang">${file.language}</span>
          </div>
          <button class="item-delete-btn" data-id="${file.id}" title="Delete file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      `).join('');
      savedFilesList.querySelectorAll('.workspace-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.closest('.item-delete-btn')) return;
          const fileId = item.dataset.id;
          const file = saved.find(f => f.id === fileId);
          if (file && typeof Editor !== 'undefined') {
            Editor.setCode(file.code);
            const langSelect = document.getElementById('language-select');
            if (langSelect) {
              langSelect.value = file.language;
              langSelect.dispatchEvent(new Event('change'));
            }
            updateActiveFileUI(file);
            closeDropdown();
            setStatus(`Loaded "${file.name}"`, 'ready');
          }
        });
      });
      savedFilesList.querySelectorAll('.item-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const fileId = btn.dataset.id;
          const filtered = saved.filter(f => f.id !== fileId);
          localStorage.setItem(key, JSON.stringify(filtered));
          if (activeFileId === fileId) {
            updateActiveFileUI(null);
          }
          renderSavedCodes();
          setStatus('File deleted from workspace', 'ready');
        });
      });
    }

    // ── Auth state ─────────────────────────────────────────────
    function renderAuthState() {
      const user = ApiClient.getUser();
      const signedIn = ApiClient.isAuthenticated() && user;
      if (openBtn) openBtn.hidden = Boolean(signedIn);
      if (userChip) userChip.hidden = !signedIn;
      if (userName && signedIn) userName.textContent = user.username || user.email || 'Signed in';
      if (userAvatar && signedIn) userAvatar.textContent = initials(user.username || user.email);
      if (authStatus) authStatus.textContent = signedIn
        ? `Signed in as ${user.email || user.username || 'user'}`
        : 'Guest workspace';
      if (signedIn && user) {
        updateProfileDropdown(user);
      }
      if (!signedIn) {
        updateActiveFileUI(null);
        closeDropdown();
        if (savePopover) {
          savePopover.classList.remove('open');
          savePopover.hidden = true;
        }
      }
    }

    const handleLogout = () => {
      ApiClient.logout();
      closeDropdown();
      if (typeof Chat !== 'undefined' && Chat.clearSession) {
        Chat.clearSession();
      }
      renderAuthState();
      setStatus('Signed out', 'ready');
    };

    logoutBtn?.addEventListener('click', handleLogout);
    document.getElementById('logout-btn-bottom')?.addEventListener('click', handleLogout);

    // ── Sign In submit ─────────────────────────────────────────
    siForm?.addEventListener('submit', async e => {
      e.preventDefault();
      clearFieldErr(siEmailErr); clearFieldErr(siPwdErr); if (siError) siError.textContent = '';

      const email = siEmail?.value.trim() || '';
      const pwd   = siPwd?.value || '';

      let valid = true;
      if (!email || !EMAIL_RE.test(email)) { setFieldErr(siEmailErr, 'Enter a valid email address.'); valid = false; }
      if (!pwd) { setFieldErr(siPwdErr, 'Password is required.'); valid = false; }
      if (!valid) return;

      if (siBtn) { siBtn.disabled = true; siBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span><span>Signing in…</span>'; }

      try {
        const res = await ApiClient.login(email, pwd);
        if (res.success) { hideModal(); renderAuthState(); setStatus('Welcome back! 👋', 'ready'); }
      } catch (err) {
        const msg = err.message || 'Sign in failed.';
        // Point error to correct field
        if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('account'))
          setFieldErr(siEmailErr, msg);
        else if (msg.toLowerCase().includes('password'))
          setFieldErr(siPwdErr, msg);
        else if (siError) siError.textContent = msg;
        setStatus('Sign in failed', 'error');
      } finally {
        if (siBtn) {
          siBtn.disabled = false;
          siBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg><span>Sign In</span>';
        }
      }
    });

    // ── Sign Up submit ─────────────────────────────────────────
    suForm?.addEventListener('submit', async e => {
      e.preventDefault();
      clearFieldErr(suEmailErr); clearFieldErr(suPwdErr); clearFieldErr(suConfirmErr); if (suError) suError.textContent = '';

      const email   = suEmail?.value.trim() || '';
      const pwd     = suPwd?.value || '';
      const confirm = suConfirm?.value || '';

      let valid = true;
      if (!email || !EMAIL_RE.test(email)) { setFieldErr(suEmailErr, 'Enter a valid Gmail address.'); valid = false; }
      if (pwd.length < 6)                  { setFieldErr(suPwdErr, 'Password must be at least 6 characters.'); valid = false; }
      if (pwd !== confirm)                  { setFieldErr(suConfirmErr, 'Passwords do not match.'); valid = false; }
      if (!valid) return;

      if (suBtn) { suBtn.disabled = true; suBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span><span>Creating account…</span>'; }

      try {
        const res = await ApiClient.register(email, pwd, confirm);
        if (res.success) { hideModal(); renderAuthState(); setStatus('🎉 Account created! Welcome to CodeSense AI', 'ready'); }
      } catch (err) {
        const msg = err.message || 'Registration failed.';
        if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('exists'))
          setFieldErr(suEmailErr, msg);
        else if (msg.toLowerCase().includes('password'))
          setFieldErr(suPwdErr, msg);
        else if (suError) suError.textContent = msg;
        setStatus('Registration failed', 'error');
      } finally {
        if (suBtn) {
          suBtn.disabled = false;
          suBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg><span>Create Account</span>';
        }
      }
    });

    renderAuthState();
  }

  function initSplashTransition() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    // 3 seconds splash then fade out and show login if not signed in
    window.setTimeout(() => {
      document.body.classList.add('splash-complete');
      document.body.classList.remove('is-splashing');
      window.setTimeout(() => {
        splash.setAttribute('hidden', '');
        // Auto-show login modal if user is not authenticated
        if (!ApiClient.isAuthenticated()) {
          if (typeof window._showLoginModal === 'function') {
            window._showLoginModal();
          }
        }
      }, 560);
    }, 3000);
  }

  function initResizers() {
    const mainResizer = document.getElementById('main-pane-resizer');
    const rightPanel = document.getElementById('right-panel');
    let isMainDragging = false;
    let startX = 0;
    let startWidth = 0;

    if (mainResizer && rightPanel) {
      mainResizer.addEventListener('mousedown', (event) => {
        isMainDragging = true;
        startX = event.clientX;
        startWidth = rightPanel.getBoundingClientRect().width;
        document.querySelector('.main-content')?.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        event.preventDefault();
      });

      document.addEventListener('mousemove', (event) => {
        if (!isMainDragging) return;
        const delta = event.clientX - startX;
        const newWidth = Math.max(300, Math.min(window.innerWidth * 0.7, startWidth + delta));
        rightPanel.style.width = `${newWidth}px`;
        if (window.Editor && typeof window.Editor.layout === 'function') window.Editor.layout();
        else window.dispatchEvent(new Event('resize'));
      });

      document.addEventListener('mouseup', () => {
        if (!isMainDragging) return;
        isMainDragging = false;
        document.querySelector('.main-content')?.classList.remove('resizing');
        document.body.style.cursor = '';
      });
    }



    const outputResizer = document.getElementById('output-resizer');
    const outputPanel = document.getElementById('output-panel');
    let isOutputDragging = false;
    let outputStartY = 0;
    let outputStartHeight = 0;

    if (outputResizer && outputPanel) {
      outputResizer.addEventListener('mousedown', (event) => {
        if (outputPanel.classList.contains('collapsed')) return;
        isOutputDragging = true;
        outputStartY = event.clientY;
        outputStartHeight = outputPanel.getBoundingClientRect().height;
        outputPanel.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        event.preventDefault();
      });

      document.addEventListener('mousemove', (event) => {
        if (!isOutputDragging) return;
        const delta = outputStartY - event.clientY;
        const newHeight = Math.max(60, Math.min(800, outputStartHeight + delta));
        outputPanel.style.height = `${newHeight}px`;
        if (window.Editor && typeof window.Editor.layout === 'function') window.Editor.layout();
        else window.dispatchEvent(new Event('resize'));
      });

      document.addEventListener('mouseup', () => {
        if (!isOutputDragging) return;
        isOutputDragging = false;
        outputPanel.classList.remove('resizing');
        document.body.style.cursor = '';
      });
    }
  }

  function init() {
    initSplashTransition();
    ThemeManager.init();
    Editor.init();
    Chat.init();
    initAuthControls();

    document.getElementById('review-btn')?.addEventListener('click', handleReview);
    document.getElementById('run-btn')?.addEventListener('click', handleRunCode);

    document.getElementById('clear-output-btn')?.addEventListener('click', (event) => {
      event.stopPropagation();
      const outputEl = document.getElementById('output-content');
      if (outputEl) outputEl.innerHTML = '<span class="terminal-prompt">PS C:\\workspace&gt;</span> <span class="terminal-cursor">█</span>';
      const statusEl = document.getElementById('output-status');
      if (statusEl) statusEl.textContent = '';
    });

    // Clicking anywhere in the terminal focuses the active inline input
    document.getElementById('output-content')?.addEventListener('click', () => {
      document.getElementById('term-inline-input')?.focus();
    });

    function toggleOutput(event) {
      if (event) event.stopPropagation();
      document.getElementById('output-panel')?.classList.toggle('collapsed');
    }


    document.getElementById('toggle-output-btn')?.addEventListener('click', toggleOutput);
    document.querySelector('.output-header')?.addEventListener('click', toggleOutput);

    initResizers();

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleReview();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        handleRunCode();
      }
      if (event.key === 'F5') {
        event.preventDefault();
        handleRunCode();
      }
    });

    // Stdin warning: only check when Run is clicked or stdin changes (NOT on load)
    const stdinEl = document.getElementById('stdin-content');
    if (stdinEl) {
      stdinEl.addEventListener('input', checkStdinWarning);
    }
    // Re-check on Run click (before execution starts)
    document.getElementById('run-btn')?.addEventListener('click', checkStdinWarning, { capture: true });
    // Do NOT auto-check on load — output panel must be clean until user runs code


    setStatus('Ready', 'ready');
    console.log('CodeSense AI initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { getLastReviewContext, handleReview, handleRunCode };
})();
