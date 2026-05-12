import React from "react";
import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import styles from "./auth.module.css";

export default function Auth() {
    const [isRegister, setIsRegister] = useState<boolean>(false);
    
    return (
        <div className={styles.container}>
          <title>ArMap Atlas Demo</title>

          <div className={styles.window}>
            <div className={styles.slider}
            style={{transform: isRegister ? "translateX(-50%)" : "translateX(0%)"}}>

                <div className={styles.page}>
                  <Login toRegister={() => setIsRegister(true)}/>
                </div>
                <div className={styles.page}>
                  <Register toLogin={() => setIsRegister(false)}/>
                </div>
                
            </div>
          </div>

        </div>
        
    )
}

