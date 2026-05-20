import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Protected from "./Protected";
import MapScreen from "./Map/map";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route
          path="/Dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route path="/Map" element={<Protected><MapScreen/></Protected>} />
      </Routes>
    </BrowserRouter>
  );
}
