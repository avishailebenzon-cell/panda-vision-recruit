import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session

from app.models.agent_tasks import AgentType, TaskStatus
from app.models.agent_tasks import AgentTask, AgentLog

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all specialized agents."""

    def __init__(self, db: Session, agent_type: AgentType, system_prompt: str):
        self.db = db
        self.agent_type = agent_type
        self.system_prompt = system_prompt
        self.name = agent_type.value
        self.task_id: Optional[int] = None

    @abstractmethod
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process input and return output.
        Must be implemented by subclasses.

        Args:
            input_data: Input for the agent to process

        Returns:
            Dictionary with agent's output
        """
        pass

    async def execute_task(
        self,
        task_type: str,
        input_data: Dict[str, Any],
        job_id: Optional[int] = None,
        candidate_id: Optional[int] = None,
        match_id: Optional[int] = None,
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Execute a task, handling logging and error management.

        Returns:
            Tuple of (output_data, success)
        """
        # Create task record
        task = AgentTask(
            task_type=task_type,
            status=TaskStatus.IN_PROGRESS,
            assigned_agent=self.agent_type,
            input_data=input_data,
            job_id=job_id,
            candidate_id=candidate_id,
            match_id=match_id,
        )
        self.db.add(task)
        self.db.commit()
        self.task_id = task.id

        # Log task start
        self._log_message(
            message_type="input",
            content=f"Task started: {task_type}",
            sender="system"
        )

        try:
            # Process
            task.started_at = datetime.utcnow()
            self.db.commit()

            output = await self.process(input_data)

            # Success
            task.status = TaskStatus.COMPLETED
            task.output_data = output
            task.completed_at = datetime.utcnow()
            self.db.commit()

            self._log_message(
                message_type="output",
                content=f"Task completed successfully",
                sender=self.name
            )

            logger.info(f"{self.name} agent completed task {task.id}")
            return output, True

        except Exception as e:
            logger.error(f"Error in {self.name} agent task {task.id}: {e}")
            task.retry_count += 1

            if task.retry_count >= task.max_retries:
                task.status = TaskStatus.FAILED
                task.error_message = str(e)
            else:
                task.status = TaskStatus.PENDING
                task.error_message = f"Retry {task.retry_count}: {str(e)}"

            task.completed_at = datetime.utcnow()
            self.db.commit()

            self._log_message(
                message_type="error",
                content=f"Task failed: {str(e)}",
                sender=self.name
            )

            return {}, False

    def _log_message(
        self,
        message_type: str,
        content: str,
        sender: str,
        tokens_used: Optional[int] = None,
        model_used: Optional[str] = None,
        processing_time_ms: Optional[int] = None,
    ):
        """Log a message for this agent."""
        try:
            log = AgentLog(
                task_id=self.task_id,
                agent_type=self.agent_type,
                message_type=message_type,
                sender=sender,
                content=content,
                tokens_used=tokens_used,
                model_used=model_used,
                processing_time_ms=processing_time_ms,
            )
            self.db.add(log)
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to log message: {e}")

    def get_system_prompt(self) -> str:
        """Get the system prompt for this agent."""
        return self.system_prompt

    def get_recent_logs(self, limit: int = 10) -> list:
        """Get recent logs for this agent."""
        try:
            logs = self.db.query(AgentLog).filter(
                AgentLog.agent_type == self.agent_type,
                AgentLog.task_id == self.task_id,
            ).order_by(AgentLog.created_at.desc()).limit(limit).all()
            return logs
        except Exception as e:
            logger.warning(f"Failed to fetch logs: {e}")
            return []
