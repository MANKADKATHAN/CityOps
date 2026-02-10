from typing import Dict, Optional

# -----------------------------------------------------------------------------
# AGENTS
# -----------------------------------------------------------------------------
# These agents are simple Python functions that deterministic logic.
# In a real-world scenario, they could be powered by LLMs.

def run_classification_agent(issue_type: str) -> str:
    """
    AGENT 1: CLASSIFICATION AGENT
    Purpose: Normalize the input issue type into a standard set of categories.
    Input: Raw issue_type string (e.g. "Trash", "Rubbish", "Garbage")
    Output: Normalized category (e.g. "Garbage")
    """
    if not issue_type:
        return "General"
    
    classification_map = {
        # Garbage related
        "garbage": "Garbage",
        "trash": "Garbage",
        "waste": "Garbage",
        "dustbin": "Garbage",
        
        # Road related
        "road": "Road",
        "pothole": "Road",
        "street": "Road",
        "asphalt": "Road",
        
        # Water related
        "water": "Water",
        "leak": "Water",
        "pipe": "Water",
        "drainage": "Water",
        
        # Streetlight related
        "streetlight": "Streetlight",
        "light": "Streetlight",
        "lamp": "Streetlight",
        "dark": "Streetlight"
    }
    
    # Normalize input
    key = issue_type.lower().strip()
    
    # Check for direct matches or substring matches
    for keyword, category in classification_map.items():
        if keyword in key:
            return category
            
    # If key matches one of our standard categories directly (case-insensitive)
    standard_categories = ["Garbage", "Road", "Water", "Streetlight"]
    for cat in standard_categories:
        if cat.lower() == key:
            return cat
            
    return "General"


def run_routing_agent(issue_type: str) -> str:
    """
    AGENT 2: ROUTING AGENT
    Purpose: Assign the correct municipal department based on the issue type.
    Input: Normalized issue_type (from Classification Agent)
    Output: Department Name
    """
    routing_map = {
        "Garbage": "Sanitation Dept.",
        "Road": "Public Works Dept.",
        "Water": "Water Board",
        "Streetlight": "Electricity Board",
        "General": "Municipal Corporation"
    }
    
    return routing_map.get(issue_type, "City Helpdesk")


# -----------------------------------------------------------------------------
# VISION AGENT (New)
# -----------------------------------------------------------------------------
import google.generativeai as genai
import PIL.Image
import requests
from io import BytesIO
import os
import json

def run_vision_agent(image_url: str) -> dict:
    """
    AGENT 3: VISION AGENT
    Purpose: Analyze an image to verify it's a civic issue, classify it, and estimate severity.
    Input: Image URL
    Output: Dictionary with verification status, type, severity, and description.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Vision Agent: No API Key found")
        return None

    try:
        # 1. Download the image
        print(f"Vision Agent: Downloading image from {image_url}...")
        response = requests.get(image_url)
        response.raise_for_status()
        image_data = BytesIO(response.content)
        img = PIL.Image.open(image_data)

        # 2. visual analysis with Gemini
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = """
        You are a strict Smart City AI Inspector and Operations Planner. 
        Analyze this image to determine if it is a REAL-WORLD photo of a civic issue.

        CRITICAL VALIDATION STEPS:
        1. REALISM CHECK: Is this a real photograph? 
           - REJECT if it is a cartoon, animation, drawing, sketch, or digital rendering.
           - REJECT if it is an AI-generated image.
           - REJECT if it is a photo of a screen.
        2. RELEVANCE CHECK: Does it clearly show a civic issue (pothole, garbage, broken light, water leak)?
           - REJECT if it is a selfie, group photo, or photo of a singular person.
           - REJECT if it is a random object (coffee, laptop, pet) without a civic context.
           - REJECT if the image is too blurry to identify the issue.

        If REJECTED:
        - Set "is_civic_issue" to false.
        - Set "rejection_reason" to the specific reason (e.g. "Cartoon/Digital Art detected", "Not a real photo", "No civic issue found").
        
        If ACCEPTED:
        - Set "is_civic_issue" to true.
        - Classify "issue_type" (Road, Garbage, Water, Streetlight, Other).
        - Estimate "severity" (1-10).
        - "location_context": Look at the background. Are there visible street signs, shop names, landmarks, or building types? (e.g. "Near Galaxy Store", "Highway", "Residential Street"). If none, say "Unknown Location".
        - "required_action": Recommend the specific resource needed to fix this. 
           - Examples: "Deploy Pothole Patching Crew", "Dispatch Dumpster Truck", "Send Electrician with Ladder", "Pipe Repair Team".

        Output valid JSON ONLY:
        {
            "is_civic_issue": boolean, 
            "rejection_reason": stringOrNull,
            "issue_type": string, 
            "severity": integer, 
            "description": string,
            "location_context": string,
            "required_action": string
        }
        """

        print("Vision Agent: Analyzing with Gemini...")
        response = model.generate_content([prompt, img])
        
        # Clean and parse response
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        
        print(f"Vision Agent Result: {data}")
        return data

    except Exception as e:
        print(f"Vision Agent Error: {e}")
        # Fallback for demo if analysis fails
        return {
            "is_civic_issue": False, 
            "rejection_reason": "Analysis failed, please try again.",
            "issue_type": "General", 
            "severity": 0, 
            "description": "",
            "location_context": "",
            "required_action": ""
        }