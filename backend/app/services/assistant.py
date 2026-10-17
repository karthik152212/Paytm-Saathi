"""Rule-based financial assistant (backend engine).

Ported from frontend/src/assistant/engine.ts. Every number in an answer is
computed from the live database through services.finance, so the assistant
can never disagree with the dashboard. No external AI service is contacted.
"""

from __future__ import annotations

import re
from datetime import datetime

from sqlalchemy.orm import Session

from . import finance
from .format import inr

SUGGESTED_QUESTIONS = [
    "Where did most of my money go?",
    "Can I afford another ₹1,000 purchase?",
    "How can I save ₹5,000 this month?",
    "Which bills are due soon?",
    "Explain my budget in simple words.",
]

ENGINE_NAME = "local-rules-v1"

GLOSSARY = {
    "upi": (
        "UPI (Unified Payments Interface) lets you move money directly between bank accounts using a phone "
        "number or a UPI ID. You approve each payment with a 4–6 digit UPI PIN. Your UPI PIN is only ever "
        "entered by you, inside your own banking app."
    ),
    "emi": (
        "EMI means Equated Monthly Instalment — a fixed amount you pay every month until a purchase or loan is "
        "fully paid. A ₹24,000 purchase over 12 EMIs costs about ₹2,000 a month, before any interest."
    ),
    "credit": (
        "A credit means money coming IN to your account — salary, refund or a friend repaying you. On your "
        "dashboard credits are shown in green with an up arrow."
    ),
    "debit": "A debit means money going OUT — a payment, bill or purchase. Every debit reduces your available balance.",
    "budget": (
        "A budget is simply a spending limit you set for one category for one month. Think of it as a jar: once "
        "the jar is empty, you stop spending from it until next month."
    ),
    "interest": (
        "Interest is the cost of borrowing money, or the earnings on money you save. It is usually shown as a "
        "yearly percentage (for example 12% a year) on the amount involved."
    ),
    "compound interest": (
        "Compound interest is interest that earns its own interest. Saving ₹10,000 at 7% a year becomes about "
        "₹10,700 after a year; leave it and next year you earn on ₹10,700 too. This is why starting early "
        "matters so much."
    ),
    "inflation": (
        "Inflation is the yearly rise in prices. If inflation is 6%, something costing ₹100 today costs about "
        "₹106 next year — which is why money sitting idle slowly loses value."
    ),
    "autopay": (
        "AutoPay (or e-mandate) is a standing instruction that lets a merchant collect a fixed amount from your "
        "account on a schedule — common for recharges, subscriptions and utility bills. You can usually cancel "
        "it from inside your banking or UPI app."
    ),
    "refund": (
        "A refund is money returned to you after a cancelled or returned purchase. It normally reaches the "
        "original payment method in 3–7 working days."
    ),
    "net worth": (
        "Your net worth is what you own (savings, investments) minus what you owe (loans). At its simplest it "
        "is a one-line snapshot of your financial health."
    ),
    "balance": (
        "Your available balance is the money you can spend right now: your opening balance plus everything "
        "credited, minus everything debited and everything you have moved into savings goals."
    ),
    "savings": (
        "Savings is money you deliberately set aside instead of spending. In Saathi, money you move into a goal "
        "is counted as saved — it still belongs to you, it is simply earmarked."
    ),
}

SAFETY_ANSWER = """Here is the short, safe version:

• Never share your OTP or UPI PIN — not with anyone, ever. No bank, wallet or support agent will ask for them.
• Never install an app or share your screen to "confirm a refund". That is how strangers take over a phone.
• If someone asks you to pay or release money, hang up and call back on a number you already trust.
• Open your banking app yourself instead of tapping a link in a message.

Saathi flags unusual payments to help you notice them sooner — it never blocks, reverses or reports anything. Open the Safety Center to see the illustrative alerts computed from your demo data."""

