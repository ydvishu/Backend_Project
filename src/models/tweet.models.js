import mongoose, {Schema} from "mongoose";

const tweetSchema = new Schema(
    {
        content: {
            type: String,
            requires:  true
        },
        owner:{
            type: Schema.Types.Schema,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
)

export const Tweet = mongoose.model("Tweet", tweetSchema)