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
];

export const DEMO_ENTITY_TYPES = DEMO_CATEGORIES.map(c => c.id);

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
