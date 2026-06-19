import os
import re
from typing import AsyncGenerator, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class LLMService:
    """
    Service for LLM integration with OpenAI.
    Falls back to graph-grounded responses when no API key is configured.
    """

    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key and api_key != 'your_openai_api_key_here':
            self.client = OpenAI(api_key=api_key)
            self.available = True
        else:
            self.client = None
            self.available = False

        self.model = "gpt-4o-mini"

    def build_prompt(
        self,
        user_message: str,
        context: str,
        conversation_history: list = None,
        grounding_mode: str = 'kg_full',
    ) -> list:
        messages = []

        if grounding_mode == 'generic':
            system_message = "You are a helpful AI assistant."
        else:
            system_message = f"""You are a helpful AI assistant that answers questions based on an enterprise knowledge graph.

{context}

Provide clear, accurate answers based on the context provided.

CRITICAL INSTRUCTIONS:
1. Always start your response with a <reasoning> section.
2. In the <reasoning> section, explain which entities and relationships from the knowledge graph you are using.
3. After the reasoning section, provide the final answer.

Example Format:
<reasoning>
I identify the Orders data product and its relationship to Lead to Cash Process...
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
    ) -> dict:
        if grounding_mode == 'generic' and not self.available:
            return {
                'content': (
                    'LLM service is not available. Please configure OPENAI_API_KEY in your .env file, '
                    'or switch to a Knowledge Graph grounding mode for graph-based answers.'
                ),
                'tokens_used': 0,
            }

        if not self.available:
            return {
                'content': self.generate_fallback_response(user_message, context),
                'tokens_used': 0,
            }

        messages = self.build_prompt(user_message, context, conversation_history, grounding_mode)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )

            return {
                'content': response.choices[0].message.content,
                'tokens_used': response.usage.total_tokens if response.usage else 0,
            }
        except Exception as e:
            print(f"LLM Error: {e}")
            return {
                'content': self.generate_fallback_response(user_message, context),
                'tokens_used': 0,
            }

    async def stream_response(
        self,
        user_message: str,
        context: str,
        conversation_history: list = None,
        grounding_mode: str = 'kg_full',
    ) -> AsyncGenerator[str, None]:
        if grounding_mode == 'generic' and not self.available:
            yield (
                'LLM service is not available. Please configure OPENAI_API_KEY, '
                'or switch to a Knowledge Graph grounding mode.'
            )
            return

        if not self.available:
            fallback = self.generate_fallback_response(user_message, context)
            chunk_size = 40
            for i in range(0, len(fallback), chunk_size):
                yield fallback[i:i + chunk_size]
            return

        messages = self.build_prompt(user_message, context, conversation_history, grounding_mode)

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
                stream=True,
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            print(f"LLM Streaming Error: {e}")
            fallback = self.generate_fallback_response(user_message, context)
            yield fallback

llm_service = LLMService()
