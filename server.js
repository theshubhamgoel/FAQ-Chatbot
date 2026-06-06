import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Paths to data files
const FAQS_PATH = path.join(__dirname, 'database', 'faqs.json');
const LOGS_PATH = path.join(__dirname, 'database', 'logs.json');
const FEEDBACK_PATH = path.join(__dirname, 'database', 'feedback.json');

// Stopwords set for text processing
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

// Helper to calculate Levenshtein distance for spell checking
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Calculate similarity between two tokens (0 to 1)
function tokenSimilarity(tok1, tok2) {
  if (tok1 === tok2) return 1.0;
  if (tok2.includes(tok1) || tok1.includes(tok2)) {
    return Math.min(tok1.length, tok2.length) / Math.max(tok1.length, tok2.length);
  }
  const dist = levenshtein(tok1, tok2);
  const maxLen = Math.max(tok1.length, tok2.length);
  if (maxLen === 0) return 0;
  const sim = 1 - dist / maxLen;
  return sim > 0.75 ? sim : 0; // return 0 if similarity is below threshold
}

// Tokenize text: lowercase, remove punctuation, remove stopwords
function tokenize(text) {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  return clean.split(/\s+/).filter(t => t && !stopwords.has(t));
}

// Helper to read JSON safely
async function readJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper to write JSON safely
async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Get all FAQs
app.get('/api/faqs', async (req, res) => {
  try {
    const faqs = await readJson(FAQS_PATH);
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read FAQs.' });
  }
});

// 2. Add an FAQ
app.post('/api/faqs', async (req, res) => {
  try {
    const { category, question, answer, tags } = req.body;
    if (!category || !question || !answer) {
      return res.status(400).json({ error: 'Category, question, and answer are required.' });
    }

    const faqs = await readJson(FAQS_PATH);
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
    await writeJson(FAQS_PATH, faqs);
    res.status(201).json(newFaq);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save new FAQ.' });
  }
});

// 3. Update an FAQ
app.put('/api/faqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, question, answer, tags } = req.body;

    const faqs = await readJson(FAQS_PATH);
    const index = faqs.findIndex(f => f.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'FAQ not found.' });
    }

    faqs[index] = {
      ...faqs[index],
      category: category || faqs[index].category,
      question: question || faqs[index].question,
      answer: answer || faqs[index].answer,
      tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()) : faqs[index].tags
    };

    await writeJson(FAQS_PATH, faqs);
    res.json(faqs[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update FAQ.' });
  }
});

// 4. Delete an FAQ
app.delete('/api/faqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let faqs = await readJson(FAQS_PATH);
    const initialLength = faqs.length;
    faqs = faqs.filter(f => f.id !== id);

    if (faqs.length === initialLength) {
      return res.status(404).json({ error: 'FAQ not found.' });
    }

    await writeJson(FAQS_PATH, faqs);
    res.json({ message: 'FAQ deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete FAQ.' });
  }
});

// 5. Chat Query Matching Engine
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message query must be a valid string.' });
    }

    const faqs = await readJson(FAQS_PATH);
    const queryTokens = tokenize(message);

    if (queryTokens.length === 0) {
      return res.json({
        matched: false,
        faq: null,
        confidence: 0,
        fallbackMessage: "Please ask a specific question. For example, 'How do I apply for annual leave?'"
      });
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const faq of faqs) {
      const questionTokens = tokenize(faq.question);
      const tagTokens = faq.tags.flatMap(tag => tokenize(tag));

      let totalTokenScore = 0;

      for (const qTok of queryTokens) {
        // Find best match in tags
        let maxTagSim = 0;
        for (const tTok of tagTokens) {
          maxTagSim = Math.max(maxTagSim, tokenSimilarity(qTok, tTok));
        }

        // Find best match in question text
        let maxQuesSim = 0;
        for (const qTextTok of questionTokens) {
          maxQuesSim = Math.max(maxQuesSim, tokenSimilarity(qTok, qTextTok));
        }

        // Combine scores for this query token: tags weighted 65%, question weighted 35%
        const tokenScore = Math.max(maxTagSim, maxQuesSim);
        totalTokenScore += tokenScore;
      }

      // Average score over query tokens
      const normalizedScore = totalTokenScore / queryTokens.length;

      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = faq;
      }
    }

    const threshold = 0.35; // Confidence threshold
    const matched = bestScore >= threshold;

    // Log the interaction
    const logs = await readJson(LOGS_PATH);
    logs.push({
      timestamp: new Date().toISOString(),
      query: message,
      matchedFaqId: matched ? bestMatch.id : null,
      score: Number(bestScore.toFixed(3)),
      isSuccess: matched
    });
    await writeJson(LOGS_PATH, logs);

    if (matched) {
      res.json({
        matched: true,
        faq: bestMatch,
        confidence: Number(bestScore.toFixed(3)),
        fallbackMessage: ''
      });
    } else {
      res.json({
        matched: false,
        faq: null,
        confidence: Number(bestScore.toFixed(3)),
        fallbackMessage: "I'm sorry, I couldn't find an exact policy match for your query. I've logged this for the HR team to look into, or you can try rephrasing your question."
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Chat matching engine error.' });
  }
});

