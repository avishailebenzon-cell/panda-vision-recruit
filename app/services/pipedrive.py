import httpx
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.jobs import Job, JobPriority, SecurityLevel

logger = logging.getLogger(__name__)

settings = get_settings()


class PipedriveService:
    """Service for Pipedrive API integration."""

    def __init__(self, db: Session):
        self.db = db
        self.api_key = settings.pipedrive_api_key
        self.base_url = settings.pipedrive_base_url
        self.client = httpx.AsyncClient()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def get_open_deals(self) -> List[Dict[str, Any]]:
        """
        Fetch all open deals from Pipedrive with non-empty job_title field.
        """
        if not self.api_key:
            raise ValueError("PIPEDRIVE_API_KEY is not configured")

        deals = []
        start = 0
        limit = 100

        try:
            while True:
                url = f"{self.base_url}/deals"
                params = {
                    "status": "open",
                    "api_token": self.api_key,
                    "start": start,
                    "limit": limit,
                }

                response = await self.client.get(url, params=params)
                response.raise_for_status()

                data = response.json()
                if not data.get("success"):
                    logger.warning(f"Pipedrive API warning: {data.get('error')}")
                    break

                items = data.get("data", [])
                if not items:
                    break

                # Filter deals with non-empty job_title field
                for deal in items:
                    job_title = deal.get("job_title") or deal.get("title")
                    if job_title and job_title.strip():
                        deals.append(deal)

                # Check if there are more results
                additional_data = data.get("additional_data", {})
                if not additional_data.get("pagination", {}).get("more_items_in_collection"):
                    break

                start += limit

        except httpx.HTTPError as e:
            logger.error(f"Pipedrive API error: {e}")
            raise

        logger.info(f"Retrieved {len(deals)} open deals from Pipedrive")
        return deals

    async def sync_open_deals(self) -> Dict[str, int]:
        """
        Sync open deals from Pipedrive to Job table.
        Returns count of created and updated jobs.
        """
        try:
            deals = await self.get_open_deals()
            created_count = 0
            updated_count = 0

            for deal in deals:
                deal_id = str(deal.get("id"))
                title = deal.get("job_title") or deal.get("title", "")
                description = deal.get("description", "")
                qualifications = deal.get("qualifications", "")
                location = deal.get("location", "")
                priority = deal.get("priority", "medium")
                security = deal.get("security", "no_security")

                # Check if job already exists
                existing_job = self.db.query(Job).filter(
                    Job.pipedrive_deal_id == deal_id
                ).first()

                try:
                    # Validate enum values
                    if priority not in [p.value for p in JobPriority]:
                        priority = JobPriority.MEDIUM.value
                    if security not in [s.value for s in SecurityLevel]:
                        security = SecurityLevel.NO_SECURITY.value

                    if existing_job:
                        # Update existing job
                        existing_job.title = title
                        existing_job.description = description
                        existing_job.qualifications = qualifications
                        existing_job.location = location
                        existing_job.priority = priority
                        existing_job.security_level = security
                        updated_count += 1
                        logger.info(f"Updated job {deal_id}: {title}")
                    else:
                        # Create new job
                        job = Job(
                            pipedrive_deal_id=deal_id,
                            title=title,
                            description=description,
                            qualifications=qualifications,
                            location=location,
                            priority=priority,
                            security_level=security,
                            is_active=True,
                        )
                        self.db.add(job)
                        created_count += 1
                        logger.info(f"Created job {deal_id}: {title}")

                except Exception as e:
                    logger.error(f"Error processing deal {deal_id}: {e}")
                    continue

            self.db.commit()
            logger.info(f"Sync complete: {created_count} created, {updated_count} updated")

            return {
                "created": created_count,
                "updated": updated_count,
                "total": len(deals),
            }

        except Exception as e:
            self.db.rollback()
            logger.error(f"Sync failed: {e}")
            raise

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
