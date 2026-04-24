"""
Axion — data analysis backend
Flask + SQLAlchemy + pandas + scipy + scikit-learn
"""
import os
import io
import json
import uuid
from datetime import datetime

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects.postgresql import JSONB

from scipy import stats
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, roc_auc_score, precision_score, recall_score,
    f1_score, confusion_matrix, mean_squared_error, r2_score
)

# --- app + db setup ---
app = Flask(__name__)
CORS(app, origins=os.environ.get("CORS_ORIGINS", "*").split(","))

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///axion.db"  # fallback for local dev
)
# Render gives postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# --- models ---
# Use Text instead of JSONB for SQLite compatibility; Postgres auto-handles both
def _json_col():
    if "postgresql" in DATABASE_URL:
        return Column(JSONB, nullable=True)
    return Column(Text, nullable=True)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    filename = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    variables = _json_col()      # [{name, dtype, role, missing}]
    data = _json_col()           # [{col: val, ...}, ...] (for small datasets)

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False)
    kind = Column(String)         # 'describe', 't_test', 'anova', etc.
    config = _json_col()
    result = _json_col()
    created_at = Column(DateTime, default=datetime.utcnow)

class Model(Base):
    __tablename__ = "models"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False)
    name = Column(String)
    algorithm = Column(String)
    target = Column(String)
    features = _json_col()
    metrics = _json_col()
    feature_importance = _json_col()
    coefficients = _json_col()    # for what-if predictions
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(engine)

# --- helpers ---
def db():
    return SessionLocal()

def jload(v):
    """Safely load a JSON column value (dict, list, str, or None)."""
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    try:
        return json.loads(v)
    except Exception:
        return None

def jdump(v):
    """Dump a value to a JSON-compatible form for storage."""
    if "postgresql" in DATABASE_URL:
        return v  # JSONB handles dicts/lists natively
    return json.dumps(v, default=str)

def df_from_dataset(ds):
    """Rehydrate a pandas DataFrame from a Dataset row."""
    rows = jload(ds.data) or []
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)

def infer_variables(df):
    """Produce variable metadata: name, dtype, role, missing."""
    out = []
    for col in df.columns:
        series = df[col]
        missing = int(series.isna().sum())
        unique = series.nunique(dropna=True)
        # type inference
        if pd.api.types.is_numeric_dtype(series):
            if unique <= 2:
                dtype = "binary"
            else:
                dtype = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            dtype = "datetime"
        else:
            # try to detect dates stored as strings
            try:
                pd.to_datetime(series.dropna().head(20), errors="raise")
                dtype = "datetime"
            except Exception:
                dtype = "category" if unique <= 20 else "text"
        # role heuristic
        name_lower = col.lower()
        role = "feature"
        if name_lower.endswith("_id") or name_lower == "id":
            role = "ignore"
        out.append({
            "name": col,
            "dtype": dtype,
            "role": role,
            "missing": missing,
            "unique": int(unique),
        })
    return out

def numeric_df(df, cols=None):
    """Select numeric columns (optionally filtered), drop non-numeric."""
    if cols:
        df = df[cols]
    return df.select_dtypes(include=[np.number])

