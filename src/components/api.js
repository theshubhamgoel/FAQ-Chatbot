/**
 * API client to communicate with the Express server.
 * Supports a local Node Express server mode AND a fully client-side Standalone Mode
 * powered by browser localStorage (utilized when hosted statically on GitHub Pages).
 */

const API_BASE = '/api';
let forceStandalone = false;

// Seed FAQs in case fetch of database asset fails
const FALLBACK_SEEDS = [
  {
    id: "faq_001",
    category: "Leaves",
    question: "How do I apply for annual leave?",
    answer: "You can apply for annual leave via the HR portal (Workday) under the 'Time Off' section. Submit your request at least 2 weeks in advance and discuss it with your manager beforehand.",
    tags: ["annual leave", "vacation", "time off", "apply leave", "holidays", "personal leave"],
    usefulCount: 0,
    notUsefulCount: 0
  },
  {
    id: "faq_002",
    category: "Leaves",
    question: "What is the policy for sick leave?",
    answer: "All employees are entitled to 12 days of paid sick leave per year. If you are sick for more than 3 consecutive days, you must submit a medical certificate from a registered practitioner to HR.",
    tags: ["sick leave", "medical leave", "unwell", "illness", "doctor note", "medical certificate"],
    usefulCount: 0,
    notUsefulCount: 0
  },
  {
    id: "faq_003",
    category: "Benefits",
    question: "How do I claim my health insurance?",
    answer: "To claim medical insurance, log into the insurer portal (MediShield) using your employee ID. Submit the itemized hospital/clinic receipt along with the claim form. Claims are usually processed within 7-10 business days.",
    tags: ["health insurance", "medical claim", "insurance claim", "doctor bill", "hospitalization", "reimbursement"],
    usefulCount: 0,
    notUsefulCount: 0
  },
  {
    id: "faq_007",
    category: "Workplace",
    question: "What is the remote work policy?",
    answer: "Our current policy allows a hybrid model: up to 2 days of remote work per week, with mandatory in-office presence on Tuesdays and Thursdays. Coordinate your remote days with your team lead.",
    tags: ["remote work", "work from home", "wfh", "hybrid model", "office days", "flexible hours"],
    usefulCount: 0,
    notUsefulCount: 0
  }
];

// NLP processing tokens for standalone client matching
const stopwords = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't",
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', "can't", 'cannot', 'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing', "don't",
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have',
  "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself',
  'him', 'himself', 'his', 'how', "how's", 'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is',
  "isn't", 'it', "it's", 'its', 'itself', "let's", 'me', 'more', 'most', "mustn't", 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', "shan't", 'she', "she'd", "she'll", "she's", 'should',
  "shouldn't", 'so', 'some', 'such', 'than', 'that', "that's", 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're", "they've",
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', "wasn't", 'we',
  "we'd", "we'll", "we're", "we've", 'were', "weren't", 'what', "what's", 'when', "when's", 'where',
  "where's", 'which', 'while', 'who', "who's", 'whom', 'why', "why's", 'with', "won't", 'would',
  "wouldn't", 'you', "you'd", "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves'
]);

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function tokenSimilarity(tok1, tok2) {
  if (tok1 === tok2) return 1.0;
  if (tok2.includes(tok1) || tok1.includes(tok2)) {
    return Math.min(tok1.length, tok2.length) / Math.max(tok1.length, tok2.length);
  }
  const dist = levenshtein(tok1, tok2);
  const maxLen = Math.max(tok1.length, tok2.length);
  if (maxLen === 0) return 0;
  const sim = 1 - dist / maxLen;
  return sim > 0.75 ? sim : 0;
}

function tokenize(text) {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  return clean.split(/\s+/).filter(t => t && !stopwords.has(t));
}

// Initialize seed FAQs in localStorage if not already present
let faqsInitialized = false;
async function initFaqs() {
  if (faqsInitialized) return;
  
  let localFaqs = localStorage.getItem('faqs');
  if (!localFaqs) {
    try {
      // Fetch the public database asset packed by Vite
      const response = await fetch('./database/faqs.json');
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('faqs', JSON.stringify(data));
      } else {
        localStorage.setItem('faqs', JSON.stringify(FALLBACK_SEEDS));
      }
    } catch (error) {
      console.warn("Could not fetch seed faqs.json. Seeding local storage with fallback list.", error);
      localStorage.setItem('faqs', JSON.stringify(FALLBACK_SEEDS));
    }
  }
  faqsInitialized = true;
}

