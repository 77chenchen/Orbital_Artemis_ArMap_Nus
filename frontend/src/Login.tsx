import React from "react";
import { useState } from "react";
import styles from "./auth.module.css";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "./api";

export default function Login({toRegister}: {toRegister: () => void}) {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loginFailed, setLoginFailed] = useState<boolean>(false);
    const navigate = useNavigate();

    const onSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
            email,
            password,
            }),
        })

        if (!res.ok) {
            toast.error("Login Failed. Try again.", {style: {width: "500px"}});
            setLoginFailed(true);
            return;
        }
        const data = await res.json();
        localStorage.setItem("token", data.token);
        navigate("/Dashboard");
    }
    
    return (
        <form className={styles.form} onSubmit={onSubmit}>
        
            <h1>Login</h1>

            <input className={styles.textbox}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
            />

            <input className={styles.textbox}
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />

            {loginFailed &&
                <small style={{color: "red"}}>Login Failed. Please try again.</small>
            }
            <small 
             onClick={toRegister}
             style={{ cursor: "pointer", color: "blue" }}
            >
                New User? Register now.
            </small>
            <button type="submit" className={styles.button}>Login</button>
        </form>
    )
}
