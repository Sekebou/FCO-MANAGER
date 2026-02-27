export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      albums: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          event_date: string
          event_id: string
          event_type: string
          id: string
          player_id: string | null
          saved_at: string
          status: string
        }
        Insert: {
          event_date: string
          event_id: string
          event_type: string
          id?: string
          player_id?: string | null
          saved_at?: string
          status: string
        }
        Update: {
          event_date?: string
          event_id?: string
          event_type?: string
          id?: string
          player_id?: string | null
          saved_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          amount: number
          away_team: string
          created_at: string
          home_team: string
          id: string
          match_date: string
          odds: number
          payout: number
          prediction: string
          settled_at: string | null
          status: string
          user_id: string
          user_name: string
        }
        Insert: {
          amount: number
          away_team: string
          created_at?: string
          home_team: string
          id?: string
          match_date: string
          odds: number
          payout?: number
          prediction: string
          settled_at?: string | null
          status?: string
          user_id: string
          user_name: string
        }
        Update: {
          amount?: number
          away_team?: string
          created_at?: string
          home_team?: string
          id?: string
          match_date?: string
          odds?: number
          payout?: number
          prediction?: string
          settled_at?: string | null
          status?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          created_at: string
          date: string
          id: string
          player_id: string
          reason: string
          suspended_until: string | null
          type: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          player_id: string
          reason: string
          suspended_until?: string | null
          type: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          player_id?: string
          reason?: string
          suspended_until?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_matches: {
        Row: {
          away_score: number | null
          away_team: string
          championship_id: string
          created_at: string
          date: string
          home_score: number | null
          home_team: string
          id: string
          journee: number
          played: boolean | null
        }
        Insert: {
          away_score?: number | null
          away_team: string
          championship_id: string
          created_at?: string
          date: string
          home_score?: number | null
          home_team: string
          id?: string
          journee: number
          played?: boolean | null
        }
        Update: {
          away_score?: number | null
          away_team?: string
          championship_id?: string
          created_at?: string
          date?: string
          home_score?: number | null
          home_team?: string
          id?: string
          journee?: number
          played?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "championship_matches_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championships: {
        Row: {
          created_at: string
          fff_standings: Json | null
          fff_url: string | null
          id: string
          name: string
          season: string
          team: string | null
          team_logos: Json | null
          teams: string[] | null
        }
        Insert: {
          created_at?: string
          fff_standings?: Json | null
          fff_url?: string | null
          id?: string
          name: string
          season: string
          team?: string | null
          team_logos?: Json | null
          teams?: string[] | null
        }
        Update: {
          created_at?: string
          fff_standings?: Json | null
          fff_url?: string | null
          id?: string
          name?: string
          season?: string
          team?: string | null
          team_logos?: Json | null
          teams?: string[] | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          text: string
          user_id: string
          user_name: string
          user_photo: string | null
          user_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          text: string
          user_id: string
          user_name: string
          user_photo?: string | null
          user_role: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          text?: string
          user_id?: string
          user_name?: string
          user_photo?: string | null
          user_role?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          sender_id: string
          sender_name: string
          sender_photo: string | null
          sender_role: string
          text: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id: string
          sender_name: string
          sender_photo?: string | null
          sender_role: string
          text?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id?: string
          sender_name?: string
          sender_photo?: string | null
          sender_role?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          name: string | null
          participant_names: Json | null
          participant_photos: Json | null
          participant_roles: Json | null
          participants: string[]
          type: string
          unread_count: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          name?: string | null
          participant_names?: Json | null
          participant_photos?: Json | null
          participant_roles?: Json | null
          participants: string[]
          type?: string
          unread_count?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          name?: string | null
          participant_names?: Json | null
          participant_photos?: Json | null
          participant_roles?: Json | null
          participants?: string[]
          type?: string
          unread_count?: Json | null
        }
        Relationships: []
      }
      events: {
        Row: {
          away_logo: string | null
          convocations: Json | null
          convocations_published: boolean | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          date: string
          duration: number | null
          home_logo: string | null
          id: string
          location: string | null
          presences: Json | null
          reason: string | null
          recurrence: string | null
          team: string | null
          time: string | null
          title: string
          type: string
        }
        Insert: {
          away_logo?: string | null
          convocations?: Json | null
          convocations_published?: boolean | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          date: string
          duration?: number | null
          home_logo?: string | null
          id?: string
          location?: string | null
          presences?: Json | null
          reason?: string | null
          recurrence?: string | null
          team?: string | null
          time?: string | null
          title: string
          type?: string
        }
        Update: {
          away_logo?: string | null
          convocations?: Json | null
          convocations_published?: boolean | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          date?: string
          duration?: number | null
          home_logo?: string | null
          id?: string
          location?: string | null
          presences?: Json | null
          reason?: string | null
          recurrence?: string | null
          team?: string | null
          time?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          album_id: string
          id: string
          storage_path: string
          title: string | null
          uploaded_at: string
          uploaded_by: string | null
          uploader_name: string | null
          url: string
        }
        Insert: {
          album_id: string
          id?: string
          storage_path: string
          title?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          uploader_name?: string | null
          url: string
        }
        Update: {
          album_id?: string
          id?: string
          storage_path?: string
          title?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          uploader_name?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          license_expiry: string | null
          max_uses: number | null
          position: string | null
          role: string
          status: string
          use_count: number | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invited_by?: string | null
          license_expiry?: string | null
          max_uses?: number | null
          position?: string | null
          role?: string
          status?: string
          use_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          license_expiry?: string | null
          max_uses?: number | null
          position?: string | null
          role?: string
          status?: string
          use_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          author: string
          author_id: string | null
          content: string
          created_at: string
          date: string
          id: string
          likes: string[] | null
          title: string
        }
        Insert: {
          author: string
          author_id?: string | null
          content: string
          created_at?: string
          date: string
          id?: string
          likes?: string[] | null
          title: string
        }
        Update: {
          author?: string
          author_id?: string | null
          content?: string
          created_at?: string
          date?: string
          id?: string
          likes?: string[] | null
          title?: string
        }
        Relationships: []
      }
      news_comments: {
        Row: {
          author_name: string
          author_uid: string
          content: string
          created_at: string
          id: string
          news_id: string
        }
        Insert: {
          author_name: string
          author_uid: string
          content: string
          created_at?: string
          id?: string
          news_id: string
        }
        Update: {
          author_name?: string
          author_uid?: string
          content?: string
          created_at?: string
          id?: string
          news_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_comments_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          assists: number | null
          created_at: string
          goals: number | null
          id: string
          license_expiry: string | null
          matches: number | null
          name: string
          position: string | null
          team: string | null
        }
        Insert: {
          assists?: number | null
          created_at?: string
          goals?: number | null
          id?: string
          license_expiry?: string | null
          matches?: number | null
          name: string
          position?: string | null
          team?: string | null
        }
        Update: {
          assists?: number | null
          created_at?: string
          goals?: number | null
          id?: string
          license_expiry?: string | null
          matches?: number | null
          name?: string
          position?: string | null
          team?: string | null
        }
        Relationships: []
      }
      points_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_role: string | null
          email: string
          id: string
          license_expiry: string | null
          name: string
          photo_url: string | null
          player_id: string | null
          role: string
          team: string | null
          username: string | null
          welcome_seen: boolean | null
        }
        Insert: {
          created_at?: string
          display_role?: string | null
          email: string
          id: string
          license_expiry?: string | null
          name: string
          photo_url?: string | null
          player_id?: string | null
          role?: string
          team?: string | null
          username?: string | null
          welcome_seen?: boolean | null
        }
        Update: {
          created_at?: string
          display_role?: string | null
          email?: string
          id?: string
          license_expiry?: string | null
          name?: string
          photo_url?: string | null
          player_id?: string | null
          role?: string
          team?: string | null
          username?: string | null
          welcome_seen?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_player"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_bet: number
          total_won: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_bet?: number
          total_won?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_bet?: number
          total_won?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          session_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          session_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          session_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage: { Args: { _user_id: string }; Returns: boolean }
      get_own_session_token: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      place_bet: {
        Args: {
          p_amount: number
          p_away_team: string
          p_home_team: string
          p_match_date: string
          p_odds: number
          p_prediction: string
          p_user_id: string
          p_user_name: string
        }
        Returns: Json
      }
      register_user: {
        Args: {
          p_email: string
          p_invitation_id?: string
          p_license_expiry?: string
          p_name: string
          p_position?: string
          p_role: string
          p_user_id: string
        }
        Returns: Json
      }
      update_event_presence: {
        Args: { p_event_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin_plus"
        | "admin"
        | "entraineur"
        | "joueur"
        | "photographe"
        | "dirigeant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin_plus",
        "admin",
        "entraineur",
        "joueur",
        "photographe",
        "dirigeant",
      ],
    },
  },
} as const
