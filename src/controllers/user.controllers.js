import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js" ;
import {uploadOnCloudinary} from "../utils/cloudinary.js" ;
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user is already exist: username, email
    // check for images, check for avtar
    // uplod them to cloudinary, avtar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response

    // if data is coming from any form or josn then it will appear in the req.body
    const {username, fullName, email, password } = req.body
    console.log( "email: ", email) ;

    // Validation
    if(
        [fullName, username,email, password].some((field)=> field?.trim === "")
    ){
        throw new ApiError(400, "All fields are required");
    }

    // Method 1 to throw error, here we have to apply a lot of if conditions
    // if(fullname === ""){
    //     throw new ApiError(400, "fullname is required")
    // }


    // if already exist
    const existedUse = User.findOne({
        $or: [{ username },{ email }]
    })
    
    if(existedUser){
        throw new ApiError(409, "User with email or username already exist")
    }

    // 
    const avatarLocalPath = req.files?.avatar[0]?.path ;
    const coverImageLocalPath = req.files?.coverImage[0]?.path ;
    path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }


    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })
    // to check if user is empty()
    const isUserCreated = await User.findById(user._id).select( "-password -refreshToken")  // if we find user by this, this means the user is created, otherwise not

    // check user creation
    if(!isUserCreated){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return response
    return res.status(201).json(
        new ApiResponse(200, isUserCreated, "User registered Successfully")
    )





    // res.status(200).json({
    //     message: "ok"
    // }) 
})

export { registerUser };