_WORD_MAP = {
    "food": "food",
    "foods": "food",
    "grocery": "food",
    "groceries": "food",
    "restaurant": "food",
    "eating": "food",
    "transport": "transport",
    "travel": "transport",
    "cab": "transport",
    "fuel": "transport",
    "shopping": "shopping",
    "clothes": "shopping",
    "bill": "bills",
    "bills": "bills",
    "subscription": "bills",
    "education": "education",
    "course": "education",
    "fees": "education",
}

_AMOUNT_RE = re.compile(r"(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|l|h|lakh|lac)?\b", re.IGNORECASE)


def parse_amount(text: str) -> int | None:
    """Parse a rupee amount from free text ('₹5,000', '5k', '1.5 lakh')."""
    match = _AMOUNT_RE.search(text.replace(",", ""))
    if not match:
        return None
    try:
        value = float(match.group(1))
    except ValueError:
        return None
    unit = (match.group(2) or "").lower()
    if unit in ("k", "thousand"):
        value *= 1000
    elif unit in ("l", "lakh", "lac"):
        value *= 100000
    return int(round(value))


def category_from(text: str) -> str | None:
    for word, category in _WORD_MAP.items():
        if word in text:
            return category
    return None


def has_any(text: str, *words: str) -> bool:
    return any(word in text for word in words)


def glossary_key_for(text: str) -> str | None:
    matches = [key for key in GLOSSARY if key in text]
    if not matches:
        return None
    return sorted(matches, key=len, reverse=True)[0]


def _name_row(db: Session, user_id: str) -> str:
    from ..repositories.users import get_user

    user = get_user(db, user_id)
    return user.display_name if user else "there"


def _labels(db: Session) -> dict[str, str]:
    """category_id -> display label, so answers read like the UI ("Food", not "food")."""
    from sqlalchemy import select

    from .. import models

    return {row.category_id: row.display_label for row in db.scalars(select(models.Category)).all()}


def _label(labels: dict[str, str], category_id: str) -> str:
    return labels.get(category_id, category_id.title())


# ----------------------------- intents -----------------------------------


def _answer_greeting(db: Session, user_id: str, _text: str) -> str:
    first = _name_row(db, user_id).split(" ")[0]
    return (
        f"Hello {first} — good to see you.\n\n"
        "I read your demo transactions, budgets, goals and bills directly, so every number I give you comes "
        "from your own dashboard.\n\n"
        "Ask me where your money went, whether you can afford something, or how to save a specific amount."
    )


def _answer_afford(db: Session, user_id: str, text: str) -> str:
    amount_rupees = parse_amount(text) or 1000
    amount = amount_rupees * 100
    balance = finance.available_balance_paise(db, user_id)
    category = category_from(text) or "other"
    rows = finance.budget_rows(db, user_id)
    row = next((r for r in rows if r["budget"].category_id == category), None)
    cat_label = _label(_labels(db), category)
    spent_after = (row["spent_paise"] + amount) if row else 0
    pct_after = finance.pct(spent_after, row["budget"].monthly_limit_paise) if row else 0
    totals = finance.budget_totals(rows)
    upcoming = finance.split_bills(finance.bill_rows(db, user_id))["upcoming"]
    due7 = sum(r["bill"].amount_paise for r in upcoming if r["days_left"] <= 7)
    due7_count = sum(1 for r in upcoming if r["days_left"] <= 7)
    after_balance = balance - amount

    lines = [
        f"Let's check it against your actual numbers for a {inr(amount)} purchase in {cat_label}:",
        "",
        f"1. Available balance — you have {inr(balance)}. After this purchase you would have {inr(after_balance)}.",
    ]
    if row:
        limit = row["budget"].monthly_limit_paise
        lines.append(
            f"2. {cat_label} budget — {inr(row['spent_paise'])} of {inr(limit)} used. After this you would be at "
            f"{inr(spent_after)} ({pct_after}% of the limit) with {inr(limit - spent_after)} left."
        )
    else:
        lines.append(f"2. {cat_label} budget — you do not have a budget set for {cat_label}, so nothing is being tracked there.")
    lines.append(f"3. Bills ahead — {inr(due7)} is due in the next 7 days across {due7_count} bill(s).")
    lines.append("")

    problems: list[str] = []
    if after_balance < 0:
        problems.append("it would overdraw your balance")
    if due7 > after_balance - 100_000:
        problems.append(f"your bills due soon ({inr(due7)}) need that room")
    if row and spent_after > row["budget"].monthly_limit_paise:
        problems.append(f"it would push your {cat_label} budget {pct_after}% of the way")
    if totals["remaining_paise"] < 0:
        problems.append("your combined budgets are already crossed")

    if not problems:
        lines.append(
            f"Verdict: yes, you can comfortably afford {inr(amount)} right now. Balance stays positive, your "
            f"{cat_label} budget absorbs it, and your upcoming bills are covered."
        )
    else:
        lines.append(f"Verdict: I would hold off. This purchase would mean {', '.join(problems)}.")
    lines.append("")
    lines.append("This is a calculation on your demo data, not financial advice.")
    return "\n".join(lines)


