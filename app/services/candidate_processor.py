import logging
import re
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from difflib import SequenceMatcher

from app.models.candidates import Candidate, SecurityLevel, CandidateStatus
from app.models.settings import Setting

logger = logging.getLogger(__name__)


class CandidateProcessor:
    """Service for processing extracted candidate data and managing duplicates."""

    SECURITY_KEYWORDS = {
        SecurityLevel.TOP_SECRET: [
            "סגור לגמרי", "top secret", "סוד עליון", "סוד מדינה",
            "ביטחוני ביותר", "הסדר סוד", "צהל", "משרד הביטחון"
        ],
        SecurityLevel.SECRET: [
            "secret", "סוד", "סודי", "סודיות",
            "מסווג", "classified", "הנדסה צבאית"
        ],
        SecurityLevel.CONFIDENTIAL: [
            "confidential", "חסוי", "פנים", "sensitive",
            "בתוך הקבוצה", "restricted", "מוגבל"
        ],
    }

    def __init__(self, db: Session):
        self.db = db

    def extract_candidate_info(
        self,
        email_text: str,
        sender_email: str,
        sender_name: str,
        received_date: datetime,
    ) -> Dict[str, Any]:
        """
        Extract candidate information from email text.

        This is a basic extraction - AI agents will do deeper analysis later.
        """
        try:
            # Extract basic info using regex patterns
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            phone_pattern = r'(?:\+972|0)?(?:5[0-9]|2|3|4|8|9)\d{7,8}'
            location_pattern = r'(?:תל אביב|ירושלים|חיפה|בירה שבע|אשדוד|אשקלון|הרצליה|רמת גן|[A-Z][a-z]+)'

            emails = re.findall(email_pattern, email_text)
            phones = re.findall(phone_pattern, email_text)
            locations = re.findall(location_pattern, email_text)

            # Use sender info as primary
            candidate_email = sender_email
            candidate_name = sender_name

            # Try to extract name from text if not in sender
            name_pattern = r'(?:שם|Name)[\s:]*([א-ת\s]+|[A-Za-z\s]+)'
            name_match = re.search(name_pattern, email_text, re.IGNORECASE)
            if name_match and not candidate_name:
                candidate_name = name_match.group(1).strip()

            # Parse name into first and last
            name_parts = candidate_name.strip().split() if candidate_name else ["Unknown", "Candidate"]
            first_name = name_parts[0] if name_parts else "Unknown"
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Candidate"

            return {
                "first_name": first_name,
                "last_name": last_name,
                "email": candidate_email,
                "phone": phones[0] if phones else None,
                "location": locations[0] if locations else None,
                "email_text": email_text,
                "extracted_emails": emails,
                "extracted_phones": phones,
            }

        except Exception as e:
            logger.error(f"Error extracting candidate info: {e}")
            return {
                "first_name": "Unknown",
                "last_name": "Candidate",
                "email": sender_email,
                "phone": None,
                "location": None,
                "email_text": email_text,
                "extracted_emails": [],
                "extracted_phones": [],
            }

    def classify_security_level(self, text: str) -> SecurityLevel:
        """
        Classify security level based on keywords.
        Uses a simple regex-based approach for now.
        """
        try:
            text_lower = text.lower()

            # Check in order of highest to lowest classification
            for level, keywords in self.SECURITY_KEYWORDS.items():
                for keyword in keywords:
                    if keyword.lower() in text_lower:
                        logger.info(f"Classified as {level.value} based on keyword: {keyword}")
                        return level

            return SecurityLevel.NO_SECURITY

        except Exception as e:
            logger.error(f"Error classifying security level: {e}")
            return SecurityLevel.NO_SECURITY

    def find_duplicate_candidate(
        self,
        email: str,
        first_name: str,
        last_name: str,
    ) -> Optional[Candidate]:
        """
        Find existing candidate by email or similar name.

        Returns the candidate if found, None otherwise.
        """
        try:
            # First, exact match by email
            existing = self.db.query(Candidate).filter(
                Candidate.email == email.lower()
            ).first()

            if existing:
                return existing

            # Second, fuzzy match on name (if both first and last name match)
            if first_name and last_name:
                candidates = self.db.query(Candidate).filter(
                    Candidate.first_name.ilike(f"%{first_name}%"),
                    Candidate.last_name.ilike(f"%{last_name}%"),
                ).all()

                # Return first high-confidence match
                for candidate in candidates:
                    similarity = self._name_similarity(
                        f"{first_name} {last_name}",
                        f"{candidate.first_name} {candidate.last_name}"
                    )
                    if similarity > 0.8:  # 80% match threshold
                        logger.info(f"Found duplicate by name similarity: {similarity}")
                        return candidate

            return None

        except Exception as e:
            logger.error(f"Error finding duplicate candidate: {e}")
            return None

    def save_or_update_candidate(
        self,
        email: str,
        first_name: str,
        last_name: str,
        phone: Optional[str],
        location: Optional[str],
        security_level: SecurityLevel,
        email_received_date: datetime,
        resume_text: Optional[str] = None,
        resume_url: Optional[str] = None,
    ) -> Tuple[Candidate, bool]:
        """
        Save or update a candidate in the database.

        Returns: (candidate, is_new) - tuple of candidate object and whether it's newly created
        """
        try:
            existing = self.find_duplicate_candidate(email, first_name, last_name)

            if existing:
                # Update existing candidate
                logger.info(f"Updating existing candidate: {email}")

                # Only update if the new email is more recent
                if email_received_date > existing.email_received_date:
                    existing.first_name = first_name
                    existing.last_name = last_name
                    existing.phone = phone or existing.phone
                    existing.location = location or existing.location
                    existing.security_level = security_level
                    existing.email_received_date = email_received_date
                    existing.scanned_date = datetime.utcnow()
                    existing.status = CandidateStatus.ACTIVE

                    if resume_text:
                        existing.notes = resume_text[:5000]  # Limit to 5000 chars
                    if resume_url:
                        existing.resume_url = resume_url

                    self.db.commit()
                    logger.info(f"Updated candidate {existing.id}")
                    return existing, False
                else:
                    logger.info(f"Skipping update - existing email is more recent")
                    return existing, False

            else:
                # Create new candidate
                logger.info(f"Creating new candidate: {email}")
                candidate = Candidate(
                    first_name=first_name,
                    last_name=last_name,
                    email=email.lower(),
                    phone=phone,
                    location=location,
                    security_level=security_level,
                    email_received_date=email_received_date,
                    scanned_date=datetime.utcnow(),
                    status=CandidateStatus.ACTIVE,
                    resume_url=resume_url,
                    notes=resume_text[:5000] if resume_text else None,
                )

                self.db.add(candidate)
                self.db.commit()
                self.db.refresh(candidate)

                logger.info(f"Created new candidate {candidate.id}: {email}")
                return candidate, True

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error saving/updating candidate: {e}")
            raise

    @staticmethod
    def _name_similarity(name1: str, name2: str) -> float:
        """Calculate similarity between two names (0-1)."""
        return SequenceMatcher(None, name1.lower(), name2.lower()).ratio()

    def get_security_keywords_dict(self) -> Dict[str, list]:
        """Get security keywords from database (Settings table)."""
        try:
            setting = self.db.query(Setting).filter(
                Setting.key == "security_keywords"
            ).first()

            if setting:
                return setting.value
            else:
                return self.SECURITY_KEYWORDS

        except Exception as e:
            logger.warning(f"Failed to load security keywords from database: {e}")
            return self.SECURITY_KEYWORDS
