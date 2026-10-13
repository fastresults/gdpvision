import re

def extract_scenarios(content):
    # This is a bit rough due to the different formats in the two files,
    # but I'll try to match the common structure.
    
    # Matching Scenario object in File 1
    # title: "...", question: "...", steps: [...], outcome: "..."
    scenarios = []
    
    # Match blocks
    blocks = re.findall(r'\{\s+chamber:.*?\n\s+\},', content, re.DOTALL)
    for block in blocks:
        title = re.search(r'title: "(.*?)",', block).group(1)
        question = re.search(r'question: "(.*?)",', block).group(1)
        outcome = re.search(r'outcome: "(.*?)",', block).group(1)
        
        # Steps
        steps_text = []
        steps_raw = re.findall(r'text: "(.*?)"', block)
        steps_text.extend(steps_raw)
        
        scenarios.append({
            "title": title,
            "question": question,
            "steps": steps_text,
            "outcome": outcome
        })
    return scenarios

def extract_more(content):
    # s( chamber, title, question, steps, outcome )
    scenarios = []
    # s\(\n\s+"(\d+)",\n\s+"(.*?)"
    blocks = re.findall(r's\(\s*"(.*?)",\s*"(.*?)",\s*"(.*?)",\s*\[(.*?)\],\s*"(.*?)"', content, re.DOTALL)
    for chamber, title, question, steps_block, outcome in blocks:
        steps_text = re.findall(r'"(.*?)"\s*,\s*\]', steps_block)
        # Note: the more scenarios have a slightly different step structure: [[edges], "text"]
        # The regex above might be too simple. Let's try to find strings at the end of sub-arrays.
        steps_text = re.findall(r',\s*"(.*?)"\s*\]', steps_block)
        
        scenarios.append({
            "title": title,
            "question": question,
            "steps": steps_text,
            "outcome": outcome
        })
    return scenarios

with open('src/components/marketing/dataDecisionScenarios.ts', 'r') as f:
    f1 = f.read()
with open('src/components/marketing/dataDecisionScenariosMore.ts', 'r') as f:
    f2 = f.read()

s1 = extract_scenarios(f1)
s2 = extract_more(f2)

import json
print(json.dumps(s1 + s2, indent=2))
