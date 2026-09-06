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
            system_message = (
                "You are a helpful AI assistant. Answer based on general industry knowledge only. "
                "You do NOT have access to any internal enterprise data, proprietary metrics, company-specific "
                "systems, warehouses, contracts, or KPI values. Do not reference any specific internal entity "
                "names, internal tools, or internal operational details. Give general best-practice advice only.\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "1. Keep your total response to 250 words or fewer. Be concise — use bullet points, not lengthy paragraphs.\n"
                "2. If your answer has more than one logical section (e.g. KPIs, financial framework, next steps), give each section "
                "a real markdown header (`## Section Name`) rather than a bold inline label — never use `**Section Name:**` as a "
                "pseudo-header. A short answer with only one section needs no header at all.\n"
                "3. At the very end of your answer, add exactly one line in this format: "
                "FOLLOW_UPS: <question 1> | <question 2> | <question 3>. Make the questions specific and useful. Do not number them."
            )
        elif grounding_mode == 'data_only':
            system_message = f"""You are answering using ONLY the data tables below. You have NO access to entity relationships, ownership, domain context, or business definitions — only the literal rows and columns shown.

{context}

CRITICAL INSTRUCTIONS:
1. Always start your response with a <reasoning> section (1-2 sentences max).
2. The FIRST sentence of <reasoning> MUST be exactly: "Answering using data only, without Enterprise Context."
3. Structure your final answer in exactly two sections, in this order, using these exact markdown headers:

## Exec Summary
- ✅ **Could answer:** 1-2 sentences on what the data tables let you determine for this question.
- ⚠️ **Could not answer:** 1-2 sentences naming SPECIFICALLY what could not be determined because Enterprise Context (relationships, ownership, business meaning, policies) is missing. Be concrete about what's missing for THIS question, not a generic disclaimer.

## Detailed Response
The fuller answer, using ONLY the numbers/rows literally present in the tables above.

4. Do NOT infer relationships, ownership, or business meaning that is not literally a column in the tables. If the question needs that kind of context, say so explicitly in "Could not answer" rather than guessing or filling gaps with assumptions.
5. Keep your total response (excluding the <reasoning> block and the FOLLOW_UPS line) to 250 words or fewer.
6. At the very end of your answer, add exactly one line in this format: FOLLOW_UPS: <question 1> | <question 2> | <question 3>. Do not number them.
7. Immediately before the FOLLOW_UPS line, add this exact line, as a markdown blockquote (starting with `> `): "> ⚠️ This response used data only — no Enterprise Context (relationships, ownership, definitions) was applied."

Example Format:
<reasoning>
Answering using data only, without Enterprise Context.
</reasoning>
## Exec Summary
- ✅ **Could answer:** ...
- ⚠️ **Could not answer:** ...

## Detailed Response
...

> ⚠️ This response used data only — no Enterprise Context (relationships, ownership, definitions) was applied.
FOLLOW_UPS: question 1 | question 2 | question 3"""
        else:
            persona_instructions = {
                'ceo': (
                    "You are advising a CEO. Structure your answer as three sections, each under its own real markdown header "
                    "(`## Recommendation`, `## KPIs & Financials`, `## Supporting Context` — exact header text, in that order): "
                    "## Recommendation — 2-3 sentences directly answering the question asked, naming the specific entities involved "
                    "(categories, regions, legal entities, contracts, policies, KPIs — whichever the question is actually about, "
                    "using their exact names from the context, never abbreviated), and why. "
                    "Bold every specific entity name you mention (categories, regions, KPIs, supply chain nodes, etc.) using **Name** markdown syntax, so key facts are easy to eyeball. "
                    "## KPIs & Financials — render as a markdown table with two columns, headers `Metric` and `Value`, one row per KPI/finance entity, name and value only (no prose description). "
                    "Order the rows logically, grouped by theme (e.g. market sizing together, then rollout/expansion values, then margins and returns, then costs and timeline) rather than randomly. "
                    "Any sequence of dated/staged values (e.g. Year 1, Year 2, Year 3) MUST appear in chronological order, never scattered. "
                    "## Supporting Context — one brief sentence per relevant entity type (supply chain, marketing channel, legal). "
                    "Keep each section concise. Do not write paragraph-length descriptions of individual entities. "
                    "Give ONE unified answer: do not split the same information across sections or repeat any list."
                ),
                'vp_supply_chain': "You are advising a VP Supply Chain. Lead with readiness status and blockers. Name specific supply chain nodes and their D2C status.",
                'cdo': "You are advising a CDO. Lead with which data products feed the recommendation and how the AI reasoning was grounded in specific graph nodes.",
            }
            persona_instruction = persona_instructions.get(persona_lens, persona_instructions['ceo'])

            grounding_label = {
                'kg_only': 'Enterprise Context (EC)',
                'kg_full': 'Enterprise Context + Data (EC+Data)',
            }.get(grounding_mode, grounding_mode)
            data_note = " Tabular data from entity metadata was included in context." if grounding_mode == 'kg_full' else ""

            system_message = f"""You are a helpful AI assistant that answers questions based on an enterprise context graph.

{context}

Persona framing: {persona_instruction}

Provide clear, accurate answers based on the context provided.

CRITICAL INSTRUCTIONS:
1. Always start your response with a <reasoning> section (2-3 sentences max).
2. The FIRST sentence of <reasoning> MUST be exactly: "Answering using {grounding_label} grounding with {entity_count} entities from the enterprise context.{data_note}"
3. Then add 1 sentence naming the 1-2 key entities you are drawing on.
4. Close the tag with </reasoning> then give the final answer.
5. Never split the same list or topic across two sections. One answer, one pass — no repeated summaries at the end.
6. When including entities in a list, use ALL entities of that type found in the context that are relevant to the channel/scope actually asked about — do not apply a stricter filter (e.g. "directly connected") beyond that. Specifically: EXCLUDE any entity whose name or description ties it exclusively to a different channel than the one the question is about (e.g. exclude Wholesale-specific KPIs like "RV Wholesale Baseline" from a question about D2C, or vice versa) unless the question explicitly asks for a cross-channel comparison. The context graph often connects entities from different channels through a shared data product — being graph-connected does not make an entity relevant if it belongs to a different channel than what was asked.
7. When describing a KPI, entity name, or metric, use ONLY the name and description as given in the enterprise context. Do NOT add qualifications, scope restrictions, or specificity (e.g. "specifically focusing on X category") that are not explicitly stated in that entity's own description.
7b. Always write every entity name (regions, categories, KPIs, nodes, etc.) EXACTLY as it appears in the enterprise context above. Never abbreviate, shorten, or combine names (e.g. write "London South East", not "London & SE" or "London/SE") — copy the name verbatim.
8. Keep your total response (excluding the <reasoning> block and the FOLLOW_UPS line) to 250 words or fewer. Be concise and structured — use bullet points, not paragraphs. If you are listing entities, name and value only (no description prose).
9. If your answer has more than one logical section, give each section a real markdown header (`## Section Name`) — never a bold inline label like `**Section Name:**`, and never a top-level `# Header`. A short answer with only one section needs no header at all.
10. At the very end of your answer (after all content), add exactly one line in this format: FOLLOW_UPS: <question 1> | <question 2> | <question 3>. Make the questions specific, grounded in the entities just discussed, and useful for the persona. Do not number them.

Example Format:
<reasoning>
Answering using {grounding_label} grounding with {entity_count} entities from the enterprise context.{data_note} I am drawing on TAV UK D2C Market (KPI) and its measures relationship to Sports Nutrition.
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
                "The enterprise context has no matching entities for this question.\n"
                "</reasoning>\n"
                "I don't have enough information in the enterprise context to answer that question. "
                "Try asking about entities like Orders, Lead to Cash Process, CPQ, or Customer Support AI Agent."
            )

        entities = re.findall(r'\*\*(.+?)\*\* \[(.+?)\]:', context)
        relationships = re.findall(r'- (.+?) \*\*(.+?)\*\* (.+)', context)

        reasoning_parts = ["I searched the enterprise context for information relevant to your question."]
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

        answer_parts = ["Based on the enterprise context:\n"]
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
            "This response was generated directly from the enterprise context._"
        )

        return (
            f"<reasoning>\n{chr(10).join(reasoning_parts)}\n</reasoning>\n"
            + "\n".join(answer_parts)
        )

    def generate_fallback_response_data_only(self, context: str) -> str:
        disclaimer = "> ⚠️ This response used data only — no Enterprise Context (relationships, ownership, definitions) was applied."

        if not context or context.startswith("No data") or context.startswith("No relevant"):
            return (
                "<reasoning>\n"
                "No data tables matched this question.\n"
                "</reasoning>\n"
                "## Exec Summary\n"
                "- ✅ **Could answer:** Nothing — no matching data tables were found for this question.\n"
                "- ⚠️ **Could not answer:** Everything. There is no data to work from, and no Enterprise Context (relationships, ownership, business meaning) either.\n\n"
                "## Detailed Response\n"
                "Try asking about product catalogue, customer insights, supply chain, or sales revenue data.\n\n"
                f"{disclaimer}"
            )

        # Strip the leading "# Data (No Enterprise Context)" header/blurb — redundant now
        # that Exec Summary already covers that framing — keep just the per-table sections.
        tables_only = context.split("\n## Instructions:")[0]
        first_table_idx = tables_only.find("\n## ")
        if first_table_idx != -1:
            tables_only = tables_only[first_table_idx + 1:]
        tables_only = tables_only.strip()

        return (
            "<reasoning>\n"
            "Answering using data only, without Enterprise Context.\n"
            "</reasoning>\n"
            "## Exec Summary\n"
            "- ✅ **Could answer:** The literal numbers in the tables below.\n"
            "- ⚠️ **Could not answer:** Why these numbers matter, who owns them, or how they relate to other parts of the business — that requires Enterprise Context, which was not used here.\n\n"
            "## Detailed Response\n"
            f"{tables_only}\n\n"
            "_Note: Configure OPENAI_API_KEY for full AI-powered answers. This response lists the data directly._\n\n"
            f"{disclaimer}"
        )

    def _fallback_for(self, user_message: str, context: str, grounding_mode: str) -> str:
        if grounding_mode == 'data_only':
            return self.generate_fallback_response_data_only(context)
        return self.generate_fallback_response(user_message, context)

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
                    'or switch to an Enterprise Context grounding mode for graph-based answers.'
                ),
                'tokens_used': 0,
                'reasoning': None,
            }

        if not client:
            fallback = self._fallback_for(user_message, context, grounding_mode)
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
                max_tokens=10000,
            )

            raw_content = response.choices[0].message.content or ''
            reasoning, answer = self.extract_reasoning(raw_content)

            if grounding_mode == 'data_only' and 'no enterprise context' not in answer.lower():
                answer = answer.rstrip() + (
                    "\n\n> ⚠️ This response used data only — no Enterprise Context "
                    "(relationships, ownership, definitions) was applied."
                )

            return {
                'content': answer,
                'reasoning': reasoning or None,
                'tokens_used': response.usage.total_tokens if response.usage else 0,
            }
        except Exception:
            print("LLM provider error — details suppressed for security")
            fallback = self._fallback_for(user_message, context, grounding_mode)
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
                'or switch to an Enterprise Context grounding mode.'
            )
            return

        if not client:
            fallback = self._fallback_for(user_message, context, grounding_mode)
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
                max_tokens=10000,
                stream=True,
            )

            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception:
            print("LLM provider error — details suppressed for security")
            fallback = self._fallback_for(user_message, context, grounding_mode)
            yield fallback

llm_service = LLMService()