def clean_json(obj):
    """Convert numpy/pandas types to JSON-safe primitives."""
    if isinstance(obj, dict):
        return {str(k): clean_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_json(x) for x in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return None if np.isnan(obj) else float(obj)
    if isinstance(obj, (np.ndarray,)):
        return clean_json(obj.tolist())
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    if pd.isna(obj) if np.isscalar(obj) else False:
        return None
    return obj

# ========================================================================
#  Routes
# ========================================================================

@app.route("/api/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

# --- Datasets ---

@app.route("/api/datasets", methods=["GET"])
def list_datasets():
    s = db()
    try:
        rows = s.query(Dataset).order_by(Dataset.created_at.desc()).all()
        return jsonify([{
            "id": r.id,
            "name": r.name,
            "filename": r.filename,
            "row_count": r.row_count,
            "col_count": r.col_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows])
    finally:
        s.close()

@app.route("/api/datasets/upload", methods=["POST"])
def upload_dataset():
    """Accepts a CSV or Excel file and stores it as a Dataset."""
    if "file" not in request.files:
        return {"error": "no file"}, 400
    f = request.files["file"]
    name = request.form.get("name") or f.filename

    # read the file
    try:
        if f.filename.lower().endswith(".csv"):
            df = pd.read_csv(f)
        elif f.filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(f)
        else:
            return {"error": "unsupported file type"}, 400
    except Exception as e:
        return {"error": f"failed to parse: {e}"}, 400

    variables = infer_variables(df)
    records = df.where(pd.notnull(df), None).to_dict(orient="records")

    ds_id = str(uuid.uuid4())
    s = db()
    try:
        ds = Dataset(
            id=ds_id,
            name=name,
            filename=f.filename,
            row_count=len(df),
            col_count=len(df.columns),
            variables=jdump(variables),
            data=jdump(clean_json(records)),
        )
        s.add(ds)
        s.commit()
        return {
            "id": ds_id,
            "name": name,
            "row_count": len(df),
            "col_count": len(df.columns),
            "variables": variables,
        }
    finally:
        s.close()

@app.route("/api/datasets/<ds_id>", methods=["GET"])
def get_dataset(ds_id):
    """Returns dataset metadata + variables."""
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        return {
            "id": ds.id,
            "name": ds.name,
            "filename": ds.filename,
            "row_count": ds.row_count,
            "col_count": ds.col_count,
            "variables": jload(ds.variables),
            "created_at": ds.created_at.isoformat() if ds.created_at else None,
        }
    finally:
        s.close()

@app.route("/api/datasets/<ds_id>/rows", methods=["GET"])
def get_rows(ds_id):
    """Paginated row data for the Excel-like grid."""
    page = int(request.args.get("page", 1))
    page_size = min(int(request.args.get("page_size", 100)), 1000)
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        rows = jload(ds.data) or []
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "rows": rows[start:end],
            "page": page,
            "page_size": page_size,
            "total": len(rows),
        }
    finally:
        s.close()

@app.route("/api/datasets/<ds_id>/variables/<var_name>", methods=["PATCH"])
def update_variable(ds_id, var_name):
    """Update variable role (feature/target/ignore) or dtype."""
    body = request.get_json() or {}
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        variables = jload(ds.variables) or []
        for v in variables:
            if v["name"] == var_name:
                if "role" in body:
                    v["role"] = body["role"]
                if "dtype" in body:
                    v["dtype"] = body["dtype"]
                break
        ds.variables = jdump(variables)
        s.commit()
        return {"ok": True, "variables": variables}
    finally:
        s.close()

# --- Cleaning ---

@app.route("/api/datasets/<ds_id>/clean/suggestions", methods=["GET"])
def clean_suggestions(ds_id):
    """AI-style suggestions: missing, outliers, type issues, engineering."""
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        df = df_from_dataset(ds)
        suggestions = []

        # missing values
        for col in df.columns:
            miss = int(df[col].isna().sum())
            if miss > 0:
                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "kind": "missing",
                    "variable": col,
                    "count": miss,
                    "action": "impute" if pd.api.types.is_numeric_dtype(df[col]) else "mode",
                    "description": f"{miss} rows blank · impute with {'mean' if pd.api.types.is_numeric_dtype(df[col]) else 'mode'} or drop?",
                })

        # outliers (numeric columns, IQR rule)
        for col in df.select_dtypes(include=[np.number]).columns:
            series = df[col].dropna()
            if len(series) < 10:
                continue
            q1, q3 = series.quantile([0.25, 0.75])
            iqr = q3 - q1
            lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            outliers = int(((series < lo) | (series > hi)).sum())
            if outliers > 0:
                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "kind": "outliers",
                    "variable": col,
                    "count": outliers,
                    "action": "winsorize",
                    "description": f"{outliers} rows outside IQR bounds · winsorize?",
                })

        # type issues: strings that look like dates
        for col in df.select_dtypes(include=["object"]).columns:
            try:
                pd.to_datetime(df[col].dropna().head(20), errors="raise")
                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "kind": "type",
                    "variable": col,
                    "action": "convert_date",
                    "description": f"Stored as text · convert to date?",
                })
            except Exception:
                pass

        return jsonify({"suggestions": clean_json(suggestions)})
    finally:
        s.close()

