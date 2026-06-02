import urllib.request
import urllib.parse
import json
import random

def test_full_workflow():
    base_url = "http://127.0.0.1:8080"
    random_id = random.randint(1000, 9999)
    email = f"testuser_{random_id}@spendlens.com"
    password = "password123"
    name = f"Test User {random_id}"
    
    print(f"Testing full workflow for user: {name} ({email})")
    
    # 1. Register
    reg_url = f"{base_url}/api/auth/register"
    reg_payload = json.dumps({
        "name": name,
        "email": email,
        "password": password,
        "upi_id": "test@upi"
    }).encode("utf-8")
    
    req_reg = urllib.request.Request(reg_url, data=reg_payload, method="POST")
    req_reg.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req_reg) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print("STEP 1: Registration Success!")
            print(res_data)
    except Exception as e:
        print("STEP 1: Registration Error:")
        print(e)
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))
        return

    # 2. Login
    login_url = f"{base_url}/api/auth/login"
    login_data = urllib.parse.urlencode({
        "username": email,
        "password": password
    }).encode("utf-8")
    
    req_login = urllib.request.Request(login_url, data=login_data, method="POST")
    req_login.add_header("Content-Type", "application/x-www-form-urlencoded")
    
    token = None
    try:
        with urllib.request.urlopen(req_login) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            token = res_data.get("access_token")
            print("STEP 2: Login Success!")
            print(f"Token: {token[:15]}...")
    except Exception as e:
        print("STEP 2: Login Error:")
        print(e)
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))
        return

    # 3. Create a room
    room_url = f"{base_url}/api/auth/create-room"
    room_payload = json.dumps({
        "name": f"Test Room {random_id}"
    }).encode("utf-8")
    
    req_room = urllib.request.Request(room_url, data=room_payload, method="POST")
    req_room.add_header("Content-Type", "application/json")
    req_room.add_header("Authorization", f"Bearer {token}")
    
    room_invite = None
    try:
        with urllib.request.urlopen(req_room) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            room_invite = res_data.get("invite_code")
            print("STEP 3: Create Room Success!")
            print(res_data)
    except Exception as e:
        print("STEP 3: Create Room Error:")
        print(e)
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))
        return

    # 4. Log an expense
    expense_url = f"{base_url}/api/expenses/"
    expense_payload = json.dumps({
        "amount": 250.50,
        "category": "groceries",
        "vendor": "Zepto Store",
        "payment_mode": "UPI",
        "date": "2026-05-31",
        "is_shared": True,
        "tags": ["testing", "milk"],
        "notes": "Testing workflow script auto log"
    }).encode("utf-8")
    
    req_expense = urllib.request.Request(expense_url, data=expense_payload, method="POST")
    req_expense.add_header("Content-Type", "application/json")
    req_expense.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req_expense) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print("STEP 4: Log Expense Success!")
            print(res_data)
    except Exception as e:
        print("STEP 4: Log Expense Error:")
        print(e)
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))
        return

    # 5. Fetch summary
    summary_url = f"{base_url}/api/analytics/summary"
    req_summary = urllib.request.Request(summary_url, method="GET")
    req_summary.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req_summary) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print("STEP 5: Get Summary Success!")
            print(f"Total Spend: {res_data.get('total_spend')}")
            print(f"User Breakdown count: {len(res_data.get('user_breakdown'))}")
    except Exception as e:
        print("STEP 5: Get Summary Error:")
        print(e)
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))

if __name__ == "__main__":
    test_full_workflow()
