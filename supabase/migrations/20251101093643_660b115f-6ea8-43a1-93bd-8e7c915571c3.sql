-- Drop lingering auth.users trigger that creates profile and causes duplicate key on signup
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;