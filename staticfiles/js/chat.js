/**
 * Chat module for CodeSense AI.
 * Manages the AI chat interface for follow-up questions.
 */
const Chat = (() => {
  let messagesEl, inputEl, sendBtn, emptyEl, typingEl, suggestionsEl;
  let isLoading = false;
  let currentSessionId = null;
  let chatSessionsList = null;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^### (.+)$/gm, '<strong style="font-size:14px">$1</strong>');
    html = html.replace(/^## (.+)$/gm, '<strong style="font-size:15px">$1</strong>');
    html = html.replace(/^[-*] (.+)$/gm, '• $1');
    
    // Convert markdown links: [Text](URL)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');
    
    // Convert YouTube search tag: [YOUTUBE_SEARCH: topic]
    html = html.replace(/\[YOUTUBE_SEARCH:\s*([^\]]+)\]/gi, (match, query) => {
      const decodedQuery = query.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      return `<div class="youtube-results-container" data-query="${escapeHtml(decodedQuery)}">
        <div class="youtube-loading">
          <div class="spinner"></div>
          <span>Searching YouTube for "${escapeHtml(decodedQuery)}"...</span>
        </div>
      </div>`;
    });

    // Convert raw URLs: https://... (prevent matching URLs already inside href="..." or tags)
    html = html.replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');
    
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  async function loadYoutubeResults() {
    const containers = document.querySelectorAll('.youtube-results-container:not(.loaded)');
    for (const container of containers) {
      container.classList.add('loaded');
      const query = container.getAttribute('data-query');
      try {
        const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.success && data.videos && data.videos.length > 0) {
          container.innerHTML = `
            <div class="youtube-list-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color:#ff0000;vertical-align:middle;margin-right:4px"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              Recommended YouTube Lectures:
            </div>
            <div class="youtube-videos-grid">
              ${data.videos.map(video => `
                <a href="${video.link}" target="_blank" rel="noopener noreferrer" class="youtube-video-card">
                  <div class="youtube-thumbnail-wrapper">
                    <img src="${video.thumbnail}" alt="${video.title}" class="youtube-thumbnail" loading="lazy">
                    ${video.duration ? `<span class="youtube-duration">${video.duration}</span>` : ''}
                  </div>
                  <div class="youtube-video-info">
                    <div class="youtube-video-title" title="${video.title}">${video.title}</div>
                    <div class="youtube-channel-name">${video.channel}</div>
                    <div class="youtube-meta-text">
                      ${video.views ? `<span>${video.views}</span>` : ''}
                      ${video.published ? `<span>• ${video.published}</span>` : ''}
                    </div>
                  </div>
                </a>
              `).join('')}
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="youtube-no-results">
              No direct video lectures found. <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="chat-link">Search YouTube manually for "${escapeHtml(query)}"</a>
            </div>
          `;
        }
      } catch (err) {
        console.error('Error loading YouTube videos:', err);
        container.innerHTML = `
          <div class="youtube-error">
            Failed to load videos. <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="chat-link">Try searching on YouTube</a>
          </div>
        `;
      }
    }
  }

  function getStorageKey() {
    const user = ApiClient.getUser();
    return user ? `codesense_chat_sessions_${user.email}` : 'codesense_chat_sessions_guest';
  }

  function getSessions() {
    const key = getStorageKey();
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (err) {
      return [];
    }
  }

  function setSessions(sessions) {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(sessions));
  }

  function saveCurrentChatSession(userMessage, assistantMessage = '') {
    let sessions = getSessions();
    if (!currentSessionId) {
      currentSessionId = Date.now().toString();
    }
    let session = sessions.find(s => s.id === currentSessionId);
    if (!session) {
      const titleText = userMessage || 'New Chat';
      session = {
        id: currentSessionId,
        title: titleText.substring(0, 34) + (titleText.length > 34 ? '...' : ''),
        messages: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
      };
      sessions.unshift(session);
    }
    if (userMessage) {
      session.messages.push({ role: 'user', content: userMessage });
    }
    if (assistantMessage) {
      const lastMsg = session.messages[session.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = assistantMessage;
      } else {
        session.messages.push({ role: 'assistant', content: assistantMessage });
      }
    }
    if (sessions.length > 25) {
      sessions = sessions.slice(0, 25);
    }
    setSessions(sessions);
    renderChatSessions();
  }

  function renderChatSessions() {
    const sessions = getSessions();

    // 1. Update Badge on "Old Chats" pill button
    const badge = document.getElementById('chat-history-badge');
    if (badge) {
      badge.textContent = sessions.length;
      badge.style.display = sessions.length > 0 ? 'inline-block' : 'none';
    }

    // 2. Render Panel History Overlay List
    const panelList = document.getElementById('panel-chat-sessions-list');
    if (panelList) {
      if (sessions.length === 0) {
        panelList.innerHTML = `
          <div class="empty-list-msg" style="padding: 30px 14px; text-align: center; color: var(--on-surface-variant); font-size: 11.5px; line-height: 1.6;">
            No old chats yet.<br><span style="opacity: 0.6; font-size: 10.5px;">Ask a question to save your first conversation!</span>
          </div>`;
      } else {
        panelList.innerHTML = sessions.map(session => `
          <div class="history-chat-item ${session.id === currentSessionId ? 'active' : ''}" data-id="${session.id}">
            <div class="history-chat-content">
              <div class="history-chat-title" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</div>
              <div class="history-chat-meta">
                <span>${session.timestamp || 'Recent'}</span>
                <span>• ${session.messages ? session.messages.length : 0} msgs</span>
              </div>
            </div>
            <button type="button" class="history-delete-btn" data-id="${session.id}" title="Delete chat" aria-label="Delete chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        `).join('');

        panelList.querySelectorAll('.history-chat-item').forEach(item => {
          item.addEventListener('click', (e) => {
            if (e.target.closest('.history-delete-btn')) return;
            const sessionId = item.dataset.id;
            loadChatSession(sessionId);
            closeHistory();
          });
        });

        panelList.querySelectorAll('.history-delete-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sessionId = btn.dataset.id;
            deleteChatSession(sessionId);
          });
        });
      }
    }

    // 3. Render in Save Dropdown (syncs with workspace dropdown)
    chatSessionsList = document.getElementById('chat-sessions-list');
    if (chatSessionsList) {
      if (sessions.length === 0) {
        chatSessionsList.innerHTML = '<div class="empty-list-msg">No recent chats.</div>';
      } else {
        chatSessionsList.innerHTML = sessions.map(session => `
          <div class="chat-history-item" data-id="${session.id}">
            <div class="chat-history-item-content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" style="color: var(--accent-purple);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="chat-history-item-title" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</span>
            </div>
            <button class="item-delete-btn" data-id="${session.id}" title="Delete chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        `).join('');

        chatSessionsList.querySelectorAll('.chat-history-item').forEach(item => {
          item.addEventListener('click', (e) => {
            if (e.target.closest('.item-delete-btn')) return;
            const sessionId = item.dataset.id;
            loadChatSession(sessionId);
          });
        });

        chatSessionsList.querySelectorAll('.item-delete-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sessionId = btn.dataset.id;
            deleteChatSession(sessionId);
          });
        });
      }
    }
  }

  function deleteChatSession(sessionId) {
    let sessions = getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    setSessions(sessions);
    if (currentSessionId === sessionId) {
      startNewChat();
    } else {
      renderChatSessions();
    }
    if (typeof App !== 'undefined' && App.setStatus) {
      App.setStatus('Chat deleted', 'ready');
    }
  }

  function startNewChat() {
    currentSessionId = null;
    if (messagesEl) {
      messagesEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      if (suggestionsEl) suggestionsEl.style.display = 'flex';
    }
    closeHistory();
    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    if (typeof App !== 'undefined' && App.setStatus) {
      App.setStatus('New chat started ✨', 'ready');
    }
  }

  function openHistory() {
    const overlay = document.getElementById('chat-history-overlay');
    if (!overlay) return;
    renderChatSessions();
    overlay.hidden = false;
    overlay.style.display = 'flex';
  }

  function closeHistory() {
    const overlay = document.getElementById('chat-history-overlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.style.display = 'none';
  }

  function toggleHistory() {
    const overlay = document.getElementById('chat-history-overlay');
    if (!overlay) return;
    if (!overlay.hidden && overlay.style.display !== 'none') {
      closeHistory();
    } else {
      openHistory();
    }
  }

  function loadChatSession(sessionId) {
    const sessions = getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    currentSessionId = sessionId;
    if (messagesEl) {
      messagesEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'none';
      if (suggestionsEl) suggestionsEl.style.display = 'none';
      session.messages.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `chat-message ${msg.role}`;
        msgEl.innerHTML = msg.role === 'assistant' ? formatMarkdown(msg.content) : escapeHtml(msg.content);
        messagesEl.appendChild(msgEl);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
      loadYoutubeResults();
    }
    closeHistory();
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
      profileDropdown.hidden = true;
      profileDropdown.style.display = 'none';
      profileDropdown.classList.remove('open');
    }
    const dropdownBackdrop = document.getElementById('dropdown-backdrop');
    if (dropdownBackdrop) {
      dropdownBackdrop.hidden = true;
      dropdownBackdrop.style.display = 'none';
    }
  }

  function clearSession() {
    startNewChat();
  }

  function addMessage(role, content) {
    if (emptyEl) emptyEl.style.display = 'none';
    if (suggestionsEl) suggestionsEl.style.display = 'none';

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${role}`;
    msgEl.innerHTML = role === 'assistant' ? formatMarkdown(content) : escapeHtml(content);
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (role === 'assistant') {
      loadYoutubeResults();
    }
  }

  function showTyping() {
    if (typingEl) typingEl.removeAttribute('hidden');
    const avatar = document.querySelector('.robot-avatar-container');
    if (avatar) avatar.classList.add('waiting');
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    if (typingEl) typingEl.setAttribute('hidden', '');
    const avatar = document.querySelector('.robot-avatar-container');
    if (avatar) avatar.classList.remove('waiting');
  }

  function showTypingIndicator() { showTyping(); }
  function removeTypingIndicator() { hideTyping(); }

  let rateLimitCooldownTimer = null;

  function handleRateLimitCooldown(waitSeconds) {
    if (rateLimitCooldownTimer) {
      clearInterval(rateLimitCooldownTimer);
      rateLimitCooldownTimer = null;
    }
    let remaining = waitSeconds || 30;
    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;

    function updateBtn() {
      if (sendBtn) {
        sendBtn.innerHTML = `<span style="font-size:10px;font-weight:700;white-space:nowrap;padding:0 2px;">${remaining}s</span>`;
      }
    }

    updateBtn();
    rateLimitCooldownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(rateLimitCooldownTimer);
        rateLimitCooldownTimer = null;
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        }
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.focus();
        }
        if (typeof App !== 'undefined' && App.setStatus) {
          App.setStatus('Ready to chat ✨', 'ready');
        }
      } else {
        updateBtn();
      }
    }, 1000);
  }

  async function sendMessage(message) {
    if (isLoading || !inputEl) return;

    const text = message || inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    addMessage('user', text);
    saveCurrentChatSession(text);

    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    let assistantMsgEl = null;
    let assistantText = '';

    function onChunk(token) {
      hideTyping();

      if (emptyEl) emptyEl.style.display = 'none';
      if (suggestionsEl) suggestionsEl.style.display = 'none';

      if (!assistantMsgEl) {
        assistantMsgEl = document.createElement('div');
        assistantMsgEl.className = 'chat-message assistant';
        messagesEl.appendChild(assistantMsgEl);
      }

      assistantText += token;
      assistantMsgEl.innerHTML = formatMarkdown(assistantText);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      
      saveCurrentChatSession(null, assistantText);
    }

    try {
      const code = typeof Editor !== 'undefined' ? Editor.getCode() : '';
      const reviewContext = typeof App !== 'undefined' ? App.getLastReviewContext() : '';
      const language = document.getElementById('language-select')?.value || '';

      await ApiClient.chatStream(
        text,
        code,
        reviewContext,
        language,
        onChunk,
        () => {
          hideTyping();
          isLoading = false;
          if (sendBtn) sendBtn.disabled = false;
          if (inputEl) inputEl.focus();
          loadYoutubeResults();
          saveCurrentChatSession(null, assistantText);
        },
        (error) => {
          hideTyping();
          const isRateLimit = error.status === 429 || (error.message && error.message.includes('Rate limit'));
          let waitSeconds = error.wait_seconds;
          if (!waitSeconds && error.message) {
            const match = error.message.match(/(\d+)\s*s/);
            if (match) waitSeconds = parseInt(match[1], 10);
          }
          if (isRateLimit) {
            waitSeconds = waitSeconds || 30;
            addMessage('assistant', `⏳ **Rate Limit Reached (Max 7 msgs / min)**<br>${escapeHtml(error.message)}`);
            handleRateLimitCooldown(waitSeconds);
          } else {
            if (!assistantMsgEl) {
              addMessage('assistant', `⚠️ Error: ${error.message}`);
            } else {
              assistantMsgEl.innerHTML += `<br><br>⚠️ <em>Error: ${escapeHtml(error.message)}</em>`;
            }
            if (sendBtn) sendBtn.disabled = false;
            if (inputEl) inputEl.focus();
          }
          isLoading = false;
          loadYoutubeResults();
          saveCurrentChatSession(null, assistantText);
        }
      );
    } catch (error) {
      hideTyping();
      const isRateLimit = error.status === 429 || (error.message && error.message.includes('Rate limit'));
      let waitSeconds = error.wait_seconds;
      if (!waitSeconds && error.message) {
        const match = error.message.match(/(\d+)\s*s/);
        if (match) waitSeconds = parseInt(match[1], 10);
      }
      if (isRateLimit) {
        waitSeconds = waitSeconds || 30;
        addMessage('assistant', `⏳ **Rate Limit Reached (Max 7 msgs / min)**<br>${escapeHtml(error.message)}`);
        handleRateLimitCooldown(waitSeconds);
      } else {
        addMessage('assistant', `❌ Error: ${error.message}`);
        if (sendBtn) sendBtn.disabled = false;
        if (inputEl) inputEl.focus();
      }
      isLoading = false;
      loadYoutubeResults();
      saveCurrentChatSession(null, assistantText);
    }
  }

  function init() {
    messagesEl  = document.getElementById('chat-messages');
    inputEl     = document.getElementById('chat-input');
    sendBtn     = document.getElementById('chat-send-btn');
    emptyEl     = document.getElementById('chat-empty');
    typingEl    = document.getElementById('chat-typing');
    suggestionsEl = document.getElementById('chat-suggestions');

    if (sendBtn) sendBtn.addEventListener('click', () => sendMessage());
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
    }

    // Wire suggestion chips
    if (suggestionsEl) {
      suggestionsEl.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const msg = chip.getAttribute('data-msg');
          if (msg) sendMessage(msg);
        });
      });
    }

    // Wire AI Logo and New Chat buttons
    document.getElementById('new-chat-logo-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      startNewChat();
    });
    document.getElementById('header-new-chat-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      startNewChat();
    });
    document.getElementById('history-new-chat-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      startNewChat();
    });

    // Wire Old Chats / History buttons
    document.getElementById('toggle-chat-history-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHistory();
    });
    document.getElementById('header-history-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHistory();
    });
    document.getElementById('history-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeHistory();
    });

    // Initial render of chat sessions and badge
    renderChatSessions();
  }

  return { init, addMessage, renderChatSessions, clearSession, startNewChat, toggleHistory, openHistory, closeHistory };
})();
