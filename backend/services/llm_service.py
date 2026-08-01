import os
import re
import logging
from typing import AsyncGenerator, Optional
from openai import OpenAI
from dotenv import load_dotenv

# S3 Security Rule — Suppress httpx, httpcore, and openai loggers before client init
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

load_dotenv()

OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-3.5-flash"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

class LLMService:
    """
    Service for LLM integration with OpenAI and Gemini.
    Falls back to graph-grounded responses when no API key is configured.
    """

    def __init__(self):
        openai_key = os.getenv('OPENAI_API_KEY')
        self.openai_available = bool(openai_key and openai_key != 'your_openai_api_key_here')
        self.openai_client = OpenAI(api_key=openai_key) if self.openai_available else None

        gemini_key = os.getenv('GEMINI_API_KEY')
        self.gemini_available = bool(gemini_key and gemini_key != 'your_gemini_api_key_here')
        self.gemini_client = OpenAI(api_key=gemini_key, base_url=GEMINI_BASE_URL) if self.gemini_available else None

        # Keep self.available for backward compatibility with existing fallback checks
        self.available = self.openai_available or self.gemini_available
        self.model = OPENAI_MODEL

    def _get_client(self, provider: str = 'openai'):
        """Get (client, model, resolved_provider) for the specified or fallback provider."""
        if provider == 'gemini' and self.gemini_available:
            return self.gemini_client, GEMINI_MODEL, 'gemini'
        if self.openai_available:
            return self.openai_client, OPENAI_MODEL, 'openai'
        if self.gemini_available:
            return self.gemini_client, GEMINI_MODEL, 'gemini'
        return None, None, None

    def extract_reasoning(self, raw: str) -> tuple:
        """Extract <reasoning> tag contents from response text."""
        match = re.search(r'<reasoning>(.*?)</reasoning>', raw, re.DOTALL)
        if match:
            reasoning = match.group(1).strip()
            answer = raw[match.end():].strip()
            return reasoning, answer
        return '', raw

    def build_prompt(
        self,
        user_message: str,
        context: str,
        conversation_history: list = None,
        grounding_mode: str = 'kg_full',
        persona_lens: str = 'ceo',
        entity_count: int = 0,
    ) -> list:
        messages = []

        if grounding_mode == 'generic':
            system_message = "You are a helpful AI assistant."
        else:
            persona_instructions = {
                'ceo': "You are advising a CEO. Lead with TAV, EAV-by-year, and RV business impact first, then the recommendation.",
                'vp_supply_chain': "You are advising a VP Supply Chain. Lead with readiness status and blockers. Name specific supply chain nodes and their D2C status.",
                'cdo': "You are advising a CDO. Lead with which data products feed the recommendation and how the AI reasoning was grounded in specific graph nodes.",
            }
            persona_instruction = persona_instructions.get(persona_lens, persona_instructions['ceo'])

            grounding_label = {
                'kg_only': 'Knowledge Graph',
                'kg_full': 'Knowledge Graph + Data',
            }.get(grounding_mode, grounding_mode)
            data_note = " Tabular data from entity metadata was included in context." if grounding_mode == 'kg_full' else ""

            system_message = f"""You are a helpful AI assistant that answers questions based on an enterprise knowledge graph.

{context}

Persona framing: {persona_instruction}

Provide clear, accurate answers based on the context provided.

CRITICAL INSTRUCTIONS:
1. Always start your response with a <reasoning> section (2-3 sentences max).
2. The FIRST sentence of <reasoning> MUST be exactly: "Answering using {grounding_label} grounding with {entity_count} entities from the knowledge graph.{data_note}"
3. Then add 1 sentence naming the 1-2 key entities you are drawing on.
4. Close the tag with </reasoning> then give the final answer.

Example Format:
<reasoning>
Answering using {grounding_label} grounding with {entity_count} entities from the knowledge graph.{data_note} I am drawing on TAV UK D2C Market (KPI) and its measures relationship to Sports Nutrition.
</reasoning>
Final answer goes here..."""

        messages.append({"role": "system", "content": system_message})

        if conversation_history:
            for msg in conversation_history[-5:]:
                role = msg.role if hasattr(msg, 'role') else msg.get('role')
                content = msg.content if hasattr(msg, 'content') else msg.get('content')
                if role and content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message})
        return messages

    def generate_fallback_response(self, user_message: str, context: str) -> str:
        if not context or context.startswith("No relevant"):
            return (
                "<reasoning>\n"
                "The knowledge graph has no matching entities for this question.\n"
                "</reasoning>\n"
                "I don't have enough information in the knowledge graph to answer that question. "
                "Try asking about entities like Orders, Lead to Cash Process, CPQ, or Customer Support AI Agent."
            )

        entities = re.findall(r'\*\*(.+?)\*\* \[(.+?)\]:', context)
        relationships = re.findall(r'- (.+?) \*\*(.+?)\*\* (.+)', context)

        reasoning_parts = ["I searched the knowledge graph for information relevant to your question."]
        if entities:
            reasoning_parts.append(
                "Relevant entities: " + ", ".join(f"{name} ({cat})" for name, cat in entities[:6])
            )
        if relationships:
            reasoning_parts.append(
                "Key relationships: " + "; ".join(
                    f"{s} {rel} {t}" for s, rel, t in relationships[:5]
                )
            )

        answer_parts = ["Based on the knowledge graph:\n"]
        for name, category in entities[:8]:
            desc_match = re.search(
                rf'\*\*{re.escape(name)}\*\* \[{re.escape(category)}\]: (.+)',
                context
            )
            desc = desc_match.group(1).strip() if desc_match else ""
            answer_parts.append(f"- **{name}** ({category}): {desc}")

        if relationships:
            answer_parts.append("\nConnections:")
            for source, rel, target in relationships[:8]:
                answer_parts.append(f"- {source} → {rel} → {target}")

        answer_parts.append(
            "\n_Note: Configure OPENAI_API_KEY for full AI-powered answers. "
            "This response was generated directly from the knowledge graph._"
        )

        return (
            f"<reasoning>\n{chr(10).join(reasoning_parts)}\n</reasoning>\n"
            + "\n".join(answer_parts)
        )

    async def generate_response(
        self,
        user_message: str,
        context: str,
        conversation_history: list = None,
        grounding_mode: str = 'kg_full',
        provider: str = 'openai',
        persona_lens: str = 'ceo',
        entity_count: int = 0,
    ) -> dict:
        client, model, _ = self._get_client(provider)

        if grounding_mode == 'generic' and not client:
            return {
                'content': (
                    'LLM service is not available. Please configure OPENAI_API_KEY or GEMINI_API_KEY in your .env file, '
                    'or switch to a Knowledge Graph grounding mode for graph-based answers.'
                ),
                'tokens_used': 0,
                'reasoning': None,
            }

        if not client:
            fallback = self.generate_fallback_response(user_message, context)
            reasoning, answer = self.extract_reasoning(fallback)
            return {
                'content': answer,
                'reasoning': reasoning or None,
                'tokens_used': 0,
            }

        messages = self.build_prompt(user_message, context, conversation_history, grounding_mode, persona_lens, entity_count)

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=3000,
            )

            raw_content = response.choices[0].message.content or ''
            reasoning, answer = self.extract_reasoning(raw_content)

            return {
                'content': answer,
                'reasoning': reasoning or None,
                'tokens_used': response.usage.total_tokens if response.usage else 0,
            }
        except Exception:
            print("LLM provider error — details suppressed for security")
            fallback = self.generate_fallback_response(user_message, context)
            reasoning, answer = self.extract_reasoning(fallback)
            return {
                'content': answer,
                'reasoning': reasoning or None,
                'tokens_used': 0,
            }

    async def stream_response(
        self,
        user_message: str,
        context: str,
        conversation_history: list = None,
        grounding_mode: str = 'kg_full',
        provider: str = 'openai',
        persona_lens: str = 'ceo',
        entity_count: int = 0,
    ) -> AsyncGenerator[str, None]:
        client, model, _ = self._get_client(provider)

        if grounding_mode == 'generic' and not client:
            yield (
                'LLM service is not available. Please configure OPENAI_API_KEY or GEMINI_API_KEY, '
                'or switch to a Knowledge Graph grounding mode.'
            )
            return

        if not client:
            fallback = self.generate_fallback_response(user_message, context)
            chunk_size = 40
            for i in range(0, len(fallback), chunk_size):
                yield fallback[i:i + chunk_size]
            return

        messages = self.build_prompt(user_message, context, conversation_history, grounding_mode, persona_lens, entity_count)

        try:
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=3000,
                stream=True,
            )

            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception:
            print("LLM provider error — details suppressed for security")
            fallback = self.generate_fallback_response(user_message, context)
            yield fallback

llm_service = LLMService()
