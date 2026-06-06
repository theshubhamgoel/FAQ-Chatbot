import { api } from './api.js';

export class ChatbotComponent {
  constructor(app) {
    this.app = app;
    this.messagesContainer = document.getElementById('chat-messages');
    this.form = document.getElementById('chat-input-form');
    this.input = document.getElementById('input-query');
    this.suggestionsContainer = document.getElementById('chat-suggestions');
    this.btnVoice = document.getElementById('btn-voice-input');
    this.btnTts = document.getElementById('btn-toggle-tts');
    this.btnClear = document.getElementById('btn-clear-chat');
    
    // Feedback Modal elements
    this.feedbackModal = document.getElementById('modal-feedback-comment');
    this.feedbackForm = document.getElementById('form-feedback-comment');
    this.feedbackFaqIdInput = document.getElementById('feedback-faq-id');
    this.feedbackQueryInput = document.getElementById('feedback-query');
    this.feedbackCommentInput = document.getElementById('feedback-comment');
    this.btnCancelFeedback = document.getElementById('btn-cancel-feedback-modal');
    this.btnCloseFeedback = document.getElementById('btn-close-feedback-modal');

    // Speech synthesis & recognition state
    this.ttsEnabled = false;
    this.recognition = null;
    this.isRecording = false;

    // Active pending feedback element
    this.activeFeedbackBtn = null;

    this.initSpeech();
    this.bindEvents();
    this.renderSuggestions([
      'How to apply for annual leave?',
      'When is salary credited?',
      'What is the remote work policy?',
      'How do I claim health insurance?'
    ]);
  }