def _answer_save(db: Session, user_id: str, text: str) -> str:
    target = (parse_amount(text) or 5000) * 100
    labels = _labels(db)
    rows = finance.budget_rows(db, user_id)
    days_left = finance.days_left_in_month()
    headroom_rows = sorted(
        ({**r, "room": max(0, r["remaining_paise"])} for r in rows if r["remaining_paise"] > 0),
        key=lambda r: r["room"],
        reverse=True,
    )
    headroom = sum(r["room"] for r in headroom_rows)

    by_cat = finance.spending_by_category_paise(db, user_id)
    discretionary = by_cat.get("food", 0) + by_cat.get("shopping", 0) + by_cat.get("other", 0)
    elapsed = max(1, datetime.now().day)
    daily_burn = discretionary // elapsed
    trimmed = int(round(daily_burn * 0.25 * days_left))

    bills = finance.bill_rows(db, user_id)
    subs = [r["bill"] for r in bills if r["bill"].recurring and r["bill"].status == "upcoming"]
    sub_saving = sum(b.amount_paise for b in subs)

    levers: list[tuple[str, int]] = []
    remaining = target
    if headroom > 0:
        take = min(headroom, remaining)
        detail = ", ".join(f"{_label(labels, r['budget'].category_id)} {inr(r['room'])}" for r in headroom_rows)
        levers.append(
            (
                f"Redirect unspent budget — you still have {inr(headroom)} left across "
                f"{len(headroom_rows)} budgets ({detail}).",
                take,
            )
        )
        remaining -= take
    if remaining > 0 and trimmed > 0:
        take = min(trimmed, remaining)
        levers.append(
            (
                f"Trim everyday spending — you are averaging about {inr(daily_burn)} a day on food, shopping and "
                f"extras. Cutting a quarter of that for the next {days_left} day(s) frees up to {inr(trimmed)}.",
                take,
            )
        )
        remaining -= take
    if remaining > 0 and sub_saving > 0:
        names = ", ".join(f"{b.title} {inr(b.amount_paise)}" for b in subs)
        levers.append(
            (
                f"Review recurring bills — {names} run every month. Pausing one frees room.",
                min(sub_saving, remaining),
            )
        )
        remaining = max(0, remaining - min(sub_saving, remaining))

    already = finance.saved_this_month_paise(db, user_id)
    total = sum(amount for _, amount in levers)

    lines = [f"Here is a concrete plan to save {inr(target)} with {days_left} day(s) left this month:", ""]
    for index, (label, amount) in enumerate(levers, start=1):
        lines.append(f"{index}. {label} → {inr(amount)}")
    lines.append("")
    lines.append(
        f"That comes to {inr(total)}"
        + (f", which is {inr(remaining)} short of your target" if remaining > 0 else ", which covers your target")
        + "."
    )
    lines.append(
        f"For context, you have already set aside {inr(already)} this month, and your balance is "
        f"{inr(finance.available_balance_paise(db, user_id))}."
    )
    lines.append("")
    lines.append("These are suggestions based on your own demo numbers — not professional financial advice.")
    return "\n".join(lines)


