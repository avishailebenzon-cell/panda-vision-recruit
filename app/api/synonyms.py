from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.settings import Setting
import logging, json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/synonyms", tags=["synonyms"])

SYNONYMS_KEY = "synonyms_list"


@router.get("/")
async def get_synonyms(db: Session = Depends(get_db)):
    try:
        setting = db.query(Setting).filter(Setting.key == SYNONYMS_KEY).first()
        items = setting.value if setting else []
        return {"synonyms": items if isinstance(items, list) else []}
    except Exception as e:
        logger.error(f"Error fetching synonyms: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch synonyms")


@router.post("/")
async def create_synonym(data: dict, db: Session = Depends(get_db)):
    try:
        setting = db.query(Setting).filter(Setting.key == SYNONYMS_KEY).first()
        items = list(setting.value) if setting else []
        new_item = {
            "id": max([x.get("id", 0) for x in items], default=0) + 1,
            "term": data.get("term", ""),
            "synonyms": data.get("synonyms", []),
            "category": data.get("category", "general"),
        }
        items.append(new_item)
        if setting:
            setting.value = items
        else:
            setting = Setting(key=SYNONYMS_KEY, value=items, description="Synonyms dictionary")
            db.add(setting)
        db.commit()
        return {"status": "created", "item": new_item}
    except Exception as e:
        logger.error(f"Error creating synonym: {e}")
        raise HTTPException(status_code=500, detail="Failed to create synonym")


@router.delete("/{synonym_id}")
async def delete_synonym(synonym_id: int, db: Session = Depends(get_db)):
    try:
        setting = db.query(Setting).filter(Setting.key == SYNONYMS_KEY).first()
        if setting:
            items = [x for x in (setting.value or []) if x.get("id") != synonym_id]
            setting.value = items
            db.commit()
        return {"status": "deleted", "id": synonym_id}
    except Exception as e:
        logger.error(f"Error deleting synonym {synonym_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete synonym")
