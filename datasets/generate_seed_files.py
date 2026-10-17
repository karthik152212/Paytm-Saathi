"""Generate the fictional Paytm Saathi demo datasets (datasets/*.json).

Run once from the repository root:

    python datasets/generate_seed_files.py

The generated JSON files are the committed source of truth for the backend
seed loader. This script only exists so the scenario definition (which mirrors
the original frontend seed in frontend/src/data/seed.ts) stays readable and the
files can be regenerated consistently.

Every date carries a relative `seed_*` hint so the backend can re-anchor the
scenario around "today" the first time it imports the data. The absolute
`*_date` fields are also written out so the files stay explicit and readable.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent

NOW = datetime.now()
TODAY = NOW.day


def day(days_ago: int, hour: int, minute: int) -> dict:
    """A timestamp inside the current month, never before day 1."""
    d = max(1, TODAY - days_ago)
    stamp = datetime(NOW.year, NOW.month, d, hour, minute)
    if stamp > NOW:
        stamp = NOW - timedelta(minutes=11)
    return {"kind": "day", "days_ago": days_ago, "hour": hour, "minute": minute}, stamp.isoformat(timespec="minutes")


def prev_month(day_of_month: int, hour: int, minute: int) -> dict:
    first_of_this = NOW.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_first = first_of_this - timedelta(days=1)
    stamp = prev_first.replace(day=day_of_month, hour=hour, minute=minute)
    return (
        {"kind": "prev_month", "day": day_of_month, "hour": hour, "minute": minute},
        stamp.isoformat(timespec="minutes"),
    )


def offset_days(offset: int) -> dict:
    """Positive = future, negative = past, relative to today's date."""
    stamp = date(NOW.year, NOW.month, NOW.day) + timedelta(days=offset)
    return {"kind": "offset_days", "offset": offset}, stamp.isoformat()


def month_offset(offset: int) -> dict:
    first_of_this = NOW.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ref = first_of_this
    for _ in range(offset):
        ref = (ref - timedelta(days=1)).replace(day=1)
    return {"kind": "month_offset", "offset": offset}, ref.strftime("%Y-%m")


def write(name: str, title: str, description: str, records: list) -> None:
    payload = {
        "meta": {
            "file": name,
            "title": title,
            "description": description,
            "generated_by": "datasets/generate_seed_files.py",
            "generated_at": NOW.replace(microsecond=0).isoformat(timespec="seconds"),
            "disclaimer": (
                "Fictional demonstration data. No real people, bank accounts, cards, "
                "UPI identifiers, PINs or OTPs are represented here."
            ),
        },
        "records": records,
    }
    path = OUT / name
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(OUT.parent)} ({len(records)} records)")


# --------------------------------------------------------------------------
# categories
# --------------------------------------------------------------------------
CATEGORIES = [
    ("food", "Food", "#F59E0B", "utensils", 1),
    ("transport", "Transport", "#3B82F6", "car", 2),
    ("shopping", "Shopping", "#A855F7", "shopping-bag", 3),
    ("bills", "Bills", "#EF4444", "receipt", 4),
    ("education", "Education", "#10B981", "graduation-cap", 5),
    ("other", "Other", "#64748B", "shapes", 6),
]

write(
    "categories.json",
    "Spending categories",
    "Display metadata for the six spending categories used across the app.",
    [
        {
            "category_id": cid,
            "display_label": label,
            "color_hex": color,
            "icon": icon,
            "sort_order": order,
        }
        for cid, label, color, icon, order in CATEGORIES
    ],
)

# --------------------------------------------------------------------------
# users
# --------------------------------------------------------------------------
write(
    "users.json",
    "Demo users",
    "Fictional demo profiles. These records do not authenticate anyone and "
    "contain no passwords, hashes, phone numbers or real personal data.",
    [
        {
            "user_id": "usr_001",
            "display_name": "Aarav Sharma",
            "demo_email": "aarav.sharma@example.com",
            "preferred_language": "en-IN",
            "accessibility_preferences": {"simple_mode_default": False, "large_text": False},
            "created_at": "2026-01-05T10:00:00",
            "is_demo_user": True,
            "subtitle": "Student · Demo account",
        },
        {
            "user_id": "usr_002",
            "display_name": "Meera Iyer",
            "demo_email": "meera.iyer@example.com",
            "preferred_language": "en-IN",
            "accessibility_preferences": {"simple_mode_default": True, "large_text": True},
            "created_at": "2026-02-11T10:00:00",
            "is_demo_user": True,
            "subtitle": "Second demo profile · empty account",
        },
    ],
)

