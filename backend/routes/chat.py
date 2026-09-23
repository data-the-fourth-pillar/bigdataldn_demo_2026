from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from datetime import datetime
import uuid
import json
from backend.models.chat import ChatRequest, ChatResponse, Message, UsedContext, Citation
from backend.services.context_service import context_service
from backend.services.llm_service import llm_service
from backend.services.rate_limit_service import check_rate_limit

router = APIRouter(tags=["chat"])

def _build_used_context(context_data: dict) -> UsedContext:
    return UsedContext(
        entities=context_data['used_entities'],
        relationships=context_data['used_relationships'],
        raw_context_string=context_data['context_string'],
    )

def _build_citations(context_data: dict) -> list:
    return [Citation(**c) for c in context_data.get('citations', [])]

@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest, http_request: Request):
    """Send a message and get a complete response"""

    check_rate_limit(http_request)

    context_data = context_service.assemble_context(
        request.message,
        request.groundingMode,
        request.focusEntityId,
        persona_lens=request.personaLens,
    )

    llm_response = await llm_service.generate_response(
        request.message,
        context_data['context_string'],
        request.conversationHistory,
        grounding_mode=request.groundingMode,
        provider=request.provider,
        persona_lens=request.personaLens,
        entity_count=len(context_data['used_entities']),
    )

    message = Message(
        id=str(uuid.uuid4()),
        role='assistant',
        content=llm_response['content'],
        timestamp=datetime.utcnow().isoformat(),
        citations=_build_citations(context_data),
        usedContext=_build_used_context(context_data),
        reasoning=llm_response.get('reasoning'),
    )

    return ChatResponse(
        message=message,
        usedContext=_build_used_context(context_data),
        tokensUsed=llm_response.get('tokens_used', 0),
        failoverTriggered=llm_response.get('failover_triggered', False),
        failoverNotice=llm_response.get('failover_notice'),
    )

@router.post("/stream")
async def stream_message(request: ChatRequest, http_request: Request):
    """Send a message and get a streaming response"""

    check_rate_limit(http_request)

    context_data = context_service.assemble_context(
        request.message,
        request.groundingMode,
        request.focusEntityId,
        persona_lens=request.personaLens,
    )

    async def generate():
        try:
            context_info = {
                "context": {
                    "entities": context_data['used_entities'],
                    "relationships": context_data['used_relationships'],
                    "raw_context_string": context_data['context_string'],
                    "citations": context_data.get('citations', []),
                    "persona_lens": context_data.get('persona_lens', 'ceo'),
                },
                "done": False,
            }
            yield f"data: {json.dumps(context_info)}\n\n"

            async for chunk in llm_service.stream_response(
                request.message,
                context_data['context_string'],
                request.conversationHistory,
                grounding_mode=request.groundingMode,
                provider=request.provider,
                persona_lens=request.personaLens,
                entity_count=len(context_data['used_entities']),
            ):
                data = json.dumps({"delta": chunk, "done": False})
                yield f"data: {data}\n\n"

            done_payload = json.dumps({
                "done": True,
                "failoverTriggered": False,
                "failoverNotice": None,
            })
            yield f"data: {done_payload}\n\n"

        except Exception as e:
            # S2 Security Rule — Suppress exception details in the SSE response
            # (could leak URLs/headers/bodies to the client). Logging the exception
            # TYPE only (never str(e), which could contain those same details) is
            # safe and was previously entirely missing here — this handler wraps the
            # whole request including context assembly and the LLM stream, so any
            # failure in that path was silently invisible server-side too.
            print(f"Chat stream error ({type(e).__name__}) — details suppressed for security")
            error_data = json.dumps({"error": "Stream error — please retry.", "done": True})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

@router.get("/context/{message_id}")
async def get_context(message_id: str):
    """Get the context used for a specific message"""
    return {
        "entities": [],
        "relationships": [],
        "message": "Context retrieval not yet implemented",
    }
