import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import StarField from '@/components/StarField';
import { Button } from '@/components/ui/button';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} onLogout={() => supabase.auth.signOut()} />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="glass-card rounded-2xl p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">My Videos</h1>
          <p className="text-muted-foreground mb-6">Your video history will appear here</p>
          <Button onClick={() => navigate('/')} className="btn-hero">
            Upload New Video
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