# --------------------------------------------------------------------------
# accounts
# --------------------------------------------------------------------------
write(
    "accounts.json",
    "Demo accounts",
    "Simulated accounts. Opening balances are fictional and every derived "
    "balance is simulated — no bank or wallet is connected.",
    [
        {
            "account_id": "acc_001",
            "user_id": "usr_001",
            "account_type": "savings",
            "display_label": "Demo Savings Account",
            "currency": "INR",
            "opening_balance_paise": 3_800_000,
            "account_status": "active",
            "is_demo_account": True,
            "is_simulated": True,
        },
        {
            "account_id": "acc_002",
            "user_id": "usr_002",
            "account_type": "wallet",
            "display_label": "Demo Wallet (Meera)",
            "currency": "INR",
            "opening_balance_paise": 500_000,
            "account_status": "active",
            "is_demo_account": True,
            "is_simulated": True,
        },
    ],
)

# --------------------------------------------------------------------------
# transactions
# --------------------------------------------------------------------------
FLAG_REASON = (
    "Demo scenario: the merchant had never appeared before, the payment was "
    "unusually large for this account, and it was made at an unusual hour."
)

CURRENT = [
    ("Chai Point", "Morning coffee", 140, "debit", "food", (0, 9, 12), "UPI", False),
    ("Zomato", "Lunch order", 386, "debit", "food", (0, 13, 40), "UPI", False),
    ("Saravana Bhavan", "South Indian thali", 320, "debit", "food", (1, 11, 5), "UPI", False),
    ("Uber", "Ride home", 214, "debit", "transport", (1, 20, 15), "UPI", False),
    ("Metro Card", "Transit top-up", 500, "debit", "transport", (2, 8, 45), "Wallet", False),
    ("Blinkit", "Groceries for the week", 659, "debit", "food", (2, 19, 10), "UPI", False),
    ("Coursera", "Data Structures specialisation", 1499, "debit", "education", (3, 10, 30), "Card", False),
    ("BookMyShow", "Movie tickets", 480, "debit", "other", (3, 14, 0), "UPI", False),
    ("Amazon", "Type-C hub and mouse pad", 1749, "debit", "shopping", (3, 16, 10), "Card", False),
    ("Neo Tech Store", "Order #NX-88213", 8999, "debit", "other", (3, 1, 12), "UPI", True),
    ("QuickCart Online", "Order #QC-4471", 2499, "debit", "other", (3, 1, 19), "UPI", False),
    ("SpinWin Rewards", "Prize claim fee", 999, "debit", "other", (3, 1, 26), "UPI", False),
    ("Rapido", "Bike taxi to campus", 98, "debit", "transport", (4, 12, 15), "UPI", False),
    ("DMart", "Monthly groceries", 1150, "debit", "food", (4, 18, 30), "Card", False),
    ("Udemy", "React course", 749, "debit", "education", (5, 9, 50), "UPI", False),
    ("StreamFlix Premium", "Monthly subscription", 649, "debit", "bills", (5, 21, 10), "AutoPay", False),
    ("IRCTC", "Train ticket home", 845, "debit", "transport", (6, 7, 30), "Net Banking", False),
    ("Myntra", "Running shoes", 1299, "debit", "shopping", (7, 17, 45), "Card", False),
    ("BSES Electricity", "Monthly electricity bill", 1860, "debit", "bills", (8, 10, 5), "UPI", False),
    ("Zomato", "Late night order", 342, "debit", "food", (8, 22, 20), "UPI", False),
    ("NexCorp Stipend", "Monthly stipend", 36500, "credit", "other", (1, 9, 0), "Net Banking", False),
    ("Cashback Rewards", "Recharge cashback", 350, "credit", "other", (5, 10, 0), "Wallet", False),
    ("Rahul Repaid", "Shared dinner split", 850, "credit", "other", (6, 15, 10), "UPI", False),
    ("Myntra Refund", "Returned jacket", 1200, "credit", "shopping", (9, 17, 20), "UPI", False),
]

PREVIOUS = [
    ("College Fee", "Semester fee instalment", 6500, "debit", "education", (5, 11, 0), "Net Banking", False),
    ("AirFly Tickets", "Flight home for Diwali", 12400, "debit", "transport", (12, 8, 30), "Card", False),
    ("Dominos Pizza", "Family dinner", 549, "debit", "food", (18, 21, 0), "UPI", False),
    ("Decathlon", "Badminton racket", 2199, "debit", "shopping", (22, 19, 0), "Card", False),
    ("BSES Electricity", "Previous month bill", 1780, "debit", "bills", (25, 10, 15), "UPI", False),
    ("NexCorp Stipend", "Monthly stipend", 36500, "credit", "other", (1, 9, 0), "Net Banking", False),
]

