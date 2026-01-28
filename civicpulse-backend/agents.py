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