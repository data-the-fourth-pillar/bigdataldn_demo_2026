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
    'finance_entity': 'Cost & Budget',
    'policy': 'Policy',
}

class ContextService:
    """
    Service for assembling graph context for LLM queries
    """

    def __init__(self):
        self.max_depth = 2

    def interpret_query(self, query: str) -> Dict[str, Any]:
        query_lower = query.lower()

        type_keywords = {
            'domain': ['domain', 'data domain', 'ownership', 'stewardship'],
            'data_product': ['data product', 'orders', 'order data', 'dataset', 'catalogue', 'insights', 'sales revenue', 'supply chain data'],
            'process': ['process', 'workflow', 'lead to cash', 'ltc', 'fulfilment', 'fulfillment', 'acquisition', 'forecasting', 'conflict management'],
            'person': ['people', 'person', 'team', 'manager', 'lead', 'planner', 'owner', 'who manages', 'who owns', 'who is responsible'],
            'technology': ['technology', 'system', 'platform', 'cpq', 'crm', 'cdp', 'ecommerce', 'inventory', 'analytics platform', 'tool'],
            'ai_agent': ['ai agent', 'agent', 'support agent', 'bot'],
            'kpi': ['kpi', 'eav', 'tav', 'rv', 'revenue', 'addressable', 'conversion', 'return rate'],
            'product_category': ['product', 'category', 'nutrition', 'beauty', 'vitamin', 'pet', 'apparel', 'sports nutrition', 'personal care'],
            'region': ['region', 'uk', 'london', 'southeast', 'midlands', 'north', 'scotland', 'wales', 'ni', 'ireland', 'where is launched', 'geography'],
            'supply_chain_node': ['supply chain', 'warehouse', '3pl', 'last-mile', 'dc', 'distribution centre', 'lutterworth'],
            'marketing_channel': ['channel', 'wholesale', 'retailer', 'd2c', 'amazon', 'direct to consumer', 'trade', 'go-to-market'],
            'legal_entity': ['legal', 'contract', 'exclusivity', 'agreement', 'msa', 'terms'],
            'finance_entity': ['capex', 'breakeven', 'margin', 'cost', 'cogs', 'opex', 'budget', 'investment'],
            'policy': ['policy', 'policies', 'compliance', 'gdpr', 'consent', 'map', 'minimum advertised', 'code of conduct', 'exclusivity', 'pricing rule'],
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
            'rollout_in': ['phase', 'year 1', 'year 2', 'year 3', 'roadmap', 'rollout'],
            'governs': ['governs', 'contract', 'exclusivity'],
            'launched_in': ['launched in', 'available in', 'live in', 'launch region'],
            'sold_via': ['sold via', 'sold through', 'channel for', 'available on'],
            'managed_by': ['managed by', 'owned by', 'responsible for', 'who manages'],
            'enabled_by': ['enabled by', 'supported by', 'backed by process'],
            'powered_by': ['powered by', 'uses technology', 'runs on'],
            'generates': ['generates', 'produces data', 'feeds into'],
            'uses_domain': ['uses domain', 'data domain for', 'governed by domain'],
            'applies_to': ['applies to', 'covers', 'in scope', 'subject to'],
            'enforced_by': ['enforced by', 'enforces', 'responsible for policy', 'owns policy'],
            'has_owner': ['has owner', 'domain owner', 'data steward', 'who owns domain'],
            'has_process': ['has process', 'domain process', 'process within domain'],
            'has_technology': ['has technology', 'domain technology', 'systems in domain'],
            'manages': ['manages', 'is responsible for', 'who manages', 'who runs'],
            'supports': ['supports', 'feeds into', 'informs', 'backs'],
            'consumed_by': ['consumed by', 'used by system', 'ingested by'],
            'employed_by': ['employed by', 'works for', 'reports to', 'employee of', 'who employs'],
            'operates_in': ['operates in', 'runs in', 'process within', 'which entity runs', 'legal entity for process'],
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

        matched_types = set(query_interpretation['entity_types'])

        # Always include every entity of explicitly matched types — focus entity must not
        # restrict this, otherwise "give me all KPIs" while focused on one product category
        # would miss KPIs that aren't in that ego network.
        type_matched = [e for e in all_entities if e.type in matched_types] if matched_types else []
        type_matched_ids = {e.id for e in type_matched}

        # Collect context filler: ego network of focus entity (excluding already-matched)
        filler: List[Entity] = []
        if focus_entity_id:
            focus_entity = graph_service.get_entity(focus_entity_id)
            if focus_entity:
                ego_ids = self.get_ego_entity_ids(focus_entity_id, depth=1)
                filler = [e for e in all_entities if e.id in ego_ids and e.id not in type_matched_ids]

        # If no type match and no focus, fall back to keyword scoring
        if not type_matched and not filler:
            relevant = []
            for entity in all_entities:
                score = 0
                entity_text = f"{entity.name} {entity.description or ''}".lower()
                for keyword in query_interpretation['keywords']:
                    if keyword in entity_text:
                        score += 2
                if score > 0:
                    relevant.append((entity, score))

            if not relevant:
                return all_entities

            relevant.sort(key=lambda x: x[1], reverse=True)
            return [e for e, _ in relevant]

        return type_matched + filler

    def expand_context(self, seed_entities: List[Entity], depth: int = 1) -> Dict[str, Any]:
        entity_ids = {e.id for e in seed_entities}

        for entity in seed_entities:
            neighbors = graph_service.get_neighbors(entity.id, depth=depth)
            entity_ids.update(neighbors)

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
            return "No relevant information found in the enterprise context."

        if persona_lens == 'ceo':
            entities = sorted(entities, key=lambda e: 0 if e.type in ('kpi', 'finance_entity') else 1)
        elif persona_lens == 'vp_supply_chain':
            entities = sorted(entities, key=lambda e: 0 if e.type == 'supply_chain_node' else 1)
        elif persona_lens == 'cdo':
            entities = sorted(entities, key=lambda e: 0 if e.type in ('domain', 'data_product') else 1)

        focus_entity = graph_service.get_entity(focus_entity_id) if focus_entity_id else None
        context_parts = ["# Enterprise Context\n"]

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

            value_str = ''
            if entity.type == 'kpi' and entity.metadata:
                v = entity.metadata.get('value')
                u = entity.metadata.get('unit', '')
                if v is not None:
                    value_str = f' — {v}%' if u == 'PCT' else f' — £{v:,.0f}'
            elif entity.type == 'finance_entity' and entity.metadata:
                v = entity.metadata.get('value')
                c = entity.metadata.get('currency', '')
                if v is not None:
                    if c == 'PCT':
                        value_str = f' — {v}%'
                    elif c == 'MONTHS':
                        value_str = f' — {v} months'
                    else:
                        value_str = f' — £{v:,.0f}'

            context_parts.append(f"- **{entity.name}** [{category}]: {desc}{value_str}")

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
        context_parts.append("- Answer using ONLY the enterprise context information above")
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
