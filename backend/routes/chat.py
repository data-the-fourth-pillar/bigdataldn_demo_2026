from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from datetime import datetime
import uuid
import json
from backend.models.chat import ChatRequest, ChatResponse, Message, UsedContext, Citation
from backend.services.context_service import context_service
from backend.services.llm_service import llm_service

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
async def send_message(request: ChatRequest):
    """Send a message and get a complete response"""

    context_data = context_service.assemble_context(
        request.message,
        request.groundingMode,
        request.focusEntityId,
    )

    llm_response = await llm_service.generate_response(
        request.message,
        context_data['context_string'],
        request.conversationHistory,
        grounding_mode=request.groundingMode,
    )

    message = Message(
        id=str(uuid.uuid4()),
        role='assistant',
        content=llm_response['content'],
        timestamp=datetime.utcnow().isoformat(),
        citations=_build_citations(context_data),
        usedContext=_build_used_context(context_data),
    )

    return ChatResponse(
        message=message,
        usedContext=_build_used_context(context_data),
        tokensUsed=llm_response.get('tokens_used', 0),
    )

@router.post("/stream")
async def stream_message(request: ChatRequest):
    """Send a message and get a streaming response"""

    context_data = context_service.assemble_context(
        request.message,
        request.groundingMode,
        request.focusEntityId,
    )

    async def generate():
        try:
            context_info = {
                "context": {
                    "entities": context_data['used_entities'],
                    "relationships": context_data['used_relationships'],
                    "raw_context_string": context_data['context_string'],
                    "citations": context_data.get('citations', []),
                },
                "done": False,
            }
            yield f"data: {json.dumps(context_info)}\n\n"

            async for chunk in llm_service.stream_response(
                request.message,
                context_data['context_string'],
                request.conversationHistory,
                grounding_mode=request.groundingMode,
            ):
                data = json.dumps({"delta": chunk, "done": False})
                yield f"data: {data}\n\n"

            yield f"data: [DONE]\n\n"

        except Exception as e:
            error_data = json.dumps({"error": str(e), "done": True})
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