@app.route("/api/datasets/<ds_id>/clean/apply", methods=["POST"])
def clean_apply(ds_id):
    """Apply a cleaning operation: impute, winsorize, convert, drop."""
    body = request.get_json() or {}
    action = body.get("action")
    variable = body.get("variable")
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        df = df_from_dataset(ds)

        if action == "impute" and variable in df.columns:
            if pd.api.types.is_numeric_dtype(df[variable]):
                df[variable] = df[variable].fillna(df[variable].mean())
            else:
                mode = df[variable].mode()
                df[variable] = df[variable].fillna(mode[0] if len(mode) else "")
        elif action == "mode" and variable in df.columns:
            mode = df[variable].mode()
            df[variable] = df[variable].fillna(mode[0] if len(mode) else "")
        elif action == "winsorize" and variable in df.columns:
            q1, q3 = df[variable].quantile([0.25, 0.75])
            iqr = q3 - q1
            lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            df[variable] = df[variable].clip(lower=lo, upper=hi)
        elif action == "convert_date" and variable in df.columns:
            df[variable] = pd.to_datetime(df[variable], errors="coerce").astype(str)
        elif action == "drop_rows" and variable in df.columns:
            df = df.dropna(subset=[variable])
        elif action == "expand":
            # simple feature engineering: new column = numerator / denominator
            num = body.get("numerator")
            den = body.get("denominator")
            new_name = body.get("new_name") or f"{num}_per_{den}"
            if num in df.columns and den in df.columns:
                df[new_name] = df[num] / df[den].replace(0, np.nan)
        else:
            return {"error": "unknown action or bad variable"}, 400

        # persist
        records = df.where(pd.notnull(df), None).to_dict(orient="records")
        ds.data = jdump(clean_json(records))
        ds.variables = jdump(infer_variables(df))
        ds.row_count = len(df)
        ds.col_count = len(df.columns)
        s.commit()
        return {"ok": True, "row_count": ds.row_count, "col_count": ds.col_count}
    finally:
        s.close()

# --- Descriptive stats ---

