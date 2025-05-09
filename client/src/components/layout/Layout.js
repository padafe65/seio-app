// components/layout/Layout.js
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { useAuth } from '../../context/AuthContext';

const Layout = () => {
  const { user } = useAuth();
  
  return (
    <div className="d-flex">
      <Sidebar />
      
      <div className="content-area" style={{ marginLeft: '250px', width: 'calc(100% - 250px)', minHeight: '100vh' }}>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
