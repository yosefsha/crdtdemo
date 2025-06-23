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


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    logger.info(f"Received login data: {data}")
    if not data or not isinstance(data, dict):
        logger.warning("Login failed: No data provided")
        return jsonify({"error": "No valid data provided"}), 400
    user_data = data.get("user")
    email = user_data.get("email") if user_data else None
    password = user_data.get("password") if user_data else None

    # TODO: add additional validation for username and password length
    # if len(data["username"]) < 3 or len(data["password"]) < 6:

    logger.info(f"Login attempt for email: {email}")

    user_from_db = users.find_one({"email": email})
    if not user_from_db or user_from_db["password"] != password:
        logger.warning(f"Login failed for email: {email}")
        return jsonify({"error": "Invalid credentials"}), 401

    payload = {
        "user": email,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    logger.info(f"Login successful for username: {email}")
    #  return user object without password but with token
    user_info = {
        "email": user_from_db["email"],
        "first_name": user_from_db.get("first_name"),
        "last_name": user_from_db.get("last_name")
    }
    logger.info(f"Generated token for user: {user_info}")
    return jsonify({"token": token, "user": user_info}), 200


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
