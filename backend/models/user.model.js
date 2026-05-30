import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 5
    }
    ,
    preferences: {
        alerts: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false }
        }
    }
}, {timestamps: true});

const User = mongoose.model("User", userSchema);
export default User;