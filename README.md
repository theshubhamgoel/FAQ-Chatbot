# HR.ai - Intelligent FAQ Chatbot System

A premium, interactive FAQ Chatbot and Administration Dashboard designed for HR departments. The system enables employees to resolve questions regarding leaves, benefits, payroll, and IT support instantly, while providing HR teams with analytics, unanswered query logs, and FAQ management controls.

👉 **Live Demo on GitHub Pages**: [https://theshubhamgoel.github.io/FAQ-Chatbot/](https://theshubhamgoel.github.io/FAQ-Chatbot/)

---

## 🚀 Key Features

* **Premium UI/UX**: Dark-glassmorphism theme with smooth layout animations and responsive mobile-first views.
* **Smart Search Matching**: Uses custom token overlap calculations with **Levenshtein spelling-typo correction** to match natural query variations.
* **Dual-Mode Operation**: Runs with a local Node/Express backend OR falls back to a static browser-based standalone model powered by `localStorage`.
* **Voice & Accessibility**: Equipped with microphone input (Web Speech-to-Text) and audio readouts (Web Text-to-Speech).
* **HR Admin Portal**:
  * **Analytics Dashboard**: Query logs, matching success rates, category statistics, and helpfulness ratios.
  * **FAQ Knowledge Base**: CRUD grid to add, edit, or delete policies.
  * **Unanswered Log Grid**: Tracks queries that failed to resolve, allowing administrators to map them into new FAQs in one click.
  * **Employee Feedback Feed**: Lists thumbs up/down votes and detailed suggestions left by users.

---

## 🛠️ System Architecture: How it runs on GitHub Pages

Because GitHub Pages only supports static file hosting and cannot execute server-side Node.js/Express processes, the application uses a **Dual-Mode Client API Handler**:

```
                  ┌──────────────────────────────┐
                  │      Employee & HR View      │
                  └──────────────┬───────────────┘
                                 │
                         [ api.js Router ]
                                 │
                     Host = github.io? / Offline?
                                 ├───► [ YES ] ──► Client-side Standalone Mode
                                 │                 • Seeks seed data via fetch
                                 │                 • Matches queries in browser JS
                                 │                 • Stores FAQ, logs & feedback in localStorage
                                 │
                                 └───► [ NO  ] ──► Node.js Express Server Mode
                                                   • Contacts server endpoints (/api/*)
                                                   • Matches queries on server thread
                                                   • Stores data in local JSON files
```

### Static Standalone Mode (GitHub Pages)
1. **Database Simulation**: On initial page load, the client checks if `localStorage` contains FAQs. If empty, it fetches the static copy of the seed database (`database/faqs.json`) bundled by Vite.
2. **Persistence**: All CRUD additions, query logs, feedback ratings, and user comments are written directly to the browser's **`localStorage`**.
3. **Local NLP Matcher**: When a query is sent, the tokenizer, stopword filters, and Levenshtein similarity algorithm execute directly inside the browser using client-side JavaScript.

---

## 🧠 NLP Search Matching Engine
The system uses a custom-tuned text similarity pipeline:
1. **Normalization**: Trims and lowercases queries, removing punctuation.
2. **Stopwords Filtering**: Filters out grammatical fillers (e.g., "how", "do", "i", "the", "a") to focus on high-signal keywords.
3. **Typo Tolerance**: Calculates **Levenshtein distance** between query tokens and database tags. If a typo matches an FAQ keyword with $\ge 75\%$ similarity, it resolves.
4. **Disjunction Max Scoring**: Scores queries using the maximum overlap of query tokens across fields (`Math.max(tagSimilarity, questionSimilarity)`). This prevents matching penalties when query words are present in one field (e.g. tags) but absent in another (e.g. question text).
5. **Thresholding**: Queries scoring below `0.35` are routed to the fallback handler, logged as "missed," and flagged for the HR team.

---

## 📂 Project Directory Structure

```text
FAQ-ChatBot/
├── .github/workflows/
│   └── deploy.yml          # CI/CD deployment pipeline for GitHub Pages
├── database/               # Server-mode persistent JSON files
│   ├── faqs.json           # Seed HR policies
│   ├── logs.json           # Chat log history
│   └── feedback.json       # User comments and votes
├── src/                    # Frontend source code
│   ├── index.html          # Main HTML layout
│   ├── index.css           # Styling variables, components, glassmorphism CSS
│   ├── app.js              # Application entry point and view router
│   ├── components/
│   │   ├── api.js          # API client (Dual server + static fallback wrapper)
│   │   ├── chatbot.js      # Chat logic, speech triggers, suggestion chips
│   │   └── admin.js        # Admin analytics, FAQ table manager (CRUD)
│   └── public/             # Static public assets directory
│       └── database/
│           └── faqs.json   # Seed copy for standalone client fallback
├── server.js               # Node Express server and backend NLP matching code
├── test.js                 # Test suite verifying matcher accuracy
├── vite.config.js          # Vite configuration
└── package.json            # NPM script configurations and dependencies
```

---

## 💻 Running Locally

### Prerequisites
* [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Environment
```bash
npm run dev
```
This launches both:
* **Backend Express Server**: `http://localhost:3000`
* **Vite Frontend Server**: `http://localhost:5173/`

### 3. Run Matching Engine Tests
```bash
npm run test
```

---

## 🌐 Deploying to GitHub Pages

### Method A: One-Click Terminal Publish (Recommended)
You can compile and deploy the static standalone version directly from your console:
```bash
npm run deploy
```
*Note: Make sure your local folder is initialized with git and linked to your remote repository: `git remote add origin git@github.com:theshubhamgoel/FAQ-Chatbot.git`.*

### Method B: Push-to-Deploy CI/CD (GitHub Actions)
Whenever you push code to the `main` or `master` branches, the included GitHub Actions workflow will trigger:
1. Stage, commit, and push your changes:
   ```bash
   git add .
   git commit -m "Commit message"
   git push origin main
   ```
2. Enable permissions for the build runner:
   * Go to your repository on GitHub -> **Settings** -> **Actions** -> **General**.
   * Under **Workflow permissions**, select **Read and write permissions** and click **Save**.
3. The runner will test, build, and publish the compiled static site to the `gh-pages` branch.
