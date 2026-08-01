import React from 'react';
import { useGraphStore } from '../../store/graphStore';
import './DataUsedPanel.css';

interface DataUsedPanelProps {
    entityIds: string[];
}

export const DataUsedPanel: React.FC<DataUsedPanelProps> = ({ entityIds }) => {
    const { entities } = useGraphStore();

    const dataEntities = entities.filter(
        e => entityIds.includes(e.id) && e.metadata?.tabular_data
    );

    if (!dataEntities.length) return null;

    return (
        <details className="data-used-details">
            <summary>📊 Data Used</summary>
            <div className="data-used-body">
                {dataEntities.map(entity => {
                    const table = entity.metadata!.tabular_data as {
                        headers: string[];
                        rows: (string | number)[][];
                    };
                    return (
                        <div key={entity.id} className="data-used-table-block">
                            <div className="data-used-entity-name">{entity.name}</div>
                            <div className="data-used-table-scroll">
                                <table className="data-used-table">
                                    <thead>
                                        <tr>
                                            {table.headers.map(h => (
                                                <th key={h}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {table.rows.map((row, i) => (
                                            <tr key={i}>
                                                {row.map((cell, j) => (
                                                    <td key={j}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        </details>
    );
};
