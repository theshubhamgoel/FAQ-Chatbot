/**
 * API client to communicate with the Express server.
 * Handles fetching FAQs, sending chat queries, submitting user feedback, and gathering analytics.
 */

const API_BASE = '/api';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${url}`, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Request failed on ${url}:`, error);
    throw error;
  }
}

export const api = {
  // Fetch all FAQ entries
  getFaqs: () => request('/faqs'),

  // Add a new FAQ entry (Admin)
  addFaq: (faqData) => request('/faqs', {
    method: 'POST',
    body: JSON.stringify(faqData)
  }),

  // Update an existing FAQ entry (Admin)
  updateFaq: (id, faqData) => request(`/faqs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(faqData)
  }),

  // Delete an FAQ entry (Admin)
  deleteFaq: (id) => request(`/faqs/${id}`, {
    method: 'DELETE'
  }),

  // Send a user chat query to the matching engine
  sendChatMessage: (message) => request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message })
  }),

  // Submit employee helpfulness feedback
  submitFeedback: (feedbackData) => request('/feedback', {
    method: 'POST',
    body: JSON.stringify(feedbackData)
  }),

  // Fetch HR Admin analytics dashboard aggregates
  getAnalytics: () => request('/analytics')
};
