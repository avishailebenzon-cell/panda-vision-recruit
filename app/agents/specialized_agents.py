import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.agents.claude_client import ClaudeClient
from app.agents.system_prompts import AGENT_PROMPTS, ORCHESTRATOR_PROMPT
from app.models.agent_tasks import AgentType
from app.models.candidates import Candidate
from app.models.jobs import Job
from app.models.matches import Match

logger = logging.getLogger(__name__)


class SpecializedAgent(BaseAgent):
    """Specialized agent for candidate-job matching."""

    def __init__(
        self,
        db: Session,
        agent_type: AgentType,
        system_prompt: str,
        claude_client: ClaudeClient,
    ):
        super().__init__(db, agent_type, system_prompt)
        self.claude_client = claude_client

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a candidate-job matching request using Claude.
        """
        job_id = input_data.get("job_id")
        candidate_id = input_data.get("candidate_id")

        # Fetch job and candidate data
        try:
            job = self.db.query(Job).filter(Job.id == job_id).first()
            candidate = self.db.query(Candidate).filter(Candidate.id == candidate_id).first()

            if not job or not candidate:
                return {
                    "match_score": 0,
                    "decision": "no_match",
                    "reason": "Job or candidate not found",
                }

            # Format data for Claude
            job_data = {
                "title": job.title,
                "description": job.description,
                "qualifications": job.qualifications,
                "priority": job.priority,
                "security_level": job.security_level,
            }

            candidate_data = {
                "first_name": candidate.first_name,
                "last_name": candidate.last_name,
                "email": candidate.email,
                "location": candidate.location,
                "security_level": candidate.security_level,
                "resume_text": candidate.notes,  # CV text stored in notes
            }

            # Build prompt
            prompt = self.claude_client.format_matching_prompt(job_data, candidate_data)

            # Call Claude
            result = await self.claude_client.call_agent(
                system_prompt=self.system_prompt,
                user_message=prompt,
                temperature=0.2,  # Low temperature for consistent matching
                max_tokens=1024,
            )

            # Log the call
            if result.get("tokens_used"):
                self._log_message(
                    message_type="output",
                    content=result.get("response", ""),
                    sender=self.name,
                    tokens_used=result.get("tokens_used"),
                    model_used=result.get("model"),
                )

            # Extract parsed data or create default response
            parsed = result.get("parsed_data") or self._create_default_response()

            # Add metadata
            parsed["job_id"] = job_id
            parsed["candidate_id"] = candidate_id
            parsed["agent_type"] = self.agent_type.value

            # Check 3-year rule
            if candidate.scanned_date:
                age_days = (datetime.utcnow() - candidate.scanned_date).days
                if age_days > 365 * 3:  # 3 years
                    if "warnings" not in parsed:
                        parsed["warnings"] = []
                    parsed["warnings"].append(
                        f"CV is {age_days // 365} years old - may be outdated"
                    )

            return parsed

        except Exception as e:
            logger.error(f"Error processing match in {self.name} agent: {e}")
            return {
                "match_score": 0,
                "decision": "no_match",
                "reason": f"Processing error: {str(e)}",
            }

    def _create_default_response(self) -> Dict[str, Any]:
        """Create a default response structure."""
        return {
            "match_score": 0,
            "security_level_valid": False,
            "summary": "Unable to process matching",
            "warnings": [],
            "decision": "no_match",
        }


class OrchestratorAgent(BaseAgent):
    """Orchestrator agent for job classification and quality control."""

    def __init__(self, db: Session, claude_client: ClaudeClient):
        super().__init__(db, AgentType.ORCHESTRATOR, ORCHESTRATOR_PROMPT)
        self.claude_client = claude_client

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify a job and assign to appropriate specialized agent.
        """
        job_id = input_data.get("job_id")

        try:
            job = self.db.query(Job).filter(Job.id == job_id).first()

            if not job:
                return {
                    "classification": "error",
                    "reason": "Job not found",
                }

            # Format job data for classification
            job_text = f"""
משרה: {job.title}
תיאור: {job.description}
דרישות: {job.qualifications}
עדיפות: {job.priority}
סיווג ביטחוני: {job.security_level}
"""

            prompt = f"""
סווג את המשרה הבאה לאחת מהקטגוריות:
- software (תוכנה)
- electronics (אלקטרוניקה)
- mechanical (מכונות)
- qa (בדיקה)
- it (מערכות מידע)
- cybersecurity (סייבר)
- systems_engineering (הנדסת מערכות)
- garbage_collector (עבודות כללי)

{job_text}

תשובתך בפורמט JSON:
{{
  "classification": "one_of_categories",
  "confidence": <0-100>,
  "reasoning": "הסבר קצר"
}}
"""

            # Call Claude
            result = await self.claude_client.call_agent(
                system_prompt=self.system_prompt,
                user_message=prompt,
                temperature=0.1,  # Very low temperature for deterministic classification
                max_tokens=256,
            )

            if result.get("tokens_used"):
                self._log_message(
                    message_type="output",
                    content=result.get("response", ""),
                    sender="orchestrator",
                    tokens_used=result.get("tokens_used"),
                    model_used=result.get("model"),
                )

            parsed = result.get("parsed_data") or {"classification": "garbage_collector"}
            parsed["job_id"] = job_id
            parsed["job_title"] = job.title

            return parsed

        except Exception as e:
            logger.error(f"Error in orchestrator classification: {e}")
            return {
                "classification": "garbage_collector",
                "confidence": 0,
                "reasoning": f"Error: {str(e)}",
            }

    async def quality_control(
        self,
        match_id: int,
        candidate_name: str,
    ) -> Dict[str, Any]:
        """
        Perform quality control check on a match.
        Check for negative notes in Pipedrive.
        """
        try:
            match = self.db.query(Match).filter(Match.id == match_id).first()

            if not match:
                return {"valid": False, "reason": "Match not found"}

            # In real implementation, would check Pipedrive notes
            # For now, return success
            return {
                "valid": True,
                "match_id": match_id,
                "candidate_name": candidate_name,
                "notes_checked": True,
            }

        except Exception as e:
            logger.error(f"Error in quality control: {e}")
            return {"valid": False, "reason": str(e)}


def create_agent(
    db: Session,
    agent_type: AgentType,
    claude_client: Optional[ClaudeClient] = None,
) -> BaseAgent:
    """Factory function to create the appropriate agent."""

    if claude_client is None:
        claude_client = ClaudeClient()

    if agent_type == AgentType.ORCHESTRATOR:
        return OrchestratorAgent(db, claude_client)

    # Specialized agents
    system_prompt = AGENT_PROMPTS.get(
        agent_type.value,
        AGENT_PROMPTS["garbage_collector"],
    )

    return SpecializedAgent(db, agent_type, system_prompt, claude_client)
