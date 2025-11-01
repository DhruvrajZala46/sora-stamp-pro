import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoPlayerProps {
  videoId: string;
  processedPath: string;
}

const VideoPlayer = ({ videoId, processedPath }: VideoPlayerProps) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Create playback URL - handle both Supabase storage paths and external URLs
  useEffect(() => {
    let cancelled = false;
    async function genPlaybackUrl() {
      try {
        if (!processedPath) return;
        
        // If it's an external URL (starts with http), use it directly
        if (processedPath.startsWith('http://') || processedPath.startsWith('https://')) {
          if (!cancelled) setPlaybackUrl(processedPath);
          return;
        }
        
        // Otherwise, create signed URL from Supabase storage
        const { data, error } = await supabase.storage
          .from('processed')
          .createSignedUrl(processedPath, 3600);
        if (error) throw error;
        if (!cancelled) setPlaybackUrl(data.signedUrl);
      } catch (e) {
        // Silently fail - video player will show without URL
      }
    }
    genPlaybackUrl();
    return () => { cancelled = true; };
  }, [processedPath]);

  const handleDownload = async () => {
    try {
      let downloadLink = processedPath;
      
      // If it's a storage path, create signed URL
      if (!processedPath.startsWith('http://') && !processedPath.startsWith('https://')) {
        const { data, error } = await supabase.storage
          .from('processed')
          .createSignedUrl(processedPath, 3600);
        if (error) throw error;
        downloadLink = data.signedUrl;
      }

      setDownloadUrl(downloadLink);
      window.open(downloadLink, '_blank');
      
      toast({
        title: 'Download started',
        description: 'Your watermarked video is ready!',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Unable to download video',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-semibold">Your SoraStamp Video</h3>
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        <video
          src={playbackUrl || undefined}
          controls
          className="w-full h-full object-contain"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <Button onClick={handleDownload} className="w-full btn-hero">
        <Download className="w-4 h-4 mr-2" />
        Download Video
      </Button>
    </div>
  );
};

export default VideoPlayer;
