import json
import sys

transcript_path = r"C:\Users\Swati\.gemini\antigravity\brain\67c2a230-b1ec-487d-bf98-5576b3a3bc91\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

responses = []
for line in lines:
    try:
        data = json.loads(line)
        if data.get("source") == "MODEL" and data.get("type") == "PLANNER_RESPONSE" and "tool_calls" not in data:
            if "content" in data:
                responses.append(data["content"])
    except:
        pass

for i, resp in enumerate(responses[-10:]):
    print(f"--- Response {i} ---")
    print(resp)
    print()
