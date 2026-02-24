import React from 'react';

const SubscriptionExpired = () => {
  return (
    <div className="container text-center mt-5">
      <h2>Tu suscripción ha vencido</h2>
      <p>Debes renovar tu plan para continuar usando SEIO.</p>
      <button className="btn btn-primary">
        Renovar ahora
      </button>
    </div>
  );
};

export default SubscriptionExpired;