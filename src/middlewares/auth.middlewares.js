import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler(async(req, res, next) => {    
    // const t = Boolean(req.cookies);
    // console.log(t); // This will log true or false based on whether req.cookies exists and is truthy
    

    try {
        
        const token=  req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        // console.log("Token: ", token); 
        
        if(!token){
            throw new ApiError(401, "Unauthorised request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            // Todo discuss about frontend
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})