transactions: list[dict] = []
seq = 0
for bucket, kind in ((CURRENT, "day"), (PREVIOUS, "prev_month")):
    for merchant, note, amount, direction, category, (d, h, m), method, flagged in bucket:
        seq += 1
        if kind == "day":
            hint, stamp = day(d, h, m)
        else:
            hint, stamp = prev_month(d, h, m)
        transactions.append(
            {
                "transaction_id": f"txn_{seq:03d}",
                "account_id": "acc_001",
                "user_id": "usr_001",
                "merchant": merchant,
                "amount_paise": amount * 100,
                "direction": direction,
                "category_id": category,
                "transaction_date": stamp,
                "seed_date": hint,
                "payment_method_label": method,
                "description": note,
                "demo_risk_flag": flagged,
                "demo_flag_reason": FLAG_REASON if flagged else None,
            }
        )

write(
    "transactions.json",
    "Simulated transactions",
    "30 fictional Indian transactions (24 in the current month window, 6 in "
    "the previous month) used for charts, filters, budgets and safety demos. "
    "The Neo Tech Store payment is an intentionally suspicious demo cluster.",
    transactions,
)

# --------------------------------------------------------------------------
# budgets
# --------------------------------------------------------------------------
budgets = [
    ("bud_food", "food", 6000),
    ("bud_transport", "transport", 3000),
    ("bud_shopping", "shopping", 3400),
    ("bud_bills", "bills", 4000),
    ("bud_education", "education", 3000),
]
write(
    "budgets.json",
    "Monthly budgets",
    "Category spending limits. 'spent' is never stored here — it is always "
    "derived from transactions.",
    [
        {
            "budget_id": bid,
            "user_id": "usr_001",
            "category_id": category,
            "monthly_limit_paise": limit * 100,
            "period": "monthly",
            "created_at": "2026-01-05T10:05:00",
            "updated_at": "2026-01-05T10:05:00",
        }
        for bid, category, limit in budgets
    ],
)

# --------------------------------------------------------------------------
# savings goals + contributions
# --------------------------------------------------------------------------
goals_spec = [
    ("goal_001", "Emergency Fund", 50000, 21500, 120, "Three months of basic expenses, kept aside for surprises."),
    ("goal_002", "New Laptop", 75000, 32000, 150, "For final-year projects and placements."),
    ("goal_003", "Goa Trip", 30000, 6500, 90, "December trip with friends."),
]
goal_records = []
for gid, title, target, saved, days, note in goals_spec:
    hint, stamp = offset_days(days)
    goal_records.append(
        {
            "goal_id": gid,
            "user_id": "usr_001",
            "title": title,
            "target_amount_paise": target * 100,
            "saved_amount_paise": saved * 100,
            "target_date": stamp,
            "seed_target_date": hint,
            "note": note,
            "created_at": "2026-01-05T10:10:00",
            "updated_at": "2026-01-05T10:10:00",
        }
    )

contrib_spec = [
    ("con_001", "goal_001", 3000, (4, 19, 30)),
    ("con_002", "goal_002", 4000, (6, 20, 15)),
    ("con_003", "goal_003", 1500, (2, 18, 0)),
]
contrib_records = []
for cid, gid, amount, (d, h, m) in contrib_spec:
    hint, stamp = day(d, h, m)
    contrib_records.append(
        {
            "contribution_id": cid,
            "goal_id": gid,
            "user_id": "usr_001",
            "amount_paise": amount * 100,
            "created_at": stamp,
            "seed_date": hint,
            "note": "Seed contribution",
        }
    )

write(
    "savings_goals.json",
    "Savings goals and contribution history",
    "Goal targets are authoritative; saved_amount_paise is maintained by the "
    "backend whenever a contribution is recorded. Contributions are the audit "
    "trail behind 'saved this month' and the available balance.",
    {"goals": goal_records, "contributions": contrib_records},
)

