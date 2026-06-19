import type { GraphData } from '../types/graph';

const now = new Date().toISOString();

export const DEMO_DOMAIN_ID = 'demo-domain-order-mgmt';
export const DEMO_DATA_PRODUCT_ID = 'demo-dp-orders';
export const DEMO_PROCESS_ID = 'demo-process-ltc';
export const DEMO_CPQ_ID = 'demo-tech-cpq';
export const DEMO_FINANCE_ID = 'demo-person-finance';
export const DEMO_AGENT_ID = 'demo-person-agent';

export const DEMO_GRAPH: GraphData = {
    entities: [
        {
            id: DEMO_DOMAIN_ID,
            name: 'Order Management',
            type: 'domain',
            description: 'Data domain covering order lifecycle and fulfillment',
            metadata: {},
            createdAt: now,
            updatedAt: now,
        },
        {
            id: DEMO_DATA_PRODUCT_ID,
            name: 'Orders',
            type: 'data_product',
            description: 'Customer order transactions and status',
            metadata: {},
            createdAt: now,
            updatedAt: now,
        },
        {
            id: DEMO_PROCESS_ID,
            name: 'Lead to Cash Process',
            type: 'process',
            description: 'End-to-end sales and revenue process',
            metadata: {},
            createdAt: now,
            updatedAt: now,
        },
        {
            id: DEMO_FINANCE_ID,
            name: 'Finance Team',
            type: 'person',
            description: 'Finance operations and reporting',
            metadata: {},
            createdAt: now,
            updatedAt: now,
        },
        {
            id: DEMO_CPQ_ID,
            name: 'CPQ',
            type: 'technology',
            description: 'Configure, price, and quote platform',
            metadata: {},
            createdAt: now,
            updatedAt: now,
        },
        {
            id: DEMO_AGENT_ID,
            name: 'Customer Support AI Agent',
            type: 'ai_agent',
            description: 'AI Agent supporting customer inquiries',
            metadata: {},
            createdAt: now,
            updatedAt: now,
        },
    ],
    relationships: [
        {
            id: 'demo-rel-domain-orders',
            sourceId: DEMO_DOMAIN_ID,
            targetId: DEMO_DATA_PRODUCT_ID,
            type: 'has_data_product',
            properties: {
                perspectives: {
                    [DEMO_DOMAIN_ID]: { label: 'has data product', direction: 'out' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-orders-process',
            sourceId: DEMO_DATA_PRODUCT_ID,
            targetId: DEMO_PROCESS_ID,
            type: 'used_in',
            properties: {
                perspectives: {
                    [DEMO_DATA_PRODUCT_ID]: { label: 'used in', direction: 'out' },
                    [DEMO_PROCESS_ID]: { label: 'creates', direction: 'out' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-orders-cpq',
            sourceId: DEMO_DATA_PRODUCT_ID,
            targetId: DEMO_CPQ_ID,
            type: 'used_in',
            properties: {
                perspectives: {
                    [DEMO_DATA_PRODUCT_ID]: { label: 'used in', direction: 'out' },
                    [DEMO_CPQ_ID]: { label: 'used in', direction: 'in' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-cpq-process',
            sourceId: DEMO_CPQ_ID,
            targetId: DEMO_PROCESS_ID,
            type: 'enables_execution',
            properties: {
                perspectives: {
                    [DEMO_PROCESS_ID]: { label: 'enables execution', direction: 'in' },
                    [DEMO_CPQ_ID]: { label: 'enables execution', direction: 'out' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-orders-finance',
            sourceId: DEMO_DATA_PRODUCT_ID,
            targetId: DEMO_FINANCE_ID,
            type: 'used_by',
            properties: {
                perspectives: {
                    [DEMO_DATA_PRODUCT_ID]: { label: 'used by', direction: 'out' },
                    [DEMO_FINANCE_ID]: { label: 'used by', direction: 'in' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-process-finance',
            sourceId: DEMO_PROCESS_ID,
            targetId: DEMO_FINANCE_ID,
            type: 'used_by',
            properties: {
                perspectives: {
                    [DEMO_PROCESS_ID]: { label: 'used by', direction: 'out' },
                    [DEMO_FINANCE_ID]: { label: 'used by', direction: 'in' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-orders-agent',
            sourceId: DEMO_DATA_PRODUCT_ID,
            targetId: DEMO_AGENT_ID,
            type: 'data_domain',
            properties: {
                perspectives: {
                    [DEMO_DATA_PRODUCT_ID]: { label: 'data domain', direction: 'out' },
                    [DEMO_AGENT_ID]: { label: 'data domain', direction: 'in' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-process-agent',
            sourceId: DEMO_PROCESS_ID,
            targetId: DEMO_AGENT_ID,
            type: 'interacts_with',
            properties: {
                perspectives: {
                    [DEMO_PROCESS_ID]: { label: 'interacts with', direction: 'out' },
                    [DEMO_AGENT_ID]: { label: 'interacts with', direction: 'in' },
                },
            },
            createdAt: now,
        },
        {
            id: 'demo-rel-agent-cpq',
            sourceId: DEMO_AGENT_ID,
            targetId: DEMO_CPQ_ID,
            type: 'interacts_with',
            properties: {
                perspectives: {
                    [DEMO_AGENT_ID]: { label: 'interacts with', direction: 'out' },
                    [DEMO_CPQ_ID]: { label: 'interacts with', direction: 'in' },
                },
            },
            createdAt: now,
        },
    ],
};
