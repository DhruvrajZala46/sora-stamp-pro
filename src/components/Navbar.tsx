import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';
import { Video } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  plan?: string;
  onLogout?: () => void;
}

const Navbar = ({ user, plan = 'free', onLogout }: NavbarProps) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <Video className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            SoraStamp
          </span>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Badge variant="secondary" className="px-4 py-1.5 text-sm font-medium">
                {plan === 'pro' ? '✨ Pro' : '🆓 Free'}
              </Badge>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="text-foreground/80 hover:text-foreground"
              >
                My Videos
              </Button>
              <Avatar className="cursor-pointer" onClick={() => navigate('/profile')}>
                <AvatarFallback className="bg-primary/20 text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </>
          ) : (
            <Button 
              onClick={() => navigate('/auth')}
              className="btn-hero"
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
