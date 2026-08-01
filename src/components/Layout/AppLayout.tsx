import React, { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PersonaSelector } from '../Controls/PersonaSelector';
import { ProviderSelector } from '../Controls/ProviderSelector';
import { GraphControlsPanel } from '../Graph/GraphControlsPanel';
import { GraphActions } from '../Graph/GraphActions';
import { ThemeToggle } from '../Controls/ThemeToggle';
import { ChatHistoryPanel } from '../Chat/ChatHistoryPanel';
import './AppLayout.css';


interface AppLayoutProps {
    children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    const location = useLocation();
    const [settingsOpen, setSettingsOpen] = useState(false);

    const navItems = [
        { path: '/', label: 'Graph', icon: '🕸️' },
        { path: '/chat', label: 'Chat', icon: '💬' },
    ];

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="logo">
                        <span className="logo-icon">MDS</span>
                        <span className="logo-text">Enterprise Context</span>
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

                {location.pathname === '/' && <GraphControlsPanel />}
                {location.pathname === '/chat' && <ChatHistoryPanel />}

                <div className="sidebar-footer">
                    <div className="workspace-info">
                        <div className="workspace-name">Enterprise Workspace</div>
                        <div className="workspace-meta">Default</div>
                    </div>
                    <button
                        type="button"
                        className="settings-toggle"
                        onClick={() => setSettingsOpen(o => !o)}
                    >
                        ⚙ Settings
                    </button>
                    {settingsOpen && (
                        <div className="settings-panel">
                            <ProviderSelector />
                        </div>
                    )}
                </div>
            </aside>

            <div className="main-wrapper">
                <header className="app-top-header">
                    <PersonaSelector />
                    <div className="header-right">
                        {location.pathname === '/' && <GraphActions />}
                        <ThemeToggle />
                    </div>
                </header>

                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};
