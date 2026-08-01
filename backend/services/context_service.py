from typing import List, Dict, Any, Optional, Set
from backend.services.graph_service import graph_service
from backend.models.graph import Entity, Relationship

CATEGORY_LABELS = {
    'domain': 'Domain',
    'data_product': 'Data Product',
    'process': 'Process',
    'person': 'People',
    'technology': 'Technology',
    'ai_agent': 'AI Agent',
    'metadata_technical': 'Technology',
    'product_category': 'Product Category',
    'region': 'UK Region',
    'supply_chain_node': 'Supply Chain Node',
    'marketing_channel': 'Marketing Channel',
    'kpi': 'KPI',
    'legal_entity': 'Legal Entity',
    'finance_entity': 'Finance',
}

class ContextService:
    """
    Service for assembling graph context for LLM queries
    """

    def __init__(self):
        self.max_entities = 20
        self.max_depth = 2

    def interpret_query(self, query: str) -> Dict[str, Any]:
        query_lower = query.lower()

        type_keywords = {
            'domain': ['domain', 'data domain'],
            'data_product': ['data product', 'orders', 'order data', 'dataset'],
            'process': ['process', 'workflow', 'lead to cash', 'ltc'],
            'person': ['people', 'person', 'team', 'finance'],
            'technology': ['technology', 'system', 'platform', 'cpq', 'crm', 'tool'],
            'ai_agent': ['ai agent', 'agent', 'support agent', 'bot'],
            'kpi': ['kpi', 'eav', 'tav', 'rv', 'revenue', 'addressable'],
            'product_category': ['product', 'category', 'nutrition', 'beauty', 'vitamin', 'pet', 'apparel'],
            'region': ['region', 'uk', 'london', 'southeast', 'midlands', 'north', 'scotland', 'wales', 'ni', 'ireland'],
            'supply_chain_node': ['supply chain', 'fulfillment', 'fulfilment', 'warehouse', '3pl', 'last-mile'],
            'marketing_channel': ['channel', 'wholesale', 'retailer', 'd2c', 'amazon'],
            'legal_entity': ['legal', 'contract', 'exclusivity', 'agreement'],
            'finance_entity': ['capex', 'breakeven', 'margin', 'cost', 'cogs', 'opex', 'budget'],
        }

        rel_keywords = {
            'has_data_product': ['has data product', 'data product'],
            'used_in': ['used in', 'used by process'],
            'used_by': ['used by', 'consumer'],
            'creates': ['creates', 'create'],
            'enables_execution': ['enables', 'enable', 'execution'],
            'interacts_with': ['interacts', 'interact'],
            'data_domain': ['data domain'],
            'measures': ['measures', 'kpi for', 'tracks'],
            'fulfils_region': ['fulfils', 'serves', 'covers'],
            'depends_on': ['depends on', 'requires', 'needs'],
            'phases_in_year': ['phase', 'year 1', 'year 2', 'year 3', 'roadmap'],
            'governs': ['governs', 'contract', 'exclusivity'],
        }

        relevant_types = []
        for entity_type, keywords in type_keywords.items():
            if any(kw in query_lower for kw in keywords):
                relevant_types.append(entity_type)

        relevant_rels = []
        for rel_type, keywords in rel_keywords.items():
            if any(kw in query_lower for kw in keywords):
                relevant_rels.append(rel_type)

        return {
            'entity_types': relevant_types,
            'relationship_types': relevant_rels,
            'keywords': [w for w in query_lower.split() if len(w) > 2],
        }

    def get_ego_entity_ids(self, focus_id: str, depth: int = 1) -> Set[str]:
        entity_ids = {focus_id}
        current = {focus_id}

        for _ in range(depth):
            next_level = set()
            for entity_id in current:
                for rel in graph_service.get_all_relationships():
                    if rel.sourceId == entity_id:
                        next_level.add(rel.targetId)
                    elif rel.targetId == entity_id:
                        next_level.add(rel.sourceId)
            current = next_level - entity_ids
            entity_ids.update(next_level)

        return entity_ids

    def get_relationship_label(self, rel: Relationship, focus_id: Optional[str] = None) -> str:
        if focus_id and rel.properties:
            perspectives = rel.properties.get('perspectives', {})
            perspective = perspectives.get(focus_id)
            if perspective and perspective.get('label'):
                return perspective['label']

        return rel.type.replace('_', ' ')

    def find_relevant_entities(
        self,
        query_interpretation: Dict[str, Any],
        focus_entity_id: Optional[str] = None,
    ) -> List[Entity]:
        all_entities = graph_service.get_all_entities()
        if not all_entities:
            return []

        if focus_entity_id:
            focus_entity = graph_service.get_entity(focus_entity_id)
            if focus_entity:
                ego_ids = self.get_ego_entity_ids(focus_entity_id, depth=1)
                ego_entities = [e for e in all_entities if e.id in ego_ids]
                if ego_entities:
                    return ego_entities[:self.max_entities]

        relevant = []
        for entity in all_entities:
            score = 0

            if entity.type in query_interpretation['entity_types']:
                score += 3

            entity_text = f"{entity.name} {entity.description or ''}".lower()
            for keyword in query_interpretation['keywords']:
                if keyword in entity_text:
                    score += 2
                elif keyword in entity.name.lower():
                    score += 3

            if score > 0:
                relevant.append((entity, score))

        if not relevant:
            return all_entities[:self.max_entities]

        relevant.sort(key=lambda x: x[1], reverse=True)
        return [e for e, _ in relevant[:self.max_entities]]

    def expand_context(self, seed_entities: List[Entity], depth: int = 1) -> Dict[str, Any]:
        entity_ids = {e.id for e in seed_entities}

        for entity in seed_entities[:5]:
            neighbors = graph_service.get_neighbors(entity.id, depth=depth)
            entity_ids.update(neighbors[:8])

        return graph_service.get_subgraph(list(entity_ids))

    def package_context(
        self,
        subgraph: Dict[str, Any],
        grounding_mode: str,
        focus_entity_id: Optional[str] = None,
        persona_lens: str = 'ceo',
    ) -> str:
        if grounding_mode == 'generic':
            return ""

        entities = subgraph.get('entities', [])
        relationships = subgraph.get('relationships', [])

        if not entities:
            return "No relevant information found in the knowledge graph."

        if persona_lens == 'ceo':
            entities = sorted(entities, key=lambda e: 0 if e.type in ('kpi', 'finance_entity') else 1)
        elif persona_lens == 'vp_supply_chain':
            entities = sorted(entities, key=lambda e: 0 if e.type == 'supply_chain_node' else 1)

        focus_entity = graph_service.get_entity(focus_entity_id) if focus_entity_id else None
        context_parts = ["# Knowledge Graph Context\n"]

        if focus_entity:
            category = CATEGORY_LABELS.get(focus_entity.type, focus_entity.type)
            context_parts.append(
                f"Current focus: **{focus_entity.name}** ({category})\n"
            )

        context_parts.append("## Entities:\n")
        for entity in entities:
            category = CATEGORY_LABELS.get(entity.type, entity.type.replace('_', ' '))
            desc = entity.description or "No description"
            if persona_lens == 'vp_supply_chain' and entity.type == 'supply_chain_node':
                status = (entity.metadata or {}).get('d2c_status', 'unknown')
                desc = f"{desc} [D2C Status: {status}]"
            context_parts.append(f"- **{entity.name}** [{category}]: {desc}")

            if grounding_mode == 'kg_full' and entity.metadata and 'tabular_data' in entity.metadata:
                table = entity.metadata['tabular_data']
                if isinstance(table, dict) and 'headers' in table and 'rows' in table:
                    headers = table['headers']
                    rows = table['rows']
                    if headers and rows:
                        context_parts.append("  Data Product Content:")
                        header_str = " | ".join(headers)
                        separator = " | ".join(["---"] * len(headers))
                        context_parts.append(f"  | {header_str} |")
                        context_parts.append(f"  | {separator} |")
                        for row in rows[:20]:
                            row_str = " | ".join(str(val) for val in row)
                            context_parts.append(f"  | {row_str} |")

        if relationships:
            context_parts.append("\n## Relationships:\n")
            entity_map = {e.id: e.name for e in entities}

            for rel in relationships:
                source_name = entity_map.get(rel.sourceId)
                target_name = entity_map.get(rel.targetId)
                if not source_name or not target_name:
                    continue

                label = self.get_relationship_label(rel, focus_entity_id)
                context_parts.append(f"- {source_name} **{label}** {target_name}")

        context_parts.append("\n## Instructions:")
        context_parts.append("- Answer using ONLY the knowledge graph information above")
        context_parts.append("- Reference specific entities and relationships when relevant")
        context_parts.append("- If the answer is not in the context, say so explicitly")

        return "\n".join(context_parts)

    def build_citations(self, subgraph: Dict[str, Any]) -> List[Dict[str, str]]:
        citations = []
        for entity in subgraph.get('entities', []):
            citations.append({
                'entityId': entity.id,
                'entityName': entity.name,
                'entityType': CATEGORY_LABELS.get(entity.type, entity.type),
            })
        return citations

    def assemble_context(
        self,
        query: str,
        grounding_mode: str,
        focus_entity_id: Optional[str] = None,
        persona_lens: str = 'ceo',
    ) -> Dict[str, Any]:
        interpretation = self.interpret_query(query)
        relevant_entities = self.find_relevant_entities(interpretation, focus_entity_id)
        depth = 3 if grounding_mode != 'generic' else 1
        subgraph = self.expand_context(relevant_entities, depth=depth)
        context_string = self.package_context(subgraph, grounding_mode, focus_entity_id, persona_lens=persona_lens)

        return {
            'context_string': context_string,
            'used_entities': [e.id for e in subgraph.get('entities', [])],
            'used_relationships': [r.id for r in subgraph.get('relationships', [])],
            'subgraph': subgraph,
            'citations': self.build_citations(subgraph),
            'persona_lens': persona_lens,
        }

context_service = ContextService()
