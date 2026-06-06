# HR FAQ Chatbot System Specification

This document defines the functional and technical specifications for the HR FAQ Chatbot system.

---

## 1. System Overview
The HR FAQ Chatbot system is designed to automate answers to common employee questions regarding company policies, leave procedures, benefits, and IT support. It provides:
1. An **Employee Chat Interface**: A modern, interactive chat experience with quick FAQ suggestion chips, voice support, and answer feedback loops.
2. An **HR Admin Dashboard**: An analytics and management portal to manage the FAQ knowledge base and monitor chatbot performance, user feedback, and unanswered queries.

---

## 2. Technical Stack
- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables, CSS Grid/Flexbox, Glassmorphism, Keyframe animations), ES6+ JavaScript.
- **Build Tool**: Vite (for local development, bundling, and hot module replacement).
- **Backend**: Node.js with Express.
- **Storage**: JSON-based local database files (`faqs.json`, `logs.json`, `feedback.json`).

---

## 3. Data Schemas

### 3.1 FAQ Schema (`faqs.json`)
Stores the knowledge base queries.
```json
[
  {
    "id": "faq_001",
    "category": "leaves",
    "question": "How do I apply for annual leave?",
    "answer": "You can apply for annual leave via the HR portal (Workday) under 'Time Off'. Ensure you submit the request at least 2 weeks in advance and align with your manager.",
    "tags": ["annual leave", "vacation", "time off", "apply leave", "holidays"],
    "usefulCount": 0,
    "notUsefulCount": 0
  }
]
```

### 3.2 Query Logs Schema (`logs.json`)
Tracks every chatbot query to discover what employees are asking and identify unanswered questions.
```json
[
  {
    "timestamp": "2026-06-06T12:00:00.000Z",
    "query": "how to claim medical insurance?",
    "matchedFaqId": "faq_003",
    "score": 0.85,
    "isSuccess": true
  }
]
```

### 3.3 Feedback Schema (`feedback.json`)
Stores ratings and detailed user feedback for chatbot answers.
```json
[
  {
    "id": "fb_001",
    "timestamp": "2026-06-06T12:05:00.000Z",
    "faqId": "faq_003",
    "query": "how to claim medical insurance?",
    "rating": "down",
    "comment": "The link provided to the claim portal was broken."
  }
]
```

---

## 4. API Endpoints

### 4.1 FAQ CRUD Operations (HR Admin)
- **`GET /api/faqs`**
  - Returns the list of all FAQs.
- **`POST /api/faqs`**
  - Payload: `{ category, question, answer, tags }`
  - Returns the newly created FAQ with generated ID.
- **`PUT /api/faqs/:id`**
  - Payload: `{ category, question, answer, tags }`
  - Updates the specific FAQ and returns the modified object.
- **`DELETE /api/faqs/:id`**
  - Deletes the FAQ from the database.

### 4.2 Chat and Feedback Operations
- **`POST /api/chat`**
  - Payload: `{ message: string }`
  - Action: Runs the query matching algorithm. If a match is found (score above threshold), it returns the FAQ object. If no match is found, it returns a default "unresolved" response. It logs the query to `logs.json`.
  - Response: `{ matched: boolean, faq: FAQObject | null, confidence: number, fallbackMessage: string }`
- **`POST /api/feedback`**
  - Payload: `{ faqId: string | null, query: string, rating: 'up' | 'down', comment: string }`
  - Action: Saves user feedback in `feedback.json` and updates the FAQ's helpfulness count in `faqs.json`.
  - Response: `{ success: true }`

### 4.3 Analytics Operations (HR Admin)
- **`GET /api/analytics`**
  - Action: Aggregates logs and feedback.
  - Response:
    ```json
    {
      "totalQueries": 150,
      "successRate": 82.5,
      "categoryStats": { "leaves": 50, "benefits": 40, "payroll": 30, "it": 30 },
      "missedQueries": [
        { "query": "what is paternity leave allowance?", "count": 5 }
      ],
      "recentFeedback": [
        { "rating": "down", "comment": "Confusing guidance on tax declarations", "timestamp": "2026-06-06T11:00:00Z" }
      ]
    }
    ```

---

## 5. Search Matching Algorithm
The search matching engine uses a lightweight, client/server-side NLP processing pipe:
1. **Normalization**: Lowercases inputs, strips punctuation, splits queries into individual word tokens.
2. **Stopword Removal**: Eliminates common grammatical fillers (e.g., "how", "do", "i", "the", "a").
3. **Synonym/Tag Matching**: Matches search tokens against the `tags` and `question` strings of each FAQ.
4. **Fuzzy Scoring**: Calculates score based on:
   - Percentage of query tokens that exist in the FAQ's tags (high weight, e.g., 60%).
   - Word overlaps in the question title (medium weight, e.g., 40%).
   - Word stem/substring similarities.
5. **Thresholding**:
   - `Score >= 0.4` -> Successful match.
   - `Score < 0.4` -> Unresolved (fallback to "I couldn't find an exact answer for that...").

---

## 6. UI/UX Design Specifications
- **Theme**: Premium modern corporate dark theme with HSL-tailored accent hues (indigo blue, deep violet, emerald green for highlights).
- **Glassmorphism Styling**: Backdrop filters on modals, tables, and sidebars (`backdrop-filter: blur(16px)` with a very subtle overlay `rgba(15, 23, 42, 0.65)`).
- **Micro-Animations**:
  - Typing indicator bouncing dots.
  - Chat bubbles slide-up with fade-in.
  - Hover effects on cards, navigation tabs, and suggestion chips.
- **Admin Panel View**:
  - Split sidebar layout.
  - CSS/HTML progress bars representing query success rates.
  - Dynamic table with edit/delete actions.
  - Input forms with instant validation feedbacks.
