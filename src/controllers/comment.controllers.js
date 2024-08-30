import mongoose from "mongoose"
import {Comment} from "../models/comment.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if videoId is a valid MongoDB ObjectId
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    const comments = await Comment.aggregate([
        { $match: { video: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: 'likes',
                localField: '_id',
                foreignField: 'comment',
                as: 'liker_list',
                pipeline: [
                    {
                        $project: {
                            likedBy: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'owner',
                foreignField: '_id',
                as: 'commenter_list',
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                totalLikes: { $size: '$liker_list' },
                commenter: { $arrayElemAt: ['$commenter_list', 0] },
            },
        },
        {
            $project: {
                content: 1,
                totalLikes: 1,
                liker_list: 1,
                commenter: 1,
                createdAt: 1,
            },
        },
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
    ]);

    res.status(200).json(new ApiResponse(200, comments, 'Video Comments Fetched Successfully'));
});

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    // Validate input
    if (!content) {
        throw new ApiError(400, "Comment content is required");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    // Check if the video exists
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found! The video associated with this comment does not exist.");
    }

    // Create the comment in the database
    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user._id,
    });

    // Check if the comment was successfully created
    const createdComment = await Comment.findById(comment._id);
    if (!createdComment) {
        throw new ApiError(500, "Something went wrong while adding the comment");
    }

    // Return a success response
    res.status(201).json(new ApiResponse(201, createdComment, "Comment Added Successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    // Validate input
    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID");
    }

    if (!content) {
        throw new ApiError(400, "Comment content is required");
    }

    // Find the comment by ID and update it
    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        { content },
        { new: true }
    );

    if (!updatedComment) {
        throw new ApiError(404, "Comment not found! The specified comment could not be located.");
    }

    // Return a success response
    res.status(200).json(new ApiResponse(200, updatedComment, "Comment Updated Successfully"));
});


const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    // Validate commentId
    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID");
    }

    // Find and delete the comment by ID
    const comment = await Comment.findByIdAndDelete(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found! The specified comment could not be located.");
    }

    // Return a success response
    res.status(200).json(new ApiResponse(200, null, "Comment Deleted Successfully"));
});


export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
}