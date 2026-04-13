#!/usr/bin/env python3
"""
Seed the SLOW resource library with the Salone OIM core icons from the GitHub wiki.
Downloads each icon image and uploads it to the backend API.

Usage:
  python3 scripts/seed_icons.py

Requires a running backend at http://127.0.0.1:3001/api and an owner/admin account.
"""
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.request
import urllib.error

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

API = os.environ.get("API_URL", "http://127.0.0.1:3001/api")

ICONS = [
    # --- Currency ---
    {"code": "C3", "title": "0.1 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/361ea1fc-ee61-450e-933f-35a9f4f45459"},
    {"code": "C4", "title": "0.25 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/b6d0adb5-0605-4a3e-8d73-b73a3a1ce598"},
    {"code": "C5", "title": "0.5 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/fb3ede9b-b385-43b4-b582-b027d32a0538"},
    {"code": "C6", "title": "1 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/3a5e00e4-fcdf-4458-8bc9-1cd8a18e6bef"},
    {"code": "C7", "title": "2 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/ca873a5f-769f-4fff-943e-8129fb05271b"},
    {"code": "C8", "title": "5 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/36c953ff-a722-4951-811f-6ae42fcfd92f"},
    {"code": "C10", "title": "10 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/27a5dca1-05d5-4b85-8066-9fb2d6fc3c24"},
    {"code": "C11", "title": "100 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/4b43a726-b411-4139-9b70-70c2fc8ad92d"},
    {"code": "C12", "title": "1000 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/5ea8fb83-4e7d-424b-bf57-48771e783645"},
    {"code": "C13", "title": "10000 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/9b2ae040-df5c-4052-be4c-6da0177c5d48"},
    {"code": "C14", "title": "100000 NLe", "category": "Savings", "sub": "Currency", "url": "https://github.com/user-attachments/assets/0c385dba-ba6c-4d9a-a91b-08484d4d028e"},

    # --- Mnemonics ---
    {"code": "M1", "title": "Zero", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/ad6dd539-3f77-4991-b525-0c94ace7fc49"},
    {"code": "M2", "title": "One", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/fa1af233-63f0-4f2d-8087-8b7346eea4e8"},
    {"code": "M3", "title": "Two", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/aa7a0aab-d69b-4d1c-814a-38552a19992f"},
    {"code": "M4", "title": "Three", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/75d0c50f-64b8-4c85-b5e2-4badce1a2deb"},
    {"code": "M5", "title": "Four", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/1ab573a3-367b-42a0-9cbb-f69b9f74a757"},
    {"code": "M6", "title": "Five", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/76e5c562-bb3f-4adc-9427-bbf5facc0657"},
    {"code": "M7", "title": "Six", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/c72284ab-1bbe-4fba-8281-2cf8cc98dca4"},
    {"code": "M8", "title": "Seven", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/a79d05c7-5bbe-49e6-a9f6-2ee07a718144"},
    {"code": "M9", "title": "Eight", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/305c01f5-3ae0-4af9-b4bf-8b9b3bd63c77"},
    {"code": "M10", "title": "Nine", "category": "Savings Groups", "sub": "Mnemonics", "url": "https://github.com/user-attachments/assets/6b481c37-92c2-48d3-8afa-3dc23c1762d3"},

    # --- Navigation ---
    {"code": "N1", "title": "Total", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/07a055c1-3318-41f2-850c-6bed7e41d84f"},
    {"code": "N2", "title": "Meeting", "category": "Savings Groups", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/a993ff5c-8c19-4509-975e-257e35032008"},
    {"code": "N3", "title": "Day", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/c0ca961c-c95f-458c-a0cb-bbbf4bf1aae2"},
    {"code": "N4", "title": "Month", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/69c22675-67ed-4091-82c1-db923d0246c1"},
    {"code": "N5", "title": "Year", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/59f3dc78-63f5-4a97-85be-f5cc7303779d"},
    {"code": "N6", "title": "Phone number input field", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/ab1cc998-f883-4ae9-9d4a-e60657f17b1a"},
    {"code": "N7", "title": "Account number input field", "category": "Savings", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/b54455dd-5242-4d48-85fc-68a8d4a933df"},
    {"code": "N8", "title": "Currency frame input field", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/8df464f1-c1b0-4047-b1fc-3d2078f99c4b"},
    {"code": "N9", "title": "Date input field", "category": "Payments", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/c073462d-0949-4abe-99aa-75232d6c36f2"},
    {"code": "N10", "title": "Loan duration input field", "category": "Individual Loans", "sub": "Navigation", "url": "https://github.com/user-attachments/assets/57c78ecc-6104-4cda-9b68-2917cbec1dfa"},

    # --- Identity ---
    {"code": "I1", "title": "National ID Card", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/3e9ea08b-7878-4bf6-af35-ee0b29dd6f1c"},
    {"code": "I2", "title": "Name (female)", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/b6ae949e-ffb0-4d8c-b44f-8929acca00d9"},
    {"code": "I3", "title": "Name (male)", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/bf8b2499-68ba-4bf9-879d-d0f03f5643a3"},
    {"code": "I4", "title": "Address", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/367ff9ab-4f44-43e8-b393-805405fc7241"},
    {"code": "I5", "title": "Phone", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/b6f2bf6a-348c-4c79-b176-98767b05c318"},
    {"code": "I6", "title": "Date of Birth", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/135a5e3e-a62f-4d53-b509-2b6be3eb852f"},
    {"code": "I7", "title": "Place of Birth", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/1177e601-8852-423e-b053-ff270c690a53"},
    {"code": "I8", "title": "Married", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/b1b90561-b082-4343-aa1b-c25012d72968"},
    {"code": "I9", "title": "Single", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/c3f19b6e-e700-41b9-b845-1c27e9679846"},
    {"code": "I10", "title": "Widowed", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/d46645dd-9e4d-48c5-963d-61feba362d1e"},
    {"code": "I11", "title": "Divorced", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/04127dc0-4cb8-4e3f-ad0a-a2cda0f76a40"},
    {"code": "I12", "title": "Beneficiary", "category": "Insurance", "sub": "Identity", "url": "https://github.com/user-attachments/assets/8b2b2894-b1c3-48f3-a87e-28c1ec2877c8"},
    {"code": "I13", "title": "Schooling", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/c3574b8b-75f2-4663-821e-2786e827e44d"},
    {"code": "I14", "title": "Name of spouse (female)", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/09a62b23-b5b5-4282-aad3-83299022a575"},
    {"code": "I15", "title": "Name of spouse (male)", "category": "Savings", "sub": "Identity", "url": "https://github.com/user-attachments/assets/91455dea-89d2-4b3d-a5ef-8cb3b21308e5"},
    {"code": "I16", "title": "Alternative Contact", "category": "Insurance", "sub": "Identity", "url": "https://github.com/user-attachments/assets/7e44f1c6-4a00-4805-996c-fdadb149b9a5"},

    # --- Transactions ---
    {"code": "T1", "title": "Deposit", "category": "Savings", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/8d288bfb-aa21-4aa9-ba01-8f56649561bc"},
    {"code": "T2", "title": "Withdrawal", "category": "Savings", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/a625caa2-1de1-4c0c-8570-83e5963eeaf3"},
    {"code": "T3", "title": "Interest", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/b4ff9f4e-8c2a-4b35-88b5-e22b957b19b0"},
    {"code": "T4", "title": "Guarantor", "category": "Group Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/e19de99b-8efd-4e24-b07c-ec668c715860"},
    {"code": "T5", "title": "Repayment", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/8943c8cd-3ba2-45f2-a66c-db71873a2ba2"},
    {"code": "T6", "title": "Processing fee", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/080a2e4f-80b5-4cac-a765-e2f1936bd114"},
    {"code": "T7", "title": "Loan agreement", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/c8041580-0f7e-47a9-a811-2686ee08f82a"},
    {"code": "T8", "title": "Signature", "category": "Savings", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/30b420a9-a07b-4ab1-85f7-6ebb7c23227e"},
    {"code": "T9", "title": "Balance", "category": "Savings", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/b689beaa-86a7-4afa-b266-62bf569ae46d"},
    {"code": "T10", "title": "Penalty fee", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/27d25180-9f16-493b-9ab6-7bf4e85ab0c1"},
    {"code": "T11", "title": "Disbursement", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/e42523b8-6745-4e08-8e59-ac1c282e62a3"},
    {"code": "T12", "title": "Witness (female)", "category": "Group Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/65cb5cdb-1cd7-41eb-ad55-9cbc4edfd319"},
    {"code": "T13", "title": "Witness (male)", "category": "Group Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/f51a3100-2c39-4bc3-858f-8320f3d04efd"},
    {"code": "T14", "title": "Loan request", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/93e154d5-d4ed-4d97-bc9c-1f82a26dfb6b"},
    {"code": "T15", "title": "Loan approved", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/89100469-5e1c-467d-a8bf-6b6564fe73b8"},
    {"code": "T16", "title": "Purpose or Goal", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/9288c67b-ae80-4178-b010-074e90fd5b5b"},
    {"code": "T17", "title": "Collateral (land)", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/30921fde-22ec-4a81-b6cb-77cf96efcdfe"},
    {"code": "T18", "title": "Collateral (vehicle)", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/138e75d7-a223-4b1c-b38a-aa4daf9b4e59"},
    {"code": "T19", "title": "Collateral (equipment)", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/911f0796-f8f9-468b-8316-3223985759c1"},
    {"code": "T20", "title": "Collateral (livestock)", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/733bb700-79f5-46cf-be48-ae5a25e86f4a"},
    {"code": "T21", "title": "Income", "category": "Savings", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/d4b51b02-3325-4e6c-b025-1af1aea9d52d"},
    {"code": "T22", "title": "Weekly", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/365c49b4-c3b6-4ba8-9ea7-2513e3f4f8fd"},
    {"code": "T23", "title": "Biweekly", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/455ac54f-3e9e-40b9-88ca-54c20098ef63"},
    {"code": "T24", "title": "Monthly", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/165675f4-2384-4c9e-82a3-377a11e6c474"},
    {"code": "T25", "title": "Payment (cash)", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/0913d9a9-22a4-4cbd-9fc2-eee4846c1644"},
    {"code": "T26", "title": "Payment (cheque)", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/ba6258ce-6d13-463c-8f96-c44cb941431f"},
    {"code": "T27", "title": "Payment (phone)", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/4734b9cd-beda-4640-a2c4-03ab0170be72"},
    {"code": "T28", "title": "Payor", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/b3d761d8-e8ab-4181-b77b-c29a4b218e7d"},
    {"code": "T29", "title": "FSP / NSWO", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/1a3a8c9c-5242-484a-9205-289c97f44aac"},
    {"code": "T30", "title": "Received from", "category": "Payments", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/811b4295-de9f-4ae2-8840-ff867b81224f"},
    {"code": "T31", "title": "Group leader", "category": "Group Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/50e1bffc-a894-43fa-b9e1-7a7f1e181ee0"},
    {"code": "T32", "title": "Borrower", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/ec0dd760-7e73-4b13-b240-e4263825aeee"},
    {"code": "T33", "title": "Loan officer", "category": "Individual Loans", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/667c6945-2b1a-4f37-aab6-75e6c94b9ba0"},
    {"code": "T34", "title": "Cashier", "category": "Savings", "sub": "Transactions", "url": "https://github.com/user-attachments/assets/d9cd628a-cc70-49d4-a328-92632c096718"},
]


def get_or_create_owner_token():
    """Sign up or login as the seeder account."""
    email = "seed@slow-library.org"
    password = "SeedIcons2026!"
    name = "SLOW Library"

    # Try signup first
    body = json.dumps({"name": name, "email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{API}/auth/signup",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            print(f"  Created seed account: {email}")
            return data["token"]
    except urllib.error.HTTPError:
        pass

    # Fall back to login
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{API}/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(f"  Logged in as seed account: {email}")
        return data["token"]


def download_image(url):
    """Download image bytes from GitHub."""
    req = urllib.request.Request(url, headers={"User-Agent": "SLOW-Seed/1.0"})
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
        return resp.read(), resp.headers.get("Content-Type", "image/png")


def build_multipart(fields, file_field, file_data, filename, content_type):
    """Build a multipart/form-data body."""
    boundary = "----SLOWSeedBoundary"
    body = b""
    for key, value in fields.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode()
        body += f"{value}\r\n".encode()

    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode()
    body += f"Content-Type: {content_type}\r\n\r\n".encode()
    body += file_data
    body += f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def upload_icon(token, icon, existing_titles):
    """Upload a single icon as a resource."""
    full_title = f"{icon['code']} {icon['title']}"
    if full_title in existing_titles:
        print(f"  SKIP {full_title} (already exists)")
        return False

    try:
        img_data, mime = download_image(icon["url"])
    except Exception as e:
        print(f"  FAIL {full_title}: download error: {e}")
        return False

    ext = "png"
    if "jpeg" in (mime or ""):
        ext = "jpg"
    elif "svg" in (mime or ""):
        ext = "svg"

    fields = {
        "title": full_title,
        "description": f"OIM icon: {icon['title']} ({icon['sub']})",
        "country": "Sierra Leone",
        "category": icon["category"],
        "type": "Icon",
        "productDetail": "",
        "crossCuttingCategory": "Icons",
        "institution": "My Oral Village",
        "keywords": f"{icon['code']}, {icon['title']}, {icon['sub']}, OIM, icon",
    }

    filename = f"{icon['code']}_{icon['title'].replace(' ', '_').replace('/', '_')}.{ext}"
    body, content_type = build_multipart(fields, "file", img_data, filename, mime or "image/png")

    req = urllib.request.Request(
        f"{API}/resources",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            print(f"  OK   {full_title} -> {result['id']}")
            return True
    except urllib.error.HTTPError as e:
        err = e.read().decode() if e.fp else str(e)
        print(f"  FAIL {full_title}: {e.code} {err[:120]}")
        return False


def get_existing_titles(token):
    """Fetch all existing resource titles to avoid duplicates."""
    req = urllib.request.Request(
        f"{API}/resources?limit=100&offset=0",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return {r["title"] for r in data.get("rows", [])}
    except Exception:
        return set()


def main():
    print(f"Seeding {len(ICONS)} OIM icons into {API}")
    print()

    token = get_or_create_owner_token()
    existing = get_existing_titles(token)
    print(f"  Found {len(existing)} existing resources")
    print()

    ok = 0
    skip = 0
    fail = 0
    for icon in ICONS:
        result = upload_icon(token, icon, existing)
        if result is True:
            ok += 1
        elif result is False and f"{icon['code']} {icon['title']}" in existing:
            skip += 1
        else:
            fail += 1

    print()
    print(f"Done: {ok} uploaded, {skip} skipped, {fail} failed out of {len(ICONS)}")


if __name__ == "__main__":
    main()
