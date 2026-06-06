import { api } from './api.js';

export class AdminComponent {
  constructor(app) {
    this.app = app;
    
    // UI elements
    this.faqTableBody = document.getElementById('table-faqs-body');
    this.searchInput = document.getElementById('admin-faq-search');
    this.filterCategory = document.getElementById('admin-faq-filter-category');
    
    // Analytics elements
    this.statTotalQueries = document.getElementById('stat-total-queries');
    this.statSuccessRate = document.getElementById('stat-success-rate');
    this.statSuccessBar = document.getElementById('stat-success-bar');
    this.statHelpfulRatio = document.getElementById('stat-helpful-ratio');
    this.statActiveFaqs = document.getElementById('stat-active-faqs');
    
    // Lists elements
    this.missedQueriesList = document.getElementById('missed-queries-list');
    this.feedbackFeedList = document.getElementById('feedback-feed-list');
    
    // Modal elements
    this.faqModal = document.getElementById('modal-faq-editor');
    this.faqForm = document.getElementById('form-faq-editor');
    this.btnOpenAddModal = document.getElementById('btn-add-faq-modal');
    this.btnCloseModal = document.getElementById('btn-close-faq-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-faq-modal');
    
    // Modal fields
    this.fieldFaqId = document.getElementById('editor-faq-id');
    this.fieldCategory = document.getElementById('editor-faq-category');
    this.fieldQuestion = document.getElementById('editor-faq-question');
    this.fieldAnswer = document.getElementById('editor-faq-answer');
    this.fieldTags = document.getElementById('editor-faq-tags');
    this.modalTitle = document.getElementById('modal-title');
    
    // Internal state
    this.faqs = [];

    this.bindEvents();
  }

