from flask import Flask, request, jsonify
from pymongo import MongoClient
import jwt
import datetime
import os
import logging

app = Flask(__name__)

# Environment variables
JWT_SECRET = os.environ.get("JWT_SECRET", "defaultsecret")
JWT_EXP_DELTA_SECONDS = 3600
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/authdb")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client.authdb
users = db.users

@app.route("/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json()
    logger.info(f"Received registration data: {data}")
    #  {'user': {'email': 'sh.yosef@gmail.com', 'password': '111', 'full_name': 'tt nn'}}

    if not data or not isinstance(data, dict):
        logger.warning("Registration failed: No data provided")
        return jsonify({"error": "No valid data provided"}), 400
    user = data.get("user")
    email = user.get("email") if user else None
    password = user.get("password") if user else None
    full_name = user.get("full_name") if user else None
    logger.info(f"Registration attempt for email: {email}, full_name: {full_name}")
    first_name, last_name = (full_name.split(" ") if full_name else (None, None))

    if not first_name or not password or not email:
        logger.warning("Registration failed: First name,  email, and password are required")
        return jsonify({"error": "First name, last name, email, and password are required"}), 400

    if users.find_one({"email": email}):
        logger.warning(f"Registration failed: User with email '{email}' already exists")
        return jsonify({"error": "User with this email already exists"}), 400

    users.insert_one({"email": email, "password": password, "first_name": first_name, "last_name": last_name})
    logger.info(f"User with email '{email}' registered successfully.")
    return jsonify({"message": f"User with email '{email}' registered successfully."}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    logger.info(f"Login attempt for username: {username}")

    user = users.find_one({"username": username})
    if not user or user["password"] != password:
        logger.warning(f"Login failed for username: {username}")
        return jsonify({"error": "Invalid credentials"}), 401

    payload = {
        "user": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    logger.info(f"Login successful for username: {username}")

    return jsonify({"token": token})


@app.route("/verify", methods=["POST"])
def verify():
    token = request.get_json().get("token")
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        logger.info(f"Token verification successful for user: {decoded['user']}")
        return jsonify({"valid": True, "user": decoded["user"]})
    except jwt.ExpiredSignatureError:
        logger.warning("Token verification failed: Token expired")
        return jsonify({"valid": False, "error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        logger.warning("Token verification failed: Invalid token")
        return jsonify({"valid": False, "error": "Invalid token"}), 401


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    logger.info(f"Auth app is running on http://{host}:{port}")
    app.run(host=host, port=port)
