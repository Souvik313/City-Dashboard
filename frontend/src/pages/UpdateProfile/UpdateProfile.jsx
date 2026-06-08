import { useState , useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFetchUser } from "../../hooks/useFetchUser.js";
import axios from "axios";
import './UpdateProfile.css';
import Header from "../../components/Header/Header.jsx";
const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

const UpdateProfile = () => {
    const navigate = useNavigate();
    const {user , error , loading} = useFetchUser();
    const [formData , setFormData] = useState({
        name: "",
        city: "",
        email: "",
        password: ""
    })

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || "",
                city: user.city?.name || "",
                email: user.email || "",
                password: ""
            });
        }
    }, [user]);

    const handleSubmit = async(e) => {
        e.preventDefault();
        try{
            await axios.post(`${API_URL}/api/v1/city/` , {city : formData.city});
            const response = await axios.patch(`${API_URL}/api/v1/users/${user._id}` , formData);
            if(response.data.success){
                alert("User data updated successfully!");
                navigate(`/users/${user._id}`);
            }
        } catch(error) {
            alert("Failed to update user data. Please try again.");
            console.error(error);
        }
    }
    const handleCancel = () => {
        navigate(`/users/${localStorage.getItem("userId")}`);
    }

    if(loading) return <div>Loading...</div>
    if(error) return <div>Error: {error}</div>

    return(
        <>
        <Header />
        <div className="update-profile-container">
            <h2 className="update-heading">Update Details</h2>
            <form action="" className="update-form" onSubmit={handleSubmit}>
                <label htmlFor="name">Name:</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                <label htmlFor="city">City:</label>
                <input type="text" id="city" name="city" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                <label htmlFor="email">Email:</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                <label htmlFor="password">Password:</label>
                <input type="password" id="password" name="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                <button type="submit">Update</button>
                <button type="button" onClick={handleCancel}>Cancel</button>
            </form>
        </div>
        </>
    )
}

export default UpdateProfile;