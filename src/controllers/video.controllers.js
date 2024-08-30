import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, getCloudinaryId, uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {    
    const {
        page = 1,
        limit = 10,
        query,
        sortBy = 'createdAt',
        sortType = 'desc',
        userId,
    } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const skip = (pageInt - 1) * limitInt;

    // Create a filter object for aggregation
    let match = { isPublished: true };
    if (query) {
        match = { ...match, title: { $regex: query, $options: 'i' } };
    }
    if (userId) {
        match = { ...match, owner: userId }; // Assuming `userId` should filter by owner
    }

    // Build the aggregation pipeline
    const aggregationPipeline = [
        { $match: match },
        { $sort: { [sortBy]: sortType === 'desc' ? -1 : 1 } },
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
                            avatar: 1,
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
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [{ $skip: skip }, { $limit: limitInt }],
            },
        },
        {
            $unwind: {
                path: '$metadata',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                total: '$metadata.total',
                data: 1,
                ownerInfo: 1,
            },
        },
    ];

    const results = await Video.aggregate(aggregationPipeline);
    const result = results[0] || { total: 0, data: [] };

    const totalVideos = result.total;
    const totalPages = Math.ceil(totalVideos / limitInt);

    // Calculate pagination details
    const pagination = {
        page: pageInt,
        limit: limitInt,
        first: 1,
        last: totalPages,
        prev: pageInt > 1 ? pageInt - 1 : null,
        next: pageInt < totalPages ? pageInt + 1 : null,
        totalPage: totalPages,
        totalVideos: totalVideos,
    };

    // Return response
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos: result.data,
                pagination,
            },
            'Videos retrieved successfully'
        )
    );
})

const uploadVideo = asyncHandler(async (req, res, next) => {
    const { title, description } = req.body;

    // Validate title and description
    if (!title || typeof title !== 'string') {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['Invalid or missing title'],
                'Title is required and must be a string'
            )
        );
    }
    if (!description || typeof description !== 'string') {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['Invalid or missing description'],
                'Description is required and must be a string'
            )
        );
    }

    // Check for video file
    const videoFileLocalPath = req.files?.videoFile[0]?.path;
    if (!videoFileLocalPath) {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['No video file was provided'],
                'Please upload a video file and try again'
            )
        );
    }

    // Check for video thumbnail
    const videoThumbnailLocalPath = req.files?.videoThumbnail[0]?.path;
    if (!videoThumbnailLocalPath) {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['No video thumbnail was provided'],
                'Please upload a video thumbnail and try again'
            )
        );
    }

    try {
        // Upload video file and thumbnail to Cloudinary
        const videoFile = await uploadOnCloudinary(videoFileLocalPath);
        const videoThumbnail = await uploadOnCloudinary(videoThumbnailLocalPath);

        if (!videoFile || !videoThumbnail) {
            return next(
                new ApiError(
                    500,
                    'Server Error',
                    ['Failed to upload video or thumbnail'],
                    'An error occurred while uploading the video or thumbnail'
                )
            );
        }

        // Create video entry in the database
        const video = await Video.create({
            title,
            description,
            videoFile: videoFile.url,
            thumbnail: videoThumbnail.url,
            owner: req.user._id,
            duration: videoFile.duration // Assuming you want to store the duration
        });

        // Fetch the created video for response
        const createdVideo = await Video.findById(video._id).populate('owner', 'fullName username');

        if (!createdVideo) {
            return next(
                new ApiError(
                    500,
                    'Server Error',
                    ['Error fetching created video'],
                    'An error occurred while retrieving the created video'
                )
            );
        }

        // Return success response
        return res.status(201).json(
            new ApiResponse(
                201,
                createdVideo,
                'Video Uploaded Successfully'
            )
        );
    } catch (error) {
        // Handle unexpected errors
        return next(
            new ApiError(
                500,
                'Server Error',
                [error.message],
                'An unexpected error occurred while uploading the video'
            )
        );
    }
});

