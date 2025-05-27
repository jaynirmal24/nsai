const API_KEY = "AIzaSyCnAbfBN2fjhmRyYpR_3KfvjWEWARUoORw";
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const chatForm = document.getElementById('chatForm');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
const sidebarExpandBtn = document.getElementById('sidebarExpandBtn');
const sidebarExpandBtnMobile = document.getElementById('sidebarExpandBtnMobile');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const newChatBtn = document.getElementById('newChatBtn');
const recentChatsPopup = document.getElementById('recentChatsPopup');
const recentChatsList = document.getElementById('recentChatsList');
const newChatPopupBtn = document.getElementById('newChatPopupBtn');

let chatHistory = [];
let allChats = loadAllChats();
let currentChatId = null;

// --- Sidebar open/close logic ---
function openSidebar() {
  sidebar.classList.remove('closed');
}

function closeSidebar() {
  sidebar.classList.add('closed');
}

// Update sidebar toggle logic
sidebarToggle.addEventListener('click', () => {
  if (sidebar.classList.contains('closed')) {
    openSidebar();
  } else {
    closeSidebar();
  }
});

sidebarExpandBtn.addEventListener('click', openSidebar);
sidebarExpandBtnMobile && sidebarExpandBtnMobile.addEventListener('click', openSidebar);

// Adjust sidebar toggle logic for mobile
sidebarToggleMobile && sidebarToggleMobile.addEventListener('click', () => {
  if (sidebar.classList.contains('closed')) {
    openSidebar();
  } else {
    closeSidebar();
  }
});

// Close sidebar on click outside on mobile
document.addEventListener('click', (e) => {
  if (
    window.innerWidth <= 800 &&
    !sidebar.classList.contains('closed') &&
    !sidebar.contains(e.target) &&
    !sidebarToggleMobile.contains(e.target)
  ) {
    closeSidebar();
  }
});

// Show popup with recent chats
function showRecentChatsPopup() {
  const sorted = Object.entries(allChats)
    .sort((a, b) => b[1].updated - a[1].updated)
    .slice(0, 3);

  // Only show popup if there is at least 1 chat
  if (sorted.length === 0) {
    recentChatsPopup.classList.remove('active');
    return;
  }

  recentChatsList.innerHTML = '';
  sorted.forEach(([id, chat]) => {
    // Use the same logic for title as in renderHistoryList
    let title = chat.title;
    if (!title) {
      const firstUserMsg = chat.history.find(m => m.role === 'user');
      title = firstUserMsg ? firstUserMsg.parts[0].text.slice(0, 30) + (firstUserMsg.parts[0].text.length > 30 ? "..." : "") : "New Chat";
    }
    const li = document.createElement('li');
    li.textContent = title;
    li.onclick = () => {
      currentChatId = id;
      chatHistory = JSON.parse(JSON.stringify(chat.history));
      renderChat();
      renderHistoryList();
      recentChatsPopup.classList.remove('active');
    };
    recentChatsList.appendChild(li);
  });

  recentChatsPopup.classList.add('active');
}

newChatPopupBtn && newChatPopupBtn.addEventListener('click', () => {
  recentChatsPopup.classList.remove('active');
  startNewChat();
});

// Initialize sidebar state
(function init() {
  renderHistoryList();
  // Load last chat if exists
  const lastId = Object.keys(allChats)[0];
  if (lastId) {
    currentChatId = lastId;
    chatHistory = JSON.parse(JSON.stringify(allChats[lastId].history));
    renderChat();
    renderHistoryList();
  }
  // Responsive: close sidebar by default on mobile
  if (window.innerWidth <= 800) {
    closeSidebar(); // Always close on mobile initially
  } else {
    openSidebar(); // Keep open on desktop initially
  }
  // Show recent chats popup on every launch only if there is at least 1 chat
  if (Object.keys(allChats).length > 0) {
    showRecentChatsPopup();
  }
})();