def _answer_bills(db: Session, user_id: str, _text: str) -> str:
    split = finance.split_bills(finance.bill_rows(db, user_id))
    overdue, upcoming, paid = split["overdue"], split["upcoming"], split["paid"]
    if not overdue and not upcoming:
        return "You have no bills waiting. Everything on your list is already marked paid."

    lines: list[str] = []
    if overdue:
        lines.append("Overdue first:")
        for row in overdue:
            bill = row["bill"]
            lines.append(f"  • {bill.title} — {inr(bill.amount_paise)}, {abs(row['days_left'])} day(s) overdue")
        lines.append("")
    lines.append("Coming up:")
    for row in upcoming[:5]:
        bill = row["bill"]
        if row["days_left"] == 0:
            when = "due today"
        elif row["days_left"] == 1:
            when = "due tomorrow"
        else:
            when = f"in {row['days_left']} days"
        lines.append(f"  • {bill.title} — {inr(bill.amount_paise)}, {when} ({bill.due_date.strftime('%d %b')})")
    due7 = sum(r["bill"].amount_paise for r in upcoming if r["days_left"] <= 7)
    due14 = sum(r["bill"].amount_paise for r in upcoming if r["days_left"] <= 14)
    lines.append("")
    lines.append(f"Total due in the next 7 days: {inr(due7)}. Within 14 days: {inr(due14)}.")
    if paid:
        lines.append(f"{len(paid)} bill(s) are already marked paid this period.")
    lines.append("")
    lines.append("Marking a bill paid in Saathi only updates this demo — no real payment is made.")
    return "\n".join(lines)


def _answer_budget(db: Session, user_id: str, _text: str) -> str:
    labels = _labels(db)
    rows = finance.budget_rows(db, user_id)
    totals = finance.budget_totals(rows)
    days_left = finance.days_left_in_month()
    lines = [
        "In plain words, a budget is a spending limit for one category for this month.",
        "",
        (
            f"You have {len(rows)} budgets adding up to {inr(totals['limit_paise'])}. You have used "
            f"{inr(totals['spent_paise'])} of that — {totals['used_percent']}% — leaving "
            f"{inr(totals['remaining_paise'])} with {days_left} day(s) to go."
        ),
        "",
    ]
    for row in rows:
        if row["status"] == "over":
            plain = f"over by {inr(abs(row['remaining_paise']))}"
        elif row["used_percent"] >= 75:
            plain = "you have used most of this budget"
        elif row["used_percent"] >= 40:
            plain = "about half used"
        else:
            plain = "still comfortably within limits"
        lines.append(
            f"  • {_label(labels, row['budget'].category_id)}: {row['used_percent']}% used — "
            f"{inr(row['spent_paise'])} of {inr(row['budget'].monthly_limit_paise)} ({plain})"
        )
    by_cat = finance.spending_by_category_paise(db, user_id)
    if by_cat.get("other", 0) > 0 and not any(r["budget"].category_id == "other" for r in rows):
        lines.append("")
        lines.append(
            f"Note: {inr(by_cat['other'])} sits in \"{_label(labels, 'other')}\" with no budget. That is where the flagged demo "
            "payments landed."
        )
    lines.append("")
    if totals["status"] == "over":
        lines.append("You are past your combined limit, so it is worth trimming for the rest of the month.")
    elif totals["status"] == "warning":
        lines.append("You have used most of this month's budget while there are still days left, so slow down a little.")
    else:
        lines.append("You are on pace. Keep going and you will finish the month inside every limit.")
    return "\n".join(lines)


