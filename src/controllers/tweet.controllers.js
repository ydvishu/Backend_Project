import mongoose, { isValidObjectId, Types } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create a tweet
const createTweet = asyncHandler(async (req, res, next) => {
    const { content } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Tweet content is required and must be at least 1 character long."],
            hints: "Please provide valid tweet content.",
        }));
    }

    // Create tweet object - create entry in DB
    const tweet = await Tweet.create({
        content,
        owner: req.user._id,
    });

    // Check that tweet is saved in the DB
    if (!tweet) {
        return next(ApiError.serverError({
            message: "Something went wrong while creating the tweet",
            errors: ["An error occurred during the tweet creation process."],
        }));
    }

    // Return response
    return res.status(201).json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

// Get tweets for a user
const getUserTweets = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    // Validate userId
    if (!isValidObjectId(userId)) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Invalid User ID"],
            hints: "Please check the User ID and try again.",
        }));
    }

    // Check if user exists
    const user = await User.findById(userId).select('username');
    if (!user) {
        return next(ApiError.notFound({
            message: "User not found",
            errors: ["The specified user could not be found."],
            hints: "Please check the user ID and try again.",
        }));
    }

    // Get all tweets for the user
    const allTweets = await Tweet.aggregate([
        { $match: { owner: new Types.ObjectId(userId) } },
        {
            $lookup: {
                from: 'users',
                localField: 'owner',
                foreignField: '_id',
                as: 'ownerInfo',
                pipeline: [
                    { $project: { fullName: 1, username: 1, avatar: 1 } },
                ],
            },
        },
        { $addFields: { ownerInfo: { $arrayElemAt: ['$ownerInfo', 0] } } },
        { $project: { content: 1, ownerInfo: 1 } },
    ]);

    // Return response
    return res.status(200).json(new ApiResponse(200, allTweets, "User's tweets fetched successfully"));
});

// Update a tweet
const updateTweet = asyncHandler(async (req, res, next) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    // Validate tweetId and content
    if (!isValidObjectId(tweetId)) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Invalid Tweet ID"],
            hints: "Please check the Tweet ID and try again.",
        }));
    }

    if (!content || content.trim().length === 0) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Tweet content is required and must be at least 1 character long."],
            hints: "Please provide valid tweet content.",
        }));
    }

    // Update tweet by the Tweet ID from DB
    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { content },
        { new: true }
    );

    if (!updatedTweet) {
        return next(ApiError.notFound({
            message: "Tweet not found",
            errors: ["The specified tweet could not be found."],
            hints: "Please check the tweet ID and try again.",
        }));
    }

    // Return response
    return res.status(200).json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

// Delete a tweet
const deleteTweet = asyncHandler(async (req, res, next) => {
    const { tweetId } = req.params;

    // Validate tweetId
    if (!isValidObjectId(tweetId)) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Invalid Tweet ID"],
            hints: "Please check the Tweet ID and try again.",
        }));
    }

    // Find and delete tweet by the Tweet ID from DB
    const tweet = await Tweet.findByIdAndDelete(tweetId);

    if (!tweet) {
        return next(ApiError.notFound({
            message: "Tweet not found",
            errors: ["The specified tweet could not be found."],
            hints: "Please check the tweet ID and try again.",
        }));
    }

    // Return response
    return res.status(200).json(new ApiResponse(200, null, "Tweet deleted successfully"));
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
};