// Standalone implementation using localStorage
async function handleStandalone(url, options = {}) {
  await initFaqs();

  const getLocalStorageData = (key) => JSON.parse(localStorage.getItem(key) || '[]');
  const setLocalStorageData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  // 1. GET /api/faqs
  if (url === '/faqs' && (!options.method || options.method === 'GET')) {
    return getLocalStorageData('faqs');
  }

  // 2. POST /api/faqs
  if (url === '/faqs' && options.method === 'POST') {
    const { category, question, answer, tags } = JSON.parse(options.body);
    const faqs = getLocalStorageData('faqs');
    const newFaq = {
      id: `faq_${Date.now()}`,
      category,
      question,
      answer,
      tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()) : [],
      usefulCount: 0,
      notUsefulCount: 0
    };
    faqs.push(newFaq);
    setLocalStorageData('faqs', faqs);
    return newFaq;
  }

  // 3. PUT /api/faqs/:id
  if (url.startsWith('/faqs/') && options.method === 'PUT') {
    const id = url.split('/faqs/')[1];
    const { category, question, answer, tags } = JSON.parse(options.body);
    const faqs = getLocalStorageData('faqs');
    const index = faqs.findIndex(f => f.id === id);

    if (index === -1) {
      throw new Error('FAQ not found');
    }

    faqs[index] = {
      ...faqs[index],
      category: category || faqs[index].category,
      question: question || faqs[index].question,
      answer: answer || faqs[index].answer,
      tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()) : faqs[index].tags
    };

    setLocalStorageData('faqs', faqs);
    return faqs[index];
  }

  // 4. DELETE /api/faqs/:id
  if (url.startsWith('/faqs/') && options.method === 'DELETE') {
    const id = url.split('/faqs/')[1];
    let faqs = getLocalStorageData('faqs');
    const initialLen = faqs.length;
    faqs = faqs.filter(f => f.id !== id);

    if (faqs.length === initialLen) {
      throw new Error('FAQ not found');
    }

    setLocalStorageData('faqs', faqs);
    return { message: 'FAQ deleted successfully.' };
  }

  // 5. POST /api/chat (Client-side matching engine)
  if (url === '/chat' && options.method === 'POST') {
    const { message } = JSON.parse(options.body);
    const faqs = getLocalStorageData('faqs');
    const queryTokens = tokenize(message);

    if (queryTokens.length === 0) {
      return {
        matched: false,
        faq: null,
        confidence: 0,
        fallbackMessage: "Please ask a specific question."
      };
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const faq of faqs) {
      const questionTokens = tokenize(faq.question);
      const tagTokens = faq.tags.flatMap(tag => tokenize(tag));

      let totalTokenScore = 0;

      for (const qTok of queryTokens) {
        let maxTagSim = 0;
        for (const tTok of tagTokens) {
          maxTagSim = Math.max(maxTagSim, tokenSimilarity(qTok, tTok));
        }

        let maxQuesSim = 0;
        for (const qTextTok of questionTokens) {
          maxQuesSim = Math.max(maxQuesSim, tokenSimilarity(qTok, qTextTok));
        }

        const tokenScore = Math.max(maxTagSim, maxQuesSim);
        totalTokenScore += tokenScore;
      }

      const normalizedScore = totalTokenScore / queryTokens.length;

      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = faq;
      }
    }

    const threshold = 0.35;
    const matched = bestScore >= threshold;

    // Log query local
    const logs = getLocalStorageData('logs');
    logs.push({
      timestamp: new Date().toISOString(),
      query: message,
      matchedFaqId: matched ? bestMatch.id : null,
      score: Number(bestScore.toFixed(3)),
      isSuccess: matched
    });
    setLocalStorageData('logs', logs);

    if (matched) {
      return {
        matched: true,
        faq: bestMatch,
        confidence: Number(bestScore.toFixed(3)),
        fallbackMessage: ''
      };
    } else {
      return {
        matched: false,
        faq: null,
        confidence: Number(bestScore.toFixed(3)),
        fallbackMessage: "I'm sorry, I couldn't find an exact policy match for your query. I've logged this for the HR team to look into, or you can try rephrasing your question."
      };
    }
  }

  // 6. POST /api/feedback
  if (url === '/feedback' && options.method === 'POST') {
    const { faqId, query, rating, comment } = JSON.parse(options.body);
    
    // Save feedback
    const feedbacks = getLocalStorageData('feedback');
    const newFeedback = {
      id: `fb_${Date.now()}`,
      timestamp: new Date().toISOString(),
      faqId: faqId || null,
      query: query || '',
      rating,
      comment: comment || ''
    };
    feedbacks.push(newFeedback);
    setLocalStorageData('feedback', feedbacks);

    // Update FAQ counter
    if (faqId) {
      const faqs = getLocalStorageData('faqs');
      const faqIndex = faqs.findIndex(f => f.id === faqId);
      if (faqIndex !== -1) {
        if (rating === 'up') {
          faqs[faqIndex].usefulCount = (faqs[faqIndex].usefulCount || 0) + 1;
        } else {
          faqs[faqIndex].notUsefulCount = (faqs[faqIndex].notUsefulCount || 0) + 1;
        }
        setLocalStorageData('faqs', faqs);
      }
    }

    return { success: true, feedback: newFeedback };
  }

  // 7. GET /api/analytics
  if (url === '/analytics' && (!options.method || options.method === 'GET')) {
    const logs = getLocalStorageData('logs');
    const feedbacks = getLocalStorageData('feedback');
    const faqs = getLocalStorageData('faqs');

    const totalQueries = logs.length;
    const successfulQueries = logs.filter(l => l.isSuccess).length;
    const successRate = totalQueries > 0 ? Number(((successfulQueries / totalQueries) * 100).toFixed(1)) : 100;

    const categoryStats = {};
    for (const log of logs) {
      if (log.isSuccess && log.matchedFaqId) {
        const faq = faqs.find(f => f.id === log.matchedFaqId);
        if (faq) {
          categoryStats[faq.category] = (categoryStats[faq.category] || 0) + 1;
        }
      }
    }

    const missedMap = {};
    logs.filter(l => !l.isSuccess).forEach(l => {
      const cleanQ = l.query.trim().toLowerCase();
      missedMap[cleanQ] = (missedMap[cleanQ] || 0) + 1;
    });

    const missedQueries = Object.keys(missedMap)
      .map(q => ({ query: q, count: missedMap[q] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentFeedback = feedbacks
      .map(f => {
        const faq = faqs.find(faqItem => faqItem.id === f.faqId);
        return {
          ...f,
          faqQuestion: faq ? faq.question : 'Unknown/General query'
        };
      })
      .reverse()
      .slice(0, 10);

    return {
      totalQueries,
      successRate,
      categoryStats,
      missedQueries,
      recentFeedback
    };
  }

  throw new Error(`Unsupported static mockup URL: ${url}`);
}

async function request(url, options = {}) {
  // Standalone mode is triggered if running on github.io, on local file, or if URL contains ?standalone
  const isStandalone = forceStandalone || 
                       window.location.hostname.includes('github.io') || 
                       window.location.search.includes('standalone') || 
                       window.location.protocol === 'file:';
  
  if (isStandalone) {
    console.log(`[HR.ai API] Static Standalone mode handles: ${options.method || 'GET'} ${url}`);
    return handleStandalone(url, options);
  }

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
    console.warn(`[HR.ai API] Backend connection failed. Falling back to Standalone Mode (localStorage). Error:`, error);
    forceStandalone = true; // Cache this fallback state
    return handleStandalone(url, options);
  }
}

export const api = {
  getFaqs: () => request('/faqs'),
  addFaq: (faqData) => request('/faqs', {
    method: 'POST',
    body: JSON.stringify(faqData)
  }),
  updateFaq: (id, faqData) => request(`/faqs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(faqData)
  }),
  deleteFaq: (id) => request(`/faqs/${id}`, {
    method: 'DELETE'
  }),
  sendChatMessage: (message) => request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message })
  }),
  submitFeedback: (feedbackData) => request('/feedback', {
    method: 'POST',
    body: JSON.stringify(feedbackData)
  }),
  getAnalytics: () => request('/analytics')
};
