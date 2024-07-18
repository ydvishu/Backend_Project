import mongoose, {Schema} from "mongoose" ;
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema({
    username : {
        type: String,
        requires : true,
        unique : true,
        lowercase : true,
        trim : true,
        index : true
    },
    email : {
        type: String,
        requires : true,
        unique : true,
        lowercase : true,
        trim : true,        
    },
    fullName : {
        type: String,
        requires : true,
        trim : true,
        index : true
    },
    avatar : {
        type: String,  // cloudinary url (there is a service like aws which is free, when we upload, images , file, it gives us a url)
        requires : true,        
    },
    coverImage : {
        type: String,  // cloudinary url        
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref : "Video"
        }
    ],
    password : {
        type: String,
        requires : [true, 'Password is required']       
    },
    refreshToken: {
        type: String
    }
},{
    timestamps:true
})

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next() ;

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
export const User = mongoose.model("User", userSchema)