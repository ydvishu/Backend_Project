import {v2 as cloudinary} from "cloudinary";
import fs from "fs"

    // Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
}); 


    // Upload a file
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null

        //upload the file on cloudinary 
        const response = await cloudinary.uploader.upload(localFilePath,  {
            resource_type: "auto"
        })

        // file has been uploaded successfull
        // console.log("file is uploaded on cloudinary", response.url) ;
        fs.unlinkSync(localFilePath)
        return response ;

    } catch (error) {
        fs.unlinkSync(localFilePath)        // remove the locally saved temporary file as the upload operation failed
        return null 
    }
};

const deleteFromCloudinary = async (contentId, contentType) => {
  try {
    // delete the file from cloudinary
    const response = await cloudinary.api.delete_resources([contentId], {
      type: 'upload',
      resource_type: contentType,
    });

    return response;
  } catch (error) {
    console.log('🚀 ~ deleteFromCloudinary ~ error:', error);

    throw new Error('Failed to delete content from Cloudinary');
  }
};

// get the cloudinary id of content from url
const getCloudinaryId = (contentUrl) => {
  if (!contentUrl) return '';

  return contentUrl
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '');
};

export {uploadOnCloudinary,
    deleteFromCloudinary,
    getCloudinaryId
}

// first of all we upload file through multer on the local storage and then have uploaded it on cloudnary 