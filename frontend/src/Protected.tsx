import React from "react";
import { ReactElement } from "react";
import { Navigate } from "react-router-dom";
// this function below wraps any route to prevent unauthorized access into pages 
// such as Dashboard which requires Login first

export default function Protected({children} : {children: ReactElement}) {
     const token = localStorage.getItem("token");

    if (!token) {
        return <Navigate to="/" replace />;
    }

    return children;
}