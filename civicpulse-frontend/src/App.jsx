import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import CityMap from './pages/CityMap';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/officer-dashboard" element={<OfficerDashboard />} />
          <Route path="/map" element={<CityMap />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
