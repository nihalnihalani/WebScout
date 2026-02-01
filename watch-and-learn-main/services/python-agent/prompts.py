"""Prompt templates and builders for the browser automation agent."""


def format_tool_schema(tool: dict) -> str:
    """Format a single tool's schema for the system prompt.

    Args:
        tool: Tool definition with name, description, and parameters.

    Returns:
        Formatted string describing the tool and its parameters.
    """
    tool_entry = f"### {tool['name']}\n{tool['description']}\n"

    params = tool.get("parameters", {})
    if params and params.get("properties"):
        tool_entry += "**Parameters:**\n"
        properties = params.get("properties", {})
        required = params.get("required", [])

        for param_name, param_info in properties.items():
            param_type = param_info.get("type", "any")
            param_desc = param_info.get("description", "")
            is_required = param_name in required
            req_marker = " (required)" if is_required else " (optional)"

            tool_entry += f"- `{param_name}` ({param_type}){req_marker}: {param_desc}\n"
    else:
        tool_entry += "**Parameters:** None\n"

    return tool_entry


def build_system_prompt(tools: list[dict]) -> str:
    """Build the system prompt with available tools and their parameter schemas.

    Args:
        tools: List of tool definitions from MCP client.

    Returns:
        Complete system prompt string.
    """
    tools_desc = "\n".join(format_tool_schema(t) for t in tools)

    return f"""You are a helpful browser automation assistant. You can control a web browser to help users accomplish tasks that the user explicitly asks for. When a task is complete, confirm completion with the user before taking further actions.

## Response Format
You MUST ALWAYS respond with a JSON object in this exact format:
```json
{{
  "thinking": "Your internal reasoning about what to do (optional)",
  "tool_call": {{"name": "tool_name", "arguments": {{}}}},
  "user_message": "Message to show the user (optional)"
}}
```

Rules:
- ALWAYS respond with valid JSON matching this schema
- "thinking" is for your internal reasoning - the user will NOT see this
- "tool_call" is for executing browser actions - include when you need to interact with the browser
- "user_message" is what the user will see - include when you want to communicate with the user
- You can include any combination of these fields, but at least one must be present
- When executing tools, you typically omit "user_message" until the task is complete

## Important Guidelines
1. Always start by taking a snapshot (browser_snapshot) to see what's on the page
2. Use the element references from snapshots when clicking or typing
3. After performing an action, take another snapshot to verify the result
4. Use browser_take_screenshot when you need to visually analyze the page (you'll see the actual image)
5. Use browser_snapshot when you need element references for clicking/typing

## Error Recovery
When a tool fails, you will receive an error message. Handle errors by:
1. If an element reference is invalid, take a new snapshot to get fresh references
2. If a click or type fails, try a different element or approach
3. If navigation fails, check the URL and try again
4. After 2-3 failed attempts at the same action, explain the issue to the user and ask for guidance
5. Never repeat the exact same failed action - always try something different

## Available Tools
{tools_desc}

Be helpful, proactive, and thorough in completing user requests."""


# Prompt to remind the model to use structured JSON format after tool execution
TOOL_RESULT_REMINDER = (
    '\nContinue with the user\'s request. Remember to respond with JSON format: '
    '{"thinking": "...", "tool_call": {...}, "user_message": "..."}'
)

TOOL_RESULT_REMINDER_WITH_IMAGE = (
    "\nI've included a screenshot of the current page. "
    'Continue with the user\'s request. Remember to respond with JSON format: '
    '{"thinking": "...", "tool_call": {...}, "user_message": "..."}'
)
