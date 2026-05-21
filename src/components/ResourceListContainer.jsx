import React from 'react';
import ResourceListItem from './ResourceListItem';
import '../styles/ResourceList.css';

export default function ResourceListContainer({ resources, loading, onSelectResource }) {
  if (loading) {
    return <div className="resource-list__message">Loading nearby resources...</div>;
  }
  
  if (!resources || resources.length === 0) {
    return <div className="resource-list__message">No resources found matching your criteria.</div>;
  }

  return (
    <div className="resource-list">
      {resources.map((r, i) => (
        <ResourceListItem key={i} resource={r} onSelectResource={() => onSelectResource?.(r)} />
      ))}
    </div>
  );
}
