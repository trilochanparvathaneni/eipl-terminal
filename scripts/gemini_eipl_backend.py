from google import genai
from google.genai import types
import json

# Initialize the Gemini Client
client = genai.Client(api_key="YOUR_GEMINI_API_KEY")

# 1. Define the Tool (The Action Button Generator)
suggest_action_tool = types.FunctionDeclaration(
    name="suggest_dashboard_action",
    description="Renders a clickable action button in the frontend UI. Call this when the user needs to resolve an incident, approve a truck, or check a specific HSE module.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "action_label": types.Schema(type=types.Type.STRING, description="Short, urgent label (e.g., 'Review Stop-Work Orders')"),
            "action_url": types.Schema(type=types.Type.STRING, description="The React router path (e.g., '/hse/stop-work-orders')"),
            "urgency": types.Schema(type=types.Type.STRING, description="Urgency level: 'high', 'medium', or 'low'"),
        },
        required=["action_label", "action_url", "urgency"],
    ),
)
tool = types.Tool(function_declarations=[suggest_action_tool])

# 2. System Instruction (The Persona)
system_instruction = """
You are EIPL Assist, an intelligent LPG terminal operations buddy.
Analyze the provided terminal metrics and converse naturally.
Do NOT use hardcoded bracket tags like [STATUS].
If operations are stalled due to an incident or stop-work order, explain it clearly, and MUST call the 'suggest_dashboard_action' tool to give the user a direct link to fix it.
"""


# 3. The Chat Handler Function
def get_eipl_bot_response(user_message: str, terminal_context_json: str):
    prompt = f"LIVE TERMINAL DATA:\n{terminal_context_json}\n\nUSER QUESTION:\n{user_message}"

    # Call Gemini 2.5 Flash for fast, real-time agentic reasoning
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[tool],
            system_instruction=system_instruction,
            temperature=0.2,
        ),
    )

    # 4. Parse the response for the React Frontend
    frontend_payload = {
        "reply_text": "",
        "action_buttons": [],
    }

    # Extract conversational text
    if response.text:
        frontend_payload["reply_text"] = response.text

    # Extract Tool Calls to render UI buttons
    if response.function_calls:
        for fc in response.function_calls:
            if fc.name == "suggest_dashboard_action":
                frontend_payload["action_buttons"].append(
                    {
                        "label": fc.args["action_label"],
                        "url": fc.args["action_url"],
                        "urgency": fc.args["urgency"],
                    }
                )

    return json.dumps(frontend_payload)
