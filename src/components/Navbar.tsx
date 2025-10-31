import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';
import { Video, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  user: User | null;
  credits?: number;
  onLogout?: () => void;
}

const Navbar = ({ user, credits, onLogout }: NavbarProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto">
        {/* Glass background pill */}
        <div className="glass-card rounded-full px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <Video className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            <span className="text-lg sm:text-xl font-bold text-foreground">
              SoraStamp
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {user ? (
              <>
                {credits !== undefined && (
                  <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                    {credits} credits
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/credits')}
                  className="text-foreground/80 hover:text-foreground rounded-full px-4"
                >
                  Buy Credits
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  className="text-foreground/80 hover:text-foreground rounded-full px-4"
                >
                  My Videos
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="text-foreground/80 hover:text-foreground rounded-full px-4"
                >
                  Profile
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={() => navigate('/auth')}
                  className="bg-foreground/10 hover:bg-foreground/20 text-foreground rounded-full px-6 py-2 text-sm font-medium transition-all"
                >
                  Login
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-full hover:bg-foreground/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 glass-card rounded-2xl p-4 space-y-2">
            {user ? (
              <>
                {credits !== undefined && (
                  <div className="pb-2 mb-2 border-b border-border/50">
                    <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                      {credits} credits
                    </Badge>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-foreground/80 hover:text-foreground"
                  onClick={() => {
                    navigate('/dashboard');
                    setMobileMenuOpen(false);
                  }}
                >
                  My Videos
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-foreground/80 hover:text-foreground"
                  onClick={() => {
                    navigate('/credits');
                    setMobileMenuOpen(false);
                  }}
                >
                  Buy Credits
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-foreground/80 hover:text-foreground"
                  onClick={() => {
                    navigate('/profile');
                    setMobileMenuOpen(false);
                  }}
                >
                  Profile
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={() => {
                    navigate('/auth');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-foreground/10 hover:bg-foreground/20 text-foreground"
                >
                  Login
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
