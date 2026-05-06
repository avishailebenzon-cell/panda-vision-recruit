import json
import logging
from typing import Dict, Any, Optional
import anthropic
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class ClaudeClient:
    """Client for interacting with Claude API."""

    def __init__(self, model: str = "claude-opus-4-7"):
        self.model = model
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def call_agent(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.2,  # Lower temperature for deterministic matching
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        """
        Call Claude with a system prompt and user message.

        Returns a dictionary with response and metadata.
        """
        try:
            logger.info(f"Calling Claude ({self.model}) for agent task")

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": user_message,
                    }
                ],
            )

            # Extract response text
            response_text = response.content[0].text

            # Try to parse JSON from response
            result = self._parse_json_response(response_text)

            return {
                "success": True,
                "response": response_text,
                "parsed_data": result,
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
                "model": self.model,
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from agent response: {e}")
            return {
                "success": False,
                "response": response_text,
                "parsed_data": None,
                "error": f"JSON parse error: {str(e)}",
                "model": self.model,
            }

        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            return {
                "success": False,
                "response": None,
                "parsed_data": None,
                "error": f"API error: {str(e)}",
                "model": self.model,
            }

    def _parse_json_response(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Extract and parse JSON from Claude's response.
        Claude may include markdown code blocks, so we handle that.
        """
        # Try direct JSON parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code blocks
        import re
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # If all else fails, return None
        logger.warning("Could not parse JSON from Claude response")
        return None

    def format_job_data(self, job: Dict[str, Any]) -> str:
        """Format job data for agent analysis."""
        return f"""
משרה: {job.get('title', 'N/A')}
תיאור: {job.get('description', 'N/A')}
דרישות: {job.get('qualifications', 'N/A')}
עדיפות: {job.get('priority', 'N/A')}
רמת סיווג ביטחון: {job.get('security_level', 'no_security')}
"""

    def format_candidate_data(self, candidate: Dict[str, Any]) -> str:
        """Format candidate data for agent analysis."""
        return f"""
שם המועמד: {candidate.get('first_name', '')} {candidate.get('last_name', '')}
אימייל: {candidate.get('email', 'N/A')}
מיקום: {candidate.get('location', 'N/A')}
רמת סיווג ביטחון: {candidate.get('security_level', 'no_security')}
קורות חיים (תמציא):
{candidate.get('resume_text', 'N/A')[:2000]}...
"""

    def format_matching_prompt(self, job: Dict[str, Any], candidate: Dict[str, Any]) -> str:
        """Format a prompt for matching a candidate to a job."""
        return f"""
בדוק את ההתאמה בין המועמד לעמדה הפתוחה.

{self.format_job_data(job)}

{self.format_candidate_data(candidate)}

בדיקות שיש לבצע:
1. בדיקה חובה: סיווג ביטחוני - האם CV מכסה את דרישת הביטחון של המשרה?
2. ציון התאמה - כמה אחוז מדרישות המשרה מכוסים בCV?
3. חוק 3 השנים - האם ה-CV ישן מ-3 שנים?
4. הערות בקורות חיים - בדוק עם הערות קודמות על המועמד.

הודע בפורמט JSON כפי שהוגדר ב-System Prompt.
"""
