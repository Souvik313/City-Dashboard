import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import Header from '../../components/Header/Header.jsx';
import './Login.css';
import axios from 'axios';
const API_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000';

const Login = () => {
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const handleSubmit = async(e) => {
        e.preventDefault();
        try{
            const response = await axios.post(`${API_URL}/api/v1/auth/signin` , formData);
            if(response.data.success){
                // Save token and userId to localStorage
                localStorage.setItem("token", response.data.data.token);
                localStorage.setItem("userId", response.data.data.user._id);
                alert("Logged in successfully!");
                setError("");
                navigate("/");
            }
        } catch(error) {
            alert("Failed to login. Please try again");
            setError(error.message);
            console.error(error);
        } finally {
            setIsLoading(false);
        }   
    }

    return (
        <>
        <Header />
        <div className="login-container">
            <h2>Login to CityPulse</h2>
            <form className ="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email:</label>
            <input 
                type="text"
                id="email"
                className="email-input"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})} />

            <label htmlFor="password">Password:</label>
            <input 
                type="password"
                id="password"
                className="password-input"
                name="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})} />
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="login-btn" >{!isLoading ? "Login" : "Logging you in..."}</button>
            <span>
                New here? <span><Link to="/register">Register</Link></span>
            </span>
            </form>
        </div>
        </>
    )
}

export default Login;