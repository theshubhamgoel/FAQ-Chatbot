import { api } from './components/api.js';
import { ChatbotComponent } from './components/chatbot.js';
import { AdminComponent } from './components/admin.js';

class AppController {
  constructor() {
    this.chatbot = null;
    this.admin = null;
    
    // View switching buttons
    this.btnEmployeeView = document.getElementById('btn-employee-view');
    this.btnAdminView = document.getElementById('btn-admin-view');
    
    // Sections
    this.viewEmployee = document.getElementById('view-employee');
    this.viewAdmin = document.getElementById('view-admin');
    
    // Explorer elements
    this.explorerFaqList = document.getElementById('explorer-faq-list');
    this.explorerCategoryTabs = document.getElementById('explorer-category-tabs');
    this.activeExplorerCategory = 'All';
    this.allFaqs = [];

    this.init();
  }

  async init() {
    // 1. Initialize component views
    this.chatbot = new ChatbotComponent(this);
    this.admin = new AdminComponent(this);

    // 2. Bind main navigation toggles
    this.bindNavigation();

    // 3. Bind FAQ Explorer events
    this.bindExplorer();

    // 4. Initial data load
    await this.syncExplorerFaqs();
    await this.admin.loadData();
  }

  bindNavigation() {
    this.btnEmployeeView.addEventListener('click', () => {
      this.switchView('employee');
    });

    this.btnAdminView.addEventListener('click', () => {
      this.switchView('admin');
      this.admin.loadData(); // refresh admin dashboard data when entering
    });
  }

  switchView(viewName) {
    if (viewName === 'employee') {
      this.btnEmployeeView.classList.add('active');
      this.btnAdminView.classList.remove('active');
      this.viewEmployee.classList.add('active');
      this.viewAdmin.classList.remove('active');
    } else {
      this.btnAdminView.classList.add('active');
      this.btnEmployeeView.classList.remove('active');
      this.viewAdmin.classList.add('active');
      this.viewEmployee.classList.remove('active');
    }
  }

  bindExplorer() {
    // Category tabs clicking
    this.explorerCategoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;

      // Toggle active states
      const tabs = this.explorerCategoryTabs.querySelectorAll('.cat-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      this.activeExplorerCategory = tab.dataset.category;
      this.renderExplorerList();
    });

    // Clicking an FAQ item in the explorer sidebar feeds it to the chatbot
    this.explorerFaqList.addEventListener('click', (e) => {
      const itemBtn = e.target.closest('.faq-item-btn');
      if (!itemBtn) return;

      const questionText = itemBtn.dataset.question;
      if (questionText) {
        this.chatbot.sendMessage(questionText);
      }
    });
  }

  async syncExplorerFaqs() {
    try {
      this.allFaqs = await api.getFaqs();
      this.renderExplorerList();
    } catch (error) {
      this.explorerFaqList.innerHTML = `<p style="font-size: 0.8rem; color: var(--accent-red); padding: 16px;">Failed to load FAQs.</p>`;
    }
  }

  renderExplorerList() {
    const filtered = this.allFaqs.filter(faq => {
      if (this.activeExplorerCategory === 'All') return true;
      // Normalize IT Support string for comparison
      return faq.category.toLowerCase().trim() === this.activeExplorerCategory.toLowerCase().trim();
    });

    if (filtered.length === 0) {
      this.explorerFaqList.innerHTML = `
        <div style="font-size: 0.8rem; text-align: center; color: var(--text-muted); padding-block: 24px;">
          No FAQs listed in this category yet.
        </div>
      `;
      return;
    }

    this.explorerFaqList.innerHTML = filtered.map(faq => `
      <button class="faq-item-btn" data-question="${faq.question}" aria-label="Ask chatbot: ${faq.question}">
        ${faq.question}
      </button>
    `).join('');
  }

  // Triggered when feedback is logged or queries are processed to keep dashboards updated in real time
  async reloadAdminData() {
    if (this.admin) {
      await this.admin.loadData();
    }
  }
}

// Instantiate core app driver
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
