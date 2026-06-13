/**
 * Database type definitions. In a real project these are generated with:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 * Kept hand-written here and checked into git so the client is fully typed
 * without requiring a live Supabase connection at build time.
 */
import type { TravelData } from '@/domain/schema';

// NOTE: must be a `type`, not an `interface`. Supabase's `GenericTable`
// constraint requires `Row extends Record<string, unknown>`, and interfaces
// (unlike type aliases) have no implicit index signature — using an interface
// here silently degrades every query to `never`.
export type TravelRecordRow = {
  id: string;
  user_id: string;
  data: TravelData;
  is_public: boolean;
  share_slug: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type FriendLinkRow = {
  id: string;
  user_id: string;
  slug: string;
  label: string | null;
  created_at: string;
};

export type TravelDocumentRow = {
  id: string;
  user_id: string;
  birthplace_country: string;
  is_public: boolean;
  share_slug: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

/**
 * Envelope returned by the document RPCs: the assembled TravelData plus the
 * sharing metadata the editor needs. Mirrors build_document_envelope() in SQL.
 */
export type TravelDocumentEnvelope = {
  data: TravelData;
  is_public: boolean;
  share_slug: string | null;
  version: number;
};

export type ProfileRow = {
  user_id: string;
  display_name: string;
  accent_color: string;
  public_handle: string | null;
  created_at: string;
  updated_at: string;
};

/** The signed-in user's own profile, as returned by get_my_profile(). */
export type MyProfile = {
  display_name: string;
  accent_color: string;
  public_handle: string | null;
};

/** The publicly visible slice of a profile, resolved from a share slug. */
export type SharedProfile = {
  display_name: string;
  accent_color: string;
};

export type Database = {
  public: {
    Tables: {
      travel_records: {
        Row: TravelRecordRow;
        Insert: {
          user_id?: string;
          data: TravelData;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Update: {
          data?: TravelData;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Relationships: [];
      };
      friend_links: {
        Row: FriendLinkRow;
        Insert: {
          user_id?: string;
          slug: string;
          label?: string | null;
        };
        Update: {
          label?: string | null;
        };
        Relationships: [];
      };
      travel_documents: {
        Row: TravelDocumentRow;
        Insert: {
          user_id?: string;
          birthplace_country?: string;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Update: {
          birthplace_country?: string;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          user_id?: string;
          display_name?: string;
          accent_color?: string;
          public_handle?: string | null;
        };
        Update: {
          display_name?: string;
          accent_color?: string;
          public_handle?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_shared_travel: {
        Args: { p_slug: string };
        Returns: TravelData | null;
      };
      get_my_travel_document: {
        Args: Record<never, never>;
        Returns: TravelDocumentEnvelope | null;
      };
      save_travel_document: {
        Args: { p_data: TravelData };
        Returns: TravelDocumentEnvelope;
      };
      set_travel_sharing: {
        Args: { p_is_public: boolean };
        Returns: TravelDocumentEnvelope;
      };
      get_my_profile: {
        Args: Record<never, never>;
        Returns: MyProfile | null;
      };
      save_my_profile: {
        Args: { p_display_name: string; p_accent_color: string };
        Returns: MyProfile;
      };
      get_shared_profile: {
        Args: { p_slug: string };
        Returns: SharedProfile | null;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
