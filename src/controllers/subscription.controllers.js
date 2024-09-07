import mongoose, { isValidObjectId, Types } from "mongoose";
import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Toggle subscription to a channel
const toggleSubscription = asyncHandler(async (req, res, next) => {
    const { channelId } = req.params;

    // Check valid channelId
    if (!isValidObjectId(channelId)) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Invalid Channel ID"],
            hints: "Please check the Channel ID and try again",
        }));
    }

    // Find the channel in DB
    const channelExist = await User.findById(channelId).select('username');
    if (!channelExist) {
        return next(ApiError.notFound({
            message: "Channel is not Existed!",
            errors: ["The specified channel could not be found."],
            hints: "Please check the channel ID and try again",
        }));
    }

    // Can't subscribe to their own channel
    if (channelId === req.user._id.toString()) {
        return next(ApiError.badRequest({
            message: "You cannot Subscribe to your own Channel!",
            errors: ["The user cannot subscribe to their own channel."],
            hints: "Please select a different channel to subscribe to",
        }));
    }

    // Check if already subscribed
    const alreadySubscribed = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId,
    });

    if (alreadySubscribed) {
        await alreadySubscribed.deleteOne();
        return res.status(200).json(new ApiResponse(200, null, "Unsubscribed Successfully"));
    }

    // Create subscription
    const subscription = await Subscription.create({
        subscriber: req.user._id,
        channel: channelId,
    });

    if (!subscription) {
        return next(ApiError.serverError({
            message: "Something went wrong while toggling the subscription",
            errors: ["An error occurred during the subscription toggle process."],
        }));
    }

    return res.status(201).json(new ApiResponse(201, subscription, "Subscribed Successfully"));
});

// Controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res, next) => {
    const { subscriberId } = req.params;

    // Check valid channelId
    // console.log(subscriberId);
    if (!isValidObjectId(subscriberId)) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Invalid Channel ID"],
            hints: "Please check the Channel ID and try again",
        }));
    }

    // Aggregate to get subscriber list
    const subscriberList = await Subscription.aggregate([
        { $match: { channel: Types.ObjectId.createFromHexString(subscriberId) } },
        {
            $lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'subscriber',
                as: 'subscriberList',
                pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
            },
        },
        { $unwind: '$subscriberList' },
        {
            $group: {
                _id: '$channel',
                subscribers: { $push: '$subscriberList' },
            },
        },
        {
            $project: {
                _id: 0,
                channelId: '$_id',
                subscribers: 1,
            },
        },
    ]);

    return res.status(200).json(new ApiResponse(200, subscriberList[0], "User Channel Subscriber List Fetched Successfully"));
});

// Controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res, next) => {
    const { channelId } = req.params;

    // Check valid subscriberId
    if (!isValidObjectId(channelId)) {
        return next(ApiError.badRequest({
            message: "Validation Error",
            errors: ["Invalid Subscriber ID"],
            hints: "Please check the Subscriber ID and try again",
        }));
    }

    // Aggregate to get subscribed channel list
    const channelList = await Subscription.aggregate([
        { $match: { subscriber: Types.ObjectId.createFromHexString(channelId) } },
        {
            $lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'channel',
                as: 'channelList',
                pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
            },
        },
        { $unwind: '$channelList' },
        {
            $group: {
                _id: '$subscriber',
                channelList: { $push: '$channelList' },
            },
        },
        {
            $project: {
                _id: 0,
                subscriberId: '$_id',
                channelList: 1,
            },
        },
    ]);

    return res.status(200).json(new ApiResponse(200, channelList[0], "User Subscribed Channel List Fetched Successfully"));
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
};
