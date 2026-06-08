import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import Footer from '../../components/Footer/Footer.jsx';
import './Register.css';
import axios from 'axios';
const API_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000';

const Register = () => {
    const [formData, setFormData] = useState({
        name: "",
        city: "",
        email: "",
        password: ""
    });
    const navigate = useNavigate();
    const handleSubmit = async(e) => {
        e.preventDefault();
        try{
            const response = await axios.post(`${API_URL}/api/v1/auth/signup` , formData);
            if(response.data.success){
                alert("Registration successful! Redirecting you to login page...");
                navigate('/login');
            }
        } catch(error) {
            alert("Registration failed. Please try again.");
            console.error(error);
        }
    }
    return(
        <>
        <Header />
        <div className="register-container">
            <form className = "registration-form" onSubmit={handleSubmit}>
            <h2>Create your CityPulse account</h2>
            <label htmlFor="name" className="username-label">Username:</label>
            <input
                type="text"
                className="username-input"
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter your username" />

            <label htmlFor="city" className="city-label">City:</label>
            <input 
                type="text"
                className="city-input"
                id="city"
                name="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData , city: e.target.value})}
                placeholder="Enter the city you live in" />

            <label htmlFor="email" className="email-label">Email:</label>
            <input
                type="email"
                className="email-input"
                id="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Enter your email" />

            <label htmlFor="password" className="password-label">Password:</label>
            <input
                type="password"
                className="password-input"
                id="password"
                name="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter your password" />

            <button type="submit">Register</button>
            <span className="already-registered">Already have an account? <a href="/login">Login</a></span>
            </form>
        </div>
        </>
    )
}

export default Register;
