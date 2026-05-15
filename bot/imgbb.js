const axios = require('axios');
const logger = require('./logger');

async function uploadToImgBB(imageBuffer, fileName) {
  if (!imageBuffer) throw new Error('Image buffer is missing.');
  if (imageBuffer.length > 32 * 1024 * 1024) throw new Error('Image size exceeds 32MB limit.');

  const maxRetries = 2;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      logger.info(`ImgBB Upload Attempt ${attempt} for ${fileName}`);

      const params = new URLSearchParams();
      params.append('key', process.env.IMGBB_API_KEY);
      params.append('image', imageBuffer.toString('base64'));
      params.append('name', fileName);
      params.append('expiration', '0');

      const response = await axios.post('https://api.imgbb.com/1/upload', params);

      if (response.data && response.data.data) {
        const { url, thumb, delete_url } = response.data.data;
        logger.success(`ImgBB Upload Success: ${url}`);
        return { url, thumb: thumb?.url || url, deleteUrl: delete_url };
      } else {
        throw new Error('Invalid response structure from ImgBB');
      }
    } catch (error) {
      logger.warn(`ImgBB Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        logger.info('Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        logger.error('ImgBB upload failed after retry.');
        throw new Error('ImgBB upload failed after retry.');
      }
    }
  }
}

module.exports = { uploadToImgBB };