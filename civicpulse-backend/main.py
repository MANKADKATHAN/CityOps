import os
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from a .env file if present
load_dotenv()

app = FastAPI(title="CivicPulse Backend")

# Enable CORS for Vercel/Any Frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# DATABASE SETUP (Supabase)
# -----------------------------------------------------------------------------
url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_ANON_KEY", "")

supabase: Client = None

if url and key:
    try:
        supabase = create_client(url, key)
        print("Connected to Supabase")
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
else:
    print("Warning: SUPABASE_URL or SUPABASE_ANON_KEY not found. Database features will fail.")

# -----------------------------------------------------------------------------
# AI CLIENT SETUP (Gemini)
# -----------------------------------------------------------------------------
# Attempt to use GEMINI_API_KEY, fallback to OPENAI_API_KEY if that's where the user put it
gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
    print("Connected to Google Gemini")
else:
    print("Warning: GEMINI_API_KEY (or OPENAI_API_KEY) not found. Chatbot will use simulated fallback.")


# -----------------------------------------------------------------------------
# DATA MODELS (Pydantic)
# -----------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    language: Optional[str] = "English"

class ExtractedData(BaseModel):
    issue_type: Optional[str] = None
    description: Optional[str] = None
    location_text: Optional[str] = None

class ChatResponse(BaseModel):
    assistantReply: str
    extractedData: Optional[ExtractedData] = None

class ComplaintCreate(BaseModel):
    issue_type: str
    description: str
    location_text: str
    latitude: float
    longitude: float
    assigned_department: Optional[str] = None
    priority: str  # Low, Medium, High
    image_url: Optional[str] = None
    user_id: Optional[str] = None

class ResolutionNotification(BaseModel):
    complaint_id: str
    user_email: str
    user_name: str
    issue_description: str

class ComplaintResponse(BaseModel):
    success: bool
    complaint_id: str


# -----------------------------------------------------------------------------
# 1) HEALTH CHECK
# -----------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok"}


# -----------------------------------------------------------------------------
# 1.5) VISION ANALYSIS ENDPOINT
# -----------------------------------------------------------------------------
from agents import run_vision_agent

class ImageAnalysisRequest(BaseModel):
    image_url: str

@app.post("/analyze-image")
async def analyze_image(request: ImageAnalysisRequest):
    """
    Analyzes an image URL to detect civic issues.
    """
    print(f"Received image analysis request for: {request.image_url}")
    result = run_vision_agent(request.image_url)
    
    if not result:
        raise HTTPException(status_code=500, detail="Image analysis failed")
        
    return result


