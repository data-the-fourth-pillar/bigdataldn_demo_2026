import type { EntityType } from '../types/graph';

export interface CategoryConfig {
    id: EntityType;
    label: string;
    icon: string;
    color: string;
}

export const DEMO_CATEGORIES: CategoryConfig[] = [
    { id: 'domain', label: 'Domain', icon: '🌐', color: '#3b82f6' },
    { id: 'data_product', label: 'Data Product', icon: '📊', color: '#10b981' },
    { id: 'process', label: 'Process', icon: '🔁', color: '#8b5cf6' },
    { id: 'person', label: 'People', icon: '👤', color: '#06b6d4' },
    { id: 'technology', label: 'Technology', icon: '⚙️', color: '#f59e0b' },
    { id: 'ai_agent', label: 'AI Agent', icon: '🤖', color: '#ec4899' },
    { id: 'product_category', label: 'Product Category', icon: '📦', color: '#0ea5e9' },
    { id: 'region', label: 'UK Region', icon: '🗺️', color: '#14b8a6' },
    { id: 'supply_chain_node', label: 'Supply Chain Node', icon: '🏭', color: '#f97316' },
    { id: 'marketing_channel', label: 'Marketing Channel', icon: '📢', color: '#a855f7' },
    { id: 'kpi', label: 'KPI', icon: '💰', color: '#22c55e' },
    { id: 'legal_entity', label: 'Legal Entity', icon: '⚖️', color: '#ef4444' },
    { id: 'finance_entity', label: 'Cost & Budget', icon: '💹', color: '#eab308' },
    { id: 'policy', label: 'Policy', icon: '📋', color: '#dc2626' },
];

export const DEMO_ENTITY_TYPES = DEMO_CATEGORIES.map(c => c.id);

export const OPERATING_PILLAR_TYPES: EntityType[] = ['person', 'process', 'technology', 'data_product'];

export const DEMO_RELATIONSHIP_TYPES = [
    'has_data_product',
    'used_in',
    'used_by',
    'creates',
    'enables_execution',
    'interacts_with',
    'data_domain',
    'depends_on',
    'uses',
    'measures',
    'fulfils_region',
    'serves_category',
    'competes_with',
    'governs',
    'funds',
    'rollout_in',
    'launched_in',
    'sold_via',
    'managed_by',
    'enabled_by',
    'powered_by',
    'generates',
    'uses_domain',
    'applies_to',
    'enforced_by',
    'employed_by',
    'operates_in',
    'has_owner',
    'has_process',
    'has_technology',
    'manages',
    'supports',
    'consumed_by',
] as const;

export function getCategoryConfig(type: EntityType): CategoryConfig | undefined {
    if (type === 'metadata_technical') {
        return DEMO_CATEGORIES.find(c => c.id === 'technology');
    }
    return DEMO_CATEGORIES.find(c => c.id === type);
}

export function isDemoEntityType(type: EntityType): boolean {
    return DEMO_ENTITY_TYPES.includes(type) || type === 'metadata_technical';
}