const getVideoById = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;

    // Check if the videoId is valid
    if (!isValidObjectId(videoId)) {
        const error = CustomError.badRequest({
            message: 'Validation Error',
            errors: ['Invalid Video ID'],
            hints: 'Please check the Video ID and try again',
        });
        return next(error);
    }

    // Fetch the video details by aggregation pipeline
    const result = await Video.aggregate([
        { $match: { _id: new Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: 'likes',
                localField: '_id',
                foreignField: 'video',
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
                as: 'owner_info',
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
                owner: { $arrayElemAt: ['$owner_info', 0] },
                totalLikes: { $size: '$liker_list' },
                likers: '$liker_list',
            },
        },
        {
            $project: {
                owner_info: 0,
                liker_list: 0,
            },
        },
    ]);

    // Extract the video details from the aggregation result
    const video = result[0];

    if (!video) {
        const error = CustomError.notFound({
            message: 'Video not found',
            errors: ['The specified video could not be found.'],
            hints: 'Please check the video ID and try again',
        });
        return next(error);
    }

    // Fetch similar videos based on title
    const similarVideos = await Video.find({
        _id: { $ne: videoId },
        title: { $regex: new RegExp(video.title.split(' ').join('|'), 'i') },
    })
        .select('videoFile thumbnail title views createdAt')
        .populate('owner', 'fullName username')
        .limit(5);

    // Add the videoId to the user's watchHistory if the user is authenticated
    if (req.user) {
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { watchHistory: videoId },
        });
    }

    // Increase the view count for the video
    await Video.updateOne({ _id: video._id }, { $inc: { views: 1 } });

    // Return the response
    return res.status(200).json(
        new ApiResponse(
            200,
            { video, similarVideos },
            'Video details fetched successfully'
        )
    );
});


const updateVideo = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    // Validate videoId
    if (!isValidObjectId(videoId)) {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['Invalid Video ID'],
                'Please check the Video ID and try again'
            )
        );
    }

    // Validate title and description
    if (title && typeof title !== 'string') {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['Invalid title format'],
                'Title must be a string'
            )
        );
    }

    if (description && typeof description !== 'string') {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['Invalid description format'],
                'Description must be a string'
            )
        );
    }

    // Fetch the video details
    const video = await Video.findById(videoId).populate('owner', 'fullName');
    if (!video) {
        return next(
            new ApiError(
                404,
                'Video not found',
                ['The specified video could not be found.'],
                'Please check the video ID and try again'
            )
        );
    }

    // Check video ownership
    if (video.owner._id.toString() !== req.user._id.toString()) {
        return next(
            new ApiError(
                403,
                'Forbidden',
                ['You cannot update this video!'],
                'The video you are trying to update does not belong to you.'
            )
        );
    }

    // Handle video thumbnail upload
    const videoThumbnailLocalPath = req.file?.path;
    if (!videoThumbnailLocalPath) {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['No video thumbnail was provided in the request.'],
                'Please upload a video thumbnail and try again'
            )
        );
    }

    const videoThumbnail = await uploadOnCloudinary(videoThumbnailLocalPath);
    if (!videoThumbnail.url) {
        return next(
            new ApiError(
                500,
                'Server Error',
                ['Error while uploading the video thumbnail.'],
                'An error occurred during the video thumbnail upload process.'
            )
        );
    }

    // Update video details
    if (title) {
        video.title = title;
    }

    if (description) {
        video.description = description;
    }

    video.thumbnail = videoThumbnail.url;
    await video.save();

    // Return a response
    return res.status(200).json(new ApiResponse(200, video, 'Video Details Updated Successfully'));
});

const deleteVideo = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;

    // Validate the videoId
    if (!isValidObjectId(videoId)) {
        return next(
            new ApiError(
                400,
                'Validation Error',
                ['Invalid Video ID'],
                'Please check the Video ID and try again'
            )
        );
    }

    // Fetch the video details
    const video = await Video.findById(videoId).populate('owner', 'fullName');
    if (!video) {
        return next(
            new ApiError(
                404,
                'Video not found',
                ['The specified video could not be found.'],
                'Please check the video ID and try again'
            )
        );
    }

    // Check video ownership
    if (video.owner._id.toString() !== req.user._id.toString()) {
        return next(
            new ApiError(
                403,
                'Forbidden',
                ['You cannot delete this video!'],
                'The video you are trying to delete does not belong to you.'
            )
        );
    }

    // Find Cloudinary IDs for the thumbnail and video file
    const thumbnailIdOfCloudinary = getCloudinaryId(video.thumbnail);
    const videoIdOfCloudinary = getCloudinaryId(video.videoFile);

    // Delete from Cloudinary asynchronously
    const [thumbnailDeletion, videoDeletion] = await Promise.all([
        deleteFromCloudinary(thumbnailIdOfCloudinary, 'image'),
        deleteFromCloudinary(videoIdOfCloudinary, 'video'),
    ]);

    // Handle potential errors from Cloudinary deletions
    if (
        thumbnailDeletion.deleted[thumbnailIdOfCloudinary] === 'not_found' ||
        videoDeletion.deleted[videoIdOfCloudinary] === 'not_found' ||
        thumbnailDeletion.error ||
        videoDeletion.error
    ) {
        return next(
            new ApiError(
                500,
                'Server Error',
                ['Error Deleting Video from Cloudinary'],
                'An error occurred while trying to delete the video from Cloudinary.'
            )
        );
    }

    // Delete video from DB
    await video.deleteOne();

    // Return a response
    return res.status(200).json(
        new ApiResponse(
            200,
            null,
            'Video Deleted Successfully'
        )
    );
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    uploadVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}