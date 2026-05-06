import logging
from typing import List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.jobs import Job
from app.models.candidates import Candidate
from app.models.matches import Match, MatchStatus
from app.models.agent_tasks import AgentType, TaskStatus
from app.agents.specialized_agents import create_agent, OrchestratorAgent
from app.agents.claude_client import ClaudeClient
from app.agents.watchdog import AgentWatchdog

logger = logging.getLogger(__name__)


class OrchestratorEngine:
    """Main orchestration engine for the recruitment AI system."""

    def __init__(self, db: Session, claude_client: ClaudeClient = None):
        self.db = db
        self.claude_client = claude_client or ClaudeClient()
        self.orchestrator = OrchestratorAgent(db, self.claude_client)
        self.watchdog = AgentWatchdog(db)

    async def process_new_job(self, job_id: int) -> Dict[str, Any]:
        """
        Process a new job: classify and prepare for matching.

        Steps:
        1. Classify job to appropriate agent type
        2. Queue job for candidate matching
        """
        try:
            logger.info(f"Processing new job {job_id}")

            # Classify job
            classification_result = await self.orchestrator.execute_task(
                task_type="classify_job",
                input_data={"job_id": job_id},
                job_id=job_id,
            )

            if not classification_result:
                return {
                    "status": "failed",
                    "job_id": job_id,
                    "reason": "Failed to classify job",
                }

            classification = classification_result[0]
            agent_type_name = classification.get("classification", "garbage_collector")

            logger.info(f"Job {job_id} classified as: {agent_type_name}")

            return {
                "status": "classified",
                "job_id": job_id,
                "agent_type": agent_type_name,
                "confidence": classification.get("confidence", 0),
            }

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            return {
                "status": "failed",
                "job_id": job_id,
                "error": str(e),
            }

    async def match_candidate_to_job(
        self,
        job_id: int,
        candidate_id: int,
        agent_type: AgentType,
    ) -> Dict[str, Any]:
        """
        Match a candidate to a job using the appropriate specialized agent.

        Steps:
        1. Get agent for job's domain
        2. Run matching logic
        3. Perform quality control
        4. Create Match record
        """
        try:
            logger.info(f"Matching candidate {candidate_id} to job {job_id} with {agent_type.value}")

            # Create appropriate agent
            agent = create_agent(self.db, agent_type, self.claude_client)

            # Run matching
            match_result, success = await agent.execute_task(
                task_type="match_candidate_to_job",
                input_data={
                    "job_id": job_id,
                    "candidate_id": candidate_id,
                },
                job_id=job_id,
                candidate_id=candidate_id,
            )

            if not success:
                return {
                    "status": "failed",
                    "job_id": job_id,
                    "candidate_id": candidate_id,
                    "reason": "Agent matching failed",
                }

            # Extract match score and decision
            match_score = match_result.get("match_score", 0)
            decision = match_result.get("decision", "no_match")
            summary = match_result.get("summary", "")

            # Quality control
            candidate = self.db.query(Candidate).filter(
                Candidate.id == candidate_id
            ).first()
            candidate_name = f"{candidate.first_name} {candidate.last_name}"

            qc_result = await self.orchestrator.quality_control(
                match_id=0,  # Will be set after creation
                candidate_name=candidate_name,
            )

            # Create or update Match record
            if decision == "match" and match_score >= 50:  # Threshold
                match = Match(
                    candidate_id=candidate_id,
                    job_id=job_id,
                    agent_name=agent_type.value,
                    match_score=match_score,
                    summary=summary,
                    status=MatchStatus.PENDING,
                    admin_approved=False,
                )
                self.db.add(match)
                self.db.commit()

                logger.info(
                    f"Created match {match.id}: "
                    f"candidate {candidate_id} -> job {job_id} "
                    f"(score: {match_score})"
                )

                return {
                    "status": "matched",
                    "match_id": match.id,
                    "job_id": job_id,
                    "candidate_id": candidate_id,
                    "match_score": match_score,
                    "summary": summary,
                }
            else:
                logger.info(
                    f"No match: candidate {candidate_id} -> job {job_id} "
                    f"(score: {match_score}, decision: {decision})"
                )

                return {
                    "status": "no_match",
                    "job_id": job_id,
                    "candidate_id": candidate_id,
                    "match_score": match_score,
                    "reason": match_result.get("reason", "Score below threshold"),
                }

        except Exception as e:
            logger.error(f"Error matching candidate {candidate_id} to job {job_id}: {e}")
            return {
                "status": "failed",
                "job_id": job_id,
                "candidate_id": candidate_id,
                "error": str(e),
            }

    async def process_job_and_find_matches(
        self,
        job_id: int,
        max_candidates: int = 50,
    ) -> Dict[str, Any]:
        """
        Complete workflow: classify job and find matching candidates.
        """
        try:
            logger.info(f"Starting full matching workflow for job {job_id}")

            # Step 1: Classify job
            job_result = await self.process_new_job(job_id)

            if job_result.get("status") != "classified":
                return {
                    "status": "failed",
                    "job_id": job_id,
                    "reason": "Failed to classify job",
                }

            agent_type_name = job_result.get("agent_type", "garbage_collector")

            try:
                agent_type = AgentType[agent_type_name.upper()]
            except KeyError:
                agent_type = AgentType.GARBAGE_COLLECTOR

            # Step 2: Get active candidates
            candidates = self.db.query(Candidate).filter(
                Candidate.status == "active"
            ).limit(max_candidates).all()

            logger.info(f"Found {len(candidates)} candidates for matching")

            # Step 3: Match each candidate
            matches = []
            for candidate in candidates:
                match_result = await self.match_candidate_to_job(
                    job_id=job_id,
                    candidate_id=candidate.id,
                    agent_type=agent_type,
                )

                if match_result.get("status") == "matched":
                    matches.append(match_result)

            logger.info(f"Matching complete for job {job_id}: {len(matches)} matches found")

            return {
                "status": "completed",
                "job_id": job_id,
                "agent_type": agent_type_name,
                "total_candidates_checked": len(candidates),
                "matches_found": len(matches),
                "matches": matches,
            }

        except Exception as e:
            logger.error(f"Error in full matching workflow for job {job_id}: {e}")
            return {
                "status": "failed",
                "job_id": job_id,
                "error": str(e),
            }

    def get_system_status(self) -> Dict[str, Any]:
        """Get current status of the agent system."""
        try:
            # Get task statistics
            task_stats = self.watchdog.get_task_stats()

            # Get stuck tasks
            stuck_tasks = self.watchdog.get_stuck_tasks()

            # Get pending matches
            pending_matches = self.db.query(Match).filter(
                Match.status == MatchStatus.PENDING
            ).count()

            return {
                "status": "operational",
                "task_statistics": task_stats,
                "stuck_tasks_count": len(stuck_tasks),
                "pending_matches": pending_matches,
                "watchdog_active": True,
            }

        except Exception as e:
            logger.error(f"Error getting system status: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
