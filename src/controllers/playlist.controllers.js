import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
     if (!name || !description) {
        const error = new ApiError(400, "Validation Error", ["Name and description are required."]);
        return next(error);
    }

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user._id,
    });

     if (!playlist) {
        const error = new ApiError(500, "Failed to create playlist");
        return next(error);
    }

    return res.status(201).json(new ApiResponse(201, playlist, "Playlist created successfully"));
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params;
     if (!isValidObjectId(userId)) {
        const error = new ApiError(400, "Invalid user ID");
        return next(error);
    }

    const playlists = await Playlist.find({ owner: userId }).populate('videos');

    return res.status(200).json(new ApiResponse(200, playlists, "User playlists fetched successfully"));    
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if (!isValidObjectId(playlistId)) {
        const error = new ApiError(400, "Invalid playlist ID");
        return next(error);
    }

    const playlist = await Playlist.findById(playlistId).populate('videos');

    if (!playlist) {
        const error = new ApiError(404, "Playlist not found");
        return next(error);
    }

    return res.status(200).json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
})

const addVideoToPlaylist = asyncHandler(async (req, res, next) => {
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        const error = new ApiError(400, "Invalid playlist or video ID");
        return next(error);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        const error = new ApiError(404, "Playlist not found");
        return next(error);
    }

    if (playlist.videos.includes(videoId)) {
        const error = new ApiError(400, "Video already in playlist");
        return next(error);
    }

    playlist.videos.push(videoId);
    await playlist.save();

    return res.status(200).json(new ApiResponse(200, playlist, "Video added to playlist successfully"));
});


const removeVideoFromPlaylist = asyncHandler(async (req, res, next) => {
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        const error = new ApiError(400, "Invalid playlist or video ID");
        return next(error);
    }

    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        { $pull: { videos: videoId } },
        { new: true }
    );

    if (!playlist) {
        const error = new ApiError(404, "Playlist not found");
        return next(error);
    }

    return res.status(200).json(new ApiResponse(200, playlist, "Video removed from playlist successfully"));
});

const deletePlaylist = asyncHandler(async (req, res, next) => {
    const { playlistId } = req.params;

    if (!isValidObjectId(playlistId)) {
        const error = new ApiError(400, "Invalid playlist ID");
        return next(error);
    }

    const playlist = await Playlist.findByIdAndDelete(playlistId);

    if (!playlist) {
        const error = new ApiError(404, "Playlist not found");
        return next(error);
    }

    return res.status(200).json(new ApiResponse(200, null, "Playlist deleted successfully"));
});


const updatePlaylist = asyncHandler(async (req, res, next) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!isValidObjectId(playlistId)) {
        const error = new ApiError(400, "Invalid playlist ID");
        return next(error);
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        { name, description },
        { new: true }
    );

    if (!updatedPlaylist) {
        const error = new ApiError(404, "Playlist not found");
        return next(error);
    }

    return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Playlist updated successfully"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}