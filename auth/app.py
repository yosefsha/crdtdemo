from flask import Flask, request, jsonify
from pymongo import MongoClient
import jwt
import datetime
import os

app = Flask(__name__)

# Environment variables
JWT_SECRET = os.environ.get("JWT_SECRET", "defaultsecret")
JWT_EXP_DELTA_SECONDS = 3600
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/authdb")

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client.authdb
users = db.users

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if users.find_one({"username": username}):
        return jsonify({"error": "User already exists"}), 400

    users.insert_one({"username": username, "password": password})
    return jsonify({"message": f"User '{username}' registered successfully."}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = users.find_one({"username": username})
    if not user or user["password"] != password:
        return jsonify({"error": "Invalid credentials"}), 401

    payload = {
        "user": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return jsonify({"token": token})


@app.route("/verify", methods=["POST"])
def verify():
    token = request.get_json().get("token")
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return jsonify({"valid": True, "user": decoded["user"]})
    except jwt.ExpiredSignatureError:
        return jsonify({"valid": False, "error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"valid": False, "error": "Invalid token"}), 401


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 4000
    print(f"Auth app is running on http://{host}:{port}")
    app.run(host=host, port=port)
