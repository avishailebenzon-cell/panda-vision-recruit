import httpx
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.jobs import Job, JobPriority, SecurityLevel

logger = logging.getLogger(__name__)

settings = get_settings()

# ── Pipedrive custom field keys ───────────────────────────────────────────────
# These are the hash keys for the custom fields defined in the Pandatech Pipedrive account.
# To refresh: GET /v1/dealFields and match by 'name'.
FIELD_JOB_TITLE    = 'c616325e1187aaa05257f6d4cd9cc3626679b23f'
FIELD_JOB_DESC     = '9ed8654203d45357d76e8f83ca5a8584f5f8e2fb'
FIELD_JOB_QUAL     = '5198dc3d914cb437bf95133a64809a30f69e3b02'
FIELD_JOB_LOCATION = 'd04ed525f3ed45fb04383e07f281ad7338a30e4e_formatted_address'
FIELD_PRIORITY     = '360108d810b89e174c7ca6a3a8222eebfd278bf6'
FIELD_SECURITY     = '9997b3547b9295447c03c98343a50f4d8d097361'

# Priority: Pipedrive enum option IDs → Hebrew display labels (stored as-is, no mapping)
PRIORITY_LABEL_MAP: dict = {
    '390': 'עדיפות גיוס 1',
    '391': 'עדיפות גיוס 2',
    '392': 'עדיפות גיוס 3',
    '393': 'עדיפות גיוס 4',
    '394': 'עדיפות גיוס 5',
}


def _parse_priority(raw) -> str:
    """Return the Hebrew label for a Pipedrive priority option ID.
    Falls back to the raw value if the ID is not in the map."""
    if not raw:
        return ''
    s = str(raw).strip()
    return PRIORITY_LABEL_MAP.get(s, s)


def _parse_security(raw) -> str:
    """Return the raw Pipedrive security clearance text as-is."""
    return str(raw).strip() if raw else ''


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

                # Only include deals where the dedicated job_title custom field is filled.
                for deal in items:
                    job_title = deal.get(FIELD_JOB_TITLE)
                    if job_title and str(job_title).strip():
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

        Logic:
        - Only deals with a non-empty job_title field are synced.
        - Deals that were previously synced but no longer have a job_title
          (or whose deal was closed/deleted) are marked is_active=False.
        - Returns counts of created, updated, and deactivated jobs.
        """
        try:
            deals = await self.get_open_deals()
            created_count   = 0
            updated_count   = 0
            deactivated_count = 0

            # Track deal IDs that pass the filter in this sync run
            synced_deal_ids: set = set()

            for deal in deals:
                deal_id       = str(deal.get("id"))
                title         = (deal.get(FIELD_JOB_TITLE)    or "").strip()
                description   = (deal.get(FIELD_JOB_DESC)     or "").strip()
                qualifications= (deal.get(FIELD_JOB_QUAL)     or "").strip()
                location      = (deal.get(FIELD_JOB_LOCATION) or "").strip()
                priority      = _parse_priority(deal.get(FIELD_PRIORITY))
                security      = _parse_security(deal.get(FIELD_SECURITY))
                org_name      = (deal.get("org_name")    or "").strip()
                contact_name  = (deal.get("person_name") or "").strip()

                synced_deal_ids.add(deal_id)

                # Check if job already exists
                existing_job = self.db.query(Job).filter(
                    Job.pipedrive_deal_id == deal_id
                ).first()

                try:
                    if existing_job:
                        existing_job.title          = title
                        existing_job.description    = description
                        existing_job.qualifications = qualifications
                        existing_job.location       = location
                        existing_job.priority       = priority
                        existing_job.security_level = security
                        existing_job.org_name       = org_name
                        existing_job.contact_name   = contact_name
                        existing_job.is_active      = True
                        updated_count += 1
                        logger.info(f"Updated job {deal_id}: {title}")
                    else:
                        job = Job(
                            pipedrive_deal_id=deal_id,
                            title=title,
                            description=description,
                            qualifications=qualifications,
                            location=location,
                            priority=priority,
                            security_level=security,
                            org_name=org_name,
                            contact_name=contact_name,
                            is_active=True,
                        )
                        self.db.add(job)
                        created_count += 1
                        logger.info(f"Created job {deal_id}: {title}")

                except Exception as e:
                    logger.error(f"Error processing deal {deal_id}: {e}")
                    continue

            # Deactivate jobs that were NOT in this sync's valid-title deals.
            # These either had empty job_title or their deal is now closed/deleted.
            if synced_deal_ids:
                stale_jobs = self.db.query(Job).filter(
                    Job.is_active == True,
                    ~Job.pipedrive_deal_id.in_(synced_deal_ids),
                ).all()
                for job in stale_jobs:
                    job.is_active = False
                    deactivated_count += 1
                    logger.info(f"Deactivated job {job.pipedrive_deal_id}: '{job.title}' (not in current valid-title sync)")

            self.db.commit()
            logger.info(
                f"Sync complete: {created_count} created, {updated_count} updated, "
                f"{deactivated_count} deactivated"
            )

            return {
                "created": created_count,
                "updated": updated_count,
                "deactivated": deactivated_count,
                "total": len(deals),
            }

        except Exception as e:
            self.db.rollback()
            logger.error(f"Sync failed: {e}")
            raise

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
