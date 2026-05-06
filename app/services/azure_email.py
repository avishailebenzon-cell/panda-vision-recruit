import logging
from typing import List, Dict, Any
from datetime import datetime
from azure.identity import ClientSecretCredential
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class AzureEmailService:
    """Service for fetching emails from Azure/Office 365 via Microsoft Graph API."""

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
        self.client = httpx.AsyncClient()

    async def get_access_token(self) -> str:
        """Get access token for Microsoft Graph API."""
        try:
            token = self.credential.get_token("https://graph.microsoft.com/.default")
            return token.token
        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
            raise

    async def fetch_unread_messages(
        self,
        limit: int = 50,
        days_back: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Fetch unread messages from the mailbox with attachments.

        Args:
            limit: Maximum number of messages to fetch
            days_back: Look back this many days
        """
        try:
            token = await self.get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

            # Filter for unread messages with attachments from the last N days
            filter_query = "isRead eq false and hasAttachments eq true"

            url = f"{self.graph_url}/me/mailFolders/inbox/messages"
            params = {
                "$filter": filter_query,
                "$top": limit,
                "$select": "id,subject,from,receivedDateTime,bodyPreview,hasAttachments",
                "$orderby": "receivedDateTime desc",
            }

            response = await self.client.get(url, headers=headers, params=params)
            response.raise_for_status()

            data = response.json()
            messages = data.get("value", [])

            logger.info(f"Fetched {len(messages)} unread messages with attachments")
            return messages

        except Exception as e:
            logger.error(f"Failed to fetch messages: {e}")
            raise

    async def get_message_attachments(self, message_id: str) -> List[Dict[str, Any]]:
        """Get attachments for a specific message."""
        try:
            token = await self.get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

            url = f"{self.graph_url}/me/messages/{message_id}/attachments"
            params = {
                "$select": "id,name,contentType,size",
            }

            response = await self.client.get(url, headers=headers, params=params)
            response.raise_for_status()

            data = response.json()
            attachments = data.get("value", [])

            logger.info(f"Found {len(attachments)} attachments in message {message_id}")
            return attachments

        except Exception as e:
            logger.error(f"Failed to fetch attachments for message {message_id}: {e}")
            raise

    async def download_attachment(
        self,
        message_id: str,
        attachment_id: str
    ) -> bytes:
        """Download attachment content."""
        try:
            token = await self.get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
            }

            url = f"{self.graph_url}/me/messages/{message_id}/attachments/{attachment_id}"
            params = {"$select": "contentBytes"}

            response = await self.client.get(url, headers=headers, params=params)
            response.raise_for_status()

            data = response.json()
            # Base64 decode the content
            import base64
            content = data.get("contentBytes", "")
            attachment_bytes = base64.b64decode(content) if content else b""

            logger.info(f"Downloaded attachment {attachment_id} from message {message_id}")
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

            url = f"{self.graph_url}/me/messages/{message_id}"
            payload = {"isRead": True}

            response = await self.client.patch(url, headers=headers, json=payload)
            response.raise_for_status()

            logger.info(f"Marked message {message_id} as read")
            return True

        except Exception as e:
            logger.error(f"Failed to mark message as read: {e}")
            return False

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
