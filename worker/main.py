import os
import tempfile
import subprocess
import requests
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/process-video', methods=['POST'])
def process_video():
    """Process video with watermark using signed URLs"""
    video_id = None
    logo_path = None
    try:
        data = request.get_json()
        video_id = data.get('video_id')
        download_url = data.get('download_url')
        upload_url = data.get('upload_url')
        upload_path = data.get('upload_path')
        callback_url = data.get('callback_url')
        callback_secret = data.get('callback_secret')
        logo_url = data.get('logo_url')
        
        if not all([video_id, download_url, upload_url, upload_path, callback_url, callback_secret]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        logger.info(f'Processing video {video_id}')
        
        # Download video using signed URL
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_file:
            input_path = input_file.name
            logger.info(f'Downloading from signed URL...')
            response = requests.get(download_url, stream=True)
            response.raise_for_status()
            
            for chunk in response.iter_content(chunk_size=8192):
                input_file.write(chunk)
        
        logger.info(f'Downloaded video to {input_path}')
        
        # Create output path
        output_path = input_path.replace('.mp4', '_watermarked.mp4')
        
        # Add watermark using FFmpeg (logo if provided, else text)
        ffmpeg_command = None
        if logo_url:
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as logo_file:
                logo_path = logo_file.name
                logger.info('Downloading logo image...')
                resp = requests.get(logo_url, stream=True)
                resp.raise_for_status()
                for chunk in resp.iter_content(chunk_size=8192):
                    logo_file.write(chunk)
            ffmpeg_command = [
                'ffmpeg',
                '-i', input_path,
                '-i', logo_path,
                '-filter_complex', "[1:v]scale=120:-1[logo];[0:v][logo]overlay=10:10",
                '-codec:a', 'copy',
                '-y',
                output_path
            ]
        else:
            watermark_text = "Made with Sora AI"
            ffmpeg_command = [
                'ffmpeg',
                '-i', input_path,
                '-vf', f"drawtext=text='{watermark_text}':fontsize=24:fontcolor=white@0.7:x=10:y=10:box=1:boxcolor=black@0.5:boxborderw=5",
                '-codec:a', 'copy',
                '-y',
                output_path
            ]
        
        logger.info(f'Running FFmpeg...')
        result = subprocess.run(ffmpeg_command, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f'FFmpeg error: {result.stderr}')
            raise Exception(f'FFmpeg processing failed: {result.stderr}')
        
        logger.info('Video processed successfully')
        
        # Upload processed video using signed upload URL
        with open(output_path, 'rb') as output_file:
            logger.info(f'Uploading processed video...')
            upload_response = requests.put(
                upload_url,
                data=output_file,
                headers={'Content-Type': 'video/mp4'}
            )
            upload_response.raise_for_status()
        
        logger.info(f'Uploaded processed video to {upload_path}')
        
        # Notify callback that processing is complete
        callback_response = requests.post(
            callback_url,
            json={
                'video_id': video_id,
                'status': 'done',
                'processed_path': upload_path
            },
            headers={'x-worker-secret': callback_secret}
        )
        callback_response.raise_for_status()
        
        # Clean up temp files
        os.unlink(input_path)
        os.unlink(output_path)
        if logo_path:
            try:
                os.unlink(logo_path)
            except Exception:
                pass
        
        logger.info(f'Successfully processed video {video_id}')
        return jsonify({
            'success': True,
            'video_id': video_id,
            'processed_path': upload_path
        })
        
    except Exception as e:
        logger.error(f'Error processing video: {str(e)}')
        
        # Notify callback of error
        if video_id and callback_url and callback_secret:
            try:
                requests.post(
                    callback_url,
                    json={
                        'video_id': video_id,
                        'status': 'error',
                        'error_text': str(e)
                    },
                    headers={'x-worker-secret': callback_secret}
                )
            except Exception as callback_error:
                logger.error(f'Failed to send error callback: {callback_error}')
        
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
