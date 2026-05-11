import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from "./Dashboard";
import Auth from './Auth';
import Protected from './Protected';
import styles from './auth.module.css';
import { ToastContainer } from 'react-toastify';

export default function App() {
    // Different browser routes
    return (
        <BrowserRouter>
          <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            theme="dark"
          />
          <Routes>
            <Route path = "/"          element = {<Auth />}/> 
            <Route path = "/Dashboard" element = {<Protected><Dashboard /></Protected>}/>
          </Routes>
        </BrowserRouter>
    )
}