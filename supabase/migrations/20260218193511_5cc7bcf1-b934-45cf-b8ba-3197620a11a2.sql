
-- ============================================
-- FCO Manager - Migration complète Firebase → Lovable Cloud
-- ============================================

-- 1. PROFILES (users table)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'joueur',
  player_id UUID,
  photo_url TEXT,
  team TEXT,
  license_expiry TEXT,
  session_token TEXT,
  welcome_seen BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. USER ROLES (separate table for security)
CREATE TYPE public.app_role AS ENUM ('admin_plus', 'admin', 'entraineur', 'joueur', 'photographe', 'dirigeant');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin_plus', 'admin'))
);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin or admin+
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin_plus', 'admin')
  )
$$;

-- Helper: check if user can manage (admin, admin+, entraineur)
CREATE OR REPLACE FUNCTION public.can_manage(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin_plus', 'admin', 'entraineur')
  )
$$;

-- 3. PLAYERS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT DEFAULT 'Non défini',
  matches INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  license_expiry TEXT,
  team TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players viewable by authenticated" ON public.players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers can update players" ON public.players FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers can delete players" ON public.players FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));

-- Add FK from profiles to players
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- 4. EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  type TEXT NOT NULL DEFAULT 'match',
  location TEXT,
  reason TEXT,
  recurrence TEXT DEFAULT 'ponctuel',
  team TEXT,
  presences JSONB DEFAULT '{}',
  convocations JSONB DEFAULT '{}',
  convocations_published BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable by authenticated" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers/dirigeants can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (
  public.can_manage(auth.uid()) OR public.has_role(auth.uid(), 'dirigeant')
);
CREATE POLICY "Managers can update events" ON public.events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Managers can delete events" ON public.events FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR created_by = auth.uid()
);

-- 5. ATTENDANCE RECORDS
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  status TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendance viewable by authenticated" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert attendance" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));

-- 6. NEWS
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  date TEXT NOT NULL,
  likes UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "News viewable by authenticated" ON public.news FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers/dirigeants can insert news" ON public.news FOR INSERT TO authenticated WITH CHECK (
  public.can_manage(auth.uid()) OR public.has_role(auth.uid(), 'dirigeant')
);
CREATE POLICY "Managers can update news" ON public.news FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Managers can delete news" ON public.news FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR author_id = auth.uid()
);

-- 7. NEWS COMMENTS
CREATE TABLE public.news_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES public.news(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  author_uid UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated" ON public.news_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comments" ON public.news_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_uid);
CREATE POLICY "Authors can delete own comments" ON public.news_comments FOR DELETE TO authenticated USING (
  auth.uid() = author_uid OR public.is_admin(auth.uid())
);

-- 8. CARDS
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  date TEXT NOT NULL,
  suspended_until TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cards viewable by authenticated" ON public.cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers can delete cards" ON public.cards FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));

-- 9. CHAMPIONSHIPS
CREATE TABLE public.championships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  teams TEXT[] DEFAULT '{}',
  fff_url TEXT,
  fff_standings JSONB DEFAULT '[]',
  team_logos JSONB DEFAULT '{}',
  team TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Championships viewable by authenticated" ON public.championships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert championships" ON public.championships FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Updaters can update championships" ON public.championships FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Managers can delete championships" ON public.championships FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));

-- 10. CHAMPIONSHIP MATCHES
CREATE TABLE public.championship_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID REFERENCES public.championships(id) ON DELETE CASCADE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  date TEXT NOT NULL,
  journee INTEGER NOT NULL,
  played BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.championship_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Champ matches viewable by authenticated" ON public.championship_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert champ matches" ON public.championship_matches FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Updaters can update champ matches" ON public.championship_matches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Managers can delete champ matches" ON public.championship_matches FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));

-- 11. ALBUMS
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Albums viewable by authenticated" ON public.albums FOR SELECT TO authenticated USING (true);
CREATE POLICY "Photo managers can insert albums" ON public.albums FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'photographe')
);
CREATE POLICY "Photo managers can delete albums" ON public.albums FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'photographe')
);

-- 12. GALLERY PHOTOS
CREATE TABLE public.gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  title TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploader_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery photos viewable by authenticated" ON public.gallery_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Photo managers can insert photos" ON public.gallery_photos FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'photographe')
);
CREATE POLICY "Photo managers can delete photos" ON public.gallery_photos FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'photographe')
);

-- 13. CHAT MESSAGES (global club chat)
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  image_url TEXT,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  user_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat messages viewable by authenticated" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors or admins can delete" ON public.chat_messages FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR public.is_admin(auth.uid())
);

-- 14. CONVERSATIONS (private/group chats)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  participant_names JSONB DEFAULT '{}',
  participant_photos JSONB DEFAULT '{}',
  participant_roles JSONB DEFAULT '{}',
  type TEXT NOT NULL DEFAULT 'private',
  name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  unread_count JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = ANY(participants));
CREATE POLICY "Authenticated can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = ANY(participants));
CREATE POLICY "Participants can update conversations" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = ANY(participants));
CREATE POLICY "Creator or admin can delete conversations" ON public.conversations FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR public.is_admin(auth.uid())
);

-- 15. CONVERSATION MESSAGES
CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  text TEXT,
  image_url TEXT,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Only participants of the conversation can see messages
CREATE POLICY "Participants can view convo messages" ON public.conversation_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND auth.uid() = ANY(participants))
);
CREATE POLICY "Participants can send convo messages" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND auth.uid() = ANY(participants))
);
CREATE POLICY "Authors or admins can delete convo messages" ON public.conversation_messages FOR DELETE TO authenticated USING (
  auth.uid() = sender_id OR public.is_admin(auth.uid())
);

-- 16. INVITATIONS
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  role TEXT NOT NULL DEFAULT 'joueur',
  position TEXT,
  license_expiry TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invitations viewable by authenticated" ON public.invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can create invitations" ON public.invitations FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Anyone can update invitation status" ON public.invitations FOR UPDATE TO authenticated USING (true);

-- 17. ANNOUNCEMENTS (admin+ only)
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements viewable by authenticated" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only super admins can manage announcements" ON public.announcements FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin_plus')
);

-- ============================================
-- ENABLE REALTIME on key tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.albums;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.championships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.championship_matches;

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_events_date ON public.events(date DESC);
CREATE INDEX idx_news_date ON public.news(date DESC);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at ASC);
CREATE INDEX idx_conversation_messages_convo ON public.conversation_messages(conversation_id, created_at ASC);
CREATE INDEX idx_attendance_player ON public.attendance_records(player_id);
CREATE INDEX idx_cards_player ON public.cards(player_id);
CREATE INDEX idx_champ_matches_champ ON public.championship_matches(championship_id);
CREATE INDEX idx_gallery_photos_album ON public.gallery_photos(album_id);
CREATE INDEX idx_news_comments_news ON public.news_comments(news_id);
CREATE INDEX idx_profiles_player ON public.profiles(player_id);