  initSpeech() {
    // 1. Speech Synthesis (Text to Speech)
    if (!('speechSynthesis' in window)) {
      this.btnTts.style.display = 'none';
    }

    // 2. Speech Recognition (Speech to Text)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.btnVoice.classList.add('recording');
        this.input.placeholder = 'Listening... Speak now';
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.btnVoice.classList.remove('recording');
        this.input.placeholder = 'Ask about leaves, insurance claims, pay slips...';
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.input.value = transcript;
        this.form.dispatchEvent(new Event('submit'));
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.isRecording = false;
        this.btnVoice.classList.remove('recording');
      };
    } else {
      this.btnVoice.style.display = 'none';
    }
  }

  bindEvents() {
    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (text) {
        this.sendMessage(text);
        this.input.value = '';
      }
    });

    // Voice input button
    this.btnVoice.addEventListener('click', () => {
      if (!this.recognition) return;
      if (this.isRecording) {
        this.recognition.stop();
      } else {
        this.recognition.start();
      }
    });

    // TTS Toggle
    this.btnTts.addEventListener('click', () => {
      this.ttsEnabled = !this.ttsEnabled;
      const icon = document.getElementById('icon-tts');
      if (this.ttsEnabled) {
        this.btnTts.classList.add('active');
        icon.setAttribute('data-lucide', 'volume-2');
        this.speak("Text to speech enabled");
      } else {
        this.btnTts.classList.remove('active');
        icon.setAttribute('data-lucide', 'volume-x');
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      }
      if (window.lucide) {
        lucide.createIcons();
      }
    });

    // Clear chat
    this.btnClear.addEventListener('click', () => {
      this.messagesContainer.innerHTML = `
        <div class="message bot-message">
          <div class="message-content">
            <p>Hello! I'm your HR Assistant. How can I help you today? You can type your query below, select from the FAQ Explorer, or click one of the suggested topics.</p>
          </div>
          <time class="message-time">Just now</time>
        </div>
      `;
      this.renderSuggestions([
        'How to apply for annual leave?',
        'When is salary credited?',
        'What is the remote work policy?',
        'How do I claim health insurance?'
      ]);
    });

    // Bind inline feedback clicks dynamically on messages container
    this.messagesContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('.feedback-btn');
      if (!btn) return;
      
      const faqId = btn.dataset.faqId;
      const query = btn.dataset.query;
      const rating = btn.dataset.rating; // 'up' or 'down'

      // Disable other sibling feedback buttons in same container
      const parentRow = btn.closest('.bot-feedback-row');
      const buttons = parentRow.querySelectorAll('.feedback-btn');

      if (rating === 'up') {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buttons.forEach(b => b.disabled = true);
        
        try {
          await api.submitFeedback({ faqId, query, rating: 'up', comment: '' });
          // Optionally reload analytics
          this.app.reloadAdminData();
        } catch (error) {
          console.error(error);
        }
      } else {
        // Record active button for later styling updates on modal submission
        this.activeFeedbackBtn = btn;
        this.feedbackFaqIdInput.value = faqId || '';
        this.feedbackQueryInput.value = query || '';
        this.feedbackCommentInput.value = '';
        
        // Open Feedback Comment Modal
        this.feedbackModal.classList.add('open');
        this.feedbackModal.setAttribute('aria-hidden', 'false');
      }
    });

    // Modal Close Triggers
    const closeModal = () => {
      this.feedbackModal.classList.remove('open');
      this.feedbackModal.setAttribute('aria-hidden', 'true');
      if (this.activeFeedbackBtn) {
        const parentRow = this.activeFeedbackBtn.closest('.bot-feedback-row');
        const buttons = parentRow.querySelectorAll('.feedback-btn');
        // If user skips/cancels, just mark down as active anyway without comment
        this.activeFeedbackBtn.classList.add('active');
        buttons.forEach(b => b.disabled = true);
        
        const faqId = this.feedbackFaqIdInput.value;
        const query = this.feedbackQueryInput.value;
        api.submitFeedback({ faqId, query, rating: 'down', comment: '' })
          .then(() => this.app.reloadAdminData());
      }
      this.activeFeedbackBtn = null;
    };

    this.btnCloseFeedback.addEventListener('click', closeModal);
    this.btnCancelFeedback.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });

    // Feedback modal submit
    this.feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const faqId = this.feedbackFaqIdInput.value;
      const query = this.feedbackQueryInput.value;
      const comment = this.feedbackCommentInput.value.trim();

      if (this.activeFeedbackBtn) {
        const parentRow = this.activeFeedbackBtn.closest('.bot-feedback-row');
        const buttons = parentRow.querySelectorAll('.feedback-btn');
        this.activeFeedbackBtn.classList.add('active');
        buttons.forEach(b => b.disabled = true);
      }

      try {
        await api.submitFeedback({ faqId, query, rating: 'down', comment });
        this.app.reloadAdminData();
      } catch (error) {
        console.error(error);
      }

      this.feedbackModal.classList.remove('open');
      this.feedbackModal.setAttribute('aria-hidden', 'true');
      this.activeFeedbackBtn = null;
    });
  }

  renderSuggestions(suggestions) {
    this.suggestionsContainer.innerHTML = '';
    suggestions.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = s;
      chip.addEventListener('click', () => this.sendMessage(s));
      this.suggestionsContainer.appendChild(chip);
    });
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  speak(text) {
    if (!this.ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  }

  // Appends a user or bot message bubble to the chat stream
  appendMessage(text, isUser = false, matchedFaq = null, userQuery = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    // Parse formatting simply (e.g. carriage returns to <br>)
    const formattedText = text.replace(/\n/g, '<br>');

    let html = `
      <div class="message-content">
        <p>${formattedText}</p>
    `;

    // Add inline thumbs feedback for bot responses
    if (!isUser) {
      const faqId = matchedFaq ? matchedFaq.id : '';
      html += `
        <div class="bot-feedback-row">
          <button class="feedback-btn up" data-faq-id="${faqId}" data-query="${userQuery}" data-rating="up" title="This answer was helpful" aria-label="Mark as helpful">
            <i data-lucide="thumbs-up"></i>
            <span>Helpful</span>
          </button>
          <button class="feedback-btn down" data-faq-id="${faqId}" data-query="${userQuery}" data-rating="down" title="This answer was not helpful" aria-label="Mark as unhelpful">
            <i data-lucide="thumbs-down"></i>
            <span>Unhelpful</span>
          </button>
        </div>
      `;
    }

    html += `
      </div>
      <time class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
    `;

    messageDiv.innerHTML = html;
    this.messagesContainer.appendChild(messageDiv);
    if (window.lucide) {
      lucide.createIcons();
    }
    this.scrollToBottom();

    if (!isUser) {
      this.speak(text);
    }
  }

  appendTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'message bot-message typing-indicator-container';
    indicatorDiv.id = 'bot-typing-indicator';
    indicatorDiv.innerHTML = `
      <div class="message-content">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(indicatorDiv);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('bot-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  async sendMessage(queryText) {
    // 1. Add User Message
    this.appendMessage(queryText, true);

    // 2. Add Typing Indicator
    this.appendTypingIndicator();

    // 3. Request bot answer with a small natural UI delay
    const startTime = Date.now();
    try {
      const result = await api.sendChatMessage(queryText);
      const elapsed = Date.now() - startTime;
      const delay = Math.max(500 - elapsed, 0); // guarantee at least 500ms feel of thinking

      setTimeout(() => {
        this.removeTypingIndicator();
        if (result.matched) {
          this.appendMessage(result.faq.answer, false, result.faq, queryText);
          
          // Generate contextual suggestions based on matched category
          const category = result.faq.category;
          this.fetchContextSuggestions(category, result.faq.question);
        } else {
          this.appendMessage(result.fallbackMessage, false, null, queryText);
          this.renderSuggestions([
            'What is the policy for sick leave?',
            'When is payday?',
            'What is the hybrid office model?'
          ]);
        }
        
        // Refresh admin data since query logs were added
        this.app.reloadAdminData();
      }, delay);

    } catch (error) {
      this.removeTypingIndicator();
      this.appendMessage("I'm having trouble connecting to the HR services. Please try again in a few moments.", false);
    }
  }

  // Find other questions in same category as suggestions
  async fetchContextSuggestions(category, currentQuestion) {
    try {
      const faqs = await api.getFaqs();
      const related = faqs
        .filter(f => f.category === category && f.question !== currentQuestion)
        .slice(0, 3)
        .map(f => f.question);
      
      if (related.length > 0) {
        this.renderSuggestions(related);
      } else {
        // Fallback suggestions
        this.renderSuggestions([
          'What are the gym benefits?',
          'How to reset Okta password?',
          'What is the sick leave policy?'
        ]);
      }
    } catch (e) {
      // ignore
    }
  }
}
