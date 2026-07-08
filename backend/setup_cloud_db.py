import mysql.connector
import os
from dotenv import load_dotenv

# Load your new cloud credentials from .env
load_dotenv()

def setup_database():
    print("⏳ Connecting to Aiven Cloud Database...")
    try:
        db = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST"),
            port=os.getenv("MYSQL_PORT"),
            user=os.getenv("MYSQL_USER"),
            password=os.getenv("MYSQL_PASSWORD"),
            database="defaultdb" # Aiven defaults to this database name
        )
        cursor = db.cursor()
        print("✅ Connected to the cloud!")

        print("🏗️ Creating tables...")
        
        # 1. Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            firebase_uid VARCHAR(255) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            display_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # 2. Conversations Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            conversation_id INT AUTO_INCREMENT PRIMARY KEY,
            firebase_uid VARCHAR(255),
            title VARCHAR(255) DEFAULT 'New Chat',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
        )
        """)

        # 3. Messages Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            message_id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT,
            sender ENUM('user', 'ai') NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
        )
        """)

        db.commit()
        print("🎉 Cloud database setup complete! Your tables are ready.")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    setup_database()