def _answer_spending(db: Session, user_id: str, _text: str) -> str:
    from sqlalchemy import select

    from .. import models

    by_cat = finance.spending_by_category_paise(db, user_id)
    labels = _labels(db)
    total = finance.spending_this_month_paise(db, user_id)
    if total == 0:
        return "You have not recorded any spending this month yet."
    entries = sorted(((cid, value) for cid, value in by_cat.items() if value > 0), key=lambda e: e[1], reverse=True)
    top_id, top_value = entries[0]
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    debit_count = sum(1 for t in txns if t.direction == "debit")
    lines = [f"You have spent {inr(total)} this month across {debit_count} payments.", ""]
    for cid, value in entries:
        lines.append(f"  • {_label(labels, cid)} — {inr(value)} ({finance.pct(value, total)}%)")
    lines.append("")
    top_label = _label(labels, top_id)
    lines.append(
        f"Most of your money went to {top_label}: {inr(top_value)}, which is {finance.pct(top_value, total)}% of "
        "everything you spent."
    )
    if len(entries) > 1:
        second_id, second_value = entries[1]
        second_label = _label(labels, second_id)
        lines.append(
            f"{second_label} was next at {inr(second_value)} — that is {inr(top_value - second_value)} less than {top_label}."
        )
    lines.append("")
    lines.append("These totals come straight from your transaction list, so they match your dashboard exactly.")
    return "\n".join(lines)


def select_transactions(user_id: str):
    from sqlalchemy import select

    from .. import models

    return select(models.Transaction).where(models.Transaction.user_id == user_id)


def _answer_balance(db: Session, user_id: str, _text: str) -> str:
    balance = finance.available_balance_paise(db, user_id)
    income = finance.income_this_month_paise(db, user_id)
    spend = finance.spending_this_month_paise(db, user_id)
    saved = finance.saved_this_month_paise(db, user_id)
    return "\n".join(
        [
            f"Your available balance is {inr(balance)}.",
            "",
            f"This month you received {inr(income)} and spent {inr(spend)}. You also moved {inr(saved)} into your "
            "savings goals.",
            (
                f"That leaves {inr(income - spend)} of this month's income unspent."
                if income - spend >= 0
                else f"You have spent {inr(spend - income)} more than you received this month — worth watching."
            ),
            "",
            "Balance = opening balance + credits − debits − money moved into goals. All figures are simulated "
            "demo data.",
        ]
    )


def _answer_goals(db: Session, user_id: str, _text: str) -> str:
    rows = finance.goal_rows(db, user_id)
    if not rows:
        return "You have not created a savings goal yet. Add one from the Savings Goals screen."
    lines = ["Here is where your goals stand:", ""]
    for row in rows:
        goal = row["goal"]
        target = f", target {goal.target_date.strftime('%b %Y')}" if goal.target_date else ""
        lines.append(
            f"  • {goal.title} — {inr(row['saved_paise'])} of {inr(goal.target_amount_paise)} "
            f"({row['progress_percent']}%), {inr(row['remaining_paise'])} to go{target}"
        )
    lines.append("")
    lines.append(
        f"You have added {inr(finance.saved_this_month_paise(db, user_id))} this month. Goal figures are "
        "illustrative projections, not investment advice."
    )
    return "\n".join(lines)


def _answer_income(db: Session, user_id: str, _text: str) -> str:
    income = finance.income_this_month_paise(db, user_id)
    spend = finance.spending_this_month_paise(db, user_id)
    return "\n".join(
        [
            f"You received {inr(income)} this month.",
            (
                f"You spent {inr(spend)}, so {inr(abs(income - spend))} is still unspent."
                if income >= spend
                else f"You spent {inr(spend)}, so {inr(abs(income - spend))} more than you received was spent."
            ),
            "",
            "Credits come from your seeded demo income entries — this prototype has no bank connection.",
        ]
    )


