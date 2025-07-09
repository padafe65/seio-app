// frontend-rifa/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { setupResponseInterceptor } from './config/axios';
import { useNavigate } from 'react-router-dom';

// Configurar interceptor de Axios
const Root = () => {
  const navigate = useNavigate();
  
  // Configurar el interceptor de respuesta
  React.useEffect(() => {
    setupResponseInterceptor(navigate);
  }, [navigate]);
  
  return <App />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