# --------------------------------------------------------------------------
# bills
# --------------------------------------------------------------------------
bills_spec = [
    ("bill_001", "Gym Membership", 1500, -2, "upcoming", True, "other", None),
    ("bill_002", "Airtel Mobile Recharge", 299, 2, "upcoming", True, "bills", None),
    ("bill_003", "Electricity Bill (BSES)", 1420, 5, "upcoming", True, "bills", None),
    ("bill_004", "ACT Fibernet Internet", 1199, 7, "upcoming", True, "bills", None),
    ("bill_005", "Semester Exam Form Fee", 1200, 13, "upcoming", False, "education", None),
    ("bill_006", "StreamFlix Premium", 649, -3, "paid", True, "bills", -3),
]
bill_records = []
for bid, title, amount, offset, status, recurring, category, paid_offset in bills_spec:
    hint, stamp = offset_days(offset)
    paid_hint = paid_stamp = None
    if paid_offset is not None:
        paid_hint, paid_stamp = offset_days(paid_offset)
    bill_records.append(
        {
            "bill_id": bid,
            "user_id": "usr_001",
            "title": title,
            "amount_paise": amount * 100,
            "due_date": stamp,
            "seed_due_date": hint,
            "status": status,
            "recurring": recurring,
            "category_id": category,
            "paid_date": paid_stamp,
            "seed_paid_date": paid_hint,
            "created_at": "2026-01-05T10:15:00",
        }
    )

write(
    "bills.json",
    "Bills and reminders",
    "Upcoming and paid bills. 'mark-paid' only changes demonstration state — "
    "no payment is ever processed.",
    bill_records,
)

# --------------------------------------------------------------------------
# monthly history (months older than the transaction window)
# --------------------------------------------------------------------------
history_spec = [(5, 22400), (4, 24800), (3, 27300), (2, 25100)]
history_records = []
for offset, spending in history_spec:
    hint, stamp = month_offset(offset)
    history_records.append(
        {
            "month": stamp,
            "seed_month": hint,
            "spending_paise": spending * 100,
            "note": "Historical aggregate for months with no seeded transactions.",
        }
    )

write(
    "monthly_history.json",
    "Historical monthly spending",
    "Aggregate spending for months older than the seeded transaction window, "
    "used only by the 6-month trend chart.",
    history_records,
)

# --------------------------------------------------------------------------
# safety scenarios (data only — scoring rules live in backend code)
# --------------------------------------------------------------------------
write(
    "safety_scenarios.json",
    "Safety demo scenarios",
    "Explicitly labelled fictional scenarios used by the Safety Center "
    "explanation, the backend tests and the professor demo guide. The scoring "
    "rules themselves are NOT stored here — they live in "
    "backend/app/services/safety.py so data and rules stay separate.",
    [
        {
            "scenario_id": "sc_high_value_unusual_payment",
            "title": "High-value payment to a never-seen-before merchant",
            "description": (
                "A single ₹8,999 payment at 1:12 AM to a merchant that has no history "
                "in this account. Illustrates the unusual-amount rule."
            ),
            "related_transaction_ids": ["txn_010"],
            "expected_rule_codes": ["flagged", "large-amount", "unusual-hour", "burst"],
            "expected_severity": "high",
            "should_raise_alert": True,
            "teaching_note": "Three independent rules fire on one payment; each is explained in plain English.",
        },
        {
            "scenario_id": "sc_payment_burst",
            "title": "Burst of payments within one hour",
            "description": (
                "Three debits (₹8,999, ₹2,499, ₹999) recorded within 14 minutes at night — "
                "the pattern account-draining attacks produce."
            ),
            "related_transaction_ids": ["txn_010", "txn_011", "txn_012"],
            "expected_rule_codes": ["burst"],
            "expected_severity": "medium",
            "should_raise_alert": True,
            "teaching_note": "Burst detection is time-window based and independent of merchant or amount.",
        },
        {
            "scenario_id": "sc_explicit_demo_flag",
            "title": "Transaction explicitly marked in the demo dataset",
            "description": (
                "demo_risk_flag=true on txn_010 with an explanation string. Shows how an "
                "upstream warning (here: the dataset itself) is surfaced with full attribution."
            ),
            "related_transaction_ids": ["txn_010"],
            "expected_rule_codes": ["flagged"],
            "expected_severity": "medium",
            "should_raise_alert": True,
            "teaching_note": "The flag alone contributes 40 points and always quotes its stored reason.",
        },
        {
            "scenario_id": "sc_normal_payment",
            "title": "Ordinary payment that must NOT be treated as fraud",
            "description": (
                "A ₹140 chai purchase at 9:12 AM through UPI. No rule triggers; the demo "
                "proves ordinary payments never appear in the alert list."
            ),
            "related_transaction_ids": ["txn_001"],
            "expected_rule_codes": [],
            "expected_severity": None,
            "should_raise_alert": False,
            "teaching_note": "A safety system that flags everything teaches users to ignore it.",
        },
    ],
)

print("done.")
