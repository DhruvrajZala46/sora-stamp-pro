import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import StarField from '@/components/StarField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Mail, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState('free');
  const [videosRemaining, setVideosRemaining] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
        fetchSubscription(session.user.id);
      }
    });
  }, [navigate]);

  const fetchSubscription = async (userId: string) => {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan, videos_remaining')
      .eq('user_id', userId)
      .single();
    
    if (data) {
      setPlan(data.plan);
      setVideosRemaining(data.videos_remaining);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Signed out successfully' });
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="glass-card border-0">
            <CardHeader className="text-center space-y-4">
              <Avatar className="w-24 h-24 mx-auto">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{user.user_metadata?.full_name || 'User'}</CardTitle>
                <CardDescription className="flex items-center justify-center gap-2 mt-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Current Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold capitalize">{plan}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Videos Remaining</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{videosRemaining}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/dashboard')}
                >
                  My Videos
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
