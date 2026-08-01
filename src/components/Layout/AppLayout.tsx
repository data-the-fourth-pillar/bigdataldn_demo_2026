import React, { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PersonaSelector } from '../Controls/PersonaSelector';
import './AppLayout.css';

interface AppLayoutProps {
    children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Graph', icon: '🕸️' },
        { path: '/chat', label: 'Chat', icon: '💬' },
    ];

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="logo">
                        <span className="logo-icon">🧠</span>
                        <span className="logo-text">KnowledgeGraph</span>
                    </h1>
                </div>

                <nav className="nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="workspace-info">
                        <div className="workspace-name">Enterprise Workspace</div>
                        <div className="workspace-meta">Default</div>
                    </div>
                </div>
            </aside>

            <div className="main-wrapper">
                <header className="app-top-header">
                    <PersonaSelector />
                </header>

                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};
