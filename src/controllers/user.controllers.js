import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js" ;
import {uploadOnCloudinary} from "../utils/cloudinary.js" ;
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken; 
        await user.save({ validateBeforeSave : false })
     
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens")
    }
}

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
    // console.log( "email: ", email) ;

    // Validation
    if(
        [fullName, username, email, password].some((field)=> field?.trim === "")
    ){
        throw new ApiError(400, "All fields are required");
    }

    // Method 1 to throw error, here we have to apply a lot of if conditions
    // if(fullname === ""){
    //     throw new ApiError(400, "fullname is required")
    // }


    // if already exist
    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })
    
    if(existedUser){
        throw new ApiError(409, "User with email or username already exist")
    }

    // Check for avatar and coverImage files
    console.log("req.files: ", req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path ;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path ;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath =req.files.coverImage[0].path
    }
    

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file path is required");
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

const loginUser = asyncHandler(async (req, res) => {
     // req body -> data
     //  username or email
     // check the user
     // password check
     // access and refresh token
     // send cookie

    const {email, username, password} = req.body

    if(!username && !email){
        throw new ApiError(400, "username or email is required") ;
    }

    // check the user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    // if user not found
    if(!user){
        throw new ApiError(404, "User does not found") ;
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User credentials") ;
    }

    // access and refresh token
    // I have written a different method for refresh and access token because we will be going to need it at some of the other places also
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)
    
    // send cookie
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options= {
        httpOnly : true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options= {
        httpOnly : true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out Successfully"))
})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken     // req.body.refreshToken (in case someone is using Mobile App)

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken != user?.refreshToken){
            throw new ApiError(401, "Refresh Token is Expired or Used")
        }
    
        const optons= {
            httpOnly : true,
            secure: true
        }
    
        const {newAccessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id) 
    
        return res
        .status(200)
        .cookie("accessToken", newAccessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed Successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, "Invalid Refresh Token")
    }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken };