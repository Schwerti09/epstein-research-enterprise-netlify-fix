from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import asyncio
from contextlib import asynccontextmanager
import json
import os
from datetime import datetime
import time

import asyncpg
from openai import AsyncOpenAI

models: Dict[str, Any] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    dsn = os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL")
    if dsn:
        models["db_pool"] = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10)
    else:
        models["db_pool"] = None
        print("NEON_DATABASE_URL/DATABASE_URL not set")

    models["openai"] = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
    yield
    if models.get("db_pool"):
        await models["db_pool"].close()

app = FastAPI(lifespan=lifespan, title="AI Microservice", version="3.0")

class DocumentAnalysisRequest(BaseModel):
    document_id: str
    content: str
    priority: str = "normal"
    analysis_types: List[str] = ["summary", "entities"]

class AIAnalysisService:
    def __init__(self):
        self.client = models.get("openai")
        self.chat_model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

    async def anonymize_sensitive_data(self, text: str) -> str:
        import re
        text = re.sub(r'\b[\w\.-]+@[\w\.-]+\.\w+\b', '[EMAIL_REDACTED]', text)
        text = re.sub(r'\b\+?\d[\d\s\-\(\)]{8,}\d\b', '[PHONE_REDACTED]', text)
        return text

    async def generate_summary(self, text: str) -> str:
        if not self.client:
            return "OPENAI_API_KEY fehlt (Template)."
        resp = await self.client.chat.completions.create(
            model=self.chat_model,
            messages=[
                {"role": "system", "content": "Erstelle eine präzise, faktische Zusammenfassung (max 3 Sätze)."},
                {"role": "user", "content": text[:12000]},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        return resp.choices[0].message.content or ""

    async def extract_entities(self, text: str) -> list:
        if not self.client:
            return []
        prompt = (
            "Extrahiere erwähnte Entitäten. Kategorien: PERSON, ORGANIZATION, LOCATION, DATE, LEGAL_REFERENCE. "
            "Gib JSON {"entities":[{"name":"","type":"","context":"","confidence":0.0}]} zurück.\n\n"
            f"Text:\n{text[:8000]}"
        )
        resp = await self.client.chat.completions.create(
            model=self.chat_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=800,
        )
        try:
            obj = json.loads(resp.choices[0].message.content or "{}")
            return obj.get("entities", [])
        except Exception:
            return []

    async def save_analysis(self, document_id: str, summary: str, entities: list, model_used: str, ms: int):
        pool = models.get("db_pool")
        if not pool:
            raise HTTPException(status_code=500, detail="DB not configured")
        async with pool.acquire() as conn:
            doc = await conn.fetchrow("SELECT id FROM documents WHERE document_id=$1", document_id)
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found (seed documents first)")
            doc_uuid = doc["id"]
            await conn.execute(
                """
                INSERT INTO document_analyses (document_id, analysis_version, summary, key_entities, model_used, processing_time_ms, updated_at)
                VALUES ($1, 'v2.0', $2, $3::jsonb, $4, $5, NOW())
                ON CONFLICT (document_id, analysis_version)
                DO UPDATE SET summary=EXCLUDED.summary, key_entities=EXCLUDED.key_entities, model_used=EXCLUDED.model_used,
                              processing_time_ms=EXCLUDED.processing_time_ms, updated_at=NOW();
                """,
                doc_uuid, summary, json.dumps(entities), model_used, ms
            )

    async def analyze_document(self, req: DocumentAnalysisRequest) -> dict:
        start = time.time()
        cleaned = await self.anonymize_sensitive_data(req.content)

        tasks = []
        do_summary = "summary" in req.analysis_types
        do_entities = "entities" in req.analysis_types

        if do_summary:
            tasks.append(self.generate_summary(cleaned))
        if do_entities:
            tasks.append(self.extract_entities(cleaned))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        idx = 0
        summary = ""
        entities = []
        if do_summary:
            summary = results[idx] if not isinstance(results[idx], Exception) else ""
            idx += 1
        if do_entities:
            entities = results[idx] if idx < len(results) and not isinstance(results[idx], Exception) else []
            idx += 1

        ms = int((time.time() - start) * 1000)
        await self.save_analysis(req.document_id, summary, entities, self.chat_model, ms)
        return {"status": "completed", "document_id": req.document_id, "processing_time_ms": ms}

service = AIAnalysisService()

@app.post("/api/v2/analyze")
async def analyze_document(request: DocumentAnalysisRequest, background_tasks: BackgroundTasks):
    task_id = f"task_{datetime.now().timestamp()}"
    background_tasks.add_task(service.analyze_document, request)
    return {"task_id": task_id, "status": "queued", "estimated_time": "10-60 seconds"}

@app.get("/health")
async def health():
    return {"ok": True}
