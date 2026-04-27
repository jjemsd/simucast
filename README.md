# Axion — AI-powered data analysis

SPSS-style analysis tool with AI assistance, modeling, and what-if simulation.

## Stack

- **Backend**: Flask + SQLAlchemy + pandas + scipy + scikit-learn
- **Frontend**: React + Vite + Chart.js (via react-chartjs-2)
- **Database**: PostgreSQL (JSONB for dataset storage)
- **Deployment**: Render.com (blueprint included)

## Project layout

```
axion/
├── backend/
│   ├── app.py            # all Flask routes + SQLAlchemy models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── api.js        # fetch wrapper
│   │   ├── styles.css
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       ├── DataPage.jsx
│   │       ├── DataGridModal.jsx   # SPSS-style Data View / Variable View
│   │       ├── CleanPage.jsx
│   │       ├── DescribePage.jsx
│   │       ├── TestsPage.jsx
│   │       ├── AdvancedPage.jsx
│   │       ├── ModelsPage.jsx
│   │       ├── WhatIfPage.jsx
│   │       └── ReportPage.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
└── render.yaml           # Render blueprint
```

## Local development

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# local dev uses SQLite; set DATABASE_URL for postgres
python app.py
```
Runs on `http://localhost:5000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`, proxying `/api` to the backend.

## Deploy to Render (manual)

Provision three resources in the Render dashboard. Pick a region first and use the same one for all three.

### 1. Postgres database

- **New → PostgreSQL**
- Name: `simu-cast-db` · Database: `simucast` · User: `simucast` · Plan: Free
- Click **Create**. Wait until status is **Available**.
- Open the DB → **Connect** tab → copy the **Internal Database URL** (starts with `postgres://...internal...`). You'll need it for the API.

### 2. API web service (Flask)

- **New → Web Service** → connect this GitHub repo, pick the branch you want to deploy.
- **Name**: `simu-cast-api`
- **Region**: same as the DB
- **Root Directory**: `backend`
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
- **Plan**: Free
- **Environment** (Advanced → Add Environment Variable):
  - `DATABASE_URL` = paste the Internal Database URL from step 1
  - `PYTHON_VERSION` = `3.11`
  - `CORS_ORIGINS` = `*` for now (we'll lock it down after step 3)
- Click **Create Web Service**. The first deploy will take 3–5 minutes; the app retries DB connections at startup and lazily creates tables on the first request, so it'll come up cleanly even if the DB is still warming.

When the build finishes, note the public URL — something like `https://simu-cast-api.onrender.com`. You'll need it next.

### 3. Frontend static site (React)

- **New → Static Site** → same repo, same branch.
- **Name**: `simu-cast-web`
- **Build Command**: `cd frontend && npm install && npm run build`
- **Publish Directory**: `frontend/dist`
- **Environment**:
  - `VITE_API_URL` = the API URL from step 2 (e.g. `https://simu-cast-api.onrender.com`)
- **Redirects/Rewrites** (under the service settings after creation): add one rule
  - **Source**: `/*` · **Destination**: `/index.html` · **Action**: Rewrite
  - This is required for client-side routing (`/projects/abc` → loads `index.html` then React Router takes over).
- Click **Create Static Site**.

### 4. Lock down CORS

Once the static site is live, copy its URL (e.g. `https://simu-cast-web.onrender.com`). Then on `simu-cast-api` → **Environment**, change `CORS_ORIGINS` from `*` to that URL. Save → the API redeploys automatically.

### 5. Verify

- `https://simu-cast-api.onrender.com/api/health` should return `{"status": "ok", "db_ready": true, ...}`
- Open `https://simu-cast-web.onrender.com`, upload a CSV, click into the project. Network requests should hit the API URL above with no CORS errors in the console.

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/datasets/upload` | Upload CSV or Excel |
| GET | `/api/datasets` | List datasets |
| GET | `/api/datasets/<id>` | Dataset + variables |
| GET | `/api/datasets/<id>/rows?page=&page_size=` | Paginated rows |
| PATCH | `/api/datasets/<id>/variables/<name>` | Update dtype |
| GET | `/api/datasets/<id>/clean/suggestions` | AI-flagged issues |
| POST | `/api/datasets/<id>/clean/apply` | Apply a fix |
| POST | `/api/datasets/<id>/describe` | Descriptives + histogram |
| POST | `/api/datasets/<id>/test` | t-test / ANOVA / chi-square / correlation |
| POST | `/api/datasets/<id>/advanced/cluster` | K-means with PCA projection |
| POST | `/api/datasets/<id>/advanced/pca` | PCA |
| POST | `/api/datasets/<id>/models/train` | Train model |
| GET | `/api/datasets/<id>/models` | List models |
| GET | `/api/models/<mid>` | Model + what-if feature metadata |
| POST | `/api/models/<mid>/predict` | What-if live prediction |
| POST | `/api/datasets/<id>/ai/suggest` | AI next-step suggestions |
| POST | `/api/datasets/<id>/report` | Assemble report |

## Where the Excel/SPSS UI lives

Four places benefit from the Excel/SPSS feel — it's not just a data viewer, it's a design pattern that makes the whole product feel professional:

1. **Data grid modal** (`DataGridModal.jsx`) — the "View data grid" button on the Data page opens a full-screen modal that mirrors SPSS exactly: a **Data View** tab with the paginated grid (sticky row numbers, sticky header with dtype badges, monospace cells, missing values highlighted red) and a **Variable View** tab showing column metadata.
2. **Descriptive stats output** (`DescribePage.jsx`) — numeric and categorical summaries rendered as SPSS-style output tables with every statistic as a column, identical to how SPSS's Output Viewer presents `DESCRIPTIVES` results.
3. **Correlation matrix** (`TestsPage.jsx` → correlation) — heatmap-styled matrix with stronger correlations shaded, matching SPSS's `CORRELATIONS` output.
4. **Contingency table / crosstab** (Chi-square result) — could be extended to show the full crosstab with row/column/expected counts like SPSS's `CROSSTABS`.

## Things to extend in production

- **AI analyst**: the current `ai/suggest` endpoint is rule-based. Swap in a Claude API call for real intent understanding and analysis planning.
- **Dataset storage**: rows are stored in a JSONB column, which is fine up to ~100k rows. For larger datasets, move to Parquet on S3 / Render Disk.
- **Auth**: no auth yet. Add Flask-Login or JWT before going public.
- **Report export**: the current export is JSON + browser Print-to-PDF. For polished PDFs, use WeasyPrint (Python) or puppeteer.
- **Chart.js**: already imported per-component. For perf on huge datasets, downsample server-side.
- **What-if**: only linear/logistic models expose coefficients for live prediction. Add a `/models/<id>/predict` that runs the actual model (tree-based) server-side for RF/GBM support.