// --- Chat history logic ---
function saveCurrentChatToStorage() {
  if (!currentChatId) {
    currentChatId = "chat-" + Date.now();
  }
  if (!allChats[currentChatId]?.created) {
    if (!allChats[currentChatId]) allChats[currentChatId] = {};
    allChats[currentChatId].created = Date.now();
    allChats[currentChatId].edits = [];
  }
  // If 5 or more messages and no title, try to generate one
  if (
    chatHistory.length >= 5 &&
    (!allChats[currentChatId] || !allChats[currentChatId].title)
  ) {
    generateChatTitle(chatHistory.slice(0, 10)).then(title => {
      if (title) {
        allChats[currentChatId] = {
          ...allChats[currentChatId],
          title,
          history: chatHistory,
          updated: Date.now()
        };
        localStorage.setItem('gemini_chats', JSON.stringify(allChats));
        renderHistoryList();
      }
    });
  }
  allChats[currentChatId] = {
    ...allChats[currentChatId],
    history: chatHistory,
    updated: Date.now()
  };
  localStorage.setItem('gemini_chats', JSON.stringify(allChats));
  renderHistoryList();
}

// Generate a chat title using the AI model
async function generateChatTitle(history) {
  try {
    const prompt = "Based on the following conversation, suggest a short, relevant chat title (max 5 words, no punctuation):\n\n" +
      history.map(m => (m.role === 'user' ? "User: " : "AI: ") + m.parts[0].text).join('\n');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: prompt }] }
          ],
          generationConfig: {
            temperature: 0.5,
            topK: 20,
            topP: 0.9,
            maxOutputTokens: 12
          }
        })
      }
    );
    const data = await response.json();
    let title = "";
    if (data && data.candidates && data.candidates.length > 0) {
      const parts = data.candidates[0].content?.parts;
      if (parts && parts.length > 0 && parts[0].text) {
        title = parts[0].text.trim();
      }
    }
    // Fallback if title is empty
    if (!title) title = "Chat";
    // Remove punctuation and trim to 5 words
    title = title.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 5).join(' ');
    return title || "Chat";
  } catch {
    return "Chat";
  }
}

function loadAllChats() {
  try {
    return JSON.parse(localStorage.getItem('gemini_chats')) || {};
  } catch {
    return {};
  }
}

// Add this global popup container if not present
let globalMenuPopup = document.getElementById('historyMenuPopup');
if (!globalMenuPopup) {
  globalMenuPopup = document.createElement('div');
  globalMenuPopup.id = 'historyMenuPopup';
  globalMenuPopup.className = 'history-menu-popup';
  globalMenuPopup.innerHTML = `
    <div class="history-menu-popup-content"></div>
  `;
  document.body.appendChild(globalMenuPopup);
}

// Update renderHistoryList to only add the 3-dot button, not the menu
function renderHistoryList() {
  historyList.innerHTML = '';
  const sorted = Object.entries(allChats)
    .sort((a, b) => {
      if (b[1].pinned === a[1].pinned) return b[1].updated - a[1].updated;
      return (b[1].pinned ? 1 : 0) - (a[1].pinned ? 1 : 0);
    });
  for (const [id, chat] of sorted) {
    let title = chat.title || "New Chat";
    const li = document.createElement('li');
    // Create a span with a pin icon if pinned
    const titleSpan = document.createElement('span');
    titleSpan.textContent = (chat.pinned ? "📌 " : "") + title;
    li.appendChild(titleSpan);
    li.setAttribute('data-id', id);
    li.setAttribute('data-fullname', title);
    if (title.length > 28) li.classList.add('long-name');
    if (id === currentChatId) li.classList.add('active');

    // Add 3-dots menu button
    const menuButton = document.createElement('button');
    menuButton.classList.add('menu-btn');
    menuButton.type = 'button';
    menuButton.textContent = '⋮';
    menuButton.onclick = (e) => {
      e.stopPropagation();
      showHistoryMenuPopup(id, chat);
    };
    li.appendChild(menuButton);

    li.onclick = () => {
      if (id !== currentChatId) {
        currentChatId = id;
        chatHistory = JSON.parse(JSON.stringify(allChats[id].history));
        renderChat();
        renderHistoryList();
      }
    };
    historyList.appendChild(li);
  }
}