@app.route("/api/datasets/<ds_id>/describe", methods=["POST"])
def describe(ds_id):
    body = request.get_json() or {}
    cols = body.get("variables") or []
    group_by = body.get("group_by")
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        df = df_from_dataset(ds)
        if not cols:
            cols = df.select_dtypes(include=[np.number]).columns.tolist()

        out = []
        for col in cols:
            if col not in df.columns:
                continue
            series = df[col]
            if pd.api.types.is_numeric_dtype(series):
                s_clean = series.dropna()
                out.append({
                    "variable": col,
                    "kind": "numeric",
                    "n": int(s_clean.count()),
                    "mean": float(s_clean.mean()) if len(s_clean) else None,
                    "std": float(s_clean.std()) if len(s_clean) > 1 else None,
                    "min": float(s_clean.min()) if len(s_clean) else None,
                    "q1": float(s_clean.quantile(0.25)) if len(s_clean) else None,
                    "median": float(s_clean.median()) if len(s_clean) else None,
                    "q3": float(s_clean.quantile(0.75)) if len(s_clean) else None,
                    "max": float(s_clean.max()) if len(s_clean) else None,
                    "skew": float(s_clean.skew()) if len(s_clean) > 2 else None,
                    "kurtosis": float(s_clean.kurtosis()) if len(s_clean) > 3 else None,
                })
            else:
                vc = series.value_counts(dropna=True).head(20)
                out.append({
                    "variable": col,
                    "kind": "categorical",
                    "n": int(series.count()),
                    "unique": int(series.nunique()),
                    "top": str(vc.index[0]) if len(vc) else None,
                    "freq": int(vc.iloc[0]) if len(vc) else None,
                    "value_counts": {str(k): int(v) for k, v in vc.items()},
                })

        # histogram data for the first numeric column, for charting
        histogram = None
        num_cols = [c for c in cols if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
        if num_cols:
            first = num_cols[0]
            s_clean = df[first].dropna()
            counts, bin_edges = np.histogram(s_clean, bins=12)
            histogram = {
                "variable": first,
                "counts": counts.tolist(),
                "bins": bin_edges.tolist(),
            }

        result = {"stats": out, "histogram": histogram}
        _save_analysis(s, ds_id, "describe", body, result)
        return jsonify(clean_json(result))
    finally:
        s.close()

# --- Hypothesis tests ---

@app.route("/api/datasets/<ds_id>/test", methods=["POST"])
def run_test(ds_id):
    body = request.get_json() or {}
    kind = body.get("kind")  # 't', 'anova', 'chi', 'corr'
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        df = df_from_dataset(ds)
        result = {}

        if kind == "t":
            group = body["group"]
            measure = body["measure"]
            groups = df[group].dropna().unique()
            if len(groups) != 2:
                return {"error": "t-test needs exactly 2 groups"}, 400
            g1 = df[df[group] == groups[0]][measure].dropna()
            g2 = df[df[group] == groups[1]][measure].dropna()
            t, p = stats.ttest_ind(g1, g2, equal_var=False)
            pooled_std = np.sqrt((g1.var() + g2.var()) / 2)
            d = (g1.mean() - g2.mean()) / pooled_std if pooled_std else 0
            result = {
                "t": float(t), "p": float(p),
                "df": int(len(g1) + len(g2) - 2),
                "cohens_d": float(d),
                "mean_group_1": float(g1.mean()),
                "mean_group_2": float(g2.mean()),
                "group_labels": [str(groups[0]), str(groups[1])],
                "significant": bool(p < 0.05),
                "interpretation": _t_interpret(t, p, g1.mean(), g2.mean(), d, group, measure),
            }
        elif kind == "anova":
            group = body["group"]
            measure = body["measure"]
            samples = [df[df[group] == g][measure].dropna() for g in df[group].dropna().unique()]
            f, p = stats.f_oneway(*samples)
            result = {
                "f": float(f), "p": float(p),
                "groups": len(samples),
                "significant": bool(p < 0.05),
                "interpretation": _anova_interpret(f, p, len(samples), measure, group),
            }
        elif kind == "chi":
            var_a = body["var_a"]
            var_b = body["var_b"]
            ct = pd.crosstab(df[var_a], df[var_b])
            chi2, p, dof, _ = stats.chi2_contingency(ct)
            result = {
                "chi2": float(chi2), "p": float(p), "df": int(dof),
                "contingency": {str(i): {str(c): int(ct.loc[i, c]) for c in ct.columns} for i in ct.index},
                "significant": bool(p < 0.05),
                "interpretation": _chi_interpret(chi2, p, var_a, var_b),
            }
        elif kind == "corr":
            cols = body.get("variables") or df.select_dtypes(include=[np.number]).columns.tolist()
            corr = df[cols].corr().round(3)
            result = {
                "variables": cols,
                "matrix": corr.where(pd.notnull(corr), None).to_dict(),
            }
        else:
            return {"error": "unknown test kind"}, 400

        _save_analysis(s, ds_id, f"test_{kind}", body, result)
        return jsonify(clean_json(result))
    finally:
        s.close()

def _t_interpret(t, p, m1, m2, d, group, measure):
    sig = "significantly" if p < 0.05 else "not significantly"
    effect = "large" if abs(d) >= 0.8 else "medium" if abs(d) >= 0.5 else "small"
    return f"The two {group} groups {sig} differ on {measure} (t={t:.2f}, p={p:.4f}). Means: {m1:.2f} vs {m2:.2f}. Effect size is {effect} (Cohen's d={d:.2f})."

def _anova_interpret(f, p, k, measure, group):
    sig = "significantly" if p < 0.05 else "not significantly"
    return f"Across {k} groups of {group}, {measure} {sig} differs (F={f:.2f}, p={p:.4f})."

def _chi_interpret(chi2, p, a, b):
    sig = "significant" if p < 0.05 else "no significant"
    return f"There is {sig} association between {a} and {b} (χ²={chi2:.2f}, p={p:.4f})."

# --- Advanced stats ---

@app.route("/api/datasets/<ds_id>/advanced/cluster", methods=["POST"])
def do_cluster(ds_id):
    body = request.get_json() or {}
    cols = body.get("variables") or []
    k = int(body.get("k", 4))
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        df = df_from_dataset(ds)
        X = numeric_df(df, cols).dropna()
        if len(X) == 0:
            return {"error": "no numeric data"}, 400
        Xs = StandardScaler().fit_transform(X)
        km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(Xs)
        # pca to 2d for plotting
        pca = PCA(n_components=2).fit_transform(Xs)
        result = {
            "k": k,
            "labels": km.labels_.tolist(),
            "inertia": float(km.inertia_),
            "cluster_sizes": {str(i): int((km.labels_ == i).sum()) for i in range(k)},
            "pca_points": [{"x": float(p[0]), "y": float(p[1]), "cluster": int(c)}
                           for p, c in zip(pca, km.labels_)][:500],  # cap plot points
            "variables": cols or X.columns.tolist(),
        }
        _save_analysis(s, ds_id, "cluster", body, result)
        return jsonify(clean_json(result))
    finally:
        s.close()

@app.route("/api/datasets/<ds_id>/advanced/pca", methods=["POST"])
def do_pca(ds_id):
    body = request.get_json() or {}
    cols = body.get("variables") or []
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        df = df_from_dataset(ds)
        X = numeric_df(df, cols).dropna()
        Xs = StandardScaler().fit_transform(X)
        n_comp = min(5, X.shape[1])
        pca = PCA(n_components=n_comp).fit(Xs)
        result = {
            "explained_variance": pca.explained_variance_ratio_.tolist(),
            "cumulative": np.cumsum(pca.explained_variance_ratio_).tolist(),
            "loadings": {
                col: pca.components_[:, i].tolist()
                for i, col in enumerate(X.columns)
            },
            "components": [f"PC{i+1}" for i in range(n_comp)],
        }
        _save_analysis(s, ds_id, "pca", body, result)
        return jsonify(clean_json(result))
    finally:
        s.close()

# --- Modeling ---

@app.route("/api/datasets/<ds_id>/models/train", methods=["POST"])
def train_model(ds_id):
    body = request.get_json() or {}
    target = body.get("target")
    features = body.get("features") or []
    algo = body.get("algorithm", "logistic")  # logistic | rf | gbm | linear
    test_size = float(body.get("test_size", 0.2))

    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        df = df_from_dataset(ds)
        if target not in df.columns:
            return {"error": f"target {target} not found"}, 400
        features = [f for f in features if f in df.columns]
        if not features:
            # default: all numeric non-target
            features = [c for c in df.select_dtypes(include=[np.number]).columns if c != target]

        data = df[features + [target]].dropna()
        X = data[features].copy()
        y = data[target]

        # one-hot encode categorical features
        X = pd.get_dummies(X, drop_first=True)

        # classification vs regression
        is_classification = y.nunique() <= 10 and (
            pd.api.types.is_object_dtype(y) or pd.api.types.is_integer_dtype(y) or pd.api.types.is_bool_dtype(y)
        )
        if is_classification and not pd.api.types.is_numeric_dtype(y):
            y = LabelEncoder().fit_transform(y.astype(str))

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )

        if is_classification:
            if algo == "rf":
                clf = RandomForestClassifier(n_estimators=100, random_state=42)
            elif algo == "gbm":
                clf = GradientBoostingClassifier(random_state=42)
            else:
                clf = LogisticRegression(max_iter=1000)
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)
            metrics = {
                "task": "classification",
                "accuracy": float(accuracy_score(y_test, y_pred)),
                "precision": float(precision_score(y_test, y_pred, average="weighted", zero_division=0)),
                "recall": float(recall_score(y_test, y_pred, average="weighted", zero_division=0)),
                "f1": float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
            }
            # auc only for binary
            if len(np.unique(y)) == 2 and hasattr(clf, "predict_proba"):
                try:
                    y_proba = clf.predict_proba(X_test)[:, 1]
                    metrics["auc"] = float(roc_auc_score(y_test, y_proba))
                except Exception:
                    pass
            # confusion matrix
            cm = confusion_matrix(y_test, y_pred).tolist()
            metrics["confusion_matrix"] = cm
        else:
            if algo == "rf":
                from sklearn.ensemble import RandomForestRegressor
                clf = RandomForestRegressor(n_estimators=100, random_state=42)
            elif algo == "gbm":
                from sklearn.ensemble import GradientBoostingRegressor
                clf = GradientBoostingRegressor(random_state=42)
            else:
                clf = LinearRegression()
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)
            metrics = {
                "task": "regression",
                "r2": float(r2_score(y_test, y_pred)),
                "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
                "mae": float(np.mean(np.abs(y_test - y_pred))),
            }

        # feature importance
        importance = {}
        if hasattr(clf, "feature_importances_"):
            importance = dict(zip(X.columns, clf.feature_importances_.tolist()))
        elif hasattr(clf, "coef_"):
            coef = np.asarray(clf.coef_).ravel()
            importance = dict(zip(X.columns, np.abs(coef).tolist()))
        importance = dict(sorted(importance.items(), key=lambda kv: -kv[1])[:15])

        # store coefficients for what-if (simple linear/logistic)
        coefficients = None
        if algo in ("logistic", "linear") and hasattr(clf, "coef_"):
            coef = np.asarray(clf.coef_).ravel().tolist()
            intercept = float(np.asarray(clf.intercept_).ravel()[0]) if hasattr(clf, "intercept_") else 0.0
            coefficients = {
                "features": X.columns.tolist(),
                "coef": coef,
                "intercept": intercept,
                "task": metrics["task"],
                "feature_means": {c: float(X[c].mean()) for c in X.columns},
                "feature_stds": {c: float(X[c].std() or 1) for c in X.columns},
            }

        model_id = str(uuid.uuid4())
        m = Model(
            id=model_id,
            dataset_id=ds_id,
            name=f"{algo}_{target}",
            algorithm=algo,
            target=target,
            features=jdump(features),
            metrics=jdump(clean_json(metrics)),
            feature_importance=jdump(clean_json(importance)),
            coefficients=jdump(clean_json(coefficients)) if coefficients else None,
        )
        s.add(m)
        s.commit()

        return jsonify(clean_json({
            "id": model_id,
            "algorithm": algo,
            "target": target,
            "features": features,
            "metrics": metrics,
            "feature_importance": importance,
            "has_whatif": coefficients is not None,
        }))
    finally:
        s.close()

