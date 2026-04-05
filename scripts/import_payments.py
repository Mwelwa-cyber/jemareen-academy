# -*- coding: utf-8 -*-
"""
Import Term 1 2026 payment data from Excel into Firebase Firestore.
Usage: python scripts/import_payments.py <admin_email> <admin_password>
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import sys
import json
import math
import time
import requests
import pandas as pd
from datetime import datetime

EXCEL_PATH = r"C:\Users\mahen\OneDrive\Desktop\Jemareen Academy\Office iterms\School Payments\School payments for Term 1 2026.xlsx"
PROJECT_ID = "jemareen-academy"
API_KEY    = "AIzaSyBzvvey5zMXdm8DPaOo0lI5OUyU6MqXta0"
TERM       = "Term 1 2026"
IMPORT_BY  = "import@jemareen-academy"

GRADE_MAP = {
    "Babyclass":  "Baby Class",
    "Nursery":    "Baby Class",
    "Recepton":   "Reception",
    "Reception":  "Reception",
    "Grade 1":    "Grade 1",
    "Grade 2":    "Grade 2",
    "Grade 3":    "Grade 3",
    "Grade 4":    "Grade 4",
    "Grade 5":    "Grade 5",
    "Grade 6":    "Grade 6",
    "Grade 7":    "Grade 7",
}

# ── Firebase helpers ─────────────────────────────────────────────────────────

def sign_in(email, password):
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})
    r.raise_for_status()
    token = r.json()["idToken"]
    print(f"✓ Signed in as {email}")
    return token

BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def fs_value(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    return {"stringValue": str(v)}

def fs_doc(fields_dict):
    return {"fields": {k: fs_value(v) for k, v in fields_dict.items()}}

def create_doc(collection, data, token):
    url = f"{BASE}/{collection}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.post(url, headers=headers, json=fs_doc(data))
    r.raise_for_status()
    doc_id = r.json()["name"].split("/")[-1]
    return doc_id

def doc_exists_query(collection, field, value, token):
    """Return True if any document in collection has field==value."""
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:runQuery"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "structuredQuery": {
            "from": [{"collectionId": collection}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": field},
                    "op": "EQUAL",
                    "value": fs_value(value)
                }
            },
            "limit": 1
        }
    }
    r = requests.post(url, headers=headers, json=body)
    r.raise_for_status()
    results = r.json()
    return results and "document" in results[0]

def get_existing_learner(name, grade, token):
    """Find an existing learner doc by name+grade, return (id, doc) or (None,None)."""
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:runQuery"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "structuredQuery": {
            "from": [{"collectionId": "learners"}],
            "where": {
                "compositeFilter": {
                    "op": "AND",
                    "filters": [
                        {"fieldFilter": {"field": {"fieldPath": "name"}, "op": "EQUAL", "value": fs_value(name)}},
                        {"fieldFilter": {"field": {"fieldPath": "grade"}, "op": "EQUAL", "value": fs_value(grade)}}
                    ]
                }
            },
            "limit": 1
        }
    }
    r = requests.post(url, headers=headers, json=body)
    r.raise_for_status()
    results = r.json()
    if results and "document" in results[0]:
        doc = results[0]["document"]
        doc_id = doc["name"].split("/")[-1]
        return doc_id, doc
    return None, None

# ── Excel reading ─────────────────────────────────────────────────────────────

SHEET_NAMES = ["Babyclass","Nursery","Recepton",
               "Grade 1","Grade 2","Grade 3","Grade 4",
               "Grade 5","Grade 6","Grade 7"]

def safe_num(v):
    try:
        f = float(v)
        return 0.0 if math.isnan(f) else f
    except Exception:
        return 0.0

def safe_str(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    return str(v).strip()

def read_excel():
    xls = pd.read_excel(EXCEL_PATH, sheet_name=None, header=None)
    records = []
    for sheet, df in xls.items():
        if sheet not in SHEET_NAMES:
            continue
        grade = GRADE_MAP.get(sheet, sheet)

        # Find the header row: look for a row containing "Name"
        header_row = None
        for i, row in df.iterrows():
            if any(str(c).strip().lower() == "name" for c in row):
                header_row = i
                break
        if header_row is None:
            print(f"  ⚠ Skipping {sheet}: no header row found")
            continue

        df.columns = [str(c).strip() for c in df.iloc[header_row]]
        df = df.iloc[header_row+1:].reset_index(drop=True)

        # Normalise column names
        col_map = {}
        for c in df.columns:
            lc = c.lower()
            if "name" in lc and "learner" not in lc:
                col_map[c] = "Name"
            elif "1st" in lc or "first" in lc:
                col_map[c] = "1st"
            elif "2nd" in lc or "second" in lc:
                col_map[c] = "2nd"
            elif "medical" in lc or "toilet" in lc:
                col_map[c] = "Medical"
            elif "total" in lc and "received" in lc:
                col_map[c] = "Total"
            elif "balance" in lc:
                col_map[c] = "Balance"
            elif "mobile" in lc or "phone" in lc:
                col_map[c] = "Phone"
        df = df.rename(columns=col_map)

        for _, row in df.iterrows():
            name = safe_str(row.get("Name",""))
            if not name or name.lower() in ("name","nan","sn",""):
                continue
            # Skip summary/total rows
            if any(k in name.lower() for k in ("total","subtotal","grand","summary")):
                continue

            phone   = safe_str(row.get("Phone",""))
            inst1   = safe_num(row.get("1st", 0))
            inst2   = safe_num(row.get("2nd", 0))
            medical = safe_num(row.get("Medical", 0))
            total   = safe_num(row.get("Total", 0))
            balance = safe_num(row.get("Balance", 0))

            # Recalculate total if cell is 0/NaN but installments exist
            if total == 0 and (inst1 + inst2 + medical) > 0:
                total = inst1 + inst2 + medical

            records.append({
                "sheet": sheet,
                "grade": grade,
                "name":  name,
                "phone": phone,
                "inst1": inst1,
                "inst2": inst2,
                "medical": medical,
                "total": total,
                "balance": balance,
            })

    print(f"✓ Read {len(records)} learner rows from Excel")
    return records

# ── Main import ───────────────────────────────────────────────────────────────

def import_data(token, records):
    learners_added = 0
    learners_skipped = 0
    payments_added = 0

    for rec in records:
        name  = rec["name"]
        grade = rec["grade"]
        phone = rec["phone"]
        total = rec["total"]

        # 1. Ensure learner exists
        learner_id, _ = get_existing_learner(name, grade, token)
        if learner_id:
            learners_skipped += 1
        else:
            learner_doc = {
                "name":      name,
                "grade":     grade,
                "parent":    "",
                "phone":     phone,
                "email":     "",
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "createdBy": IMPORT_BY,
            }
            learner_id = create_doc("learners", learner_doc, token)
            learners_added += 1
            time.sleep(0.05)   # gentle rate-limit

        # 2. Create payment record(s) for non-zero totals
        if total > 0:
            breakdown_parts = []
            if rec["inst1"] > 0:
                breakdown_parts.append(f"1st: K{rec['inst1']:,.0f}")
            if rec["inst2"] > 0:
                breakdown_parts.append(f"2nd: K{rec['inst2']:,.0f}")
            if rec["medical"] > 0:
                breakdown_parts.append(f"Medical: K{rec['medical']:,.0f}")
            notes = "Imported from Term 1 2026 spreadsheet"
            if breakdown_parts:
                notes += " | " + ", ".join(breakdown_parts)

            payment_doc = {
                "learnerId":   learner_id,
                "learnerName": name,
                "grade":       grade,
                "term":        TERM,
                "amount":      total,
                "method":      "Cash",
                "date":        "2026-01-13",
                "notes":       notes,
                "recordedBy":  IMPORT_BY,
                "createdAt":   datetime.utcnow().isoformat() + "Z",
            }
            create_doc("payments", payment_doc, token)
            payments_added += 1
            time.sleep(0.05)

        status_icon = "✓" if total > 0 else "—"
        print(f"  {status_icon} {grade:<12} {name:<28} K{total:>7,.0f}  (id:{learner_id[:8]}…)")

    print()
    print("─" * 60)
    print(f"  Learners added:   {learners_added}")
    print(f"  Learners skipped (already exist): {learners_skipped}")
    print(f"  Payments added:   {payments_added}")
    print("─" * 60)
    print("✅ Import complete!")

def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/import_payments.py <admin_email> <admin_password>")
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]

    print("Reading Excel…")
    records = read_excel()
    if not records:
        print("No data found in Excel. Aborting.")
        sys.exit(1)

    print(f"\nSigning in to Firebase…")
    token = sign_in(email, password)

    print(f"\nImporting {len(records)} learners + payments into Firebase…")
    print("─" * 60)
    import_data(token, records)

if __name__ == "__main__":
    main()
