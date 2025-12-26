from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import psycopg2.pool
import jwt
import datetime
import os
import logging

app = Flask(__name__)

# Environment variables
JWT_SECRET = os.environ.get("JWT_SECRET", "defaultsecret")
JWT_EXP_DELTA_SECONDS = 3600
POSTGRES_URL = os.environ.get("POSTGRES_URL", "postgresql://postgres:postgres@localhost:5432/crdtdemo")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# Create connection pool
db_pool = psycopg2.pool.SimpleConnectionPool(1, 20, POSTGRES_URL)

# Initialize users table
def init_db():
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    name TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            """)
            conn.commit()
            logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        conn.rollback()
    finally:
        db_pool.putconn(conn)

init_db()

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
    name = user.get("name") if user else None
    logger.info(f"Registration attempt for email: {email}, name: {name}")
    
    if not name or not password or not email:
        logger.warning("Registration failed: name, email, and password are required")
        return jsonify({"error": "Name, email, and password are required"}), 400
    
    conn = db_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if user exists
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                logger.warning(f"Registration failed: User with email '{email}' already exists")
                return jsonify({"error": "User with this email already exists"}), 400
            
            # Insert new user
            cur.execute(
                "INSERT INTO users (email, password, name) VALUES (%s, %s, %s) RETURNING id",
                (email, password, name)
            )
            user_id = cur.fetchone()['id']
            conn.commit()
            logger.info(f"User with email '{email}' registered successfully.")
            return jsonify({"message": f"User with email '{email}' registered successfully."}), 201
    except Exception as e:
        logger.error(f"Registration error: {e}")
        conn.rollback()
        return jsonify({"error": "Registration failed"}), 500
    finally:
        db_pool.putconn(conn)

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
    
    logger.info(f"Login attempt for email: {email}")
    
    conn = db_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            user_from_db = cur.fetchone()
            
            if not user_from_db or user_from_db['password'] != password:
                logger.warning(f"Login failed for email: {email}")
                return jsonify({"error": "Invalid credentials"}), 401
            
            payload = {
                "user": email,
                "user_id": str(user_from_db['id']),
                "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
            }
            token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
            logger.info(f"Login successful for username: {email}")
            
            # Return user object without password but with token
            user_info = {
                "userId": str(user_from_db['id']),
                "email": user_from_db["email"],
                "name": user_from_db.get("name")
            }
            logger.info(f"Generated token for user: {user_info}")
            return jsonify({"token": token, "user": user_info}), 200
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500
    finally:
        db_pool.putconn(conn)

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
