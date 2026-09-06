import React, { useMemo } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { getCitedEntityIds } from '../../utils/citedEntities';
import './DataUsedPanel.css';

interface DataUsedPanelProps {
    entityIds: string[];
    answerText: string;
}

export const DataUsedPanel: React.FC<DataUsedPanelProps> = ({ entityIds, answerText }) => {
    const { entities } = useGraphStore();

    // Same cited-vs-retrieved narrowing as ContextGraphPanel — otherwise this
    // panel dumps every data product table that happened to be sent as context
    // (e.g. via an unrelated person seed's manages/consumed_by links) rather than
    // just the one the answer actually drew on.
    const { citedIds, isFiltered } = useMemo(
        () => getCitedEntityIds(entityIds, answerText, entities),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [entityIds.join(','), answerText, entities]
    );

    const dataEntities = entities.filter(
        e => citedIds.includes(e.id) && e.metadata?.tabular_data
    );

    if (!dataEntities.length) return null;

    return (
        <details className="data-used-details">
            <summary>📊 Data {isFiltered ? 'Cited' : 'Used'}</summary>
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
