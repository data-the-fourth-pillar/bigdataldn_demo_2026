import axios from 'axios';
import type { Entity, Relationship, GraphData } from '../types/graph';

// Detect if we are running in a browser environment and what the base URL should be
const getBaseUrl = () => {
    // 1. Explicit environment variable takes precedence
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '');
    }

    // 2. If we are in the browser, check if we are on Vercel or other production host
    if (typeof window !== 'undefined') {
        const { hostname, protocol, port } = window.location;

        // If not localhost, we should likely use the current origin
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
        }
    }

    // 3. Fallback to default local development port
    return 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add logging for debugging
api.interceptors.request.use(config => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data);
    return config;
});

api.interceptors.response.use(
    response => {
        console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
        return response;
    },
    error => {
        console.error(`API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export const graphApi = {
    // Entities
    async getEntities(): Promise<Entity[]> {
        const response = await api.get('/api/entities');
        return response.data;
    },

    async createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
        const response = await api.post('/api/entities', entity);
        return response.data;
    },

    async updateEntity(id: string, updates: Partial<Entity>): Promise<Entity> {
        const response = await api.put(`/api/entities/${id}`, updates);
        return response.data;
    },

    async deleteEntity(id: string): Promise<void> {
        await api.delete(`/api/entities/${id}`);
    },

    // Relationships
    async getRelationships(): Promise<Relationship[]> {
        const response = await api.get('/api/relationships');
        return response.data;
    },

    async createRelationship(relationship: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship> {
        const response = await api.post('/api/relationships', relationship);
        return response.data;
    },

    async deleteRelationship(id: string): Promise<void> {
        await api.delete(`/api/relationships/${id}`);
    },

    // Graph data
    async getGraphData(): Promise<GraphData> {
        const [entities, relationships] = await Promise.all([
            this.getEntities(),
            this.getRelationships(),
        ]);
        return { entities, relationships };
    },

    async exportGraph(): Promise<GraphData> {
        const response = await api.get('/api/graph/export');
        return response.data;
    },

    async importGraph(data: GraphData): Promise<any> {
        const response = await api.post('/api/graph/import', data);
        return response.data;
    },

    async resetGraph(): Promise<any> {
        const response = await api.post('/api/graph/reset');
        return response.data;
    },

    async seedCustomerAgent(): Promise<any> {
        const response = await api.post('/api/graph/seed/customer');
        return response.data;
    },

    async seedDemo(): Promise<any> {
        const response = await api.post('/api/graph/seed/demo');
        return response.data;
    },
};
