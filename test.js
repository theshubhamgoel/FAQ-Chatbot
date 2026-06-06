import assert from 'assert';

// We inline the matching algorithm's key helper functions to unit test their accuracy directly.
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
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

function matchQuery(message, faqs) {
  const queryTokens = tokenize(message);
  if (queryTokens.length === 0) return { matched: false, faq: null, score: 0 };

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
  return {
    matched: bestScore >= threshold,
    faq: bestScore >= threshold ? bestMatch : null,
    score: bestScore
  };
}

// ----------------------------------------------------
// TEST CASE EXECUTION
// ----------------------------------------------------

const mockFaqs = [
  {
    id: "faq_001",
    category: "Leaves",
    question: "How do I apply for annual leave?",
    tags: ["annual leave", "vacation", "time off", "apply leave", "holidays"]
  },
  {
    id: "faq_002",
    category: "Payroll",
    question: "When is salary paid each month?",
    tags: ["salary date", "payday", "paycheck", "credited", "payroll cycle"]
  },
  {
    id: "faq_003",
    category: "Workplace",
    question: "What is the remote work policy?",
    tags: ["remote work", "work from home", "wfh", "hybrid model"]
  }
];

console.log("🚀 Starting Search Matching Engine Unit Tests...\n");

// Test 1: Exact matches
console.log("Running Test 1: Exact Match verification...");
const res1 = matchQuery("How do I apply for annual leave?", mockFaqs);
assert.strictEqual(res1.matched, true);
assert.strictEqual(res1.faq.id, "faq_001");
console.log("✅ Test 1 Passed!");

// Test 2: Stopword elimination
console.log("\nRunning Test 2: Stopword elimination...");
const res2 = matchQuery("apply for leave", mockFaqs);
assert.strictEqual(res2.matched, true);
assert.strictEqual(res2.faq.id, "faq_001");
console.log("✅ Test 2 Passed!");

// Test 3: Tag-based match (WFH abbreviation)
console.log("\nRunning Test 3: Tag abbreviation (WFH)...");
const res3 = matchQuery("wfh policy rules", mockFaqs);
assert.strictEqual(res3.matched, true);
assert.strictEqual(res3.faq.id, "faq_003");
console.log("✅ Test 3 Passed!");

// Test 4: Typo-tolerance
console.log("\nRunning Test 4: Typo-tolerance (salry)...");
const res4 = matchQuery("when is my salry paid?", mockFaqs);
assert.strictEqual(res4.matched, true);
assert.strictEqual(res4.faq.id, "faq_002");
console.log("✅ Test 4 Passed!");

// Test 5: Fallback threshold mismatch
console.log("\nRunning Test 5: Irrelevant query fallback check...");
const res5 = matchQuery("where is the nearest coffee shop?", mockFaqs);
assert.strictEqual(res5.matched, false);
assert.strictEqual(res5.faq, null);
console.log("✅ Test 5 Passed!");

console.log("\n🎉 All 5 Search Matching Engine tests passed successfully!");