// 6. Submit feedback (Thumbs up/down)
app.post('/api/feedback', async (req, res) => {
  try {
    const { faqId, query, rating, comment } = req.body;
    if (!rating || (rating !== 'up' && rating !== 'down')) {
      return res.status(400).json({ error: 'Rating must be either "up" or "down".' });
    }

    // Save feedback
    const feedbacks = await readJson(FEEDBACK_PATH);
    const newFeedback = {
      id: `fb_${Date.now()}`,
      timestamp: new Date().toISOString(),
      faqId: faqId || null,
      query: query || '',
      rating,
      comment: comment || ''
    };
    feedbacks.push(newFeedback);
    await writeJson(FEEDBACK_PATH, feedbacks);

    // Update FAQ counter if faqId was provided
    if (faqId) {
      const faqs = await readJson(FAQS_PATH);
      const faqIndex = faqs.findIndex(f => f.id === faqId);
      if (faqIndex !== -1) {
        if (rating === 'up') {
          faqs[faqIndex].usefulCount = (faqs[faqIndex].usefulCount || 0) + 1;
        } else {
          faqs[faqIndex].notUsefulCount = (faqs[faqIndex].notUsefulCount || 0) + 1;
        }
        await writeJson(FAQS_PATH, faqs);
      }
    }

    res.json({ success: true, feedback: newFeedback });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save feedback.' });
  }
});

// 7. Get Analytics (HR Admin Dashboard)
app.get('/api/analytics', async (req, res) => {
  try {
    const logs = await readJson(LOGS_PATH);
    const feedbacks = await readJson(FEEDBACK_PATH);
    const faqs = await readJson(FAQS_PATH);

    const totalQueries = logs.length;
    const successfulQueries = logs.filter(l => l.isSuccess).length;
    const successRate = totalQueries > 0 ? Number(((successfulQueries / totalQueries) * 100).toFixed(1)) : 100;

    // Category distribution
    const categoryStats = {};
    for (const log of logs) {
      if (log.isSuccess && log.matchedFaqId) {
        const faq = faqs.find(f => f.id === log.matchedFaqId);
        if (faq) {
          categoryStats[faq.category] = (categoryStats[faq.category] || 0) + 1;
        }
      }
    }

    // Unanswered / Missed queries group by query text
    const missedMap = {};
    logs.filter(l => !l.isSuccess).forEach(l => {
      const cleanQ = l.query.trim().toLowerCase();
      missedMap[cleanQ] = (missedMap[cleanQ] || 0) + 1;
    });

    const missedQueries = Object.keys(missedMap)
      .map(q => ({ query: q, count: missedMap[q] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 missed queries

    // Recent feedbacks
    const recentFeedback = feedbacks
      .map(f => {
        const faq = faqs.find(faqItem => faqItem.id === f.faqId);
        return {
          ...f,
          faqQuestion: faq ? faq.question : 'Unknown/General query'
        };
      })
      .reverse()
      .slice(0, 10); // Last 10 feedback entries

    res.json({
      totalQueries,
      successRate,
      categoryStats,
      missedQueries,
      recentFeedback
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate analytics.' });
  }
});

// Serve static assets in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
