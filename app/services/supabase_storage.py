import logging
import os
import io
from datetime import datetime
from typing import Optional, Tuple
from pathlib import Path

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class SupabaseStorageClient:
    """Client for Supabase Storage operations."""

    def __init__(self):
        self.supabase_url = settings.supabase_url.rstrip("/")
        self.api_key = settings.supabase_key
        self.bucket_name = settings.supabase_storage_bucket
        self.base_url = f"{self.supabase_url}/storage/v1"
        self.client = httpx.AsyncClient()

        if not self.supabase_url or not self.api_key:
            logger.warning("Supabase credentials not configured")

    def _get_headers(self) -> dict:
        """Get authorization headers."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def upload_cv(
        self,
        file_content: bytes,
        filename: str,
        candidate_id: int,
    ) -> Tuple[Optional[str], bool]:
        """
        Upload CV file to Supabase Storage.

        Args:
            file_content: Binary content of the file
            filename: Original filename
            candidate_id: ID of the candidate

        Returns:
            Tuple of (file_url, success)
        """
        try:
            if not self.supabase_url or not self.api_key:
                logger.warning("Supabase credentials not configured, skipping upload")
                return None, False

            # Generate storage path: cv-files/candidate-{id}/filename
            file_ext = Path(filename).suffix.lower()
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            storage_path = f"candidate-{candidate_id}/{timestamp}{file_ext}"

            # Upload file
            url = f"{self.base_url}/object/{self.bucket_name}/{storage_path}"

            headers = self._get_headers()

            response = await self.client.post(
                url,
                headers=headers,
                content=file_content,
            )

            if response.status_code in [200, 201]:
                # Generate public URL
                file_url = (
                    f"{self.supabase_url}/storage/v1/object/public/"
                    f"{self.bucket_name}/{storage_path}"
                )

                logger.info(f"Uploaded CV for candidate {candidate_id}: {file_url}")
                return file_url, True

            else:
                logger.error(
                    f"Failed to upload CV: {response.status_code} - {response.text}"
                )
                return None, False

        except Exception as e:
            logger.error(f"Error uploading CV: {e}")
            return None, False

    async def delete_cv(self, file_path: str) -> bool:
        """
        Delete CV file from Supabase Storage.

        Args:
            file_path: Path relative to bucket (e.g., "candidate-1/file.pdf")

        Returns:
            Success status
        """
        try:
            if not self.supabase_url or not self.api_key:
                logger.warning("Supabase credentials not configured")
                return False

            url = f"{self.base_url}/object/{self.bucket_name}/{file_path}"
            headers = self._get_headers()

            response = await self.client.delete(url, headers=headers)

            if response.status_code in [200, 204]:
                logger.info(f"Deleted file: {file_path}")
                return True
            else:
                logger.error(f"Failed to delete file: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False

    async def download_cv(self, file_path: str) -> Optional[bytes]:
        """
        Download CV file from Supabase Storage.

        Args:
            file_path: Path relative to bucket

        Returns:
            File content or None if failed
        """
        try:
            if not self.supabase_url or not self.api_key:
                logger.warning("Supabase credentials not configured")
                return None

            url = f"{self.base_url}/object/{self.bucket_name}/{file_path}"
            headers = self._get_headers()

            response = await self.client.get(url, headers=headers)

            if response.status_code == 200:
                logger.info(f"Downloaded file: {file_path}")
                return response.content
            else:
                logger.error(f"Failed to download file: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error downloading file: {e}")
            return None

    async def create_bucket(self) -> bool:
        """
        Create cv-files bucket if it doesn't exist.

        Returns:
            Success status
        """
        try:
            if not self.supabase_url or not self.api_key:
                logger.warning("Supabase credentials not configured")
                return False

            url = f"{self.base_url}/bucket"
            headers = self._get_headers()

            payload = {
                "name": self.bucket_name,
                "public": True,  # Allow public access to files
            }

            response = await self.client.post(
                url,
                headers=headers,
                json=payload,
            )

            if response.status_code in [200, 201]:
                logger.info(f"Created bucket: {self.bucket_name}")
                return True
            elif response.status_code == 400:
                # Bucket already exists
                logger.info(f"Bucket already exists: {self.bucket_name}")
                return True
            else:
                logger.error(f"Failed to create bucket: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error creating bucket: {e}")
            return False

    async def list_files(self, prefix: str = "") -> list:
        """
        List files in bucket with optional prefix.

        Args:
            prefix: Path prefix to filter by

        Returns:
            List of file objects
        """
        try:
            if not self.supabase_url or not self.api_key:
                logger.warning("Supabase credentials not configured")
                return []

            url = f"{self.base_url}/object/list/{self.bucket_name}"
            headers = self._get_headers()

            params = {}
            if prefix:
                params["prefix"] = prefix

            response = await self.client.get(
                url,
                headers=headers,
                params=params,
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to list files: {response.status_code}")
                return []

        except Exception as e:
            logger.error(f"Error listing files: {e}")
            return []

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