@app.route("/api/datasets/<ds_id>/models", methods=["GET"])
def list_models(ds_id):
    s = db()
    try:
        rows = s.query(Model).filter_by(dataset_id=ds_id).order_by(Model.created_at.desc()).all()
        return jsonify([{
            "id": r.id, "name": r.name, "algorithm": r.algorithm,
            "target": r.target,
            "metrics": jload(r.metrics),
            "feature_importance": jload(r.feature_importance),
            "has_whatif": r.coefficients is not None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows])
    finally:
        s.close()

# --- What-if ---

@app.route("/api/models/<model_id>/predict", methods=["POST"])
def whatif_predict(model_id):
    """Make a live prediction from a linear/logistic model using user-supplied values."""
    body = request.get_json() or {}
    inputs = body.get("inputs", {})  # {feature_name: value}

    s = db()
    try:
        m = s.query(Model).filter_by(id=model_id).first()
        if not m:
            return {"error": "model not found"}, 404
        coef = jload(m.coefficients)
        if not coef:
            return {"error": "what-if not supported for this model"}, 400

        features = coef["features"]
        weights = coef["coef"]
        intercept = coef["intercept"]
        means = coef["feature_means"]

        # build vector — use provided values, fallback to means
        x = []
        for f in features:
            if f in inputs:
                try:
                    x.append(float(inputs[f]))
                except Exception:
                    x.append(means.get(f, 0))
            else:
                x.append(means.get(f, 0))

        z = intercept + sum(w * v for w, v in zip(weights, x))
        if coef["task"] == "classification":
            prob = 1 / (1 + np.exp(-z))
            return jsonify({
                "prediction": float(prob),
                "kind": "probability",
                "risk": "high" if prob > 0.6 else "medium" if prob > 0.35 else "low",
            })
        return jsonify({
            "prediction": float(z),
            "kind": "value",
        })
    finally:
        s.close()

@app.route("/api/models/<model_id>", methods=["GET"])
def get_model(model_id):
    s = db()
    try:
        m = s.query(Model).filter_by(id=model_id).first()
        if not m:
            return {"error": "not found"}, 404
        coef = jload(m.coefficients)
        features_info = None
        if coef:
            # give frontend sensible slider ranges: mean ± 2*std
            features_info = []
            for f in coef["features"]:
                mean = coef["feature_means"].get(f, 0)
                std = coef["feature_stds"].get(f, 1)
                features_info.append({
                    "name": f,
                    "mean": mean,
                    "std": std,
                    "min": mean - 2 * std,
                    "max": mean + 2 * std,
                })
        return jsonify({
            "id": m.id,
            "name": m.name,
            "algorithm": m.algorithm,
            "target": m.target,
            "features": jload(m.features),
            "metrics": jload(m.metrics),
            "feature_importance": jload(m.feature_importance),
            "whatif_features": features_info,
        })
    finally:
        s.close()

# --- AI assistant (simple rule-based; swap for Claude API later) ---

@app.route("/api/datasets/<ds_id>/ai/suggest", methods=["POST"])
def ai_suggest(ds_id):
    body = request.get_json() or {}
    prompt = (body.get("prompt") or "").lower()
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        variables = jload(ds.variables) or []

        # trivial intent router — replace with a real LLM call in prod
        suggestions = []
        if "churn" in prompt or "predict" in prompt or "model" in prompt:
            target = next((v["name"] for v in variables if v["dtype"] == "binary"), None)
            if target:
                suggestions.append({
                    "action": "train_model",
                    "params": {"target": target, "algorithm": "logistic"},
                    "label": f"Train a logistic regression to predict {target}",
                })
        if "compare" in prompt or "group" in prompt or "difference" in prompt:
            suggestions.append({
                "action": "t_test",
                "label": "Run an independent t-test to compare groups",
            })
        if "cluster" in prompt or "segment" in prompt:
            suggestions.append({
                "action": "cluster",
                "params": {"k": 4},
                "label": "Cluster rows into 4 segments via k-means",
            })
        if "describe" in prompt or "summary" in prompt or "overview" in prompt or not suggestions:
            suggestions.append({
                "action": "describe",
                "label": "Generate descriptive statistics for all numeric variables",
            })
        return jsonify({"suggestions": suggestions})
    finally:
        s.close()

# --- Reports ---

@app.route("/api/datasets/<ds_id>/report", methods=["POST"])
def build_report(ds_id):
    """Assemble analyses into a report JSON the frontend can render/export."""
    body = request.get_json() or {}
    sections = body.get("sections") or ["summary", "descriptives", "tests", "models"]
    s = db()
    try:
        ds = s.query(Dataset).filter_by(id=ds_id).first()
        if not ds:
            return {"error": "not found"}, 404
        analyses = s.query(Analysis).filter_by(dataset_id=ds_id).order_by(Analysis.created_at).all()
        models = s.query(Model).filter_by(dataset_id=ds_id).order_by(Model.created_at).all()

        report = {
            "title": ds.name,
            "generated_at": datetime.utcnow().isoformat(),
            "dataset": {
                "name": ds.name,
                "rows": ds.row_count,
                "columns": ds.col_count,
            },
            "sections": [],
        }
        if "summary" in sections:
            report["sections"].append({
                "title": "Executive summary",
                "body": _auto_summary(ds, analyses, models),
            })
        if "descriptives" in sections:
            des = [a for a in analyses if a.kind == "describe"]
            if des:
                report["sections"].append({
                    "title": "Descriptive statistics",
                    "data": jload(des[-1].result),
                })
        if "tests" in sections:
            tests_ = [a for a in analyses if a.kind.startswith("test_")]
            if tests_:
                report["sections"].append({
                    "title": "Hypothesis tests",
                    "items": [{"kind": a.kind, "result": jload(a.result)} for a in tests_],
                })
        if "models" in sections and models:
            report["sections"].append({
                "title": "Predictive models",
                "items": [{
                    "name": m.name,
                    "algorithm": m.algorithm,
                    "target": m.target,
                    "metrics": jload(m.metrics),
                } for m in models],
            })
        return jsonify(clean_json(report))
    finally:
        s.close()

def _auto_summary(ds, analyses, models):
    bits = [f"Analysis of {ds.name} ({ds.row_count} rows, {ds.col_count} variables)."]
    if models:
        latest = models[-1]
        metrics = jload(latest.metrics) or {}
        if metrics.get("auc"):
            bits.append(f"Best model ({latest.algorithm}) achieves AUC={metrics['auc']:.3f} predicting {latest.target}.")
        elif metrics.get("r2") is not None:
            bits.append(f"Best model ({latest.algorithm}) achieves R²={metrics['r2']:.3f} predicting {latest.target}.")
    sig_tests = [a for a in analyses if a.kind.startswith("test_") and (jload(a.result) or {}).get("significant")]
    if sig_tests:
        bits.append(f"{len(sig_tests)} hypothesis tests returned significant results (p < 0.05).")
    return " ".join(bits)

# --- helper to save analysis rows ---
def _save_analysis(session, ds_id, kind, config, result):
    a = Analysis(
        id=str(uuid.uuid4()),
        dataset_id=ds_id,
        kind=kind,
        config=jdump(clean_json(config)),
        result=jdump(clean_json(result)),
    )
    session.add(a)
    session.commit()

# ========================================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
