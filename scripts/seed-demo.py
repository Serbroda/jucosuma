#!/usr/bin/env python3
"""
Fills a fresh Jucosuma instance with a complete demo household (Danny & Julia).

Usage:
  1. Start the app with an empty database, e.g.
       go run ./cmd/web -db-path demo.db -addr :18090
     The admin password is written to admin_password.txt in the working directory.
  2. Run:
       python3 scripts/seed-demo.py http://localhost:18090 <path/to/admin_password.txt>

Logins afterwards (all passwords below are demo values):
  danny / demo-danny   (admin, linked to person "Danny")
  julia / demo-julia   (user,  linked to person "Julia")
  admin / demo-admin
"""
import http.cookiejar
import json
import sys
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/") + "/api"
ADMIN_PASSWORD_FILE = sys.argv[2]

PASSWORDS = {"admin": "demo-admin", "danny": "demo-danny", "julia": "demo-julia"}


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(BASE + path, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        return self._send(req)

    def entry(self, meta):
        """Creates an entry (contract) via the multipart endpoint used by the UI."""
        boundary = uuid.uuid4().hex
        payload = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"meta\"\r\n\r\n"
            f"{json.dumps(meta)}\r\n--{boundary}--\r\n"
        ).encode()
        req = urllib.request.Request(BASE + "/contracts", data=payload, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        return self._send(req)

    def _send(self, req):
        try:
            with self.opener.open(req) as res:
                text = res.read().decode()
                return json.loads(text) if text and text[0] in "[{" else text
        except urllib.error.HTTPError as e:
            raise SystemExit(f"{req.get_method()} {req.full_url} failed: {e.code} {e.read().decode()}")

    def login(self, username, password):
        return self.call("POST", "/auth/login", {"username": username, "password": password})


# --- users ------------------------------------------------------------------
admin = Client()
admin.login("admin", open(ADMIN_PASSWORD_FILE).read().strip())
admin.call("PUT", "/auth/change-password", {"current_password": open(ADMIN_PASSWORD_FILE).read().strip(),
                                             "new_password": PASSWORDS["admin"]})
danny_user = admin.call("POST", "/users", {"username": "danny", "password": PASSWORDS["danny"], "role": "admin"})
julia_user = admin.call("POST", "/users", {"username": "julia", "password": PASSWORDS["julia"], "role": "user"})

def demo_user(username):
    """Logs in a demo user, skips the forced password change and sets German as language."""
    client = Client()
    client.login(username, PASSWORDS[username])
    client.call("PUT", "/auth/change-password", {"current_password": PASSWORDS[username], "new_password": PASSWORDS[username]})
    client.call("PUT", "/auth/preferences", {"language": "de"})
    return client


danny = demo_user("danny")
julia = demo_user("julia")

# --- persons ----------------------------------------------------------------
P_DANNY = danny.call("POST", "/persons", {"name": "Danny", "in_household": True, "user_id": danny_user["id"], "sort_order": 0})["id"]
P_JULIA = danny.call("POST", "/persons", {"name": "Julia", "in_household": True, "user_id": julia_user["id"], "sort_order": 1})["id"]
P_FRIENDS = danny.call("POST", "/persons", {"name": "Freunde (YouTube)", "in_household": False, "sort_order": 2})["id"]

HALF = [{"person_id": P_DANNY, "weight": 1}, {"person_id": P_JULIA, "weight": 1}]
DANNY = [{"person_id": P_DANNY, "weight": 1}]
JULIA = [{"person_id": P_JULIA, "weight": 1}]


# --- accounts ---------------------------------------------------------------
def account(name, type_, owner=None, iban=None, balance=None, savings=False, order=0):
    return danny.call("POST", "/accounts", {
        "name": name, "type": type_, "person_id": owner, "iban": iban, "balance": balance,
        "balance_date": "2026-10-01" if balance is not None else None, "is_savings": savings, "sort_order": order,
    })["id"]


A_JOINT = account("Gemeinschaftskonto", "checking", None, "DE12 5001 0517 1234 5678 90", 2840.12, order=0)
A_DANNY = account("Girokonto Danny", "checking", P_DANNY, "DE98 1203 0000 9876 5432 10", 1236.50, order=1)
A_JULIA = account("Girokonto Julia", "checking", P_JULIA, "DE55 4306 0967 1234 5678 78", 954.20, order=2)
A_CALL = account("Tagesgeld", "savings", None, "DE66 5001 0517 9876 5432 32", 8420.00, True, order=3)
A_BUFFER = account("Puffer-Konto", "checking", None, "DE21 1001 1001 2623 4567 89", 3500.00, True, order=4)
A_DEPOT = account("ETF-Depot", "depot", None, "DE44 5001 0517 5555 4321 00", 12480.00, True, order=5)
A_DEPOT_DANNY = account("Depot Danny", "depot", P_DANNY, None, 6432.18, True, order=6)

# --- categories -------------------------------------------------------------
categories = {c["key"] or c["name"]: c["name"] for c in danny.call("GET", "/categories")}
danny.call("POST", "/categories", {"name": "Haustier", "type": "expense", "color": 5, "icon": "heart", "sort_order": 13})
categories["pets"] = "Haustier"
cat = categories.__getitem__


# --- savings goals ----------------------------------------------------------
def goal(name, kind, icon, color, target, current, account_id, person=None, target_date=None, order=0):
    return danny.call("POST", "/savings_goals", {
        "name": name, "kind": kind, "icon": icon, "color": color, "target_amount": target, "target_date": target_date,
        "current_amount": current, "current_date": "2026-10-01", "account_id": account_id, "person_id": person,
        "sort_order": order,
    })["id"]


G_JAPAN = goal("Urlaub Japan", "saving", "plane", 3, 5000, 2650, A_CALL, target_date="2027-09-01", order=0)
G_EMERGENCY = goal("Notgroschen", "saving", "lifebuoy", 1, 10000, 8000, A_BUFFER, order=1)
G_ETF = goal("ETF gemeinsam", "investing", "chart", 7, 24000, 12480, A_DEPOT, order=2)
G_KITCHEN = goal("Neue Küche", "saving", "home", 4, 6000, 1200, A_CALL, target_date="2027-06-01", order=3)
G_CAR = goal("Neues Auto", "saving", "truck", 8, 20000, 3000, A_CALL, P_DANNY, target_date="2029-01-01", order=4)
G_HOUSE = goal("Hauskauf (langfristig)", "investing", "bank", 2, 50000, 0, A_DEPOT, target_date="2035-01-01", order=5)


# --- entries ----------------------------------------------------------------
def entry(client, name, kind, amount, period, start, account_id, category=None, shares=None, target=None,
          goal_id=None, **details):
    """details: further entry fields, e.g. company, contract_number, end_date, owner_id (private entry)."""
    # recurring expenses with provider, contract number or term are marked as contracts
    is_contract = kind == "expense" and period != "one_time" and any(
        details.get(k) for k in ("company", "contract_number", "customer_number", "term_months"))
    client.entry({
        "is_contract": is_contract,
        "name": name, "kind": kind, "costs": amount, "billing_period": period, "start_date": start,
        "account_id": account_id, "target_account_id": target, "goal_id": goal_id,
        "category": category or cat("other"), "shares": shares or [],
        "currency": "EUR", "split_between": 1, **details,
    })


YEARLY_3M = {"term_months": 12, "notice_period": 3, "notice_unit": "months"}

# Income
entry(danny, "Gehalt Danny", "income", 3400, "monthly", "2024-01-01", A_JOINT, cat("salary"), DANNY,
      company="Muster Software GmbH")
entry(danny, "Gehalt Julia", "income", 2900, "monthly", "2024-01-01", A_JOINT, cat("salary"), JULIA,
      company="Stadtwerke Beispielstadt")
entry(danny, "Weihnachtsgeld Danny", "income", 1800, "annually", "2024-11-25", A_JOINT, cat("bonus"), DANNY)
entry(danny, "Urlaubsgeld Julia", "income", 1200, "annually", "2025-06-25", A_JOINT, cat("bonus"), JULIA)
entry(danny, "Steuererstattung", "income", 640, "one_time", "2026-08-14", A_JOINT, cat("other_income"), HALF)

# Pocket money and savings plans
entry(danny, "Taschengeld Danny", "transfer", 350, "monthly", "2024-01-01", A_JOINT, target=A_DANNY)
entry(danny, "Taschengeld Julia", "transfer", 350, "monthly", "2024-01-01", A_JOINT, target=A_JULIA)
entry(danny, "ETF-Sparplan", "transfer", 500, "monthly", "2024-01-01", A_JOINT, target=A_DEPOT, goal_id=G_ETF)
entry(danny, "Notgroschen auffüllen", "transfer", 200, "monthly", "2025-01-01", A_JOINT, target=A_BUFFER, goal_id=G_EMERGENCY)
entry(danny, "Japan-Kasse", "transfer", 300, "monthly", "2026-01-01", A_JOINT, target=A_CALL, goal_id=G_JAPAN)
entry(danny, "Küchen-Kasse", "transfer", 200, "monthly", "2026-06-01", A_JOINT, target=A_CALL, goal_id=G_KITCHEN)
entry(danny, "Auto-Sparen", "transfer", 150, "monthly", "2026-01-01", A_DANNY, target=A_CALL, goal_id=G_CAR)
entry(danny, "Depot-Sparplan Danny", "transfer", 75, "monthly", "2025-03-01", A_DANNY, target=A_DEPOT_DANNY)

# Housing and utilities
entry(danny, "Miete", "expense", 1400, "monthly", "2021-04-01", A_JOINT, cat("housing"), HALF,
      company="Wohnbau Beispielstadt eG", contract_number="MV-2021-0417", contact_person="Frau Schneider",
      contact_phone="0201 123456", contact_email="vermietung@wohnbau-beispiel.de")
entry(danny, "Nebenkosten-Vorauszahlung", "expense", 180, "monthly", "2021-04-01", A_JOINT, cat("utilities"), HALF,
      company="Wohnbau Beispielstadt eG")
entry(danny, "Strom (E.ON)", "expense", 82, "monthly", "2023-02-01", A_JOINT, cat("utilities"), HALF,
      company="E.ON", customer_number="204 118 772", term_months=12, notice_period=6, notice_unit="weeks")
entry(danny, "Internet (Telekom)", "expense", 49.99, "monthly", "2022-08-01", A_JOINT, cat("telecom"), HALF,
      company="Telekom", contract_number="TK-4471-0098", term_months=12, notice_period=1, notice_unit="months")
entry(danny, "Rundfunkbeitrag", "expense", 55.08, "quarterly", "2021-04-15", A_JOINT, cat("utilities"), HALF,
      company="ARD ZDF Deutschlandradio Beitragsservice")

# Daily life
entry(danny, "Lebensmittel", "expense", 650, "monthly", "2024-01-01", A_JOINT, cat("groceries"), HALF)
entry(danny, "Drogerie", "expense", 60, "monthly", "2024-01-01", A_JOINT, cat("groceries"), HALF)
entry(danny, "Katzenfutter & Streu", "expense", 45, "monthly", "2024-05-01", A_JOINT, cat("pets"), HALF)
entry(danny, "Tanken", "expense", 120, "monthly", "2024-01-01", A_JOINT, cat("transport"), HALF)
entry(julia, "Deutschlandticket", "expense", 58, "monthly", "2025-01-01", A_JULIA, cat("transport"), JULIA,
      company="Verkehrsverbund")

# Insurance
entry(danny, "Hausratversicherung", "expense", 106.80, "annually", "2022-03-01", A_JOINT, cat("insurance"), HALF,
      company="HUK-COBURG", contract_number="HR-882 117 3", **YEARLY_3M)
entry(danny, "Haftpflichtversicherung", "expense", 72, "annually", "2021-05-01", A_JOINT, cat("insurance"), HALF,
      company="HUK-COBURG", contract_number="PH-551 902 1", **YEARLY_3M)
entry(danny, "KFZ-Versicherung", "expense", 540, "annually", "2023-11-15", A_JOINT, cat("insurance"), HALF,
      company="Allianz", contract_number="KFZ-77 3310 22", term_months=12, notice_period=1, notice_unit="months")
entry(danny, "Tierkrankenversicherung", "expense", 24.90, "monthly", "2024-05-01", A_JOINT, cat("insurance"), HALF,
      company="Petplan", contract_number="PP-30 118 552", **YEARLY_3M)
entry(danny, "Zahnzusatz Danny", "expense", 16.50, "monthly", "2023-01-01", A_DANNY, cat("insurance"), DANNY,
      company="Allianz", contract_number="ZZ-4 410 873", **YEARLY_3M)
entry(danny, "Berufsunfähigkeit Danny", "expense", 68.40, "monthly", "2020-12-01", A_DANNY, cat("insurance"), DANNY,
      company="Hannoversche", contract_number="BU-7 220 145", **YEARLY_3M)
entry(danny, "Rechtsschutzversicherung", "expense", 239.88, "annually", "2022-12-01", A_JOINT, cat("insurance"), HALF,
      company="ARAG", contract_number="RS-662 019", **YEARLY_3M)

# Subscriptions
entry(julia, "Netflix", "expense", 17.99, "monthly", "2020-09-01", A_JULIA, cat("entertainment"), HALF, company="Netflix")
entry(julia, "YouTube Premium Familie", "expense", 23.99, "monthly", "2022-02-01", A_JULIA, cat("entertainment"),
      [{"person_id": P_DANNY, "weight": 1}, {"person_id": P_JULIA, "weight": 1}, {"person_id": P_FRIENDS, "weight": 6}],
      company="Google", notes="Familienabo, geteilt mit 6 Freunden – sie überweisen ihren Anteil.")
entry(danny, "Spotify Duo", "expense", 14.99, "monthly", "2021-06-01", A_DANNY, cat("entertainment"), HALF, company="Spotify")
entry(danny, "Amazon Prime", "expense", 89.90, "annually", "2022-02-10", A_JOINT, cat("entertainment"), HALF, company="Amazon")
entry(danny, "ChatGPT Plus", "expense", 22, "monthly", "2024-03-01", A_DANNY, cat("software"), DANNY, company="OpenAI")
entry(danny, "Handy Danny (o2)", "expense", 24.99, "monthly", "2023-07-01", A_DANNY, cat("telecom"), DANNY,
      company="o2", end_date="2027-06-30", term_months=24, notice_period=3, notice_unit="months")
entry(julia, "Handy Julia (Telekom)", "expense", 19.99, "monthly", "2024-12-15", A_JULIA, cat("telecom"), JULIA, company="Telekom",
      contract_number="MF-118 220 9", term_months=24, notice_period=1, notice_unit="months")
entry(julia, "Fitnessstudio", "expense", 39.90, "monthly", "2025-01-01", A_JULIA, cat("health"), JULIA, company="FitX",
      term_months=12, notice_period=4, notice_unit="weeks")

# One-off expenses
entry(danny, "Restaurant Jahrestag", "expense", 86.40, "one_time", "2026-10-11", A_DANNY, cat("leisure"), HALF)
entry(danny, "Konzertkarten", "expense", 120, "one_time", "2026-12-05", A_JOINT, cat("leisure"), HALF)
entry(danny, "Waschmaschine", "expense", 549, "one_time", "2026-09-20", A_JOINT, cat("housing"), HALF)
entry(julia, "Weihnachtsgeschenk für Danny", "expense", 80, "one_time", "2026-12-10", A_JULIA, cat("leisure"), JULIA,
      owner_id=julia_user["id"])

print("Demo household created.")