  bindEvents() {
    // Search and filter
    this.searchInput.addEventListener('input', () => this.renderFaqsTable());
    this.filterCategory.addEventListener('change', () => this.renderFaqsTable());

    // Open add FAQ modal
    this.btnOpenAddModal.addEventListener('click', () => this.openEditorModal());

    // Close modals
    this.btnCloseModal.addEventListener('click', () => this.closeEditorModal());
    this.btnCancelModal.addEventListener('click', () => this.closeEditorModal());

    // Form submit
    this.faqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveFaq();
    });

    // Delegated edit/delete clicks on FAQ Table
    this.faqTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-faq');
      const deleteBtn = e.target.closest('.btn-delete-faq');

      if (editBtn) {
        const id = editBtn.dataset.id;
        const faq = this.faqs.find(f => f.id === id);
        if (faq) {
          this.openEditorModal(faq);
        }
      }

      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('Are you sure you want to delete this FAQ? This action cannot be undone.')) {
          try {
            await api.deleteFaq(id);
            await this.loadData();
            this.app.syncExplorerFaqs(); // sync Explorer in employee view
          } catch (error) {
            alert('Failed to delete FAQ: ' + error.message);
          }
        }
      }
    });

    // Delegated add missed query click
    this.missedQueriesList.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.btn-add-missed');
      if (addBtn) {
        const query = addBtn.dataset.query;
        this.openEditorModal({
          question: this.capitalizeFirstLetter(query),
          category: '',
          answer: '',
          tags: query.split(/\s+/).filter(w => w.length > 3)
        });
      }
    });
  }

  capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  openEditorModal(faq = null) {
    if (faq) {
      this.fieldFaqId.value = faq.id || '';
      this.fieldCategory.value = faq.category || '';
      this.fieldQuestion.value = faq.question || '';
      this.fieldAnswer.value = faq.answer || '';
      this.fieldTags.value = Array.isArray(faq.tags) ? faq.tags.join(', ') : '';
      this.modalTitle.textContent = faq.id ? 'Edit FAQ Policy' : 'Add FAQ from Missed Query';
    } else {
      this.fieldFaqId.value = '';
      this.fieldCategory.value = '';
      this.fieldQuestion.value = '';
      this.fieldAnswer.value = '';
      this.fieldTags.value = '';
      this.modalTitle.textContent = 'Add New FAQ';
    }
    this.faqModal.classList.add('open');
    this.faqModal.setAttribute('aria-hidden', 'false');
  }

  closeEditorModal() {
    this.faqModal.classList.remove('open');
    this.faqModal.setAttribute('aria-hidden', 'true');
  }

  async saveFaq() {
    const id = this.fieldFaqId.value;
    const faqData = {
      category: this.fieldCategory.value,
      question: this.fieldQuestion.value.trim(),
      answer: this.fieldAnswer.value.trim(),
      tags: this.fieldTags.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
    };

    try {
      if (id) {
        await api.updateFaq(id, faqData);
      } else {
        await api.addFaq(faqData);
      }
      this.closeEditorModal();
      await this.loadData();
      this.app.syncExplorerFaqs(); // sync Explorer in employee view
    } catch (error) {
      alert('Failed to save FAQ: ' + error.message);
    }
  }

  async loadData() {
    try {
      // 1. Fetch FAQs
      this.faqs = await api.getFaqs();
      this.renderFaqsTable();

      // 2. Fetch Analytics dashboard data
      const analytics = await api.getAnalytics();
      this.renderAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load admin dashboard data:', error);
    }
  }

  renderFaqsTable() {
    const searchQuery = this.searchInput.value.toLowerCase().trim();
    const categoryFilter = this.filterCategory.value;

    const filtered = this.faqs.filter(faq => {
      const matchesCategory = categoryFilter === 'All' || faq.category === categoryFilter;
      
      const searchStr = `${faq.question} ${faq.answer} ${faq.tags.join(' ')}`.toLowerCase();
      const matchesSearch = !searchQuery || searchStr.includes(searchQuery);

      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      this.faqTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
            No FAQs found matching the filters.
          </td>
        </tr>
      `;
      return;
    }

    this.faqTableBody.innerHTML = filtered.map(faq => {
      const useful = faq.usefulCount || 0;
      const notUseful = faq.notUsefulCount || 0;
      const totalRatings = useful + notUseful;
      const helpfulPercent = totalRatings > 0 ? Math.round((useful / totalRatings) * 100) : null;
      
      let helpfulString = 'No ratings';
      if (helpfulPercent !== null) {
        helpfulString = `${helpfulPercent}% (${useful}/${totalRatings})`;
      }

      // Format category for CSS badge class
      const badgeClass = faq.category.toLowerCase().replace(/\s+/g, '-');

      return `
        <tr>
          <td>
            <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 4px;">${faq.question}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); max-width: 450px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${faq.answer}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}">${faq.category}</span>
          </td>
          <td style="color: ${helpfulPercent !== null ? (helpfulPercent >= 70 ? 'var(--accent-emerald)' : helpfulPercent >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)') : 'var(--text-muted)'}">
            ${helpfulString}
          </td>
          <td>
            <div class="actions-cell">
              <button class="action-icon-btn btn-edit-faq" data-id="${faq.id}" title="Edit FAQ" aria-label="Edit FAQ">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="action-icon-btn delete btn-delete-faq" data-id="${faq.id}" title="Delete FAQ" aria-label="Delete FAQ">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  renderAnalytics(data) {
    // 1. Stat boxes
    this.statTotalQueries.textContent = data.totalQueries;
    this.statSuccessRate.textContent = `${data.successRate}%`;
    this.statSuccessBar.style.width = `${data.successRate}%`;
    this.statActiveFaqs.textContent = this.faqs.length;

    // Calculate Helpful ratio
    let totalUseful = 0;
    let totalNotUseful = 0;
    this.faqs.forEach(f => {
      totalUseful += (f.usefulCount || 0);
      totalNotUseful += (f.notUsefulCount || 0);
    });
    const totalFeedback = totalUseful + totalNotUseful;
    const helpfulRatio = totalFeedback > 0 ? Math.round((totalUseful / totalFeedback) * 100) : 100;
    this.statHelpfulRatio.textContent = `${helpfulRatio}%`;

    // 2. Missed queries list
    if (data.missedQueries.length === 0) {
      this.missedQueriesList.innerHTML = `<li style="text-align: center; padding-block: 16px; color: var(--text-muted); font-size: 0.8rem;">No missed queries logged!</li>`;
    } else {
      this.missedQueriesList.innerHTML = data.missedQueries.map(mq => `
        <li class="missed-query-item">
          <span class="missed-query-text" title="${mq.query}">${mq.query}</span>
          <div class="missed-query-badge-wrapper">
            <span class="missed-count-badge" title="Asked ${mq.count} times">${mq.count}x</span>
            <button class="btn-add-missed" data-query="${mq.query}" title="Add to FAQ Knowledge Base" aria-label="Add missed query to FAQ">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </li>
      `).join('');
    }

    // 3. Feedback Feed
    if (data.recentFeedback.length === 0) {
      this.feedbackFeedList.innerHTML = `<div style="text-align: center; padding-block: 16px; color: var(--text-muted); font-size: 0.8rem;">No feedback responses yet.</div>`;
    } else {
      this.feedbackFeedList.innerHTML = data.recentFeedback.map(fb => {
        const isUp = fb.rating === 'up';
        const ratingClass = isUp ? 'rating-up' : 'rating-down';
        const ratingIcon = isUp ? 'thumbs-up' : 'thumbs-down';
        const ratingLabel = isUp ? 'Helpful' : 'Unhelpful';
        const dateStr = new Date(fb.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
          <div class="feedback-item">
            <div class="feedback-item-header">
              <span class="feedback-rating ${ratingClass}">
                <i data-lucide="${ratingIcon}"></i>
                <span>${ratingLabel}</span>
              </span>
              <span class="feedback-time">${dateStr}</span>
            </div>
            <span class="feedback-query-str">Q: "${fb.query || fb.faqQuestion}"</span>
            ${fb.comment ? `<p class="feedback-comment-str">${fb.comment}</p>` : `<p class="feedback-comment-str" style="color: var(--text-muted); font-style: italic;">No comment left</p>`}
          </div>
        `;
      }).join('');
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }
}
