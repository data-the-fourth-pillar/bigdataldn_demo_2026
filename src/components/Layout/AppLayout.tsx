import React, { type ReactNode, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PersonaSelector } from '../Controls/PersonaSelector';
import { ProviderSelector } from '../Controls/ProviderSelector';
import { PresenterKeyInput } from '../Controls/PresenterKeyInput';
import { GraphControlsPanel } from '../Graph/GraphControlsPanel';
import { ThemeToggle } from '../Controls/ThemeToggle';
import { ChatHistoryPanel } from '../Chat/ChatHistoryPanel';
import { GraphHeaderControls } from '../Graph/GraphHeaderControls';
import { GroundingModeSelector } from '../Chat/GroundingModeSelector';
import { graphApi } from '../../api/graphApi';
import { useGraphStore } from '../../store/graphStore';
import './AppLayout.css';


interface AppLayoutProps {
    children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    const location = useLocation();
    const isGraph = location.pathname === '/graph';
    const isChat = location.pathname === '/chat';
    const isHome = location.pathname === '/';

    const [settingsOpen, setSettingsOpen] = useState(false);
    // Desktop starts with the sidebar open, mobile starts closed — it otherwise
    // takes up the whole viewport on a phone. A one-time viewport check at mount
    // is enough; we don't need to live-resync on window resize for this.
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { setEntities, setRelationships, setFocusEntity, clearFilter, selectEntity } = useGraphStore();

    const handleReloadDemo = async () => {
        try {
            await graphApi.seedMdsD2c();
            const data = await graphApi.getGraphData();
            setEntities(data.entities);
            setRelationships(data.relationships);
            clearFilter();
            setFocusEntity(null);
        } catch {
            console.error('Demo reload failed');
        }
    };

    const handleExport = async () => {
        try {
            const data = await graphApi.exportGraph();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            alert('Export failed');
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                const result = await graphApi.importGraph(json);
                const data = await graphApi.getGraphData();
                setEntities(data.entities);
                setRelationships(data.relationships);
                clearFilter();
                selectEntity(null);
                const defaultDomain = data.entities.find(ent => ent.type === 'domain');
                setFocusEntity(defaultDomain?.id ?? null);
                alert(`Imported ${result.entities} entities, ${result.relationships} relationships`);
            } catch (error: any) {
                alert(`Import failed: ${error.response?.data?.detail || error.message}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleReset = async () => {
        if (!confirm('Clear the entire graph? This cannot be undone.')) return;
        try {
            await graphApi.resetGraph();
            setEntities([]);
            setRelationships([]);
            setFocusEntity(null);
        } catch {
            console.error('Reset failed');
        }
    };

    const navItems = [
        { path: '/', label: 'Home', icon: '🏠' },
        { path: '/graph', label: 'Graph', icon: '🕸️' },
        { path: '/chat', label: 'Chat', icon: '💬' },
    ];

    // On mobile the sidebar is an overlay drawer, so picking a destination should
    // close it — otherwise it keeps covering the page you just navigated to.
    // On desktop it pushes/reflows content instead, so it's fine to leave open.
    const handleNavClick = () => {
        if (window.innerWidth <= 768) setSidebarOpen(false);
    };

    return (
        <div className="app-layout">
            {sidebarOpen && (
                <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Fixed to the viewport, not inside <aside> — stays visible and clickable
                even when the sidebar body is collapsed/off-screen (the only way to
                reopen it), and the toggle sits after the logo text via normal flex
                flow rather than a guessed pixel position. */}
            <div className={`sidebar-header ${sidebarOpen ? 'sidebar-header-open' : 'sidebar-header-closed'}`}>
                <h1 className="logo">
                    <span className="logo-icon">MDS</span>
                    <span className="logo-text">Enterprise Context</span>
                </h1>
                <button
                    type="button"
                    className="sidebar-toggle-corner"
                    onClick={() => setSidebarOpen(o => !o)}
                    title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    ☰
                </button>
            </div>

            <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <nav className="nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={handleNavClick}
                        >
                            <span className={`nav-icon${item.path === '/graph' ? ' icon-graph' : ''}`}>{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {isGraph && <GraphControlsPanel />}
                {isChat && <ChatHistoryPanel />}

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
                            <span className="settings-section-label">Presenter Mode</span>
                            <PresenterKeyInput />
                            <button type="button" className="settings-reload-btn" onClick={handleReloadDemo}>
                                🌱 Reload Demo
                            </button>
                            {isGraph && (
                                <>
                                    <span className="settings-section-label">Graph Data</span>
                                    <button type="button" className="settings-action-btn" onClick={handleExport}>
                                        📤 Export Graph
                                    </button>
                                    <button type="button" className="settings-action-btn" onClick={handleImportClick}>
                                        📥 Import Graph
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        accept=".json"
                                        onChange={handleFileChange}
                                    />
                                    <button type="button" className="settings-action-btn settings-action-danger" onClick={handleReset}>
                                        🗑️ Reset Graph
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* When the sidebar is closed, .sidebar-header still persists as a small
                fixed corner chip (see above) — main content needs to clear it here
                explicitly, since a collapsed <aside> stops reserving that space via
                normal flex layout (and on mobile it never reserved any space at all,
                being position: fixed). When open, the sidebar/chip are the same
                width, so flex layout already accounts for it and no offset is needed. */}
            <div className={`main-wrapper ${sidebarOpen ? '' : 'main-wrapper-offset'}`}>
                <header className="app-top-header">
                    <div className="header-left">
                        {isGraph && <GraphHeaderControls />}
                        {isChat && <PersonaSelector />}
                    </div>
                    <div className="header-right">
                        {isChat && <GroundingModeSelector />}
                        {isHome && (
                            <a
                                href="https://datathefourthpillar.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="book-link"
                            >
                                📖 Data As The Fourth Pillar
                            </a>
                        )}
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
