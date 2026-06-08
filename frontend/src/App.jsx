import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home/Home.jsx';
import Contact from './pages/Contact/Contact.jsx';
import About from './pages/About/About.jsx';
import Register from './pages/Register/Register.jsx';
import Login from './pages/Login/Login.jsx';
import { UserProfile } from './pages/Profile/Profile.jsx';
import UpdateProfile from './pages/UpdateProfile/UpdateProfile.jsx';
import GetStarted from './pages/Get-started/GetStarted.jsx';
import Dashboard from './pages/Dahboard/Dashboard.jsx';
import './App.css'

function App() {

  return (
    <>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path = "/users/:id" element={<UserProfile />} />
        <Route path='/users/:id/update' element={<UpdateProfile />} />
        <Route path='/get-started' element={<GetStarted />} />
        <Route path='/dashboard' element={<Dashboard />} />
      </Routes>
    </>
  )
}

export default App;
