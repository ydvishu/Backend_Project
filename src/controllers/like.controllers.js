import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;

    // Validate videoId
    if (!isValidObjectId(videoId)) {
        return next(new ApiError(400, "Invalid Video ID"));
    }

    // Check if the video is already liked
    const alreadyLikedVideo = await Like.findOne({
        likedBy: req.user._id,
        video: videoId,
    });

    if (alreadyLikedVideo) {
        await alreadyLikedVideo.deleteOne();
        return res
            .status(200)
            .json(new ApiResponse(200, null, 'Video unliked successfully'));
    }

    // Add like
    const like = await Like.create({
        likedBy: req.user._id,
        video: videoId,
    });

    if (!like) {
        return next(new ApiError(500, "Failed to like the video"));
    }

    res.status(201).json(new ApiResponse(201, like, 'Video liked successfully'));
});


const toggleCommentLike = asyncHandler(async (req, res, next) => {
    const { commentId } = req.params;

    // Validate commentId
    if (!isValidObjectId(commentId)) {
        return next(new ApiError(400, "Invalid Comment ID"));
    }

    // Check if the comment is already liked
    const alreadyLikedComment = await Like.findOne({
        likedBy: req.user._id,
        comment: commentId,
    });

    if (alreadyLikedComment) {
        await alreadyLikedComment.deleteOne();
        return res
            .status(200)
            .json(new ApiResponse(200, null, 'Comment unliked successfully'));
    }

    // Add like
    const like = await Like.create({
        likedBy: req.user._id,
        comment: commentId,
    });

    if (!like) {
        return next(new ApiError(500, "Failed to like the comment"));
    }

    res.status(201).json(new ApiResponse(201, like, 'Comment liked successfully'));
});


const toggleTweetLike = asyncHandler(async (req, res, next) => {
    const { tweetId } = req.params;

    // Validate tweetId
    if (!isValidObjectId(tweetId)) {
        return next(new ApiError(400, "Invalid Tweet ID"));
    }

    // Check if the tweet is already liked
    const alreadyLikedTweet = await Like.findOne({
        likedBy: req.user._id,
        tweet: tweetId,
    });

    if (alreadyLikedTweet) {
        await alreadyLikedTweet.deleteOne();
        return res
            .status(200)
            .json(new ApiResponse(200, null, 'Tweet unliked successfully'));
    }

    // Add like
    const like = await Like.create({
        likedBy: req.user._id,
        tweet: tweetId,
    });

    if (!like) {
        return next(new ApiError(500, "Failed to like the tweet"));
    }

    res.status(201).json(new ApiResponse(201, like, 'Tweet liked successfully'));
});


const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: { $exists: true },
            },
        },
        {
            $lookup: {
                from: 'videos',
                localField: 'video',
                foreignField: '_id',
                as: 'videoDetails',
                pipeline: [
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'owner',
                            foreignField: '_id',
                            as: 'ownerInfo',
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            ownerInfo: { $arrayElemAt: ['$ownerInfo', 0] },
                        },
                    },
                    {
                        $project: {
                            title: 1,
                            duration: 1,
                            description: 1,
                            views: 1,
                            thumbnail: 1,
                            ownerInfo: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                videoDetails: { $arrayElemAt: ['$videoDetails', 0] },
            },
        },
        {
            $project: {
                videoDetails: 1,
            },
        },
    ]);

    res.status(200).json(new ApiResponse(200, likedVideos, 'Fetched all liked videos successfully'));
});


export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}