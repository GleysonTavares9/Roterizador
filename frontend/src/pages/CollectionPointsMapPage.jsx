import React from 'react';
import { Card } from 'react-bootstrap';
import PageLayout from '../components/PageLayout';
import CollectionPointsMap from '../components/CollectionPointsMap';

const CollectionPointsMapPage = () => {
  return (
    <PageLayout>
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">Mapa de Pontos de Coleta</h4>
        </div>
        <p className="text-muted">Visualize todos os pontos de coleta ativos no mapa.</p>
      </div>
      
      <Card className="mb-4 flex-grow-1 d-flex flex-column" style={{ minHeight: '70vh' }}>
        <Card.Body className="p-0 d-flex flex-column" style={{ flex: 1 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <CollectionPointsMap />
          </div>
        </Card.Body>
      </Card>
    </PageLayout>
  );
};

export default CollectionPointsMapPage;
