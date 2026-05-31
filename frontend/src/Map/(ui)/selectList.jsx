import React, { useEffect } from "react";
import { useState } from "react";
import getSuggestions from "../geocoding";
import "./ui.css";

export default function SelectList({ items, onClick }) {
    const data = ["apple", "orange", "banana"];
    
    return (
        <div className="menu-container">
            {items.map((r, i) => <Menu key={i} item={r} onClick={() => onClick(r)}/>)}
        </div>
    );
}

function Menu({ item, onClick }) {
  return (
    <li className="menu-item" onClick={onClick}>
      <span className="menu-text">{item.properties.label}</span>
    </li>
  );
}