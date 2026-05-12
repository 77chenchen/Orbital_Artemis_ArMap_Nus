import React, { useState } from "react";
import styles from "./auth.module.css";
import { toast } from "react-toastify";

export default function Register({toLogin} : {toLogin: () => void}) {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const onSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const res = await fetch("http://localhost:8080/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
            email,
            password,
            }),
        });

        if (!res.ok) {
            toast.error("Registration Failed. User email may have already existed or invalid credentials.",
                {style: {width: "500px"}},
            );
            return;
        }

        toast.success("Registration successful. Please try loggin in.", {style: {width: "500px"}});
        setEmail("");
        setPassword("");
        toLogin();
    }

    return (
        <form className={styles.form} onSubmit={onSubmit}>

            <h1>Register</h1>

            <input
                className={styles.textbox}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
            />

            <input
                className={styles.textbox}
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />

            <small
                onClick={toLogin}
                style={{ cursor: "pointer", color: "blue" }}
            >
                Already have account? Login
            </small>

            <button className={styles.button} type="submit">Register</button>

        </form>
    );
}