// Show modal popup for menu
function showHistoryMenuPopup(id, chat) {
  // Remove any previous content
  const popup = document.getElementById('historyMenuPopup');
  const content = popup.querySelector('.history-menu-popup-content');
  content.innerHTML = '';

  // 1. Pin
  const pinOption = document.createElement('button');
  pinOption.textContent = chat.pinned ? 'Unpin' : 'Pin';
  pinOption.onclick = (e) => {
    e.stopPropagation();
    allChats[id].pinned = !allChats[id].pinned;
    saveCurrentChatToStorage();
    renderHistoryList();
    closeHistoryMenuPopup();
  };
  content.appendChild(pinOption);

  // 2. Info
  const infoOption = document.createElement('button');
  infoOption.textContent = 'Info';
  infoOption.onclick = (e) => {
    e.stopPropagation();
    const created = chat.created ? new Date(chat.created).toLocaleString() : 'Unknown';
    // Removed "Last Edited" info from alert message
    alert(
      `Title: ${chat.title || "New Chat"}\nCreated: ${created}`
    );
    closeHistoryMenuPopup();
  };
  content.appendChild(infoOption);

  // 3. Share
  const shareOption = document.createElement('button');
  shareOption.textContent = 'Share';
  shareOption.onclick = (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/share?chatId=${id}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Shareable URL copied to clipboard:\n${shareUrl}`);
    closeHistoryMenuPopup();
  };
  content.appendChild(shareOption);

  // 4. Rename
  const renameOption = document.createElement('button');
  renameOption.textContent = 'Rename';
  renameOption.onclick = (e) => {
    e.stopPropagation();
    const newName = prompt("Enter a new name for this chat:", chat.title || "New Chat");
    if (newName) {
      allChats[id].title = newName;
      if (!allChats[id].edits) allChats[id].edits = [];
      allChats[id].edits.push(Date.now());
      saveCurrentChatToStorage();
      renderHistoryList();
    }
    closeHistoryMenuPopup();
  };
  content.appendChild(renameOption);

  // 5. Delete
  const deleteOption = document.createElement('button');
  deleteOption.textContent = 'Delete';
  deleteOption.onclick = (e) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat?")) {
      delete allChats[id];
      saveCurrentChatToStorage();
      renderHistoryList();
    }
    closeHistoryMenuPopup();
  };
  content.appendChild(deleteOption);

  // Add Close button at the end of the menu
  const closeOption = document.createElement('button');
  closeOption.textContent = 'Close';
  closeOption.onclick = (e) => {
    e.stopPropagation();
    closeHistoryMenuPopup();
  };
  content.appendChild(closeOption);

  // Show popup
  popup.classList.add('active');

  // Close on outside click or Escape
  setTimeout(() => {
    function closeOnOutside(e) {
      if (!popup.contains(e.target)) {
        closeHistoryMenuPopup();
        document.removeEventListener('mousedown', closeOnOutside);
        document.removeEventListener('keydown', closeOnEsc);
      }
    }
    function closeOnEsc(e) {
      if (e.key === 'Escape') {
        closeHistoryMenuPopup();
        document.removeEventListener('mousedown', closeOnOutside);
        document.removeEventListener('keydown', closeOnEsc);
      }
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEsc);
  }, 0);
}

function closeHistoryMenuPopup() {
  const popup = document.getElementById('historyMenuPopup');
  if (popup) popup.classList.remove('active');
}

function renderHistoryList() {
  historyList.innerHTML = '';
  const sorted = Object.entries(allChats)
    .sort((a, b) => {
      if (b[1].pinned === a[1].pinned) return b[1].updated - a[1].updated;
      return (b[1].pinned ? 1 : 0) - (a[1].pinned ? 1 : 0);
    });
  for (const [id, chat] of sorted) {
    let title = chat.title || "New Chat";
    const li = document.createElement('li');
    // Create a span with a pin icon if pinned
    const titleSpan = document.createElement('span');
    titleSpan.textContent = (chat.pinned ? "📌 " : "") + title;
    li.appendChild(titleSpan);
    li.setAttribute('data-id', id);
    li.setAttribute('data-fullname', title);
    if (title.length > 28) li.classList.add('long-name');
    if (id === currentChatId) li.classList.add('active');

    // Add 3-dots menu button
    const menuButton = document.createElement('button');
    menuButton.classList.add('menu-btn');
    menuButton.type = 'button';
    menuButton.textContent = '⋮';
    menuButton.onclick = (e) => {
      e.stopPropagation();
      showHistoryMenuPopup(id, chat);
    };
    li.appendChild(menuButton);

    li.onclick = () => {
      if (id !== currentChatId) {
        currentChatId = id;
        chatHistory = JSON.parse(JSON.stringify(allChats[id].history));
        renderChat();
        renderHistoryList();
      }
    };
    historyList.appendChild(li);
  }
}

// --- New Chat logic ---
function startNewChat() {
  chatHistory = [];
  currentChatId = "chat-" + Date.now();
  renderChat();
  if (chatHistory.length === 0) {
    appendWelcomeMessage();
  }
  renderHistoryList();
  userInput.value = "";
  userInput.focus();
}
newChatBtn && newChatBtn.addEventListener('click', startNewChat);

// New function to render welcome message on a new chat
function appendWelcomeMessage() {
  const welcomeHTML = `
    <div class="welcome-message" style="text-align:center; padding:20px;">
      <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg" alt="NS Ai Logo" style="width:44px; height:44px; border-radius:12px; margin-bottom:10px;">
      <h2>Welcome to NS Ai</h2>
      <p>Try asking about productivity tips, the latest tech news, or creative story ideas.</p>
    </div>
  `;
  chatBox.innerHTML = welcomeHTML;
}

// --- Chat rendering ---
function renderChat() {
  chatBox.innerHTML = '';
  for (const msg of chatHistory) {
    if (msg.role === 'user') appendMessage(msg.parts[0].text, 'user');
    else if (msg.role === 'model') appendMessage(msg.parts[0].text, 'bot');
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

// --- Code block rendering helper ---
function renderCodeBlocks(text) {
  // Detect triple backtick code blocks (```[lang]\ncode\n```
  // and replace with HTML code block
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    // Escape HTML in code
    const escaped = code.replace(/[&<>"']/g, s =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])
    );
    // Add copy button
    return `<div class="code-block"><button class="copy-btn" onclick="copyCode(this)">Copy</button><pre><code${lang ? ' class="language-'+lang+'"' : ''}>${escaped}</code></pre></div>`;
  });
}

// --- Bold text rendering helper ---
function renderBold(text) {
  // Replace **bold** or __bold__ with <b>bold</b>
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/__(.*?)__/g, '<b>$1</b>');
}

function appendMessage(text, sender, isLoading = false) {
  const div = document.createElement('div');
  div.classList.add('message', sender);
  if (isLoading) div.classList.add('loading');
  if (sender === 'bot') {
    div.innerHTML = renderAIContent(text);
  } else {
    div.innerText = text;
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

// --- Proper AI content rendering: code, bold, line breaks ---
function renderAIContent(text) {
  // Split text into code and non-code segments
  const segments = [];
  let lastIndex = 0;
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = codeRegex.exec(text)) !== null) {
    // Non-code before this code block
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    // Code block
    segments.push({
      type: 'code',
      lang: match[1],
      content: match[2]
    });
    lastIndex = codeRegex.lastIndex;
  }
  // Any remaining non-code after last code block
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  // Render each segment
  return segments.map(seg => {
    if (seg.type === 'code') {
      // Escape HTML in code
      const escaped = seg.content.replace(/[&<>"']/g, s =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])
      );
      return `<div class="code-block"><button class="copy-btn" onclick="copyCode(this)">Copy</button><pre><code${seg.lang ? ' class="language-'+seg.lang+'"' : ''}>${escaped}</code></pre></div>`;
    } else {
      // Render bold and line breaks for text
      return renderBoldAndBreaks(seg.content);
    }
  }).join('');
}

function renderBoldAndBreaks(text) {
  // Escape HTML
  let safe = text.replace(/[&<>]/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s])
  );
  // Bold: **text** or __text__
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
             .replace(/__(.*?)__/g, '<b>$1</b>');
  // Line breaks: replace 2+ consecutive line breaks with a single <br>
  safe = safe.replace(/\n{2,}/g, '\n'); // collapse multiple newlines to one
  safe = safe.replace(/\n/g, '<br>');
  return safe;
}

// --- Chat send logic ---
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  appendMessage(message, 'user');
  userInput.value = '';
  chatHistory.push({
    role: 'user',
    parts: [{ text: message }]
  });

  saveCurrentChatToStorage();

  const loadingDiv = appendMessage("...", 'bot', true);


  const reply = await fetchGeminiReply(chatHistory);
  if (loadingDiv) chatBox.removeChild(loadingDiv);
  if (reply) {
    appendMessage(reply, 'bot');
    chatHistory.push({
      role: 'model',
      parts: [{ text: reply }]
    });
    saveCurrentChatToStorage();
  }
}

function fetchGeminiReply(history) {
  return new Promise(async (resolve) => {
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: history,
            generationConfig: {
              temperature: 0.8,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024
            }
          })
        }
      );

      const data = await response.json();
      console.log("Gemini response:", data);

      // Try to extract the reply text robustly
      let reply = "";
      if (data && data.candidates && data.candidates.length > 0) {
        const parts = data.candidates[0].content?.parts;
        if (parts && parts.length > 0 && parts[0].text) {
          reply = parts[0].text;
        }
      }

      if (!reply) {
        if (data && data.candidates && data.candidates.length > 0) {
          reply = JSON.stringify(data.candidates[0]);
        } else if (data && data.error && data.error.message) {
          reply = "❌ Gemini API error: " + data.error.message;
        } else {
          reply = "⚠️ Gemini didn't return any text.";
        }
      }
      // NEW: Replace any occurrence of "google" (case-insensitive) with "Niramay Studio"
      reply = reply.replace(/google/gi, "Niramay Studio");
      resolve(reply);
    } catch (error) {
      console.error("API Error:", error);
      resolve("❌ Error communicating with Gemini API.");
    }
  });
}

// --- Auto-resize textarea ---
function autoResizeTextarea() {
  userInput.style.height = 'auto';
  userInput.style.height = userInput.scrollHeight + 'px';
  // If empty, reset to original min-height
  if (!userInput.value) {
    userInput.style.height = '';
  }
}
userInput.addEventListener('input', autoResizeTextarea);

// Ensure resize on Ctrl+Enter/newline as well
userInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    if (e.ctrlKey || e.metaKey) {
      // Insert new line
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.substring(0, start) + "\n" + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 1;
      e.preventDefault();
      autoResizeTextarea();
    } else {
      // Send message
      e.preventDefault();
      sendMessage();
      // Reset textarea height after sending
      userInput.style.height = '';
    }
  }
});

// --- Form submit handler ---
chatForm && chatForm.addEventListener('submit', function(e) {
  e.preventDefault();
  sendMessage();
  // Reset textarea height after sending
  userInput.style.height = '';
});

// On page load, ensure correct height
window.addEventListener('DOMContentLoaded', autoResizeTextarea);

// Add or update this function:
window.copyCode = function(btn) {
  // Find the code element inside the same code-block
  const codeElem = btn.parentElement.querySelector('code');
  if (!codeElem) return;
  // Get the code text (preserving line breaks)
  let code = codeElem.innerText;
  // Copy to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = "Copy"; }, 1200);
};
