import axios from 'axios';
import { useState , useEffect } from 'react';
const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";
export const useFetchUser = () => {
    const [user , setUser] = useState(null);
    const [loading , setLoading] = useState(true);
    const [error , setError] = useState(null);

    useEffect(() => {
        const fetchUserProfile = async() => {
            try{
                const token = localStorage.getItem("token");
                const userId = localStorage.getItem("userId");

                const response = await axios.get(`${API_URL}/api/v1/users/${userId}`);

                const data = response.data;
                if(data.success) {
                    setUser(data.user);
                }
            } catch(error) {
                setError(error.message);
            } finally{
                setLoading(false);
            }
        }

        fetchUserProfile();
    }, []);

    return {user , loading , error};
}