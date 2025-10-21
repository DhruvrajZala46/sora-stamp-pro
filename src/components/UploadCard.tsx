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
  maxFileSizeMb: number;
  currentPlan: string;
}

const UploadCard = ({ user, onAuthRequired, onUploadComplete, videosRemaining, maxFileSizeMb, currentPlan }: UploadCardProps) => {
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
    // Extract extension safely
    const lastDot = filename.lastIndexOf('.');
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.substring(lastDot) : '.mp4';
    
    // Remove path separators and sanitize
    const clean = name
      .replace(/[\/\\]/g, '') // Remove slashes
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
      .substring(0, 200); // Limit length
    
    return clean + ext.substring(0, 10); // Limit extension length
  };

  const handleFile = async (file: File) => {
    if (!user) {
      // Force a full redirect to the dedicated Auth page (avoid any modals)
      if (typeof window !== 'undefined') {
        window.location.replace('/auth');
      }
      // Also call the callback for any parent-side cleanup, but after scheduling redirect
      try {
        onAuthRequired();
      } catch (_) {
        // no-op
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: '📹 Invalid File Type',
        description: 'Please select a video file. Supported formats: MP4, WebM, MOV, AVI, and more.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Server-side validation before upload
      const { data: validation, error: validationError } = await supabase.functions.invoke(
        'validate-upload',
        {
          body: {
            fileSize: file.size,
            fileType: file.type
          }
        }
      );

      if (validationError || !validation?.allowed) {
        const reason = validation?.reason || 'unknown';
        
        if (reason === 'quota_exceeded') {
          const plan = validation?.plan || currentPlan;
          const planLimit = plan === 'free' ? '5 videos' : 
                           plan === 'starter' ? '25 videos' : 
                           plan === 'pro' ? '100 videos' : 
                           '500 videos';
          
          toast({
            title: '🎬 Monthly Video Limit Reached',
            description: `Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan allows ${planLimit} per month. Upgrade now for more videos!`,
            variant: 'destructive',
            action: (
              <button
                onClick={() => window.location.href = '/pricing'}
                className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                View Plans
              </button>
            ),
          });
          setTimeout(() => window.location.href = '/pricing', 3000);
        } else if (reason === 'file_too_large') {
          const maxSize = validation?.maxSizeMb || maxFileSizeMb;
          const plan = validation?.plan || currentPlan;
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
          
          const upgradeInfo = plan === 'free' || plan === 'starter' 
            ? { plan: 'Pro', price: '$9/mo', size: '300MB' }
            : { plan: 'Unlimited', price: '$29/mo', size: '500MB' };
          
          toast({
            title: '📁 File Size Limit Exceeded',
            description: `Your file is ${fileSizeMB}MB. Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan supports up to ${maxSize}MB. Upgrade to ${upgradeInfo.plan} (${upgradeInfo.price}) for ${upgradeInfo.size} files.`,
            variant: 'destructive',
            action: (
              <button
                onClick={() => window.location.href = '/pricing'}
                className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Upgrade Now
              </button>
            ),
          });
        } else {
          toast({
            title: '⚠️ Upload Not Allowed',
            description: 'This upload cannot be processed. Please check your plan limits or contact support for assistance.',
            variant: 'destructive',
            action: (
              <button
                onClick={() => window.location.href = '/pricing'}
                className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Check Plans
              </button>
            ),
          });
        }
        return;
      }

      // Decrement quota atomically after validation
      const { data: hasQuota, error: quotaError } = await supabase.rpc('decrement_videos_remaining', {
        p_user_id: user.id
      });

      if (quotaError || !hasQuota) {
        const planLimit = currentPlan === 'free' ? '5 videos' : 
                         currentPlan === 'starter' ? '25 videos' : 
                         currentPlan === 'pro' ? '100 videos' : 
                         '500 videos';
        
        toast({
          title: '🎬 Monthly Video Limit Reached',
          description: `You've used all ${planLimit} in your ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan this month. Upgrade to continue creating!`,
          variant: 'destructive',
          action: (
            <button
              onClick={() => window.location.href = '/pricing'}
              className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Upgrade Plan
            </button>
          ),
        });
        setTimeout(() => window.location.href = '/pricing', 3000);
        return;
      }

      const timestamp = Date.now();
      const sanitizedFilename = sanitizeFilename(file.name);
      const storagePath = `${user.id}/${timestamp}_${sanitizedFilename}`;

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

      toast({
        title: 'Upload successful!',
        description: 'Starting watermark processing...',
      });

      onUploadComplete(videoData.id);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: '❌ Upload Failed',
        description: 'We encountered an error while uploading your video. Please check your internet connection and try again. If the issue persists, contact support.',
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
