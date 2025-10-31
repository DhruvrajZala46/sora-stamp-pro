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
  onCreditsUpdate: () => void;
  userCredits: number;
  creditsCost: number;
  maxFileSizeMb: number;
}

const UploadCard = ({ 
  user, 
  onAuthRequired, 
  onUploadComplete, 
  onCreditsUpdate,
  userCredits, 
  creditsCost, 
  maxFileSizeMb 
}: UploadCardProps) => {
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

  const sanitizeFilename = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.substring(lastDot) : '.mp4';
    
    const clean = name
      .replace(/[\/\\]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 200);
    
    return clean + ext.substring(0, 10);
  };

  const handleFile = async (file: File) => {
    // Auth check
    if (!user) {
      if (typeof window !== 'undefined') {
        window.location.replace('/auth');
      }
      try {
        onAuthRequired();
      } catch (_) {}
      return;
    }

    // Check credits before upload
    if (userCredits < creditsCost) {
      toast({
        title: '💰 Insufficient Credits',
        description: `You need ${creditsCost} credits to add a watermark. You currently have ${userCredits} credits.`,
        variant: 'destructive',
        action: (
          <button
            onClick={() => window.location.href = '/credits'}
            className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Buy Credits
          </button>
        ),
      });
      return;
    }

    // File type validation
    if (!file.type.startsWith('video/')) {
      toast({
        title: '📹 Invalid File Type',
        description: 'Please select a video file. Supported formats: MP4, WebM, MOV, AVI, and more.',
        variant: 'destructive',
      });
      return;
    }

    // File size validation
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSizeMb) {
      toast({
        title: '📁 File Size Limit Exceeded',
        description: `Your file is ${fileSizeMB.toFixed(1)}MB. Maximum allowed size is ${maxFileSizeMb}MB.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const timestamp = Date.now();
      const sanitizedFilename = sanitizeFilename(file.name);
      const storagePath = `${user.id}/${timestamp}_${sanitizedFilename}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;
      
      setProgress(50);

      // Get video duration
      const getDurationAsync = (): Promise<number> => {
        return new Promise((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = URL.createObjectURL(file);
          
          video.onloadedmetadata = () => {
            const duration = Math.round(video.duration);
            URL.revokeObjectURL(video.src);
            resolve(duration);
          };
          
          video.onerror = () => {
            URL.revokeObjectURL(video.src);
            resolve(0);
          };
          
          setTimeout(() => {
            URL.revokeObjectURL(video.src);
            resolve(0);
          }, 3000);
        });
      };

      setProgress(75);

      const durationPromise = getDurationAsync();

      // Create DB record
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          filename: file.name,
          storage_path: storagePath,
          status: 'uploaded',
          duration_seconds: 0,
          size_bytes: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setProgress(90);

      // Update duration
      const duration = await durationPromise;
      if (duration > 0) {
        await supabase
          .from('videos')
          .update({ duration_seconds: duration })
          .eq('id', videoData.id);
      }

      setProgress(100);

      toast({
        title: '⚡ Upload successful!',
        description: 'Starting watermark processing...',
      });

      // Update credits display
      onCreditsUpdate();

      // Start processing
      onUploadComplete(videoData.id);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: '❌ Upload Failed',
        description: 'We encountered an error while uploading your video. Please try again.',
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
            onClick={() => {
              if (!user) {
                if (typeof window !== 'undefined') {
                  window.location.replace('/auth');
                }
                return;
              }
              fileInputRef.current?.click();
            }}
            className="btn-hero"
            disabled={userCredits < creditsCost}
          >
            Select Video
          </Button>
          {user && (
            <p className="text-sm text-muted-foreground mt-4">
              {userCredits} credits available • Costs {creditsCost} credits
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default UploadCard;