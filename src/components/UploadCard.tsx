import { useState, useRef } from 'react';
import { Upload, Video as VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface UploadCardProps {
  user: User | null;
  onAuthRequired: () => void;
  onUploadComplete: (videoId: string) => void;
  videosRemaining: number;
}

const UploadCard = ({ user, onAuthRequired, onUploadComplete, videosRemaining }: UploadCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!user) {
      onAuthRequired();
      return;
    }

    if (videosRemaining <= 0) {
      toast({
        title: 'Upload limit reached',
        description: 'Upgrade to Pro for unlimited videos',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a video file (MP4, WebM, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 500MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const timestamp = Date.now();
      const storagePath = `${user.id}/${timestamp}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;
      
      setProgress(100);

      // Get video duration using HTML5 video element
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const duration = Math.round(video.duration);
      URL.revokeObjectURL(video.src);

      // Create database record
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          filename: file.name,
          storage_path: storagePath,
          status: 'uploaded',
          duration_seconds: duration,
          size_bytes: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update remaining videos count
      await supabase
        .from('user_subscriptions')
        .update({ videos_remaining: videosRemaining - 1 })
        .eq('user_id', user.id);

      toast({
        title: 'Upload successful!',
        description: 'Starting watermark processing...',
      });

      onUploadComplete(videoData.id);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`upload-box ${isDragging ? 'border-primary scale-105' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading ? (
        <div className="space-y-4">
          <VideoIcon className="w-16 h-16 mx-auto text-primary animate-pulse" />
          <div className="space-y-2">
            <p className="text-lg font-medium">Uploading video...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{Math.round(progress)}% complete</p>
          </div>
        </div>
      ) : (
        <>
          <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Upload Your Video</h3>
          <p className="text-muted-foreground mb-6">
            Drag and drop or click to select
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="btn-hero"
          >
            Select Video
          </Button>
          {user && (
            <p className="text-sm text-muted-foreground mt-4">
              {videosRemaining} video{videosRemaining !== 1 ? 's' : ''} remaining
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default UploadCard;
