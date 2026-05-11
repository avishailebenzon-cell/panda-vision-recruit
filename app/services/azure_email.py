import logging
import base64
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from azure.identity import ClientSecretCredential
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AzureEmailService:
    """Fetch emails from Office 365 via Microsoft Graph API (app-level auth)."""

    def __init__(self):
        self.tenant_id = settings.azure_tenant_id
        self.client_id = settings.azure_client_id
        self.client_secret = settings.azure_client_secret
        self.mailbox = settings.email_address

        self.credential = ClientSecretCredential(
            tenant_id=self.tenant_id,
            client_id=self.client_id,
            client_secret=self.client_secret,
        )

        self.graph_url = "https://graph.microsoft.com/v1.0"
        self.client = httpx.AsyncClient(timeout=30.0)

    async def get_access_token(self) -> str:
        """Get access token for Microsoft Graph API (app-level)."""
        try:
            token = self.credential.get_token("https://graph.microsoft.com/.default")
            return token.token
        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
            raise

    async def fetch_messages_since(
        self,
        since_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Fetch messages from the mailbox with attachments.

        Sorted oldest-first so incremental processing works correctly:
        we process old → new, and save the last processed date after each run.

        Args:
            since_date: Only fetch messages received after this datetime (UTC).
                        If None, fetches ALL messages from the beginning.
            limit: Max messages per scan cycle.

        Returns:
            List of message dicts, oldest first.
        """
        try:
            token = await self.get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

            # Use /users/{mailbox}/ — required for app (service principal) auth.
            # /me/ only works with delegated (user) auth.
            base_url = f"{self.graph_url}/users/{self.mailbox}/mailFolders/inbox/messages"

            # Build filter: always require attachments; optionally filter by date
            filters = ["hasAttachments eq true"]
            if since_date:
                # Graph API expects UTC ISO format without microseconds
                date_str = since_date.strftime("%Y-%m-%dT%H:%M:%SZ")
                filters.append(f"receivedDateTime gt {date_str}")

            params = {
                "$filter": " and ".join(filters),
                "$top": limit,
                "$select": "id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead",
                # NOTE: $orderby is intentionally omitted — combining $filter with $orderby
                # on the messages endpoint returns InefficientFilter (400). We sort in Python.
            }

            response = await self.client.get(base_url, headers=headers, params=params)
            response.raise_for_status()

            messages = response.json().get("value", [])

            # Sort oldest → newest so incremental processing works correctly.
            # ISO 8601 strings sort lexicographically = chronologically.
            messages.sort(key=lambda m: m.get("receivedDateTime", ""))

            logger.info(
                f"Fetched {len(messages)} messages with attachments"
                + (f" since {since_date.isoformat()}" if since_date else " (all time)")
            )
            return messages

        except httpx.HTTPStatusError as e:
            logger.error(f"Graph API HTTP error {e.response.status_code}: {e.response.text[:300]}")
            raise
        except Exception as e:
            logger.error(f"Failed to fetch messages: {e}")
            raise

    async def get_message_attachments(self, message_id: str) -> List[Dict[str, Any]]:
        """Get attachment list for a specific message."""
        try:
            token = await self.get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            url = f"{self.graph_url}/users/{self.mailbox}/messages/{message_id}/attachments"
            response = await self.client.get(
                url, headers=headers,
                params={"$select": "id,name,contentType,size"},
            )
            response.raise_for_status()

            attachments = response.json().get("value", [])
            logger.info(f"Found {len(attachments)} attachments in message {message_id}")
            return attachments

        except Exception as e:
            logger.error(f"Failed to fetch attachments for message {message_id}: {e}")
            raise

    async def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download and base64-decode an attachment."""
        try:
            token = await self.get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            url = f"{self.graph_url}/users/{self.mailbox}/messages/{message_id}/attachments/{attachment_id}"
            # NOTE: do NOT use $select=contentBytes — it causes 400 on the Graph API.
            # contentBytes is returned by default for fileAttachment objects.
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()

            content_b64 = response.json().get("contentBytes", "")
            attachment_bytes = base64.b64decode(content_b64) if content_b64 else b""

            logger.info(f"Downloaded attachment {attachment_id} ({len(attachment_bytes)} bytes)")
            return attachment_bytes

        except Exception as e:
            logger.error(f"Failed to download attachment {attachment_id}: {e}")
            raise

    async def mark_as_read(self, message_id: str) -> bool:
        """Mark a message as read."""
        try:
            token = await self.get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            url = f"{self.graph_url}/users/{self.mailbox}/messages/{message_id}"
            response = await self.client.patch(url, headers=headers, json={"isRead": True})
            response.raise_for_status()
            logger.info(f"Marked message {message_id} as read")
            return True
        except Exception as e:
            logger.warning(f"Failed to mark message as read: {e}")
            return False

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