def _answer_explain(db: Session, user_id: str, text: str) -> str:
    key = glossary_key_for(text)
    if key:
        return f"{key.upper()}\n\n{GLOSSARY[key]}"
    preview = ", ".join(list(GLOSSARY)[:8])
    return (
        f"I do not have a definition for that one yet.\n\nI do explain: {preview}.\n\n"
        'Or ask me about your own numbers — for example "where did most of my money go?".'
    )


def _fallback(text: str, db: Session, user_id: str) -> str:
    balance = finance.available_balance_paise(db, user_id)
    return "\n".join(
        [
            f'I could not match "{text}" to a question I understand yet.',
            "",
            "I am a prototype assistant running on local rules inside this application — no cloud AI, no API "
            "key. That keeps your demo data private and the answers instant.",
            "",
            "Here is what I am good at with your numbers:",
            '  • Spending summaries — "where did most of my money go?"',
            f'  • Affordability — "can I afford ₹1,500 more?" (your balance is {inr(balance)})',
            '  • Saving plans — "how can I save ₹5,000 this month?"',
            '  • Bills — "which bills are due soon?"',
            '  • Budgets — "explain my budget in simple words"',
            '  • Safety — "how do I stay safe from UPI scams?"',
            '  • Terms — "what is an EMI?"',
            "",
            "I am not a financial adviser, and I never give investment advice.",
        ]
    )


INTENTS: list[tuple[str, object, object]] = []


def _build_intents() -> None:
    INTENTS.extend(
        [
            (
                "greeting",
                lambda q: bool(re.match(r"^(hi|hello|hey|namaste|good morning|good evening|hii)\b", q)) or q == "yo",
                _answer_greeting,
            ),
            (
                "afford",
                lambda q: has_any(q, "afford", "can i buy", "can i purchase", "should i buy", "enough to buy", "enough money"),
                _answer_afford,
            ),
            (
                "save",
                lambda q: has_any(q, "save", "saving", "cut back", "reduce my", "spend less", "how do i save"),
                _answer_save,
            ),
            (
                "bills",
                lambda q: has_any(q, "bill", "due soon", "payment due", "recharge due", "what do i owe", "upcoming payment"),
                _answer_bills,
            ),
            ("budget", lambda q: has_any(q, "budget", "how much can i spend", "limit"), _answer_budget),
            (
                "spending",
                lambda q: has_any(
                    q,
                    "spend",
                    "spent",
                    "money go",
                    "where did",
                    "expenses",
                    "expense",
                    "top category",
                    "most of my money",
                    "biggest",
                    "largest",
                    "category",
                ),
                _answer_spending,
            ),
            (
                "balance",
                lambda q: has_any(q, "balance", "how much do i have", "money do i have", "account balance"),
                _answer_balance,
            ),
            (
                "goals",
                lambda q: has_any(q, "goal", "saving goal", "emergency fund", "laptop", "trip", "how am i doing on"),
                _answer_goals,
            ),
            (
                "safety",
                lambda q: has_any(
                    q, "scam", "fraud", "otp", "upi pin", "phishing", "suspicious", "safety", "safe from", "hacked", "stolen"
                ),
                lambda _db, _user_id, _q: SAFETY_ANSWER,
            ),
            (
                "income",
                lambda q: has_any(q, "income", "salary", "stipend", "earned", "credit in"),
                _answer_income,
            ),
            (
                "explain",
                lambda q: has_any(q, "what is", "what does", "explain", "meaning of", "define", "mean by")
                and glossary_key_for(q) is not None,
                _answer_explain,
            ),
        ]
    )


_build_intents()


def answer(question: str, db: Session, user_id: str) -> str:
    cleaned = " ".join(question.strip().lower().split())
    if not cleaned:
        return "Ask me anything about your money."
    for _name, matcher, responder in INTENTS:
        if matcher(cleaned):  # type: ignore[operator]
            return responder(db, user_id, cleaned)  # type: ignore[operator]
    return _fallback(question.strip(), db, user_id)
