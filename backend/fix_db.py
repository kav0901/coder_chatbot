import mysql.connector
import os
from dotenv import load_dotenv

# Load your Aiven credentials from .env
load_dotenv()

try:
    db = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        port=os.getenv("MYSQL_PORT"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database="defaultdb"
    )
    cursor = db.cursor()
    
    # Add the timestamp column and auto-fill it with the current time
    cursor.execute("ALTER TABLE messages ADD COLUMN timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    db.commit()
    
    print("✅ SUCCESS: Added 'timestamp' column to your 'messages' table!")
    
except mysql.connector.Error as err:
    print(f"❌ ERROR: {err}")
finally:
    if 'cursor' in locals(): cursor.close()
    if 'db' in locals(): db.close()