import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import StarField from '@/components/StarField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Share2, Play, Clock, Calendar, FileVideo } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import VideoPlayer from '@/components/VideoPlayer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Video {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  processing_finished_at: string | null;
  processed_path: string | null;
  error_text: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
}

const ITEMS_PER_PAGE = 9;

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<Video | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const generateThumbnail = async (video: Video): Promise<string> => {
    if (!video.processed_path) return '';

    try {
      const { data, error } = await supabase.storage
        .from('processed')
        .createSignedUrl(video.processed_path, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return '';
    }
  };

  const fetchVideos = async (page: number) => {
    setLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error, count } = await supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      toast.error('Failed to load videos');
      console.error(error);
    } else {
      setVideos(data || []);
      setTotalCount(count || 0);
      
      // Generate thumbnails
      const thumbs: Record<string, string> = {};
      for (const video of data || []) {
        if (video.processed_path) {
          thumbs[video.id] = await generateThumbnail(video);
        }
      }
      setThumbnails(thumbs);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchVideos(currentPage);
    }
  }, [user, currentPage]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('videos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Video updated:', payload);
          fetchVideos(currentPage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentPage]);

  const handleDownload = async (video: Video) => {
    if (!video.processed_path) {
      toast.error('Video is not ready for download');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('processed')
        .createSignedUrl(video.processed_path, 3600);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
      toast.success('Download started');
    } catch (error) {
      console.error(error);
      toast.error('Failed to download video');
    }
  };

  const handleDelete = async () => {
    if (!deleteVideo) return;

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', deleteVideo.id);

      if (error) throw error;

      toast.success('Video deleted successfully');
      setDeleteVideo(null);
      fetchVideos(currentPage);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete video');
    }
  };

  const handleShare = async (video: Video) => {
    if (!video.processed_path) {
      toast.error('Video is not ready for sharing');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('processed')
        .createSignedUrl(video.processed_path, 604800);

      if (error) throw error;

      await navigator.clipboard.writeText(data.signedUrl);
      toast.success('Share link copied to clipboard');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create share link');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      uploaded: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} onLogout={() => supabase.auth.signOut()} />
      <div className="relative z-10 min-h-screen px-6 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">My Videos</h1>
              <p className="text-muted-foreground">
                {totalCount} {totalCount === 1 ? 'video' : 'videos'} total
              </p>
            </div>
            <Button onClick={() => navigate('/')} className="btn-hero">
              Upload New Video
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                  <div className="aspect-video bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <FileVideo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-6">No videos yet</p>
              <Button onClick={() => navigate('/')} className="btn-hero">
                Upload Your First Video
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <div key={video.id} className="glass-card rounded-2xl overflow-hidden group hover-scale">
                    {/* Video Thumbnail */}
                    <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20">
                      {video.status === 'completed' && thumbnails[video.id] ? (
                        <video
                          src={thumbnails[video.id]}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onClick={() => setSelectedVideo(video)}
                          onCanPlay={(e) => {
                            try { e.currentTarget.play(); } catch {}
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <FileVideo className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Status Badge Overlay */}
                      <div className="absolute top-3 right-3">
                        {getStatusBadge(video.status)}
                      </div>

                      {/* Bottom Action Bar */}
                      {video.status === 'completed' && video.processed_path && (
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedVideo(video)}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Play
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={() => handleDownload(video)}
                              aria-label="Download video"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={() => handleShare(video)}
                              aria-label="Share video"
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2 truncate" title={video.filename}>
                        {video.filename}
                      </h3>
                      
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(video.created_at), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                        
                        {video.duration_seconds && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              {Math.floor(video.duration_seconds / 60)}:
                              {String(Math.floor(video.duration_seconds % 60)).padStart(2, '0')}
                            </span>
                          </div>
                        )}

                        {video.size_bytes && (
                          <div className="flex items-center gap-2">
                            <FileVideo className="w-4 h-4" />
                            <span>{(video.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        )}
                      </div>

                      {/* Error Message */}
                      {video.status === 'failed' && video.error_text && (
                        <div className="mb-4 p-2 bg-destructive/10 rounded text-xs text-destructive">
                          {video.error_text}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteVideo(video)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.filename}</DialogTitle>
          </DialogHeader>
          {selectedVideo?.processed_path && (
            <VideoPlayer videoId={selectedVideo.id} processedPath={selectedVideo.processed_path} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteVideo} onOpenChange={() => setDeleteVideo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteVideo?.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
