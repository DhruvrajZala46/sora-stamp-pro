import os
import tempfile
import subprocess
from flask import Flask, request, jsonify
from supabase import create_client, Client
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

@app.route('/process-video', methods=['POST'])
def process_video():
    """Process video with watermark"""
    try:
        data = request.get_json()
        video_id = data.get('video_id')
        storage_path = data.get('storage_path')
        
        if not video_id or not storage_path:
            return jsonify({'error': 'Missing video_id or storage_path'}), 400
        
        logger.info(f'Processing video {video_id} from {storage_path}')
        
        # Update status to processing
        supabase.table('videos').update({
            'status': 'processing',
            'processing_started_at': 'now()'
        }).eq('id', video_id).execute()
        
        # Download video from Supabase storage
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_file:
            input_path = input_file.name
            
            # Get signed URL and download
            response = supabase.storage.from_('uploads').download(storage_path)
            input_file.write(response)
        
        logger.info(f'Downloaded video to {input_path}')
        
        # Create output path
        output_path = input_path.replace('.mp4', '_watermarked.mp4')
        
        # Add watermark using FFmpeg
        watermark_text = "Made with Sora AI"
        ffmpeg_command = [
            'ffmpeg',
            '-i', input_path,
            '-vf', f"drawtext=text='{watermark_text}':fontsize=24:fontcolor=white@0.7:x=10:y=10:box=1:boxcolor=black@0.5:boxborderw=5",
            '-codec:a', 'copy',
            '-y',
            output_path
        ]
        
        logger.info(f'Running FFmpeg: {" ".join(ffmpeg_command)}')
        result = subprocess.run(ffmpeg_command, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f'FFmpeg error: {result.stderr}')
            raise Exception(f'FFmpeg processing failed: {result.stderr}')
        
        logger.info('Video processed successfully')
        
        # Upload processed video to Supabase storage
        with open(output_path, 'rb') as output_file:
            processed_filename = f'processed_{os.path.basename(storage_path)}'
            processed_path = f'{video_id}/{processed_filename}'
            
            supabase.storage.from_('processed').upload(
                processed_path,
                output_file.read(),
                file_options={'content-type': 'video/mp4'}
            )
        
        logger.info(f'Uploaded processed video to {processed_path}')
        
        # Update database with processed video path
        supabase.table('videos').update({
            'status': 'done',
            'processed_path': processed_path,
            'processing_finished_at': 'now()'
        }).eq('id', video_id).execute()
        
        # Clean up temp files
        os.unlink(input_path)
        os.unlink(output_path)
        
        logger.info(f'Successfully processed video {video_id}')
        return jsonify({
            'success': True,
            'video_id': video_id,
            'processed_path': processed_path
        })
        
    except Exception as e:
        logger.error(f'Error processing video: {str(e)}')
        
        # Update video status to error
        if video_id:
            supabase.table('videos').update({
                'status': 'error',
                'error_text': str(e),
                'processing_finished_at': 'now()'
            }).eq('id', video_id).execute()
        
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
