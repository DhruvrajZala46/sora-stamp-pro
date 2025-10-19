import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import StarField from '@/components/StarField';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Share2, Play } from 'lucide-react';
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

const ITEMS_PER_PAGE = 10;

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<Video | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

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
        .createSignedUrl(video.processed_path, 604800); // 7 days

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
      <Badge variant={variants[status] || 'secondary'}>
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
            <h1 className="text-4xl font-bold">My Videos</h1>
            <Button onClick={() => navigate('/')} className="btn-hero">
              Upload New Video
            </Button>
          </div>

          {loading ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">Loading videos...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-muted-foreground mb-6">No videos yet</p>
              <Button onClick={() => navigate('/')} className="btn-hero">
                Upload Your First Video
              </Button>
            </div>
          ) : (
            <>
              <div className="glass-card rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((video) => (
                      <TableRow key={video.id}>
                        <TableCell className="font-medium">{video.filename}</TableCell>
                        <TableCell>{getStatusBadge(video.status)}</TableCell>
                        <TableCell>{format(new Date(video.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                        <TableCell>
                          {video.processing_finished_at
                            ? format(new Date(video.processing_finished_at), 'MMM d, yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {video.size_bytes ? `${(video.size_bytes / 1024 / 1024).toFixed(2)} MB` : '-'}
                        </TableCell>
                        <TableCell>
                          {video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(Math.floor(video.duration_seconds % 60)).padStart(2, '0')}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {video.status === 'completed' && video.processed_path && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedVideo(video)}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownload(video)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleShare(video)}
                                >
                                  <Share2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteVideo(video)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
