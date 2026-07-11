from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
import mysql.connector
import os
from dotenv import load_dotenv

# Load your Gemini API key from the .env file
load_dotenv()

app = FastAPI()

origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = origins_str.split(",")

# Allow React to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client()

# The Professional AI Brain
SYSTEM_INSTRUCTION = """
You are an elite, highly professional AI coding assistant and senior software engineer.
Your primary goal is to provide concise, accurate, and highly readable answers.

CRITICAL FORMATTING RULES:
1. NEVER output a giant wall of text. Break your answers into distinct, logical sections using Markdown headings (###).
2. When analyzing an error, always use this structure:
   - ### 🔍 Root Cause: (Briefly explain why it broke in 1-2 sentences).
   - ### 🛠️ Solution: (Provide the step-by-step fix using numbered lists).
3. When providing code, ALWAYS wrap it in standard Markdown code blocks with the correct language tag.
4. Keep explanations crisp. Use bullet points for lists and **bold text** to emphasize key variables.
5. Do not use filler phrases. Get straight to the technical answer.
"""

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        port=os.getenv("MYSQL_PORT"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database="defaultdb" # Aiven's default database name
    )

# ENDPOINT 1: Get all chat threads for the sidebar
@app.get("/api/conversations/{user_id}")
async def get_conversations(user_id: str):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT conversation_id, title FROM conversations WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    conversations = cursor.fetchall()
    cursor.close()
    db.close()
    return conversations

# ENDPOINT 2: Create a new chat thread
@app.post("/api/conversations")
async def create_conversation(user_id: str = Form(...)):
    db = get_db_connection()
    cursor = db.cursor()
    
    # Auto-register new users so the database doesn't crash on Foreign Keys
    cursor.execute("INSERT IGNORE INTO users (user_id, email) VALUES (%s, %s)", (user_id, f"{user_id}@developer.com"))
    
    # Create the conversation
    cursor.execute("INSERT INTO conversations (user_id, title) VALUES (%s, %s)", (user_id, "New Chat"))
    db.commit()
    new_id = cursor.lastrowid
    
    cursor.close()
    db.close()
    return {"conversation_id": new_id, "title": "New Chat"}

# ENDPOINT 3: Get messages for a specific chat
@app.get("/api/messages/{conversation_id}")
async def get_messages(conversation_id: int):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT sender, content FROM messages WHERE conversation_id = %s ORDER BY timestamp ASC", (conversation_id,))
    messages = cursor.fetchall()
    cursor.close()
    db.close()
    return messages


# ENDPOINT: Delete a conversation
@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int):
    db = get_db_connection()
    cursor = db.cursor()
    # ⚠️ CRITICAL: We must delete the messages inside the chat first, 
    # otherwise MySQL will block the deletion to protect the Foreign Key logic.
    cursor.execute("DELETE FROM messages WHERE conversation_id = %s", (conversation_id,))
    cursor.execute("DELETE FROM conversations WHERE conversation_id = %s", (conversation_id,))
    db.commit()
    cursor.close()
    db.close()
    return {"status": "success"}

# ENDPOINT: Rename a conversation
@app.put("/api/conversations/{conversation_id}")
async def rename_conversation(conversation_id: int, title: str = Form(...)):
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("UPDATE conversations SET title = %s WHERE conversation_id = %s", (title, conversation_id))
    db.commit()
    cursor.close()
    db.close()
    return {"status": "success"}


# ENDPOINT 4: Talk to the AI
@app.post("/api/chat")
async def chat_endpoint(
    user_id: str = Form(...), 
    conversation_id: int = Form(...),
    message: str = Form(...),
    image: UploadFile = File(None)
):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    try:
        # Fetch Memory
        cursor.execute("SELECT sender, content FROM messages WHERE conversation_id = %s ORDER BY timestamp ASC", (conversation_id,))
        history = cursor.fetchall()
        
        formatted_contents = []
        for msg in history:
            role = "user" if msg['sender'] == "user" else "model"
            formatted_contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg['content'])]))

        # Save User Message
        cursor.execute("INSERT INTO messages (conversation_id, sender, content) VALUES (%s, %s, %s)", (conversation_id, 'user', message))
        db.commit()

        # Format Request
        new_parts = [types.Part.from_text(text=message)]
        if image:
            image_data = await image.read()
            new_parts.append(types.Part.from_bytes(data=image_data, mime_type=image.content_type))
        formatted_contents.append(types.Content(role="user", parts=new_parts))

        # Call Gemini API
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=formatted_contents,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION, temperature=0.2)
        )

        # Save AI Response
        ai_reply = response.text
        cursor.execute("INSERT INTO messages (conversation_id, sender, content) VALUES (%s, %s, %s)", (conversation_id, 'ai', ai_reply))
        db.commit()

        return {"response": ai_reply}

    except Exception as e:
        print(f"🚨 CHAT CRASH REASON: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()