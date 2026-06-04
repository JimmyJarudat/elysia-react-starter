import React from 'react';
import { Outlet } from 'react-router-dom';
import SystemDocumentTitle from '@/common/SystemDocumentTitle';

const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen ">
      <SystemDocumentTitle />
      <Outlet />
    </div>
  );
};

export default PublicLayout;