# -----------------------------------------------------------------------------
# 2) AI CHATBOT ENDPOINT (Gemini Powered)
# -----------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Analyzes a citizen's message using Gemini to:
    1. Act as a helpful civic assistant.
    2. Extract structural data (issue_type, location, description).
    """
    
    # SYSTEM PROMPT for the AI
    system_prompt = f"""
    You are a helpful Civic Assistant for the 'CivicPulse' Smart City App. 
    You are MULTILINGUAL.
    
    CRITICAL INSTRUCTION: The user has selected their preferred language as: '{request.language}'.
    You MUST reply to them in '{request.language}' ONLY.

    GOAL:
    1. Respond to the user IN '{request.language}'.
    2. Be friendly and concise.
    
    DATA EXTRACTION (Critical):
    Even if the user speaks Hindi or Gujarati, you must extract the data in a specific format for the database:
    
    1. `issue_type`: MUST be strictly one of these English terms: ["Garbage", "Road", "Water", "Streetlight", "General"].
       - Example: If user says "paninu leakage che" (Gujarati), issue_type is "Water".
       - Example: If user says "sadak kharab hai" (Hindi), issue_type is "Road".
    
    2. `description`: Translate the user's complaint summary into ENGLISH for the official report.
    
    3. `location_text`: Extract the location. If it's in local script, try to transliterate to English alphabet (e.g. "Chandkheda").

    Output JSON format ONLY:
    {{
      "assistantReply": "Your response in {request.language}...",
      "extractedData": {{
        "issue_type": "Garbage", 
        "description": "English summary for database...", 
        "location_text": "Location name"
      }}
    }}
    """

    if gemini_api_key:
        try:
            model = genai.GenerativeModel("gemini-pro")
            
            full_prompt = f"{system_prompt}\n\nUser Message: {request.message}"
            
            response = model.generate_content(full_prompt)
            response_text = response.text
            
            # Clean up potential markdown code blocks
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            
            try:
                data = json.loads(clean_text)
                return ChatResponse(
                    assistantReply=data.get("assistantReply", "I've noted that."),
                    extractedData=ExtractedData(
                        issue_type=data.get("extractedData", {}).get("issue_type"),
                        location_text=data.get("extractedData", {}).get("location_text"),
                        description=data.get("extractedData", {}).get("description")
                    )
                )
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails but we got text
                return ChatResponse(
                    assistantReply=clean_text, # Just return the text if it's not JSON
                    extractedData=ExtractedData(description=request.message) 
                )

        except Exception as e:
            print(f"Gemini Error: {e}") 
            # Fall through to fallback logic
            pass

    # --- FALLBACK LOGIC (Regex/Keyword) ---
    # Used if Key is missing or errors out
    message_lower = request.message.lower()
    issue_type = "General"
    
    # Simple keyword matching for demo purposes
    if "garbage" in message_lower or "trash" in message_lower or "rubbish" in message_lower: 
        issue_type = "Garbage"
    elif "road" in message_lower or "pothole" in message_lower: 
        issue_type = "Road"
    elif "water" in message_lower or "leak" in message_lower or "pipe" in message_lower: 
        issue_type = "Water"
    elif "light" in message_lower or "lamp" in message_lower or "dark" in message_lower: 
        issue_type = "Streetlight"
    
    # Construct a helpful "simulated" AI response
    reply = f"I've identified this as a '{issue_type}' issue. I've automatically filled out the form for you with the details."
    
    return ChatResponse(
        assistantReply=reply,
        extractedData=ExtractedData(
            issue_type=issue_type,
            description=request.message,
            location_text="" 
        )
    )


# -----------------------------------------------------------------------------
# 3) COMPLAINT SUBMISSION ENDPOINT
# -----------------------------------------------------------------------------
from agents import run_classification_agent, run_routing_agent

@app.post("/complaints", response_model=ComplaintResponse)
def create_complaint(complaint: ComplaintCreate):
    """
    Saves a verified complaint.
    Uses 'Agentic Logic' to classify and route the complaint automatically.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection not configured.")

    new_complaint_id = str(uuid.uuid4())
    
    # ---------------------------------------------------------
    # AGENTIC FLOW START (Wrapped in Try/Except to prevent 500 crashes)
    # ---------------------------------------------------------
    try:
        # 1. Run Classification Agent
        normalized_issue_type = run_classification_agent(complaint.issue_type)
        
        # 2. Run Routing Agent
        final_dept = run_routing_agent(normalized_issue_type)
        
        print(f"Agents Result: Type={normalized_issue_type}, Dept={final_dept}")

    except Exception as agent_error:
        print(f"CRITICAL AGENT ERROR: {agent_error}")
        # Fallback values so we save SOMETHING instead of crashing
        normalized_issue_type = complaint.issue_type
        final_dept = "City Helpdesk (Fallback)"
    
    # ---------------------------------------------------------
    # AGENTIC FLOW END
    # ---------------------------------------------------------

    data = {
        "complaint_id": new_complaint_id,
        "issue_type": normalized_issue_type, # Use normalized type
        "description": complaint.description,
        "location_text": complaint.location_text,
        "latitude": complaint.latitude,
        "longitude": complaint.longitude,
        "assigned_department": final_dept,   # Use agent-assigned dept
        "priority": complaint.priority,
        "image_url": complaint.image_url,
        "user_id": complaint.user_id,
        "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        print(f"Inserting into DB: {data}")
        response = supabase.table("complaints").insert(data).execute()
        print("DB Insert Success")
        # The instruction's return was a dict, but the endpoint expects ComplaintResponse.
        # We'll stick to the Pydantic model for consistency.
        return ComplaintResponse(success=True, complaint_id=new_complaint_id)

    except Exception as e:
        print(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# 4) UPVOTE ENDPOINT
# -----------------------------------------------------------------------------
@app.post("/complaints/{complaint_id}/upvote")
def upvote_complaint(complaint_id: str):
    """
    Increments the upvote count for a specific complaint.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection not configured.")

    try:
        # 1. Get current votes
        # Note: In a production app, use an RPC function or atomic increment to avoid race conditions.
        # For now, we fetch-and-update.
        res = supabase.table("complaints").select("upvotes").eq("complaint_id", complaint_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Complaint not found")
            
        current_votes = res.data[0].get("upvotes", 0) or 0
        new_votes = current_votes + 1
        
        # 2. Update votes
        update_res = supabase.table("complaints").update({"upvotes": new_votes}).eq("complaint_id", complaint_id).execute()
        
        return {"success": True, "upvotes": new_votes}

    except Exception as e:
        print(f"Upvote Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# 4) COMMUNICATIONS AGENT (New)
# -----------------------------------------------------------------------------
@app.post("/agent/notify-resolution")
async def notify_resolution(data: ResolutionNotification):
    """
    The 'Communications Agent' that wakes up when an issue is resolved.
    It drafts and 'sends' a hyper-personalized email to the citizen.
    """
    print(f"🤖 AGENT WAKE UP: Optimizing communication for Complaint {data.complaint_id}...")
    
    # 1. Prompt Gemini for a personalized email
    prompt = f"""
    You are the "CivicPulse Communications Officer". 
    Your job is to write a warm, professional, and personalized email to a citizen whose complaint has just been RESOLVED.

    CONTEXT:
    - Citizen Name: {data.user_name}
    - Complaint Issue: {data.issue_description}
    - Status: JUST FIXED / RESOLVED

    INSTRUCTIONS:
    - Subject Line: Catchy and positive (e.g., "Good news regarding your report...")
    - Body: 
      - Thank them nicely for reporting.
      - Confirm clearly that the specific issue "{data.issue_description}" has been fixed by our team.
      - Mention that their vigilance helps make the city better.
      - Sign off as "The CivicPulse Team".
    - Tone: Friendly, Grateful, Professional.
    - Format: JSON with 'subject' and 'body'.

    OUTPUT JSON ONLY.
    """
    
    email_content = {"subject": "Update on your report", "body": "Your issue has been resolved."} # Default
    
    if gemini_model:
        try:
            response = gemini_model.generate_content(prompt)
            # clean potential markdown
            cleaned = response.text.replace('```json', '').replace('```', '')
            import json
            email_content = json.loads(cleaned)
        except Exception as e:
            print(f"Agent Brain Error: {e}")

    # 2. "Send" the Email (Mocking SMTP for now)
    print("\n" + "="*60)
    print(f"📧 SENDING EMAIL TO: {data.user_email}")
    print(f"Subject: {email_content.get('subject')}")
    print("-" * 60)
    print(email_content.get('body'))
    print("="*60 + "\n")
    
    return {"status": "sent", "email_preview": email_content}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
